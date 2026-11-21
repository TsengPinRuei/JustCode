import { randomUUID } from 'node:crypto';
import { performance } from 'node:perf_hooks';
import { activityFilter, pageNumber } from '../services/activityQueries';
import { parseJson } from '../shared/json';
import express, { Request, Response } from 'express';
import { ProblemService } from '../services/problemService';
import { CodeExecutorFactory } from '../services/codeExecutorFactory';
import { LeetCodeService } from '../services/leetcodeService';
import { HiddenTestcaseImportRequest, ProblemMetadata, Testcase } from '../types';
import { PROTECTED_PROBLEMS } from '../constants';
import { isRecord, RequestError, validateExecutionRequest, validateProgress } from '../requestValidation';

const MAX_CONCURRENT_EXECUTIONS = 2;

function endpoint(handler: (req: Request, res: Response) => Promise<unknown>): express.RequestHandler {
    return (req, res) => {
        void handler(req, res).catch((error: unknown) => {
            const code = isRecord(error) ? error.code : undefined;
            const status = error instanceof RequestError ? error.status :
                code === 'ENOENT' ? 404 : code === 'EEXIST' ? 409 : code === 'EINVAL' ? 400 : 500;
            if (status === 500) console.error('API request failed:', error);
            const message = error instanceof Error ? error.message : 'Request failed';
            res.status(status).json({ error: code === 'ENOENT' ? 'Problem not found' : message });
        });
    };
}

function validateLanguage(metadata: ProblemMetadata, language: string): void {
    if (!metadata.supportedLanguages.includes(language as 'java' | 'python3')) {
        throw new RequestError('Language is not supported by this problem');
    }
}

