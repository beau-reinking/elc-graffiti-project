import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { existsSync, readdirSync } from 'node:fs';
import path from 'node:path';

const root = fileURLToPath(new URL('..', import.meta.url));
const vite = path.join(root, 'node_modules/vite/bin/vite.js');
const config = path.join(root, 'vite.config.ts');
const apps = readdirSync(path.join(root, 'apps')).filter(name => existsSync(path.join(root, 'apps', name, 'index.html'))).sort();
const children = new Set();
function launch(command, app) {
  const port = ({ aggregator: 5173, 'blue-hour': 5174, 'red-room': 5175, lantern: 5176, 'signal-yard': 5177 })[app] ?? 5180 + apps.indexOf(app);
  const appRoot = path.join(root, 'apps', app);
  const common = ['--config', config];
  const args = command === 'sandbox'
    ? [root, ...common, '--mode', 'sandbox', '--host', 'localhost', '--port', '5173', '--strictPort']
    : command === 'build'
      ? ['build', appRoot, ...common, '--outDir', path.join(root, 'dist', app), '--emptyOutDir']
      : command === 'preview'
        ? ['preview', appRoot, ...common, '--outDir', path.join(root, 'dist', app), '--host', 'localhost', '--port', String(port - 1000), '--strictPort']
        : [appRoot, ...common, '--host', 'localhost', '--port', String(port), '--strictPort'];
  const child = spawn(process.execPath, [vite, ...args], { cwd: root, stdio: 'inherit' });
  children.add(child);
  return new Promise((resolve, reject) => {
    child.on('error', reject);
    child.on('exit', code => { children.delete(child); code === 0 ? resolve() : reject(new Error(`Vite exited with ${code}`)); });
  });
}
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => { for (const child of children) child.kill(signal); process.exit(0); });
const [command = 'dev', app = 'aggregator'] = process.argv.slice(2);
try {
  if (command === 'build-all') for (const name of apps) await launch('build', name);
  else if (command === 'dev-all') await Promise.all(apps.map(name => launch('dev', name)));
  else if (command === 'sandbox') await launch(command, app);
  else if (['dev', 'build', 'preview'].includes(command) && apps.includes(app)) await launch(command, app);
  else throw new Error(`Usage: node scripts/run.mjs dev|build|preview <${apps.join('|')}>; or sandbox|dev-all|build-all`);
} catch (error) {
  console.error(error.message);
  for (const child of children) child.kill();
  process.exitCode = 1;
}
