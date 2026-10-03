// Checks the built site before it ships: required files, Short Links,
// zero-data rules (only the same-origin theme script, no inline styles, no third-party loads) and page weight.
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, extname } from 'node:path';
import { parse } from 'yaml';

const DIST = 'dist';
const HOME_BUDGET_KB = 1000;
const failures = [];

for (const f of ['index.html', '404.html', '2027/cfp/index.html', '_redirects', '_headers', 'robots.txt', 'favicon.svg', 'theme.js']) {
  if (!existsSync(join(DIST, f))) failures.push(`missing dist/${f}`);
}

// Every Short Link from the data file is served, and there is no catch-all.
const redirects = readFileSync(join(DIST, '_redirects'), 'utf8');
if (/^\/\*/m.test(redirects)) failures.push('_redirects contains a catch-all (/*)');
for (const { from, mode } of parse(readFileSync('src/data/short-links.yaml', 'utf8'))) {
  const served = new RegExp(`^${from}\\s`, 'm').test(redirects) || (mode === 'replaced-by-page' && existsSync(join(DIST, from, 'index.html')));
  if (!served) failures.push(`Short Link ${from} is not served`);
}

// Zero data: no scripts except /theme.js (the remembered theme), no inline styles, nothing loaded from another host.
const walk = (dir) => readdirSync(dir).flatMap((n) => {
  const p = join(dir, n);
  return statSync(p).isDirectory() ? walk(p) : [p];
});
const htmlFiles = walk(DIST).filter((p) => extname(p) === '.html');
for (const file of htmlFiles) {
  const html = readFileSync(file, 'utf8');
  const scripts = [...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)];
  if (scripts.length !== 1 || !/^<script src="\/theme\.js"><\/script>$/.test(scripts[0][0])) {
    failures.push(`${file}: scripts other than <script src="/theme.js"></script>: ${scripts.map((m) => m[0].slice(0, 80)).join(' | ') || 'none'}`);
  }
  if (/\sstyle="/i.test(html)) failures.push(`${file}: contains an inline style attribute`);
  // Plain <a href> links to other sites are fine; loading anything from them is not.
  for (const m of html.matchAll(/\s(?:src|srcset)="(https?:\/\/[^"]+)"/gi)) {
    failures.push(`${file}: loads a third-party resource: ${m[1]}`);
  }
  for (const m of html.matchAll(/<link[^>]+href="(https?:\/\/[^"]+)"[^>]*>/gi)) {
    if (!/rel="canonical"/.test(m[0])) failures.push(`${file}: <link> to another host: ${m[1]}`);
  }
}

// The social cards: link previews need 1200 x 630 PNGs, and they stay small enough for every site that fetches them.
const CARDS = ['default', 'sponsorships', 'cfp'];
for (const name of CARDS) {
  const file = join(DIST, 'cards', `${name}.png`);
  if (!existsSync(file)) { failures.push(`missing dist/cards/${name}.png`); continue; }
  const png = readFileSync(file);
  if (png.length >= 300 * 1024) failures.push(`cards/${name}.png is ${Math.round(png.length / 1024)} KB (budget under 300 KB)`);
  if (png.readUInt32BE(16) !== 1200 || png.readUInt32BE(20) !== 630) failures.push(`cards/${name}.png is not 1200 x 630`);
}
for (const file of htmlFiles) {
  const image = readFileSync(file, 'utf8').match(/<meta property="og:image" content="([^"]+)"/)?.[1];
  if (!image) failures.push(`${file}: no og:image`);
  else if (!/^https:\/\/[^/]+\/cards\/[a-z-]+\.png$/.test(image)) failures.push(`${file}: og:image is not an absolute card URL: ${image}`);
}

// The theme script runs before the first paint, so it stays tiny.
if (existsSync(join(DIST, 'theme.js')) && statSync(join(DIST, 'theme.js')).size >= 1024) failures.push('theme.js is 1 KB or larger');

// Page weight of the home page as a phone first loads it: the HTML, the CSS, fonts and script it
// references, and the smallest candidate of every image (photos are lazy and responsive, so a
// desktop fetches larger files as it scrolls). v1 has photos on every screen, hence 1 MB.
const home = readFileSync(join(DIST, 'index.html'), 'utf8');
const size = (p) => (existsSync(join(DIST, p)) ? statSync(join(DIST, p)).size : 0);
let bytes = Buffer.byteLength(home);
for (const a of new Set([...home.matchAll(/(?:href|src)="(\/[^"#?]+\.(?:css|woff2|js))"/g)].map((m) => m[1]))) bytes += size(a);
for (const [tag] of home.matchAll(/<(?:img|source)\b[^>]*>/g)) {
  const srcset = tag.match(/srcset="([^"]+)"/)?.[1];
  const candidates = srcset ? srcset.split(',').map((c) => c.trim().split(/\s+/)[0]) : [tag.match(/\ssrc="([^"]+)"/)?.[1]];
  // A <picture>'s <img> fallback is only fetched where no <source> matches; count every candidate set once.
  bytes += Math.min(...candidates.filter((c) => c?.startsWith('/')).map(size));
}
const kb = Math.round(bytes / 1024);
if (kb > HOME_BUDGET_KB) failures.push(`home page weighs ${kb} KB on a phone (budget ${HOME_BUDGET_KB} KB)`);

if (failures.length) {
  console.error('Build check failed:\n  ' + failures.join('\n  '));
  process.exit(1);
}
console.log(`Build check passed: ${htmlFiles.length} pages, home page ${kb} KB on a phone.`);
