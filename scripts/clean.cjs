const { lstatSync, existsSync, rmSync } = require('node:fs');
const { resolve, join } = require('node:path');

const root = resolve(__dirname, '..');
const modules = ['node_modules', 'backend/node_modules', 'frontend/node_modules'];
const builds = ['backend/dist', 'frontend/dist', 'frontend/.vite',
    'backend/tsconfig.tsbuildinfo', 'frontend/tsconfig.tsbuildinfo', 'frontend/tsconfig.node.tsbuildinfo'];
const targets = { modules, build: builds, all: [...modules, ...builds, 'temp', 'backend/temp'] };
const mode = process.argv[2];
try {
    if (!Object.hasOwn(targets, mode) || process.argv.length !== 3) {
        throw new Error('Usage: node scripts/clean.cjs all|modules|build');
    }
    if (!existsSync(join(root, 'package.json'))) throw new Error('Project package.json is missing');
    // Validate every workspace before deleting anything. rm removes a target symlink
    // itself, but a symlink in its parent path would otherwise traverse outside root.
    for (const workspace of ['frontend', 'backend']) {
        const info = lstatSync(join(root, workspace));
        if (info.isSymbolicLink() || !info.isDirectory()) {
            throw new Error(`${workspace} must be a real directory, not a symlink`);
        }
    }
    for (const target of targets[mode]) {
        rmSync(join(root, target), { recursive: true, force: true });
    }
} catch (error) {
    console.error(`Cleanup refused or failed: ${error.message}`);
    process.exitCode = 1;
}
