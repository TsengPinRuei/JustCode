import { Language, ProblemProgress, RunRequest, SubmitRequest } from './types';
import { isProblemId } from './services/problemValidation';

export class RequestError extends Error {
    constructor(message: string, public readonly status = 400) {
        super(message);
    }
}

export const isRecord = (value: unknown): value is Record<string, unknown> =>
    typeof value === 'object' && value !== null && !Array.isArray(value);

const isLanguage = (value: unknown): value is Language => value === 'java' || value === 'python3';
const isNonNegativeNumber = (value: unknown): value is number =>
    typeof value === 'number' && Number.isFinite(value) && value >= 0;

export function validateExecutionRequest(body: unknown, run: true): RunRequest;
export function validateExecutionRequest(body: unknown, run: false): SubmitRequest;
export function validateExecutionRequest(body: unknown, run: boolean): RunRequest | SubmitRequest {
    if (!isRecord(body)) throw new RequestError('Request body must be an object');
    if (!isProblemId(body.problemId)) {
        throw new RequestError('A valid problemId is required');
    }
    if (typeof body.code !== 'string' || !body.code.trim()) throw new RequestError('Code is required');
    if (!isLanguage(body.language)) throw new RequestError('Unsupported language');
    if (run && body.inputMode !== 'visible' && body.inputMode !== 'custom') {
        throw new RequestError('inputMode must be visible or custom');
    }
    return body as unknown as RunRequest | SubmitRequest;
}

export function validateProgress(body: unknown): ProblemProgress {
    if (!isRecord(body) || typeof body.status !== 'string' || !['none', 'attempted', 'solved'].includes(body.status) ||
        !isLanguage(body.selectedLanguage) || !isRecord(body.code) ||
        !Object.entries(body.code).every(([language, code]) => isLanguage(language) && typeof code === 'string')) {
        throw new RequestError('Invalid progress data');
    }

    if (body.solveRecords !== undefined) {
        if (!Array.isArray(body.solveRecords)) throw new RequestError('solveRecords must be an array');
        const ids = new Set<string>();
        for (const record of body.solveRecords) {
            if (!isRecord(record) || typeof record.id !== 'string' || !record.id ||
                ids.has(record.id) || typeof record.solvedAt !== 'string' ||
                !Number.isFinite(Date.parse(record.solvedAt)) || !isLanguage(record.language) ||
                !isNonNegativeNumber(record.durationMs) ||
                (record.submitDurationMs !== undefined && !isNonNegativeNumber(record.submitDurationMs)) ||
                !isNonNegativeNumber(record.passedTestcases) || !Number.isInteger(record.passedTestcases) ||
                !isNonNegativeNumber(record.totalTestcases) || !Number.isInteger(record.totalTestcases) ||
                record.passedTestcases > record.totalTestcases) {
                throw new RequestError('Invalid solve record');
            }
            ids.add(record.id);
        }
    }
    return {
        status: body.status as ProblemProgress['status'],
        code: body.code as Record<string, string>,
        selectedLanguage: body.selectedLanguage,
        ...(body.solveRecords !== undefined ? { solveRecords: body.solveRecords as ProblemProgress['solveRecords'] } : {}),
        lastUpdated: new Date().toISOString(),
    };
}
