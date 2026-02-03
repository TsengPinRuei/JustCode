import React from 'react';
import { ExecutionResult } from '../types';

interface ResultPanelProps {
    executing: boolean;
    result: ExecutionResult | null;
}

const ResultPanel: React.FC<ResultPanelProps> = ({ executing, result }) => {
    if (executing) {
        return (
            <div className="loading">
                <div className="spinner"></div>
                <span>Executing code...</span>
            </div>
        );
    }

    if (!result) {
        return (
            <div className="result-empty-state">
                Click "Run" or "Submit" to see results
            </div>
        );
    }

    const statusClass = result.status.toLowerCase();

    return (
        <div>
            <div className={`result-summary ${statusClass}`}>
                <div className={`result-title ${statusClass}`}>
                    {result.status === 'AC' && 'Accepted'}
                    {result.status === 'WA' && 'Wrong Answer'}
                    {result.status === 'CE' && 'Compile Error'}
                    {result.status === 'RE' && 'Runtime Error'}
                    {result.status === 'TLE' && 'Time Limit Exceeded'}
                </div>
                <div className="result-message">
                    {result.message}
                </div>
                {result.totalTestcases > 0 && (
                    <div className="result-message result-message-spaced">
                        Passed: {result.passedTestcases} / {result.totalTestcases}
                    </div>
                )}
            </div>

            {result.status === 'CE' && (
                <div className="error-message">
                    {result.message}
                </div>
            )}

            {result.testcaseResults && result.testcaseResults.length > 0 && (
                <div className="testcase-results">
                    {result.testcaseResults.map((testResult) => (
                        <div key={testResult.index} className="testcase-result">
                            <div className="testcase-result-header">
                                <span className="testcase-index">Testcase {testResult.index}</span>
                                <span className={`testcase-status ${testResult.status.toLowerCase()}`}>
                                    {testResult.status}
                                </span>
                            </div>
                            <div className="testcase-result-details">
                                {testResult.input !== undefined && (
                                    <div>
                                        <strong>Input:</strong> nums = {
                                            typeof testResult.input === 'object' &&
                                                testResult.input !== null &&
                                                'nums' in testResult.input
                                                ? JSON.stringify((testResult.input as { nums: unknown }).nums)
                                                : JSON.stringify(testResult.input)
                                        }
                                    </div>
                                )}
                                {testResult.expected !== undefined && (
                                    <div>
                                        <strong>Expected:</strong> {JSON.stringify(testResult.expected)}
                                    </div>
                                )}
                                {testResult.actual !== undefined && (
                                    <div>
                                        <strong>Actual:</strong> {JSON.stringify(testResult.actual)}
                                    </div>
                                )}
                                {testResult.executionTime !== undefined && (
                                    <div>
                                        <strong>Time:</strong> {testResult.executionTime}ms
                                    </div>
                                )}
                                {testResult.errorMessage && (
                                    <div className="error-message result-message-spaced">
                                        {testResult.errorMessage}
                                    </div>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default ResultPanel;
