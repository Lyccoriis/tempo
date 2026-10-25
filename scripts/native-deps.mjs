import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const pkgDir = path.join(root, 'node_modules', 'better-sqlite3');
const electronPkg = path.join(root, 'node_modules', 'electron', 'package.json');
if (!existsSync(pkgDir) || !existsSync(electronPkg)) process.exit(0);

const electron = JSON.parse(readFileSync(electronPkg, 'utf8')).version;
execFileSync(process.execPath, [path.join(root, 'node_modules', 'prebuild-install', 'bin.js'), '--runtime', 'electron', '--target', electron], {
  cwd: pkgDir,
  stdio: 'inherit',
});
console.log(`better-sqlite3 set up for Electron ${electron}`);
