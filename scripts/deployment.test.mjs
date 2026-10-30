import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, realpath, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, basename, join } from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

test('publishes only validated artifacts, preserves production history and rejects private files', async () => {
  const root = await mkdtemp(join(tmpdir(), 'taurus-deploy-test-'));
  try {
    const workspace = join(root, 'source');
    const remote = join(root, 'remote.git');
    const runner = join(root, 'runner');
    await mkdir(workspace);
    await mkdir(runner);
    const git = (...args) => execFileSync('git', args, { cwd: workspace, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }).trim();
    git('init', '--bare', remote);
    git('init', '--initial-branch=main');
    git('config', 'user.name', 'Deployment test');
    git('config', 'user.email', 'deployment@test.invalid');
    await writeFile(join(workspace, 'source.txt'), 'source remains untouched');
    git('add', 'source.txt');
    git('commit', '-m', 'Source');
    const sourceSha = git('rev-parse', 'HEAD');
    git('remote', 'add', 'origin', remote);
    git('push', 'origin', 'main');
    const artifact = join(workspace, 'dist');
    await mkdir(artifact);
    await writeFile(join(artifact, 'index.html'), '<h1>Ready</h1>');
    const env = { ...process.env, GITHUB_ACTIONS: 'true', GITHUB_REF: 'refs/heads/main', GITHUB_SHA: sourceSha, GITHUB_WORKSPACE: workspace, RUNNER_TEMP: runner, ARTIFACT_DIR: 'dist', GITHUB_STEP_SUMMARY: '' };
    const publish = () => spawnSync(process.execPath, [fileURLToPath(new URL('./publish-production.mjs', import.meta.url))], { env, cwd: workspace, encoding: 'utf8' });
    let result = publish();
    assert.equal(result.status, 0, result.stderr);
    const first = git('rev-parse', 'refs/remotes/origin/production');
    const names = git('ls-tree', '--name-only', first).split('\n');
    assert.deepEqual(names, ['deployment.json', 'index.html']);
    assert.equal(JSON.parse(git('show', `${first}:deployment.json`)).sourceSha, sourceSha);
    assert.equal(git('rev-parse', 'HEAD'), sourceSha);
    assert.equal(git('diff', '--cached'), '');
    await writeFile(join(artifact, 'index.html'), '<h1>Next revision</h1>');
    result = publish();
    assert.equal(result.status, 0, result.stderr);
    const second = git('rev-parse', 'refs/remotes/origin/production');
    assert.equal(git('rev-parse', `${second}^`), first);
    await writeFile(join(artifact, '.env'), 'PRIVATE_VALUE=test-only');
    result = publish();
    assert.notEqual(result.status, 0);
    assert.equal(git('rev-parse', 'refs/remotes/origin/production'), second);
  } finally {
    const target = await realpath(root);
    assert.equal(dirname(target), await realpath(tmpdir()));
    assert.ok(basename(target).startsWith('taurus-deploy-test-'));
    await rm(target, { recursive: true, force: true });
  }
});
