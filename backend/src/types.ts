/**
 * Type definitions shared across the backend.
 * Defines data structures for problems, testcases, execution results, and user progress.
 */
export type Language = 'java' | 'python3';

export interface ParamInfo {
    name: string;
    // Internal type label consumed by runner generation; keep in sync with executor type mappers.
    type: string; // e.g. 'int[]', 'int', 'string', 'int[][]', 'string[]', 'ListNode', etc.
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
    file: string;          // File displayed in the editor, e.g. "Solution.java" or "solution.py".
    line: number;          // 1-based line number from the compiler/runtime diagnostic.
    column: number;        // 1-based column; defaults to 1 when the language omits it.
    message: string;       // Human-readable diagnostic shown in the UI.
    severity: 'error' | 'warning';
}

export interface ExecutionResult {
    status: 'AC' | 'WA' | 'CE' | 'RE' | 'TLE';
    message?: string;
    testcaseResults: TestcaseResult[];
    totalTestcases?: number;
    passedTestcases?: number;
    compilationErrors?: CompilationError[];  // Structured locations used for Monaco markers.
    debugOutput?: string;  // Captured stdout before RESULT_SEPARATOR.
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

/** Problem completion status: none (not started), attempted (code saved), solved (AC) */
export type ProblemStatus = 'none' | 'attempted' | 'solved';

// One accepted submission snapshot persisted in progress.json for frontend statistics/history.
export interface SolveRecord {
    id: string;
    solvedAt: string;        // ISO timestamp from the client when AC is recorded.
    durationMs: number;      // Time spent in the current attempt window before AC.
    submitDurationMs?: number; // Optional because older progress files did not store submit timing.
    language: Language;
    passedTestcases: number;
    totalTestcases: number;
}

/** Persisted user progress for a problem, stored in progress.json */
export interface ProblemProgress {
    status: ProblemStatus;
    code: Record<string, string>;       // Saved code keyed by language so switching tabs is non-destructive.
    selectedLanguage: Language;
    solveRecords?: SolveRecord[];
    lastUpdated: string;                 // ISO timestamp assigned by the API on save.
}
