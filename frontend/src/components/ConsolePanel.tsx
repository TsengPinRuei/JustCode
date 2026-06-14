/**
 * Console 面板：底部 panel，包含 Testcase/Result 分頁與 Run/Submit 按鈕。
 * 管理 testcase input view 與 execution result view 之間的切換。
 */
import { useState, type FC } from 'react';
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

const ConsolePanel: FC<ConsolePanelProps> = ({
    problem,
    activeTab,
    onTabChange,
    executing,
    executionResult,
    onRun,
    onSubmit,
}) => {
    // 選取的測試案例/自訂輸入模式放在這裡，因為 Run 會跨兩個分頁使用它。
    const [inputMode, setInputMode] = useState<'visible' | 'custom'>('visible');
    const [customInput, setCustomInput] = useState('');

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
                        onClick={() => onRun(inputMode, customInput)}
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
                    <TestcaseTab
                        problem={problem}
                        inputMode={inputMode}
                        customInput={customInput}
                        onInputModeChange={setInputMode}
                        onCustomInputChange={setCustomInput}
                    />
                ) : (
                    <ResultPanel executing={executing} result={executionResult} />
                )}
            </div>
        </div>
    );
};

export default ConsolePanel;
