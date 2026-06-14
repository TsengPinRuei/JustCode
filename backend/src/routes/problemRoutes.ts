/**
 * API Routes：題目、程式執行、進度與匯入的所有 REST endpoint。
 * 路由：GET/DELETE problems、POST run/submit、POST import、hidden 測試案例匯入、GET/PUT progress。
 */
import express, { Request, Response } from 'express';
import { ProblemService } from '../services/problemService';
import { CodeExecutorFactory } from '../services/codeExecutorFactory';
import { LeetCodeService } from '../services/leetcodeService';
import {
    HiddenTestcaseImportRequest,
    ProblemMetadata,
    ProblemProgress,
    RunRequest,
    SubmitRequest,
    Testcase,
} from '../types';
import { PROTECTED_PROBLEMS } from '../constants';

const router = express.Router();
const problemService = new ProblemService();
const leetcodeService = new LeetCodeService();

// GET /api/problems - 取得所有題目列表。
router.get('/problems', async (req: Request, res: Response) => {
    try {
        const problems = await problemService.getAllProblems();
        res.json(problems);
    } catch (error) {
        console.error('Error fetching problems:', error);
        res.status(500).json({ error: 'Failed to fetch problems' });
    }
});

// GET /api/problems/:id - 取得題目詳細資料。
router.get('/problems/:id', async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const problem = await problemService.getProblem(id);

        // 詳細資料 endpoint 絕不暴露隱藏測試案例；Submit 會在伺服器端載入。
        res.json({
            metadata: problem.metadata,
            templates: problem.templates,
            visibleTestcases: problem.visibleTestcases,
            editorial: problem.editorial,
        });
    } catch (error) {
        console.error('Error fetching problem:', error);
        res.status(404).json({ error: 'Problem not found' });
    }
});

// POST /api/run - 使用可見或自訂測試案例執行程式碼。
router.post('/run', async (req: Request, res: Response) => {
    try {
        const { problemId, code, language, inputMode, customInput }: RunRequest = req.body;

        let testcases: Testcase[] = [];
        let metadata: ProblemMetadata;

        if (inputMode === 'custom') {
            // Metadata 驅動 runner 產生；custom 模式避免讀取測試案例，讓臨時執行成本較低。
            metadata = await problemService.getProblemMetadata(problemId);
            if (typeof customInput !== 'string' || customInput.trim() === '') {
                return res.status(400).json({ error: 'Custom input cannot be empty in custom mode' });
            }
            // 自訂輸入必須與 testcase.input 使用相同 JSON 物件形狀。
            try {
                const parsedInput = JSON.parse(customInput);
                testcases = [
                    {
                        input: parsedInput,
                        output: [], // 自訂輸入沒有預期輸出。
                    },
                ];
            } catch (error) {
                return res.status(400).json({ error: 'Invalid custom input JSON format' });
            }
        } else {
            // Run 模式刻意排除隱藏測試，讓使用者可檢查每組輸入/結果。
            const problem = await problemService.getProblemForRun(problemId);
            metadata = problem.metadata;
            testcases = problem.visibleTestcases;
        }

        // 將語言專屬 harness 產生與執行委派給選定的 executor。
        const executor = CodeExecutorFactory.getExecutor(language);
        const result = await executor.executeCode(
            code,
            testcases,
            true,
            metadata,
            testcases.length
        );
        if (inputMode === 'custom' && result.status !== 'CE') {
            // 自訂執行沒有預期答案，因此值不相符仍算成功執行。
            const testcaseResults = result.testcaseResults.map((testcaseResult) => {
                const nextStatus = testcaseResult.status === 'Failed' ? 'Passed' : testcaseResult.status;
                return {
                    ...testcaseResult,
                    status: nextStatus,
                    expected: undefined,
                };
            });
            const hasTimeout = testcaseResults.some((testcaseResult) => testcaseResult.status === 'Timeout');
            const hasError = testcaseResults.some((testcaseResult) => testcaseResult.status === 'Error');
            const normalizedStatus = hasTimeout ? 'TLE' : hasError ? 'RE' : 'AC';

            return res.json({
                ...result,
                status: normalizedStatus,
                message: hasTimeout
                    ? 'Time Limit Exceeded'
                    : hasError
                        ? result.message || 'Runtime Error'
                        : 'Executed successfully',
                testcaseResults,
                totalTestcases: testcaseResults.length,
                passedTestcases: hasTimeout || hasError ? 0 : testcaseResults.length,
            });
        }
        res.json(result);
    } catch (error) {
        console.error('Error running code:', error);
        res.status(500).json({ error: 'Failed to run code' });
    }
});

