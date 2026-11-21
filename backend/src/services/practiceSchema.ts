import Database from 'better-sqlite3';
import { promises as fs, readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { parseJson } from '../shared/json';
import { validateProgress } from '../requestValidation';
import { isProblemId, isRecord } from './problemValidation';
import { hasErrorCode, readTextFile } from './storage';
import type { ProblemProgress } from '../types';

export const PROJECT_ROOT = path.resolve(__dirname, '../../..');

export async function ensureDirectory(dir: string): Promise<void> {
    await fs.mkdir(dir, { recursive: true, mode: 0o700 });
    if (!(await fs.lstat(dir)).isDirectory()) throw new Error(`Expected a directory: ${dir}`);
}

export async function databasePath(root: string, name = 'justcode.sqlite'): Promise<string> {
    const dir = path.join(root, 'data');
    await ensureDirectory(dir);
    const file = path.join(dir, name);
    for (const suffix of ['', '-wal', '-shm', '-journal']) {
        try {
            if (!(await fs.lstat(file + suffix)).isFile()) throw new Error(`Expected a regular file: ${file + suffix}`);
        } catch (error) {
            if (!hasErrorCode(error, 'ENOENT')) throw error;
        }
    }
    return file;
}

const schema = `
    CREATE TABLE progress (
        problemId TEXT PRIMARY KEY NOT NULL, selectedLanguage TEXT NOT NULL CHECK(selectedLanguage IN ('java','python3')),
        status TEXT NOT NULL CHECK(status IN ('none','attempted','solved')), lastUpdated TEXT NOT NULL
    );
    CREATE TABLE drafts (
        problemId TEXT NOT NULL REFERENCES progress ON DELETE CASCADE,
        language TEXT NOT NULL CHECK(language IN ('java','python3')), code TEXT NOT NULL, PRIMARY KEY(problemId, language)
    );
    CREATE TABLE submissions (
        id TEXT PRIMARY KEY NOT NULL, problemId TEXT NOT NULL REFERENCES progress ON DELETE CASCADE,
        language TEXT NOT NULL CHECK(language IN ('java','python3')), submittedAt TEXT NOT NULL, finishedAt TEXT,
        state TEXT NOT NULL CHECK(state IN ('running','completed','error','interrupted')),
        source TEXT NOT NULL CHECK(source IN ('submit','legacy')), legacyId TEXT,
        verdict TEXT CHECK(verdict IN ('AC','WA','CE','RE','TLE')), passedTestcases INTEGER, totalTestcases INTEGER,
        code TEXT, resultJson TEXT, error TEXT, judgeDurationMs REAL, submitDurationMs REAL, durationMs REAL,
        UNIQUE(problemId, legacyId)
    );
    CREATE INDEX submissions_time ON submissions(submittedAt DESC, id DESC);
    CREATE INDEX submissions_problem_time ON submissions(problemId, submittedAt DESC, id DESC);
    CREATE INDEX submissions_language_time ON submissions(language, submittedAt DESC, id DESC);
    CREATE TABLE deletions (problemId TEXT PRIMARY KEY NOT NULL, token TEXT NOT NULL UNIQUE);
`;

function legacyProgress(raw: string): ProblemProgress | null {
    const data = parseJson(raw);
    if (isRecord(data) && data.status === 'none' && data.selectedLanguage === '' && data.lastUpdated === '' &&
        isRecord(data.code) && !Object.keys(data.code).length &&
        (data.solveRecords === undefined || (Array.isArray(data.solveRecords) && !data.solveRecords.length))) return null;
    const progress = validateProgress(data);
    if (!isRecord(data) || typeof data.lastUpdated !== 'string' || !Number.isFinite(Date.parse(data.lastUpdated))) {
        throw new Error('Invalid progress timestamp');
    }
    return { ...progress, lastUpdated: data.lastUpdated };
}

async function snapshotLegacyFiles(root: string): Promise<string | undefined> {
    const problems = path.join(root, 'problems');
    await ensureDirectory(problems);
    let staging: string | undefined;
    try {
        for (const entry of await fs.readdir(problems, { withFileTypes: true })) {
            if (!entry.isDirectory() || !isProblemId(entry.name)) continue;
            const file = path.join(problems, entry.name, 'progress.json');
            let raw: string;
            try {
                raw = await readTextFile(file);
            } catch (error) {
                if (hasErrorCode(error, 'ENOENT')) continue;
                throw new Error(`Cannot read ${file}: ${String(error)}`);
            }
            if (!staging) {
                const backups = path.join(root, 'data', 'backups');
                await ensureDirectory(backups);
                staging = await fs.mkdtemp(path.join(backups, '.legacy-'));
            }
            await fs.writeFile(path.join(staging, entry.name + '.json'), raw, { flag: 'wx', mode: 0o600 });
        }
        if (!staging) return;
        const snapshot = path.join(path.dirname(staging), 'legacy-' + randomUUID());
        await fs.rename(staging, snapshot);
        return snapshot;
    } catch (error) {
        if (staging) await fs.rm(staging, { recursive: true, force: true });
        throw error;
    }
}

export async function migratePractice(db: Database.Database, root: string): Promise<void> {
    const version = db.pragma('user_version', { simple: true });
    if (version === 1) return;
    if (version !== 0) throw new Error(`Unsupported JustCode database version: ${version}`);
    const snapshot = await snapshotLegacyFiles(root);
    db.transaction(() => {
        db.exec(schema);
        const progress = db.prepare('INSERT INTO progress(problemId,selectedLanguage,status,lastUpdated) VALUES (?,?,?,?)');
        const draft = db.prepare('INSERT INTO drafts VALUES (?,?,?)');
        const submission = db.prepare(`INSERT INTO submissions
            (id,problemId,language,submittedAt,finishedAt,state,source,legacyId,verdict,passedTestcases,totalTestcases,durationMs,submitDurationMs)
            VALUES (?,?,?,?,?,'completed','legacy',?,'AC',?,?,?,?)`);
        // Import the exact files in the backup, one problem at a time.
        for (const file of snapshot ? readdirSync(snapshot) : []) {
            const id = path.basename(file, '.json');
            let data: ProblemProgress | null;
            try {
                data = legacyProgress(readFileSync(path.join(snapshot!, file), 'utf8'));
            } catch (error) {
                throw new Error(`Cannot migrate ${path.join(root, 'problems', id, 'progress.json')}: ${String(error)}`);
            }
            if (!data) continue;
            progress.run(id, data.selectedLanguage, data.solveRecords?.length ? 'solved' : data.status, data.lastUpdated);
            for (const [language, code] of Object.entries(data.code)) draft.run(id, language, code);
            for (const record of data.solveRecords ?? []) {
                const at = new Date(record.solvedAt).toISOString();
                submission.run(randomUUID(), id, record.language, at, at, record.id, record.passedTestcases,
                    record.totalTestcases, record.durationMs ?? null, record.submitDurationMs ?? null);
            }
        }
        db.pragma('user_version = 1');
    })();
}

export async function backupPractice(root: string): Promise<string> {
    const source = await databasePath(root);
    const db = new Database(source, { readonly: true, fileMustExist: true });
    try {
        const backups = path.join(root, 'data', 'backups');
        await ensureDirectory(backups);
        const target = path.join(backups, `justcode-${new Date().toISOString().replace(/:/g, '-')}-${randomUUID()}.sqlite`);
        await db.backup(target);
        return target;
    } finally {
        db.close();
    }
}
