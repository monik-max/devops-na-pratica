const { spawnSync } = require('node:child_process');
const { cpSync, mkdirSync, readdirSync } = require('node:fs');
const { join, resolve } = require('node:path');

const root = resolve(__dirname, '..');
const files = readdirSync(join(root, 'src'), { recursive: true });
for (const file of files.filter((name) => name.endsWith('.js'))) {
  const checked = spawnSync(process.execPath, ['--check', join(root, 'src', file)], { stdio: 'inherit' });
  if (checked.error) throw checked.error;
  if (checked.status !== 0) process.exit(checked.status || 1);
}

const artifact = join(root, 'dist');
mkdirSync(artifact, { recursive: true });
for (const name of ['src', 'package.json', 'package-lock.json']) {
  cpSync(join(root, name), join(artifact, name), { recursive: true });
}
console.log('Aplicação empacotada em app/dist.');
