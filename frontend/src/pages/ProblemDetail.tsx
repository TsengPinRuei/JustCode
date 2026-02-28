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

    // Progress tracking
    const progressRef = useRef<ProblemProgress | null>(null);
    const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    // Save progress to backend
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
            // Silently ignore save errors
        }
    }, [id]);

    // Debounced auto-save on code change
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

    // Cleanup timer on unmount
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
                // Restore saved progress
                progressRef.current = progress;
                const lang = progress.selectedLanguage || data.metadata.supportedLanguages[0] || 'java';
                setSelectedLanguage(lang);
                // Use saved code if available, otherwise fall back to template
                const savedCode = progress.code?.[lang];
                setCode(savedCode !== undefined ? savedCode : data.templates[lang]);
            } else {
                // First visit — use defaults
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

    // Handle code change from editor
    const handleCodeChange = (value: string) => {
        setCode(value);
        debouncedSave(value, selectedLanguage);
    };

    // Handle language change
    const handleLanguageChange = (newLanguage: Language) => {
        if (!problem) return;

        // Save current code into the progress map
        const currentProgress = progressRef.current;
        const codeMap = { ...(currentProgress?.code || {}) };
        codeMap[selectedLanguage] = code;

        // Determine target code: saved code or template
        const savedCode = codeMap[newLanguage];
        const newCode = savedCode !== undefined ? savedCode : problem.templates[newLanguage];

        // Warn only if current code is modified and target has no saved code (work could be lost)
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
                message: 'Failed to run code. Please check your connection and try again.',
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

            // If all tests passed, mark as solved
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
                message: 'Failed to submit code. Please check your connection and try again.',
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
