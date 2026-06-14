/**
 * 後端共用型別定義。
 * 定義題目、測試案例、執行結果與使用者進度的資料結構。
 */
export type Language = 'java' | 'python3';

export interface ParamInfo {
    name: string;
    // runner 產生流程使用的內部型別標籤；需與 executor type mapper 保持同步。
    type: string; // 例如 'int[]'、'int'、'string'、'int[][]'、'string[]'、'ListNode' 等。
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
    hiddenTestcases?: Testcase[];
    editorial?: string;
}

export interface CompilationError {
    file: string;          // 編輯器顯示的檔名，例如 "Solution.java" 或 "solution.py"。
    line: number;          // 編譯器/執行期診斷提供的 1-based 行號。
    column: number;        // 1-based 欄位；語言未提供時預設為 1。
    message: string;       // 顯示在 UI 上的人類可讀診斷訊息。
    severity: 'error' | 'warning';
}

export interface ExecutionResult {
    status: 'AC' | 'WA' | 'CE' | 'RE' | 'TLE';
    message?: string;
    testcaseResults: TestcaseResult[];
    totalTestcases?: number;
    passedTestcases?: number;
    compilationErrors?: CompilationError[];  // Monaco marker 使用的結構化位置。
    debugOutput?: string;  // RESULT_SEPARATOR 前擷取到的 stdout。
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

export interface RunRequest {
    problemId: string;
    code: string;
    language: Language;
    inputMode: 'visible' | 'custom';
    customInput?: string;
}

export interface SubmitRequest {
    problemId: string;
    code: string;
    language: Language;
}

export type HiddenTestcaseImportMode = 'append' | 'replace';
// content 是貼上/上傳的 JSON 文字；projectPath 由後端在專案根目錄內解析。
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

/** 題目完成狀態：none（未開始）、attempted（已儲存程式碼）、solved（AC） */
export type ProblemStatus = 'none' | 'attempted' | 'solved';

// 保存到 progress.json 的一筆 accepted 提交快照，供前端統計/歷史紀錄使用。
export interface SolveRecord {
    id: string;
    solvedAt: string;        // client 記錄 AC 當下的 ISO timestamp。
    durationMs: number;      // 本次嘗試視窗中，AC 前花費的時間。
    submitDurationMs?: number; // 舊版 progress 檔案未保存 submit timing，因此保持 optional。
    language: Language;
    passedTestcases: number;
    totalTestcases: number;
}

/** 單一題目的持久化使用者進度，儲存在 progress.json。 */
export interface ProblemProgress {
    status: ProblemStatus;
    code: Record<string, string>;       // 已儲存程式碼以語言為 key，讓切換分頁不會破壞另一份 buffer。
    selectedLanguage: Language;
    solveRecords?: SolveRecord[];
    lastUpdated: string;                 // 儲存時由 API 指定的 ISO timestamp。
}
