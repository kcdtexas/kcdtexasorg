// The time machine: builds the site as if each key day were today (scripts/build.sh --now) and checks
// the date-driven text (tests/time-machine.mjs). It also proves scripts/rebuild-dates.mjs: two builds
// differ, beyond where NOW sits and how far each phase is filled, exactly when a rebuild date falls between them.
// Then it builds once per test-only run (the sample ticket day, --program-public, --sponsors-sample) and checks
// those, with the Sample guard in scripts/check-dist.mjs. Every build also gets the browser checks in
// tests/states-browser.mjs, and its hero bill is measured again from the font (src/lib/bill-fit.ts): it must
// match the build's fit values and be one of the variants tests/browser.mjs checks (tests/bill-variants.mjs).
// Each build takes about 10 seconds and its browser checks about as long; at the end dist/ is rebuilt for today.
// Usage: node tests/run-time-machine.mjs [--keep-dist] [--no-browser]
import { spawn, spawnSync } from 'node:child_process';
import { readFileSync, readdirSync } from 'node:fs';
import { createServer } from 'node:net';
import { join } from 'node:path';
import { chromium } from 'playwright-core';
import { DAYS, RUNS, diff, fingerprint, summary } from './time-machine.mjs';
import { BILL_VARIANTS, billWords } from './bill-variants.mjs';
import { stateChecks } from './states-browser.mjs';
import { rebuildDates } from '../scripts/rebuild-dates.mjs';
import { importTs } from '../scripts/lib/import-ts.mjs';

