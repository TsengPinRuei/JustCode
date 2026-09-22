import { promises as fs } from 'fs';
import * as path from 'path';
import { isProblemId, isRecord, validateMetadata, validateTestcases } from './problemValidation';
import { hasErrorCode, invalidInput, mapInBatches, MAX_DATA_BYTES, readTextFile, withStorageLock, writeJsonAtomic } from './storage';
import { validateProgress } from '../requestValidation';
import {
    HiddenTestcaseImportRequest,
    HiddenTestcaseImportResponse,
    Problem,
    ProblemMetadata,
    ProblemProgress,
    Testcase,
} from '../types';

// Store problem files and progress under the project's problems directory.
export class ProblemService {
    private readonly projectRoot: string;
    private readonly problemsDir: string;

    // Source and compiled service files resolve to the same project root, regardless of cwd.
    constructor(projectRoot = path.resolve(__dirname, '../../..')) {
        this.projectRoot = path.resolve(projectRoot);
        this.problemsDir = path.join(this.projectRoot, 'problems');
    }

    // Require lowercase IDs to prevent path traversal and aliases on case-insensitive filesystems.
    private validateProblemId(problemId: string): void {
        if (!isProblemId(problemId)) {
            throw invalidInput('Invalid problem ID');
        }
    }

    private getProblemDir(problemId: string): string {
        this.validateProblemId(problemId);
        return path.join(this.problemsDir, problemId);
    }

    private async assertProblemDirectory(problemDir: string): Promise<void> {
        for (const directory of new Set([this.problemsDir, problemDir])) {
            const stat = await fs.lstat(directory);
            if (!stat.isDirectory() || stat.isSymbolicLink()) {
                throw invalidInput('Problem storage must use directories, not symbolic links');
            }
        }
    }

    // Parse JSON here; callers must validate the resulting data shape.
    private async readJsonFile<T>(filePath: string): Promise<T> {
        await this.assertProblemDirectory(path.dirname(filePath));
        const content = await readTextFile(filePath);
        return JSON.parse(content) as T;
    }

    // Use the same validated metadata file for listing, display, and execution.
    private async readProblemMetadata(problemDir: string): Promise<ProblemMetadata> {
        return validateMetadata(await this.readJsonFile(path.join(problemDir, 'problem.json')), path.basename(problemDir));
    }

    // A non-empty visible testcase file is required for listing and Run.
    private async readVisibleTestcases(problemDir: string): Promise<Testcase[]> {
        return validateTestcases(await this.readJsonFile(path.join(problemDir, 'testcases_visible.json')), undefined, false);
    }

    // A missing hidden testcase file is allowed so newly imported problems can still run.
    private async readHiddenTestcases(problemDir: string): Promise<Testcase[]> {
        try {
            return validateTestcases(await this.readJsonFile(path.join(problemDir, 'testcases_hidden.json')));
        } catch (error) {
            // Treat a missing file as an empty test set, but report corruption instead of reducing coverage.
            if (hasErrorCode(error, 'ENOENT')) return [];
            throw error;
        }
    }

    // Resolve an existing project-relative file and require its real path to stay inside the project.
    private async readProjectRelativeFile(projectPath: string): Promise<string> {
        if (typeof projectPath !== 'string') throw invalidInput('Project path is required');
        const rawPath = projectPath.trim();
        if (!rawPath) {
            throw invalidInput('Project path is required');
        }
        if (path.isAbsolute(rawPath)) {
            throw invalidInput('Project path must be relative to the JustCode project');
        }

        const resolvedPath = path.resolve(this.projectRoot, rawPath);
        const projectRootRealPath = await fs.realpath(this.projectRoot);
        let fileRealPath: string;
        try {
            // Resolve symlinks before checking that the file stays inside the project.
            fileRealPath = await fs.realpath(resolvedPath);
        } catch {
            throw invalidInput('Project path must point to an existing file');
        }
        if (fileRealPath !== projectRootRealPath && !fileRealPath.startsWith(projectRootRealPath + path.sep)) {
            throw invalidInput('Project path must stay inside the JustCode project');
        }

        try {
            return await readTextFile(fileRealPath);
        } catch (error) {
            throw invalidInput(error instanceof Error ? error.message : 'Cannot read project file');
        }
    }

