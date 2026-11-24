// Builds the stand-alone Lapis Bridge program for the computer it runs on, from download/lapis-bridge.cjs (the release bundle).
// Node's single-executable-application feature: needs Node 22 and npx postject. Used by .github/workflows/programs.yml.
//   node tools/make-program.mjs   → out/lapis-bridge-<os>-<arch>[.exe], and on macOS also out/lapis-bridge-macos-<arch>.zip (Lapis Bridge.app)
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

// macOS: wrap the program in "Lapis Bridge.app" and zip it with ditto. A bare program file loses its "can run" flag when a
// browser downloads it, and a double-click then opens it in TextEdit. In a zip the flag survives, and the app opens a
// Terminal window running the Bridge, so the person sees the pairing code and stops the Bridge by closing the window.
if (process.platform === 'darwin') {
  const version = (process.env.LAPIS_VERSION || '0.0.0').replace(/^v/, '');
  const app = join(out, 'Lapis Bridge.app'),
    macos = join(app, 'Contents', 'MacOS');
  mkdirSync(macos, { recursive: true });
  copyFileSync(exe, join(macos, 'lapis-bridge'));
  chmodSync(join(macos, 'lapis-bridge'), 0o755);
  writeFileSync(
    join(macos, 'Lapis Bridge'),
    [
      '#!/bin/sh',
      '# Starts the Lapis Bridge in a Terminal window: the window shows the pairing code; close it to stop the Bridge.',
      'HERE="$(cd "$(dirname "$0")" && pwd)"',
      '# once the person has allowed the app, clear the download flag on the program inside it too',
      'xattr -dr com.apple.quarantine "$HERE/../.." 2>/dev/null',
      'exec open -a Terminal "$HERE/lapis-bridge"',
      ''
    ].join('\n')
  );
  chmodSync(join(macos, 'Lapis Bridge'), 0o755);
  writeFileSync(
    join(app, 'Contents', 'Info.plist'),
    `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
<key>CFBundleName</key><string>Lapis Bridge</string>
<key>CFBundleDisplayName</key><string>Lapis Bridge</string>
<key>CFBundleIdentifier</key><string>org.jupiteraudio.lapis-bridge</string>
<key>CFBundleExecutable</key><string>Lapis Bridge</string>
<key>CFBundlePackageType</key><string>APPL</string>
<key>CFBundleShortVersionString</key><string>${version}</string>
<key>CFBundleVersion</key><string>${version}</string>
<key>LSMinimumSystemVersion</key><string>11.0</string>
<key>NSHumanReadableCopyright</key><string>Jupiter Audio, Den Haag</string>
</dict></plist>
`
  );
  run('codesign', ['--force', '--deep', '--sign', '-', app]);
  const zip = join(out, `lapis-bridge-macos-${process.arch}.zip`);
  run('ditto', ['-c', '-k', '--sequesterRsrc', '--keepParent', app, zip]);
  // prove the zip unpacks to a runnable program
  const check = join(out, 'zip-check');
  run('ditto', ['-x', '-k', zip, check]);
  run(join(check, 'Lapis Bridge.app', 'Contents', 'MacOS', 'lapis-bridge'), ['--port', '0', '--selftest'], { timeout: 60000 });
  console.log('Built ' + zip);
}
