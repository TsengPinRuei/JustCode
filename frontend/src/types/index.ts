/**
 * Frontend type definitions.
 * Mirrors backend types for problems, testcases, execution results, and user progress.
 * Keep this file synchronized with backend/src/types.ts because API responses are not generated.
 */
export type Language = 'java' | 'python3';

export interface ParamInfo {
    name: string;
    // Internal type label consumed by backend runner generation.
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
    compilationErrors?: CompilationError[]; // Structured locations used for Monaco markers.
    debugOutput?: string; // Captured stdout before the backend result separator.
}

export type ProblemStatus = 'none' | 'attempted' | 'solved';

// One accepted submission snapshot used by the stats panel; progress.json may contain many records.
export interface SolveRecord {
    id: string;
    solvedAt: string; // ISO timestamp from the browser at the moment AC is recorded.
    durationMs: number; // Time spent in the current attempt window before AC.
    submitDurationMs?: number; // Optional for backwards compatibility with older progress files.
    language: Language;
    passedTestcases: number;
    totalTestcases: number;
}

export interface ProblemProgress {
    status: ProblemStatus;
    // Saved code is keyed by language so switching languages does not overwrite another buffer.
    code: Record<string, string>;
    selectedLanguage: Language;
    solveRecords?: SolveRecord[];
    // Assigned by the backend when progress is saved.
    lastUpdated: string;
}
