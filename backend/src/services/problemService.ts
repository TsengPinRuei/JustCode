/**
 * Problem Service：以檔案為基礎管理題目資料與使用者進度的 CRUD。
 * 從 problems/ 目錄讀寫 problem.json、templates、測試案例、editorial 與 progress.json。
 */
import { promises as fs } from 'fs';
import * as path from 'path';
import {
    HiddenTestcaseImportRequest,
    HiddenTestcaseImportResponse,
    Problem,
    ProblemMetadata,
    ProblemProgress,
    Testcase,
} from '../types';

// 後端指令從 backend/ 執行，因此 ../problems 會解析到共用題目儲存區。
const PROJECT_ROOT = path.resolve(process.cwd(), '..');
const PROBLEMS_DIR = path.join(PROJECT_ROOT, 'problems');
// 快取真實專案根路徑，因為 hidden 測試案例匯入可能在同一 process 中驗證多個路徑。
let projectRootRealPathPromise: Promise<string> | null = null;

// JSON payload 的形狀不受 TypeScript 保證，因此需要 runtime guard。
const isRecord = (value: unknown): value is Record<string, unknown> => {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
};

const getProjectRootRealPath = (): Promise<string> => {
    projectRootRealPathPromise ??= fs.realpath(PROJECT_ROOT);
    return projectRootRealPathPromise;
};

export class ProblemService {
    /** 拒絕 path separator，避免 problem ID 逃出 problems/ 目錄。 */
    private validateProblemId(problemId: string): void {
        if (!problemId || /[\/\\]/.test(problemId) || problemId === '.' || problemId === '..') {
            throw new Error(`Invalid problem ID: ${problemId}`);
        }
    }

    /** 驗證使用者提供的 ID 後，建立標準目錄路徑。 */
    private getProblemDir(problemId: string): string {
        this.validateProblemId(problemId);
        return path.join(PROBLEMS_DIR, problemId);
    }

    /** 讀取並解析組成題目 metadata、測試案例與 progress 的 JSON 檔案。 */
    private async readJsonFile<T>(filePath: string): Promise<T> {
        const content = await fs.readFile(filePath, 'utf-8');
        return JSON.parse(content) as T;
    }

    /** problem.json 是 list/detail/execution 路徑使用的標準 metadata 檔案。 */
    private async readProblemMetadata(problemDir: string): Promise<ProblemMetadata> {
        return this.readJsonFile<ProblemMetadata>(path.join(problemDir, 'problem.json'));
    }

    /** Visible 測試案例是必要資料，因為 Run 模式與題目列表驗證都依賴它們。 */
    private async readVisibleTestcases(problemDir: string): Promise<Testcase[]> {
        return this.readJsonFile<Testcase[]>(path.join(problemDir, 'testcases_visible.json'));
    }

    /** 隱藏測試案例是 optional，讓匯入題目可在維護者加入 private cases 前先執行。 */
    private async readHiddenTestcases(problemDir: string): Promise<Testcase[]> {
        try {
            return await this.readJsonFile<Testcase[]>(path.join(problemDir, 'testcases_hidden.json'));
        } catch {
            // 缺少或無法讀取隱藏測試時，不應阻擋 Run 模式或題目詳細資料。
            return [];
        }
    }

    /** 讀取使用者提供的 project-relative 檔案，同時防止透過 ../ 或 symlink 逃逸。 */
    private async readProjectRelativeFile(projectPath: string): Promise<string> {
        const rawPath = projectPath.trim();
        if (!rawPath) {
            throw new Error('Project path is required');
        }
        if (path.isAbsolute(rawPath)) {
            throw new Error('Project path must be relative to the JustCode project');
        }

        const resolvedPath = path.resolve(PROJECT_ROOT, rawPath);
        const projectRootRealPath = await getProjectRootRealPath();
        let fileRealPath: string;
        try {
            // 比對真實路徑，避免 symlink 將 project-relative path 指向專案外。
            fileRealPath = await fs.realpath(resolvedPath);
        } catch {
            throw new Error('Project path must point to an existing file');
        }
        if (fileRealPath !== projectRootRealPath && !fileRealPath.startsWith(projectRootRealPath + path.sep)) {
            throw new Error('Project path must stay inside the JustCode project');
        }

        const stat = await fs.stat(fileRealPath);
        if (!stat.isFile()) {
            throw new Error('Project path must point to a file');
        }

        return fs.readFile(fileRealPath, 'utf-8');
    }

    /** 驗證 AI 產生的隱藏測試案例 JSON，避免無效資料影響 submit judging。 */
    private parseHiddenTestcases(content: string, metadata: ProblemMetadata): Testcase[] {
        if (!content.trim()) {
            throw new Error('Hidden testcase content cannot be empty');
        }

        let parsed: unknown;
        try {
            parsed = JSON.parse(content);
        } catch {
            throw new Error('Hidden testcase content must be valid JSON');
        }

        if (!Array.isArray(parsed)) {
            throw new Error('Hidden testcase content must be a JSON array');
        }
        if (parsed.length === 0) {
            throw new Error('Hidden testcase array cannot be empty');
        }

        const expectedParamNames = metadata.params?.map((param) => param.name) ?? [];
        const expectedParamNameSet = new Set(expectedParamNames);

        return parsed.map((item, index): Testcase => {
            const label = `Testcase ${index + 1}`;
            if (!isRecord(item)) {
                throw new Error(`${label} must be an object`);
            }
            if (!isRecord(item.input)) {
                throw new Error(`${label} input must be an object`);
            }
            if (!Object.prototype.hasOwnProperty.call(item, 'output')) {
                throw new Error(`${label} must include an output field`);
            }

            if (expectedParamNames.length > 0) {
                // Runner 產生流程會依 metadata param name 取 input，因此隱藏案例必須完全吻合。
                const actualParamNames = Object.keys(item.input);
                const matchesParams =
                    actualParamNames.length === expectedParamNames.length &&
                    actualParamNames.every((name) => expectedParamNameSet.has(name));
                if (!matchesParams) {
                    throw new Error(`${label} input keys must exactly match params: ${expectedParamNames.join(', ')}`);
                }
            }

            return {
                input: item.input,
                output: item.output,
            };
        });
    }

