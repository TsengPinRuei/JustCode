import axios from 'axios';
import { ProblemMetadata, Problem, ExecutionResult } from '../types';

const API_BASE_URL = '/api';

const apiClient = axios.create({
    baseURL: API_BASE_URL,
    timeout: 30000,
    headers: {
        'Content-Type': 'application/json',
    },
});

export const problemsApi = {
    async getProblems(): Promise<ProblemMetadata[]> {
        const response = await apiClient.get('/problems');
        return response.data;
    },

    async getProblem(id: string): Promise<Problem> {
        const response = await apiClient.get(`/problems/${id}`);
        return response.data;
    },

    async runCode(
        problemId: string,
        code: string,
        inputMode: 'visible' | 'custom',
        customInput?: string
    ): Promise<ExecutionResult> {
        const response = await apiClient.post('/run', {
            problemId,
            code,
            inputMode,
            customInput,
        });
        return response.data;
    },

    async submitCode(problemId: string, code: string): Promise<ExecutionResult> {
        const response = await apiClient.post('/submit', {
            problemId,
            code,
        });
        return response.data;
    },
};
