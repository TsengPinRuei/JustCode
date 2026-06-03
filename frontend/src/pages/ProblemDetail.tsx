/**
 * Problem Detail Page \u2014 Main coding workspace with three resizable panels:
 * description (left), code editor (top-right), and console (bottom-right).
 * Handles progress persistence with debounced auto-save.
 */
import { useEffect, useState, useRef, useCallback, type FC } from 'react';
import { useParams } from 'react-router-dom';
import { problemsApi } from '../services/apiClient';
import { Problem, ExecutionResult, Language, ProblemProgress } from '../types';
import CodeEditor from '../components/CodeEditor';
import ProblemDescription from '../components/ProblemDescription';
import ConsolePanel from '../components/ConsolePanel';
import ResizableSplitPane from '../components/ResizableSplitPane';

const ProblemDetail: FC = () => {
    const { id } = useParams<{ id: string }>();
    const [problem, setProblem] = useState<Problem | null>(null);
    const [code, setCode] = useState<string>('');
    const [selectedLanguage, setSelectedLanguage] = useState<Language>('java');
    const [loading, setLoading] = useState(true);
    const [executing, setExecuting] = useState(false);
    const [executionResult, setExecutionResult] = useState<ExecutionResult | null>(null);
    const [activeTab, setActiveTab] = useState<'testcase' | 'result'>('testcase');

    const getErrorMessage = (error: unknown, fallback: string): string => {
        if (typeof error === 'object' && error !== null && 'response' in error) {
            const response = (error as { response?: { data?: { error?: string } } }).response;
            if (response?.data?.error) {
                return response.data.error;
            }
        }
        if (error instanceof Error && error.message) {
            return error.message;
        }
        return fallback;
    };

    // Keep the latest saved progress outside React render state so debounced saves read current data.
    const progressRef = useRef<ProblemProgress | null>(null);
    const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    // Merge partial updates with the last known progress snapshot before writing progress.json.
    const saveProgress = useCallback(async (updates: Partial<ProblemProgress>) => {
        if (!id) return;
        const current = progressRef.current || {
            status: 'none' as const,
            code: {},
            selectedLanguage: 'java' as Language,
            lastUpdated: '',
        };
        const updated: ProblemProgress = { ...current, ...updates };
        progressRef.current = updated;
        try {
            await problemsApi.saveProgress(id, updated);
        } catch {
            // Auto-save should not interrupt coding; explicit Run/Submit failures are shown separately.
        }
    }, [id]);

    // Debounce editor changes to avoid writing progress.json on every keystroke.
    const debouncedSave = useCallback((newCode: string, lang: Language) => {
        if (saveTimerRef.current) {
            clearTimeout(saveTimerRef.current);
        }
        saveTimerRef.current = setTimeout(() => {
            const currentProgress = progressRef.current;
            const codeMap = { ...(currentProgress?.code || {}) };
            codeMap[lang] = newCode;
            const newStatus = currentProgress?.status === 'solved' ? 'solved' : 'attempted';
            saveProgress({
                status: newStatus,
                code: codeMap,
                selectedLanguage: lang,
            });
        }, 1000);
    }, [saveProgress]);

    // Clear a pending auto-save when navigating away from the problem detail page.
    useEffect(() => {
        return () => {
            if (saveTimerRef.current) {
                clearTimeout(saveTimerRef.current);
            }
        };
    }, []);

    useEffect(() => {
        if (id) {
            loadProblem(id);
        }
    }, [id]);

    const loadProblem = async (problemId: string) => {
        try {
            const [data, progress] = await Promise.all([
                problemsApi.getProblem(problemId),
                problemsApi.getProgress(problemId),
            ]);
            setProblem(data);

            if (progress && progress.status !== 'none') {
                // Restore saved progress only after both problem metadata and progress are available.
                progressRef.current = progress;
                const lang = progress.selectedLanguage || data.metadata.supportedLanguages[0] || 'java';
                setSelectedLanguage(lang);
                // A language can be selected without saved code yet; fall back to its starter template.
                const savedCode = progress.code?.[lang];
                setCode(savedCode !== undefined ? savedCode : data.templates[lang]);
            } else {
                // First visit starts from the problem's first supported language and template.
                const initialLang = data.metadata.supportedLanguages[0] || 'java';
                setSelectedLanguage(initialLang);
                setCode(data.templates[initialLang]);
            }
        } catch (error) {
            console.error('Error loading problem:', error);
        } finally {
            setLoading(false);
        }
    };

    // Editor changes update local UI immediately and persist in the background.
    const handleCodeChange = (value: string) => {
        setCode(value);
        debouncedSave(value, selectedLanguage);
    };

    // Preserve the current language buffer before switching so users can move between languages safely.
    const handleLanguageChange = (newLanguage: Language) => {
        if (!problem) return;

        // Store the currently visible code before selecting the next language.
        const currentProgress = progressRef.current;
        const codeMap = { ...(currentProgress?.code || {}) };
        codeMap[selectedLanguage] = code;

        // Prefer previously saved code for the target language; otherwise show the starter template.
        const savedCode = codeMap[newLanguage];
        const newCode = savedCode !== undefined ? savedCode : problem.templates[newLanguage];

        // Warn only when the switch would replace unsaved edits with a template.
        const currentTemplate = problem.templates[selectedLanguage];
        if (code !== currentTemplate && code.trim() !== '' && savedCode === undefined) {
            const confirmSwitch = window.confirm(
                'Switching languages will reset your code. Are you sure?'
            );
            if (!confirmSwitch) return;
        }

        codeMap[newLanguage] = newCode;
        setSelectedLanguage(newLanguage);
        setCode(newCode);

        saveProgress({
            status: currentProgress?.status === 'solved' ? 'solved' : (currentProgress?.status || 'none'),
            code: codeMap,
            selectedLanguage: newLanguage,
        });
    };

    const handleRun = async (inputMode: 'visible' | 'custom', customInput?: string) => {
        if (!id) return;

        setExecuting(true);
        setActiveTab('result');
        try {
            const result = await problemsApi.runCode(id, code, selectedLanguage, inputMode, customInput);
            setExecutionResult(result);
        } catch (error) {
            console.error('Error running code:', error);
            setExecutionResult({
                status: 'RE',
                message: getErrorMessage(error, 'Failed to run code. Please check your connection and try again.'),
                testcaseResults: [],
                totalTestcases: 0,
                passedTestcases: 0,
            });
        } finally {
            setExecuting(false);
        }
    };

    const handleSubmit = async () => {
        if (!id) return;

        setExecuting(true);
        setActiveTab('result');
        try {
            const result = await problemsApi.submitCode(id, code, selectedLanguage);
            setExecutionResult(result);

            // Only Submit can mark a problem solved because it includes hidden testcases.
            if (result.status === 'AC') {
                const currentProgress = progressRef.current;
                const codeMap = { ...(currentProgress?.code || {}) };
                codeMap[selectedLanguage] = code;
                saveProgress({
                    status: 'solved',
                    code: codeMap,
                    selectedLanguage,
                });
            }
        } catch (error) {
            console.error('Error submitting code:', error);
            setExecutionResult({
                status: 'RE',
                message: getErrorMessage(error, 'Failed to submit code. Please check your connection and try again.'),
                testcaseResults: [],
                totalTestcases: 0,
                passedTestcases: 0,
            });
        } finally {
            setExecuting(false);
        }
    };

    const handleReset = () => {
        if (problem) {
            setCode(problem.templates[selectedLanguage]);
        }
    };

    if (loading) {
        return (
            <div className="loading">
                <div className="spinner"></div>
                <span>Loading problem...</span>
            </div>
        );
    }

    if (!problem) {
        return <div>Problem not found</div>;
    }

    return (
        <div className="problem-detail-container">
            <ResizableSplitPane
                direction="horizontal"
                minPrimarySizePx={450}
                minSecondarySizePx={450}
                left={<ProblemDescription problem={problem} />}
                right={
                    <ResizableSplitPane
                        direction="vertical"
                        defaultTopHeight={65}
                        top={
                            <div className="code-editor-section">
                                <CodeEditor
                                    code={code}
                                    onChange={handleCodeChange}
                                    onReset={handleReset}
                                    compilationErrors={executionResult?.compilationErrors}
                                    selectedLanguage={selectedLanguage}
                                    supportedLanguages={problem.metadata.supportedLanguages}
                                    onLanguageChange={handleLanguageChange}
                                />
                            </div>
                        }
                        bottom={
                            <ConsolePanel
                                problem={problem}
                                activeTab={activeTab}
                                onTabChange={setActiveTab}
                                executing={executing}
                                executionResult={executionResult}
                                onRun={handleRun}
                                onSubmit={handleSubmit}
                            />
                        }
                    />
                }
            />
        </div>
    );
};

export default ProblemDetail;
