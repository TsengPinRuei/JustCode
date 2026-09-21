import { constants, promises as fs } from 'fs';
import { randomUUID } from 'crypto';
import * as path from 'path';

// 內建 sort-array 的 hidden cases 約 38 MB；本機資料上限須涵蓋既有題庫。
export const MAX_DATA_BYTES = 64 * 1024 * 1024;

export function hasErrorCode(error: unknown, code: string): boolean {
    return error instanceof Error && 'code' in error && error.code === code;
}

export function invalidInput(message: string): Error & { code: string } {
    return Object.assign(new Error(message), { code: 'EINVAL' });
}

// 所有 service instance 共用佇列，讓同一題目的 read-modify-write 不會遺失更新。
// 這是單一後端 process 的協調；不支援多個 server 同時修改同一份資料。
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
    // O_NOFOLLOW 防止檢查與 open 之間最後一層路徑被替換成 symlink。
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
        // 同一目錄中的 rename 讓讀取端只看見完整的舊版或新版 JSON。
        await fs.rename(temporaryPath, filePath);
    } finally {
        await fs.rm(temporaryPath, { force: true });
    }
}
