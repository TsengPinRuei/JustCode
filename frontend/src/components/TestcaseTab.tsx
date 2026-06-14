/**
 * Testcase 分頁：顯示可見測試案例 input，或自訂 JSON input textarea。
 * 使用者可在預設 case 與 custom input 模式之間切換。
 */
import { useEffect, useMemo, useState, type FC } from 'react';
import { Problem } from '../types';

interface TestcaseTabProps {
    problem: Problem;
    inputMode: 'visible' | 'custom';
    customInput: string;
    onInputModeChange: (mode: 'visible' | 'custom') => void;
    onCustomInputChange: (value: string) => void;
}

const TestcaseTab: FC<TestcaseTabProps> = ({
    problem,
    inputMode,
    customInput,
    onInputModeChange,
    onCustomInputChange,
}) => {
    const [selectedTestcase, setSelectedTestcase] = useState(0);
    const selectedVisibleTestcase = problem.visibleTestcases[selectedTestcase];
    const selectedInputRows = useMemo(() => {
        // 切換可見案例時，保持參數/值格式穩定。
        if (!selectedVisibleTestcase) return [];
        return Object.entries(selectedVisibleTestcase.input).map(
            ([key, value]) => [key, JSON.stringify(value)] as const
        );
    }, [selectedVisibleTestcase]);
    const selectedExpectedOutput = useMemo(() => {
        // 預期輸出在此分頁僅供顯示；執行時使用後端測試案例檔案。
        return selectedVisibleTestcase ? JSON.stringify(selectedVisibleTestcase.output) : '';
    }, [selectedVisibleTestcase]);

    // 匯入/新增題目時測試案例數量可能在分頁仍掛載時改變。
    useEffect(() => {
        if (selectedTestcase >= problem.visibleTestcases.length) {
            setSelectedTestcase(0);
        }
    }, [problem.visibleTestcases.length, selectedTestcase]);

    return (
        <div>
            <div className="testcase-selector">
                {problem.visibleTestcases.map((_, index) => (
                    <button
                        key={index}
                        className={`testcase-tab ${inputMode === 'visible' && selectedTestcase === index ? 'active' : ''}`}
                        onClick={() => {
                            setSelectedTestcase(index);
                            onInputModeChange('visible');
                        }}
                    >
                        Case {index + 1}
                    </button>
                ))}
                <button
                    className={`testcase-tab ${inputMode === 'custom' ? 'active' : ''}`}
                    onClick={() => {
                        // 用第一個可見測試案例預填自訂輸入，讓 JSON 形狀更明確。
                        if (!customInput && problem.visibleTestcases.length > 0) {
                            onCustomInputChange(JSON.stringify(problem.visibleTestcases[0].input, null, 2));
                        }
                        onInputModeChange('custom');
                    }}
                >
                    Custom Input
                </button>
            </div>

            {inputMode === 'visible' ? (
                selectedVisibleTestcase ? (
                    <div>
                        <div className="testcase-display">
                            <div className="testcase-label">Input:</div>
                            <div className="testcase-value">
                                {selectedInputRows.map(([key, value]) => (
                                    <div key={key}>{key} = {value}</div>
                                ))}
                            </div>
                        </div>
                        <div className="testcase-display">
                            <div className="testcase-label">Expected Output:</div>
                            <div className="testcase-value">
                                {selectedExpectedOutput}
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className="result-empty-state">No visible testcases available.</div>
                )
            ) : (
                <div>
                    <div className="testcase-label custom-input-label">
                        Enter your custom input (JSON format):
                    </div>
                    <textarea
                        className="custom-input-area"
                        value={customInput}
                        onChange={(e) => onCustomInputChange(e.target.value)}
                        placeholder='{"param1": value1, "param2": value2}'
                    />
                </div>
            )}
        </div>
    );
};

export default TestcaseTab;
