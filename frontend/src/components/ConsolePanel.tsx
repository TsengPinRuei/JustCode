import { useState, type FC } from 'react';
import { Problem, ExecutionResult } from '../types';
import TestcaseTab from './TestcaseTab';
import ResultPanel from './ResultPanel';

interface ConsolePanelProps {
    problem: Problem;
    activeTab: 'testcase' | 'result';
    onTabChange: (tab: 'testcase' | 'result') => void;
    executionKind: 'run' | 'submit' | null;
    executionResult: ExecutionResult | null;
    onRun: (inputMode: 'visible' | 'custom', customInput?: string) => void;
    onSubmit: () => void;
}

const ConsolePanel: FC<ConsolePanelProps> = ({
    problem,
    activeTab,
    onTabChange,
    executionKind,
    executionResult,
    onRun,
    onSubmit,
}) => {
    // Keep input mode and custom text here so Run uses them from either console tab.
    const [inputMode, setInputMode] = useState<'visible' | 'custom'>('visible');
    const [customInput, setCustomInput] = useState('');

    return (
        <div className="console-container">
            <div className="console-tabs">
                <div className="console-tabs-left">
                    <button
                        className={`tab ${activeTab === 'testcase' ? 'active' : ''}`}
                        aria-pressed={activeTab === 'testcase'}
                        onClick={() => onTabChange('testcase')}
                    >
                        Testcase
                    </button>
                    <button
                        className={`tab ${activeTab === 'result' ? 'active' : ''}`}
                        aria-pressed={activeTab === 'result'}
                        onClick={() => onTabChange('result')}
                    >
                        Result
                    </button>
                </div>
                <div className="console-tabs-right">
                    <button
                        className="action-btn run-btn"
                        onClick={() => onRun(inputMode, customInput)}
                        disabled={executionKind !== null}
                    >
                        {executionKind === 'run' ? 'Running...' : 'Run'}
                    </button>
                    <button
                        className="action-btn submit-btn"
                        onClick={onSubmit}
                        disabled={executionKind !== null}
                    >
                        {executionKind === 'submit' ? 'Submitting...' : 'Submit'}
                    </button>
                </div>
            </div>
            <div className="console-content">
                {/* Keep TestcaseTab mounted so switching to Result preserves the selected case. */}
                <div hidden={activeTab !== 'testcase'}>
                    <TestcaseTab
                        problem={problem}
                        inputMode={inputMode}
                        customInput={customInput}
                        onInputModeChange={setInputMode}
                        onCustomInputChange={setCustomInput}
                    />
                </div>
                {activeTab === 'result' && (
                    <ResultPanel executing={executionKind !== null} result={executionResult} />
                )}
            </div>
        </div>
    );
};

export default ConsolePanel;
