/**
 * Sandbox Runner - Executes judge commands through a constrained process boundary.
 * Docker mode provides the strongest isolation; local mode keeps compatibility while
 * removing shell execution and inherited secrets from the runtime path.
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

const dockerAvailability = new Map<string, Promise<boolean>>();

export class SandboxRunner {
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

            let stdout = '';
            let stderr = '';
            let settled = false;
            let timedOut = false;
            let outputExceeded = false;

            const finish = (exitCode: number) => {
                if (settled) return;
                settled = true;
                clearTimeout(timeout);
                resolve({
                    stdout,
                    stderr,
                    exitCode,
                    timedOut,
                    outputExceeded,
                });
            };

            const killChild = () => {
                try {
                    if (options.detached && child.pid && process.platform !== 'win32') {
                        process.kill(-child.pid, 'SIGKILL');
                    } else {
                        child.kill('SIGKILL');
                    }
                } catch {
                    // The process may have exited between timeout/output handling and kill.
                }
            };

            const appendOutput = (target: 'stdout' | 'stderr', chunk: Buffer) => {
                if (settled || outputExceeded) return;
                const text = chunk.toString('utf-8');
                if (target === 'stdout') {
                    stdout += text;
                } else {
                    stderr += text;
                }

                if (stdout.length + stderr.length > MAX_OUTPUT_LENGTH) {
                    outputExceeded = true;
                    stdout = stdout.slice(0, MAX_OUTPUT_LENGTH);
                    stderr = stderr.slice(0, MAX_OUTPUT_LENGTH);
                    stderr = `${stderr}\nOutput limit exceeded`;
                    killChild();
                }
            };

            const timeout = setTimeout(() => {
                timedOut = true;
                stderr = stderr || 'Time Limit Exceeded';
                options.onTimeout?.();
                killChild();
            }, options.timeoutMs);

            child.stdout?.on('data', (chunk: Buffer) => appendOutput('stdout', chunk));
            child.stderr?.on('data', (chunk: Buffer) => appendOutput('stderr', chunk));

            child.on('error', (error) => {
                stderr = error.message;
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
