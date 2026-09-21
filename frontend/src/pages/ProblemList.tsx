/**
 * 題目列表頁：以表格顯示所有題目、狀態圖示、難度標籤、標籤與刪除動作。
 * 也包含 LeetCode 匯入 modal；內建題目（sort-array、add-two-integers）不可刪除。
 */
import { useEffect, useRef, useState, type FC } from 'react';
import { useNavigate } from 'react-router-dom';
import { getApiErrorMessage, problemsApi } from '../services/apiClient';
import { ProblemMetadata, ProblemProgress } from '../types';

/** 刪除 UI 會隱藏內建題目；後端仍會強制套用相同規則。 */
const PROTECTED_PROBLEMS = new Set(['sort-array', 'add-two-integers']);

const ProblemList: FC = () => {
    const [problems, setProblems] = useState<ProblemMetadata[]>([]);
    const [progress, setProgress] = useState<Record<string, ProblemProgress>>({});
    const [loading, setLoading] = useState(true);
    const [showImportModal, setShowImportModal] = useState(false);
    const [importUrl, setImportUrl] = useState('');
    const [importing, setImporting] = useState(false);
    const [importError, setImportError] = useState<string | null>(null);
    const [importSuccess, setImportSuccess] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [loadRevision, setLoadRevision] = useState(0);
    const [deleting, setDeleting] = useState<Set<string>>(() => new Set());
    const importBusyRef = useRef(false);
    const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const mountedRef = useRef(false);
    const navigate = useNavigate();

    useEffect(() => {
        mountedRef.current = true;
        const controller = new AbortController();
        setLoading(true);
        setError(null);
        const load = async () => {
            try {
                const [data, progressData] = await Promise.all([
                    problemsApi.getProblems(controller.signal),
                    problemsApi.getAllProgress(controller.signal),
                ]);
                if (controller.signal.aborted) return;
                setProblems(data);
                setProgress(progressData);
            } catch (loadError) {
                if (!controller.signal.aborted) {
                    setError(getApiErrorMessage(loadError, 'Failed to load problems.'));
                }
            } finally {
                if (!controller.signal.aborted) setLoading(false);
            }
        };
        void load();
        return () => {
            mountedRef.current = false;
            controller.abort();
            if (closeTimerRef.current !== null) clearTimeout(closeTimerRef.current);
        };
    }, [loadRevision]);

    const closeImportModal = () => {
        if (importBusyRef.current) return;
        if (closeTimerRef.current !== null) clearTimeout(closeTimerRef.current);
        closeTimerRef.current = null;
        setShowImportModal(false);
    };

    const handleProblemClick = (problemId: string) => {
        navigate(`/problems/${problemId}`);
    };

    const handleImport = async () => {
        if (!importUrl.trim() || importBusyRef.current) return;
        importBusyRef.current = true;
        if (closeTimerRef.current !== null) clearTimeout(closeTimerRef.current);

        setImporting(true);
        setImportError(null);
        setImportSuccess(null);

        try {
            const result = await problemsApi.importProblem(importUrl.trim());
            if (!mountedRef.current) return;
            setImportSuccess(`Successfully imported: ${result.title}`);
            setImportUrl('');
            // 匯入後重新整理，因為後端會寫入新的題目目錄。
            const data = await problemsApi.getProblems();
            if (!mountedRef.current) return;
            setProblems(data);
            // 成功狀態短暫保留，讓使用者知道匯入已完成。
            closeTimerRef.current = setTimeout(() => {
                closeTimerRef.current = null;
                setShowImportModal(false);
                setImportSuccess(null);
            }, 2000);
        } catch (error: unknown) {
            if (mountedRef.current) setImportError(getApiErrorMessage(error, 'Failed to import problem'));
        } finally {
            importBusyRef.current = false;
            if (mountedRef.current) setImporting(false);
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !importing) {
            handleImport();
        }
        if (e.key === 'Escape') {
            closeImportModal();
        }
    };

    const handleDelete = async (e: React.MouseEvent, problemId: string, title: string) => {
        e.stopPropagation();
        if (deleting.has(problemId)) return;
        const confirmed = window.confirm(`Are you sure you want to delete "${title}"?`);
        if (!confirmed) return;
        setDeleting(previous => new Set(previous).add(problemId));
        setError(null);
        try {
            await problemsApi.deleteProblem(problemId);
            if (mountedRef.current) setProblems(prev => prev.filter(p => p.id !== problemId));
        } catch (error) {
            if (mountedRef.current) setError(getApiErrorMessage(error, 'Failed to delete problem.'));
        } finally {
            if (mountedRef.current) setDeleting(previous => {
                const next = new Set(previous);
                next.delete(problemId);
                return next;
            });
        }
    };

    if (loading) {
        return (
            <div className="loading">
                <div className="spinner"></div>
                <span>Loading problems...</span>
            </div>
        );
    }

    return (
        <div className="problem-list-container">
            <div className="problem-list-header-row">
                <h1 className="problem-list-header">Problems</h1>
                <button
                    className="import-btn"
                    onClick={() => {
                        if (closeTimerRef.current !== null) clearTimeout(closeTimerRef.current);
                        setShowImportModal(true);
                        setImportError(null);
                        setImportSuccess(null);
                    }}
                >
                    <span className="import-btn-icon">+</span>
                    Import from LeetCode
                </button>
            </div>

            {error && (
                <div className="error-message" role="alert">
                    {error}
                    <button type="button" onClick={() => setLoadRevision(value => value + 1)}>Reload</button>
                </div>
            )}
            <div className="problem-table">
                <table>
                    <thead>
                        <tr>
                            <th className="col-status">Status</th>
                            <th>Title</th>
                            <th className="col-difficulty">Difficulty</th>
                            <th className="col-tags">Tags</th>
                            <th className="col-actions">Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {problems.map((problem) => (
                            <tr key={problem.id} onClick={() => handleProblemClick(problem.id)}>
                                <td className="col-status">
                                    {progress[problem.id]?.status === 'solved' && (
                                        <span className="status-icon status-solved" title="Solved">✓</span>
                                    )}
                                    {progress[problem.id]?.status === 'attempted' && (
                                        <span className="status-icon status-attempted" title="Attempted">◐</span>
                                    )}
                                </td>
                                <td className="problem-title">{problem.title}</td>
                                <td className="problem-difficulty">
                                    <span className={`difficulty-badge difficulty-${problem.difficulty.toLowerCase()}`}>
                                        {problem.difficulty}
                                    </span>
                                </td>
                                <td className="problem-tags">
                                    {problem.tags.slice(0, 3).map((tag, index) => (
                                        <span key={index} className="tag">
                                            {tag}
                                        </span>
                                    ))}
                                </td>
                                <td className="problem-actions">
                                    {!PROTECTED_PROBLEMS.has(problem.id) && (
                                        <button
                                            className="delete-btn"
                                            title="Delete problem"
                                            disabled={deleting.has(problem.id)}
                                            onClick={(e) => handleDelete(e, problem.id, problem.title)}
                                        >
                                            <img src="/trash-icon.png" alt="Delete" className="delete-icon" />
                                        </button>
                                    )}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* 匯入對話框只會根據 LeetCode 可見 metadata/範例建立本機題目。 */}
            {showImportModal && (
                <div className="modal-overlay" onClick={closeImportModal}>
                    <div className="import-modal" onClick={(e) => e.stopPropagation()}>
                        <div className="import-modal-header">
                            <h2>Import from LeetCode</h2>
                            <button
                                className="modal-close-btn"
                                disabled={importing}
                                onClick={closeImportModal}
                            >
                                ×
                            </button>
                        </div>
                        <div className="import-modal-body">
                            <p className="import-modal-description">
                                Paste a LeetCode problem URL to import it into JustCode.
                            </p>
                            <div className="import-notice">
                                <span>The imported problems only include the visible information from the examples, not the hidden information from LeetCode.</span>
                            </div>
                            <div className="import-input-group">
                                <input
                                    type="text"
                                    className="import-url-input"
                                    placeholder="https://leetcode.com/problems/PROBLEM-NAME/"
                                    value={importUrl}
                                    onChange={(e) => setImportUrl(e.target.value)}
                                    onKeyDown={handleKeyDown}
                                    autoFocus
                                    disabled={importing}
                                />
                                <button
                                    className="import-submit-btn"
                                    onClick={handleImport}
                                    disabled={importing || !importUrl.trim()}
                                >
                                    {importing ? (
                                        <>
                                            <div className="import-spinner"></div>
                                            Importing...
                                        </>
                                    ) : (
                                        'Import'
                                    )}
                                </button>
                            </div>
                            {importError && (
                                <div className="import-feedback import-error">
                                    <span className="import-feedback-icon">✕</span>
                                    {importError}
                                </div>
                            )}
                            {importSuccess && (
                                <div className="import-feedback import-success">
                                    <span className="import-feedback-icon">✓</span>
                                    {importSuccess}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ProblemList;
