import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtemp, mkdir, copyFile, writeFile, readFile, symlink, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';

test('uninstall preserves sources and lockfiles and refuses symlinked workspaces', async () => {
    const root = await mkdtemp(join(tmpdir(), 'justcode-uninstall-'));
    try {
        const project = join(root, 'project');
        const external = join(root, 'external');
        await mkdir(project);
        await mkdir(external);
        await copyFile(new URL('../uninstall.sh', import.meta.url), join(project, 'uninstall.sh'));
        await writeFile(join(project, 'package.json'), '{}');
        await writeFile(join(project, 'package-lock.json'), '{"keep":true}');
        await mkdir(join(project, 'backend'));
        await symlink(external, join(project, 'frontend'));
        await mkdir(join(external, 'dist'));
        await writeFile(join(external, 'dist', 'keep.txt'), 'keep');
        const result = spawnSync('bash', ['uninstall.sh', '--yes'], { cwd: project, encoding: 'utf8' });
        assert.notEqual(result.status, 0);
        assert.equal(await readFile(join(external, 'dist', 'keep.txt'), 'utf8'), 'keep');
        await rm(join(project, 'frontend'));
        await mkdir(join(project, 'frontend'));
        await writeFile(join(project, 'frontend', 'source.ts'), 'keep');
        await mkdir(join(project, 'frontend', 'dist'));
        execFileSync('bash', ['uninstall.sh', '--yes'], { cwd: project });
        assert.equal(await readFile(join(project, 'package-lock.json'), 'utf8'), '{"keep":true}');
        assert.equal(await readFile(join(project, 'frontend', 'source.ts'), 'utf8'), 'keep');
    } finally {
        await rm(root, { recursive: true, force: true });
    }
});
