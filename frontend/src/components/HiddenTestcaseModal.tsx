import { useState, useEffect, useRef, type ChangeEvent, type FC } from 'react';
import { getApiErrorMessage, problemsApi } from '../services/apiClient';
import type { HiddenTestcaseImportMode, Problem } from '../types';
import ModalDialog from './ModalDialog';

interface HiddenTestcaseModalProps {
    problem: Problem;
    onClose: () => void;
}

type SourceMode = 'content' | 'projectPath';

// Collect pasted JSON, a browser-selected file, or a project-relative path.
// The backend validates the request structure and storage path, not answer correctness.
const HiddenTestcaseModal: FC<HiddenTestcaseModalProps> = ({ problem, onClose }) => {
    const [mode, setMode] = useState<HiddenTestcaseImportMode>('append');
    const [sourceMode, setSourceMode] = useState<SourceMode>('content');
    const [content, setContent] = useState('');
    const [projectPath, setProjectPath] = useState('');
    const [importing, setImporting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);
    const [reading, setReading] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const busyRef = useRef(false);
    const mountedRef = useRef(false);
    useEffect(() => {
        mountedRef.current = true;
        return () => { mountedRef.current = false; };
    }, []);
    const busy = importing || reading;
    const close = () => {
        if (!busyRef.current) onClose();
    };

    // Enable import only when the active source has input, ignoring the inactive field.
    const hasInput = sourceMode === 'content' ? content.trim().length > 0 : projectPath.trim().length > 0;

    const handleFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        event.target.value = '';
        if (!file || busyRef.current) return;
        // Reject oversized files before reading them into browser memory.
        // The API's 10 MiB limit includes the JSON wrapper and escaping, so smaller files can still be rejected.
        if (file.size > 10 * 1024 * 1024) {
            setError('The selected file exceeds the 10 MB limit.');
            return;
        }
        busyRef.current = true;
        setReading(true);

        try {
            // Send a browser-selected file as text through the same API field used for pasted JSON.
            const text = await file.text();
            if (!mountedRef.current) return;
            setSourceMode('content');
            setContent(text);
            setProjectPath('');
            setError(null);
            setSuccess(null);
        } catch {
            if (mountedRef.current) setError('Failed to read selected file');
        } finally {
            busyRef.current = false;
            if (mountedRef.current) setReading(false);
        }
    };

    const handleImport = async () => {
        if (!hasInput || busyRef.current) return;
        busyRef.current = true;

        setImporting(true);
        setError(null);
        setSuccess(null);

        try {
            // Send only the selected source field; the backend validates content and path containment.
            const result = await problemsApi.importHiddenTestcases(problem.metadata.id, {
                mode,
                sourceType: sourceMode,
                content: sourceMode === 'content' ? content : undefined,
                projectPath: sourceMode === 'projectPath' ? projectPath.trim() : undefined,
            });
            if (!mountedRef.current) return;
            setSuccess(
                `Imported ${result.added} hidden testcase${result.added === 1 ? '' : 's'}. Total hidden: ${result.totalHidden}.`
            );
        } catch (importError) {
            if (mountedRef.current) setError(getApiErrorMessage(importError, 'Failed to import hidden testcases'));
        } finally {
            busyRef.current = false;
            if (mountedRef.current) setImporting(false);
        }
    };

    return (
        <ModalDialog titleId="hidden-test-title" busy={busy} onClose={close} className="hidden-test-modal">
                <div className="import-modal-header">
                    <h2 id="hidden-test-title">Add Hidden Tests</h2>
                    <button type="button" className="modal-close-btn" aria-label="Close hidden tests dialog" onClick={close} disabled={busy}>
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
                                disabled={busy}
                                aria-pressed={mode === 'append'}
                                className={mode === 'append' ? 'active' : ''}
                                onClick={() => setMode('append')}
                            >
                                Append
                            </button>
                            <button
                                type="button"
                                disabled={busy}
                                aria-pressed={mode === 'replace'}
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
                                disabled={busy}
                                aria-pressed={sourceMode === 'content'}
                                className={sourceMode === 'content' ? 'active' : ''}
                                onClick={() => setSourceMode('content')}
                            >
                                Paste JSON
                            </button>
                            <button
                                type="button"
                                disabled={busy}
                                aria-pressed={sourceMode === 'projectPath'}
                                className={sourceMode === 'projectPath' ? 'active' : ''}
                                onClick={() => setSourceMode('projectPath')}
                            >
                                Project Path
                            </button>
                        </div>
                    </div>

                    <div className="hidden-test-section hidden-test-source-section">
                        <div
                            className={`hidden-test-source-pane ${sourceMode === 'content' ? 'active' : ''}`}
                            hidden={sourceMode !== 'content'}
                        >
                            <div className="hidden-test-source-pane-inner">
                                <div className="hidden-test-file-row">
                                    <button type="button" className="hidden-test-file-btn" disabled={busy} onClick={() => fileInputRef.current?.click()}>
                                        Choose File
                                    </button>
                                    <input ref={fileInputRef} type="file" hidden disabled={busy} accept=".json,application/json,text/plain" onChange={handleFileChange} aria-label="Hidden testcase file" />
                                </div>
                                <label className="field-label" htmlFor="hidden-test-json">Hidden testcase JSON</label>
                                <textarea
                                    id="hidden-test-json"
                                    className="hidden-test-textarea"
                                    disabled={busy}
                                    value={content}
                                    onChange={(event) => {
                                        setContent(event.target.value);
                                        setError(null);
                                        setSuccess(null);
                                    }}
                                    placeholder='[{"input":{"paramName":"value"},"output":"expected"}]'
                                />
                            </div>
                        </div>

                        <div
                            className={`hidden-test-source-pane ${sourceMode === 'projectPath' ? 'active' : ''}`}
                            hidden={sourceMode !== 'projectPath'}
                        >
                            <div className="hidden-test-source-pane-inner">
                                <label className="field-label" htmlFor="hidden-test-path">Project-relative JSON path</label>
                                <input
                                    id="hidden-test-path"
                                    type="text"
                                    className="hidden-test-path-input"
                                    disabled={busy}
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
                        </div>
                    </div>

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
                        <button
                            type="button"
                            className="primary-action-btn"
                            disabled={busy || !hasInput}
                            onClick={handleImport}
                        >
                            {importing ? 'Importing...' : 'Import Hidden Tests'}
                        </button>
                    </div>
                </div>
        </ModalDialog>
    );
};

export default HiddenTestcaseModal;
