import Database from 'better-sqlite3';
import { randomUUID } from 'node:crypto';
import { stringifyJson } from '../shared/json';
import type { Judgement, SubmissionDetail } from '../shared/activity';
import type { Language, ProblemProgress, SolveRecord, SubmitRequest } from '../types';
import { RequestError } from '../requestValidation';
import { ActivityQueries } from './activityQueries';
import { databasePath, migratePractice } from './practiceSchema';

export interface IdentifiedSubmit extends SubmitRequest { submissionId: string }
type ProgressRow = Pick<ProblemProgress, 'selectedLanguage' | 'status' | 'lastUpdated'> & { problemId: string };

export class PracticeDatabase {
    readonly activity: ActivityQueries;

    private constructor(private readonly db: Database.Database, private readonly owner: Database.Database) {
        this.activity = new ActivityQueries(db);
    }

    static async open(root: string): Promise<PracticeDatabase> {
        // A second server must not mark the first server's live submissions interrupted.
        // SQLite releases this separate file lock even when the process is killed.
        const owner = new Database(await databasePath(root, 'backend.lock.sqlite'), { timeout: 0 });
        let db: Database.Database | undefined;
        try {
            owner.exec('BEGIN EXCLUSIVE');
            db = new Database(await databasePath(root), { timeout: 5000 });
            db.pragma('foreign_keys = ON');
            db.pragma('journal_mode = WAL');
            db.pragma('synchronous = FULL');
            await migratePractice(db, root);
            return new PracticeDatabase(db, owner);
        } catch (error) {
            db?.close();
            owner.close();
            throw error;
        }
    }

    close(): void { this.db.close(); this.owner.close(); }

    interruptUnfinished(): void {
        this.db.prepare(`UPDATE submissions SET state='interrupted', finishedAt=?, error='Backend stopped during submission'
            WHERE state='running'`).run(new Date().toISOString());
    }

    statuses(): Record<string, ProblemProgress['status']> {
        const rows = this.db.prepare('SELECT problemId, status FROM progress').raw().all() as [string, ProblemProgress['status']][];
        return Object.fromEntries(rows);
    }

    progress(problemId?: string): Record<string, ProblemProgress> {
        const where = problemId === undefined ? '' : ' WHERE problemId=?';
        const ids = problemId === undefined ? [] : [problemId];
        const entries: Record<string, ProblemProgress> = Object.create(null);
        const rows = this.db.prepare('SELECT problemId, selectedLanguage, status, lastUpdated FROM progress' + where).all(...ids) as ProgressRow[];
        for (const { problemId: id, ...progress } of rows) entries[id] = { ...progress, code: {} };
        const drafts = this.db.prepare('SELECT problemId, language, code FROM drafts' + where).iterate(...ids) as Iterable<{
            problemId: string; language: Language; code: string;
        }>;
        for (const draft of drafts) entries[draft.problemId].code[draft.language] = draft.code;
        const records = this.db.prepare(`SELECT problemId, COALESCE(legacyId,id) AS id, finishedAt AS solvedAt, language,
            durationMs, submitDurationMs, passedTestcases, totalTestcases FROM submissions WHERE verdict='AC'
            ${problemId === undefined ? '' : 'AND problemId=?'} ORDER BY finishedAt, rowid`).iterate(...ids) as Iterable<
                Omit<SolveRecord, 'durationMs' | 'submitDurationMs'> & { problemId: string; durationMs: number | null; submitDurationMs: number | null }
            >;
        for (const { problemId: id, durationMs, submitDurationMs, ...record } of records) {
            (entries[id].solveRecords ??= []).push({ ...record, ...(durationMs !== null && { durationMs }),
                ...(submitDurationMs !== null && { submitDurationMs }) });
        }
        return entries;
    }

