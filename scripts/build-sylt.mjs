import { execFileSync } from 'node:child_process';
import { cp, readdir, readFile, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const sylt = path.join(root, 'sylt');
const output = path.join(root, 'dist-jive');

execFileSync(process.execPath, [
  'node_modules/vite/bin/vite.js', 'build', '--mode', 'standalone',
  '--outDir', output, '--emptyOutDir',
], { cwd: sylt, stdio: 'inherit' });
await cp(path.join(sylt, 'release'), output, { recursive: true });
for (const license of ['DMSANS-OFL.txt', 'MANROPE-OFL.txt']) {
  await cp(path.join(root, 'licenses', license), path.join(output, 'licenses', license));
}
const { version } = JSON.parse(await readFile(path.join(sylt, 'package.json'), 'utf8'));
await writeFile(path.join(output, 'release.json'), JSON.stringify({
  app: 'jive',
  version,
  commit: process.env.CF_PAGES_COMMIT_SHA ||
    execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim(),
}, null, 2));

let count = 0;
for (const entry of await readdir(output, { recursive: true, withFileTypes: true })) {
  if (!entry.isFile()) continue;
  count++;
  const file = path.join(entry.parentPath, entry.name);
  if ((await stat(file)).size > 25 * 1024 * 1024) {
    throw new Error(`Pages asset exceeds 25 MiB: ${entry.name}`);
  }
  if (entry.name.endsWith('.js') &&
      /\/api\/(session|clips)|127\.0\.0\.1:5178|messageHandlers\??\.gtWorkspace/.test(await readFile(file, 'utf8'))) {
    throw new Error(`Native dependency in Jive output: ${entry.name}`);
  }
}
if (count > 20000) throw new Error('Pages Free file-count limit exceeded.');
console.log(`Built standalone Jive: ${count} files in dist-jive.`);
