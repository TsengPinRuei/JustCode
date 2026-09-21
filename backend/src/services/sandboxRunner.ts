/**
 * Sandbox Runner：透過受限制的 process 邊界執行 judge 指令。
 * Docker 模式提供最強隔離；local 模式保持相容性，同時從執行路徑
 * 移除 shell 執行與繼承的 secrets。
 */
import { spawn } from 'child_process';
import * as path from 'path';
import { randomUUID } from 'crypto';
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
        throw new Error(`Invalid JUSTCODE_SANDBOX_MODE: ${mode}`);
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
        const containerName = `justcode-${randomUUID()}`;
        const workspaceMode = options.writableWorkspace ? 'rw' : 'ro';
        // Container 沒有網路、移除 capabilities、root FS 唯讀，並限制 CPU/memory/PIDs。
        // 只掛載 /workspace，且僅在需要 class/cache 檔案的編譯步驟可寫。
        const dockerArgs = [
            'run',
            '--rm',
            '--interactive',
            '--pull=never',
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
        });

        // Killing the CLI alone leaves the container running; await removal before
        // the executor deletes its bind-mounted workspace, including output-limit failures.
        if (result.exitCode !== 0 || result.timedOut || result.outputExceeded) {
            await this.runProcess({
                command: 'docker',
                args: ['rm', '--force', containerName],
                timeoutMs: 3000,
            });
        }

        return {
            ...result,
            sandboxMode: 'docker',
        };
    }

    private createLocalEnv(workspaceDir: string): NodeJS.ProcessEnv {
        // 白名單化 environment variables，避免提交程式碼透過繼承讀到 host credentials。
        return {
            PATH: process.env.PATH || '',
            ...(process.platform === 'win32' ? { SystemRoot: process.env.SystemRoot } : {}),
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
            const child = spawn(options.command, options.args, {
                cwd: options.cwd,
                env: options.env,
                detached: options.detached,
                stdio: ['pipe', 'pipe', 'pipe'],
            });
            const stdoutChunks: Buffer[] = [];
            const stderrChunks: Buffer[] = [];
            let outputBytes = 0;
            let settled = false;
            let timedOut = false;
            let outputExceeded = false;
            let processError = '';

            const killChild = () => {
                try {
                    // A separate Unix process group also owns descendants which outlive the parent.
                    if (options.detached && child.pid && process.platform !== 'win32') {
                        process.kill(-child.pid, 'SIGKILL');
                    } else {
                        child.kill('SIGKILL');
                    }
                } catch {
                    // The process may already have exited between receiving an event and killing it.
                }
            };
            const stop = () => {
                killChild();
                // An escaped descendant may keep inherited pipes open. Do not let it prevent
                // close/cleanup after the deadline; local mode is not a security boundary.
                child.stdin.destroy();
                child.stdout.destroy();
                child.stderr.destroy();
            };
            const finish = (exitCode: number) => {
                if (settled) return;
                settled = true;
                clearTimeout(timeout);
                // Decode once so multi-byte UTF-8 characters split across chunks stay intact.
                resolve({
                    stdout: Buffer.concat(stdoutChunks).toString('utf8'),
                    stderr: processError || (outputExceeded ? 'Output limit exceeded' : '') ||
                        Buffer.concat(stderrChunks).toString('utf8'),
                    exitCode,
                    timedOut,
                    outputExceeded,
                });
            };
            const appendOutput = (chunks: Buffer[], chunk: Buffer) => {
                if (settled || outputExceeded || timedOut) return;
                const remaining = MAX_OUTPUT_LENGTH - outputBytes;
                const kept = chunk.subarray(0, remaining);
                chunks.push(kept);
                outputBytes += kept.length;
                if (chunk.length > remaining) {
                    outputExceeded = true;
                    stop();
                }
            };
            const timeout = setTimeout(() => {
                timedOut = true;
                stop();
            }, options.timeoutMs);

            child.stdout.on('data', (chunk: Buffer) => appendOutput(stdoutChunks, chunk));
            child.stderr.on('data', (chunk: Buffer) => appendOutput(stderrChunks, chunk));
            // A solution can exit without reading its input. EPIPE must not crash the API process.
            child.stdin.on('error', (error: NodeJS.ErrnoException) => {
                if (error.code !== 'EPIPE' && error.code !== 'ERR_STREAM_DESTROYED') {
                    processError = error.message;
                    stop();
                }
            });
            child.on('error', (error) => {
                processError = error.message;
                finish(1);
            });
            child.on('exit', () => {
                if (options.detached) killChild();
            });
            child.on('close', (code) => {
                finish(timedOut ? -1 : outputExceeded || processError ? 1 : code ?? 1);
            });
            child.stdin.end(options.stdin);
        });
    }
}
