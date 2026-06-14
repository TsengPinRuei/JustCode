/**
 * 解題統計面板：顯示目前嘗試計時與已保存的 AC 歷史。
 * 解題紀錄先以 submit runtime 排名，再以總解題時間作為排序決勝條件。
 */
import { useMemo, useState, type FC } from 'react';
import type { ProblemProgress, SolveRecord } from '../types';

interface SolveStatsPanelProps {
    progress: ProblemProgress | null;
    currentElapsedMs: number;
}

const formatDuration = (durationMs: number): string => {
    const totalSeconds = Math.max(0, Math.floor(durationMs / 1000));
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    if (hours > 0) {
        return `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
    }
    return `${minutes}:${String(seconds).padStart(2, '0')}`;
};

const formatSubmitDuration = (durationMs?: number): string => {
    // 舊版 progress 檔案可能沒有 submitDurationMs；維持可顯示，但不捏造資料。
    if (durationMs === undefined) return '-';
    return `${Math.max(1, Math.round(durationMs))}ms`;
};

const getSubmitDuration = (record: SolveRecord): number => {
    // 缺少 submit timing 的紀錄會排在有計時紀錄之後，但仍保留在歷史中。
    return record.submitDurationMs ?? Number.POSITIVE_INFINITY;
};

const EMPTY_SOLVE_RECORDS: SolveRecord[] = [];

const formatSolvedAt = (value: string): string => {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return date.toLocaleString(undefined, {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    });
};

const rankRecords = (records: SolveRecord[]) => {
    // 兩次提交測得相同 runtime 時，排序決勝條件讓排名保持可重現。
    return [...records]
        .sort((a, b) =>
            getSubmitDuration(a) - getSubmitDuration(b) ||
            a.durationMs - b.durationMs ||
            a.solvedAt.localeCompare(b.solvedAt)
        )
        .map((record, index) => ({
            record,
            rank: index + 1,
        }));
};

const SolveStatsPanel: FC<SolveStatsPanelProps> = ({ progress, currentElapsedMs }) => {
    const [expanded, setExpanded] = useState(false);
    const records = progress?.solveRecords ?? EMPTY_SOLVE_RECORDS;
    const {
        rankedRecords,
        latestRecord,
        bestTotalRecord,
        latestRank,
        maxSubmitDuration,
    } = useMemo(() => {
        // 從 progress 一次推導排行榜狀態，避免 UI state 與持久化歷史不同步。
        const rankedRecords = rankRecords(records);
        const latestRecord = records.length > 0 ? records[records.length - 1] : null;
        let bestTotalRecord: SolveRecord | null = null;
        let maxSubmitDuration = 1;

        for (const record of records) {
            if (!bestTotalRecord || record.durationMs < bestTotalRecord.durationMs) {
                bestTotalRecord = record;
            }
            // 圖表分母至少保留 1ms，讓極快或舊版紀錄仍能渲染。
            const submitDuration = getSubmitDuration(record);
            if (Number.isFinite(submitDuration) && submitDuration > maxSubmitDuration) {
                maxSubmitDuration = submitDuration;
            }
        }

        const latestRank = latestRecord
            ? rankedRecords.find((entry) => entry.record.id === latestRecord.id)?.rank ?? rankedRecords.length
            : null;

        return {
            rankedRecords,
            latestRecord,
            bestTotalRecord,
            latestRank,
            maxSubmitDuration,
        };
    }, [records]);

    return (
        <section className={`solve-stats-panel ${expanded ? 'expanded' : 'collapsed'}`} aria-label="Solve statistics">
            <button
                type="button"
                className="solve-stats-toggle"
                onClick={() => setExpanded((value) => !value)}
                aria-expanded={expanded}
            >
                <span className="solve-stats-toggle-title">Stats</span>
                <span className="solve-stats-toggle-summary">
                    Submit {latestRecord ? formatSubmitDuration(latestRecord.submitDurationMs) : '-'} · Rank {latestRank ? `#${latestRank}` : '-'}
                </span>
                <span className="solve-stats-toggle-icon" aria-hidden="true">
                    {expanded ? '−' : '+'}
                </span>
            </button>

            {expanded && (
                <>
                    <div className="solve-stats-summary">
                        <div className="solve-stat-item">
                            <span className="solve-stat-label">Current</span>
                            <strong>{formatDuration(currentElapsedMs)}</strong>
                        </div>
                        <div className="solve-stat-item">
                            <span className="solve-stat-label">Best Total</span>
                            <strong>{bestTotalRecord ? formatDuration(bestTotalRecord.durationMs) : '-'}</strong>
                        </div>
                        <div className="solve-stat-item">
                            <span className="solve-stat-label">Latest Submit</span>
                            <strong>{latestRecord ? formatSubmitDuration(latestRecord.submitDurationMs) : '-'}</strong>
                        </div>
                        <div className="solve-stat-item">
                            <span className="solve-stat-label">Latest Rank</span>
                            <strong>{latestRank ? `#${latestRank}` : '-'}</strong>
                        </div>
                        <div className="solve-stat-item">
                            <span className="solve-stat-label">Records</span>
                            <strong>{records.length}</strong>
                        </div>
                    </div>

                    {rankedRecords.length > 0 ? (
                        <div className="solve-rank-chart" aria-label="Ranked solve records">
                            {rankedRecords.map(({ record, rank }) => {
                                const isLatest = latestRecord?.id === record.id;
                                const submitDuration = getSubmitDuration(record);
                                // 缺少計時的紀錄顯示小型占位長條，而不是從圖表消失。
                                const width = Number.isFinite(submitDuration)
                                    ? Math.max(10, Math.round((submitDuration / maxSubmitDuration) * 100))
                                    : 10;
                                return (
                                    <div
                                        key={record.id}
                                        className={`solve-rank-row ${isLatest ? 'latest' : ''}`}
                                    >
                                        <span className="solve-rank-number">#{rank}</span>
                                        <div className="solve-rank-bar-track">
                                            <div
                                                className="solve-rank-bar"
                                                style={{ width: `${width}%` }}
                                            />
                                        </div>
                                        <span className="solve-rank-duration">
                                            {formatSubmitDuration(record.submitDurationMs)}
                                        </span>
                                        <span className="solve-rank-meta">
                                            total {formatDuration(record.durationMs)} · {record.language === 'python3' ? 'Python3' : 'Java'} · {formatSolvedAt(record.solvedAt)}
                                        </span>
                                    </div>
                                );
                            })}
                        </div>
                    ) : (
                        <div className="solve-stats-empty">
                            Submit an accepted solution to create your first solve record.
                        </div>
                    )}
                </>
            )}
        </section>
    );
};

export default SolveStatsPanel;
