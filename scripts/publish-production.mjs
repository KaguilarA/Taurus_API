import assert from 'node:assert/strict';
import { mkdtemp, readdir, writeFile, appendFile, realpath } from 'node:fs/promises';
import { resolve, join, relative, isAbsolute } from 'node:path';
import { execFileSync } from 'node:child_process';

// Only the deployment job receives contents:write. PRs never run this script.
assert.equal(process.env.GITHUB_ACTIONS, 'true', 'Run this publisher in GitHub Actions.');
assert.equal(process.env.GITHUB_REF, 'refs/heads/main', 'Only main can publish production.');
const sourceSha = process.env.GITHUB_SHA;
assert.match(sourceSha ?? '', /^[a-f0-9]{40}$/);
const workspace = await realpath(process.env.GITHUB_WORKSPACE);
const directory = await realpath(resolve(workspace, process.env.ARTIFACT_DIR ?? ''));
const within = relative(workspace, directory);
assert.ok(within && !within.startsWith('..') && !isAbsolute(within), 'Publish a built artifact inside the workspace.');
async function inspect(path) {
  for (const item of await readdir(path, { withFileTypes: true })) {
    assert.ok(!item.isSymbolicLink(), 'Artifacts cannot contain symlinks.');
    assert.ok(!['node_modules', '.git', '.local'].includes(item.name), 'Private/runtime directories cannot be published.');
    assert.ok(!item.name.startsWith('.env') || ['.env.example', '.env.production.example'].includes(item.name), 'Private environment files cannot be published.');
    assert.ok(!item.name.startsWith('.dev.vars') || item.name === '.dev.vars.example', 'Private worker variables cannot be published.');
    if (item.isDirectory()) await inspect(join(path, item.name));
  }
}
await inspect(directory);
await writeFile(join(directory, 'deployment.json'), JSON.stringify({ sourceSha, builtAt: new Date().toISOString() }) + '\n');
const git = (args, options = {}) => execFileSync('git', args, { cwd: workspace, encoding: 'utf8', ...options }).trim();
const branch = 'production';
const previous = git(['ls-remote', '--heads', 'origin', `refs/heads/${branch}`]).split(/\s/)[0];
if (previous) git(['fetch', '--no-tags', '--depth=1', 'origin', branch]);
const temp = await mkdtemp(join(process.env.RUNNER_TEMP, 'publish-index-'));
const env = {
  ...process.env,
  GIT_INDEX_FILE: join(temp, 'index'),
  GIT_AUTHOR_NAME: 'github-actions[bot]',
  GIT_AUTHOR_EMAIL: '41898282+github-actions[bot]@users.noreply.github.com',
  GIT_COMMITTER_NAME: 'github-actions[bot]',
  GIT_COMMITTER_EMAIL: '41898282+github-actions[bot]@users.noreply.github.com',
};
const artifactGit = (args, options = {}) => git([
  `--git-dir=${join(workspace, '.git')}`, `--work-tree=${directory}`, ...args,
], { cwd: directory, env, ...options });
artifactGit(['read-tree', '--empty']);
artifactGit(['add', '--force', '--all', '--', '.']);
const tree = artifactGit(['write-tree']);
const commit = artifactGit(['commit-tree', tree, ...(previous ? ['-p', previous] : [])], { input: `Deploy ${sourceSha}\n` });
// Parent is the remote production head; a concurrent change safely rejects this push.
git(['push', 'origin', `${commit}:refs/heads/${branch}`]);
console.log(`Published validated artifact for ${sourceSha} to ${branch}.`);
if (process.env.GITHUB_STEP_SUMMARY)
  await appendFile(process.env.GITHUB_STEP_SUMMARY, `Published source commit \`${sourceSha}\` to \`production\`.\n`);