    // Parse supplied JSON and validate testcase structure and parameter names.
    // This does not verify value types or the correctness of expected answers.
    private parseHiddenTestcases(content: string, metadata: ProblemMetadata): Testcase[] {
        if (Buffer.byteLength(content, 'utf-8') > MAX_DATA_BYTES) {
            throw invalidInput('Hidden testcase content cannot exceed 64 MB');
        }
        try {
            return validateTestcases(JSON.parse(content), metadata, false);
        } catch (error) {
            throw invalidInput(error instanceof SyntaxError ? 'Hidden testcase content must be valid JSON'
                : error instanceof Error ? error.message : 'Invalid hidden testcases');
        }
    }

    // List valid problem directories with non-empty visible tests, sorted by display title.
    async getAllProblems(): Promise<ProblemMetadata[]> {
        await this.assertProblemDirectory(this.problemsDir);
        const entries = await fs.readdir(this.problemsDir, { withFileTypes: true });
        const problems = (await mapInBatches(
            entries.filter((entry) => entry.isDirectory() && isProblemId(entry.name)),
            async (entry): Promise<ProblemMetadata | null> => {
                try {
                    const problemDir = this.getProblemDir(entry.name);
                    const metadata = await this.readProblemMetadata(problemDir);
                    // Exclude problems without valid visible tests so listed problems can be run.
                    validateTestcases(await this.readVisibleTestcases(problemDir), metadata, false);
                    return metadata;
                } catch {
                    // Skip a problem if its metadata, visible tests, or required storage paths are invalid.
                    console.warn(`Skipping invalid problem directory: ${entry.name}`);
                    return null;
                }
            }))
            .filter((problem): problem is ProblemMetadata => problem !== null);

        // Sort by the full display title, not by the numeric problem ID.
        problems.sort((a, b) => a.title.localeCompare(b.title));

        return problems;
    }

    // Load display data and visible tests; hidden tests are omitted.
    async getProblem(problemId: string): Promise<Problem> {
        const problemDir = this.getProblemDir(problemId);

        const metadata = await this.readProblemMetadata(problemDir);

        // A missing template yields an empty editor buffer; other read failures are still errors.
        const templateEntries = await Promise.all(metadata.supportedLanguages.map(async (lang) => {
            const ext = lang === 'java' ? 'java' : 'py';
            const templatePath = path.join(problemDir, `template.${ext}`);
            try {
                return [lang, await readTextFile(templatePath)] as const;
            } catch (error) {
                if (!hasErrorCode(error, 'ENOENT')) throw error;
                return [lang, ''] as const;
            }
        }));
        const templates = Object.fromEntries(templateEntries);

        // The detail page does not need hidden tests, so avoid exposing them or reading their large files.
        const [visibleTestcases, editorial] = await Promise.all([
            this.readVisibleTestcases(problemDir),
            readTextFile(path.join(problemDir, 'editorial.md')).catch((error) => {
                if (hasErrorCode(error, 'ENOENT')) return undefined;
                throw error;
            }),
        ]);

        return {
            metadata,
            templates: templates as Record<'java' | 'python3', string>,
            visibleTestcases: validateTestcases(visibleTestcases, metadata, false),
            editorial,
        };
    }

    // Load metadata and both testcase sets for Submit, without templates or the editorial.
    async getProblemForExecution(problemId: string): Promise<Pick<Problem, 'metadata' | 'visibleTestcases' | 'hiddenTestcases'>> {
        const problemDir = this.getProblemDir(problemId);
        const [metadata, visibleTestcases, hiddenTestcases] = await Promise.all([
            this.readProblemMetadata(problemDir),
            this.readVisibleTestcases(problemDir),
            this.readHiddenTestcases(problemDir),
        ]);

        return {
            metadata,
            visibleTestcases: validateTestcases(visibleTestcases, metadata, false),
            hiddenTestcases: validateTestcases(hiddenTestcases, metadata),
        };
    }

    // Custom Run supplies its own input, so only metadata is needed.
    async getProblemMetadata(problemId: string): Promise<ProblemMetadata> {
        return this.readProblemMetadata(this.getProblemDir(problemId));
    }