// POST /api/submit - 使用所有測試案例提交程式碼。
router.post('/submit', async (req: Request, res: Response) => {
    try {
        const { problemId, code, language }: SubmitRequest = req.body;

        // 可見與隱藏案例都需要 metadata 產生 runner。
        const problem = await problemService.getProblemForExecution(problemId);

        // 保留邊界，讓 executor 可摘要隱藏案例，但不揭露其輸入。
        const visibleTestcases = problem.visibleTestcases;
        const hiddenTestcases = problem.hiddenTestcases || [];
        const testcases = [...visibleTestcases, ...hiddenTestcases];

        // Submit 會隱藏隱藏輸入，但仍將其納入 total/passed 統計。
        const executor = CodeExecutorFactory.getExecutor(language);
        const result = await executor.executeCode(
            code,
            testcases,
            false,
            problem.metadata,
            visibleTestcases.length
        );
        res.json(result);
    } catch (error) {
        console.error('Error submitting code:', error);
        res.status(500).json({ error: 'Failed to submit code' });
    }
});

// POST /api/import-problem - 透過 URL 匯入 LeetCode 題目。
router.post('/import-problem', async (req: Request, res: Response) => {
    try {
        const { url } = req.body;
        if (!url || typeof url !== 'string') {
            return res.status(400).json({ error: 'URL is required' });
        }

        const result = await leetcodeService.importProblem(url);
        await problemService.saveProblem(result.metadata.id, result);

        res.json({
            success: true,
            problemId: result.metadata.id,
            title: result.metadata.title,
        });
    } catch (error: unknown) {
        console.error('Error importing problem:', error);
        const message = error instanceof Error ? error.message : 'Failed to import problem';
        res.status(500).json({ error: message });
    }
});

// POST /api/problems/:id/hidden-testcases - append 或 replace 本機隱藏測試案例 JSON。
router.post('/problems/:id/hidden-testcases', async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const request: HiddenTestcaseImportRequest = req.body;
        const result = await problemService.importHiddenTestcases(id, request);
        res.json(result);
    } catch (error: unknown) {
        console.error('Error importing hidden testcases:', error);
        const message = error instanceof Error ? error.message : 'Failed to import hidden testcases';
        res.status(400).json({ error: message });
    }
});

// GET /api/progress - 取得所有題目的進度。
router.get('/progress', async (req: Request, res: Response) => {
    try {
        const progress = await problemService.getAllProgress();
        res.json(progress);
    } catch (error) {
        console.error('Error fetching progress:', error);
        res.status(500).json({ error: 'Failed to fetch progress' });
    }
});

// GET /api/progress/:id - 取得指定題目的進度。
router.get('/progress/:id', async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const progress = await problemService.getProgress(id);
        res.json(progress);
    } catch (error) {
        console.error('Error fetching progress:', error);
        res.status(500).json({ error: 'Failed to fetch progress' });
    }
});

// PUT /api/progress/:id - 儲存指定題目的進度。
router.put('/progress/:id', async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const progress: ProblemProgress = req.body;
        // 使用伺服器時間，讓不同 client 的進度排序一致。
        progress.lastUpdated = new Date().toISOString();
        await problemService.saveProgress(id, progress);
        res.json({ success: true });
    } catch (error) {
        console.error('Error saving progress:', error);
        res.status(500).json({ error: 'Failed to save progress' });
    }
});

// DELETE /api/problems/:id - 刪除題目。
router.delete('/problems/:id', async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        // UI 也會隱藏此動作，但 API 必須防範直接請求。
        if (PROTECTED_PROBLEMS.has(id)) {
            return res.status(403).json({ error: 'Cannot delete built-in problems' });
        }
        await problemService.deleteProblem(id);
        res.json({ success: true });
    } catch (error) {
        console.error('Error deleting problem:', error);
        res.status(500).json({ error: 'Failed to delete problem' });
    }
});

export default router;
