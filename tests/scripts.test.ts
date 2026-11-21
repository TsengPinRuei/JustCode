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
        await mkdir(join(project, 'data', 'backups'), { recursive: true });
        await writeFile(join(project, 'data', 'justcode.sqlite'), 'practice');
        await writeFile(join(project, 'data', 'backups', 'saved.sqlite'), 'backup');
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
        assert.equal(await readFile(join(project, 'data', 'justcode.sqlite'), 'utf8'), 'practice');
        assert.equal(await readFile(join(project, 'data', 'backups', 'saved.sqlite'), 'utf8'), 'backup');
    } finally {
        await rm(root, { recursive: true, force: true });
    }
});


test('all npm cleanup modes reject either symlinked workspace before removing files', async () => {
    const root = await mkdtemp(join(tmpdir(), 'justcode-npm-clean-'));
    try {
        for (const workspace of ['frontend', 'backend']) {
            for (const mode of ['all', 'modules', 'build']) {
                const project = join(root, `${workspace}-${mode}`);
                const external = join(root, `${workspace}-${mode}-external`);
                await mkdir(join(project, 'scripts'), { recursive: true });
                await mkdir(external);
                await copyFile(new URL('../scripts/clean.cjs', import.meta.url), join(project, 'scripts/clean.cjs'));
                await writeFile(join(project, 'package.json'), '{}');
                await mkdir(join(project, workspace === 'frontend' ? 'backend' : 'frontend'));
                await symlink(external, join(project, workspace), 'junction');
                await mkdir(join(project, 'node_modules'));
                await writeFile(join(project, 'node_modules', 'keep.txt'), 'untouched');
                for (const dir of ['dist', 'node_modules', 'temp']) {
                    await mkdir(join(external, dir));
                    await writeFile(join(external, dir, 'keep.txt'), 'external');
                }
                const result = spawnSync(process.execPath, ['scripts/clean.cjs', mode], { cwd: project, encoding: 'utf8' });
                assert.notEqual(result.status, 0);
                assert.match(result.stderr, /symlink/);
                assert.equal(await readFile(join(project, 'node_modules', 'keep.txt'), 'utf8'), 'untouched');
                for (const dir of ['dist', 'node_modules', 'temp']) {
                    assert.equal(await readFile(join(external, dir, 'keep.txt'), 'utf8'), 'external');
                }
            }
        }
    } finally { await rm(root, { recursive: true, force: true }); }
});

test('npm cleanup removes only the selected generated artifacts and unlinks target symlinks', async () => {
    const root = await mkdtemp(join(tmpdir(), 'justcode-npm-clean-normal-'));
    const modules = ['node_modules', 'backend/node_modules', 'frontend/node_modules'];
    const builds = ['backend/dist', 'frontend/dist', 'frontend/.vite'];
    const caches = ['backend/tsconfig.tsbuildinfo', 'frontend/tsconfig.tsbuildinfo', 'frontend/tsconfig.node.tsbuildinfo'];
    try {
        for (const mode of ['all', 'modules', 'build']) {
            const project = join(root, mode);
            const external = join(root, mode + '-external');
            await mkdir(join(project, 'scripts'), { recursive: true });
            await mkdir(join(project, 'problems'));
            await mkdir(join(project, 'data', 'backups'), { recursive: true });
            const preserved = ['package.json', 'package-lock.json', 'problems/progress.json', 'data/justcode.sqlite', 'data/backups/saved.sqlite'];
            await mkdir(external);
            await writeFile(join(external, 'keep.txt'), 'external');
            await copyFile(new URL('../scripts/clean.cjs', import.meta.url), join(project, 'scripts/clean.cjs'));
            for (const file of preserved) {
                await writeFile(join(project, file), '{"keep":true}');
            }
            for (const dir of [...modules, ...builds, 'temp', 'backend/temp']) {
                await mkdir(join(project, dir), { recursive: true });
            }
            for (const file of caches) await writeFile(join(project, file), 'build cache');
            await writeFile(join(project, 'frontend/source.ts'), 'source');
            await rm(join(project, 'frontend/dist'), { recursive: true });
            await symlink(external, join(project, 'frontend/dist'), 'junction');
            execFileSync(process.execPath, ['scripts/clean.cjs', mode], { cwd: project });
            const removed = mode === 'modules' ? modules : mode === 'build' ? [...builds, ...caches] : [...modules, ...builds, ...caches, 'temp', 'backend/temp'];
            for (const file of removed) {
                await assert.rejects(readFile(join(project, file)), { code: 'ENOENT' });
            }
            for (const file of preserved) {
                assert.equal(await readFile(join(project, file), 'utf8'), '{"keep":true}');
            }
            assert.equal(await readFile(join(project, 'frontend/source.ts'), 'utf8'), 'source');
            assert.equal(await readFile(join(external, 'keep.txt'), 'utf8'), 'external');
        }
    } finally { await rm(root, { recursive: true, force: true }); }
});
