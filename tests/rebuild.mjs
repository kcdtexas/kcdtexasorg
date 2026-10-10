// The scheduled rebuild: scripts/rebuild-today.mjs picks exactly the days scripts/rebuild-dates.mjs lists, on
// the time machine's days and on every day in between, in Central time across both DST changes; the workflow's
// cron times land on the right Central day all year; and .github/workflows/rebuild.yml keeps its guards (pinned
// actions, least privilege, the secret only in the production environment, never printed, the keepalive, and no
// copied list of dates). No network, no build.
// Usage: node tests/rebuild.mjs
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { parse } from 'yaml';
import { rebuildDates } from '../scripts/rebuild-dates.mjs';
import { centralDay, rebuildToday } from '../scripts/rebuild-today.mjs';
import { DAYS } from './time-machine.mjs';

const failures = [];
let checks = 0;
const expect = (ok, message) => { checks += 1; if (!ok) failures.push(message); };
const shift = (day, n) => { const d = new Date(`${day}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };

const listed = new Set(rebuildDates().map((d) => d.day));
expect(listed.has('2026-11-01'), 'Nov 1, 2026 (the call for proposals opens) is not a rebuild day');

// Every day from Oct 1, 2026 to 60 days after the last rebuild day, and the time machine's days.
const days = new Set(Object.keys(DAYS));
for (let d = '2026-10-01'; d <= shift([...listed].sort().at(-1), 60); d = shift(d, 1)) days.add(d);
for (const day of [...days].sort()) {
  const r = rebuildToday(day);
  expect(r.rebuild === listed.has(day), `${day}: rebuild-today says ${r.rebuild}, rebuild-dates ${listed.has(day) ? 'lists it' : "doesn't"}`);
  if (r.rebuild) expect(r.why.length > 0, `${day}: no reason given`);
  else if (r.next) expect(r.next.day > day && listed.has(r.next.day), `${day}: the next rebuild day is wrong (${r.next.day})`);
}

// The Central day of an instant, across the DST changes: CDT is UTC-5, CST is UTC-6. DST ends at 2 a.m. CDT on
// Nov 1, 2026 (07:00 UTC) and starts at 2 a.m. CST on Mar 14, 2027 (08:00 UTC).
for (const [at, want] of [
  ['2026-11-01T04:59:00Z', '2026-10-31'], // 11:59 p.m. CDT
  ['2026-11-01T05:00:00Z', '2026-11-01'], // midnight CDT
  ['2026-11-01T06:59:00Z', '2026-11-01'], // 1:59 a.m. CDT, the last minute of DST
  ['2026-11-01T07:00:00Z', '2026-11-01'], // 1:00 a.m. CST, the second time
  ['2026-11-02T05:30:00Z', '2026-11-01'], // 11:30 p.m. CST: still Nov 1
  ['2026-11-02T06:00:00Z', '2026-11-02'], // midnight CST
  ['2027-02-01T05:59:00Z', '2027-01-31'],
  ['2027-03-14T07:59:00Z', '2027-03-14'], // 1:59 a.m. CST
  ['2027-03-14T08:00:00Z', '2027-03-14'], // 3:00 a.m. CDT
  ['2027-04-23T04:59:00Z', '2027-04-22'],
  ['2027-04-23T05:00:00Z', '2027-04-23'],
]) expect(centralDay(new Date(at)) === want, `${at} is ${centralDay(new Date(at))} in Central time, not ${want}`);

// The workflow.
const wf = parse(readFileSync('.github/workflows/rebuild.yml', 'utf8'));
const raw = readFileSync('.github/workflows/rebuild.yml', 'utf8');
const crons = (wf.on?.schedule ?? []).map((s) => s.cron);
expect(crons.length >= 1, 'the workflow has no schedule');
for (const cron of crons) {
  const [min, hour, ...rest] = cron.split(' ');
  expect(/^\d+$/.test(min) && /^\d+$/.test(hour) && rest.join(' ') === '* * *', `cron "${cron}" is not one fixed time daily`);
  // On every rebuild day (and the eve of each), in CDT and in CST, the run's Central day is its UTC day.
  for (const day of [...listed, ...[...listed].map((d) => shift(d, -1)), '2026-11-01', '2027-03-14', '2027-01-15', '2027-07-15']) {
    const at = new Date(`${day}T${hour.padStart(2, '0')}:${min.padStart(2, '0')}:00Z`);
    expect(centralDay(at) === day, `cron "${cron}" on ${day} runs on ${centralDay(at)} in Central time`);
  }
  // Early in the morning: before 7 a.m. Central in CDT (12:00 UTC).
  expect(Number(hour) < 12, `cron "${cron}" runs after 7 a.m. Central`);
}
expect(wf.on?.workflow_dispatch?.inputs?.force?.type === 'boolean', 'no workflow_dispatch "force" input');
expect(JSON.stringify(wf.permissions) === '{}', 'the workflow-level permissions are not {}');
const allowed = { check: { contents: 'read', actions: 'read' }, rebuild: {}, keepalive: { actions: 'write' } };
for (const [name, job] of Object.entries(wf.jobs)) {
  expect(name in allowed, `job "${name}" is not checked here`);
  expect(JSON.stringify(job.permissions) === JSON.stringify(allowed[name]), `job "${name}" has permissions ${JSON.stringify(job.permissions)}, not ${JSON.stringify(allowed[name])}`);
  for (const step of job.steps ?? []) {
    if (step.uses) expect(/^[\w.-]+\/[\w.-]+@[0-9a-f]{40}$/.test(step.uses), `job "${name}": ${step.uses} is not pinned by full commit SHA`);
    // The secret reaches only the rebuild job, through an env variable, and no command prints it.
    if (step.run) expect(!/secrets\./.test(step.run) && !/(echo|printf)[^\n]*\$\{?HOOK\b/.test(step.run), `job "${name}": a command uses or prints the secret`);
    if (name !== 'rebuild') expect(!JSON.stringify(step).includes('secrets.'), `job "${name}" reads a secret`);
  }
}
expect(wf.jobs.rebuild?.environment === 'production', 'the rebuild job does not name the production environment');
expect(/secrets\.NETLIFY_BUILD_HOOK/.test(JSON.stringify(wf.jobs.rebuild?.steps)), 'the rebuild job does not use NETLIFY_BUILD_HOOK');
expect(/node scripts\/rebuild-today\.mjs/.test(raw), 'the workflow does not ask scripts/rebuild-today.mjs');
expect(!/\b20\d\d-\d\d-\d\d\b/.test(raw), 'the workflow has a date in it: it must take the dates from scripts/rebuild-dates.mjs');
// The 60-day rule: a scheduled job re-enables the workflow through the API, with actions: write.
const keep = wf.jobs.keepalive;
expect(/github\.event_name == 'schedule'/.test(keep?.if ?? ''), 'the keepalive does not run on the schedule');
expect(crons.some((c) => (keep?.if ?? '').includes(c)), 'the keepalive is tied to no cron time of the schedule');
expect(/gh api -X PUT "repos\/\$GITHUB_REPOSITORY\/actions\/workflows\/rebuild\.yml\/enable"/.test(JSON.stringify(keep?.steps ?? []).replace(/\\"/g, '"')), 'the keepalive does not enable the workflow through the API');

// The script as the workflow runs it: one line, and rebuild=, day= and why= in $GITHUB_OUTPUT.
const dir = mkdtempSync(join(tmpdir(), 'rebuild-'));
try {
  for (const [args, want] of [[['--day', '2026-11-01'], 'true'], [['--day', '2026-11-02'], 'false'], [['--at', '2026-11-01T07:17:00Z'], 'true'], [['--at', '2026-11-01T04:59:00Z'], 'false']]) {
    const out = join(dir, `out-${checks}`);
    const res = spawnSync(process.execPath, ['scripts/rebuild-today.mjs', ...args], { encoding: 'utf8', env: { ...process.env, GITHUB_OUTPUT: out } });
    const written = readFileSync(out, 'utf8');
    expect(res.status === 0 && res.stdout.trim().split('\n').length === 1, `rebuild-today ${args.join(' ')}: exit ${res.status}, ${JSON.stringify(res.stdout)}`);
    expect(written.includes(`rebuild=${want}\n`) && /^day=\d{4}-\d\d-\d\d$/m.test(written) && /^why=/m.test(written), `rebuild-today ${args.join(' ')}: $GITHUB_OUTPUT is ${JSON.stringify(written)}`);
  }
  const bad = spawnSync(process.execPath, ['scripts/rebuild-today.mjs', '--day', 'Nov 1'], { encoding: 'utf8' });
  expect(bad.status === 2, 'rebuild-today accepts a malformed --day');
} finally {
  rmSync(dir, { recursive: true, force: true });
}

if (failures.length) {
  console.error(`Rebuild tests failed (${failures.length} of ${checks}):\n  ${failures.join('\n  ')}`);
  process.exit(1);
}
console.log(`Rebuild tests passed: ${checks} checks; rebuild days ${[...listed].sort().join(', ')}; cron ${crons.join(' and ')} UTC.`);
