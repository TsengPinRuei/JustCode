/**
 * Result Panel \u2014 Displays code execution results: status (AC/WA/CE/RE/TLE),
 * pass counts, per-testcase details, and filtered debug console output.
 */
import { useMemo, type FC } from 'react';
import { ExecutionResult } from '../types';

interface ResultPanelProps {
    executing: boolean;
    result: ExecutionResult | null;
}

const DEBUG_SECTION_SPLIT_REGEX = /\n\n(?=\[Testcase \d+\])/;
const DEBUG_SECTION_HEADER_REGEX = /^\[Testcase (\d+)\]/;
// Keep status text in one mapping so new backend statuses fail visibly during type-checking.
const STATUS_LABELS: Record<ExecutionResult['status'], string> = {
    AC: 'Accepted',
    WA: 'Wrong Answer',
    CE: 'Compile Error',
    RE: 'Runtime Error',
    TLE: 'Time Limit Exceeded',
};

const formatInputValue = (value: unknown): string => {
    // Testcase input is usually an object of named params; display one param per line for scanning.
    if (typeof value === 'object' && value !== null) {
        return Object.entries(value as Record<string, unknown>)
            .map(([key, entryValue]) => `${key} = ${JSON.stringify(entryValue)}`)
            .join('\n');
    }
    return JSON.stringify(value) ?? String(value);
};

const formatJsonValue = (value: unknown): string => JSON.stringify(value) ?? String(value);

const ResultPanel: FC<ResultPanelProps> = ({ executing, result }) => {
    const filteredDebugOutput = useMemo(() => {
        // Skip if no debug output or all tests passed.
        if (!result || result.status === 'AC' || !result.debugOutput || !result.testcaseResults) {
            return null;
        }

        // Match debug sections against the result rows that failed.
        const failingIndices = new Set(
            result.testcaseResults
                .filter(tc => tc.status !== 'Passed')
                .map(tc => tc.index)
        );

        if (failingIndices.size === 0) return null;

        // Debug output is labeled by the backend as "[Testcase n]"; split only at those labels.
        const filteredDebug = result.debugOutput
            .split(DEBUG_SECTION_SPLIT_REGEX)
            .filter(section => {
                const match = section.match(DEBUG_SECTION_HEADER_REGEX);
                if (!match) return false;
                const index = parseInt(match[1], 10);
                return failingIndices.has(index);
            })
            .join('\n\n');

        return filteredDebug.trim() ? filteredDebug : null;
    }, [result]);
    const formattedTestcaseResults = useMemo(() => {
        // Pre-format JSON once per result so render markup stays focused on layout.
        return result?.testcaseResults.map((testResult) => ({
            testResult,
            input: testResult.input !== undefined ? formatInputValue(testResult.input) : undefined,
            expected: testResult.expected !== undefined ? formatJsonValue(testResult.expected) : undefined,
            actual: testResult.actual !== undefined ? formatJsonValue(testResult.actual) : undefined,
        })) ?? [];
    }, [result]);

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
        <div className="result-panel">
            <div className={`result-summary ${statusClass}`}>
                <div className={`result-title ${statusClass}`}>
                    {STATUS_LABELS[result.status]}
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

            {/* Show debug output only for failing cases so successful noisy prints do not bury the signal. */}
            {filteredDebugOutput && (
                <div className="debug-output-section">
                    <div className="debug-output-header">
                        <span>Console Output</span>
                    </div>
                    <pre className="debug-output-content">{filteredDebugOutput}</pre>
                </div>
            )}

            {formattedTestcaseResults.length > 0 && (
                <div className="testcase-results">
                    {formattedTestcaseResults.map(({ testResult, input, expected, actual }) => (
                        <div key={testResult.index} className="testcase-result">
                            <div className="testcase-result-header">
                                <span className="testcase-index">Testcase {testResult.index}</span>
                                <span className={`testcase-status ${testResult.status.toLowerCase()}`}>
                                    {testResult.status}
                                </span>
                            </div>
                            <div className="testcase-result-details">
                                {input !== undefined && (
                                    <div className="testcase-result-row">
                                        <strong>Input:</strong>
                                        <pre className="testcase-result-value">{input}</pre>
                                    </div>
                                )}
                                {expected !== undefined && (
                                    <div className="testcase-result-row">
                                        <strong>Expected:</strong>
                                        <pre className="testcase-result-value">{expected}</pre>
                                    </div>
                                )}
                                {actual !== undefined && (
                                    <div className="testcase-result-row">
                                        <strong>Actual:</strong>
                                        <pre className="testcase-result-value">{actual}</pre>
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
