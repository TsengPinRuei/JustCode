export type Language = 'java' | 'python3';

export interface ParamInfo {
    name: string;
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
    // New fields for dynamic runner generation
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
    file: string;          // Error file name (e.g., "Solution.java" or "solution.py")
    line: number;          // Error line number (1-based)
    column: number;        // Error column number (1-based)
    message: string;       // Error message
    severity: 'error' | 'warning';  // Severity level
}

export interface ExecutionResult {
    status: 'AC' | 'WA' | 'CE' | 'RE' | 'TLE';
    message?: string;
    testcaseResults?: TestcaseResult[];
    totalTestcases?: number;
    passedTestcases?: number;
    compilationErrors?: CompilationError[];  // Compilation errors with location info
    debugOutput?: string;  // User's debug output (print statements)
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
