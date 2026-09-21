import type { ProblemProgress } from '../types';

/**
 * A page can unmount while its save is in flight. Keep ordering outside React so
 * reopening the same problem cannot read or overwrite an older snapshot.
 */
export function createProgressPersistence(
    write: (id: string, progress: ProblemProgress) => Promise<void>
) {
    const pending = new Map<string, Promise<void>>();
    const drafts = new Map<string, ProblemProgress>();

    const wait = async (id?: string) => {
        const requests = id === undefined ? [...pending.values()] : [pending.get(id)];
        await Promise.all(requests.map(request => request?.catch(() => undefined)));
    };

    return {
        async save(id: string, progress: ProblemProgress): Promise<void> {
            drafts.set(id, progress);
            const request = (pending.get(id) ?? Promise.resolve())
                .catch(() => undefined)
                .then(() => write(id, progress));
            pending.set(id, request);
            try {
                await request;
                if (drafts.get(id) === progress) drafts.delete(id);
            } finally {
                if (pending.get(id) === request) pending.delete(id);
            }
        },

        async read(id: string, load: () => Promise<ProblemProgress | null>) {
            await wait(id);
            return drafts.get(id) ?? await load();
        },

        async readAll(load: () => Promise<Record<string, ProblemProgress>>) {
            await wait();
            return { ...await load(), ...Object.fromEntries(drafts) };
        },

        async remove(id: string, remove: () => Promise<void>) {
            await wait(id);
            await remove();
            drafts.delete(id);
        },

        hasUnsavedDrafts: (id?: string) => id === undefined ? drafts.size > 0 : drafts.has(id),
    };
}
