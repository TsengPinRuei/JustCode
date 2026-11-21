import type { ExecutionResult, Language } from '../types';

export type SubmissionState = 'running' | 'completed' | 'error' | 'interrupted';
export type Judgement = ExecutionResult & { passedTestcases: number; totalTestcases: number };

export interface SubmissionSummary {
    id: string;
    problemId: string;
    language: Language;
    submittedAt: string;
    finishedAt: string | null;
    state: SubmissionState;
    verdict: Judgement['status'] | null;
    passedTestcases: number | null;
    totalTestcases: number | null;
    judgeDurationMs: number | null;
    submitDurationMs: number | null;
    durationMs: number | null;
    source: 'submit' | 'legacy';
}

export interface SubmissionDetail extends SubmissionSummary {
    code: string | null;
    result: Judgement | null;
    error: string | null;
}

export interface ActivityFilter {
    timezone: string;
    from?: string;
    to?: string;
    problemId?: string;
    language?: Language;
}

export interface SubmissionPage {
    items: SubmissionSummary[];
    total: number;
    page: number;
    limit: number;
}

export interface ActivityCounts {
    submissions: number;
    accepted: number;
    practicedProblems: number;
    solvedProblems: number;
}

export interface DailyActivity {
    days: (ActivityCounts & { date: string })[];
    totals: ActivityCounts;
    hasLegacy: boolean;
}
