import { constants, promises as fs } from 'fs';
import { randomUUID } from 'crypto';
import * as path from 'path';

// Allow the bundled large sorting test data to fit within the local file-size limit.
export const MAX_DATA_BYTES = 64 * 1024 * 1024;

export function hasErrorCode(error: unknown, code: string): boolean {
    return error instanceof Error && 'code' in error && error.code === code;
}

export function invalidInput(message: string): Error & { code: string } {
    return Object.assign(new Error(message), { code: 'EINVAL' });
}

// Serialize mutations for each problem across service instances in this process.
// Multiple backend processes are not coordinated by this map.
const mutations = new Map<string, Promise<void>>();

export async function withStorageLock<T>(key: string, action: () => Promise<T>): Promise<T> {
    const previous = mutations.get(key) ?? Promise.resolve();
    let release!: () => void;
    const current = new Promise<void>((resolve) => { release = resolve; });
    mutations.set(key, current);
    await previous;
    try {
        return await action();
    } finally {
        release();
        if (mutations.get(key) === current) mutations.delete(key);
    }
}

export async function readTextFile(filePath: string): Promise<string> {
    const entry = await fs.lstat(filePath);
    if (!entry.isFile() || entry.isSymbolicLink()) throw new Error('Data path must point to a regular file');
    // O_NOFOLLOW rejects a final path component replaced by a symlink after lstat.
    const file = await fs.open(filePath, constants.O_RDONLY | constants.O_NOFOLLOW);
    try {
        const stat = await file.stat();
        if (!stat.isFile() || stat.size > MAX_DATA_BYTES) {
            throw new Error('Data file must be a regular file no larger than 64 MB');
        }
        return await file.readFile('utf-8');
    } finally {
        await file.close();
    }
}

// Limit concurrent reads so a large problem library does not open every file at once.
export async function mapInBatches<T, U>(items: T[], read: (item: T) => Promise<U>): Promise<U[]> {
    const results: U[] = [];
    for (let offset = 0; offset < items.length; offset += 16) {
        results.push(...await Promise.all(items.slice(offset, offset + 16).map(read)));
    }
    return results;
}

export async function writeJsonAtomic(filePath: string, value: unknown): Promise<void> {
    const content = JSON.stringify(value, null, 4);
    if (Buffer.byteLength(content, 'utf-8') > MAX_DATA_BYTES) {
        throw invalidInput('Data file cannot exceed 64 MB');
    }
    const temporaryPath = path.join(path.dirname(filePath), `.${path.basename(filePath)}.${randomUUID()}.tmp`);
    try {
        const file = await fs.open(temporaryPath, 'wx', 0o600);
        try {
            await file.writeFile(content, 'utf-8');
            await file.sync();
        } finally {
            await file.close();
        }
        // Rename within the same directory so readers see either the complete old JSON or the complete new JSON.
        await fs.rename(temporaryPath, filePath);
    } finally {
        await fs.rm(temporaryPath, { force: true });
    }
}
