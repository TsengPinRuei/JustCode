/**
 * Code Executor Factory — Returns the appropriate executor based on language.
 * Keeps route handlers independent from language-specific runner generation details.
 */
import { JavaExecutor } from './javaExecutor';
import { PythonExecutor } from './pythonExecutor';
import { Language, Testcase, TestcaseResult, CompilationError, ProblemMetadata } from '../types';

/** Shared contract implemented by every language-specific code executor. */
export interface CodeExecutor {
    executeCode(
        userCode: string,
        testcases: Testcase[],
        showHiddenInputs: boolean,
        metadata?: ProblemMetadata,
        visibleTestcaseCount?: number
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

/** Factory that returns an executor for languages declared in ProblemMetadata.supportedLanguages. */
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
