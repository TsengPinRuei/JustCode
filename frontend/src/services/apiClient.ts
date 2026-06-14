/**
 * API Client：所有後端 API 呼叫使用的 Axios HTTP client。
 * 提供題目、程式執行、進度與匯入相關方法。
 */
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

const API_BASE_URL = '/api';

// 開發時 Vite 會將 /api 代理到後端；正式環境可由同一 host 提供相同路徑。
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

    async importHiddenTestcases(
        id: string,
        request: HiddenTestcaseImportRequest
    ): Promise<HiddenTestcaseImportResponse> {
        // projectPath 模式會讀取伺服器端檔案，因此驗證責任在後端。
        const response = await apiClient.post(`/problems/${id}/hidden-testcases`, request);
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
