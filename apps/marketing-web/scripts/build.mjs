import { access, mkdir } from 'node:fs/promises';
import { constants } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const appRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const publicDir = path.join(appRoot, 'public');
const entryFile = path.join(publicDir, 'index.html');

await mkdir(publicDir, { recursive: true });
await access(entryFile, constants.R_OK);
console.log(`Static marketing web is ready: ${entryFile}`);
