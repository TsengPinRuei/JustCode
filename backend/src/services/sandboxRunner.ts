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

// Public command contract used by language executors; args are passed to spawn/docker without a shell.
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

// Internal process runner options shared by Docker checks, Docker runs, and local fallback runs.
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

// Cache Docker image checks per process so each testcase does not probe the daemon again.
const dockerAvailability = new Map<string, Promise<boolean>>();

export class SandboxRunner {
    /** Choose Docker when explicitly requested or available in auto mode; otherwise use local fallback. */
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
        // Docker mode is considered ready only when both daemon and requested image are available locally.
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
        // Local mode is a compatibility fallback, not a full security sandbox.
        // It still avoids shell execution and strips inherited secrets from the child environment.
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
        // The container has no network, dropped capabilities, read-only root FS, and bounded CPU/memory/PIDs.
        // Only /workspace is mounted, and it is writable only for compile steps that need class/cache files.
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
                // child_process timeout kills docker CLI, but the named container may still need cleanup.
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
        // Whitelist environment variables so submitted code cannot read host credentials by inheritance.
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
        // Running as the host user prevents root-owned files in temp workspaces on Unix-like systems.
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
            // spawn(args) avoids shell interpolation; this matters because user code influences workspace contents.
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
                // Multiple events can fire after a forced kill; resolve exactly once.
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
                    // Detached Unix children get their own process group so runaway grandchildren are killed too.
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
                // Stop collecting and terminate once combined output crosses the project-wide cap.
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
                // The language executors map this sentinel exitCode to TLE.
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
