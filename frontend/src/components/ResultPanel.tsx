/**
 * 結果面板：顯示程式執行結果，包含狀態（AC/WA/CE/RE/TLE）、
     * 通過數、逐筆測試案例詳細資訊，以及篩選後的除錯 console output。
 */
import { useMemo, type FC } from 'react';
import { ExecutionResult } from '../types';

interface ResultPanelProps {
    executing: boolean;
    result: ExecutionResult | null;
}

const DEBUG_SECTION_SPLIT_REGEX = /\n\n(?=\[Testcase \d+\])/;
const DEBUG_SECTION_HEADER_REGEX = /^\[Testcase (\d+)\]/;
// 將狀態文字集中在同一個 mapping，讓新增後端狀態時能在型別檢查中明顯失敗。
const STATUS_LABELS: Record<ExecutionResult['status'], string> = {
    AC: 'Accepted',
    WA: 'Wrong Answer',
    CE: 'Compile Error',
    RE: 'Runtime Error',
    TLE: 'Time Limit Exceeded',
};

const formatInputValue = (value: unknown): string => {
    // 測試案例 input 通常是具名參數物件；每列顯示一個參數以便掃描。
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
        // 若沒有除錯輸出，或所有測試都通過，就略過。
        if (!result || result.status === 'AC' || !result.debugOutput || !result.testcaseResults) {
            return null;
        }

        // 將除錯區段對應到失敗的結果列。
        const failingIndices = new Set<number>();
        for (const tc of result.testcaseResults) {
            if (tc.status !== 'Passed') {
                failingIndices.add(tc.index);
            }
        }

        if (failingIndices.size === 0) return null;

        // 後端會以 "[Testcase n]" 標記除錯輸出；只在這些標籤處切分。
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
        // 每次 result 只預先格式化一次 JSON，讓 render markup 專注在版面。
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

            {/* 只顯示失敗案例的除錯輸出，避免成功案例的雜訊蓋掉重點。 */}
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
