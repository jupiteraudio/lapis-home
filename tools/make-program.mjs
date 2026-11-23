// Builds the stand-alone Lapis Bridge program for the computer it runs on, from download/lapis-bridge.cjs (the release bundle).
// Node's single-executable-application feature: needs Node 22 and npx postject. Used by .github/workflows/programs.yml.
//   node tools/make-program.mjs   → out/lapis-bridge-<os>-<arch>[.exe]
import { execFileSync } from 'node:child_process';
import { copyFileSync, mkdirSync, chmodSync, writeFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
const root = join(dirname(fileURLToPath(import.meta.url)), '..'),
  win = process.platform === 'win32',
  out = join(root, 'out');
mkdirSync(out, { recursive: true });
const run = (cmd, args, opts = {}) => {
  console.log('> ' + cmd + ' ' + args.join(' '));
  execFileSync(cmd, args, { cwd: root, stdio: 'inherit', ...opts });
};
writeFileSync(
  join(out, 'sea-config.json'),
  JSON.stringify({ main: join(root, 'download/lapis-bridge.cjs'), output: join(out, 'sea-prep.blob'), disableExperimentalSEAWarning: true })
);
run(process.execPath, ['--experimental-sea-config', join(out, 'sea-config.json')]);
if (!existsSync(join(out, 'sea-prep.blob'))) throw new Error('no blob');
const os = { win32: 'windows', darwin: 'macos', linux: 'linux' }[process.platform] || process.platform;
const exe = join(out, `lapis-bridge-${os}-${process.arch}${win ? '.exe' : ''}`);
copyFileSync(process.execPath, exe);
if (process.platform === 'darwin') run('codesign', ['--remove-signature', exe]);
const pj = [exe, 'NODE_SEA_BLOB', join(out, 'sea-prep.blob'), '--sentinel-fuse', 'NODE_SEA_FUSE_fce680ab2cc467b6e072b8b5df1996b2', ...(process.platform === 'darwin' ? ['--macho-segment-name', 'NODE_SEA'] : [])];
if (win) run('npx', ['--yes', 'postject@1.0.0-alpha.6', ...pj].map(a => `"${a}"`), { shell: true });
else run('npx', ['--yes', 'postject@1.0.0-alpha.6', ...pj]);
if (process.platform === 'darwin') run('codesign', ['--sign', '-', exe]);
if (!win) chmodSync(exe, 0o755);
run(exe, ['--port', '0', '--selftest'], { timeout: 60000 });
console.log('Built ' + exe);
