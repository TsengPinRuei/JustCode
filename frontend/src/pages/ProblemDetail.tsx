import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { problemsApi } from '../services/apiClient';
import { Problem, ExecutionResult, Language } from '../types';
import CodeEditor from '../components/CodeEditor';
import ProblemDescription from '../components/ProblemDescription';
import ConsolePanel from '../components/ConsolePanel';
import ResizableSplitPane from '../components/ResizableSplitPane';

const ProblemDetail: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const [problem, setProblem] = useState<Problem | null>(null);
    const [code, setCode] = useState<string>('');
    const [selectedLanguage, setSelectedLanguage] = useState<Language>('java');
    const [loading, setLoading] = useState(true);
    const [executing, setExecuting] = useState(false);
    const [executionResult, setExecutionResult] = useState<ExecutionResult | null>(null);
    const [activeTab, setActiveTab] = useState<'testcase' | 'result'>('testcase');

    useEffect(() => {
        if (id) {
            loadProblem(id);
        }
    }, [id]);

    const loadProblem = async (problemId: string) => {
        try {
            const data = await problemsApi.getProblem(problemId);
            setProblem(data);
            // Set initial language (first supported language)
            const initialLang = data.metadata.supportedLanguages[0] || 'java';
            setSelectedLanguage(initialLang);
            setCode(data.templates[initialLang]);
        } catch (error) {
            // Error handled silently
        } finally {
            setLoading(false);
        }
    };

    // Handle language change
    const handleLanguageChange = (newLanguage: Language) => {
        if (!problem) return;

        // Check if code has been modified
        const currentTemplate = problem.templates[selectedLanguage];
        if (code !== currentTemplate && code.trim() !== '') {
            const confirmSwitch = window.confirm(
                'Switching languages will reset your code. Are you sure?'
            );
            if (!confirmSwitch) return;
        }

        setSelectedLanguage(newLanguage);
        setCode(problem.templates[newLanguage]);
    };

    const handleRun = async (inputMode: 'visible' | 'custom', customInput?: string) => {
        if (!id) return;

        setExecuting(true);
        setActiveTab('result');
        try {
            const result = await problemsApi.runCode(id, code, selectedLanguage, inputMode, customInput);
            setExecutionResult(result);
        } catch (error) {
            // Error handled silently
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
        } catch (error) {
            // Error handled silently
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
                                    onChange={setCode}
                                    onReset={handleReset}
                                    language={selectedLanguage}
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