    // Load metadata and visible tests for Run without reading hidden testcase files.
    async getProblemForRun(problemId: string): Promise<Pick<Problem, 'metadata' | 'visibleTestcases'>> {
        const problemDir = this.getProblemDir(problemId);
        const [metadata, visibleTestcases] = await Promise.all([
            this.readProblemMetadata(problemDir),
            this.readVisibleTestcases(problemDir),
        ]);

        return { metadata, visibleTestcases: validateTestcases(visibleTestcases, metadata, false) };
    }

    // Read visible tests without loading metadata or validating parameter names against it.
    async getVisibleTestcases(problemId: string): Promise<Testcase[]> {
        return this.readVisibleTestcases(this.getProblemDir(problemId));
    }

    // Read hidden tests without loading metadata or validating parameter names against it.
    async getHiddenTestcases(problemId: string): Promise<Testcase[]> {
        return this.readHiddenTestcases(this.getProblemDir(problemId));
    }

    // Append or replace locally supplied hidden testcases after structural validation.
    async importHiddenTestcases(
        problemId: string,
        request: HiddenTestcaseImportRequest
    ): Promise<HiddenTestcaseImportResponse> {
        if (!isRecord(request)) {
            throw invalidInput('Hidden testcase import request is required');
        }
        if (request.mode !== 'append' && request.mode !== 'replace') {
            throw invalidInput('Mode must be append or replace');
        }
        if (request.sourceType !== 'content' && request.sourceType !== 'projectPath') {
            throw invalidInput('Source type must be content or projectPath');
        }

        const problemDir = this.getProblemDir(problemId);
        return withStorageLock(problemDir, async () => {
            const metadata = await this.readProblemMetadata(problemDir);
            // Content comes from pasted or uploaded text; project paths are read only after containment checks.
            const content = request.sourceType === 'content'
                ? request.content
                : request.projectPath
                    ? await this.readProjectRelativeFile(request.projectPath)
                    : undefined;

            if (typeof content !== 'string') {
                throw invalidInput(request.sourceType === 'content' ? 'Content is required' : 'Project path is required');
            }

            const incomingTestcases = this.parseHiddenTestcases(content, metadata);
            // Validate incoming data before writing. Append also validates the existing file;
            // replace skips that read so it can replace a corrupt hidden-test file.
            const existingTestcases = request.mode === 'append'
                ? validateTestcases(await this.readHiddenTestcases(problemDir), metadata)
                : [];
            const nextTestcases = [...existingTestcases, ...incomingTestcases];

            await writeJsonAtomic(path.join(problemDir, 'testcases_hidden.json'), nextTestcases);

            return {
                success: true,
                added: incomingTestcases.length,
                totalHidden: nextTestcases.length,
                mode: request.mode,
            };
        });
    }

    // Combine visible and hidden tests without loading metadata.
    // Parameter-name validation requires a metadata-aware loading method.
    async getAllTestcases(problemId: string): Promise<Testcase[]> {
        const problemDir = this.getProblemDir(problemId);
        const [visibleTestcases, hiddenTestcases] = await Promise.all([
            this.readVisibleTestcases(problemDir),
            this.readHiddenTestcases(problemDir),
        ]);
        return [...visibleTestcases, ...hiddenTestcases];
    }

