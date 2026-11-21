import axios from 'axios';
import type { ActivityFilter, DailyActivity, SubmissionDetail, SubmissionPage } from '../../../backend/src/shared/activity';
import { parseJson, stringifyJson } from '../../../backend/src/shared/json';
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

// Use relative API URLs through Vite's proxy locally.
// Other hosting must serve or proxy /api on the frontend's origin.
const apiClient = axios.create({
    baseURL: '/api',
    timeout: 30000,
    headers: { 'Content-Type': 'application/json' },
    // Keep integer tokens lossless before Axios can convert them to Number.
    transformRequest: [(data) => data === undefined ? undefined : stringifyJson(data)],
    transformResponse: [(data) => typeof data === 'string' && data.length ? parseJson(data) : data],
});

const progressPersistence = createProgressPersistence(async (id, progress) => {
    const { code, selectedLanguage, status } = progress;
    await apiClient.put(`/progress/${encodeURIComponent(id)}`, { code, selectedLanguage, status: status === 'none' ? 'none' : 'attempted' });
});

export function getApiErrorMessage(error: unknown, fallback: string): string {
    if (axios.isAxiosError(error) && typeof error.response?.data?.error === 'string') {
        return error.response.data.error;
    }
    return error instanceof Error && error.message ? error.message : fallback;
}

class RecordedSubmissionError extends Error {}

export function canRetrySubmission(error: unknown): boolean {
    if (error instanceof RecordedSubmissionError) return false;
    if (!axios.isAxiosError(error) || !error.response) return true;
    return !error.response.data?.state && (error.response.status === 429 || error.response.status >= 500);
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
        // Allow headroom above the backend's 60-second compilation/testcase budget
        // for setup, cleanup, storage reads, and HTTP overhead.
        const response = await apiClient.post('/run', {
            problemId, code, language, inputMode, customInput,
        }, { signal, timeout: 75000 });
        return response.data;
    },

    async submitCode(problemId: string, code: string, language: Language, submissionId: string, signal: AbortSignal): Promise<ExecutionResult> {
        const response = await apiClient.post('/submit', { problemId, code, language, submissionId }, { signal, timeout: 75000 });
        if (response.data.status) return response.data;
        if (response.data.state === 'running') {
            const deadline = Date.now() + 75000;
            while (!signal.aborted && Date.now() < deadline) {
                await new Promise(resolve => setTimeout(resolve, 500));
                const detail = await this.submission(submissionId, signal);
                if (detail.result) return detail.result;
                if (detail.state !== 'running') throw new RecordedSubmissionError(detail.error ?? detail.state);
            }
        }
        if (response.data.state === 'error' || response.data.state === 'interrupted') {
            throw new RecordedSubmissionError(response.data.error ?? response.data.state);
        }
        throw new Error('Submission has not completed. Check Activity or retry.');
    },

    async saveTiming(id: string, submitDurationMs: number, durationMs?: number): Promise<void> {
        await apiClient.patch(`/submissions/${encodeURIComponent(id)}/timing`, { submitDurationMs, durationMs });
    },

    async submission(id: string, signal?: AbortSignal): Promise<SubmissionDetail> {
        return (await apiClient.get(`/submissions/${encodeURIComponent(id)}`, { signal })).data;
    },

    async submissions(filter: ActivityFilter, page: number, signal: AbortSignal): Promise<SubmissionPage> {
        return (await apiClient.get('/submissions', { params: { ...filter, page }, signal })).data;
    },

    async daily(filter: ActivityFilter, signal: AbortSignal): Promise<DailyActivity> {
        return (await apiClient.get('/stats/daily', { params: filter, signal })).data;
    },

    async savedProgress(id: string, signal?: AbortSignal): Promise<ProblemProgress | null> {
        return (await apiClient.get(`/progress/${encodeURIComponent(id)}`, { signal })).data;
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
        return progressPersistence.read(id, () => this.savedProgress(id, signal));
    },

    async getProblemStatuses(signal?: AbortSignal): Promise<Record<string, ProblemProgress['status']>> {
        return progressPersistence.readStatuses(async () => {
            const response = await apiClient.get('/progress', { params: { view: 'status' }, signal });
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
