import React, { useState } from 'react';
import { Problem } from '../types';

interface TestcaseTabProps {
    problem: Problem;
}

const TestcaseTab: React.FC<TestcaseTabProps> = ({ problem }) => {
    const [selectedTestcase, setSelectedTestcase] = useState(0);
    const [inputMode, setInputMode] = useState<'visible' | 'custom'>('visible');
    const [customInput, setCustomInput] = useState('{"nums":[5,2,3,1]}');

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
                    onClick={() => setInputMode('custom')}
                >
                    Custom Input
                </button>
            </div>

            {inputMode === 'visible' ? (
                <div>
                    <div className="testcase-display">
                        <div className="testcase-label">Input:</div>
                        <div className="testcase-value">
                            nums = {JSON.stringify(problem.visibleTestcases[selectedTestcase].input.nums)}
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
                        placeholder='{"nums":[5,2,3,1]}'
                    />
                </div>
            )}
        </div>
    );
};

export default TestcaseTab;
