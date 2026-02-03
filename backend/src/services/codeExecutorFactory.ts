import { JavaExecutor } from './javaExecutor';
import { PythonExecutor } from './pythonExecutor';
import { Language } from '../types';

export class CodeExecutorFactory {
    static getExecutor(language: Language) {
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
