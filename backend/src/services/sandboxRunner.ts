/**
 * Sandbox Runner：透過受限制的 process 邊界執行 judge 指令。
 * Docker 模式提供最強隔離；local 模式保持相容性，同時從執行路徑
 * 移除 shell 執行與繼承的 secrets。
 */
import { spawn } from 'child_process';
import * as path from 'path';
import { v4 as uuidv4 } from 'uuid';
import {
    DOCKER_SANDBOX_CPUS,
    DOCKER_SANDBOX_MEMORY,
    DOCKER_SANDBOX_PIDS_LIMIT,
    MAX_OUTPUT_LENGTH,
    SANDBOX_MODE,
} from '../constants';

type SandboxMode = 'auto' | 'docker' | 'local';

// 語言 executor 使用的公開指令合約；args 會不經 shell 直接傳給 spawn/docker。
export interface SandboxCommandOptions {
    command: string;
    args: string[];
    cwd: string;
    timeoutMs: number;
    stdin?: string;
    image: string;
    writableWorkspace?: boolean;
}

export interface SandboxCommandResult {
    stdout: string;
    stderr: string;
    exitCode: number;
    timedOut: boolean;
    outputExceeded: boolean;
    sandboxMode: 'docker' | 'local';
}

// Docker 檢查、Docker 執行與 local 備援執行共用的內部 process runner 選項。
interface ProcessRunOptions {
    command: string;
    args: string[];
    cwd?: string;
    timeoutMs: number;
    stdin?: string;
    env?: NodeJS.ProcessEnv;
    detached?: boolean;
    onTimeout?: () => void;
}

interface ProcessRunResult {
    stdout: string;
    stderr: string;
    exitCode: number;
    timedOut: boolean;
    outputExceeded: boolean;
}

// 每個 process 快取 Docker image 檢查，避免每個測試案例都再次探測 daemon。
const dockerAvailability = new Map<string, Promise<boolean>>();

export class SandboxRunner {
    /** 明確要求 Docker 或 auto 模式可用時選擇 Docker；否則使用 local 備援。 */
    async execute(options: SandboxCommandOptions): Promise<SandboxCommandResult> {
        const mode = this.normalizeMode(SANDBOX_MODE);
        if (mode === 'docker' || (mode === 'auto' && await this.isDockerImageReady(options.image))) {
            return this.executeDocker(options);
        }

        return this.executeLocal(options);
    }

    private normalizeMode(mode: string): SandboxMode {
        if (mode === 'docker' || mode === 'local' || mode === 'auto') {
            return mode;
        }
        return 'auto';
    }

    private async isDockerImageReady(image: string): Promise<boolean> {
        if (!dockerAvailability.has(image)) {
            dockerAvailability.set(image, this.checkDockerImage(image));
        }
        return dockerAvailability.get(image)!;
    }

    private async checkDockerImage(image: string): Promise<boolean> {
        // 只有 daemon 與指定 image 都在本機可用時，Docker 模式才視為就緒。
        const dockerVersion = await this.runProcess({
            command: 'docker',
            args: ['version', '--format', '{{.Server.Version}}'],
            timeoutMs: 3000,
        });
        if (dockerVersion.exitCode !== 0) {
            return false;
        }

        const imageInspect = await this.runProcess({
            command: 'docker',
            args: ['image', 'inspect', image],
            timeoutMs: 3000,
        });
        return imageInspect.exitCode === 0;
    }

    private async executeLocal(options: SandboxCommandOptions): Promise<SandboxCommandResult> {
        // Local 模式是相容性備援，不是完整安全 sandbox。
        // 它仍會避免 shell 執行，並移除 child environment 繼承的 secrets。
        const result = await this.runProcess({
            command: options.command,
            args: options.args,
            cwd: options.cwd,
            timeoutMs: options.timeoutMs,
            stdin: options.stdin,
            detached: process.platform !== 'win32',
            env: this.createLocalEnv(options.cwd),
        });

        return {
            ...result,
            sandboxMode: 'local',
        };
    }

    private async executeDocker(options: SandboxCommandOptions): Promise<SandboxCommandResult> {
        const containerName = `justcode-${uuidv4()}`;
        const workspaceMode = options.writableWorkspace ? 'rw' : 'ro';
        // Container 沒有網路、移除 capabilities、root FS 唯讀，並限制 CPU/memory/PIDs。
        // 只掛載 /workspace，且僅在需要 class/cache 檔案的編譯步驟可寫。
        const dockerArgs = [
            'run',
            '--rm',
            '--name',
            containerName,
            '--network',
            'none',
            '--cpus',
            DOCKER_SANDBOX_CPUS,
            '--memory',
            DOCKER_SANDBOX_MEMORY,
            '--memory-swap',
            DOCKER_SANDBOX_MEMORY,
            '--pids-limit',
            DOCKER_SANDBOX_PIDS_LIMIT,
            '--read-only',
            '--cap-drop',
            'ALL',
            '--security-opt',
            'no-new-privileges',
            '--tmpfs',
            '/tmp:rw,noexec,nosuid,size=64m',
            '-e',
            'HOME=/tmp',
            '-e',
            'TMPDIR=/tmp',
            '-e',
            'PYTHONDONTWRITEBYTECODE=1',
            '-e',
            'JAVA_TOOL_OPTIONS=-Djava.io.tmpdir=/tmp',
            ...this.getDockerUserArgs(),
            '-v',
            `${path.resolve(options.cwd)}:/workspace:${workspaceMode}`,
            '-w',
            '/workspace',
            options.image,
            options.command,
            ...options.args,
        ];

        const result = await this.runProcess({
            command: 'docker',
            args: dockerArgs,
            timeoutMs: options.timeoutMs,
            stdin: options.stdin,
            onTimeout: () => {
                // child_process timeout 會終止 docker CLI，但具名 container 可能仍需清理。
                void this.runProcess({
                    command: 'docker',
                    args: ['kill', containerName],
                    timeoutMs: 3000,
                });
            },
        });

        return {
            ...result,
            sandboxMode: 'docker',
        };
    }

