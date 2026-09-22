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
    // This selection controls display only; Run executes all visible testcases.
    const [selectedTestcase, setSelectedTestcase] = useState(0);
    const selectedVisibleTestcase = problem.visibleTestcases[selectedTestcase];
    const selectedInputRows = useMemo(() => {
        if (!selectedVisibleTestcase) return [];
        return Object.entries(selectedVisibleTestcase.input).map(
            ([key, value]) => [key, JSON.stringify(value)] as const
        );
    }, [selectedVisibleTestcase]);
    const selectedExpectedOutput = useMemo(() => {
        // Expected output is display-only here; execution reads testcases from the backend files.
        return selectedVisibleTestcase ? JSON.stringify(selectedVisibleTestcase.output) : '';
    }, [selectedVisibleTestcase]);

    // Reset an out-of-range selection if the supplied visible testcase list shrinks.
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
                        // Seed an empty custom input from the first visible case to show the required JSON shape.
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
