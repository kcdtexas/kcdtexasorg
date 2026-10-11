// The scheduled rebuild: scripts/rebuild-today.mjs picks exactly the days scripts/rebuild-dates.mjs lists, on
// the time machine's days and on every day in between, in Central time across both DST changes; the workflow's
// cron times land on the right Central day all year; and .github/workflows/rebuild.yml keeps its guards (pinned
// actions, least privilege, the secrets only in the production environment, never printed, no artifacts or
// caches, the keepalive, and no copied list of dates).
// The refresh policy (scripts/refresh-policy.mjs): every run type on every day of the Edition, Event Day's
// 5-minute runs and their edges, across DST, the Event Day cron against the Edition file, and the deploy budget:
// with no program change, March and April rebuild only on the rebuild days.
// No second deploy of one program change: after a program change the rebuild job notes the live program version
// before it starts the build and waits until the live site publishes another one, and runs queue behind each other.
// No version passes between the jobs or goes in the log. The note and the wait also run here, faster, against a
// local stand-in for the live site.
// Runs actionlint on the workflow when it's installed (or at $ACTIONLINT). No network beyond this machine, no build.
// Usage: node tests/rebuild.mjs
import { spawn, spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { parse } from 'yaml';
import { importTs } from '../scripts/lib/import-ts.mjs';
import { rebuildDates } from '../scripts/rebuild-dates.mjs';
import { BACKUP_CRON, MORNING_CRON, centralClock, eventDayCrons, refreshPolicy } from '../scripts/refresh-policy.mjs';
import { centralDay, rebuildToday } from '../scripts/rebuild-today.mjs';
import { liveVersionUrl } from '../src/lib/program-source/config.mjs';
import { DAYS } from './time-machine.mjs';

const { edition2027: edition } = await importTs(new URL('../src/data/edition-2027.ts', import.meta.url));

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
const allCrons = (wf.on?.schedule ?? []).map((s) => s.cron);
const crons = allCrons.filter((c) => c.endsWith(' * * *'));
const slotCrons = allCrons.filter((c) => !crons.includes(c));
expect(crons.length >= 1, 'the workflow has no daily schedule');
expect(JSON.stringify(crons) === JSON.stringify([MORNING_CRON, BACKUP_CRON]), `the daily crons ${JSON.stringify(crons)} are not scripts/refresh-policy.mjs's ${MORNING_CRON} and ${BACKUP_CRON}`);
// Event Day's 5-minute runs name the day, so a changed event day in the Edition file fails here.
expect(JSON.stringify(slotCrons) === JSON.stringify(eventDayCrons(edition.eventDay)), `the Event Day crons ${JSON.stringify(slotCrons)} don't match the Edition's event day ${edition.eventDay}: they should be ${JSON.stringify(eventDayCrons(edition.eventDay))}`);
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
const allowed = { check: { contents: 'read', actions: 'read' }, program: { contents: 'read' }, rebuild: {}, keepalive: { actions: 'write' } };
// The secrets each job may read, all from the production environment.
const secretsOf = { program: ['PROGRAM_CSV_URL', 'SESSIONIZE_ENDPOINT_ID'], rebuild: ['NETLIFY_BUILD_HOOK'] };
for (const [name, job] of Object.entries(wf.jobs)) {
  expect(name in allowed, `job "${name}" is not checked here`);
  expect(JSON.stringify(job.permissions) === JSON.stringify(allowed[name]), `job "${name}" has permissions ${JSON.stringify(job.permissions)}, not ${JSON.stringify(allowed[name])}`);
  const used = [...new Set(JSON.stringify(job).match(/secrets\.\w+/g) ?? [])].map((s) => s.slice(8)).sort();
  expect(JSON.stringify(used) === JSON.stringify(secretsOf[name] ?? []), `job "${name}" reads the secrets ${JSON.stringify(used)}, not ${JSON.stringify(secretsOf[name] ?? [])}`);
  if (used.length) expect(job.environment === 'production', `job "${name}" reads a secret outside the production environment`);
  for (const step of job.steps ?? []) {
    if (step.uses) expect(/^[\w.-]+\/[\w.-]+@[0-9a-f]{40}$/.test(step.uses), `job "${name}": ${step.uses} is not pinned by full commit SHA`);
    // No artifacts and no caches: nothing from the program outlives the run.
    if (step.uses) expect(!/^actions\/(cache|upload-artifact)\b/.test(step.uses), `job "${name}": ${step.uses} keeps files after the run`);
    if (step.uses?.startsWith('actions/setup-node@')) expect(step.with?.['package-manager-cache'] === false && !('cache' in (step.with ?? {})), `job "${name}": setup-node's npm cache is not off`);
    // Secrets reach a command only through env variables, and no command prints one.
    if (step.run) expect(!/secrets\./.test(step.run) && !/(echo|printf)[^\n]*\$\{?(HOOK|SESSIONIZE_ENDPOINT_ID|PROGRAM_CSV_URL)\b/.test(step.run), `job "${name}": a command uses or prints a secret`);
  }
}
// The program check: only after the check job finds a gate open, and its only command prints "changed" or "unchanged".
const prog = wf.jobs.program;
expect(prog?.needs === 'check' && prog?.if === "needs.check.outputs.program == 'true'", 'the program job does not wait for the check job to find a gate open');
expect(/check=\$\{p\.check\}/.test(readFileSync('scripts/rebuild-today.mjs', 'utf8')), 'scripts/rebuild-today.mjs does not write check= for the program job');
expect(prog?.steps?.filter((s) => s.run).map((s) => s.run.trim()).join(' | ') === 'npm ci --ignore-scripts --no-audit --no-fund | node scripts/program-check.mjs', `the program job runs ${JSON.stringify(prog?.steps?.map((s) => s.run).filter(Boolean))}`);
expect(prog?.outputs?.changed === '${{ steps.compare.outputs.changed }}', 'the program job does not pass on changed=');
expect(/needs\.program\.outputs\.changed == 'true'/.test(wf.jobs.rebuild?.if ?? '') && /needs\.check\.outputs\.rebuild == 'true'/.test(wf.jobs.rebuild?.if ?? ''), 'the rebuild job does not rebuild on a rebuild day and on a change');
expect(wf.jobs.rebuild?.environment === 'production', 'the rebuild job does not name the production environment');
expect(/secrets\.NETLIFY_BUILD_HOOK/.test(JSON.stringify(wf.jobs.rebuild?.steps)), 'the rebuild job does not use NETLIFY_BUILD_HOOK');
// No second deploy of one program change. After a program change (a rebuild day or a forced run doesn't wait), the
// rebuild job notes the live program version just before the build hook, in a file on the runner, and after the
// hook waits until the live version differs from it (or appears, if there was none), checking every 20 seconds or
// so for at most 10 minutes; it fails with a pointer to Netlify's deploy log. No job passes a version on, no step's
// environment holds one, and no command prints one. Runs queue in one group, so the next run sees the new live site.
const rebuildSteps = wf.jobs.rebuild?.steps ?? [];
const hookAt = rebuildSteps.findIndex((s) => /secrets\.NETLIFY_BUILD_HOOK/.test(JSON.stringify(s)));
const readsLive = (s) => /program-version\.txt/.test(JSON.stringify(s));
const noteAt = rebuildSteps.findIndex(readsLive);
const waitAt = rebuildSteps.findLastIndex(readsLive);
const [note, wait] = [rebuildSteps[noteAt], rebuildSteps[waitAt]];
const noteRun = note?.run ?? '';
const loop = wait?.run ?? '';
const afterChange = "needs.program.outputs.changed == 'true' && needs.check.outputs.rebuild != 'true'";
expect(hookAt >= 0 && noteAt >= 0 && noteAt < hookAt && hookAt < waitAt, 'the rebuild job does not note the live program version before the build hook and wait for a new one after it');
expect(note?.if === afterChange && wait?.if === afterChange, `the note and the wait run on ${JSON.stringify(note?.if)} and ${JSON.stringify(wait?.if)}: both must run only after a program change, not on a rebuild day or a forced run`);
expect(JSON.stringify(note?.env) === JSON.stringify({ LIVE: liveVersionUrl }) && JSON.stringify(wait?.env) === JSON.stringify({ LIVE: liveVersionUrl }), `the note's and the wait's environments are ${JSON.stringify(note?.env)} and ${JSON.stringify(wait?.env)}, not only LIVE, ${liveVersionUrl} (src/lib/program-source/config.mjs)`);
expect(/> "\$RUNNER_TEMP\/live-version"\s*$/.test(noteRun) && /^\s*before="\$\(cat "\$RUNNER_TEMP\/live-version"\)"/m.test(loop), 'the note does not keep the live version in a file on the runner for the wait');
expect(Object.values(wf.jobs).every((j) => !Object.keys(j.outputs ?? {}).some((k) => /version/i.test(k))), 'a job passes a program version on to another');
const deadline = Number(loop.match(/SECONDS \+ (\d+)\)/)?.[1]);
const every = Number(loop.match(/\bsleep (\d+)\b/)?.[1]);
expect(deadline > 0 && deadline <= 600 && every >= 10 && every <= 30, `the wait checks every ${every} s for ${deadline} s, not every 10 to 30 s for at most 10 minutes`);
expect(wf.jobs.rebuild?.['timeout-minutes'] * 60 >= deadline + 120, `the rebuild job's ${wf.jobs.rebuild?.['timeout-minutes']}-minute timeout ends before the wait's own message`);
expect(/::error::[^\n]*Netlify[^\n]*deploy log/.test(loop) && /\bexit 1\s*$/.test(loop), 'the wait does not fail with a message that points to the deploy log in Netlify');
expect(/\[ -n "\$got" \] && \[ "\$got" != "\$before" \]/.test(loop), 'the wait could end on a missing live file, or on the version it noted');
// A command may write a version to the note's file, and nowhere else: not to the log, and not to $GITHUB_ENV or
// $GITHUB_OUTPUT, whose values show in later steps' logs.
for (const [name, job] of Object.entries(wf.jobs)) {
  for (const step of job.steps ?? []) {
    for (const line of (step.run ?? '').split('\n')) {
      const prints = /\b(?:echo|printf|cat)\b[^\n]*\$\{?(?:live|before|got|VERSION)\b/.test(line) && !/> "\$RUNNER_TEMP\/live-version"\s*$/.test(line);
      expect(!/set -x/.test(line) && !prints && !(/GITHUB_(?:ENV|OUTPUT)/.test(line) && /\$\{?(?:live|before|got)\b/.test(line)), `job "${name}": "${line.trim()}" could print a program version`);
    }
  }
}
expect(JSON.stringify(wf.concurrency) === JSON.stringify({ group: 'rebuild', 'cancel-in-progress': false }), `the workflow's concurrency is ${JSON.stringify(wf.concurrency)}: runs must queue in one group and never cancel each other`);
expect(Object.values(wf.jobs).every((j) => j.concurrency === undefined), 'a job sets a concurrency of its own');
expect(/node scripts\/rebuild-today\.mjs/.test(raw), 'the workflow does not ask scripts/rebuild-today.mjs');
expect(!/\b20\d\d-\d\d-\d\d\b/.test(raw), 'the workflow has a date in it: it must take the dates from scripts/rebuild-dates.mjs');
// The 60-day rule: a scheduled job re-enables the workflow through the API, with actions: write.
const keep = wf.jobs.keepalive;
expect(/github\.event_name == 'schedule'/.test(keep?.if ?? ''), 'the keepalive does not run on the schedule');
expect(crons.some((c) => (keep?.if ?? '').includes(c)), 'the keepalive is tied to no cron time of the schedule');
expect(/gh api -X PUT "repos\/\$GITHUB_REPOSITORY\/actions\/workflows\/rebuild\.yml\/enable"/.test(JSON.stringify(keep?.steps ?? []).replace(/\\"/g, '"')), 'the keepalive does not enable the workflow through the API');

// The refresh policy. Its window comes from the Edition file: the program's day to the eve of Event Day.
const calendar = { rebuildDays: rebuildDates(), programDay: edition.schedule, eventDay: edition.eventDay };
expect(calendar.programDay === '2027-03-01' && calendar.eventDay === '2027-04-23', `the program's day and Event Day are ${calendar.programDay} and ${calendar.eventDay}, not Mar 1 and Apr 23, 2027: check this test and docs/rebuilds.md`);
const GATES = { closed: { speakersPublic: false, schedulePublic: false }, speakers: { speakersPublic: true, schedulePublic: false }, both: { speakersPublic: true, schedulePublic: true } };
const morning = { event: 'schedule', cron: MORNING_CRON };
const backup = { event: 'schedule', cron: BACKUP_CRON };
const slotTrigger = (cron = slotCrons[0]) => ({ event: 'schedule', cron });
const utc = (day, hhmm) => new Date(`${day}T${hhmm}:00Z`);
const inWindow = (day) => day >= calendar.programDay && day < calendar.eventDay;

// Every minute (UTC) a cron line fires between two instants. Handles "*", "a", "a-b", "a-b/s", "*/s" and lists.
function cronTimes(cron, from, until) {
  const fields = cron.split(' ');
  const sets = fields.map((f, i) => {
    const [lo, hi] = [[0, 59], [0, 23], [1, 31], [1, 12], [0, 6]][i];
    const s = new Set();
    for (const part of f.split(',')) {
      const [range, step = '1'] = part.split('/');
      const [a, b] = range === '*' ? [lo, hi] : range.includes('-') ? range.split('-').map(Number) : [Number(range), step === '1' ? Number(range) : hi];
      for (let v = a; v <= b; v += Number(step)) s.add(v);
    }
    return s;
  });
  const out = [];
  for (let t = from.getTime(); t < until.getTime(); t += 60_000) {
    const d = new Date(t);
    if (sets[0].has(d.getUTCMinutes()) && sets[1].has(d.getUTCHours()) && sets[2].has(d.getUTCDate()) && sets[3].has(d.getUTCMonth() + 1) && sets[4].has(d.getUTCDay())) out.push(d);
  }
  return out;
}

// Every day of the Edition and 60 days after: each run type, each gate state, before and after a check.
for (const day of [...days].sort()) {
  const hit = listed.has(day);
  for (const [gname, gates] of Object.entries(GATES)) {
    const open = gname !== 'closed';
    for (const changed of [undefined, false, true]) {
      const tag = `${day} gates ${gname} changed ${changed}`;
      const m = refreshPolicy({ at: utc(day, '07:17'), trigger: morning, calendar, gates, changed });
      const wantCheck = !hit && open && inWindow(day);
      expect(m.day === day && m.kind === 'morning', `${tag}: the morning run is ${m.kind} on ${m.day}`);
      expect(m.check === wantCheck, `${tag}: the morning run ${m.check ? 'checks' : "doesn't check"} the program`);
      expect(m.rebuild === (hit || (wantCheck && changed === true)), `${tag}: the morning run ${m.rebuild ? 'rebuilds' : "doesn't rebuild"}`);
      const manual = refreshPolicy({ at: utc(day, '15:00'), trigger: { event: 'workflow_dispatch', force: false }, calendar, gates, changed });
      expect(manual.rebuild === m.rebuild && manual.check === m.check, `${tag}: a manual run doesn't do what the morning run does`);
      expect(refreshPolicy({ at: utc(day, '15:00'), trigger: { event: 'workflow_dispatch', force: true }, calendar, gates, changed }).rebuild, `${tag}: a forced run doesn't rebuild`);
      const b = refreshPolicy({ at: utc(day, '10:47'), trigger: backup, calendar, gates, changed });
      expect(b.rebuild === hit && !b.check, `${tag}: the backup run ${b.check ? 'checks' : b.rebuild ? 'rebuilds' : 'skips'}`);
      // An Event Day cron at midday: it checks only on Event Day with a gate open.
      const s = refreshPolicy({ at: utc(day, '17:02'), trigger: slotTrigger(), calendar, gates, changed });
      const slotCheck = day === calendar.eventDay && open;
      expect(s.check === slotCheck && s.rebuild === (slotCheck && changed === true), `${tag}: a 5-minute run at 12:02 p.m. ${s.check ? 'checks' : "doesn't check"} and ${s.rebuild ? 'rebuilds' : "doesn't rebuild"}`);
    }
  }
}
expect(!refreshPolicy({ at: utc('2027-03-05', '07:17'), trigger: { event: 'schedule', cron: '0 * * * *' }, calendar, gates: GATES.both, changed: true }).rebuild, 'a cron the policy does not know rebuilds');

// Event Day's slots: 144 runs, 7:02 a.m. to 6:57 p.m. Central, each a check; the window's edges.
const eventSlots = slotCrons.flatMap((c) => cronTimes(c, utc(shift(calendar.eventDay, -1), '00:00'), utc(shift(calendar.eventDay, 2), '00:00'))).sort((a, b) => a - b);
const hm = (d) => { const { minutes } = centralClock(d); return `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`; };
expect(eventSlots.length === 144, `Event Day has ${eventSlots.length} 5-minute runs, not 144`);
expect(eventSlots.length && hm(eventSlots[0]) === '07:02' && hm(eventSlots.at(-1)) === '18:57', `Event Day's runs go from ${eventSlots[0] && hm(eventSlots[0])} to ${eventSlots.at(-1) && hm(eventSlots.at(-1))} Central, not 07:02 to 18:57`);
for (const at of eventSlots) {
  for (const changed of [false, true]) {
    const p = refreshPolicy({ at, trigger: slotTrigger(slotCrons.find((c) => cronTimes(c, at, new Date(at.getTime() + 60_000)).length)), calendar, gates: GATES.speakers, changed });
    expect(p.day === calendar.eventDay && p.check && p.rebuild === changed, `${at.toISOString()} (${hm(at)} Central): an Event Day run ${p.check ? 'checks' : "doesn't check"}, rebuild ${p.rebuild}`);
  }
  expect(!refreshPolicy({ at, trigger: slotTrigger(), calendar, gates: GATES.closed, changed: true }).check, `${at.toISOString()}: an Event Day run checks with the gates closed`);
}
// A late run counts by when it starts: before 7 a.m. or from 7 p.m. Central, nothing.
const offset = (centralClock(utc(calendar.eventDay, '12:00')).minutes - 12 * 60) / 60; // -5 in CDT, -6 in CST
for (const [minutes, want] of [[6 * 60 + 59, false], [7 * 60, true], [7 * 60 + 2, true], [18 * 60 + 57, true], [18 * 60 + 59, true], [19 * 60, false], [19 * 60 + 2, false], [23 * 60 + 59, false]]) {
  const at = new Date(Date.UTC(...calendar.eventDay.split('-').map((v, i) => Number(v) - (i === 1 ? 1 : 0)), 0, minutes - offset * 60));
  const p = refreshPolicy({ at, trigger: slotTrigger(), calendar, gates: GATES.both, changed: true });
  expect(p.day === calendar.eventDay && p.minutes === minutes, `the edge test's ${at.toISOString()} is ${p.day} ${p.minutes}, not ${minutes} minutes into Event Day`);
  expect(p.check === want && p.rebuild === want, `an Event Day run at ${hm(at)} Central ${p.check ? 'checks' : "doesn't check"}`);
}

// Across DST: on any day, CST or CDT or a change day, the generated crons run every 5 minutes from 7:02 a.m. to
// 6:57 p.m. Central, all on that day, and nowhere else.
for (const day of ['2026-11-01', '2026-11-02', '2027-01-15', '2027-03-13', '2027-03-14', '2027-04-23', '2027-11-07']) {
  const lines = eventDayCrons(day);
  const times = lines.flatMap((c) => cronTimes(c, utc(shift(day, -1), '00:00'), utc(shift(day, 2), '00:00'))).sort((a, b) => a - b);
  const clocks = times.map((t) => centralClock(t));
  expect(lines.every((c) => /^2-59\/5 \d+(-\d+)? \d+ \d+ \*$/.test(c)), `${day}: the crons ${JSON.stringify(lines)} are not 5-minute lines at 2 past`);
  expect(times.length === 144 && clocks.every((c) => c.day === day && c.minutes >= 7 * 60 && c.minutes < 19 * 60), `${day}: the crons ${JSON.stringify(lines)} run ${times.length} times, not 144 within 7 a.m. to 7 p.m. Central`);
  expect(times.length && hm(times[0]) === '07:02' && hm(times.at(-1)) === '18:57', `${day}: the crons ${JSON.stringify(lines)} start or end at the wrong time`);
  const cal = { ...calendar, eventDay: day };
  expect(times.every((at) => refreshPolicy({ at, trigger: { event: 'schedule', cron: lines.find((c) => cronTimes(c, at, new Date(at.getTime() + 60_000)).length) }, calendar: cal, gates: GATES.both }).check), `${day}: an Event Day run doesn't check`);
}

// The deploy budget (ADR 0010): every run in March and April 2027, as GitHub starts them, with no program change
// and the gates open or closed. A backup run follows a successful morning run, so it skips. Only the rebuild days
// may rebuild.
const budgetDays = [];
for (let d = '2027-03-01'; d <= '2027-04-30'; d = shift(d, 1)) budgetDays.push(d);
const wantBudget = budgetDays.filter((d) => listed.has(d));
const budgetCount = {};
for (const [gname, gates] of Object.entries(GATES)) {
  const rebuilt = [];
  let asked = 0;
  for (const day of budgetDays) {
    const m = refreshPolicy({ at: utc(day, '07:17'), trigger: morning, calendar, gates, changed: false });
    if (m.check) asked += 1;
    if (m.rebuild) rebuilt.push(day);
    const b = refreshPolicy({ at: utc(day, '10:47'), trigger: backup, calendar, gates, changed: false });
    if (b.rebuild && !m.rebuild) rebuilt.push(day);
    for (const cron of slotCrons) {
      for (const at of cronTimes(cron, utc(day, '00:00'), utc(shift(day, 1), '00:00'))) {
        const s = refreshPolicy({ at, trigger: slotTrigger(cron), calendar, gates, changed: false });
        if (s.check) asked += 1;
        if (s.rebuild) rebuilt.push(day);
      }
    }
  }
  budgetCount[gname] = rebuilt.length;
  expect(JSON.stringify(rebuilt) === JSON.stringify(wantBudget), `gates ${gname}: March and April rebuild on ${rebuilt.join(', ')}, not only the rebuild days ${wantBudget.join(', ')}`);
  expect(gname === 'closed' ? asked === 0 : asked > 0, `gates ${gname}: March and April check the program ${asked} times`);
}

// The program check with the gates closed in the checked-out Edition file: "unchanged", no platform call.
if (!edition.program.speakersPublic && !edition.program.schedulePublic) {
  const res = spawnSync(process.execPath, ['scripts/program-check.mjs'], { encoding: 'utf8', env: { ...process.env, SESSIONIZE_ENDPOINT_ID: '', PROGRAM_CSV_URL: '', GITHUB_OUTPUT: '' } });
  expect(res.status === 0 && res.stdout === 'unchanged\n', `program-check with the gates closed: exit ${res.status}, ${JSON.stringify(res.stdout)}`);
}

// The note and the wait as GitHub runs them, the wait with a 3-second limit and 0.2-second checks, against a local
// stand-in for the live site. The wait ends once the live version differs from the noted one (on the third request),
// or once a missing file appears; it fails with its message when the live version stays the same or stays missing.
// Neither prints a version.
if (noteRun && loop) {
  const [OLD, NEW] = ['b1'.repeat(32), 'f0'.repeat(32)];
  let hits = 0;
  let serve = () => null;
  const site = createServer((req, res) => {
    hits += 1;
    const body = serve();
    res.writeHead(body === null ? 404 : 200, { 'content-type': 'text/plain' });
    res.end(body === null ? 'Not found' : `${body}\n`);
  });
  await new Promise((r) => site.listen(0, '127.0.0.1', r));
  const runner = mkdtempSync(join(tmpdir(), 'rebuild-runner-'));
  const fast = loop.replace(/SECONDS \+ \d+\)/, 'SECONDS + 3)').replace(/\bsleep \d+\b/, 'sleep 0.2');
  const runStep = (script) => new Promise((resolve) => {
    hits = 0;
    const env = { ...process.env, NO_PROXY: '127.0.0.1', no_proxy: '127.0.0.1', RUNNER_TEMP: runner, LIVE: `http://127.0.0.1:${site.address().port}/2027/program-version.txt` };
    const child = spawn('bash', ['--noprofile', '--norc', '-eo', 'pipefail', '-c', script], { env });
    let out = '';
    for (const s of [child.stdout, child.stderr]) s.on('data', (d) => { out += d; });
    child.on('close', (status) => resolve({ status, out, hits }));
  });
  try {
    for (const [what, atNote, inWait, wantStatus, wantHits] of [
      ['a new version replaces the noted one', () => OLD, () => (hits >= 3 ? NEW : OLD), 0, 3],
      ['the noted version stays live', () => OLD, () => OLD, 1, null],
      ['a missing file appears', () => null, () => (hits >= 2 ? NEW : null), 0, 2],
      ['the file stays missing', () => null, () => null, 1, null],
    ]) {
      serve = atNote;
      const n = await runStep(noteRun);
      serve = inWait;
      const w = await runStep(fast);
      const kept = readFileSync(join(runner, 'live-version'), 'utf8');
      const all = n.out + w.out;
      expect(n.status === 0 && kept === (atNote() ?? ''), `${what}: the note exits ${n.status} and keeps ${JSON.stringify(kept)}`);
      expect(w.status === wantStatus && (wantHits === null || w.hits === wantHits), `${what}: the wait exits ${w.status} after ${w.hits} requests, not ${wantStatus}${wantHits === null ? '' : ` after ${wantHits}`}: ${JSON.stringify(w.out)}`);
      expect(wantStatus === 0 ? /has the new program/.test(w.out) : /^::error::.*Netlify/m.test(w.out), `${what}: the wait says ${JSON.stringify(w.out)}`);
      expect(!all.includes(OLD) && !all.includes(NEW), `${what}: the note or the wait prints a version: ${JSON.stringify(all)}`);
    }
  } finally {
    site.close();
    rmSync(runner, { recursive: true, force: true });
  }
}

// actionlint, when it's installed (or named by $ACTIONLINT).
const actionlint = process.env.ACTIONLINT || 'actionlint';
const lint = spawnSync(actionlint, ['-no-color', '.github/workflows/rebuild.yml'], { encoding: 'utf8' });
let linted = 'actionlint not installed: skipped';
if (!lint.error) {
  expect(lint.status === 0, `actionlint: ${lint.stdout}${lint.stderr}`);
  linted = `actionlint ${spawnSync(actionlint, ['-version'], { encoding: 'utf8' }).stdout.split('\n')[0]} passed`;
}

// The script as the workflow runs it: one line, and rebuild=, day= and why= in $GITHUB_OUTPUT.
const dir = mkdtempSync(join(tmpdir(), 'rebuild-'));
try {
  // As the workflow calls it: --cron empty and --force "false" on a manual run.
  const open = edition.program.speakersPublic || edition.program.schedulePublic;
  for (const [args, want, check = false] of [
    [['--day', '2026-11-01'], 'true'],
    [['--day', '2026-11-02'], 'false'],
    [['--at', '2026-11-01T07:17:00Z'], 'true'],
    [['--at', '2026-11-01T04:59:00Z'], 'false'],
    [['--at', '2026-11-01T07:17:00Z', '--cron', MORNING_CRON, '--force', 'false'], 'true'],
    [['--at', '2026-11-02T10:47:00Z', '--cron', BACKUP_CRON, '--force', 'false'], 'false'],
    [['--at', '2026-11-02T15:00:00Z', '--cron', '', '--force', 'true'], 'true'],
    [['--at', '2027-03-05T07:17:00Z', '--cron', MORNING_CRON, '--force', 'false'], 'false', open],
    [['--at', `${calendar.eventDay}T17:02:00Z`, '--cron', slotCrons[0], '--force', 'false'], 'false', open],
  ]) {
    const out = join(dir, `out-${checks}`);
    const res = spawnSync(process.execPath, ['scripts/rebuild-today.mjs', ...args], { encoding: 'utf8', env: { ...process.env, GITHUB_OUTPUT: out } });
    const written = readFileSync(out, 'utf8');
    expect(res.status === 0 && res.stdout.trim().split('\n').length === 1, `rebuild-today ${args.join(' ')}: exit ${res.status}, ${JSON.stringify(res.stdout)}`);
    expect(written.includes(`rebuild=${want}\n`) && written.includes(`check=${check}\n`) && /^day=\d{4}-\d\d-\d\d$/m.test(written) && /^why=/m.test(written), `rebuild-today ${args.join(' ')}: $GITHUB_OUTPUT is ${JSON.stringify(written)}`);
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
console.log(`Rebuild tests passed: ${checks} checks; rebuild days ${[...listed].sort().join(', ')}; cron ${allCrons.join(' and ')} UTC; March and April with no program change rebuild ${budgetCount.both} times (${wantBudget.join(', ')}); ${linted}.`);
