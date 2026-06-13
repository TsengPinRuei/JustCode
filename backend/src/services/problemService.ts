/**
 * Problem Service — File-based CRUD for problem data and user progress.
 * Reads/writes problem.json, templates, testcases, editorial, and progress.json
 * from the problems/ directory.
 */
import { promises as fs } from 'fs';
import * as path from 'path';
import { Problem, ProblemMetadata, Testcase, ProblemProgress } from '../types';

// Backend commands run from backend/, so ../problems resolves to the shared problem store.
const PROBLEMS_DIR = path.join(process.cwd(), '..', 'problems');

export class ProblemService {
    /** Reject path separators so problem IDs cannot escape the problems/ directory. */
    private validateProblemId(problemId: string): void {
        if (!problemId || /[\/\\]/.test(problemId) || problemId === '.' || problemId === '..') {
            throw new Error(`Invalid problem ID: ${problemId}`);
        }
    }

    /** Build the canonical directory path after validating the user-provided ID. */
    private getProblemDir(problemId: string): string {
        this.validateProblemId(problemId);
        return path.join(PROBLEMS_DIR, problemId);
    }

    /** Read and parse JSON files that make up problem metadata, testcases, and progress. */
    private async readJsonFile<T>(filePath: string): Promise<T> {
        const content = await fs.readFile(filePath, 'utf-8');
        return JSON.parse(content) as T;
    }

    /** problem.json is the canonical metadata file for list/detail/execution paths. */
    private async readProblemMetadata(problemDir: string): Promise<ProblemMetadata> {
        return this.readJsonFile<ProblemMetadata>(path.join(problemDir, 'problem.json'));
    }

    /** Visible testcases are required because Run mode and problem list validation depend on them. */
    private async readVisibleTestcases(problemDir: string): Promise<Testcase[]> {
        return this.readJsonFile<Testcase[]>(path.join(problemDir, 'testcases_visible.json'));
    }

    /** Hidden testcases are optional so imported problems can run before maintainers add private cases. */
    private async readHiddenTestcases(problemDir: string): Promise<Testcase[]> {
        try {
            return await this.readJsonFile<Testcase[]>(path.join(problemDir, 'testcases_hidden.json'));
        } catch {
            // Missing or unreadable hidden tests should not block Run mode or problem details.
            return [];
        }
    }

    /** Scan problems/ directory and return metadata for all valid problems, sorted by title */
    async getAllProblems(): Promise<ProblemMetadata[]> {
        // Treat each immediate subdirectory as a candidate problem.
        const entries = await fs.readdir(PROBLEMS_DIR, { withFileTypes: true });
        const problemReads = entries
            .filter((entry) => entry.isDirectory())
            .map(async (entry): Promise<ProblemMetadata | null> => {
                try {
                    const problemDir = this.getProblemDir(entry.name);
                    const metadata = await this.readProblemMetadata(problemDir);
                    // Preserve the previous list behavior: directories without valid visible tests are skipped.
                    await this.readVisibleTestcases(problemDir);
                    return metadata;
                } catch (error) {
                    // Skip directories without valid problem.json
                    console.warn(`Skipping invalid problem directory: ${entry.name}`);
                    return null;
                }
            });

        const problems = (await Promise.all(problemReads))
            .filter((problem): problem is ProblemMetadata => problem !== null);

        // Titles include LeetCode-style prefixes, so title sort keeps the visible list stable.
        problems.sort((a, b) => a.title.localeCompare(b.title));

        return problems;
    }

    /** Load a complete problem by ID: metadata, templates, testcases, and editorial */
    async getProblem(problemId: string): Promise<Problem> {
        const problemDir = this.getProblemDir(problemId);

        // Read problem metadata
        const metadata = await this.readProblemMetadata(problemDir);

        // Missing templates should not make the whole problem unreadable; the editor can show an empty buffer.
        const templateEntries = await Promise.all(metadata.supportedLanguages.map(async (lang) => {
            const ext = lang === 'java' ? 'java' : 'py';
            const templatePath = path.join(problemDir, `template.${ext}`);
            try {
                return [lang, await fs.readFile(templatePath, 'utf-8')] as const;
            } catch (error) {
                console.error(`Template not found for ${lang}:`, error);
                // If template doesn't exist, use empty string
                return [lang, ''] as const;
            }
        }));
        const templates = Object.fromEntries(templateEntries);

        const [visibleTestcases, hiddenTestcases, editorial] = await Promise.all([
            this.readVisibleTestcases(problemDir),
            this.readHiddenTestcases(problemDir),
            fs.readFile(path.join(problemDir, 'editorial.md'), 'utf-8').catch(() => undefined),
        ]);

        return {
            metadata,
            templates: templates as Record<'java' | 'python3', string>,
            visibleTestcases,
            hiddenTestcases,
            editorial,
        };
    }

