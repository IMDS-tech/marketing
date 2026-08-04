import { readdir } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import path from 'node:path';

async function collect(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const target = path.join(dir, entry.name);
    if (entry.isDirectory()) files.push(...await collect(target));
    else if (entry.isFile() && target.endsWith('.js') && target !== 'scripts/check-syntax.js') files.push(target);
  }
  return files;
}

for (const root of ['src', 'test', 'scripts']) {
  for (const file of await collect(root)) {
    await new Promise((resolve, reject) => {
      const child = spawn(process.execPath, ['--check', file], { stdio: 'inherit' });
      child.on('error', reject);
      child.on('exit', code => code === 0 ? resolve() : reject(new Error(`Syntax check failed: ${file}`)));
    });
  }
}