    // Create a new problem directory; reject an existing ID without overwriting its files.
    async saveProblem(problemId: string, data: {
        metadata: ProblemMetadata;
        templates: Record<string, string>;
        visibleTestcases: Testcase[];
    }): Promise<void> {
        const problemDir = this.getProblemDir(problemId);
        try {
            validateMetadata(data.metadata, problemId);
            validateTestcases(data.visibleTestcases, data.metadata, false);
            if (!isRecord(data.templates) || !data.metadata.supportedLanguages.every((language) =>
                typeof data.templates[language] === 'string' && Buffer.byteLength(data.templates[language], 'utf-8') <= MAX_DATA_BYTES)) {
                throw new Error('Each supported language requires a template no larger than 64 MB');
            }
        } catch (error) {
            throw invalidInput(error instanceof Error ? error.message : 'Invalid problem data');
        }
        await withStorageLock(problemDir, async () => {
            await fs.mkdir(this.problemsDir, { recursive: true });
            await this.assertProblemDirectory(this.problemsDir);
            try {
                await fs.lstat(problemDir);
                // Import creates new problems only, preserving templates, progress, and hidden tests on duplicates.
                throw Object.assign(new Error(`Problem "${problemId}" already exists`), { code: 'EEXIST' });
            } catch (error) {
                if (!hasErrorCode(error, 'ENOENT')) throw error;
            }
            const staging = await fs.mkdtemp(path.join(this.problemsDir, '.import-'));
            try {
                await writeJsonAtomic(path.join(staging, 'problem.json'), data.metadata);
                await writeJsonAtomic(path.join(staging, 'testcases_visible.json'), data.visibleTestcases);
                await writeJsonAtomic(path.join(staging, 'testcases_hidden.json'), []);
                for (const language of data.metadata.supportedLanguages) {
                    await fs.writeFile(path.join(staging, language === 'java' ? 'template.java' : 'template.py'), data.templates[language], 'utf-8');
                }
                // Publish the directory only after all files are written so readers never see a partial import.
                await fs.rename(staging, problemDir);
            } finally {
                await fs.rm(staging, { recursive: true, force: true });
            }
        });
    }

    // Return null for missing progress; report corrupt files so autosave cannot overwrite recoverable data.
    async getProgress(problemId: string): Promise<ProblemProgress | null> {
        const problemDir = this.getProblemDir(problemId);
        await this.assertProblemDirectory(problemDir);
        const progressPath = path.join(problemDir, 'progress.json');
        try {
            const value = await this.readJsonFile<unknown>(progressPath);
            // Empty bundled progress uses blank language and timestamp fields to mean no saved attempt.
            if (isRecord(value) && value.status === 'none' && isRecord(value.code) && Object.keys(value.code).length === 0 &&
                value.selectedLanguage === '' && value.lastUpdated === '' &&
                (value.solveRecords === undefined || (Array.isArray(value.solveRecords) && value.solveRecords.length === 0))) return null;
            try {
                validateProgress(value);
                if (!isRecord(value) || typeof value.lastUpdated !== 'string' || !Number.isFinite(Date.parse(value.lastUpdated))) {
                    throw new Error('Invalid progress timestamp');
                }
            } catch {
                throw new Error(`Invalid saved progress for problem: ${problemId}`);
            }
            return value as unknown as ProblemProgress;
        } catch (error) {
            if (hasErrorCode(error, 'ENOENT')) return null;
            throw error;
        }
    }

    async saveProgress(problemId: string, progress: ProblemProgress): Promise<void> {
        const problemDir = this.getProblemDir(problemId);
        await withStorageLock(problemDir, async () => {
            await this.assertProblemDirectory(problemDir);
            // Refuse to overwrite corrupt progress because it may contain recoverable solve history.
            await this.getProgress(problemId);
            await writeJsonAtomic(path.join(problemDir, 'progress.json'), progress);
        });
    }

    // Collect existing progress and propagate read or validation errors instead of hiding damaged history.
    async getAllProgress(): Promise<Record<string, ProblemProgress>> {
        await this.assertProblemDirectory(this.problemsDir);
        const entries = await fs.readdir(this.problemsDir, { withFileTypes: true });
        const result: Record<string, ProblemProgress> = Object.create(null);

        const progressReads = await mapInBatches(
            entries.filter((entry) => entry.isDirectory() && isProblemId(entry.name)),
            async (entry): Promise<[string, ProblemProgress] | null> => {
                const progress = await this.getProgress(entry.name);
                if (progress) {
                    return [entry.name, progress];
                }
                return null;
            });

        for (const progressEntry of progressReads) {
            if (progressEntry) {
                const [problemId, progress] = progressEntry;
                result[problemId] = progress;
            }
        }

        return result;
    }

    // Delete the entire problem directory; callers must enforce the protected-problem policy first.
    async deleteProblem(problemId: string): Promise<void> {
        const problemDir = this.getProblemDir(problemId);
        await withStorageLock(problemDir, async () => {
            await this.assertProblemDirectory(problemDir);
            await fs.rm(problemDir, { recursive: true });
        });
    }
}