export function createProblemRouter(
    problemService: ProblemService,
    leetcodeService = new LeetCodeService(),
): express.Router {
    const router = express.Router();
    let activeExecutions = 0;

    // Reject excess executions instead of queueing them, limiting process and memory use.
    const execute: express.RequestHandler = (_req, res, next) => {
        if (activeExecutions >= MAX_CONCURRENT_EXECUTIONS) {
            res.setHeader('Retry-After', '1');
            return res.status(429).json({ error: 'Execution is busy. Please retry shortly.' });
        }
        activeExecutions++;
        let released = false;
        const release = () => {
            if (released) return;
            released = true;
            activeExecutions--;
        };
        // A disconnected client may leave its execution running.
        // Release capacity only when the handler finishes.
        res.locals.releaseExecution = release;
        next();
    };

    router.get('/problems', endpoint(async (_req, res) => res.json(await problemService.getAllProblems())));
    router.get('/problems/:id', endpoint(async (req, res) => {
        const problem = await problemService.getProblem(req.params.id);
        res.json({
            metadata: problem.metadata,
            templates: problem.templates,
            visibleTestcases: problem.visibleTestcases,
            editorial: problem.editorial,
        });
    }));

    router.post('/run', execute, endpoint(async (req, res) => {
        try {
            const { problemId, code, language, inputMode, customInput } = validateExecutionRequest(req.body, true);
            let metadata: ProblemMetadata;
            let testcases: Testcase[];
            if (inputMode === 'custom') {
                metadata = await problemService.getProblemMetadata(problemId);
                if (typeof customInput !== 'string' || !customInput.trim()) {
                    throw new RequestError('Custom input cannot be empty in custom mode');
                }
                let input: unknown;
                try {
                    input = parseJson(customInput);
                } catch {
                    throw new RequestError('Invalid custom input JSON format');
                }
                if (!isRecord(input)) throw new RequestError('Custom input must be a JSON object');
                if (metadata.params) {
                    const names = new Set(metadata.params.map(param => param.name));
                    const keys = Object.keys(input);
                    if (keys.length !== names.size || keys.some(key => !names.has(key))) {
                        throw new RequestError(`Custom input keys must exactly match params: ${[...names].join(', ')}`);
                    }
                }
                testcases = [{ input, output: null }];
            } else {
                const problem = await problemService.getProblemForRun(problemId);
                metadata = problem.metadata;
                testcases = problem.visibleTestcases;
            }
            validateLanguage(metadata, language);
            if (!testcases.length) throw new RequestError('Problem has no testcases');
            const { judgeError: _internal, ...result } = await CodeExecutorFactory.getExecutor(language).executeCode(
                code, testcases, true, metadata, testcases.length,
            );
            // Custom input has no expected answer. Convert comparison failures to success,
            // but preserve compilation, runtime, timeout, and infrastructure failures.
            if (inputMode === 'custom') {
                const testcaseResults = result.testcaseResults.map(testcase => ({
                    ...testcase,
                    status: testcase.status === 'Failed' ? 'Passed' as const : testcase.status,
                    expected: undefined,
                }));
                const succeeded = (result.status === 'AC' || result.status === 'WA') &&
                    testcaseResults.length === 1 && testcaseResults[0].status === 'Passed';
                return res.json({
                    ...result,
                    ...(succeeded ? { status: 'AC', message: 'Executed successfully', passedTestcases: 1 } : {}),
                    testcaseResults,
                });
            }
            res.json(result);
        } finally {
            res.locals.releaseExecution();
        }
    }));

    router.post('/submit', endpoint(async (req, res) => {
        const payload = validateExecutionRequest(req.body, false);
        const submissionId = req.body.submissionId === undefined ? randomUUID() : req.body.submissionId;
        if (typeof submissionId !== 'string' || !/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(submissionId)) {
            throw new RequestError('submissionId must be a UUID');
        }
        const request = { ...payload, submissionId };
        let hasSlot = false;
        try {
            const admitted = await problemService.admitSubmission(request, () => {
                if (activeExecutions >= MAX_CONCURRENT_EXECUTIONS) {
                    res.setHeader('Retry-After', '1');
                    throw new RequestError('Execution is busy. Please retry shortly.', 429);
                }
                activeExecutions++;
                hasSlot = true;
            });
            if (admitted.existing) {
                const { state, result, error } = admitted.existing;
                return res.status(state === 'running' ? 202 : 200).json({ ...result, submissionId, state, ...(error && { error }) });
            }
            const problem = admitted.problem!;
            const started = performance.now();
            try {
                const { judgeError, ...result } = await CodeExecutorFactory.getExecutor(request.language).executeCode(request.code,
                    [...problem.visibleTestcases, ...(problem.hiddenTestcases ?? [])], false, problem.metadata, problem.visibleTestcases.length);
                if (judgeError) throw new RequestError('The judge could not evaluate this submission.', 503);
                problemService.practice.complete(request, result, Math.round(performance.now() - started));
                if (!res.destroyed) res.json({ ...result, submissionId, state: 'completed' });
            } catch (cause) {
                const message = cause instanceof RequestError ? cause.message : 'Unable to complete submission';
                if (!(cause instanceof RequestError)) console.error('Submission failed:', cause);
                problemService.practice.fail(submissionId, message);
                if (!res.destroyed) res.status(cause instanceof RequestError ? cause.status : 500)
                    .json({ submissionId, state: 'error', error: message });
            }
        } finally {
            if (hasSlot) activeExecutions--;
        }
    }));

    router.get('/submissions', endpoint(async (req, res) => {
        const filter = activityFilter(req.query);
        res.json(problemService.practice.activity.list(filter, pageNumber(req.query.page, 1, 1_000_000_000),
            pageNumber(req.query.limit, 50, 100)));
    }));
    router.get('/submissions/:id', endpoint(async (req, res) => {
        const item = problemService.practice.activity.detail(req.params.id);
        if (!item) throw new RequestError('Submission not found', 404);
        res.json(item);
    }));
    router.patch('/submissions/:id/timing', endpoint(async (req, res) => {
        const valid = (n: unknown): n is number => typeof n === 'number' && Number.isSafeInteger(n) && n >= 0;
        if (!isRecord(req.body) || !valid(req.body.submitDurationMs) ||
            (req.body.durationMs !== undefined && !valid(req.body.durationMs)) ||
            Object.keys(req.body).some(key => key !== 'durationMs' && key !== 'submitDurationMs')) {
            throw new RequestError('Invalid browser timings');
        }
        problemService.practice.timing(req.params.id, req.body.submitDurationMs, req.body.durationMs);
        res.json({ success: true });
    }));
    router.get('/stats/daily', endpoint(async (req, res) => res.json(problemService.practice.activity.daily(activityFilter(req.query)))));

    router.post('/import-problem', endpoint(async (req, res) => {
        if (!isRecord(req.body) || typeof req.body.url !== 'string' || !req.body.url.trim()) {
            throw new RequestError('URL is required');
        }
        const result = await leetcodeService.importProblem(req.body.url);
        await problemService.saveProblem(result.metadata.id, result);
        res.json({ success: true, problemId: result.metadata.id, title: result.metadata.title });
    }));

    router.post('/problems/:id/hidden-testcases', endpoint(async (req, res) => {
        if (!isRecord(req.body) || !['append', 'replace'].includes(String(req.body.mode)) ||
            !['content', 'projectPath'].includes(String(req.body.sourceType))) {
            throw new RequestError('Invalid hidden testcase import request');
        }
        const result = await problemService.importHiddenTestcases(
            req.params.id, req.body as unknown as HiddenTestcaseImportRequest,
        );
        res.json(result);
    }));

    router.get('/progress', endpoint(async (req, res) => res.json(
        req.query.view === 'status' ? problemService.practice.statuses() : await problemService.getAllProgress()
    )));
    router.get('/progress/:id', endpoint(async (req, res) => res.json(await problemService.getProgress(req.params.id))));
    router.put('/progress/:id', endpoint(async (req, res) => {
        if (isRecord(req.body) && (req.body.solveRecords !== undefined || req.body.status === 'solved')) {
            throw new RequestError('Solve history and solved status are assigned by Submit');
        }
        await problemService.saveProgress(req.params.id, validateProgress(req.body));
        res.json({ success: true });
    }));
    router.delete('/problems/:id', endpoint(async (req, res) => {
        if (PROTECTED_PROBLEMS.has(req.params.id.toLowerCase())) throw new RequestError('Cannot delete built-in problems', 403);
        await problemService.deleteProblem(req.params.id);
        res.json({ success: true });
    }));
    return router;
}
