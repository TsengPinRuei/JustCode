/**
 * 前端型別定義。
 * 對應題目、測資、執行結果與使用者進度的後端型別。
 * 因為 API response 沒有自動產生型別，需與 backend/src/types.ts 保持同步。
 */
export type Language = 'java' | 'python3';

export interface ParamInfo {
    name: string;
    // 後端 runner 產生流程使用的內部型別標籤。
    type: string;
}

export interface ProblemMetadata {
    id: string;
    title: string;
    difficulty: 'Easy' | 'Medium' | 'Hard';
    tags: string[];
    description: string;
    examples: Array<{
        input: string;
        output: string;
        explanation?: string;
    }>;
    constraints: string[];
    supportedLanguages: Language[];
    functionSignatures: Record<Language, string>;
    functionName?: string;
    params?: ParamInfo[];
    returnType?: string;
}

export interface Testcase {
    input: Record<string, unknown>;
    output: unknown;
}

export interface Problem {
    metadata: ProblemMetadata;
    templates: Record<Language, string>;
    visibleTestcases: Testcase[];
    editorial?: string;
}

export interface TestcaseResult {
    index: number;
    status: 'Passed' | 'Failed' | 'Error' | 'Timeout';
    input?: unknown;
    expected?: unknown;
    actual?: unknown;
    errorMessage?: string;
    executionTime?: number;
}

export interface CompilationError {
    file: string;
    line: number;
    column: number;
    message: string;
    severity: 'error' | 'warning';
}

export interface ExecutionResult {
    status: 'AC' | 'WA' | 'CE' | 'RE' | 'TLE';
    message?: string;
    testcaseResults: TestcaseResult[];
    totalTestcases: number;
    passedTestcases: number;
    compilationErrors?: CompilationError[]; // Monaco marker 使用的結構化位置。
    debugOutput?: string; // 後端結果分隔符之前擷取到的 stdout。
}

export type HiddenTestcaseImportMode = 'append' | 'replace';
// 對應後端匯入來源：貼上/上傳的 JSON 文字，或經後端驗證的專案路徑。
export type HiddenTestcaseSourceType = 'content' | 'projectPath';

export interface HiddenTestcaseImportRequest {
    sourceType: HiddenTestcaseSourceType;
    content?: string;
    projectPath?: string;
    mode: HiddenTestcaseImportMode;
}

export interface HiddenTestcaseImportResponse {
    success: true;
    added: number;
    totalHidden: number; // append/replace 寫入 testcases_hidden.json 後的總數。
    mode: HiddenTestcaseImportMode;
}

export type ProblemStatus = 'none' | 'attempted' | 'solved';

// 統計面板使用的一筆 accepted 提交快照；progress.json 可包含多筆紀錄。
export interface SolveRecord {
    id: string;
    solvedAt: string; // 瀏覽器記錄 AC 當下的 ISO timestamp。
    durationMs: number; // 本次嘗試視窗中，AC 前花費的時間。
    submitDurationMs?: number; // 為了相容舊 progress 檔案而保持 optional。
    language: Language;
    passedTestcases: number;
    totalTestcases: number;
}

export interface ProblemProgress {
    status: ProblemStatus;
    // 已儲存程式碼以語言為 key，避免切換語言時覆蓋另一個 buffer。
    code: Record<string, string>;
    selectedLanguage: Language;
    solveRecords?: SolveRecord[];
    // 儲存進度時由後端指定。
    lastUpdated: string;
}
