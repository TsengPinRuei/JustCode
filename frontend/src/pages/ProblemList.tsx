import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { problemsApi } from '../services/apiClient';
import { ProblemMetadata, ProblemProgress } from '../types';

const ProblemList: React.FC = () => {
    const [problems, setProblems] = useState<ProblemMetadata[]>([]);
    const [progress, setProgress] = useState<Record<string, ProblemProgress>>({});
    const [loading, setLoading] = useState(true);
    const [showImportModal, setShowImportModal] = useState(false);
    const [importUrl, setImportUrl] = useState('');
    const [importing, setImporting] = useState(false);
    const [importError, setImportError] = useState<string | null>(null);
    const [importSuccess, setImportSuccess] = useState<string | null>(null);
    const navigate = useNavigate();

    useEffect(() => {
        loadProblems();
    }, []);

    const loadProblems = async () => {
        try {
            const [data, progressData] = await Promise.all([
                problemsApi.getProblems(),
                problemsApi.getAllProgress(),
            ]);
            setProblems(data);
            setProgress(progressData);
        } catch (error) {
            // Error handled silently
        } finally {
            setLoading(false);
        }
    };

    const handleProblemClick = (problemId: string) => {
        navigate(`/problems/${problemId}`);
    };

    const handleImport = async () => {
        if (!importUrl.trim()) return;

        setImporting(true);
        setImportError(null);
        setImportSuccess(null);

        try {
            const result = await problemsApi.importProblem(importUrl.trim());
            setImportSuccess(`Successfully imported: ${result.title}`);
            setImportUrl('');
            // Refresh problem list
            const data = await problemsApi.getProblems();
            setProblems(data);
            // Auto-close after 2 seconds
            setTimeout(() => {
                setShowImportModal(false);
                setImportSuccess(null);
            }, 2000);
        } catch (error: unknown) {
            const axiosErr = error as any;
            const message = axiosErr?.response?.data?.error || axiosErr?.message || 'Failed to import problem';
            setImportError(message);
        } finally {
            setImporting(false);
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !importing) {
            handleImport();
        }
        if (e.key === 'Escape') {
            setShowImportModal(false);
        }
    };

    const handleDelete = async (e: React.MouseEvent, problemId: string, title: string) => {
        e.stopPropagation();
        const confirmed = window.confirm(`Are you sure you want to delete "${title}"?`);
        if (!confirmed) return;
        try {
            await problemsApi.deleteProblem(problemId);
            setProblems(prev => prev.filter(p => p.id !== problemId));
        } catch (error) {
            // Error handled silently
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
                        setShowImportModal(true);
                        setImportError(null);
                        setImportSuccess(null);
                    }}
                >
                    <span className="import-btn-icon">+</span>
                    Import from LeetCode
                </button>
            </div>

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
                                <td>
                                    <span className={`difficulty-badge difficulty-${problem.difficulty.toLowerCase()}`}>
                                        {problem.difficulty}
                                    </span>
                                </td>
                                <td>
                                    {problem.tags.slice(0, 3).map((tag, index) => (
                                        <span key={index} className="tag">
                                            {tag}
                                        </span>
                                    ))}
                                </td>
                                <td>
                                    {!['sort-array', 'add-two-integers'].includes(problem.id) && (
                                        <button
                                            className="delete-btn"
                                            title="Delete problem"
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

            {/* Import Modal */}
            {showImportModal && (
                <div className="modal-overlay" onClick={() => setShowImportModal(false)}>
                    <div className="import-modal" onClick={(e) => e.stopPropagation()}>
                        <div className="import-modal-header">
                            <h2>Import from LeetCode</h2>
                            <button
                                className="modal-close-btn"
                                onClick={() => setShowImportModal(false)}
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
