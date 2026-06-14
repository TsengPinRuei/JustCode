/**
 * Python Executor：在隔離的暫存 workspace 中執行 Python3 程式碼。
 * 產生 runner.py harness，處理 JSON I/O 與結果比對。
 * 語法錯誤會在第一次 interpreted run 中偵測，並以 CE 回報。
 */
import { promises as fs } from 'fs';
import * as path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { Testcase, TestcaseResult, CompilationError, ProblemMetadata } from '../types';
import { RESULT_SEPARATOR, TESTCASE_TIMEOUT_MS, PYTHON_SANDBOX_IMAGE } from '../constants';
import { SandboxRunner } from './sandboxRunner';

export class PythonExecutor {
    private readonly sandboxRunner = new SandboxRunner();

    /** 為每次執行建立專屬 workspace，避免使用者檔案在不同執行間衝突。 */
    private async createTempWorkspace(): Promise<string> {
        const tmpDir = path.join(process.cwd(), 'temp', uuidv4());
        await fs.mkdir(tmpDir, { recursive: true });
        return tmpDir;
    }

    private async cleanupWorkspace(workspaceDir: string): Promise<void> {
        try {
            await fs.rm(workspaceDir, { recursive: true, force: true });
        } catch (error) {
            console.error('Failed to cleanup workspace:', error);
        }
    }

    /** 透過 runner.py 執行單一測試案例，並將使用者日誌與 JSON 答案分離。 */
    private async runTestcase(
        workspaceDir: string,
        testcase: Testcase
    ): Promise<{ result: TestcaseResult; debugOutput: string }> {
        const startTime = Date.now();
        const inputJson = JSON.stringify(testcase.input);

        const result = await this.sandboxRunner.execute({
            command: 'python3',
            args: ['runner.py'],
            cwd: workspaceDir,
            timeoutMs: TESTCASE_TIMEOUT_MS,
            stdin: inputJson,
            image: PYTHON_SANDBOX_IMAGE,
            writableWorkspace: false,
        });
        const executionTime = Date.now() - startTime;

        // separator 前允許使用者 print 輸出；只有後綴會被解析為 JSON。
        let debugOutput = '';
        let jsonOutput = result.stdout;
        const separatorIndex = result.stdout.indexOf(RESULT_SEPARATOR);
        if (separatorIndex !== -1) {
            debugOutput = result.stdout.substring(0, separatorIndex).trim();
            jsonOutput = result.stdout.substring(separatorIndex + RESULT_SEPARATOR.length).trim();
        }

        // child_process timeout 旗標或經過時間邊界任一成立都視為 TLE。
        if (result.exitCode === -1 || executionTime >= TESTCASE_TIMEOUT_MS) {
            return {
                result: {
                    index: 0,
                    status: 'Timeout',
                    input: testcase.input,
                    expected: testcase.output,
                    executionTime,
                },
                debugOutput,
            };
        }

        // 執行期失敗會呈現 stderr，並略過 JSON 解析。
        if (result.exitCode !== 0) {
            return {
                result: {
                    index: 0,
                    status: 'Error',
                    input: testcase.input,
                    expected: testcase.output,
                    errorMessage: result.stderr || 'Runtime error',
                    executionTime,
                },
                debugOutput,
            };
        }

        // Runner 必須輸出 {"result": ...}；格式錯誤視為執行期類型錯誤。
        try {
            const parsed = JSON.parse(jsonOutput);
            const actual = parsed.result;

            // 預期值以 JSON 相容資料儲存，因此這裡使用結構化 stringify 比對即可。
            const isCorrect = this.compareOutputs(testcase.output, actual);

            return {
                result: {
                    index: 0,
                    status: isCorrect ? 'Passed' : 'Failed',
                    input: testcase.input,
                    expected: testcase.output,
                    actual,
                    executionTime,
                },
                debugOutput,
            };
        } catch (error) {
            return {
                result: {
                    index: 0,
                    status: 'Error',
                    input: testcase.input,
                    expected: testcase.output,
                    errorMessage: 'Failed to parse output: ' + result.stdout,
                    executionTime,
                },
                debugOutput,
            };
        }
    }