    saveDrafts(problemId: string, progress: ProblemProgress): void {
        this.db.transaction(() => {
            this.db.prepare(`INSERT INTO progress(problemId,selectedLanguage,status,lastUpdated) VALUES (?,?,?,?)
                ON CONFLICT(problemId) DO UPDATE SET selectedLanguage=excluded.selectedLanguage, lastUpdated=excluded.lastUpdated,
                status=CASE WHEN progress.status='solved' THEN 'solved' WHEN progress.status='attempted' THEN 'attempted' ELSE excluded.status END`)
                .run(problemId, progress.selectedLanguage, progress.status === 'solved' ? 'attempted' : progress.status, progress.lastUpdated);
            const write = this.db.prepare(`INSERT INTO drafts(problemId,language,code) VALUES (?,?,?)
                ON CONFLICT(problemId,language) DO UPDATE SET code=excluded.code`);
            for (const [language, code] of Object.entries(progress.code)) write.run(problemId, language, code);
        })();
    }

    replay(request: IdentifiedSubmit): SubmissionDetail | undefined {
        const stored = this.activity.detail(request.submissionId);
        if (stored && (stored.source !== 'submit' || stored.problemId !== request.problemId ||
            stored.language !== request.language || stored.code !== request.code)) {
            throw new RequestError('Submission ID already used for different content', 409);
        }
        return stored;
    }

    begin(request: IdentifiedSubmit): void {
        const at = new Date().toISOString();
        this.db.transaction(() => {
            this.db.prepare(`INSERT INTO progress(problemId,selectedLanguage,status,lastUpdated) VALUES (?,?,'attempted',?)
                ON CONFLICT(problemId) DO UPDATE SET status=CASE WHEN status='none' THEN 'attempted' ELSE status END, lastUpdated=excluded.lastUpdated`)
                .run(request.problemId, request.language, at);
            this.db.prepare(`INSERT INTO submissions(id,problemId,language,code,submittedAt,source,state)
                VALUES (?,?,?,?,?,'submit','running')`).run(request.submissionId, request.problemId, request.language, request.code, at);
        })();
    }

    complete(request: IdentifiedSubmit, result: Judgement, judgeDurationMs: number): void {
        const at = new Date().toISOString();
        this.db.transaction(() => {
            const updated = this.db.prepare(`UPDATE submissions SET state='completed', verdict=?, resultJson=?,
                passedTestcases=?, totalTestcases=?, finishedAt=?, judgeDurationMs=? WHERE id=? AND state='running'`)
                .run(result.status, stringifyJson(result), result.passedTestcases, result.totalTestcases, at, judgeDurationMs, request.submissionId);
            if (!updated.changes) throw new Error('Submission is no longer running');
            if (result.status === 'AC') this.db.prepare("UPDATE progress SET status='solved', lastUpdated=? WHERE problemId=?").run(at, request.problemId);
        })();
    }

    fail(id: string, message: string): void {
        this.db.prepare(`UPDATE submissions SET state='error', finishedAt=?, error=?
            WHERE id=? AND state='running'`).run(new Date().toISOString(), message, id);
    }

    timing(id: string, submitMs: number, attemptMs?: number): void {
        const updated = this.db.prepare(`UPDATE submissions SET submitDurationMs=COALESCE(submitDurationMs,?),
            durationMs=COALESCE(durationMs,?) WHERE id=? AND source='submit' AND state='completed'`).run(submitMs, attemptMs ?? null, id);
        if (!updated.changes) {
            if (!this.db.prepare('SELECT 1 FROM submissions WHERE id=?').get(id)) throw new RequestError('Submission not found', 404);
            throw new RequestError('Only completed submissions can receive browser timings', 409);
        }
    }

    pendingDeletes(): { problemId: string; token: string }[] {
        return this.db.prepare('SELECT problemId, token FROM deletions').all() as { problemId: string; token: string }[];
    }

    deletionToken(id: string): string | undefined {
        return this.db.prepare('SELECT token FROM deletions WHERE problemId=?').pluck().get(id) as string | undefined;
    }

    beginDeletion(id: string): string {
        if (this.db.prepare("SELECT 1 FROM submissions WHERE problemId=? AND state='running'").get(id)) {
            throw new RequestError('A submission for this problem is still running', 409);
        }
        const token = randomUUID();
        this.db.prepare('INSERT INTO deletions VALUES (?,?)').run(id, token);
        return token;
    }

    deleteProgress(id: string): void {
        // One statement cascades to the corresponding drafts and submissions.
        this.db.prepare('DELETE FROM progress WHERE problemId=?').run(id);
    }

    finishDeletion(id: string): void { this.db.prepare('DELETE FROM deletions WHERE problemId=?').run(id); }
}
