import assert from 'node:assert/strict';
import { setTimeout as delay } from 'node:timers/promises';
import { appendFile } from 'node:fs/promises';

const base = new URL(process.env.DEPLOYMENT_URL ?? '');
assert.equal(base.protocol, 'https:', 'Configure the DEPLOYMENT_URL repository variable with the public HTTPS origin.');
assert.ok(!base.username && !base.password && base.pathname === '/', 'DEPLOYMENT_URL must be an origin.');
const sourceSha = process.env.GITHUB_SHA;
assert.match(sourceSha ?? '', /^[a-f0-9]{40}$/);
const metadata = new URL(process.env.DEPLOYMENT_METADATA_PATH ?? '/deployment.json', base);
assert.equal(metadata.origin, base.origin);
const deadline = Date.now() + 15 * 60 * 1000;
while (Date.now() < deadline) {
  try {
    const url = new URL(metadata);
    url.searchParams.set('revision', sourceSha);
    const response = await fetch(url, { headers: { 'Cache-Control': 'no-cache' }, signal: AbortSignal.timeout(15000) });
    if (response.ok && (await response.json()).sourceSha === sourceSha) {
      const ready = await fetch(new URL('/api/ready', base), { signal: AbortSignal.timeout(15000) });
      if (ready.ok && (await ready.json()).ok === true) {
        console.log(`Production verified: ${base.origin} serves ${sourceSha} and the API is ready.`);
        if (process.env.GITHUB_STEP_SUMMARY)
          await appendFile(process.env.GITHUB_STEP_SUMMARY, `\nProduction verified: ${base.origin} — \`${sourceSha}\`.\n`);
        process.exit(0);
      }
    }
  } catch {}
  console.log('Waiting for the hosting provider to publish this revision…');
  await delay(20000);
}
throw new Error('The hosting provider did not publish this revision with a healthy API within 15 minutes.');