const browserOn = !process.argv.includes('--no-browser');
const rebuilds = rebuildDates().map((r) => r.day);
const shift = (day, n) => {
  const d = new Date(`${day}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};
// The key days, the eve of every rebuild date, and a day in the middle of each stretch between them.
const days = new Set(Object.keys(DAYS));
for (const r of rebuilds) { days.add(r); days.add(shift(r, -1)); }
const sorted = [...days].sort();
for (let i = 0; i + 1 < sorted.length; i += 1) {
  const span = (Date.parse(sorted[i + 1]) - Date.parse(sorted[i])) / 864e5;
  if (span > 2) days.add(shift(sorted[i], Math.floor(span / 2)));
}
days.add(shift(rebuilds.at(-1), 60));

function build(flags = []) {
  const res = spawnSync('bash', ['scripts/build.sh', '--skip-install', ...flags], { encoding: 'utf8' });
  if (res.status !== 0) {
    console.error(res.stdout.slice(-3000), res.stderr.slice(-3000));
    throw new Error(`the build ${flags.join(' ')} failed`);
  }
}
const read = () => ({
  home: readFileSync('dist/index.html', 'utf8'),
  cfp: readFileSync('dist/2027/cfp/index.html', 'utf8'),
  schedule: readFileSync('dist/2027/schedule/index.html', 'utf8'),
  sponsors: readFileSync('dist/2027/sponsors/index.html', 'utf8'),
});

// billFits from src/lib/bill-fit.ts. It reads the font relative to the working directory, the repo root.
const { billFits } = await importTs(new URL('../src/lib/bill-fit.ts', import.meta.url));
const listed = new Set(BILL_VARIANTS.map(billWords));
const bills = new Map();

/** The bill this build shows, measured again from the font, against the fit values the build serves. */
function checkBill(label, home) {
  const ul = home.match(/<ul class="slots[^"]*">([\s\S]*?)<\/ul>/)?.[1] ?? '';
  const plain = (s) => s.replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&#39;|&#x27;/g, "'").trim();
  const notes = [...ul.matchAll(/<li class="note"><b>([^<]*)<\/b>([\s\S]*?)<\/li>/g)].map(([, l, t]) => ({ label: plain(l), text: plain(t) }));
  const link = ul.match(/<span class="eu-label">([^<]*)<\/span>/)?.[1];
  const statement = ul.match(/<span class="eu-link bill-statement">([^<]*)<\/span>/)?.[1];
  const f = billFits(notes, plain(link ?? statement ?? ''), { arrow: Boolean(link) });
  const want = { fit: f.fit, notesFit: notes.length ? f.notesFit : f.fit, slotFit: f.slotFit };
  const css = readdirSync('dist/_astro').filter((n) => n.endsWith('.css')).map((n) => readFileSync(join('dist/_astro', n), 'utf8')).join('\n');
  const got = css.match(/\.slots\{--fit:([\d.]+);--notes-fit:([\d.]+);--slot-fit:([\d.]+)\}/)?.slice(1).map(Number) ?? [];
  const words = billWords({ notes, end: plain(link ?? statement ?? '') });
  bills.set(words, (bills.get(words) ?? []).concat(label));
  checks += 2;
  if (got.join() !== [want.fit, want.notesFit, want.slotFit].join()) failures.push(`${label}: the bill "${words}" is served --fit ${got.join(', ')}, but billFits gives ${want.fit}, ${want.notesFit}, ${want.slotFit}`);
  if (!listed.has(words)) failures.push(`${label}: the bill "${words}" is not in tests/bill-variants.mjs, so the browser tests don't check it`);
}

// A local server on dist/ and one browser for every build's browser checks.
const host = '127.0.0.1';
const port = await new Promise((resolve, reject) => {
  const probe = createServer().once('error', reject).listen(0, host, () => { const { port: p } = probe.address(); probe.close(() => resolve(p)); });
});
const base = `http://${host}:${port}`;
const server = browserOn ? spawn(process.execPath, ['scripts/serve.mjs', '--host', host, '--port', String(port)], { stdio: 'ignore' }) : null;
const browser = browserOn ? await chromium.launch() : null;
async function inBrowser(label, day) {
  if (!browser) return;
  for (let i = 0; i < 50; i += 1) {
    try { if ((await fetch(`${base}/`)).ok) break; } catch {}
    await new Promise((r) => setTimeout(r, 100));
  }
  const res = await stateChecks(browser, base, day);
  checks += res.checks;
  failures.push(...res.failures.map((f) => `${label}: ${f}`));
}

const failures = [];
const prints = new Map();
let checks = 0;
// The rebuild days for the dates in src/data/edition-2027.ts: no more, no fewer. Sponsorships run through
// Event Day, so their close is Apr 24; Mar 1 is the program's day while the program isn't public.
const REBUILDS = ['2026-11-01', '2027-02-01', '2027-03-01', '2027-04-23', '2027-04-24'];
const REBUILDS_PUBLIC = ['2026-11-01', '2027-02-01', '2027-04-23', '2027-04-24'];
checks += 2;
if (rebuilds.join() !== REBUILDS.join()) failures.push(`rebuild days are ${rebuilds.join(', ')}, not ${REBUILDS.join(', ')}`);
const publicDays = rebuildDates({ programPublic: true }).map((r) => r.day);
if (publicDays.join() !== REBUILDS_PUBLIC.join()) failures.push(`with the program public, rebuild days are ${publicDays.join(', ')}, not ${REBUILDS_PUBLIC.join(', ')}`);
try {
  for (const day of [...days].sort()) {
    build(['--now', day]);
    const pages = read();
    prints.set(day, fingerprint('dist'));
    console.log(`${day}  ${summary(pages)}`);
    for (const [name, ok] of Object.entries(DAYS[day]?.(pages) ?? {})) {
      checks += 1;
      if (!ok) failures.push(`${day}: ${name}`);
    }
    checkBill(day, pages.home);
    await inBrowser(day, day);
  }

  // Consecutive builds differ exactly when a rebuild date falls in (a, b].
  const order = [...prints.keys()];
  console.log('\nRebuild-date proof (consecutive builds, NOW and the fills ignored):');
  for (let i = 0; i + 1 < order.length; i += 1) {
    const [a, b] = [order[i], order[i + 1]];
    const changed = diff(prints.get(a), prints.get(b));
    const expected = rebuilds.some((r) => r > a && r <= b);
    checks += 1;
    console.log(`  ${a} -> ${b}: ${changed.length ? `changed (${changed.length > 4 ? `${changed.length} files` : changed.join(', ')})` : 'same'}${expected ? '  [rebuild date]' : ''}`);
    if (expected && !changed.length) failures.push(`${a} -> ${b}: a rebuild date falls between, but nothing changed`);
    if (!expected && changed.length) failures.push(`${a} -> ${b}: no rebuild date between, but ${changed.join(', ')} changed`);
  }

  // The test-only runs, and the Sample guard: check-dist must refuse a sample build unless its flag is set.
  console.log('\nTest-only runs:');
  for (const run of RUNS) {
    build(run.flags);
    const pages = read();
    const day = run.flags[run.flags.indexOf('--now') + 1];
    console.log(`  ${run.name} (${run.flags.join(' ')})`);
    for (const [name, ok] of Object.entries(run.checks(pages))) {
      checks += 1;
      if (!ok) failures.push(`${run.name}: ${name}`);
    }
    checkBill(run.name, pages.home);
    await inBrowser(run.name, day);
    if (run.flags.includes('--program-public') || run.flags.includes('--sponsors-sample')) {
      const env = { ...process.env };
      delete env.KCD_TICKETS_DAY; delete env.KCD_PROGRAM_PUBLIC; delete env.KCD_SPONSORS_SAMPLE;
      const guard = spawnSync(process.execPath, ['scripts/check-dist.mjs'], { encoding: 'utf8', env });
      checks += 1;
      if (guard.status === 0 || !/Sample/.test(guard.stdout + guard.stderr)) failures.push(`${run.name}: check-dist passes the sample build without its flag`);
    }
  }
  console.log(`\nHero bill variants built and measured: ${bills.size} of the ${listed.size} in tests/bill-variants.mjs (tests/browser.mjs checks all of them)`);
  for (const [words, where] of bills) console.log(`  ${words}  (${where.length} build${where.length > 1 ? 's' : ''})`);
} finally {
  await browser?.close().catch(() => {});
  server?.kill();
  if (!process.argv.includes('--keep-dist')) build();
}

if (failures.length) {
  console.error(`\nTime machine failed:\n  ${failures.join('\n  ')}`);
  process.exit(1);
}
console.log(`\nTime machine passed: ${checks} checks on ${prints.size} build days and ${RUNS.length} test-only runs.`);
