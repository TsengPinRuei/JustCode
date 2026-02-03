import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { problemsApi } from '../services/apiClient';
import { Problem, ExecutionResult } from '../types';
import CodeEditor from '../components/CodeEditor';
import ProblemDescription from '../components/ProblemDescription';
import ConsolePanel from '../components/ConsolePanel';
import ResizableSplitPane from '../components/ResizableSplitPane';

const ProblemDetail: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const [problem, setProblem] = useState<Problem | null>(null);
    const [code, setCode] = useState<string>('');
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
            setCode(data.template);
        } catch (error) {
            // Error handled silently
        } finally {
            setLoading(false);
        }
    };

    const handleRun = async (inputMode: 'visible' | 'custom', customInput?: string) => {
        if (!id) return;

        setExecuting(true);
        setActiveTab('result');
        try {
            const result = await problemsApi.runCode(id, code, inputMode, customInput);
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
            const result = await problemsApi.submitCode(id, code);
            setExecutionResult(result);
        } catch (error) {
            // Error handled silently
        } finally {
            setExecuting(false);
        }
    };

    const handleReset = () => {
        if (problem) {
            setCode(problem.template);
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
                            <CodeEditor
                                code={code}
                                onChange={setCode}
                                onReset={handleReset}
                            />
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
