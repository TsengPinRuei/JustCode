/**
 * The workspace is keyed by problem ID so editor, timers, and requests belong to
 * exactly one problem, including direct navigation between two detail routes.
 */
import { useEffect, useState, useRef, useCallback, lazy, Suspense, type FC } from 'react';
import { useParams } from 'react-router-dom';
import { getApiErrorMessage, problemsApi } from '../services/apiClient';
import { Problem, ExecutionResult, Language, ProblemProgress } from '../types';
import ProblemDescription from '../components/ProblemDescription';
import ConsolePanel from '../components/ConsolePanel';
import ResizableSplitPane from '../components/ResizableSplitPane';

const CodeEditor = lazy(() => import('../components/CodeEditor'));

const ProblemWorkspace: FC<{ id: string }> = ({ id }) => {
    const [problem, setProblem] = useState<Problem | null>(null);
    const [code, setCode] = useState('');
    const [selectedLanguage, setSelectedLanguage] = useState<Language>('java');
    const [loading, setLoading] = useState(true);
    const [loadError, setLoadError] = useState<string | null>(null);
    const [loadRevision, setLoadRevision] = useState(0);
    const [saveError, setSaveError] = useState<string | null>(null);
    const [executing, setExecuting] = useState(false);
    const [executionResult, setExecutionResult] = useState<ExecutionResult | null>(null);
    const [activeTab, setActiveTab] = useState<'testcase' | 'result'>('testcase');
    const [progressSnapshot, setProgressSnapshot] = useState<ProblemProgress | null>(null);
    const [attemptStartedAt, setAttemptStartedAt] = useState(() => Date.now());
    const attemptStartedAtRef = useRef(attemptStartedAt);
    const mountedRef = useRef(false);
    const progressRef = useRef<ProblemProgress | null>(null);
    const revisionRef = useRef(0);
    const savedRevisionRef = useRef(0);
    const requestedRevisionRef = useRef(0);
    const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const executionRef = useRef<AbortController | null>(null);

    const flushProgress = useCallback(async () => {
        if (saveTimerRef.current !== null) {
            clearTimeout(saveTimerRef.current);
            saveTimerRef.current = null;
        }
        const snapshot = progressRef.current;
        const revision = revisionRef.current;
        if (!snapshot || revision <= savedRevisionRef.current || revision === requestedRevisionRef.current) return;

        requestedRevisionRef.current = revision;
        if (mountedRef.current) setSaveError(null);
        try {
            await problemsApi.saveProgress(id, snapshot);
            savedRevisionRef.current = Math.max(savedRevisionRef.current, revision);
        } catch (error) {
            if (revision === requestedRevisionRef.current) {
                requestedRevisionRef.current = savedRevisionRef.current;
                if (mountedRef.current) {
                    setSaveError(getApiErrorMessage(error, 'Unable to save your changes. Please retry.'));
                }
            }
        }
    }, [id]);

    const updateProgress = (updates: Partial<ProblemProgress>, immediate = false) => {
        if (!progressRef.current) return;
        const next = { ...progressRef.current, ...updates };
        // Update the draft before debouncing I/O: language switches, Reset, and
        // accepted submissions must always merge with the newest editor text.
        progressRef.current = next;
        revisionRef.current += 1;
        setProgressSnapshot(next);
        if (saveTimerRef.current !== null) clearTimeout(saveTimerRef.current);
        if (immediate) {
            void flushProgress();
        } else {
            saveTimerRef.current = setTimeout(() => void flushProgress(), 1000);
        }
    };

    useEffect(() => {
        mountedRef.current = true;
        const warnUnsavedChanges = (event: BeforeUnloadEvent) => {
            if (revisionRef.current > savedRevisionRef.current) {
                void flushProgress();
                event.preventDefault();
                event.returnValue = '';
            }
        };
        window.addEventListener('beforeunload', warnUnsavedChanges);
        return () => {
            mountedRef.current = false;
            executionRef.current?.abort();
            window.removeEventListener('beforeunload', warnUnsavedChanges);
            // Route changes must flush the pending debounce, not discard it.
            void flushProgress();
        };
    }, [flushProgress]);

    useEffect(() => {
        const controller = new AbortController();
        setLoading(true);
        setLoadError(null);
        const load = async () => {
            try {
                const [data, progress] = await Promise.all([
                    problemsApi.getProblem(id, controller.signal),
                    problemsApi.getProgress(id, controller.signal),
                ]);
                if (controller.signal.aborted) return;
                const language = progress && data.metadata.supportedLanguages.includes(progress.selectedLanguage)
                    ? progress.selectedLanguage
                    : data.metadata.supportedLanguages[0] ?? 'java';
                const normalized: ProblemProgress = {
                    status: progress?.status ?? 'none',
                    code: progress?.code ?? {},
                    selectedLanguage: language,
                    solveRecords: progress?.solveRecords ?? [],
                    lastUpdated: progress?.lastUpdated ?? '',
                };
                progressRef.current = normalized;
                if (problemsApi.hasUnsavedProgress(id)) {
                    revisionRef.current += 1;
                    void flushProgress();
                }
                setProgressSnapshot(normalized);
                setProblem(data);
                setSelectedLanguage(language);
                setCode(normalized.code[language] ?? data.templates[language]);
                const startedAt = Date.now();
                attemptStartedAtRef.current = startedAt;
                setAttemptStartedAt(startedAt);
            } catch (error) {
                if (!controller.signal.aborted) {
                    setLoadError(getApiErrorMessage(error, 'Failed to load problem.'));
                }
            } finally {
                if (!controller.signal.aborted) setLoading(false);
            }
        };
        void load();
        return () => controller.abort();
    }, [id, loadRevision, flushProgress]);

    const handleCodeChange = (value: string) => {
        if (!progressRef.current) return;
        setCode(value);
        setExecutionResult(null);
        updateProgress({
            code: { ...progressRef.current.code, [selectedLanguage]: value },
            status: progressRef.current.status === 'solved' ? 'solved' : 'attempted',
        });
    };

    const handleLanguageChange = (language: Language) => {
        if (!problem || !progressRef.current || language === selectedLanguage) return;
        const codeMap = { ...progressRef.current.code, [selectedLanguage]: code };
        const nextCode = codeMap[language] ?? problem.templates[language];
        codeMap[language] = nextCode;
        setSelectedLanguage(language);
        setCode(nextCode);
        setExecutionResult(null);
        updateProgress({ code: codeMap, selectedLanguage: language }, true);
    };

    const execute = async (submit: boolean, inputMode: 'visible' | 'custom' = 'visible', customInput?: string) => {
        // A ref closes the interval before React disables the buttons.
        if (executionRef.current) return;
        const controller = new AbortController();
        executionRef.current = controller;
        const submittedCode = code;
        const submittedLanguage = selectedLanguage;
        const submitStartedAt = Date.now();
        const startedAt = attemptStartedAtRef.current;
        setExecuting(true);
        setExecutionResult(null);
        setActiveTab('result');
        void flushProgress();
        try {
            const result = submit
                ? await problemsApi.submitCode(id, submittedCode, submittedLanguage, controller.signal)
                : await problemsApi.runCode(id, submittedCode, submittedLanguage, inputMode, customInput, controller.signal);
            if (controller.signal.aborted) return;

            const current = progressRef.current;
            // Diagnostics belong to the executed buffer; edits made while the
            // request was running must not receive stale compiler markers.
            if (current?.selectedLanguage === submittedLanguage
                && (current.code[submittedLanguage] ?? problem?.templates[submittedLanguage]) === submittedCode) {
                setExecutionResult(result);
            }

            if (submit && result.status === 'AC' && current) {
                const completedAt = Date.now();
                const solvedAt = new Date(completedAt).toISOString();
                const records = current.solveRecords ?? [];
                updateProgress({
                    status: 'solved',
                    code: { ...current.code, [submittedLanguage]: current.code[submittedLanguage] ?? submittedCode },
                    solveRecords: [...records, {
                        id: `${solvedAt}-${records.length + 1}`,
                        solvedAt,
                        durationMs: Math.max(1000, completedAt - startedAt),
                        submitDurationMs: Math.max(1, completedAt - submitStartedAt),
                        language: submittedLanguage,
                        passedTestcases: result.passedTestcases,
                        totalTestcases: result.totalTestcases,
                    }],
                }, true);
                attemptStartedAtRef.current = completedAt;
                setAttemptStartedAt(completedAt);
            }
        } catch (error) {
            if (!controller.signal.aborted) {
                setExecutionResult({
                    status: 'RE',
                    message: getApiErrorMessage(error, `Failed to ${submit ? 'submit' : 'run'} code. Please try again.`),
                    testcaseResults: [],
                    totalTestcases: 0,
                    passedTestcases: 0,
                });
            }
        } finally {
            if (executionRef.current === controller) executionRef.current = null;
            if (!controller.signal.aborted) setExecuting(false);
        }
    };

    const handleReset = () => {
        if (!problem) return;
        handleCodeChange(problem.templates[selectedLanguage]);
        void flushProgress();
    };

    if (loading) {
        return <div className="loading"><div className="spinner" /><span>Loading problem...</span></div>;
    }
    if (loadError || !problem) {
        return <div className="error-message" role="alert">
            {loadError ?? 'Problem not found'}
            <button type="button" onClick={() => setLoadRevision(value => value + 1)}>Retry</button>
        </div>;
    }

    return (
        <div className="problem-detail-container">
            <ResizableSplitPane
                direction="horizontal"
                minPrimarySizePx={450}
                minSecondarySizePx={450}
                left={
                    <ProblemDescription problem={problem} progress={progressSnapshot} attemptStartedAt={attemptStartedAt} />
                }
                right={
                    <ResizableSplitPane
                        direction="vertical"
                        defaultTopHeight={65}
                        top={
                            <div className="code-editor-section">
                                {saveError && (
                                    <div className="error-message" role="alert">
                                        Changes have not been saved: {saveError}
                                        <button type="button" onClick={() => void flushProgress()}>Retry save</button>
                                    </div>
                                )}
                                <Suspense fallback={<div className="loading">Loading editor...</div>}>
                                    <CodeEditor
                                        code={code}
                                        onChange={handleCodeChange}
                                        onReset={handleReset}
                                        compilationErrors={executionResult?.compilationErrors}
                                        selectedLanguage={selectedLanguage}
                                        supportedLanguages={problem.metadata.supportedLanguages}
                                        onLanguageChange={handleLanguageChange}
                                    />
                                </Suspense>
                            </div>
                        }
                        bottom={
                            <ConsolePanel
                                problem={problem}
                                activeTab={activeTab}
                                onTabChange={setActiveTab}
                                executing={executing}
                                executionResult={executionResult}
                                onRun={(mode, input) => void execute(false, mode, input)}
                                onSubmit={() => void execute(true)}
                            />
                        }
                    />
                }
            />
        </div>
    );
};

const ProblemDetail: FC = () => {
    const { id } = useParams<{ id: string }>();
    return id ? <ProblemWorkspace key={id} id={id} /> : <div>Problem not found</div>;
};

export default ProblemDetail;
