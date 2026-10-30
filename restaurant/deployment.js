import { readFileSync } from 'node:fs';

export function deploymentInfo() {
  try {
    const { sourceSha } = JSON.parse(readFileSync(new URL('../deployment.json', import.meta.url), 'utf8'));
    return { sourceSha: /^[a-f0-9]{40}$/.test(sourceSha) ? sourceSha : null };
  } catch {
    return { sourceSha: null };
  }
}
