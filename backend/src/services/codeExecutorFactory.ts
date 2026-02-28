/**
 * Code Executor Factory — Returns the appropriate executor based on language.
 * Implements the Factory pattern to abstract away language-specific execution logic.
 */
import { JavaExecutor } from './javaExecutor';
import { PythonExecutor } from './pythonExecutor';
import { Language, Testcase, TestcaseResult, CompilationError, ProblemMetadata } from '../types';

/** Interface for language-specific code executors */
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

/** Factory that returns a JavaExecutor or PythonExecutor based on the language */
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
