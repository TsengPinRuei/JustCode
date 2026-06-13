/**
 * Solve Stats Panel - Shows current attempt timing and persisted AC history.
 * Solve records are ranked by submit runtime first, with total solve time as the tie-breaker.
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
    // Older progress files may not have submitDurationMs; keep them displayable without inventing data.
    if (durationMs === undefined) return '-';
    return `${Math.max(1, Math.round(durationMs))}ms`;
};

const getSubmitDuration = (record: SolveRecord): number => {
    // Missing submit timing sorts after timed records while still remaining visible in history.
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
    // Tie-breakers keep ranks deterministic when two submissions have the same measured runtime.
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
        // Derive leaderboard state from progress in one pass so UI state cannot drift from persisted history.
        const rankedRecords = rankRecords(records);
        const latestRecord = records.length > 0 ? records[records.length - 1] : null;
        let bestTotalRecord: SolveRecord | null = null;
        let maxSubmitDuration = 1;

        for (const record of records) {
            if (!bestTotalRecord || record.durationMs < bestTotalRecord.durationMs) {
                bestTotalRecord = record;
            }
            // Keep at least 1ms as the chart denominator so very fast/legacy records still render.
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
                                // Missing timings get a small placeholder bar instead of disappearing from the chart.
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
