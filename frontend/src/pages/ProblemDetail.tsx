/**
 * 題目詳細頁：主要解題工作區，包含三個可調整大小的 panel：
 * 題目敘述（左）、程式碼編輯器（右上）與 console（右下）。
 * 透過 debounce auto-save 保存進度。
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
    const [progressSnapshot, setProgressSnapshot] = useState<ProblemProgress | null>(null);
    const [attemptStartedAt, setAttemptStartedAt] = useState(() => Date.now());
    const attemptStartedAtRef = useRef(attemptStartedAt);

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

    // 將最新儲存進度保存在 React render state 外，讓 debounce 後的儲存能讀到目前資料。
    const progressRef = useRef<ProblemProgress | null>(null);
    const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    // 寫入 progress.json 前，先將局部更新合併到最後已知的進度快照。
    const saveProgress = useCallback(async (updates: Partial<ProblemProgress>) => {
        if (!id) return;
        const current = progressRef.current || {
            status: 'none' as const,
            code: {},
            selectedLanguage: 'java' as Language,
            solveRecords: [],
            lastUpdated: '',
        };
        const updated: ProblemProgress = {
            ...current,
            ...updates,
            solveRecords: updates.solveRecords ?? current.solveRecords ?? [],
        };
        progressRef.current = updated;
        setProgressSnapshot(updated);
        try {
            await problemsApi.saveProgress(id, updated);
        } catch {
            // Auto-save 不應中斷作答；明確的 Run/Submit 失敗會另外顯示。
        }
    }, [id]);

    // 對編輯器變更做 debounce，避免每次按鍵都寫入 progress.json。
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

    // 離開題目詳細頁時清除尚未執行的 auto-save。
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
            const startedAt = Date.now();
            attemptStartedAtRef.current = startedAt;
            setAttemptStartedAt(startedAt);

            const fallbackLanguage = data.metadata.supportedLanguages[0] || 'java';
            const normalizedProgress: ProblemProgress | null = progress
                ? {
                    ...progress,
                    code: progress.code || {},
                    selectedLanguage: progress.selectedLanguage || fallbackLanguage,
                    solveRecords: progress.solveRecords || [],
                }
                : null;
            progressRef.current = normalizedProgress;
            setProgressSnapshot(normalizedProgress);

            if (normalizedProgress && normalizedProgress.status !== 'none') {
                // 等題目 metadata 與進度都可用後，才還原已儲存進度。
                const lang = normalizedProgress.selectedLanguage;
                setSelectedLanguage(lang);
                // 語言可能已被選取但尚無儲存程式碼；此時回退到 starter template。
                const savedCode = normalizedProgress.code?.[lang];
                setCode(savedCode !== undefined ? savedCode : data.templates[lang]);
            } else {
                // 第一次進入時使用題目的第一個支援語言與 template。
                setSelectedLanguage(fallbackLanguage);
                setCode(data.templates[fallbackLanguage]);
            }
        } catch (error) {
            console.error('Error loading problem:', error);
        } finally {
            setLoading(false);
        }
    };

    // 編輯器變更會立即更新本機 UI，並在背景保存。
    const handleCodeChange = (value: string) => {
        setCode(value);
        debouncedSave(value, selectedLanguage);
    };

    // 切換前先保留目前語言的 buffer，讓使用者能安全地在語言間切換。
    const handleLanguageChange = (newLanguage: Language) => {
        if (!problem) return;

        // 選取下一個語言前，先儲存目前可見的程式碼。
        const currentProgress = progressRef.current;
        const codeMap = { ...(currentProgress?.code || {}) };
        codeMap[selectedLanguage] = code;

        // 目標語言優先使用先前儲存的程式碼；否則顯示 starter template。
        const savedCode = codeMap[newLanguage];
        const newCode = savedCode !== undefined ? savedCode : problem.templates[newLanguage];

        // 只有切換會用 template 取代未儲存編輯時才警告。
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

        const submitStartedAt = Date.now();
        setExecuting(true);
        setActiveTab('result');
        try {
            const result = await problemsApi.submitCode(id, code, selectedLanguage);
            setExecutionResult(result);

            // 只有 Submit 可將題目標記為 solved，因為它包含隱藏測試案例。
            if (result.status === 'AC') {
                const currentProgress = progressRef.current;
                const codeMap = { ...(currentProgress?.code || {}) };
                codeMap[selectedLanguage] = code;
                const completedAt = Date.now();
                const solvedAt = new Date(completedAt).toISOString();
                const solveRecords = currentProgress?.solveRecords || [];
                // 為統計面板保存一筆不可變 AC 快照；程式碼仍按語言分開保存。
                const solveRecord = {
                    id: `${solvedAt}-${solveRecords.length + 1}`,
                    solvedAt,
                    durationMs: Math.max(1000, completedAt - attemptStartedAtRef.current),
                    submitDurationMs: Math.max(1, completedAt - submitStartedAt),
                    language: selectedLanguage,
                    passedTestcases: result.passedTestcases,
                    totalTestcases: result.totalTestcases,
                };
                saveProgress({
                    status: 'solved',
                    code: codeMap,
                    selectedLanguage,
                    solveRecords: [...solveRecords, solveRecord],
                });
                // 成功 submit 後，為此題下一次嘗試開啟新的計時視窗。
                attemptStartedAtRef.current = completedAt;
                setAttemptStartedAt(completedAt);
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
                left={
                    <ProblemDescription
                        problem={problem}
                        progress={progressSnapshot}
                        attemptStartedAt={attemptStartedAt}
                    />
                }
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
