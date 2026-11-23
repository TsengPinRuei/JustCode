import { useEffect, useRef, useState, type FC } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import ModalDialog from '../components/ModalDialog';
import { getApiErrorMessage, problemsApi } from '../services/apiClient';
import { ProblemMetadata, ProblemProgress } from '../types';

// Hide deletion controls for bundled problems; the backend enforces the same protected IDs.
const PROTECTED_PROBLEMS = new Set(['sort-array', 'add-two-integers']);

const STATUS_LABELS = { none: 'Not started', attempted: 'Attempted', solved: 'Solved' };

const ProblemList: FC = () => {
    const [problems, setProblems] = useState<ProblemMetadata[]>([]);
    const [progress, setProgress] = useState<Record<string, ProblemProgress['status']>>({});
    const [loading, setLoading] = useState(true);
    const [showImportModal, setShowImportModal] = useState(false);
    const [importUrl, setImportUrl] = useState('');
    const [importing, setImporting] = useState(false);
    const [importError, setImportError] = useState<string | null>(null);
    const [importSuccess, setImportSuccess] = useState<string | null>(null);
    const [refreshError, setRefreshError] = useState<string | null>(null);
    const [refreshing, setRefreshing] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [loadRevision, setLoadRevision] = useState(0);
    const [deleting, setDeleting] = useState<Set<string>>(() => new Set());
    const importBusyRef = useRef(false);
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
                    problemsApi.getProblemStatuses(controller.signal),
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
        };
    }, [loadRevision]);

    const closeImportModal = () => {
        if (importBusyRef.current) return;
        setShowImportModal(false);
    };

    const handleProblemClick = (problemId: string) => {
        navigate(`/problems/${problemId}`);
    };

    const refreshProblems = async () => {
        setRefreshing(true);
        try {
            const data = await problemsApi.getProblems();
            if (mountedRef.current) {
                setProblems(data);
                setRefreshError(null);
            }
        } catch {
            if (mountedRef.current) setRefreshError('The problem was imported, but the list could not be refreshed.');
        } finally {
            if (mountedRef.current) setRefreshing(false);
        }
    };

    const handleImport = async () => {
        if (!importUrl.trim() || importBusyRef.current || refreshing) return;
        importBusyRef.current = true;
        setImporting(true);
        setImportError(null);
        setImportSuccess(null);
        setRefreshError(null);
        try {
            const result = await problemsApi.importProblem(importUrl.trim());
            if (!mountedRef.current) return;
            setImportSuccess(`Successfully imported: ${result.title}`);
            setImportUrl('');
        } catch (error: unknown) {
            if (mountedRef.current) setImportError(getApiErrorMessage(error, 'Failed to import problem'));
            return;
        } finally {
            importBusyRef.current = false;
            if (mountedRef.current) setImporting(false);
        }
        // Refresh is independently retryable and never repeats a successful POST.
        await refreshProblems();
    };

    const handleDelete = async (e: React.MouseEvent, problemId: string, title: string) => {
        e.stopPropagation();
        if (deleting.has(problemId)) return;
        const confirmed = window.confirm(`Delete "${title}" and its drafts and submission history?`);
        if (!confirmed) return;
        setDeleting(previous => new Set(previous).add(problemId));
        setError(null);
        try {
            await problemsApi.deleteProblem(problemId);
            if (mountedRef.current) {
                setProblems(prev => prev.filter(p => p.id !== problemId));
                setProgress(previous => {
                    const next = { ...previous };
                    delete next[problemId];
                    return next;
                });
            }
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

    const showActions = problems.some(problem => !PROTECTED_PROBLEMS.has(problem.id));
    return (
        <div className="problem-list-container">
            <div className="problem-list-header-row">
                <h1 className="problem-list-header">Problems</h1>
                <button
                    className="import-btn"
                    onClick={() => {
                        setShowImportModal(true);
                        setImportError(null);
                        setImportSuccess(null);
                        setRefreshError(null);
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
                {/* Explicit roles retain table navigation when narrow layouts display rows as cards. */}
                <table role="table" aria-label="Problems">
                    <thead role="rowgroup">
                        <tr role="row">
                            <th role="columnheader" scope="col" className="col-status">Status</th>
                            <th role="columnheader" scope="col">Title</th>
                            <th role="columnheader" scope="col" className="col-difficulty">Difficulty</th>
                            <th role="columnheader" scope="col" className="col-tags">Tags</th>
                            {showActions && <th role="columnheader" scope="col" className="col-actions">Actions</th>}
                        </tr>
                    </thead>
                    <tbody role="rowgroup">
                        {problems.map((problem) => (
                            <tr role="row" key={problem.id} onClick={() => handleProblemClick(problem.id)}>
                                <td role="cell" className="col-status" aria-label={STATUS_LABELS[progress[problem.id] ?? 'none']}>
                                    {progress[problem.id] === 'solved' && (
                                        <span aria-hidden="true" className="status-icon status-solved" title="Solved">✓</span>
                                    )}
                                    {progress[problem.id] === 'attempted' && (
                                        <span aria-hidden="true" className="status-icon status-attempted" title="Attempted">◐</span>
                                    )}
                                </td>
                                <td role="cell" className="problem-title"><Link to={`/problems/${problem.id}`} onClick={(event) => event.stopPropagation()}>{problem.title}</Link></td>
                                <td role="cell" className="problem-difficulty">
                                    <span className={`difficulty-badge difficulty-${problem.difficulty.toLowerCase()}`}>
                                        {problem.difficulty}
                                    </span>
                                </td>
                                <td role="cell" className="problem-tags">
                                    {problem.tags.slice(0, 3).map((tag, index) => (
                                        <span key={index} className="tag">
                                            {tag}
                                        </span>
                                    ))}
                                </td>
                                {showActions && (
                                    <td role="cell" className="problem-actions">
                                        {!PROTECTED_PROBLEMS.has(problem.id) && (
                                            <button
                                                className="delete-btn"
                                                title="Delete problem"
                                                aria-label={`Delete ${problem.title}`}
                                                disabled={deleting.has(problem.id)}
                                                onClick={(e) => handleDelete(e, problem.id, problem.title)}
                                            >
                                                <svg className="delete-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                                                    <path d="M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7M14 10v7" />
                                                </svg>
                                            </button>
                                        )}
                                    </td>
                                )}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {showImportModal && (
                <ModalDialog titleId="leetcode-import-title" busy={importing} onClose={closeImportModal}>
                        <div className="import-modal-header">
                            <h2 id="leetcode-import-title">Import from LeetCode</h2>
                            <button
                                className="modal-close-btn"
                                aria-label="Close import dialog"
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
                            <label className="field-label" htmlFor="leetcode-url">LeetCode problem URL</label>
                            <div className="import-input-group">
                                <input
                                    type="text"
                                    id="leetcode-url"
                                    className="import-url-input"
                                    placeholder="https://leetcode.com/problems/PROBLEM-NAME/"
                                    value={importUrl}
                                    onChange={(e) => setImportUrl(e.target.value)}
                                    onKeyDown={(event) => { if (event.key === 'Enter') void handleImport(); }}
                                    data-dialog-autofocus
                                    disabled={importing}
                                />
                                <button
                                    className="import-submit-btn"
                                    onClick={handleImport}
                                    disabled={importing || refreshing || !importUrl.trim()}
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
                                <div className="import-feedback import-error" role="alert">
                                    <span className="import-feedback-icon">✕</span>
                                    {importError}
                                </div>
                            )}
                            {importSuccess && (
                                <div className="import-feedback import-success" role="status">
                                    <span className="import-feedback-icon">✓</span>
                                    {importSuccess}
                                </div>
                            )}
                            {refreshError && (
                                <div className="import-feedback" role="status">
                                    {refreshError}
                                    <button type="button" className="editor-btn" disabled={refreshing} onClick={() => void refreshProblems()}>
                                        {refreshing ? 'Refreshing...' : 'Reload list'}
                                    </button>
                                </div>
                            )}
                        </div>
                </ModalDialog>
            )}
        </div>
    );
};

export default ProblemList;
