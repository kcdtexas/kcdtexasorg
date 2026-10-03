// The time machine: builds the site as if each key day were today (scripts/build.sh --now) and checks
// the date-driven text (tests/time-machine.mjs). It also proves scripts/rebuild-dates.mjs: two builds
// differ, beyond "As of" and "Now", exactly when a rebuild date falls between them.
// Each build takes about 10 seconds; at the end dist/ is rebuilt for today.
// Usage: node tests/run-time-machine.mjs [--keep-dist]
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { DAYS, diff, fingerprint, summary } from './time-machine.mjs';
import { rebuildDates } from '../scripts/rebuild-dates.mjs';

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

function build(day) {
  const args = ['scripts/build.sh', '--skip-install', ...(day ? ['--now', day] : [])];
  const res = spawnSync('bash', args, { encoding: 'utf8' });
  if (res.status !== 0) {
    console.error(res.stdout.slice(-3000), res.stderr.slice(-3000));
    throw new Error(`the build ${day ? `for ${day} ` : ''}failed`);
  }
}

const failures = [];
const prints = new Map();
let checks = 0;
try {
  for (const day of [...days].sort()) {
    build(day);
    const pages = { home: readFileSync('dist/index.html', 'utf8'), cfp: readFileSync('dist/2027/cfp/index.html', 'utf8') };
    prints.set(day, fingerprint('dist'));
    console.log(`${day}  ${summary(pages)}`);
    for (const [name, ok] of Object.entries(DAYS[day]?.(pages) ?? {})) {
      checks += 1;
      if (!ok) failures.push(`${day}: ${name}`);
    }
  }

  // Consecutive builds differ exactly when a rebuild date falls in (a, b].
  const order = [...prints.keys()];
  console.log('\nRebuild-date proof (consecutive builds, "As of" and "Now" ignored):');
  for (let i = 0; i + 1 < order.length; i += 1) {
    const [a, b] = [order[i], order[i + 1]];
    const changed = diff(prints.get(a), prints.get(b));
    const expected = rebuilds.some((r) => r > a && r <= b);
    checks += 1;
    console.log(`  ${a} -> ${b}: ${changed.length ? `changed (${changed.join(', ')})` : 'same'}${expected ? '  [rebuild date]' : ''}`);
    if (expected && !changed.length) failures.push(`${a} -> ${b}: a rebuild date falls between, but nothing changed`);
    if (!expected && changed.length) failures.push(`${a} -> ${b}: no rebuild date between, but ${changed.join(', ')} changed`);
  }
} finally {
  if (!process.argv.includes('--keep-dist')) build();
}

if (failures.length) {
  console.error(`\nTime machine failed:\n  ${failures.join('\n  ')}`);
  process.exit(1);
}
console.log(`\nTime machine passed: ${checks} checks on ${prints.size} build days.`);
