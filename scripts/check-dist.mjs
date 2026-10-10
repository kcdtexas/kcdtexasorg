// Checks the built site before it ships: required pages and files, Short Links,
// zero-data rules (only the same-origin theme script, no inline styles, no third-party loads),
// draft markers, and each page's weight.
//
// Usage: node scripts/check-dist.mjs
// tests/smoke.mjs imports REQUIRED_PAGES and DRAFT_MARKERS from here, so the checks only run
// when this file is the script being run.
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, extname, relative, resolve, sep } from 'node:path';
import { gzipSync } from 'node:zlib';
import { parse } from 'yaml';
import { importTs } from './lib/import-ts.mjs';

// Pages that must be built, as URL paths: a path ending in "/" is that folder's index.html,
// anything else is the file itself. tests/smoke.mjs treats a link to a v1 page that isn't
// listed here yet as pending (a notice, not a failure); once listed, a broken link fails.
export const REQUIRED_PAGES = [
  '/',
  '/404.html',
  '/2027/cfp/',
  '/2027/sponsors/',
  '/2027/tickets/',
  '/2027/travel/',
  '/2027/schedule/',
  '/2026/',
  '/editions/',
  '/about/',
  '/code-of-conduct/',
  '/privacy/',
  '/accessibility/',
];

// Text that marks an unfinished draft and must never ship: "[TBD", "TODO", or a template
// placeholder left unfilled such as "{cfpOpens}". Checked against the whole HTML, comments and
// attributes included (no page has inline scripts or styles that could hold braces).
export const DRAFT_MARKERS = [
  { name: '[TBD', pattern: /\[TBD/ },
  { name: 'TODO', pattern: /\bTODO\b/ },
  { name: '{placeholder}', pattern: /\{[A-Za-z_][\w.]*\}/ },
  // A sample (build.sh --tickets-day, --program-public, --sponsors-sample, --program-sample) must never reach a
  // real deploy: the pages label every sample "Sample".
  ...(process.env.KCD_TICKETS_DAY || process.env.KCD_PROGRAM_PUBLIC || process.env.KCD_SPONSORS_SAMPLE || process.env.KCD_PROGRAM_SAMPLE ? [] : [{ name: 'Sample', pattern: /\bSample\b/ }]),
  // The test program's made-up names never reach a build without the program sample (src/data/program-fixture.ts).
  ...(process.env.KCD_PROGRAM_SAMPLE ? [] : [{ name: 'Fixture', pattern: /\bFixture (?:Speaker|Session)\b/ }]),
];
export const findDraftMarkers = (html) =>
  DRAFT_MARKERS.flatMap(({ name, pattern }) => {
    const m = html.match(pattern);
    return m ? [`${name} (${JSON.stringify(html.slice(Math.max(0, m.index - 30), m.index + m[0].length + 30).replace(/\s+/g, ' '))})`] : [];
  });

// Phone first-load budgets. Fail at the budget or more.
const KB = 1024;
const BUDGETS = {
  home: { bytes: 1024 * KB, label: 'home' },
  photos: { bytes: 500 * KB, label: 'images' },
  plain: { bytes: 150 * KB, label: 'no images' },
};

const DIST = 'dist';
/** The file scripts/build.sh writes into dist/ for any build with a test flag. */
export const TEST_BUILD_MARKER = '.test-build';
// An image address on a host other than ours.
const EXTERNAL_IMAGE = /(?:https?:)?\/\/(?!kcdtexas\.org\/)[^\s"'()<>/]+\/[^\s"'()<>]*?\.(?:jpe?g|png|webp|avif|gif|svg)(?=[\s"'()<>?#]|$)/gi;

/**
 * The program's gates (ADR 0009) against what's built, in every build: the gates in src/data/edition-2027.ts, or a
 * --program-sample test build's. Closed, nothing of the program ships. A gate open builds the Speakers and the
 * program version; `speakersPublic` alone shows no time, room, calendar file or Event Day page, and the Schedule's
 * gate builds them. Outside a production build (deploy previews, branch deploys, local builds), an open gate shows
 * the test program, labeled "Sample": scripts/build.sh keeps the platform's variables from the build, and the test
 * program has no Speaker photos to download.
 */
function programGates({ edition2027 }, walk) {
  const failures = [];
  const sample = process.env.KCD_PROGRAM_SAMPLE;
  const gates = sample === '1' ? { speakersPublic: true, schedulePublic: true } : sample === 'speakers' ? { speakersPublic: true, schedulePublic: false } : edition2027.program;
  const open = Boolean(gates.speakersPublic || gates.schedulePublic);
  const timed = Boolean(gates.schedulePublic);
  const has = (p) => existsSync(join(DIST, p));
  const files = (dir, test) => (has(dir) ? readdirSync(join(DIST, dir)).filter(test) : []);
  const state = sample ? `the test program's gates (KCD_PROGRAM_SAMPLE=${sample})` : 'the gates in src/data/edition-2027.ts';
  const pages = walk(DIST).filter((f) => /[\\/]2027[\\/](?:speakers|sessions)[\\/].*\.html$/.test(f));
  const built = {
    'the Speakers (dist/2027/speakers/)': [has('2027/speakers'), open],
    'the Session pages (dist/2027/sessions/)': [has('2027/sessions'), open ? null : false],
    'the program version (dist/2027/program-version.txt)': [has('2027/program-version.txt'), open],
    "the program's Share Cards (dist/cards/session-*, speaker-*)": [files('cards', (n) => /^(?:session|speaker)-/.test(n)).length > 0, open ? null : false],
    'the Event Day page (dist/2027/today/)': [has('2027/today'), timed],
    'the Sessions by time on the Schedule page': [has('2027/schedule/index.html') && /data-schedule/.test(readFileSync(join(DIST, '2027/schedule/index.html'), 'utf8')), timed],
    'the calendar files (dist/2027/schedule.ics, dist/2027/sessions/*.ics)': [has('2027/schedule.ics') || files('2027/sessions', (n) => n.endsWith('.ics')).length > 0, timed ? null : false],
    'a time or a room on a Speaker or Session page': [pages.some((f) => /data-start="\d|class="(?:sch-time|sch-room|page-facts)"/.test(readFileSync(f, 'utf8'))), timed ? null : false],
  };
  for (const [what, [is, want]] of Object.entries(built)) {
    if (want !== null && is !== want) failures.push(`${what}: ${is ? 'built' : 'missing'}, but ${state} ${open ? (timed ? 'are open' : 'open only speakersPublic') : 'are closed'}`);
  }
  if (has('2027/program-version.txt') && !/^[0-9a-f]{64}\n$/.test(readFileSync(join(DIST, '2027/program-version.txt'), 'utf8'))) failures.push('dist/2027/program-version.txt is not one SHA-256 line');

  // The preview rule.
  if (process.env.CONTEXT !== 'production') {
    for (const v of ['SESSIONIZE_ENDPOINT_ID', 'PROGRAM_CSV_URL']) {
      if (process.env[v] !== undefined) failures.push(`${v} reaches a build that isn't a production build (CONTEXT=${process.env.CONTEXT ?? 'unset'}); scripts/build.sh unsets it there`);
    }
    if (open) {
      if (!sample) failures.push('a program gate is open outside a production build, but the build has no test program (scripts/build.sh sets KCD_PROGRAM_SAMPLE)');
      if (!has(TEST_BUILD_MARKER)) failures.push(`a program gate is open outside a production build, but dist/${TEST_BUILD_MARKER} is missing`);
      if (has('2027/speakers/index.html') && !/\bSample\b/.test(readFileSync(join(DIST, '2027/speakers/index.html'), 'utf8'))) failures.push('dist/2027/speakers/index.html: the test program is not labeled "Sample"');
      for (const photo of files('2027/speakers', (n) => n.endsWith('.webp'))) failures.push(`dist/2027/speakers/${photo}: a Speaker photo outside a production build, where the test program has none`);
    }
  }
  return failures;
}

async function check() {
  const failures = [];

  const pageFile = (path) => (path.endsWith('/') ? join(path, 'index.html') : path).replace(/^\//, '');
  for (const path of REQUIRED_PAGES) {
    if (!existsSync(join(DIST, pageFile(path)))) failures.push(`missing page ${path} (dist/${pageFile(path)})`);
  }
  for (const f of ['_redirects', '_headers', 'robots.txt', 'sitemap.xml', 'favicon.svg', 'theme.js', 'now.js']) {
    if (!existsSync(join(DIST, f))) failures.push(`missing dist/${f}`);
  }

  // A test-flag build (scripts/build.sh writes the marker) never ships from a production build.
  if (process.env.CONTEXT === 'production' && existsSync(join(DIST, TEST_BUILD_MARKER))) {
    failures.push(`dist/${TEST_BUILD_MARKER}: this is a test build, and CONTEXT is production`);
  }

  // Every Short Link from the data file is served, and there is no catch-all.
  const redirects = readFileSync(join(DIST, '_redirects'), 'utf8');
  if (/^\/\*/m.test(redirects)) failures.push('_redirects contains a catch-all (/*)');
  for (const { from, mode, while: page } of parse(readFileSync('src/data/short-links.yaml', 'utf8'))) {
    const listed = new RegExp(`^${from}\\s`, 'm').test(redirects);
    // A "while" link is served only while its page is built.
    if (page !== undefined && !existsSync(join(DIST, page, 'index.html'))) {
      if (listed) failures.push(`Short Link ${from} is served without its page ${page}`);
      continue;
    }
    const served = listed || (mode === 'replaced-by-page' && existsSync(join(DIST, from, 'index.html')));
    if (!served) failures.push(`Short Link ${from} is not served`);
  }

  // Zero data: no scripts except /theme.js (the remembered theme), on the key dates /now.js (today's date), and on
  // the program pages /schedule.js (My Schedule, the filters, Event Day's now and next, offline use), no inline
  // styles, nothing loaded from another host. The one other <script> allowed is a JSON-LD data block
  // (type="application/ld+json"): browsers never run it, it holds only JSON, and only the home page has one.
  const walk = (dir) => readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    return statSync(p).isDirectory() ? walk(p) : [p];
  });
  const htmlFiles = walk(DIST).filter((p) => extname(p) === '.html').sort();
  const pages = htmlFiles.map((file) => ({ file, html: readFileSync(file, 'utf8') }));
  for (const { file, html } of pages) {
    const all = [...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)];
    const data = all.filter((m) => /^<script type="application\/ld\+json">/.test(m[0]));
    const scripts = all.filter((m) => !data.includes(m));
    if (data.length > 1) failures.push(`${file}: more than one JSON-LD block`);
    for (const m of data) {
      try { JSON.parse(m[1]); } catch { failures.push(`${file}: the JSON-LD block is not valid JSON`); }
      if (m[1].includes('<')) failures.push(`${file}: the JSON-LD block contains an unescaped "<"`);
    }
    if (data.length && file !== join(DIST, 'index.html')) failures.push(`${file}: a JSON-LD block outside the home page`);
    const allowed = /^<script src="\/(?:theme\.js"|now\.js" defer|schedule\.js" defer)><\/script>$/;
    if (scripts[0]?.[0] !== '<script src="/theme.js"></script>' || scripts.some((m) => !allowed.test(m[0])) || scripts.filter((m) => /now\.js/.test(m[0])).length > 1 || scripts.filter((m) => /schedule\.js/.test(m[0])).length > 1) {
      failures.push(`${file}: scripts other than /theme.js first, /now.js once and /schedule.js once: ${scripts.map((m) => m[0].slice(0, 80)).join(' | ') || 'none'}`);
    }
    // /schedule.js only where the program is: the Schedule with its gate open, Session pages, Speaker pages, Event Day.
    const programPage = /[\\/]2027[\\/](?:sessions|speakers|today)[\\/]/.test(file) || /data-schedule/.test(html);
    if (scripts.some((m) => /schedule\.js/.test(m[0])) && !programPage) failures.push(`${file}: loads /schedule.js outside the program pages`);
    if (/\sstyle="/i.test(html)) failures.push(`${file}: contains an inline style attribute`);
    // Plain <a href> links to other sites are fine; loading anything from them is not.
    for (const m of html.matchAll(/\s(?:src|srcset)="(https?:\/\/[^"]+)"/gi)) {
      failures.push(`${file}: loads a third-party resource: ${m[1]}`);
    }
    for (const m of html.matchAll(/<link[^>]+href="(https?:\/\/[^"]+)"[^>]*>/gi)) {
      if (!/rel="canonical"/.test(m[0])) failures.push(`${file}: <link> to another host: ${m[1]}`);
    }
    // No image from another host anywhere on the page, outside a plain link: Speaker photos are downloaded at
    // build time (src/lib/program-source/photos.mjs).
    for (const m of html.replace(/<a\b[^>]*>/gi, '').matchAll(EXTERNAL_IMAGE)) failures.push(`${file}: an image from another host: ${m[0]}`);
    for (const marker of findDraftMarkers(html)) failures.push(`${file}: draft marker ${marker}`);
    if (/(^|\/)404\.html$/.test(file)) {
      // The 404 page is served at any unknown address: no canonical address, and noindex.
      if (/rel="canonical"/.test(html)) failures.push(`${file}: the 404 page has a canonical link`);
      if (!/<meta name="robots" content="noindex">/.test(html)) failures.push(`${file}: the 404 page lacks noindex`);
    } else if (!/<link rel="canonical" href="https:\/\/kcdtexas\.org\/[^"]*"/.test(html)) failures.push(`${file}: no canonical kcdtexas.org link`);
  }

  // /schedule.js and its cache rule ship only in a build where a page loads it.
  const loaded = pages.some(({ html }) => html.includes('<script src="/schedule.js" defer></script>'));
  if (existsSync(join(DIST, 'schedule.js')) !== loaded) failures.push(loaded ? 'a page loads /schedule.js, but dist/schedule.js is missing' : 'dist/schedule.js ships, but no page loads it');
  const hostHeaders = readFileSync(join(DIST, '_headers'), 'utf8');
  if (/^\/schedule\.js$/m.test(hostHeaders) !== existsSync(join(DIST, 'schedule.js'))) failures.push('_headers has a /schedule.js rule without the file, or the file without its rule');
  // The offline worker (/sw.js) comes with the program script: its no-cache rule, and worker-src in the CSP.
  const worker = existsSync(join(DIST, 'sw.js'));
  if (worker !== existsSync(join(DIST, 'schedule.js'))) failures.push('dist/sw.js and dist/schedule.js must ship together');
  if (/^\/sw\.js\n  Cache-Control: no-cache$/m.test(hostHeaders) !== worker) failures.push('_headers has a /sw.js no-cache rule without the file, or the file without its rule');
  if (/worker-src 'self'/.test(hostHeaders) !== worker) failures.push('the CSP has worker-src without /sw.js, or /sw.js without worker-src');
  if (worker && !/register\('\/sw\.js', \{ scope: '\/2027\/' \}\)/.test(readFileSync(join(DIST, 'schedule.js'), 'utf8'))) failures.push('schedule.js does not register /sw.js with the scope /2027/');

  for (const file of walk(DIST).filter((p) => extname(p) === '.css')) {
    for (const m of readFileSync(file, 'utf8').matchAll(/url\(\s*['"]?((?:https?:)?\/\/[^'")\s]+)/gi)) failures.push(`${file}: loads from another host: ${m[1]}`);
  }

  // The planted marker (src/data/program-fixture.ts) sits in a field the program allowlist drops (ADR 0009): it
  // must never reach any file the site serves, in any build, sample or not.
  const marker = readFileSync('src/data/program-fixture.ts', 'utf8').match(/plantedMarker = '([^']+)'/)?.[1];
  if (!marker) failures.push('src/data/program-fixture.ts has no plantedMarker');
  else for (const file of walk(DIST)) {
    if (/\.(?:html|xml|txt|ics|js|css|json|svg)$|(?:^|\/)_(?:redirects|headers)$/.test(file) && readFileSync(file, 'utf8').includes(marker)) failures.push(`${file}: contains the planted marker`);
  }

  // The fixture's made-up names, its earlier-Edition entry included, never reach the 2026 page, in any build.
  for (const file of walk(join(DIST, '2026')).filter((f) => extname(f) === '.html')) {
    if (/\bFixture\b/.test(readFileSync(file, 'utf8'))) failures.push(`${file}: contains a fixture name`);
  }

  failures.push(...programGates(await importTs(new URL('../src/data/edition-2027.ts', import.meta.url)), walk));

  // The sitemap lists every page except the 404 page, at absolute kcdtexas.org addresses, and robots.txt names it.
  if (existsSync(join(DIST, 'sitemap.xml'))) {
    const listed = [...readFileSync(join(DIST, 'sitemap.xml'), 'utf8').matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
    const expected = htmlFiles.filter((f) => f !== join(DIST, '404.html'))
      .map((f) => 'https://kcdtexas.org/' + relative(DIST, f).split(sep).join('/').replace(/(^|\/)index\.html$/, '$1'));
    const missingFromMap = expected.filter((u) => !listed.includes(u));
    const extra = listed.filter((u) => !expected.includes(u));
    if (missingFromMap.length) failures.push(`sitemap.xml misses ${missingFromMap.join(', ')}`);
    if (extra.length) failures.push(`sitemap.xml lists what isn't a page: ${extra.join(', ')}`);
  }
  if (!/^Sitemap: https:\/\/kcdtexas\.org\/sitemap\.xml$/m.test(readFileSync(join(DIST, 'robots.txt'), 'utf8'))) failures.push('robots.txt does not name the sitemap');

  // The social cards: link previews need 1200 x 630 PNGs, and they stay small enough for every site that fetches them.
  const CARDS = ['default', 'sponsorships', 'cfp'];
  for (const name of CARDS) {
    const file = join(DIST, 'cards', `${name}.png`);
    if (!existsSync(file)) { failures.push(`missing dist/cards/${name}.png`); continue; }
    const png = readFileSync(file);
    if (png.length >= 300 * 1024) failures.push(`cards/${name}.png is ${Math.round(png.length / 1024)} KB (budget under 300 KB)`);
    if (png.readUInt32BE(16) !== 1200 || png.readUInt32BE(20) !== 630) failures.push(`cards/${name}.png is not 1200 x 630`);
  }
  for (const { file, html } of pages) {
    const image = html.match(/<meta property="og:image" content="([^"]+)"/)?.[1];
    if (!image) failures.push(`${file}: no og:image`);
    else if (!/^https:\/\/[^/]+\/cards\/[a-z0-9-]+\.png$/.test(image)) failures.push(`${file}: og:image is not an absolute card URL: ${image}`);
  }

  // The theme script runs before the first paint, so it stays tiny.
  if (existsSync(join(DIST, 'theme.js')) && statSync(join(DIST, 'theme.js')).size >= 1024) failures.push('theme.js is 1 KB or larger');
  if (existsSync(join(DIST, 'now.js')) && statSync(join(DIST, 'now.js')).size >= 1024) failures.push('now.js is 1 KB or larger');
  // The program pages' one script stays small: at most 8 KB as written, about 3 KB gzipped.
  if (existsSync(join(DIST, 'schedule.js')) && statSync(join(DIST, 'schedule.js')).size > 8 * 1024) failures.push('schedule.js is larger than 8 KB');
  // The offline worker too: at most 3 KB.
  if (existsSync(join(DIST, 'sw.js')) && statSync(join(DIST, 'sw.js')).size > 3 * 1024) failures.push('sw.js is larger than 3 KB');

  // Each page's weight as a phone first loads it, in bytes over the wire: the HTML, the CSS,
  // fonts and script it references, and the smallest candidate of every image (photos are lazy
  // and responsive, so a desktop fetches larger files as it scrolls). Each file counts once,
  // however often the page references it. Text files (HTML, CSS, JS, SVG) count gzipped, as every
  // host serves them compressed (brotli is smaller still); fonts and raster images count as is.
  //
  // A page "has photos" when an <img> or <source> on it references a raster image (.webp, .avif,
  // .jpg, .jpeg, .png) under /_astro/, other than the KCD Texas badge in the header and footer
  // (/_astro/badge-*), a Speaker photo (/2027/speakers/*.webp), or a sponsor logo (img.sp-logo): a logo wall is
  // image content, like photos.
  // Budgets: the home page under 1 MB (v1 has photos on every screen), other pages with photos
  // under 500 KB, pages without photos under 150 KB.
  const weights = new Map();
  const wire = (p) => {
    if (!weights.has(p)) {
      const file = join(DIST, p);
      const buf = existsSync(file) && statSync(file).isFile() ? readFileSync(file) : Buffer.alloc(0);
      weights.set(p, /\.(?:html|css|m?js|svg)$/.test(p) && buf.length ? gzipSync(buf, { level: 9 }).length : buf.length);
    }
    return weights.get(p);
  };
  const rows = [];
  for (const { file, html } of pages) {
    const path = '/' + relative(DIST, file).split(sep).join('/').replace(/(^|\/)index\.html$/, '$1');
    const files = new Set(['/' + relative(DIST, file).split(sep).join('/')]);
    for (const m of html.matchAll(/(?:href|src)="(\/[^"#?]+\.(?:css|woff2|js))"/g)) files.add(m[1]);
    let photos = false;
    for (const [tag] of html.matchAll(/<(?:img|source)\b[^>]*>/g)) {
      const srcset = tag.match(/srcset="([^"]+)"/)?.[1];
      const candidates = (srcset ? srcset.split(',').map((c) => c.trim().split(/\s+/)[0]) : [tag.match(/\ssrc="([^"]+)"/)?.[1]])
        .filter((c) => c?.startsWith('/'));
      if (!candidates.length) continue;
      if (candidates.some((c) => /^\/(?:_astro\/(?!badge-)|2027\/speakers\/)[^/]+\.(?:webp|avif|jpe?g|png)$/i.test(c))) photos = true;
      if (/\bclass="sp-logo"/.test(tag)) photos = true;
      // A <picture>'s <img> fallback is only fetched where no <source> matches; count every candidate set once.
      files.add(candidates.reduce((a, b) => (wire(b) < wire(a) ? b : a)));
    }
    const bytes = [...files].reduce((sum, p) => sum + wire(p), 0);
    const budget = path === '/' ? BUDGETS.home : photos ? BUDGETS.photos : BUDGETS.plain;
    const ok = bytes < budget.bytes;
    rows.push({ path, kb: (bytes / KB).toFixed(0), photos: photos ? 'yes' : 'no', budget: `< ${budget.bytes / KB} KB (${budget.label})`, ok });
    if (!ok) failures.push(`${path} weighs ${(bytes / KB).toFixed(0)} KB on a phone (budget under ${budget.bytes / KB} KB, ${budget.label})`);
  }

  const cols = [['Page', 'path'], ['KB', 'kb'], ['Images', 'photos'], ['Budget', 'budget']];
  const widths = cols.map(([h, k]) => Math.max(h.length, ...rows.map((r) => String(r[k]).length)));
  const line = (cells) => cells.map((c, i) => (i === 1 ? String(c).padStart(widths[i]) : String(c).padEnd(widths[i]))).join('  ');
  console.log('Phone first-load weight (text gzipped, each file once):');
  console.log('  ' + line(cols.map(([h]) => h)));
  for (const r of rows) console.log('  ' + line(cols.map(([, k]) => r[k])) + (r.ok ? '' : '  OVER'));

  if (failures.length) {
    console.error('Build check failed:\n  ' + failures.join('\n  '));
    process.exit(1);
  }
  console.log(`Build check passed: ${htmlFiles.length} pages.`);
}

if (process.argv[1] && resolve(process.argv[1]) === import.meta.filename) await check();
