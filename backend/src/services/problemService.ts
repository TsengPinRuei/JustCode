/**
 * Problem Service：以檔案為基礎管理題目資料與使用者進度的 CRUD。
 * 從 problems/ 目錄讀寫 problem.json、templates、測試案例、editorial 與 progress.json。
 */
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

export class ProblemService {
    private readonly projectRoot: string;
    private readonly problemsDir: string;

    constructor(projectRoot = path.resolve(__dirname, '../../..')) {
        // src/services 與 dist/services 都相對於同一專案根目錄，不依賴啟動時的 cwd。
        this.projectRoot = path.resolve(projectRoot);
        this.problemsDir = path.join(this.projectRoot, 'problems');
    }

    /** Canonical 小寫 ID 避免路徑逃逸與不區分大小寫檔案系統上的別名競態。 */
    private validateProblemId(problemId: string): void {
        if (!isProblemId(problemId)) {
            throw invalidInput('Invalid problem ID');
        }
    }

    /** 驗證使用者提供的 ID 後，建立標準目錄路徑。 */
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

    /** 讀取並解析組成題目 metadata、測試案例與 progress 的 JSON 檔案。 */
    private async readJsonFile<T>(filePath: string): Promise<T> {
        await this.assertProblemDirectory(path.dirname(filePath));
        const content = await readTextFile(filePath);
        return JSON.parse(content) as T;
    }

    /** problem.json 是 list/detail/execution 路徑使用的標準 metadata 檔案。 */
    private async readProblemMetadata(problemDir: string): Promise<ProblemMetadata> {
        return validateMetadata(await this.readJsonFile(path.join(problemDir, 'problem.json')), path.basename(problemDir));
    }

    /** Visible 測試案例是必要資料，因為 Run 模式與題目列表驗證都依賴它們。 */
    private async readVisibleTestcases(problemDir: string): Promise<Testcase[]> {
        return validateTestcases(await this.readJsonFile(path.join(problemDir, 'testcases_visible.json')), undefined, false);
    }

    /** 隱藏測試案例是 optional，讓匯入題目可在維護者加入 private cases 前先執行。 */
    private async readHiddenTestcases(problemDir: string): Promise<Testcase[]> {
        try {
            return validateTestcases(await this.readJsonFile(path.join(problemDir, 'testcases_hidden.json')));
        } catch (error) {
            // 只有不存在才代表沒有 hidden cases；損毀不得悄悄縮減 Submit 的測試集。
            if (hasErrorCode(error, 'ENOENT')) return [];
            throw error;
        }
    }

    /** 讀取使用者提供的 project-relative 檔案，同時防止透過 ../ 或 symlink 逃逸。 */
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
            // 比對真實路徑，避免 symlink 將 project-relative path 指向專案外。
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

    /** 驗證 AI 產生的隱藏測試案例 JSON，避免無效資料影響 submit judging。 */
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

    /** 掃描 problems/ 目錄，回傳所有有效題目的 metadata，並依 title 排序。 */
    async getAllProblems(): Promise<ProblemMetadata[]> {
        // 將每個第一層子目錄視為候選題目。
        await this.assertProblemDirectory(this.problemsDir);
        const entries = await fs.readdir(this.problemsDir, { withFileTypes: true });
        const problems = (await mapInBatches(
            entries.filter((entry) => entry.isDirectory() && isProblemId(entry.name)),
            async (entry): Promise<ProblemMetadata | null> => {
                try {
                    const problemDir = this.getProblemDir(entry.name);
                    const metadata = await this.readProblemMetadata(problemDir);
                    // 保留既有列表行為：沒有有效可見測試的目錄會被略過。
                    validateTestcases(await this.readVisibleTestcases(problemDir), metadata, false);
                    return metadata;
                } catch {
                    // 略過沒有有效 problem.json 的目錄。
                    console.warn(`Skipping invalid problem directory: ${entry.name}`);
                    return null;
                }
            }))
            .filter((problem): problem is ProblemMetadata => problem !== null);

        // Title 包含 LeetCode 風格前綴，因此 title 排序可讓可見列表保持穩定。
        problems.sort((a, b) => a.title.localeCompare(b.title));

        return problems;
    }