    /** 掃描 problems/ 目錄，回傳所有有效題目的 metadata，並依 title 排序。 */
    async getAllProblems(): Promise<ProblemMetadata[]> {
        // 將每個第一層子目錄視為候選題目。
        const entries = await fs.readdir(PROBLEMS_DIR, { withFileTypes: true });
        const problemReads = entries
            .filter((entry) => entry.isDirectory())
            .map(async (entry): Promise<ProblemMetadata | null> => {
                try {
                    const problemDir = this.getProblemDir(entry.name);
                    const metadata = await this.readProblemMetadata(problemDir);
                    // 保留既有列表行為：沒有有效可見測試的目錄會被略過。
                    await this.readVisibleTestcases(problemDir);
                    return metadata;
                } catch (error) {
                    // 略過沒有有效 problem.json 的目錄。
                    console.warn(`Skipping invalid problem directory: ${entry.name}`);
                    return null;
                }
            });

        const problems = (await Promise.all(problemReads))
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
                return [lang, await fs.readFile(templatePath, 'utf-8')] as const;
            } catch (error) {
                console.error(`Template not found for ${lang}:`, error);
                // 若 template 不存在，使用空字串。
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

    /** 只載入 Run/Submit 執行路徑需要的檔案。 */
    async getProblemForExecution(problemId: string): Promise<Pick<Problem, 'metadata' | 'visibleTestcases' | 'hiddenTestcases'>> {
        const problemDir = this.getProblemDir(problemId);
        const [metadata, visibleTestcases, hiddenTestcases] = await Promise.all([
            this.readProblemMetadata(problemDir),
            this.readVisibleTestcases(problemDir),
            this.readHiddenTestcases(problemDir),
        ]);

        return { metadata, visibleTestcases, hiddenTestcases };
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

        return { metadata, visibleTestcases };
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
            throw new Error('Hidden testcase import request is required');
        }
        if (request.mode !== 'append' && request.mode !== 'replace') {
            throw new Error('Mode must be append or replace');
        }
        if (request.sourceType !== 'content' && request.sourceType !== 'projectPath') {
            throw new Error('Source type must be content or projectPath');
        }

        const problemDir = this.getProblemDir(problemId);
        const metadata = await this.readProblemMetadata(problemDir);
        // Content 來源來自貼上/上傳；projectPath 會通過 containment 檢查後在伺服器端讀取。
        const content = request.sourceType === 'content'
            ? request.content
            : request.projectPath
                ? await this.readProjectRelativeFile(request.projectPath)
                : undefined;

        if (typeof content !== 'string') {
            throw new Error(request.sourceType === 'content' ? 'Content is required' : 'Project path is required');
        }

        const incomingTestcases = this.parseHiddenTestcases(content, metadata);
        // 只有傳入資料有效後才讀取既有 cases，讓錯誤匯入不會改動 testcases_hidden.json。
        const existingTestcases = request.mode === 'append'
            ? await this.readHiddenTestcases(problemDir)
            : [];
        const nextTestcases = [...existingTestcases, ...incomingTestcases];

        await fs.writeFile(
            path.join(problemDir, 'testcases_hidden.json'),
            JSON.stringify(nextTestcases, null, 4),
            'utf-8'
        );

        return {
            success: true,
            added: incomingTestcases.length,
            totalHidden: nextTestcases.length,
            mode: request.mode,
        };
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
        await fs.mkdir(problemDir, { recursive: true });

        const writes: Array<Promise<void>> = [
            // 以 getProblem() 會讀取的相同檔案布局保存匯入題目。
            fs.writeFile(
                path.join(problemDir, 'problem.json'),
                JSON.stringify(data.metadata, null, 4),
                'utf-8'
            ),
            // 寫入可見測試案例。
            fs.writeFile(
                path.join(problemDir, 'testcases_visible.json'),
                JSON.stringify(data.visibleTestcases, null, 4),
                'utf-8'
            ),
            // 匯入的 LeetCode 題目只提供範例案例；保留 placeholder 供未來手動隱藏測試使用。
            fs.writeFile(
                path.join(problemDir, 'testcases_hidden.json'),
                JSON.stringify([], null, 4),
                'utf-8'
            ),
        ];

        // Template 檔名由語言 key 推導，讓匯入片段符合 getProblem() 查找規則。
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

    /** 從 progress.json 讀取使用者進度；缺少或無法讀取時回傳 null。 */
    async getProgress(problemId: string): Promise<ProblemProgress | null> {
        const progressPath = path.join(this.getProblemDir(problemId), 'progress.json');
        try {
            return await this.readJsonFile<ProblemProgress>(progressPath);
        } catch {
            return null;
        }
    }

    /** 將使用者進度寫入 progress.json。 */
    async saveProgress(problemId: string, progress: ProblemProgress): Promise<void> {
        const progressPath = path.join(this.getProblemDir(problemId), 'progress.json');
        await fs.writeFile(progressPath, JSON.stringify(progress, null, 4), 'utf-8');
    }

    /** 從所有題目目錄收集進度。 */
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

    /** 永久刪除題目目錄；呼叫端必須先強制套用受保護題目規則。 */
    async deleteProblem(problemId: string): Promise<void> {
        const problemDir = this.getProblemDir(problemId);
        await fs.rm(problemDir, { recursive: true, force: true });
    }
}
