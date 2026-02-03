
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
    functionSignature: string;
}

export interface Testcase {
    input: {
        nums: number[];
    };
    output: number[];
}

export interface Problem {
    metadata: ProblemMetadata;
    template: string;
    visibleTestcases: Testcase[];
    hiddenTestcases?: Testcase[];
    editorial?: string;
}

export interface ExecutionResult {
    status: 'AC' | 'WA' | 'CE' | 'RE' | 'TLE';
    message?: string;
    testcaseResults?: TestcaseResult[];
    totalTestcases?: number;
    passedTestcases?: number;
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
    inputMode: 'visible' | 'custom';
    customInput?: string;
}

export interface SubmitRequest {
    problemId: string;
    code: string;
}
