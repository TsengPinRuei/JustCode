// These API types are maintained manually; keep them in sync with backend/src/types.ts.
export type Language = 'java' | 'python3';

export interface ParamInfo {
    name: string;
    // Metadata type label interpreted by the backend runner.
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
    // Structured source locations for Monaco diagnostics.
    compilationErrors?: CompilationError[];
    // Visible testcase stdout grouped under [Testcase n] headers and capped by the backend.
    // Hidden debug output is omitted.
    debugOutput?: string;
}

export type HiddenTestcaseImportMode = 'append' | 'replace';
// Use pasted or uploaded JSON text, or a project-relative path validated by the backend.
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

export type ProblemStatus = 'none' | 'attempted' | 'solved';

// Timing and result summary of an accepted submission; source code is not stored in the record.
export interface SolveRecord {
    id: string;
    // Browser timestamp when the accepted response was received, in ISO format.
    solvedAt: string;
    // Wall-clock attempt time, including idle time and the accepted submission request.
    durationMs: number;
    // Browser request duration, including compilation, tests, and HTTP overhead.
    // Optional for compatibility with older progress files.
    submitDurationMs?: number;
    language: Language;
    passedTestcases: number;
    totalTestcases: number;
}

export interface ProblemProgress {
    status: ProblemStatus;
    // Keep a draft for each language so switching languages preserves the other draft.
    code: Record<string, string>;
    selectedLanguage: Language;
    solveRecords?: SolveRecord[];
    // ISO timestamp assigned by the backend when validating a save request.
    lastUpdated: string;
}
