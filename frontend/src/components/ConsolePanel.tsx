import React from 'react';
import { Problem, ExecutionResult } from '../types';
import TestcaseTab from './TestcaseTab';
import ResultPanel from './ResultPanel';

interface ConsolePanelProps {
    problem: Problem;
    activeTab: 'testcase' | 'result';
    onTabChange: (tab: 'testcase' | 'result') => void;
    executing: boolean;
    executionResult: ExecutionResult | null;
    onRun: (inputMode: 'visible' | 'custom', customInput?: string) => void;
    onSubmit: () => void;
}

const ConsolePanel: React.FC<ConsolePanelProps> = ({
    problem,
    activeTab,
    onTabChange,
    executing,
    executionResult,
    onRun,
    onSubmit,
}) => {
    return (
        <div className="console-container">
            <div className="console-tabs">
                <div className="console-tabs-left">
                    <button
                        className={`tab ${activeTab === 'testcase' ? 'active' : ''}`}
                        onClick={() => onTabChange('testcase')}
                    >
                        Testcase
                    </button>
                    <button
                        className={`tab ${activeTab === 'result' ? 'active' : ''}`}
                        onClick={() => onTabChange('result')}
                    >
                        Result
                    </button>
                </div>
                <div className="console-tabs-right">
                    <button
                        className="action-btn run-btn"
                        onClick={() => onRun('visible')}
                        disabled={executing}
                    >
                        {executing ? 'Running...' : 'Run'}
                    </button>
                    <button
                        className="action-btn submit-btn"
                        onClick={onSubmit}
                        disabled={executing}
                    >
                        {executing ? 'Submitting...' : 'Submit'}
                    </button>
                </div>
            </div>
            <div className="console-content">
                {activeTab === 'testcase' ? (
                    <TestcaseTab problem={problem} />
                ) : (
                    <ResultPanel executing={executing} result={executionResult} />
                )}
            </div>
        </div>
    );
};

export default ConsolePanel;
