/**
 * Testcase Tab \u2014 Displays visible testcase inputs or a custom JSON input textarea.
 * Users can switch between predefined cases and custom input mode.
 */
import React, { useState } from 'react';
import { Problem } from '../types';

interface TestcaseTabProps {
    problem: Problem;
}

const TestcaseTab: React.FC<TestcaseTabProps> = ({ problem }) => {
    const [selectedTestcase, setSelectedTestcase] = useState(0);
    const [inputMode, setInputMode] = useState<'visible' | 'custom'>('visible');
    const [customInput, setCustomInput] = useState('');

    return (
        <div>
            <div className="testcase-selector">
                {problem.visibleTestcases.map((_, index) => (
                    <button
                        key={index}
                        className={`testcase-tab ${inputMode === 'visible' && selectedTestcase === index ? 'active' : ''}`}
                        onClick={() => {
                            setSelectedTestcase(index);
                            setInputMode('visible');
                        }}
                    >
                        Case {index + 1}
                    </button>
                ))}
                <button
                    className={`testcase-tab ${inputMode === 'custom' ? 'active' : ''}`}
                    onClick={() => {
                        // Pre-fill with first testcase input if empty
                        if (!customInput && problem.visibleTestcases.length > 0) {
                            setCustomInput(JSON.stringify(problem.visibleTestcases[0].input, null, 2));
                        }
                        setInputMode('custom');
                    }}
                >
                    Custom Input
                </button>
            </div>

            {inputMode === 'visible' ? (
                <div>
                    <div className="testcase-display">
                        <div className="testcase-label">Input:</div>
                        <div className="testcase-value">
                            {Object.entries(problem.visibleTestcases[selectedTestcase].input).map(
                                ([key, value]) => (
                                    <div key={key}>{key} = {JSON.stringify(value)}</div>
                                )
                            )}
                        </div>
                    </div>
                    <div className="testcase-display">
                        <div className="testcase-label">Expected Output:</div>
                        <div className="testcase-value">
                            {JSON.stringify(problem.visibleTestcases[selectedTestcase].output)}
                        </div>
                    </div>
                </div>
            ) : (
                <div>
                    <div className="testcase-label custom-input-label">
                        Enter your custom input (JSON format):
                    </div>
                    <textarea
                        className="custom-input-area"
                        value={customInput}
                        onChange={(e) => setCustomInput(e.target.value)}
                        placeholder='{"param1": value1, "param2": value2}'
                    />
                </div>
            )}
        </div>
    );
};

export default TestcaseTab;
