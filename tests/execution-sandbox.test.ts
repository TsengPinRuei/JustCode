import assert from 'node:assert/strict';
import { test } from 'node:test';
import { SandboxCommandOptions, SandboxCommandResult, SandboxRunner } from '../backend/src/services/sandboxRunner';
import { MAX_OUTPUT_LENGTH } from '../backend/src/constants';

type LocalRunner = {
    executeLocal(options: SandboxCommandOptions): Promise<SandboxCommandResult>;
};
// Call local execution directly so installed Docker images cannot change these process tests.
function execute(code: string, overrides: Partial<SandboxCommandOptions> = {}) {
    return (new SandboxRunner() as unknown as LocalRunner).executeLocal({
        command: process.execPath, args: ['-e', code], cwd: process.cwd(), timeoutMs: 1500, image: 'unused', ...overrides,
    });
}

test('sandbox preserves multi-byte UTF-8 split over stdout chunks', async () => {
    const result = await execute('process.stdout.write(Buffer.from([0xf0])); setTimeout(() => process.stdout.write(Buffer.from([0x9f,0x98,0x80])), 20)');
    assert.equal(result.exitCode, 0);
    assert.equal(result.stdout, '😀');
});

test('sandbox bounds combined output in bytes and stops noisy processes', async () => {
    const result = await execute(`process.stdout.write(Buffer.alloc(${MAX_OUTPUT_LENGTH + 1024}, 97)); setInterval(() => {}, 1000)`);
    assert.equal(result.outputExceeded, true);
    assert.equal(result.timedOut, false);
    assert.ok(Buffer.byteLength(result.stdout) <= MAX_OUTPUT_LENGTH);
    assert.equal(result.exitCode, 1);
});

test('closing stdin early does not raise an unhandled EPIPE', async () => {
    const result = await execute('process.exit(0)', { stdin: 'x'.repeat(2 * 1024 * 1024) });
    assert.equal(result.exitCode, 0);
});

test('signal termination is a failure and timeout is explicit', { skip: process.platform === 'win32' }, async () => {
    const signal = await execute('process.kill(process.pid, "SIGTERM")');
    assert.notEqual(signal.exitCode, 0);
    assert.equal(signal.timedOut, false);
    const timeout = await execute('setInterval(() => {}, 1000)', { timeoutMs: 50 });
    assert.equal(timeout.timedOut, true);
    assert.equal(timeout.exitCode, -1);
});

test('sandbox terminates descendants after the parent exits successfully', { skip: process.platform === 'win32' }, async () => {
    const result = await execute('const {spawn}=require("node:child_process"); const child=spawn(process.execPath,["-e","setInterval(()=>{},1000)"],{stdio:"ignore"}); console.log(child.pid); child.unref()');
    assert.equal(result.exitCode, 0);
    const pid = Number(result.stdout.trim());
    assert.ok(pid > 0);
    for (let attempt = 0; attempt < 50; attempt++) {
        try { process.kill(pid, 0); } catch (error) {
            assert.equal((error as NodeJS.ErrnoException).code, 'ESRCH');
            return;
        }
        await new Promise(resolve => setTimeout(resolve, 20));
    }
    // Avoid leaving a process behind even if the regression fails.
    try { process.kill(pid, 'SIGKILL'); } catch {}
    assert.fail('Descendant is still running after the parent exited');
});

test('Docker forwards stdin and awaits forced removal after output overflow', async () => {
    type DockerRunner = {
        executeDocker(options: SandboxCommandOptions): Promise<SandboxCommandResult>;
        runProcess(options: { command: string; args: string[]; stdin?: string }): Promise<Omit<SandboxCommandResult, 'sandboxMode'>>;
    };
    const runner = new SandboxRunner() as unknown as DockerRunner;
    const calls: { command: string; args: string[]; stdin?: string }[] = [];
    let removed = false;
    runner.runProcess = async options => {
        calls.push(options);
        if (options.args[0] === 'rm') {
            await new Promise(resolve => setTimeout(resolve, 5));
            removed = true;
        }
        return { stdout: '', stderr: '', exitCode: 1, timedOut: false, outputExceeded: true };
    };
    await runner.executeDocker({ command: 'python3', args: ['runner.py'], cwd: process.cwd(), timeoutMs: 1000, stdin: '{"a":1}', image: 'test-image' });
    assert.ok(calls[0].args.includes('--interactive'));
    assert.equal(calls[0].stdin, '{"a":1}');
    assert.deepEqual(calls[1].args.slice(0, 2), ['rm', '--force']);
    assert.equal(removed, true);
});