    /** 使用 JSON 序列化深度比對預期輸出與實際輸出。 */
    private compareOutputs(expected: unknown, actual: unknown): boolean {
        return JSON.stringify(expected) === JSON.stringify(actual);
    }

    /** 盡可能將 Python traceback 片段轉成編輯器標記。 */
    private parsePythonSyntaxErrors(stderr: string): CompilationError[] {
        const errors: CompilationError[] = [];
        // Python 錯誤格式：'  File "solution.py", line 3'，
        // 接著是類似 'SyntaxError: invalid syntax' 的訊息。
        const fileLineRegex = /File "(.+?)", line (\d+)/g;
        const errorMsgRegex = /(SyntaxError|IndentationError|NameError|TypeError):\s*(.+)/;
        // Traceback 可能包含多個 frame；每個 marker 使用第一個符合的診斷訊息。
        const errorMatch = stderr.match(errorMsgRegex);
        const message = errorMatch ? `${errorMatch[1]}: ${errorMatch[2]}` : 'Syntax error';

        let match;
        while ((match = fileLineRegex.exec(stderr)) !== null) {
            const [, file, lineStr] = match;
            const line = parseInt(lineStr, 10);

            errors.push({
                file: path.basename(file),
                line,
                column: 1,  // Python traceback 不一定提供穩定欄位。
                message: message.trim(),
                severity: 'error',
            });
        }

        return errors;
    }

    /** 主要入口：寫入使用者程式碼、執行所有測試案例，並彙整結果。 */
    async executeCode(
        userCode: string,
        testcases: Testcase[],
        showHiddenInputs: boolean = true,
        metadata?: ProblemMetadata,
        visibleTestcaseCount: number = testcases.length
    ): Promise<{
        status: 'AC' | 'WA' | 'CE' | 'RE' | 'TLE';
        message?: string;
        testcaseResults: TestcaseResult[];
        totalTestcases: number;
        passedTestcases: number;
        compilationErrors?: CompilationError[];
        debugOutput?: string;
    }> {
        const workspaceDir = await this.createTempWorkspace();
        const hiddenStartIndex = Math.max(0, Math.min(visibleTestcaseCount, testcases.length));

        try {
            // solution.py 是產生的 runner 會 import 的唯一使用者可控檔案。
            await fs.writeFile(path.join(workspaceDir, 'solution.py'), userCode);

            // runner.py 會將 metadata 定義的 params 接到使用者 LeetCode 風格 method。
            const runnerCode = this.getRunnerTemplate(metadata);
            await fs.writeFile(path.join(workspaceDir, 'runner.py'), runnerCode);

            // Python 在此沒有編譯階段；語法錯誤會在 runner.py import solution.py 時出現。

            // 依序執行以保持每個案例的除錯輸出有序且易於歸因。
            const results: TestcaseResult[] = [];
            const debugOutputs: string[] = [];
            let passed = 0;
            let firstFailure: TestcaseResult | null = null;
            let firstHiddenFailure: TestcaseResult | null = null;

            for (let i = 0; i < testcases.length; i++) {
                const { result, debugOutput } = await this.runTestcase(workspaceDir, testcases[i]);
                result.index = i + 1;

                // 因為不同案例的 stdout 稍後會合併，所以現在先加入測試案例標籤。
                if (debugOutput) {
                    debugOutputs.push(`[Testcase ${i + 1}]\n${debugOutput}`);
                }

                // 將 import-time 語法錯誤重新分類為 CE，讓編輯器可顯示 markers。
                if (i === 0 && result.status === 'Error' && result.errorMessage) {
                    // Python 透過 stderr traceback 回報語法/縮排錯誤。
                    if (result.errorMessage.includes('SyntaxError') ||
                        result.errorMessage.includes('IndentationError') ||
                        result.errorMessage.includes('File "solution.py"')) {
                        const compilationErrors = this.parsePythonSyntaxErrors(result.errorMessage);
                        return {
                            status: 'CE',
                            message: 'Compilation Error: ' + result.errorMessage.split('\n')[0],
                            testcaseResults: [],
                            totalTestcases: testcases.length,
                            passedTestcases: 0,
                            compilationErrors,
                        };
                    }
                }

                // Submit 時隱藏隱藏輸入，但仍計算每個隱藏案例通過/失敗。
                if (!showHiddenInputs && i >= hiddenStartIndex) {
                    // 通過的隱藏案例不加入可見結果列表。
                    if (result.status === 'Passed') {
                        passed++;
                    } else {
                        if (!firstFailure) {
                            firstFailure = result;
                        }
                        // 保留一個失敗的隱藏案例，讓使用者取得具體失敗訊號。
                        if (!firstHiddenFailure) {
                            firstHiddenFailure = result;
                        }
                    }
                } else {
                    // 可見案例可安全顯示輸入、預期值、實際值與計時。
                    results.push(result);
                    if (result.status === 'Passed') {
                        passed++;
                    } else if (!firstFailure) {
                        firstFailure = result;
                    }
                }
            }

            // 只揭露第一個隱藏失敗物件；呼叫端已決定是否允許顯示隱藏輸入。
            if (firstHiddenFailure && !showHiddenInputs) {
                results.push(firstHiddenFailure);
            }

            // 整體狀態依最早失敗決定，符合評測器風格回饋。
            let status: 'AC' | 'WA' | 'RE' | 'TLE' = 'AC';
            let message = '';

            if (passed === testcases.length) {
                status = 'AC';
                message = 'Accepted';
            } else if (firstFailure) {
                if (firstFailure.status === 'Timeout') {
                    status = 'TLE';
                    message = `Time Limit Exceeded on testcase ${firstFailure.index}`;
                } else if (firstFailure.status === 'Error') {
                    status = 'RE';
                    message = `Runtime Error on testcase ${firstFailure.index}: ${firstFailure.errorMessage}`;
                } else {
                    status = 'WA';
                    message = `Wrong Answer on testcase ${firstFailure.index}`;
                }
            }

            return {
                status,
                message,
                testcaseResults: results,
                totalTestcases: testcases.length,
                passedTestcases: passed,
                debugOutput: debugOutputs.length > 0 ? debugOutputs.join('\n\n') : undefined,
            };
        } finally {
            // 一律移除產生的原始檔、快取與測試案例輸入檔。
            await this.cleanupWorkspace(workspaceDir);
        }
    }

