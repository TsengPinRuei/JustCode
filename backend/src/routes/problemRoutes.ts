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
            res.status(status).json({ error: status === 404 ? 'Problem not found' : message });
        });
    };
}

function validateLanguage(metadata: ProblemMetadata, language: string): void {
    if (!metadata.supportedLanguages.includes(language as 'java' | 'python3')) {
        throw new RequestError('Language is not supported by this problem');
    }
}

export function createProblemRouter(
    problemService = new ProblemService(),
    leetcodeService = new LeetCodeService(),
): express.Router {
    const router = express.Router();
    let activeExecutions = 0;

    // 拒絕額外工作而不累積無界佇列，讓快速重複提交不會耗盡本機程序與記憶體。
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
        // 連線中斷不代表執行已停止；只在 handler 真正結束後釋放名額。
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
                    input = JSON.parse(customInput);
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
            const result = await CodeExecutorFactory.getExecutor(language).executeCode(
                code, testcases, true, metadata, testcases.length,
            );
            // 自訂輸入沒有 expected；只把值比較不符改為成功，保留 CE/RE/TLE 和基礎設施錯誤。
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

    router.post('/submit', execute, endpoint(async (req, res) => {
        try {
            const { problemId, code, language } = validateExecutionRequest(req.body, false);
            const problem = await problemService.getProblemForExecution(problemId);
            validateLanguage(problem.metadata, language);
            const testcases = [...problem.visibleTestcases, ...(problem.hiddenTestcases ?? [])];
            if (!testcases.length) throw new RequestError('Problem has no testcases');
            const result = await CodeExecutorFactory.getExecutor(language).executeCode(
                code, testcases, false, problem.metadata, problem.visibleTestcases.length,
            );
            res.json(result);
        } finally {
            res.locals.releaseExecution();
        }
    }));

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

    router.get('/progress', endpoint(async (_req, res) => res.json(await problemService.getAllProgress())));
    router.get('/progress/:id', endpoint(async (req, res) => res.json(await problemService.getProgress(req.params.id))));
    router.put('/progress/:id', endpoint(async (req, res) => {
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

export default createProblemRouter();
