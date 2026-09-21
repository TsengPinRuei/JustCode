import axios from 'axios';
import {
    ExecutionResult,
    HiddenTestcaseImportRequest,
    HiddenTestcaseImportResponse,
    Language,
    Problem,
    ProblemMetadata,
    ProblemProgress,
} from '../types';
import { createProgressPersistence } from './progressPersistence';

// Vite proxies /api during development; production uses the same origin.
const apiClient = axios.create({
    baseURL: '/api',
    timeout: 30000,
    headers: { 'Content-Type': 'application/json' },
});

const progressPersistence = createProgressPersistence(async (id, progress) => {
    await apiClient.put(`/progress/${encodeURIComponent(id)}`, progress);
});

export function getApiErrorMessage(error: unknown, fallback: string): string {
    if (axios.isAxiosError(error) && typeof error.response?.data?.error === 'string') {
        return error.response.data.error;
    }
    return error instanceof Error && error.message ? error.message : fallback;
}

export const problemsApi = {
    async getProblems(signal?: AbortSignal): Promise<ProblemMetadata[]> {
        const response = await apiClient.get('/problems', { signal });
        return response.data;
    },

    async getProblem(id: string, signal?: AbortSignal): Promise<Problem> {
        const response = await apiClient.get(`/problems/${encodeURIComponent(id)}`, { signal });
        return response.data;
    },

    async runCode(
        problemId: string,
        code: string,
        language: Language,
        inputMode: 'visible' | 'custom',
        customInput?: string,
        signal?: AbortSignal
    ): Promise<ExecutionResult> {
        // The backend bounds the entire execution to 60s, plus HTTP overhead.
        const response = await apiClient.post('/run', {
            problemId, code, language, inputMode, customInput,
        }, { signal, timeout: 75000 });
        return response.data;
    },

    async submitCode(
        problemId: string, code: string, language: Language, signal?: AbortSignal
    ): Promise<ExecutionResult> {
        const response = await apiClient.post('/submit', {
            problemId, code, language,
        }, { signal, timeout: 75000 });
        return response.data;
    },

    async importProblem(url: string): Promise<{ success: boolean; problemId: string; title: string }> {
        const response = await apiClient.post('/import-problem', { url });
        return response.data;
    },

    async importHiddenTestcases(
        id: string,
        request: HiddenTestcaseImportRequest
    ): Promise<HiddenTestcaseImportResponse> {
        const response = await apiClient.post(`/problems/${encodeURIComponent(id)}/hidden-testcases`, request);
        return response.data;
    },

    async getProgress(id: string, signal?: AbortSignal): Promise<ProblemProgress | null> {
        return progressPersistence.read(id, async () => {
            const response = await apiClient.get(`/progress/${encodeURIComponent(id)}`, { signal });
            return response.data;
        });
    },

    async getAllProgress(signal?: AbortSignal): Promise<Record<string, ProblemProgress>> {
        return progressPersistence.readAll(async () => {
            const response = await apiClient.get('/progress', { signal });
            return response.data;
        });
    },

    saveProgress: progressPersistence.save,
    hasUnsavedProgress: progressPersistence.hasUnsavedDrafts,

    async deleteProblem(id: string): Promise<void> {
        await progressPersistence.remove(id, async () => {
            await apiClient.delete(`/problems/${encodeURIComponent(id)}`);
        });
    },
};
