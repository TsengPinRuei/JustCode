import { JavaExecutor } from './javaExecutor';
import { PythonExecutor } from './pythonExecutor';
import { ExecutionSummary } from './executionUtils';
import { Language, Testcase, ProblemMetadata } from '../types';

export interface CodeExecutor {
    // Testcases must list visible cases first; visibleTestcaseCount marks the boundary.
    // Set showHiddenInputs to false for Submit to suppress hidden case details.
    executeCode(
        userCode: string,
        testcases: Testcase[],
        showHiddenInputs: boolean,
        metadata?: ProblemMetadata,
        visibleTestcaseCount?: number
    ): Promise<ExecutionSummary>;
}

// Reuse the executor for the requested language.
// Routes must check that the problem supports that language before calling this factory.
export class CodeExecutorFactory {
    private static readonly javaExecutor = new JavaExecutor();
    private static readonly pythonExecutor = new PythonExecutor();

    static getExecutor(language: Language): CodeExecutor {
        switch (language) {
            case 'java':
                return CodeExecutorFactory.javaExecutor;
            case 'python3':
                return CodeExecutorFactory.pythonExecutor;
            default:
                throw new Error(`Unsupported language: ${language}`);
        }
    }
}
