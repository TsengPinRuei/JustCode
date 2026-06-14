/**
 * Hidden Testcase Modal - Imports AI-generated hidden testcase JSON for one problem.
 * The modal only collects text or a project-relative path; backend validation owns filesystem and JSON safety.
 */
import { useState, type ChangeEvent, type FC } from 'react';
import { problemsApi } from '../services/apiClient';
import type { HiddenTestcaseImportMode, Problem } from '../types';

interface HiddenTestcaseModalProps {
    problem: Problem;
    onClose: () => void;
}

type SourceMode = 'content' | 'projectPath';

const getErrorMessage = (error: unknown): string => {
    if (typeof error === 'object' && error !== null && 'response' in error) {
        const response = (error as { response?: { data?: { error?: string } } }).response;
        if (response?.data?.error) {
            return response.data.error;
        }
    }
    if (error instanceof Error && error.message) {
        return error.message;
    }
    return 'Failed to import hidden testcases';
};

const HiddenTestcaseModal: FC<HiddenTestcaseModalProps> = ({ problem, onClose }) => {
    const [mode, setMode] = useState<HiddenTestcaseImportMode>('append');
    const [sourceMode, setSourceMode] = useState<SourceMode>('content');
    const [content, setContent] = useState('');
    const [projectPath, setProjectPath] = useState('');
    const [importing, setImporting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);

    // Enable import only for the active source mode so stale textarea/path state is not submitted accidentally.
    const hasInput = sourceMode === 'content' ? content.trim().length > 0 : projectPath.trim().length > 0;

    const handleFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        event.target.value = '';
        if (!file) return;

        try {
            // Browser-picked files are read as text and sent through the same content path as pasted JSON.
            const text = await file.text();
            setSourceMode('content');
            setContent(text);
            setProjectPath('');
            setError(null);
            setSuccess(null);
        } catch {
            setError('Failed to read selected file');
        }
    };

    const handleImport = async () => {
        if (!hasInput) return;

        setImporting(true);
        setError(null);
        setSuccess(null);

        try {
            // Send only the chosen source field; the backend rejects missing, invalid, or escaping inputs.
            const result = await problemsApi.importHiddenTestcases(problem.metadata.id, {
                mode,
                sourceType: sourceMode,
                content: sourceMode === 'content' ? content : undefined,
                projectPath: sourceMode === 'projectPath' ? projectPath.trim() : undefined,
            });
            setSuccess(
                `Imported ${result.added} hidden testcase${result.added === 1 ? '' : 's'}. Total hidden: ${result.totalHidden}.`
            );
        } catch (importError) {
            setError(getErrorMessage(importError));
        } finally {
            setImporting(false);
        }
    };

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="import-modal hidden-test-modal" onClick={(event) => event.stopPropagation()}>
                <div className="import-modal-header">
                    <h2>Add Hidden Tests</h2>
                    <button type="button" className="modal-close-btn" onClick={onClose}>
                        ×
                    </button>
                </div>
                <div className="import-modal-body">
                    <p className="import-modal-description">
                        Paste AI-generated testcase JSON, choose a local JSON file, or read a JustCode project-relative path.
                    </p>

                    <div className="hidden-test-section">
                        <div className="hidden-test-section-label">Write mode</div>
                        <div className="hidden-test-segmented" role="group" aria-label="Hidden testcase write mode">
                            <button
                                type="button"
                                className={mode === 'append' ? 'active' : ''}
                                onClick={() => setMode('append')}
                            >
                                Append
                            </button>
                            <button
                                type="button"
                                className={mode === 'replace' ? 'active' : ''}
                                onClick={() => setMode('replace')}
                            >
                                Replace
                            </button>
                        </div>
                    </div>

                    <div className="hidden-test-section">
                        <div className="hidden-test-section-label">Source</div>
                        <div className="hidden-test-segmented" role="group" aria-label="Hidden testcase source">
                            <button
                                type="button"
                                className={sourceMode === 'content' ? 'active' : ''}
                                onClick={() => setSourceMode('content')}
                            >
                                Paste JSON
                            </button>
                            <button
                                type="button"
                                className={sourceMode === 'projectPath' ? 'active' : ''}
                                onClick={() => setSourceMode('projectPath')}
                            >
                                Project Path
                            </button>
                        </div>
                    </div>

                    {sourceMode === 'content' ? (
                        <div className="hidden-test-section">
                            <div className="hidden-test-file-row">
                                <label className="hidden-test-file-btn">
                                    Choose File
                                    <input type="file" accept=".json,application/json,text/plain" onChange={handleFileChange} />
                                </label>
                            </div>
                            <textarea
                                className="hidden-test-textarea"
                                value={content}
                                onChange={(event) => {
                                    setContent(event.target.value);
                                    setError(null);
                                    setSuccess(null);
                                }}
                                placeholder='[{"input":{"paramName":"value"},"output":"expected"}]'
                            />
                        </div>
                    ) : (
                        <div className="hidden-test-section">
                            <input
                                type="text"
                                className="hidden-test-path-input"
                                value={projectPath}
                                onChange={(event) => {
                                    setProjectPath(event.target.value);
                                    setError(null);
                                    setSuccess(null);
                                }}
                                placeholder="tmp/generated-hidden-tests.json"
                            />
                            <p className="hidden-test-help">
                                Path must be relative to the JustCode project and point to a JSON file inside this project.
                            </p>
                        </div>
                    )}

                    {error && (
                        <div className="import-feedback import-error">
                            <span className="import-feedback-icon">✕</span>
                            {error}
                        </div>
                    )}
                    {success && (
                        <div className="import-feedback import-success">
                            <span className="import-feedback-icon">✓</span>
                            {success}
                        </div>
                    )}

                    <div className="hidden-test-actions">
                        <button type="button" className="secondary-action-btn" onClick={onClose}>
                            Close
                        </button>
                        <button
                            type="button"
                            className="primary-action-btn"
                            disabled={importing || !hasInput}
                            onClick={handleImport}
                        >
                            {importing ? 'Importing...' : 'Import Hidden Tests'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default HiddenTestcaseModal;
