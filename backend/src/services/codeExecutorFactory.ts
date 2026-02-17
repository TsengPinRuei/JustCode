import { JavaExecutor } from './javaExecutor';
import { PythonExecutor } from './pythonExecutor';
import { Language, ProblemMetadata, Testcase, TestcaseResult, CompilationError } from '../types';

export interface CodeExecutor {
    executeCode(
        userCode: string,
        testcases: Testcase[],
        showHiddenInputs: boolean,
        metadata?: ProblemMetadata
    ): Promise<{
        status: 'AC' | 'WA' | 'CE' | 'RE' | 'TLE';
        message?: string;
        testcaseResults: TestcaseResult[];
        totalTestcases: number;
        passedTestcases: number;
        compilationErrors?: CompilationError[];
        debugOutput?: string;
    }>;
}

export class CodeExecutorFactory {
    static getExecutor(language: Language): CodeExecutor {
        switch (language) {
            case 'java':
                return new JavaExecutor();
            case 'python3':
                return new PythonExecutor();
            default:
                throw new Error(`Unsupported language: ${language}`);
        }
    }
}
