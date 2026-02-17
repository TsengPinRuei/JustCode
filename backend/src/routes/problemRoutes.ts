import express, { Request, Response } from 'express';
import { ProblemService } from '../services/problemService';
import { CodeExecutorFactory } from '../services/codeExecutorFactory';
import { LeetCodeService } from '../services/leetcodeService';
import { RunRequest, SubmitRequest, Testcase } from '../types';

const router = express.Router();
const problemService = new ProblemService();
const leetcodeService = new LeetCodeService();

// GET /api/problems - Get list of all problems
router.get('/problems', async (req: Request, res: Response) => {
    try {
        const problems = await problemService.getAllProblems();
        res.json(problems);
    } catch (error) {
        console.error('Error fetching problems:', error);
        res.status(500).json({ error: 'Failed to fetch problems' });
    }
});

// GET /api/problems/:id - Get problem details
router.get('/problems/:id', async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const problem = await problemService.getProblem(id);

        // Return metadata, templates, and visible testcases only
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

// POST /api/run - Run code with visible or custom testcases
router.post('/run', async (req: Request, res: Response) => {
    try {
        const { problemId, code, language, inputMode, customInput }: RunRequest = req.body;

        // Load problem for metadata
        const problem = await problemService.getProblem(problemId);
        let testcases: Testcase[] = [];

        if (inputMode === 'custom' && customInput) {
            // Parse custom input
            try {
                const parsedInput = JSON.parse(customInput);
                testcases = [
                    {
                        input: parsedInput,
                        output: [], // We don't have expected output for custom input
                    },
                ];
            } catch (error) {
                return res.status(400).json({ error: 'Invalid custom input JSON format' });
            }
        } else {
            // Use visible testcases
            testcases = await problemService.getVisibleTestcases(problemId);
        }

        // Get appropriate executor based on language
        const executor = CodeExecutorFactory.getExecutor(language);
        const result = await executor.executeCode(code, testcases, true, problem.metadata);
        res.json(result);
    } catch (error) {
        console.error('Error running code:', error);
        res.status(500).json({ error: 'Failed to run code' });
    }
});

// POST /api/submit - Submit code with all testcases
router.post('/submit', async (req: Request, res: Response) => {
    try {
        const { problemId, code, language }: SubmitRequest = req.body;

        // Load problem for metadata
        const problem = await problemService.getProblem(problemId);

        // Get all testcases (visible + hidden)
        const testcases = await problemService.getAllTestcases(problemId);

        // Get appropriate executor based on language
        const executor = CodeExecutorFactory.getExecutor(language);
        // Don't show hidden inputs in results
        const result = await executor.executeCode(code, testcases, false, problem.metadata);
        res.json(result);
    } catch (error) {
        console.error('Error submitting code:', error);
        res.status(500).json({ error: 'Failed to submit code' });
    }
});

// POST /api/import-problem - Import a LeetCode problem by URL
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

export default router;