    /** Load only the files required by Run/Submit execution paths. */
    async getProblemForExecution(problemId: string): Promise<Pick<Problem, 'metadata' | 'visibleTestcases' | 'hiddenTestcases'>> {
        const problemDir = this.getProblemDir(problemId);
        const [metadata, visibleTestcases, hiddenTestcases] = await Promise.all([
            this.readProblemMetadata(problemDir),
            this.readVisibleTestcases(problemDir),
            this.readHiddenTestcases(problemDir),
        ]);

        return { metadata, visibleTestcases, hiddenTestcases };
    }

    /** Load only metadata for custom Run mode, where testcase files are not used. */
    async getProblemMetadata(problemId: string): Promise<ProblemMetadata> {
        return this.readProblemMetadata(this.getProblemDir(problemId));
    }

    /** Load only metadata plus visible cases for Run mode, without touching hidden testcase files. */
    async getProblemForRun(problemId: string): Promise<Pick<Problem, 'metadata' | 'visibleTestcases'>> {
        const problemDir = this.getProblemDir(problemId);
        const [metadata, visibleTestcases] = await Promise.all([
            this.readProblemMetadata(problemDir),
            this.readVisibleTestcases(problemDir),
        ]);

        return { metadata, visibleTestcases };
    }

    /** Get only visible testcases (for Run mode) — reads file directly for efficiency */
    async getVisibleTestcases(problemId: string): Promise<Testcase[]> {
        return this.readVisibleTestcases(this.getProblemDir(problemId));
    }

    /** Get hidden testcases only (for Submit mode) */
    async getHiddenTestcases(problemId: string): Promise<Testcase[]> {
        return this.readHiddenTestcases(this.getProblemDir(problemId));
    }

    /** Get all testcases — visible + hidden (for Submit mode) — reads files directly for efficiency */
    async getAllTestcases(problemId: string): Promise<Testcase[]> {
        const problemDir = this.getProblemDir(problemId);
        const [visibleTestcases, hiddenTestcases] = await Promise.all([
            this.readVisibleTestcases(problemDir),
            this.readHiddenTestcases(problemDir),
        ]);
        return [...visibleTestcases, ...hiddenTestcases];
    }

    /** Save a new problem: metadata, templates, and visible testcases */
    async saveProblem(problemId: string, data: {
        metadata: ProblemMetadata;
        templates: Record<string, string>;
        visibleTestcases: Testcase[];
    }): Promise<void> {
        const problemDir = this.getProblemDir(problemId);
        await fs.mkdir(problemDir, { recursive: true });

        const writes: Array<Promise<void>> = [
            // Persist the imported problem in the same file layout consumed by getProblem().
            fs.writeFile(
                path.join(problemDir, 'problem.json'),
                JSON.stringify(data.metadata, null, 4),
                'utf-8'
            ),
            // Write visible testcases.
            fs.writeFile(
                path.join(problemDir, 'testcases_visible.json'),
                JSON.stringify(data.visibleTestcases, null, 4),
                'utf-8'
            ),
            // Imported LeetCode problems only provide example cases; keep a placeholder for future manual hidden tests.
            fs.writeFile(
                path.join(problemDir, 'testcases_hidden.json'),
                JSON.stringify([], null, 4),
                'utf-8'
            ),
        ];

        // Template filenames are derived from language keys so imported snippets match getProblem() lookup rules.
        for (const [lang, template] of Object.entries(data.templates)) {
            const ext = lang === 'java' ? 'java' : 'py';
            writes.push(fs.writeFile(
                path.join(problemDir, `template.${ext}`),
                template,
                'utf-8'
            ));
        }

        await Promise.all(writes);
    }

    /** Read user progress from progress.json; returns null for missing or unreadable progress. */
    async getProgress(problemId: string): Promise<ProblemProgress | null> {
        const progressPath = path.join(this.getProblemDir(problemId), 'progress.json');
        try {
            return await this.readJsonFile<ProblemProgress>(progressPath);
        } catch {
            return null;
        }
    }

    /** Write user progress to progress.json */
    async saveProgress(problemId: string, progress: ProblemProgress): Promise<void> {
        const progressPath = path.join(this.getProblemDir(problemId), 'progress.json');
        await fs.writeFile(progressPath, JSON.stringify(progress, null, 4), 'utf-8');
    }

    /** Collect progress from all problem directories */
    async getAllProgress(): Promise<Record<string, ProblemProgress>> {
        const entries = await fs.readdir(PROBLEMS_DIR, { withFileTypes: true });
        const result: Record<string, ProblemProgress> = {};

        const progressReads = entries
            .filter((entry) => entry.isDirectory())
            .map(async (entry): Promise<[string, ProblemProgress] | null> => {
                const progress = await this.getProgress(entry.name);
                if (progress) {
                    return [entry.name, progress];
                }
                return null;
            });

        for (const progressEntry of await Promise.all(progressReads)) {
            if (progressEntry) {
                const [problemId, progress] = progressEntry;
                result[problemId] = progress;
            }
        }

        return result;
    }

    /** Permanently delete a problem directory; callers must enforce protected problem rules first. */
    async deleteProblem(problemId: string): Promise<void> {
        const problemDir = this.getProblemDir(problemId);
        await fs.rm(problemDir, { recursive: true, force: true });
    }
}
