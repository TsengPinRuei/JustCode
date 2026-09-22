import type { ProblemProgress } from '../types';

// Keep save ordering outside React so it survives route changes in this tab.
// Reads wait for queued writes and prefer any remaining unsaved draft.
export function createProgressPersistence(
    write: (id: string, progress: ProblemProgress) => Promise<void>
) {
    const pending = new Map<string, Promise<void>>();
    // Drafts are held only in this tab's memory and do not survive a reload or browser restart.
    const drafts = new Map<string, ProblemProgress>();

    const wait = async (id?: string) => {
        const requests = id === undefined ? [...pending.values()] : [pending.get(id)];
        // Waiting callers may recover from retained drafts after a failed write.
        await Promise.all(requests.map(request => request?.catch(() => undefined)));
    };

    return {
        async save(id: string, progress: ProblemProgress): Promise<void> {
            drafts.set(id, progress);
            // A failed earlier write must not prevent a newer snapshot or retry from being saved.
            const request = (pending.get(id) ?? Promise.resolve())
                .catch(() => undefined)
                .then(() => write(id, progress));
            pending.set(id, request);
            try {
                await request;
                // Remove only this saved snapshot; a newer draft must remain available.
                if (drafts.get(id) === progress) drafts.delete(id);
            } finally {
                // Clear only this completed queue entry; a newer queued request must remain.
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
