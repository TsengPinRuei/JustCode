export type Language = 'java' | 'python3';

export interface ParamInfo {
    name: string;
    // Metadata type label used by the runner's explicit type mapping.
    // Custom structures such as ListNode and TreeNode are not supported by the Java runner.
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
    hiddenTestcases?: Testcase[];
    editorial?: string;
}

export interface CompilationError {
    // Source basename, which may also identify a generated runner file.
    file: string;
    // One-based source line reported by syntax checking or compilation.
    line: number;
    // One-based column; current parsers use 1 when no column is extracted.
    column: number;
    message: string;
    severity: 'error' | 'warning';
}

export interface ExecutionResult {
    status: 'AC' | 'WA' | 'CE' | 'RE' | 'TLE';
    message?: string;
    testcaseResults: TestcaseResult[];
    totalTestcases?: number;
    passedTestcases?: number;
    // Structured source locations for Monaco diagnostics.
    compilationErrors?: CompilationError[];
    // Visible testcase stdout, grouped under [Testcase n] headers and capped in bytes.
    // Hidden stdout is omitted; missing result markers leave the captured stdout as debug text.
    debugOutput?: string;
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
// content carries pasted or uploaded JSON text; projectPath is resolved inside the project.
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
    // Number of hidden testcases after the append or replace operation.
    totalHidden: number;
    mode: HiddenTestcaseImportMode;
}

// none means no attempt; attempted means edited; solved records an accepted Submit.
export type ProblemStatus = 'none' | 'attempted' | 'solved';

// Persisted timing and result summary for one accepted submission; it does not contain source code.
export interface SolveRecord {
    id: string;
    // Browser timestamp when the accepted response was received, in ISO format.
    solvedAt: string;
    // Wall-clock time for this attempt, including idle and submission time.
    durationMs: number;
    // Browser request duration, including compilation, test execution, and request overhead.
    // Optional because older progress files did not record this measurement.
    submitDurationMs?: number;
    language: Language;
    passedTestcases: number;
    totalTestcases: number;
}

// Persisted per-problem state stored in progress.json.
export interface ProblemProgress {
    status: ProblemStatus;
    // Keep separate drafts for each language so switching languages preserves the other draft.
    code: Record<string, string>;
    selectedLanguage: Language;
    solveRecords?: SolveRecord[];
    // ISO timestamp assigned by the API when it validates a save request.
    lastUpdated: string;
}
