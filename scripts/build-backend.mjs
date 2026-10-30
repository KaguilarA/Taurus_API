import { cp, mkdir, mkdtemp, readdir, readFile, writeFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';

const root = resolve(import.meta.dirname, '..');
await mkdir(join(root, 'dist'), { recursive: true });
const output = await mkdtemp(join(root, 'dist/backend-'));
await mkdir(join(output, 'restaurant'));
for (const item of await readdir(join(root, 'restaurant'))) {
  if (item.endsWith('.js') && !item.endsWith('.test.js'))
    await cp(join(root, 'restaurant', item), join(output, 'restaurant', item));
}
await mkdir(join(output, 'models/business'), { recursive: true });
await cp(join(root, 'models/business/model.js'), join(output, 'models/business/model.js'));
for (const file of ['package.json', 'package-lock.json']) await cp(join(root, file), join(output, file));
const pkg = JSON.parse(await readFile(join(output, 'package.json'), 'utf8'));
pkg.scripts = { start: 'node restaurant/server.js', 'account:password': 'node restaurant/account-password.js' };
await writeFile(join(output, 'package.json'), JSON.stringify(pkg, null, 2) + '\n');
await writeFile(join(output, '.node-version'), '24\n');
console.log(`Backend artifact: ${output}`);
if (process.env.GITHUB_OUTPUT) {
  const { appendFile } = await import('node:fs/promises');
  await appendFile(process.env.GITHUB_OUTPUT, `directory=${output}\n`);
}
