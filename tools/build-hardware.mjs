// Builds hardware/index.html from hardware/status.json (the one place to record field-test results).
//   node tools/build-hardware.mjs
import { readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const d = JSON.parse(readFileSync(join(root, 'hardware/status.json'), 'utf8'));
const tpl = readFileSync(join(root, 'tools/hardware-template.html'), 'utf8');
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const LABEL = { confirmed: 'Confirmed on real hardware', partly: 'Partly confirmed', pretend: 'Pretend device only', none: 'Not supported' };
const rows = d.groups
  .map(
    g => `<h2>${esc(g.name)}</h2>
<table>
<thead><tr><th>Device</th><th>What Lapis does</th><th>Status</th></tr></thead>
<tbody>
${g.items
  .map(i => {
    if (!LABEL[i.status]) throw new Error('unknown status ' + i.status + ' for ' + i.family);
    const conf = (i.confirmed || [])
      .map(c => `<div class="small">✓ ${esc(c.model)} · ${esc(c.firmware)} · ${esc(c.date)} · ${esc(c.by)}${c.what ? ': ' + esc(c.what) : ''}</div>`)
      .join('');
    return `<tr><td><b>${esc(i.family)}</b><div class="small">${esc(i.protocol)}</div></td><td>${esc(i.does)}</td><td><span class="st st-${i.status}">${LABEL[i.status]}</span>${conf}</td></tr>`;
  })
  .join('\n')}
</tbody>
</table>`
  )
  .join('\n');
const n = d.groups.flatMap(g => g.items).filter(i => i.status === 'confirmed').length;
writeFileSync(
  join(root, 'hardware/index.html'),
  tpl.replace('{{TABLES}}', rows).replace(/{{UPDATED}}/g, esc(d.updated)).replace(/{{LAPIS}}/g, esc(d.lapis)).replace('{{CONFIRMED}}', String(n))
);
console.log('hardware/index.html: ' + d.groups.flatMap(g => g.items).length + ' families, ' + n + ' confirmed');