    private createLocalEnv(workspaceDir: string): NodeJS.ProcessEnv {
        // 白名單化 environment variables，避免提交程式碼透過繼承讀到 host credentials。
        return {
            PATH: process.env.PATH || '',
            HOME: workspaceDir,
            TMPDIR: workspaceDir,
            TEMP: workspaceDir,
            TMP: workspaceDir,
            LANG: 'C.UTF-8',
            LC_ALL: 'C.UTF-8',
            PYTHONDONTWRITEBYTECODE: '1',
            JAVA_TOOL_OPTIONS: '-Djava.io.tmpdir=.',
        };
    }

    private getDockerUserArgs(): string[] {
        // 以 host user 執行，可避免 Unix-like 系統中的暫存 workspace 產生 root 擁有的檔案。
        if (process.platform === 'win32') {
            return [];
        }

        const uid = typeof process.getuid === 'function' ? process.getuid() : undefined;
        const gid = typeof process.getgid === 'function' ? process.getgid() : undefined;
        if (typeof uid !== 'number' || typeof gid !== 'number') {
            return [];
        }

        return ['--user', `${uid}:${gid}`];
    }

    private runProcess(options: ProcessRunOptions): Promise<ProcessRunResult> {
        return new Promise((resolve) => {
            // spawn(args) 可避免 shell 插值；使用者程式碼會影響 workspace 內容，因此這點很重要。
            const child = spawn(options.command, options.args, {
                cwd: options.cwd,
                env: options.env,
                detached: options.detached,
                stdio: ['pipe', 'pipe', 'pipe'],
            });

            let stdoutChunks: string[] = [];
            let stderrChunks: string[] = [];
            let stdoutLength = 0;
            let stderrLength = 0;
            let settled = false;
            let timedOut = false;
            let outputExceeded = false;

            const getStdout = () => stdoutChunks.join('');
            const getStderr = () => stderrChunks.join('');

            const setStdout = (value: string) => {
                stdoutChunks = [value];
                stdoutLength = value.length;
            };

            const setStderr = (value: string) => {
                stderrChunks = [value];
                stderrLength = value.length;
            };

            const finish = (exitCode: number) => {
                // 強制 kill 後可能觸發多個事件；只 resolve 一次。
                if (settled) return;
                settled = true;
                clearTimeout(timeout);
                resolve({
                    stdout: getStdout(),
                    stderr: getStderr(),
                    exitCode,
                    timedOut,
                    outputExceeded,
                });
            };

            const killChild = () => {
                try {
                    // Detached Unix child 會有自己的 process group，失控的孫行程也會一起被終止。
                    if (options.detached && child.pid && process.platform !== 'win32') {
                        process.kill(-child.pid, 'SIGKILL');
                    } else {
                        child.kill('SIGKILL');
                    }
                } catch {
                    // process 可能已在 timeout/output 處理與終止之間結束。
                }
            };

            const appendOutput = (target: 'stdout' | 'stderr', chunk: Buffer) => {
                // 合併輸出超過專案上限後，停止收集並終止 process。
                if (settled || outputExceeded) return;
                const text = chunk.toString('utf-8');
                if (target === 'stdout') {
                    stdoutChunks.push(text);
                    stdoutLength += text.length;
                } else {
                    stderrChunks.push(text);
                    stderrLength += text.length;
                }

                if (stdoutLength + stderrLength > MAX_OUTPUT_LENGTH) {
                    outputExceeded = true;
                    setStdout(getStdout().slice(0, MAX_OUTPUT_LENGTH));
                    setStderr(`${getStderr().slice(0, MAX_OUTPUT_LENGTH)}\nOutput limit exceeded`);
                    killChild();
                }
            };

            const timeout = setTimeout(() => {
                // 語言 executor 會將這個 sentinel exitCode 映射為 TLE。
                timedOut = true;
                if (stderrLength === 0) {
                    setStderr('Time Limit Exceeded');
                }
                options.onTimeout?.();
                killChild();
            }, options.timeoutMs);

            child.stdout?.on('data', (chunk: Buffer) => appendOutput('stdout', chunk));
            child.stderr?.on('data', (chunk: Buffer) => appendOutput('stderr', chunk));

            child.on('error', (error) => {
                setStderr(error.message);
                finish(1);
            });

            child.on('close', (code) => {
                finish(timedOut ? -1 : outputExceeded ? 1 : code ?? 0);
            });

            if (options.stdin !== undefined) {
                child.stdin?.write(options.stdin);
            }
            child.stdin?.end();
        });
    }
}