    /** 依 ID 載入完整題目：metadata、templates、測試案例與 editorial。 */
    async getProblem(problemId: string): Promise<Problem> {
        const problemDir = this.getProblemDir(problemId);

        // 讀取題目 metadata。
        const metadata = await this.readProblemMetadata(problemDir);

        // 缺少 template 不應讓整題無法讀取；編輯器可顯示空 buffer。
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

        // 詳細頁不使用 hidden cases，避免讀取私有資料與不必要的 I/O。
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

    /** 只載入 Run/Submit 執行路徑需要的檔案。 */
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

    /** Custom Run 模式不使用測試案例檔案，因此只載入 metadata。 */
    async getProblemMetadata(problemId: string): Promise<ProblemMetadata> {
        return this.readProblemMetadata(this.getProblemDir(problemId));
    }

    /** Run 模式只載入 metadata 與可見案例，不讀取隱藏測試案例檔案。 */
    async getProblemForRun(problemId: string): Promise<Pick<Problem, 'metadata' | 'visibleTestcases'>> {
        const problemDir = this.getProblemDir(problemId);
        const [metadata, visibleTestcases] = await Promise.all([
            this.readProblemMetadata(problemDir),
            this.readVisibleTestcases(problemDir),
        ]);

        return { metadata, visibleTestcases: validateTestcases(visibleTestcases, metadata, false) };
    }

    /** 只取得可見測試案例（Run 模式使用），為了效率直接讀檔。 */
    async getVisibleTestcases(problemId: string): Promise<Testcase[]> {
        return this.readVisibleTestcases(this.getProblemDir(problemId));
    }

    /** 只取得隱藏測試案例（Submit 模式使用）。 */
    async getHiddenTestcases(problemId: string): Promise<Testcase[]> {
        return this.readHiddenTestcases(this.getProblemDir(problemId));
    }

    /** 將 AI 產生的隱藏測試案例匯入 testcases_hidden.json。 */
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
            // Content 來源來自貼上/上傳；projectPath 會通過 containment 檢查後在伺服器端讀取。
            const content = request.sourceType === 'content'
                ? request.content
                : request.projectPath
                    ? await this.readProjectRelativeFile(request.projectPath)
                    : undefined;

            if (typeof content !== 'string') {
                throw invalidInput(request.sourceType === 'content' ? 'Content is required' : 'Project path is required');
            }

            const incomingTestcases = this.parseHiddenTestcases(content, metadata);
            // 只有傳入資料有效後才讀取既有 cases，讓錯誤匯入不會改動 testcases_hidden.json。
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

    /** 取得所有測試案例：可見 + 隱藏（Submit 模式使用），為了效率直接讀檔。 */
    async getAllTestcases(problemId: string): Promise<Testcase[]> {
        const problemDir = this.getProblemDir(problemId);
        const [visibleTestcases, hiddenTestcases] = await Promise.all([
            this.readVisibleTestcases(problemDir),
            this.readHiddenTestcases(problemDir),
        ]);
        return [...visibleTestcases, ...hiddenTestcases];
    }

    /** 儲存新題目：metadata、templates 與可見測試案例。 */
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
                // 匯入只建立新題目，避免重複匯入清空使用者的 hidden cases 或模板。
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
                // 完整寫入後才發佈目錄，避免列表或執行讀到半成品。
                await fs.rename(staging, problemDir);
            } finally {
                await fs.rm(staging, { recursive: true, force: true });
            }
        });
    }

    /** 缺少進度時回傳 null；損毀檔案必須回報，避免被當成新進度覆寫。 */
    async getProgress(problemId: string): Promise<ProblemProgress | null> {
        const problemDir = this.getProblemDir(problemId);
        await this.assertProblemDirectory(problemDir);
        const progressPath = path.join(problemDir, 'progress.json');
        try {
            const value = await this.readJsonFile<unknown>(progressPath);
            // 舊版隨附題目以空語言、空日期代表「尚未開始」，沒有使用者資料需要復原。
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

    /** 將使用者進度寫入 progress.json。 */
    async saveProgress(problemId: string, progress: ProblemProgress): Promise<void> {
        const problemDir = this.getProblemDir(problemId);
        await withStorageLock(problemDir, async () => {
            await this.assertProblemDirectory(problemDir);
            // 損毀進度可能含有可恢復的解題紀錄；不得被下一次自動儲存悄悄覆蓋。
            await this.getProgress(problemId);
            await writeJsonAtomic(path.join(problemDir, 'progress.json'), progress);
        });
    }

    /** 從所有題目目錄收集進度。 */
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

    /** 永久刪除題目目錄；呼叫端必須先強制套用受保護題目規則。 */
    async deleteProblem(problemId: string): Promise<void> {
        const problemDir = this.getProblemDir(problemId);
        await withStorageLock(problemDir, async () => {
            await this.assertProblemDirectory(problemDir);
            await fs.rm(problemDir, { recursive: true });
        });
    }
}
