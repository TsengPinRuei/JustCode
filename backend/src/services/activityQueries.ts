import Database from 'better-sqlite3';
import { parseJson } from '../shared/json';
import type { ActivityCounts, ActivityFilter, DailyActivity, Judgement, SubmissionDetail, SubmissionPage, SubmissionSummary } from '../shared/activity';
import { isProblemId } from './problemValidation';
import { RequestError } from '../requestValidation';

export const summaryColumns = 'id, problemId, language, submittedAt, finishedAt, state, verdict, passedTestcases, totalTestcases, judgeDurationMs, submitDurationMs, durationMs, source';
const counts = `COUNT(*) AS submissions, COUNT(CASE WHEN verdict='AC' THEN 1 END) AS accepted,
    COUNT(DISTINCT problemId) AS practicedProblems, COUNT(DISTINCT CASE WHEN verdict='AC' THEN problemId END) AS solvedProblems`;

function queryDate(input: unknown): string | undefined {
    if (input === undefined) return;
    if (typeof input === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(input)) {
        const date = new Date(input + 'T00:00:00Z');
        if (Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === input) return input;
    }
    throw new RequestError('Dates must be valid calendar dates in YYYY-MM-DD format');
}

export function activityFilter(query: Record<string, unknown>): ActivityFilter {
    const { language, problemId, timezone = 'UTC' } = query;
    if (language !== undefined && language !== 'java' && language !== 'python3') throw new RequestError('Invalid language');
    if (problemId !== undefined && !isProblemId(problemId)) throw new RequestError('Invalid problem ID');
    if (typeof timezone !== 'string' || !timezone || timezone.length > 100) throw new RequestError('Invalid time zone');
    try { new Intl.DateTimeFormat('en', { timeZone: timezone }); }
    catch { throw new RequestError('Unknown time zone'); }
    const from = queryDate(query.from);
    const to = queryDate(query.to);
    if (from && to && from > to) throw new RequestError('Start date must be on or before end date');
    return { language, problemId, timezone, from, to };
}

export function pageNumber(value: unknown, fallback: number, maximum: number): number {
    if (value === undefined) return fallback;
    if (typeof value !== 'string' || !/^[1-9]\d*$/.test(value) || Number(value) > maximum) {
        throw new RequestError(`Pagination must be an integer between 1 and ${maximum}`);
    }
    return Number(value);
}

function conditions(filter: ActivityFilter) {
    const parts: string[] = [];
    const bindings: Record<string, string> = {};
    if (filter.problemId) { parts.push('problemId = @problemId'); bindings.problemId = filter.problemId; }
    if (filter.language) { parts.push('language = @language'); bindings.language = filter.language; }
    // Narrow the time index first. The exact date is resolved in the browser's zone,
    // including days with DST transitions or a historical change of offset.
    if (filter.from) {
        parts.push('submittedAt >= @earliest AND local_day(submittedAt, @timezone) >= @from');
        const earliest = new Date(filter.from + 'T00:00:00Z');
        earliest.setUTCDate(earliest.getUTCDate() - 1);
        Object.assign(bindings, { from: filter.from, earliest: earliest.toISOString(), timezone: filter.timezone });
    }
    if (filter.to) {
        parts.push('submittedAt < @latest AND local_day(submittedAt, @timezone) <= @to');
        const latest = new Date(filter.to + 'T00:00:00Z');
        latest.setUTCDate(latest.getUTCDate() + 2);
        Object.assign(bindings, { to: filter.to, latest: latest.getUTCFullYear() > 9999 ? 'Z' : latest.toISOString(), timezone: filter.timezone });
    }
    return { where: parts.length ? ' WHERE ' + parts.join(' AND ') : '', bindings };
}

export class ActivityQueries {
    constructor(private readonly db: Database.Database) {
        let currentZone: string | undefined;
        let formatter: Intl.DateTimeFormat;
        db.function('local_day', { deterministic: true }, (at: string, zone: string) => {
            if (zone !== currentZone) {
                formatter = new Intl.DateTimeFormat('sv-SE', { timeZone: zone, year: 'numeric', month: '2-digit', day: '2-digit' });
                currentZone = zone;
            }
            return formatter.format(new Date(at));
        });
    }

    detail(id: string): SubmissionDetail | undefined {
        const row = this.db.prepare(`SELECT ${summaryColumns}, code, resultJson, error FROM submissions WHERE id=?`).get(id) as
            (SubmissionSummary & { code: string | null; resultJson: string | null; error: string | null }) | undefined;
        if (!row) return;
        const { resultJson, ...detail } = row;
        return { ...detail, result: resultJson === null ? null : parseJson(resultJson) as Judgement };
    }

    list(filter: ActivityFilter, page: number, limit: number): SubmissionPage {
        const { where, bindings } = conditions(filter);
        const total = this.db.prepare(`SELECT COUNT(*) FROM submissions${where}`).pluck().get(bindings) as number;
        const items = this.db.prepare(`SELECT ${summaryColumns} FROM submissions${where}
            ORDER BY submittedAt DESC, id DESC LIMIT @limit OFFSET @offset`)
            .all({ ...bindings, limit, offset: (page - 1) * limit }) as SubmissionSummary[];
        return { items, total, page, limit };
    }

    daily(filter: ActivityFilter): DailyActivity {
        const { where, bindings } = conditions(filter);
        const days = this.db.prepare(`SELECT local_day(submittedAt,@timezone) AS date, ${counts}
            FROM submissions${where} GROUP BY date ORDER BY date DESC`)
            .all({ ...bindings, timezone: filter.timezone }) as DailyActivity['days'];
        const { legacy, ...totals } = this.db.prepare(`SELECT ${counts}, COUNT(CASE WHEN source='legacy' THEN 1 END) AS legacy
            FROM submissions${where}`).get(bindings) as ActivityCounts & { legacy: number };
        return { days, totals, hasLegacy: legacy > 0 };
    }
}
