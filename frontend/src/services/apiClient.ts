import axios from 'axios';
import { ProblemMetadata, Problem, ExecutionResult, Language, ProblemProgress } from '../types';

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
        language: Language,
        inputMode: 'visible' | 'custom',
        customInput?: string
    ): Promise<ExecutionResult> {
        const response = await apiClient.post('/run', {
            problemId,
            code,
            language,
            inputMode,
            customInput,
        });
        return response.data;
    },

    async submitCode(problemId: string, code: string, language: Language): Promise<ExecutionResult> {
        const response = await apiClient.post('/submit', {
            problemId,
            code,
            language,
        });
        return response.data;
    },

    async importProblem(url: string): Promise<{ success: boolean; problemId: string; title: string }> {
        const response = await apiClient.post('/import-problem', { url });
        return response.data;
    },

    async getProgress(id: string): Promise<ProblemProgress | null> {
        const response = await apiClient.get(`/progress/${id}`);
        return response.data;
    },

    async getAllProgress(): Promise<Record<string, ProblemProgress>> {
        const response = await apiClient.get('/progress');
        return response.data;
    },

    async saveProgress(id: string, progress: ProblemProgress): Promise<void> {
        await apiClient.put(`/progress/${id}`, progress);
    },

    async deleteProblem(id: string): Promise<void> {
        await apiClient.delete(`/problems/${id}`);
    },
};