    /** 產生 runner.py 執行包裝，用來 import Solution 並呼叫 metadata 定義的方法。 */
    private getRunnerTemplate(metadata?: ProblemMetadata): string {
        if (!metadata?.functionName || !metadata?.params) {
            console.warn('Missing problem metadata (functionName/params); using hardcoded defaults');
        }
        const functionName = metadata?.functionName || 'sortArray';
        const params = metadata?.params || [{ name: 'nums', type: 'int[]' }];

        // 這些行會注入 runner.py，並假設測試案例輸入是 JSON 物件。
        const paramLines = params.map(p => `        ${p.name} = data['${p.name}']`).join('\n');
        const argsList = params.map(p => p.name).join(', ');

        return `import json
import sys
from solution import Solution

def main():
    try:
        # 讀取 TypeScript executor 寫入的 JSON 測試案例物件。
        input_json = sys.stdin.read().strip()
        data = json.loads(input_json)
        
        # 將 metadata 定義的欄位轉成方法參數。
${paramLines}
        
        # 呼叫使用者的 LeetCode 風格 solution 方法。
        solution = Solution()
        result = solution.${functionName}(${argsList})
        
        # 將使用者除錯輸出保留在此 marker 前方，讓 executor 可安全切分。
        print("===RESULT_JSON_START===")
        
        # 輸出單一 JSON 物件，讓 executor 可用結構化方式比對結果。
        output = {'result': result}
        print(json.dumps(output))
        
    except Exception as e:
        print(f"Error: {str(e)}", file=sys.stderr)
        sys.exit(1)

if __name__ == "__main__":
    main()
`;
    }
}
