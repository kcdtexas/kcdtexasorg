// Checks the built site before it ships: required files, Short Links,
// zero-data rules (no scripts, no inline styles, no third-party loads) and page weight.
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, extname } from 'node:path';
import { parse } from 'yaml';

const DIST = 'dist';
const HOME_BUDGET_KB = 300;
const failures = [];

for (const f of ['index.html', '404.html', '_redirects', '_headers', 'robots.txt', 'favicon.svg']) {
  if (!existsSync(join(DIST, f))) failures.push(`missing dist/${f}`);
}

// Every Short Link from the data file is served, and there is no catch-all.
const redirects = readFileSync(join(DIST, '_redirects'), 'utf8');
if (/^\/\*/m.test(redirects)) failures.push('_redirects contains a catch-all (/*)');
for (const { from, mode } of parse(readFileSync('src/data/short-links.yaml', 'utf8'))) {
  const served = new RegExp(`^${from}\\s`, 'm').test(redirects) || (mode === 'replaced-by-page' && existsSync(join(DIST, from, 'index.html')));
  if (!served) failures.push(`Short Link ${from} is not served`);
}

// Zero data: no scripts, no inline styles, nothing loaded from another host.
const walk = (dir) => readdirSync(dir).flatMap((n) => {
  const p = join(dir, n);
  return statSync(p).isDirectory() ? walk(p) : [p];
});
const htmlFiles = walk(DIST).filter((p) => extname(p) === '.html');
for (const file of htmlFiles) {
  const html = readFileSync(file, 'utf8');
  if (/<script\b/i.test(html)) failures.push(`${file}: contains a <script> (CSP allows none yet)`);
  if (/\sstyle="/i.test(html)) failures.push(`${file}: contains an inline style attribute`);
  // Plain <a href> links to other sites are fine; loading anything from them is not.
  for (const m of html.matchAll(/\s(?:src|srcset)="(https?:\/\/[^"]+)"/gi)) {
    failures.push(`${file}: loads a third-party resource: ${m[1]}`);
  }
  for (const m of html.matchAll(/<link[^>]+href="(https?:\/\/[^"]+)"[^>]*>/gi)) {
    if (!/rel="canonical"/.test(m[0])) failures.push(`${file}: <link> to another host: ${m[1]}`);
  }
}

// Page weight of the home page: HTML plus the CSS, fonts and images it references.
const home = readFileSync(join(DIST, 'index.html'), 'utf8');
const refs = [...home.matchAll(/(?:href|src|srcset)="(\/[^"#?]+)"/g)].map((m) => m[1]);
const assets = new Set(refs.filter((r) => /\.(css|woff2|svg|png|jpg|webp|avif)$/.test(r)));
let bytes = Buffer.byteLength(home);
for (const a of assets) {
  const p = join(DIST, a);
  if (existsSync(p)) bytes += statSync(p).size;
}
const kb = Math.round(bytes / 1024);
if (kb > HOME_BUDGET_KB) failures.push(`home page weighs ${kb} KB (budget ${HOME_BUDGET_KB} KB)`);

if (failures.length) {
  console.error('Build check failed:\n  ' + failures.join('\n  '));
  process.exit(1);
}
console.log(`Build check passed: ${htmlFiles.length} pages, home page ${kb} KB.`);
