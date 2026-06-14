/**
 * Code Executor Factory：依語言回傳對應 executor。
 * 讓 route handler 不需要知道各語言 runner 產生細節。
 */
import { JavaExecutor } from './javaExecutor';
import { PythonExecutor } from './pythonExecutor';
import { Language, Testcase, TestcaseResult, CompilationError, ProblemMetadata } from '../types';

/** 所有語言專屬 code executor 都需實作的共用合約。 */
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

/** 依 ProblemMetadata.supportedLanguages 宣告的語言回傳 executor 的 factory。 */
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
