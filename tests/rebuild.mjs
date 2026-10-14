// The scheduled rebuild: scripts/rebuild-today.mjs picks exactly the days scripts/rebuild-dates.mjs lists, on
// the time machine's days and on every day in between, in Central time across both DST changes; the workflow's
// cron times land on the right Central day all year; and .github/workflows/rebuild.yml keeps its guards (pinned
// actions, least privilege, the secrets only in the production environment, never printed, no artifacts or
// caches, the keepalive, and no copied list of dates).
// The refresh policy (scripts/refresh-policy.mjs): every run type on every day of the Edition, Event Day's
// 5-minute runs and their edges, across DST, the Event Day cron against the Edition file, and the deploy budget:
// with no program change, March and April rebuild only on the rebuild days; with a change every day, the program
// deploys stay within DEPLOY_BUDGET's caps, also across DST and after a forced run; with the last program deploy's
// time unreadable, nothing deploys. scripts/last-program-deploy.mjs against a stand-in for GitHub's API.
// No second deploy of one program change: after a program change the rebuild job notes the live program version
// before it starts the build and waits until the live site publishes another one, and runs queue behind each other.
// Only a 404 leaves the note empty; any other failure to read the version stops the job before the build. No
// version passes between the jobs or goes in the log. The note and the wait also run here, faster, against a local
// stand-in for the live site, with a 404, a 503 and no answer.
// Runs actionlint on the workflow when it's installed (or at $ACTIONLINT), with shellcheck when that's installed too.
// No network beyond this machine, no build.
// Usage: node tests/rebuild.mjs
import { spawn, spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { parse } from 'yaml';
import { importTs } from '../scripts/lib/import-ts.mjs';
import { rebuildDates } from '../scripts/rebuild-dates.mjs';
import { HOOK_STEP, PROGRAM_DEPLOY_JOB, deployedIn, hookedIn, lastBuildHook, lastProgramDeploy } from '../scripts/last-program-deploy.mjs';
import { DEPLOY_BUDGET, MORNING_CRON, RETRY_CRONS, centralClock, eventDayCrons, refreshPolicy } from '../scripts/refresh-policy.mjs';
import { LIVE_DAY_URL, centralDay, liveBuildDay, rebuildToday } from '../scripts/rebuild-today.mjs';
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
const DAILY = [MORNING_CRON, ...RETRY_CRONS];
expect(JSON.stringify(crons) === JSON.stringify(DAILY), `the daily crons ${JSON.stringify(crons)} are not scripts/refresh-policy.mjs's ${DAILY.join(', ')}`);
expect(crons.length <= 4, `${crons.length} daily schedules, more than 4`);
// Each daily run's Central time, in CDT and in CST: the morning run early, the later runs by noon.
const CENTRAL = { '17 7 * * *': ['02:17', '01:17'], '47 10 * * *': ['05:47', '04:47'], '17 13 * * *': ['08:17', '07:17'], '17 16 * * *': ['11:17', '10:17'] };
for (const cron of crons) {
  const [min, hour] = cron.split(' ');
  // DST starts at 08:00 UTC on Mar 14, 2027: that day's morning run is still in CST, its later runs in CDT.
  for (const [i, day] of [[0, '2026-10-31'], [1, '2026-11-01'], [1, '2026-12-31'], [1, '2027-01-01'], [1, '2027-03-13'], [cron === MORNING_CRON ? 1 : 0, '2027-03-14'], [0, '2027-04-23'], [0, '2027-04-24']]) {
    const c = centralClock(new Date(`${day}T${hour.padStart(2, '0')}:${min.padStart(2, '0')}:00Z`));
    const got = `${String(Math.floor(c.minutes / 60)).padStart(2, '0')}:${String(c.minutes % 60).padStart(2, '0')}`;
    expect(CENTRAL[cron]?.[i] === got && c.day === day, `cron "${cron}" on ${day} runs at ${c.day} ${got} Central, not ${CENTRAL[cron]?.[i]}`);
  }
}
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
  // By noon Central in CDT (17:00 UTC), so a day's later runs still fall on that day when GitHub starts them hours late.
  expect(Number(hour) < 17, `cron "${cron}" runs after noon Central`);
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
// The deploy budget finds program deploys by the rebuild job's name and its build hook step (scripts/last-program-deploy.mjs).
expect(wf.jobs.rebuild?.name === `\${{ (needs.check.outputs.forced == 'true' || (needs.program.outputs.changed == 'true' && needs.check.outputs.rebuild != 'true')) && '${PROGRAM_DEPLOY_JOB}' || 'Scheduled rebuild' }}`, `the rebuild job's name ${JSON.stringify(wf.jobs.rebuild?.name)} doesn't mark a forced run or a program change as "${PROGRAM_DEPLOY_JOB}"`);
expect((wf.jobs.rebuild?.steps ?? []).filter((st) => st.name === HOOK_STEP).length === 1 && /secrets\.NETLIFY_BUILD_HOOK/.test(JSON.stringify((wf.jobs.rebuild?.steps ?? []).find((st) => st.name === HOOK_STEP))), `no step named "${HOOK_STEP}" calls the build hook`);
expect(wf.jobs.check?.outputs?.forced === '${{ steps.today.outputs.forced }}', 'the check job does not pass on forced=');
// The catch-up decides in scripts/rebuild-today.mjs alone: the check job passes its rebuild= on as it is.
expect(wf.jobs.check?.outputs?.rebuild === '${{ steps.today.outputs.rebuild }}', 'the check job does not pass on the script\'s rebuild= as it is');
expect((wf.jobs.check?.steps ?? []).filter((st) => st.run).map((st) => st.run.trim()).join(' | ') === 'npm ci --ignore-scripts --no-audit --no-fund | node scripts/rebuild-today.mjs --cron "$CRON" --force "$FORCE"', `the check job runs ${JSON.stringify((wf.jobs.check?.steps ?? []).map((st) => st.run).filter(Boolean))}`);
// After a rebuild day's build or a forced one, the rebuild job waits until the live /build.txt has the run's day or a
// later one, so the next run (queued behind it) finds it live and doesn't deploy again.
const dayWait = (wf.jobs.rebuild?.steps ?? []).find((st) => /build\.txt/.test(JSON.stringify(st.env ?? {})));
const dayLoop = dayWait?.run ?? '';
expect(dayWait && (wf.jobs.rebuild.steps.indexOf(dayWait) > hookIndex()) && dayWait.if === "needs.check.outputs.rebuild == 'true'", `the rebuild job doesn't wait for the new day after the build hook on a rebuild: ${JSON.stringify(dayWait?.if)}`);
expect(dayWait?.env?.LIVE === LIVE_DAY_URL && dayWait?.env?.DAY === '${{ needs.check.outputs.day }}', `the day wait reads ${JSON.stringify(dayWait?.env)}, not ${LIVE_DAY_URL} and the check job's day`);
expect(Number(dayLoop.match(/SECONDS \+ (\d+)\)/)?.[1]) <= 600 && Number(dayLoop.match(/\bsleep (\d+)\b/)?.[1]) >= 10 && /::error::[^\n]*Netlify[^\n]*deploy log/.test(dayLoop) && /\bexit 1\s*$/.test(dayLoop), 'the day wait does not check every 10 s or more for at most 10 minutes, then fail with a pointer to Netlify');
expect(/\[\[ "\$built" =~ \^\[0-9\]\{4\}-\[0-9\]\{2\}-\[0-9\]\{2\}\$ \]\] && \[\[ ! "\$built" < "\$DAY" \]\]/.test(dayLoop), 'the day wait could end on a missing or older live day');
// A re-run reuses the check's old answer, so only a forced run's re-run reaches the hook; the POST has a time limit
// and doesn't retry every error, since Netlify may have started a build before it failed to answer.
expect(/&& \(github\.run_attempt == 1 \|\| needs\.check\.outputs\.forced == 'true'\) \}\}$/.test(wf.jobs.rebuild?.if ?? ''), `the rebuild job runs on a re-run: ${wf.jobs.rebuild?.if}`);
const hookRun = (wf.jobs.rebuild?.steps ?? [])[hookIndex()]?.run ?? '';
expect(/--max-time \d+/.test(hookRun) && !/--retry-all-errors/.test(hookRun), 'the build hook has no time limit, or retries every error');
function hookIndex() { return (wf.jobs.rebuild?.steps ?? []).findIndex((st) => st.name === HOOK_STEP); }
const todayStep = (wf.jobs.check?.steps ?? []).find((st) => st.id === 'today');
expect(todayStep?.env?.GH_TOKEN === '${{ github.token }}' && wf.jobs.check?.permissions?.actions === 'read', "the check job can't read the last program deploy: no GH_TOKEN or no actions: read");
expect(/secrets\.NETLIFY_BUILD_HOOK/.test(JSON.stringify(wf.jobs.rebuild?.steps)), 'the rebuild job does not use NETLIFY_BUILD_HOOK');
// No second deploy of one program change. After a program change (a rebuild day or a forced run doesn't wait), the
// rebuild job notes the live program version just before the build hook, in a file on the runner, with the HTTP
// status: a 404 leaves the note empty (no program is live yet), and any other failure stops the job before the
// hook, since an empty note would let the wait take the old version for the new one. After the hook it waits until
// the live version differs from the note (or appears, if there was none), checking every 20 seconds or so for at
// most 10 minutes; it fails with a pointer to Netlify's deploy log. No job passes a version on, no step's
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
expect(/-o "\$RUNNER_TEMP\/live-version"/.test(noteRun) && /^\s*before="\$\(cat "\$RUNNER_TEMP\/live-version"\)"/m.test(loop), 'the note does not keep the live version in a file on the runner for the wait');
expect(/%\{http_code\}/.test(noteRun) && /--retry \d+/.test(noteRun) && /--max-time \d+/.test(noteRun), 'the note does not record the HTTP status, or has no retries or time limit');
// The hook runs only after the note succeeded: no always(), failure() or cancelled() in its condition.
expect(!/\b(?:always|failure|cancelled)\(\)/.test(rebuildSteps[hookAt]?.if ?? ''), `the build hook runs on ${JSON.stringify(rebuildSteps[hookAt]?.if)}, even after a failed note`);
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
      const prints = /\b(?:echo|printf|cat)\b[^\n]*\$\{?(?:live|noted|before|got|VERSION)\b/.test(line) && !/> "\$RUNNER_TEMP\/live-version"\s*$/.test(line);
      expect(!/set -x/.test(line) && !prints && !(/GITHUB_(?:ENV|OUTPUT)/.test(line) && /\$\{?(?:live|noted|before|got)\b/.test(line)), `job "${name}": "${line.trim()}" could print a program version`);
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
expect(keep?.if === `github.event_name == 'schedule' && github.event.schedule == '${MORNING_CRON}'`, `the keepalive runs on ${JSON.stringify(keep?.if)}, not once a day with the morning run`);
expect(/gh api -X PUT "repos\/\$GITHUB_REPOSITORY\/actions\/workflows\/rebuild\.yml\/enable"/.test(JSON.stringify(keep?.steps ?? []).replace(/\\"/g, '"')), 'the keepalive does not enable the workflow through the API');

// The refresh policy. Its window comes from the Edition file: the program's day to the eve of Event Day.
const calendar = { rebuildDays: rebuildDates(), programDay: edition.schedule, eventDay: edition.eventDay };
expect(calendar.programDay === '2027-03-01' && calendar.eventDay === '2027-04-23', `the program's day and Event Day are ${calendar.programDay} and ${calendar.eventDay}, not Mar 1 and Apr 23, 2027: check this test and docs/rebuilds.md`);
const GATES = { closed: { speakersPublic: false, schedulePublic: false }, speakers: { speakersPublic: true, schedulePublic: false }, both: { speakersPublic: true, schedulePublic: true } };
const morning = { event: 'schedule', cron: MORNING_CRON };
const retries = RETRY_CRONS.map((cron) => ({ event: 'schedule', cron }));
const hhmmOf = (cron) => `${cron.split(' ')[1].padStart(2, '0')}:${cron.split(' ')[0].padStart(2, '0')}`;
// No build hook used since the newest rebuild day began, unless a test says otherwise. Without liveDay, the live
// build counts as a day old, as for a live site with no /build.txt yet.
const policy = (input) => refreshPolicy({ hooked: null, ...input });
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
      const m = policy({ at: utc(day, '07:17'), trigger: morning, calendar, gates, changed, lastDeploy: null });
      const wantCheck = !hit && open && inWindow(day);
      expect(m.day === day && m.kind === 'morning', `${tag}: the morning run is ${m.kind} on ${m.day}`);
      expect(m.check === wantCheck, `${tag}: the morning run ${m.check ? 'checks' : "doesn't check"} the program`);
      expect(m.rebuild === (hit || (wantCheck && changed === true)), `${tag}: the morning run ${m.rebuild ? 'rebuilds' : "doesn't rebuild"}`);
      const manual = policy({ at: utc(day, '15:00'), trigger: { event: 'workflow_dispatch', force: false }, calendar, gates, changed, lastDeploy: null });
      expect(manual.rebuild === m.rebuild && manual.check === m.check, `${tag}: a manual run doesn't do what the morning run does`);
      expect(refreshPolicy({ at: utc(day, '15:00'), trigger: { event: 'workflow_dispatch', force: true }, calendar, gates, changed }).rebuild, `${tag}: a forced run doesn't rebuild`);
      // The later daily runs: a rebuild day's rebuild while the live build is a day old, never a check; nothing once
      // the live build is today's.
      for (const r of retries) {
        const b = policy({ at: utc(day, hhmmOf(r.cron)), trigger: r, calendar, gates, changed });
        expect(b.kind === 'retry' && b.rebuild === hit && !b.check, `${tag}: the ${r.cron} run ${b.check ? 'checks' : b.rebuild ? 'rebuilds' : 'skips'}`);
        const done = policy({ at: utc(day, hhmmOf(r.cron)), trigger: r, calendar, gates, changed, liveDay: day });
        expect(!done.rebuild && !done.check, `${tag}: the ${r.cron} run ${done.check ? 'checks' : 'rebuilds'} with today's build live`);
      }
      // An Event Day cron at midday: it checks only on Event Day with a gate open.
      const s = policy({ at: utc(day, '17:02'), trigger: slotTrigger(), calendar, gates, changed, lastDeploy: null, liveDay: day });
      const slotCheck = day === calendar.eventDay && open;
      expect(s.check === slotCheck && s.rebuild === (slotCheck && changed === true), `${tag}: a 5-minute run at 12:02 p.m. ${s.check ? 'checks' : "doesn't check"} and ${s.rebuild ? 'rebuilds' : "doesn't rebuild"}`);
    }
  }
}
expect(!policy({ at: utc('2027-03-05', '07:17'), trigger: { event: 'schedule', cron: '0 * * * *' }, calendar, gates: GATES.both, changed: true }).rebuild, 'a cron the policy does not know rebuilds');
expect(!policy({ at: utc(calendar.programDay, '07:17'), trigger: { event: 'schedule', cron: '0 * * * *' }, calendar, gates: GATES.both }).rebuild, 'a cron the policy does not know catches up');

// Event Day's slots: 144 runs, 7:02 a.m. to 6:57 p.m. Central, each a check; the window's edges.
const eventSlots = slotCrons.flatMap((c) => cronTimes(c, utc(shift(calendar.eventDay, -1), '00:00'), utc(shift(calendar.eventDay, 2), '00:00'))).sort((a, b) => a - b);
const hm = (d) => { const { minutes } = centralClock(d); return `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`; };
expect(eventSlots.length === 144, `Event Day has ${eventSlots.length} 5-minute runs, not 144`);
expect(eventSlots.length && hm(eventSlots[0]) === '07:02' && hm(eventSlots.at(-1)) === '18:57', `Event Day's runs go from ${eventSlots[0] && hm(eventSlots[0])} to ${eventSlots.at(-1) && hm(eventSlots.at(-1))} Central, not 07:02 to 18:57`);
for (const at of eventSlots) {
  for (const changed of [false, true]) {
    const p = policy({ at, trigger: slotTrigger(slotCrons.find((c) => cronTimes(c, at, new Date(at.getTime() + 60_000)).length)), calendar, gates: GATES.speakers, changed, lastDeploy: null, liveDay: calendar.eventDay });
    expect(p.day === calendar.eventDay && p.check && p.rebuild === changed, `${at.toISOString()} (${hm(at)} Central): an Event Day run ${p.check ? 'checks' : "doesn't check"}, rebuild ${p.rebuild}`);
  }
  expect(!policy({ at, trigger: slotTrigger(), calendar, gates: GATES.closed, changed: true, liveDay: calendar.eventDay }).check, `${at.toISOString()}: an Event Day run checks with the gates closed`);
}
// A late run counts by when it starts: before 7 a.m. or from 7 p.m. Central, nothing.
const offset = (centralClock(utc(calendar.eventDay, '12:00')).minutes - 12 * 60) / 60; // -5 in CDT, -6 in CST
for (const [minutes, want] of [[6 * 60 + 59, false], [7 * 60, true], [7 * 60 + 2, true], [18 * 60 + 57, true], [18 * 60 + 59, true], [19 * 60, false], [19 * 60 + 2, false], [23 * 60 + 59, false]]) {
  const at = new Date(Date.UTC(...calendar.eventDay.split('-').map((v, i) => Number(v) - (i === 1 ? 1 : 0)), 0, minutes - offset * 60));
  const p = policy({ at, trigger: slotTrigger(), calendar, gates: GATES.both, changed: true, lastDeploy: null, liveDay: calendar.eventDay });
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
  expect(times.every((at) => policy({ at, trigger: { event: 'schedule', cron: lines.find((c) => cronTimes(c, at, new Date(at.getTime() + 60_000)).length) }, calendar: cal, gates: GATES.both, lastDeploy: null, liveDay: day }).check), `${day}: an Event Day run doesn't check`);
}

// Every run GitHub would start from one day to another: the daily runs and Event Day's, each `delay` minutes late,
// unless `drop(run)` drops it. `mark(run)` adds hookFails (the hook isn't accepted) or unpublished (Netlify takes
// it, but the live site doesn't change).
function runsOf(fromDay, toDay, { delay = 0, drop = () => false, mark = () => ({}) } = {}) {
  const runs = [];
  for (let d = fromDay; d <= toDay; d = shift(d, 1)) {
    for (const cron of DAILY) runs.push({ at: new Date(utc(d, hhmmOf(cron)).getTime() + delay * 60_000), trigger: { event: 'schedule', cron } });
    for (const cron of slotCrons) for (const at of cronTimes(cron, utc(d, '00:00'), utc(shift(d, 1), '00:00'))) runs.push({ at: new Date(at.getTime() + delay * 60_000), trigger: slotTrigger(cron) });
  }
  return runs.filter((r) => !drop(r)).map((r) => ({ ...r, ...mark(r) }));
}
const forcedRun = (at) => ({ at, trigger: { event: 'workflow_dispatch', force: true } });

// Plays runs in order against a live site built for `live`, as the workflow would: each run reads the live day,
// the newest accepted build hook and the last program deploy. Each decision must be the same when the readers
// leave out what's older than the policy's `since` and `hookSince`, as scripts/last-program-deploy.mjs may.
// Returns the deploys (the accepted build hooks; `program` for a check that found a change, or a forced run), the
// program checks and the live day at the end.
function play(runs, { live, gates = GATES.both, changed = true }) {
  const deploys = [];
  let checked = 0;
  let liveDay = live;
  for (const run of [...runs].sort((a, b) => a.at - b.at)) {
    if (run.rollback) { liveDay = run.rollback; continue; }
    const { at, trigger } = run;
    const lastDeploy = deploys.filter((d) => d.program).at(-1)?.at ?? null;
    const hooked = deploys.at(-1)?.at ?? null;
    const input = { at, trigger, calendar, gates, changed, lastDeploy, hooked, liveDay };
    const p = refreshPolicy(input);
    const seen = refreshPolicy({ ...input, lastDeploy: p.since && lastDeploy && lastDeploy < p.since ? null : lastDeploy, hooked: p.hookSince && hooked && hooked < p.hookSince ? null : hooked });
    expect(seen.rebuild === p.rebuild && seen.check === p.check, `${at.toISOString()}: the decision depends on a deploy or a build hook older than the policy reads`);
    if (p.check) checked += 1;
    if (!p.rebuild || run.hookFails) continue;
    deploys.push({ at, day: p.day, program: p.check || p.forced });
    if (!run.unpublished && p.day > liveDay) liveDay = p.day;
  }
  return { deploys, checked, liveDay };
}
const dayOf = (at) => centralClock(at).day;

// The deploy budget (ADR 0010): every run in March and April 2027, with no program change and the gates open or
// closed, from a live build of Feb 28. Only the rebuild days rebuild, once each.
const budgetDays = [];
for (let d = '2027-03-01'; d <= '2027-04-30'; d = shift(d, 1)) budgetDays.push(d);
const wantBudget = budgetDays.filter((d) => listed.has(d));
const budgetCount = {};
for (const [gname, gates] of Object.entries(GATES)) {
  const { deploys: rebuilt, checked } = play(runsOf('2027-03-01', '2027-04-30'), { live: '2027-02-28', gates, changed: false });
  budgetCount[gname] = rebuilt.length;
  expect(JSON.stringify(rebuilt.map((d) => d.day)) === JSON.stringify(wantBudget), `gates ${gname}: March and April rebuild on ${rebuilt.map((d) => d.day).join(', ')}, not once on each rebuild day ${wantBudget.join(', ')}`);
  expect(gname === 'closed' ? checked === 0 : checked > 0, `gates ${gname}: March and April check the program ${checked} times`);
}

// The deploy budget with a program change before every run (DEPLOY_BUDGET), plus forced runs. A program deploy (a
// check that found the change, or a forced run) is every later run's last program deploy.
const eve = shift(calendar.eventDay, -1);
const daysBetween = (a, b) => (Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86_400_000;
const simulate = (fromDay, toDay, forcedAt = []) => play([...runsOf(fromDay, toDay), ...forcedAt.map(forcedRun)], { live: shift(fromDay, -1) }).deploys.filter((d) => d.program).map((d) => d.at);

// March and April 2027, a change every day.
const allDeploys = play(runsOf('2027-03-01', '2027-04-30'), { live: '2027-02-28' }).deploys;
const deploys = allDeploys.filter((d) => d.program).map((d) => d.at);
const spaced = deploys.filter((at) => dayOf(at) < eve);
const perMonth = (m) => spaced.filter((at) => dayOf(at).startsWith(m)).length;
const onEventDay = deploys.filter((at) => dayOf(at) === calendar.eventDay);
expect(perMonth('2027-03') <= 8 && perMonth('2027-04') <= 8, `with a change every day, March and April before the eve make ${perMonth('2027-03')} and ${perMonth('2027-04')} program deploys, more than 8 a month`);
expect(perMonth('2027-03') === 8, `with a change every day, March makes ${perMonth('2027-03')} program deploys, not 8`);
expect(spaced.every((at, i) => i === 0 || daysBetween(dayOf(spaced[i - 1]), dayOf(at)) >= DEPLOY_BUDGET.everyDays), `program deploys before the eve come less than ${DEPLOY_BUDGET.everyDays} Central days apart: ${spaced.map(dayOf).join(', ')}`);
expect(deploys.filter((at) => dayOf(at) === eve).length === 1, `the eve of Event Day makes ${deploys.filter((at) => dayOf(at) === eve).length} program deploys, not 1`);
expect(onEventDay.length === 6, `Event Day makes ${onEventDay.length} program deploys, not 6: ${onEventDay.map(hm).join(', ')}`);
expect(onEventDay.every((at, i) => i === 0 || at - onEventDay[i - 1] >= DEPLOY_BUDGET.eventDayEveryMinutes * 60_000) && onEventDay.every((at) => hm(at) >= '07:00' && hm(at) < '19:00'), `Event Day's program deploys are ${onEventDay.map(hm).join(', ')} Central`);
expect(deploys.every((at) => dayOf(at) <= calendar.eventDay), 'a program change deploys after Event Day');
expect(JSON.stringify(allDeploys.filter((d) => !d.program).map((d) => d.day)) === JSON.stringify(wantBudget), `with a change every day, the rebuild days deploy on ${allDeploys.filter((d) => !d.program).map((d) => d.day).join(', ')}, not once on each of ${wantBudget.join(', ')}`);
const productionDeploys = Object.fromEntries(['2027-03', '2027-04'].map((m) => [m, allDeploys.filter((d) => d.day.startsWith(m)).length]));
// The same counts as release 6's: 9 production deploys in March and 14 in April (docs/rebuilds.md).
expect(productionDeploys['2027-03'] === 9 && productionDeploys['2027-04'] === 14, `with a change every day, ${productionDeploys['2027-03']} and ${productionDeploys['2027-04']} production deploys in March and April, not 9 and 14`);

// Across DST (2 a.m. CST on Mar 14, 2027): the spacing counts Central days, not UTC days or hours.
for (const [last, no, yes] of [
  ['2027-03-12T03:00:00Z', '2027-03-14', '2027-03-15'], // 9 p.m. CST on Mar 11, already Mar 12 in UTC
  ['2027-03-13T05:30:00Z', '2027-03-15', '2027-03-16'], // 11:30 p.m. CST on Mar 12
  ['2027-03-14T07:30:00Z', '2027-03-17', '2027-03-18'], // 1:30 a.m. CST on Mar 14, just before the change
  ['2027-03-14T08:30:00Z', '2027-03-17', '2027-03-18'], // 3:30 a.m. CDT on Mar 14, just after
]) {
  const at = (d) => utc(d, '07:17');
  const a = policy({ at: at(no), trigger: morning, calendar, gates: GATES.both, changed: true, lastDeploy: new Date(last) });
  const b = policy({ at: at(yes), trigger: morning, calendar, gates: GATES.both, changed: true, lastDeploy: new Date(last) });
  expect(!a.check && !a.rebuild && b.check && b.rebuild, `after a program deploy at ${last}, ${no} ${a.rebuild ? 'deploys' : "doesn't deploy"} and ${yes} ${b.rebuild ? 'deploys' : "doesn't deploy"}`);
}
// Only a deploy since midnight Central 3 days earlier counts, in CST and in CDT.
for (const [day, since] of [['2027-03-16', '2027-03-13T06:00:00Z'], ['2027-03-17', '2027-03-14T06:00:00Z'], ['2027-03-18', '2027-03-15T05:00:00Z']]) {
  const p = policy({ at: utc(day, '07:17'), trigger: morning, calendar, gates: GATES.both, lastDeploy: null });
  expect(p.since?.toISOString() === new Date(since).toISOString(), `${day}: the morning run reads program deploys since ${p.since?.toISOString()}, not ${since}`);
}

// A forced run deploys and resets the spacing, before the eve and on Event Day.
const forcedMarch = simulate('2027-03-02', '2027-03-20', [utc('2027-03-08', '15:00')]).map(dayOf);
expect(JSON.stringify(forcedMarch) === JSON.stringify(['2027-03-02', '2027-03-06', '2027-03-08', '2027-03-12', '2027-03-16', '2027-03-20']), `with a forced run on Mar 8, the program deploys are ${forcedMarch.join(', ')}`);
const forcedEventDay = simulate(calendar.eventDay, calendar.eventDay, [utc(calendar.eventDay, '15:30')]).map(hm);
expect(JSON.stringify(forcedEventDay) === JSON.stringify(['07:02', '09:02', '10:30', '12:32', '14:32', '16:32', '18:32']), `with a forced run at 10:30 a.m. on Event Day, the program deploys are ${forcedEventDay.join(', ')} Central`);

// Catch-up. Nov 1, 2026 is a rebuild day (the call for proposals opens) and the day DST ends; the live build is from
// Oct 31. Whatever GitHub starts late, drops or fails, the first run that gets through deploys, once, and no later
// run deploys again for that day. With the gates closed, so only the rebuild day can deploy.
const CFP = '2026-11-01';
const atCentral = (d) => `${dayOf(d.at)} ${hm(d.at)}`;
const nov = (opts) => runsOf(CFP, '2026-11-04', opts);
const playNov = (runs, live = '2026-10-31') => play(runs, { live, gates: GATES.closed });
const once = (what, { deploys, liveDay }, want) => expect(deploys.length === 1 && atCentral(deploys[0]) === want && liveDay === dayOf(deploys[0].at), `${what}: deploys at ${deploys.map(atCentral).join(', ') || 'no time'}, not once at ${want}; live ${liveDay}`);
once('on time', playNov(nov()), `${CFP} 01:17`);
// GitHub's delays in October 2026: 6 h 43 min to 9 h 25 min.
once('every run 6 h 43 min late', playNov(nov({ delay: 403 })), `${CFP} 08:00`);
once('every run 9 h 25 min late', playNov(nov({ delay: 565 })), `${CFP} 10:42`);
// Each set of Nov 1's daily runs dropped, on time and late: the first run left deploys; with all four dropped,
// Nov 2's morning run catches up.
for (const delay of [0, 565]) {
  for (let mask = 0; mask < 16; mask += 1) {
    const dropped = (r) => dayOf(new Date(r.at.getTime() - delay * 60_000)) === CFP && (mask >> DAILY.indexOf(r.trigger.cron)) % 2 === 1;
    const first = DAILY.findIndex((_, i) => (mask >> i) % 2 === 0);
    const want = first < 0 ? `2026-11-02 ${hm(new Date(utc('2026-11-02', '07:17').getTime() + delay * 60_000))}` : `${CFP} ${hm(new Date(utc(CFP, hhmmOf(DAILY[first])).getTime() + delay * 60_000))}`;
    once(`Nov 1's runs ${DAILY.filter((_, i) => (mask >> i) % 2).join(', ') || 'none'} dropped, ${delay} minutes late`, playNov(nov({ delay, drop: dropped })), want);
  }
}
// The build hook fails: the next run tries again. Every Nov 1 hook fails: Nov 2's morning run catches up.
once('the morning hook fails', playNov(nov({ mark: (r) => ({ hookFails: r.trigger.cron === MORNING_CRON && dayOf(r.at) === CFP }) })), `${CFP} 04:47`);
once("every Nov 1 hook fails", playNov(nov({ mark: (r) => ({ hookFails: dayOf(r.at) === CFP }) })), '2026-11-02 01:17');
// Netlify takes the hook, but the live site keeps Oct 31 (a failed or unpublished deploy): no second deploy, on
// Nov 1 or later, and the log says why.
const stuck = playNov(nov({ mark: () => ({ unpublished: true }) }));
expect(stuck.deploys.length === 1 && stuck.liveDay === '2026-10-31', `with Netlify's deploy not live, ${stuck.deploys.length} deploys: ${stuck.deploys.map(atCentral).join(', ')}`);
const stuckWhy = policy({ at: utc('2026-11-03', '07:17'), trigger: morning, calendar, gates: GATES.closed, liveDay: '2026-10-31', hooked: utc(CFP, '07:17') });
expect(!stuckWhy.rebuild && /Netlify accepted a rebuild for 2026-11-01 .* no second deploy/.test(stuckWhy.why), `with Netlify's deploy not live, the log says "${stuckWhy.why}"`);
// A merge on the rebuild day built that day's text: no extra deploy. A merge on Oct 31 didn't: Nov 1 still deploys.
expect(playNov(nov(), CFP).deploys.length === 0, 'after a merge on Nov 1, a run deploys again');
once('after a merge on Oct 31', playNov(nov(), '2026-10-31'), `${CFP} 01:17`);
// A rollback in Netlify to an older day's deploy: if a run already used the hook for the rebuild day, nothing deploys
// again; if a merge built that day's text, the next run rebuilds once (docs/event-day.md, "Roll back").
const rolledBack = playNov([...nov(), { at: utc(CFP, '20:00'), rollback: '2026-10-31' }]);
expect(rolledBack.deploys.length === 1 && rolledBack.liveDay === '2026-10-31', `after a rollback to Oct 31, the deploys are ${rolledBack.deploys.map(atCentral).join(', ')}`);
const mergedRolledBack = playNov([...nov(), { at: utc(CFP, '12:00'), rollback: '2026-10-31' }], CFP);
expect(mergedRolledBack.deploys.length === 1 && atCentral(mergedRolledBack.deploys[0]) === '2026-11-01 07:17', `after a merge on Nov 1 and a rollback to Oct 31, the deploys are ${mergedRolledBack.deploys.map(atCentral).join(', ')}`);
// A forced run writes the new day: the scheduled runs then don't deploy. Forced again, it deploys again.
const forcedNov = playNov([...nov(), forcedRun(utc(CFP, '06:30'))]);
expect(forcedNov.deploys.length === 1 && forcedNov.deploys[0].program && forcedNov.liveDay === CFP, `after a forced run at 00:30 on Nov 1, the deploys are ${forcedNov.deploys.map(atCentral).join(', ')}`);
expect(playNov([...nov(), forcedRun(utc(CFP, '20:00'))]).deploys.length === 2, 'a forced run after the rebuild day was live does not deploy');
// The live build is missing (no /build.txt yet): it counts as a day old, so only a rebuild day rebuilds.
expect(policy({ at: utc(CFP, '07:17'), trigger: morning, calendar, gates: GATES.closed, liveDay: 'missing' }).rebuild && !policy({ at: utc('2026-11-02', '07:17'), trigger: morning, calendar, gates: GATES.closed, liveDay: 'missing' }).rebuild, "with no /build.txt, a run doesn't treat the live build as a day old");
// Unreadable: nothing runs, not even Event Day's check, and the log says why. A forced run still deploys.
for (const liveDay of [null, 'unknown', '<!doctype html>', 42]) {
  const r = policy({ at: utc(CFP, '07:17'), trigger: morning, calendar, gates: GATES.both, liveDay });
  const e = policy({ at: utc(calendar.eventDay, '17:02'), trigger: slotTrigger(), calendar, gates: GATES.both, changed: true, lastDeploy: null, liveDay });
  expect(!r.rebuild && !r.check && !e.rebuild && !e.check && /build\.txt can't be read/.test(r.why), `with the live day ${JSON.stringify(liveDay)}: rebuild ${r.rebuild || e.rebuild}, check ${r.check || e.check}, "${r.why}"`);
  expect(policy({ at: utc(CFP, '15:00'), trigger: { event: 'workflow_dispatch', force: true }, calendar, gates: GATES.closed, liveDay }).rebuild, `with the live day ${JSON.stringify(liveDay)}, a forced run doesn't deploy`);
}
// Ahead of today (a build that ran past midnight, or a clock ahead): no rebuild.
expect(!policy({ at: utc(CFP, '07:17'), trigger: morning, calendar, gates: GATES.closed, liveDay: '2026-11-05' }).rebuild, 'with a live build ahead of today, a run rebuilds');
// The build hook's last use can't be read: no catch-up, and the log says why; only one from the rebuild day on
// counts, from midnight Central (CDT on Nov 1, CST on Feb 1).
for (const hooked of [undefined, new Date(Number.NaN), 'unknown']) {
  const r = refreshPolicy({ at: utc(CFP, '07:17'), trigger: morning, calendar, gates: GATES.closed, liveDay: '2026-10-31', hooked });
  expect(!r.rebuild && /hook's last use can't be read/.test(r.why), `with the hook's last use ${String(hooked)}: rebuild ${r.rebuild}, "${r.why}"`);
}
for (const [day, since] of [[CFP, '2026-11-01T05:00:00Z'], ['2026-11-03', '2026-11-01T05:00:00Z'], ['2027-02-01', '2027-02-01T06:00:00Z']]) {
  const r = policy({ at: utc(day, '07:17'), trigger: morning, calendar, gates: GATES.closed, liveDay: '2026-10-31' });
  expect(r.hookSince?.toISOString() === new Date(since).toISOString(), `${day}: a catch-up reads the build hook's use since ${r.hookSince?.toISOString()}, not ${since}`);
  expect(policy({ at: utc(day, '07:17'), trigger: morning, calendar, gates: GATES.closed, liveDay: '2026-10-31', hooked: new Date(Date.parse(since) - 60_000) }).rebuild, `${day}: a build hook from before ${since} stops a catch-up`);
}
// The turn of the year: a live build from Dec 31 rebuilds on Feb 1, or on Feb 2 when all of Feb 1's runs drop.
once('across the turn of the year', play(runsOf('2026-12-31', '2027-02-02'), { live: '2026-12-31', gates: GATES.closed }), '2027-02-01 01:17');
once("Feb 1's runs all dropped", play(runsOf('2026-12-31', '2027-02-02', { drop: (r) => dayOf(r.at) === '2027-02-01' }), { live: '2026-12-31', gates: GATES.closed }), '2027-02-02 01:17');
// Event Day's morning: with the daily runs 9 h 25 min late, the first 5-minute run, at 7:02 a.m., switches the site.
const eventMorning = play(runsOf(calendar.eventDay, calendar.eventDay).map((r) => (r.trigger.cron.endsWith(' * * *') ? { ...r, at: new Date(r.at.getTime() + 565 * 60_000) } : r)), { live: eve, gates: GATES.closed });
once("Event Day with the daily runs late", eventMorning, `${calendar.eventDay} 07:02`);

// The last program deploy's time can't be read: no check and no deploy where the budget needs it, with the reason.
for (const lastDeploy of [undefined, new Date(Number.NaN), 'unknown']) {
  for (const [at, trigger] of [[utc('2027-03-10', '07:17'), morning], [utc('2027-03-10', '15:00'), { event: 'workflow_dispatch', force: false }], [utc(calendar.eventDay, '17:02'), slotTrigger()]]) {
    const p = policy({ at, trigger, calendar, gates: GATES.both, changed: true, lastDeploy, liveDay: dayOf(at) });
    expect(!p.check && !p.rebuild && p.since && /can't be read/.test(p.why), `${at.toISOString()} with the last deploy ${String(lastDeploy)}: check ${p.check}, rebuild ${p.rebuild}, "${p.why}"`);
  }
  // Where the budget doesn't need it: the eve checks, a forced run and a rebuild day rebuild.
  const e = policy({ at: utc(eve, '07:17'), trigger: morning, calendar, gates: GATES.both, changed: true, lastDeploy });
  const f = policy({ at: utc('2027-03-10', '15:00'), trigger: { event: 'workflow_dispatch', force: true }, calendar, gates: GATES.both, lastDeploy });
  const r = policy({ at: utc(calendar.programDay, '07:17'), trigger: morning, calendar, gates: GATES.both, lastDeploy });
  expect(e.check && e.rebuild && !e.since && f.rebuild && f.forced && r.rebuild, `with the last deploy ${String(lastDeploy)}, the eve, a forced run or a rebuild day doesn't rebuild`);
}

// scripts/last-program-deploy.mjs against a stand-in for GitHub's API: the newest run, other than this one, whose
// "Program deploy" job got past the build hook, even if the run failed later.
const job = (name, hook) => ({ name, steps: hook ? [{ name: HOOK_STEP, conclusion: hook }] : [] });
const fakeRuns = [
  { id: 9, status: 'completed', run_started_at: '2027-04-23T18:02:00Z', jobs: [job(PROGRAM_DEPLOY_JOB, 'success')] }, // this run
  { id: 8, status: 'completed', run_started_at: '2027-04-23T17:02:00Z', jobs: [job('Scheduled rebuild', 'success')] },
  { id: 7, status: 'completed', run_started_at: '2027-04-23T16:02:00Z', jobs: [job(PROGRAM_DEPLOY_JOB, 'failure')] },
  { id: 6, status: 'completed', run_started_at: '2027-04-23T15:02:00Z', jobs: [job('check', null), { name: PROGRAM_DEPLOY_JOB, steps: [{ name: HOOK_STEP, conclusion: 'success' }, { name: 'Wait until the live site has the new program', conclusion: 'failure' }] }] },
  { id: 5, status: 'completed', run_started_at: '2027-04-23T13:02:00Z', jobs: [job(PROGRAM_DEPLOY_JOB, 'success')] },
  { id: 4, status: 'queued', run_started_at: '2027-04-23T18:07:00Z', jobs: [] },
];
expect(deployedIn([job(PROGRAM_DEPLOY_JOB, 'success')]) && !deployedIn([job(PROGRAM_DEPLOY_JOB, 'skipped')]) && !deployedIn([job(PROGRAM_DEPLOY_JOB, null)]) && !deployedIn([job('Scheduled rebuild', 'success')]) && !deployedIn(undefined), 'deployedIn() is wrong');
const requests = [];
const fakeFetch = (runs, status = 200) => async (url, opts) => {
  requests.push({ url, opts });
  if (status !== 200) return { ok: false, status };
  const m = url.match(/\/actions\/runs\/(\d+)\/jobs/);
  const body = m ? { jobs: runs.find((r) => String(r.id) === m[1])?.jobs ?? [] } : { workflow_runs: runs.map(({ jobs, ...r }) => r) };
  return { ok: true, status: 200, json: async () => body };
};
const reader = { since: utc(calendar.eventDay, '16:02'), repo: 'example/site', token: 'test-token', runId: '9' };
const found = await lastProgramDeploy({ ...reader, fetch: fakeFetch(fakeRuns) });
expect(found?.toISOString() === '2027-04-23T15:02:00.000Z', `the last program deploy is ${found?.toISOString()}, not 2027-04-23T15:02:00Z`);
expect(requests.every((q) => !q.url.includes('test-token') && q.opts.headers.authorization === 'Bearer test-token') && requests[0].url.includes('/actions/workflows/rebuild.yml/runs?created=%3E%3D2027-04-23T15%3A02%3A00Z'), `the reader's requests are wrong: ${requests[0]?.url}`);
expect(!requests.some((q) => /\/runs\/(9|5|4)\/jobs/.test(q.url)), 'the reader reads this run, a queued run, or runs older than the newest program deploy');
expect((await lastProgramDeploy({ ...reader, fetch: fakeFetch([fakeRuns[1]]) })) === null, 'with no program deploy in the runs, the reader does not say none');
for (const [what, input, want] of [
  ['a 403', { fetch: fakeFetch(fakeRuns, 403) }, /HTTP 403/],
  ['no answer', { fetch: async () => { throw new TypeError('fetch failed'); } }, /didn't answer/],
  ['no token', { token: '', fetch: fakeFetch(fakeRuns) }, /GH_TOKEN/],
]) {
  const err = await lastProgramDeploy({ ...reader, ...input }).then(() => null, (e) => e);
  expect(err && want.test(err.message) && !err.message.includes('test-token'), `the reader with ${what}: ${err ? err.message : 'no error'}`);
}

// The build hook's last use: the newest run, other than this one, where any job got past the hook.
expect(hookedIn([job('Scheduled rebuild', 'success')]) && hookedIn([job(PROGRAM_DEPLOY_JOB, 'success')]) && !hookedIn([job('Scheduled rebuild', 'failure')]) && !hookedIn(undefined), 'hookedIn() is wrong');
const hookFound = await lastBuildHook({ ...reader, fetch: fakeFetch(fakeRuns) });
expect(hookFound?.toISOString() === '2027-04-23T17:02:00.000Z', `the build hook's last use is ${hookFound?.toISOString()}, not 2027-04-23T17:02:00Z`);
expect((await lastBuildHook({ ...reader, fetch: fakeFetch([fakeRuns[0], fakeRuns[2]]) })) === null, 'with no accepted build hook in the runs, the reader does not say none');

// The live build's day (scripts/rebuild-today.mjs): a 200 with one day, a 404 as "missing", up to 3 tries when the
// site fails (5xx) or doesn't answer, and a reason for anything else.
const liveFetch = (answers) => {
  let i = 0;
  const fetch = async (url, opts) => {
    expect(url === LIVE_DAY_URL && opts.headers['cache-control'] === 'no-cache', `the live day is read from ${url}`);
    const a = answers[Math.min(i, answers.length - 1)];
    i += 1;
    if (a === 'hang') throw new TypeError('fetch failed');
    return { status: a[0], text: async () => a[1] };
  };
  return { fetch, calls: () => i };
};
for (const [what, answers, want, calls] of [
  ['a day', [[200, '2026-11-01\n']], '2026-11-01', 1],
  ['a 404', [[404, 'Not found']], 'missing', 1],
  ['a 503, then a day', [[503, ''], [200, '2026-11-01\n']], '2026-11-01', 2],
  ['no answer, then a day', ['hang', [200, '2026-11-01\n']], '2026-11-01', 2],
  ['503s', [[503, '']], /HTTP 503/, 3],
  ['no answer', ['hang'], /no answer/, 3],
  ['a 403', [[403, '']], /HTTP 403/, 1],
  ['a page instead of a day', [[200, '<!doctype html>']], /not a day/, 1],
]) {
  const f = liveFetch(answers);
  const got = await liveBuildDay({ fetch: f.fetch, pause: 0 }).then((d) => d, (e) => e);
  const ok = want instanceof RegExp ? got instanceof Error && want.test(got.message) : got === want;
  expect(ok && f.calls() === calls, `the live day with ${what}: ${got instanceof Error ? got.message : got} after ${f.calls()} requests`);
}

// The program check with the gates closed in the checked-out Edition file: "unchanged", no platform call.
if (!edition.program.speakersPublic && !edition.program.schedulePublic) {
  const res = spawnSync(process.execPath, ['scripts/program-check.mjs'], { encoding: 'utf8', env: { ...process.env, SESSIONIZE_ENDPOINT_ID: '', PROGRAM_CSV_URL: '', GITHUB_OUTPUT: '' } });
  expect(res.status === 0 && res.stdout === 'unchanged\n', `program-check with the gates closed: exit ${res.status}, ${JSON.stringify(res.stdout)}`);
}

// The note and the wait as GitHub runs them, against a local stand-in for the live site: the note with one retry and
// 1 second per try, the wait with a 3-second limit and 0.2-second checks. The note keeps the live version, or nothing
// for a 404, and gets past one failed request. When the live site keeps failing or doesn't answer, the note fails
// with its message, so GitHub skips the build hook and the wait. The wait ends once the live version differs from the
// noted one (on the third request), or once a missing file appears; it fails with its message when the live version
// stays the same or stays missing, also after the note's failed request. Neither prints a version.
if (noteRun && loop) {
  const [OLD, NEW] = ['b1'.repeat(32), 'f0'.repeat(32)];
  // serve() gives the live version, null for a 404, another status code, or HANG for no answer at all.
  const HANG = Symbol('no answer');
  let hits = 0;
  let serve = () => null;
  const site = createServer((req, res) => {
    hits += 1;
    const body = serve();
    if (body === HANG) return;
    const status = typeof body === 'number' ? body : body === null ? 404 : 200;
    res.writeHead(status, { 'content-type': 'text/plain' });
    res.end(status === 200 ? `${body}\n` : `Error ${status}`);
  });
  await new Promise((r) => site.listen(0, '127.0.0.1', r));
  const runner = mkdtempSync(join(tmpdir(), 'rebuild-runner-'));
  const quick = noteRun.replace(/--retry \d+/, '--retry 1').replace(/--max-time \d+/, '--max-time 1');
  const fast = loop.replace(/SECONDS \+ \d+\)/, 'SECONDS + 3)').replace(/\bsleep \d+\b/, 'sleep 0.2');
  const runStep = (script, extra = {}) => new Promise((resolve) => {
    hits = 0;
    const env = { ...process.env, NO_PROXY: '127.0.0.1', no_proxy: '127.0.0.1', RUNNER_TEMP: runner, LIVE: `http://127.0.0.1:${site.address().port}/2027/program-version.txt`, ...extra };
    const child = spawn('bash', ['--noprofile', '--norc', '-eo', 'pipefail', '-c', script], { env, timeout: 30_000 });
    let out = '';
    for (const s of [child.stdout, child.stderr]) s.on('data', (d) => { out += d; });
    child.on('close', (status) => resolve({ status, out, hits }));
  });
  try {
    for (const { what, atNote, kept: want, noteHits = 1, inWait, waitStatus, waitHits = null } of [
      { what: 'a new version replaces the noted one', atNote: () => OLD, kept: OLD, inWait: () => (hits >= 3 ? NEW : OLD), waitStatus: 0, waitHits: 3 },
      { what: 'the noted version stays live', atNote: () => OLD, kept: OLD, inWait: () => OLD, waitStatus: 1 },
      { what: 'a missing file (404) appears', atNote: () => null, kept: '', inWait: () => (hits >= 2 ? NEW : null), waitStatus: 0, waitHits: 2 },
      { what: 'the file stays missing (404)', atNote: () => null, kept: '', inWait: () => null, waitStatus: 1 },
      { what: 'the live site fails once (503), then the noted version stays live', atNote: () => (hits >= 2 ? OLD : 503), kept: OLD, noteHits: 2, inWait: () => OLD, waitStatus: 1 },
      { what: 'the live site keeps failing (503)', atNote: () => 503, kept: null, noteHits: 2 },
      { what: 'the live site doesn’t answer', atNote: () => HANG, kept: null, noteHits: 2 },
    ]) {
      serve = atNote;
      rmSync(join(runner, 'live-version'), { force: true });
      const n = await runStep(quick);
      const kept = existsSync(join(runner, 'live-version')) ? readFileSync(join(runner, 'live-version'), 'utf8').trim() : null;
      expect(n.hits === noteHits, `${what}: the note made ${n.hits} requests, not ${noteHits}`);
      if (want === null) {
        // GitHub runs no later step after a failed one: the build hook and the wait are skipped.
        expect(n.status === 1 && /^::error::.*live program version/m.test(n.out), `${what}: the note exits ${n.status}, not 1 with its message: ${JSON.stringify(n.out)}`);
        expect(!n.out.includes(OLD), `${what}: the note prints a version: ${JSON.stringify(n.out)}`);
        continue;
      }
      serve = inWait;
      const w = await runStep(fast);
      const all = n.out + w.out;
      expect(n.status === 0 && kept === want, `${what}: the note exits ${n.status} and keeps ${JSON.stringify(kept)}, not ${JSON.stringify(want)}`);
      expect(w.status === waitStatus && (waitHits === null || w.hits === waitHits), `${what}: the wait exits ${w.status} after ${w.hits} requests, not ${waitStatus}${waitHits === null ? '' : ` after ${waitHits}`}: ${JSON.stringify(w.out)}`);
      expect(waitStatus === 0 ? /has the new program/.test(w.out) : /^::error::.*Netlify/m.test(w.out), `${what}: the wait says ${JSON.stringify(w.out)}`);
      expect(!all.includes(OLD) && !all.includes(NEW), `${what}: the note or the wait prints a version: ${JSON.stringify(all)}`);
    }
    // The wait for the new day, 3 seconds at 0.2-second checks: it ends once /build.txt holds the run's day or a
    // later one, and fails with its message on a 404, a 503, a page instead of a day, or an older day.
    const dayFast = dayLoop.replace(/SECONDS \+ \d+\)/, 'SECONDS + 3)').replace(/\bsleep \d+\b/, 'sleep 0.2');
    for (const [what, answer, status] of [
      ['the new day after 2 checks', () => (hits >= 2 ? '2026-11-01' : '2026-10-31'), 0],
      ['a later day', () => '2026-11-02', 0],
      ['an older day', () => '2026-10-31', 1],
      ['a 404', () => null, 1],
      ['a 503', () => 503, 1],
      ['a page instead of a day', () => '<!doctype html><p>2026-11-01</p>', 1],
    ]) {
      serve = answer;
      const w = await runStep(dayFast, { LIVE: `http://127.0.0.1:${site.address().port}/build.txt`, DAY: '2026-11-01' });
      expect(w.status === status && (status === 0 ? /built for 2026-11-01/.test(w.out) : /^::error::.*Netlify/m.test(w.out)), `the day wait with ${what}: exit ${w.status}, ${JSON.stringify(w.out)}`);
    }
  } finally {
    site.closeAllConnections();
    site.close();
    rmSync(runner, { recursive: true, force: true });
  }
}

// actionlint, when it's installed (or named by $ACTIONLINT). It checks the run steps with shellcheck when that's on
// the PATH, as it is on GitHub's runners; the summary says which.
const actionlint = process.env.ACTIONLINT || 'actionlint';
const lint = spawnSync(actionlint, ['-no-color', '.github/workflows/rebuild.yml'], { encoding: 'utf8' });
let linted = 'actionlint not installed: skipped';
if (!lint.error) {
  expect(lint.status === 0, `actionlint: ${lint.stdout}${lint.stderr}`);
  const sc = spawnSync('shellcheck', ['--version'], { encoding: 'utf8' });
  const scVersion = sc.error ? null : sc.stdout.match(/^version: (\S+)/m)?.[1];
  linted = `actionlint ${spawnSync(actionlint, ['-version'], { encoding: 'utf8' }).stdout.split('\n')[0]} passed, ${scVersion ? `with shellcheck ${scVersion}` : 'without shellcheck (not installed)'}`;
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
    [['--at', '2026-11-02T10:47:00Z', '--cron', RETRY_CRONS[0], '--force', 'false'], 'false'],
    // The live build's day and the build hook's last use, as the workflow's run reads them.
    [['--at', '2026-11-03T13:17:00Z', '--cron', RETRY_CRONS[1], '--force', 'false', '--live-day', '2026-10-31'], 'true'],
    [['--at', '2026-11-03T13:17:00Z', '--cron', RETRY_CRONS[1], '--force', 'false', '--live-day', '2026-10-31', '--hooked', '2026-11-01T14:00:00Z'], 'false'],
    [['--at', '2026-11-03T13:17:00Z', '--cron', RETRY_CRONS[1], '--force', 'false', '--live-day', '2026-10-31', '--hooked', 'unknown'], 'false'],
    [['--at', '2026-11-01T07:17:00Z', '--cron', MORNING_CRON, '--force', 'false', '--live-day', 'unknown'], 'false'],
    [['--at', '2026-11-01T07:17:00Z', '--cron', MORNING_CRON, '--force', 'false', '--live-day', '2026-11-01'], 'false'],
    [['--at', '2026-11-01T07:17:00Z', '--cron', MORNING_CRON, '--force', 'false', '--live-day', 'missing'], 'true'],
    [['--at', '2026-11-01T15:00:00Z', '--cron', '', '--force', 'true', '--live-day', 'unknown'], 'true'],
    [['--at', '2026-11-02T15:00:00Z', '--cron', '', '--force', 'true'], 'true'],
    [['--at', '2027-03-05T07:17:00Z', '--cron', MORNING_CRON, '--force', 'false', '--last-deploy', 'none'], 'false', open],
    [['--at', '2027-03-05T07:17:00Z', '--cron', MORNING_CRON, '--force', 'false', '--last-deploy', '2027-03-03T07:17:00Z'], 'false'],
    [['--at', '2027-03-05T07:17:00Z', '--cron', MORNING_CRON, '--force', 'false', '--last-deploy', 'unknown'], 'false'],
    [['--at', `${calendar.eventDay}T17:02:00Z`, '--cron', slotCrons[0], '--force', 'false', '--last-deploy', 'none', '--live-day', calendar.eventDay], 'false', open],
    // Event Day's 5-minute runs catch up a morning that GitHub ran late.
    [['--at', `${calendar.eventDay}T12:02:00Z`, '--cron', slotCrons[0], '--force', 'false', '--live-day', eve], 'true'],
  ]) {
    const out = join(dir, `out-${checks}`);
    const res = spawnSync(process.execPath, ['scripts/rebuild-today.mjs', ...args], { encoding: 'utf8', env: { ...process.env, GITHUB_OUTPUT: out } });
    const written = readFileSync(out, 'utf8');
    expect(res.status === 0 && res.stdout.trim().split('\n').length === 1, `rebuild-today ${args.join(' ')}: exit ${res.status}, ${JSON.stringify(res.stdout)}`);
    const forced = args.includes('--force') && args[args.indexOf('--force') + 1] === 'true';
    expect(written.includes(`rebuild=${want}\n`) && written.includes(`check=${check}\n`) && written.includes(`forced=${forced}\n`) && /^day=\d{4}-\d\d-\d\d$/m.test(written) && /^why=/m.test(written), `rebuild-today ${args.join(' ')}: $GITHUB_OUTPUT is ${JSON.stringify(written)}`);
  }
  const bad = spawnSync(process.execPath, ['scripts/rebuild-today.mjs', '--day', 'Nov 1'], { encoding: 'utf8' });
  expect(bad.status === 2, 'rebuild-today accepts a malformed --day');
  const badLast = spawnSync(process.execPath, ['scripts/rebuild-today.mjs', '--day', '2027-03-05', '--last-deploy', 'yesterday'], { encoding: 'utf8' });
  expect(badLast.status === 2, 'rebuild-today accepts a malformed --last-deploy');
  for (const flags of [['--live-day', 'Nov 1'], ['--hooked', 'today']]) {
    expect(spawnSync(process.execPath, ['scripts/rebuild-today.mjs', '--day', '2026-11-01', ...flags], { encoding: 'utf8' }).status === 2, `rebuild-today accepts a malformed ${flags[0]}`);
  }
} finally {
  rmSync(dir, { recursive: true, force: true });
}

if (failures.length) {
  console.error(`Rebuild tests failed (${failures.length} of ${checks}):\n  ${failures.join('\n  ')}`);
  process.exit(1);
}
console.log(`Rebuild tests passed: ${checks} checks; rebuild days ${[...listed].sort().join(', ')}; cron ${allCrons.join(' and ')} UTC; March and April with no program change rebuild ${budgetCount.both} times (${wantBudget.join(', ')}); with a change every day, ${perMonth('2027-03')} program deploys in March, ${perMonth('2027-04')} in April to Apr 21, 1 on the eve and ${onEventDay.length} on Event Day (${onEventDay.map(hm).join(', ')} Central), so ${productionDeploys['2027-03']} and ${productionDeploys['2027-04']} production deploys from the schedule in March and April (${productionDeploys['2027-03'] * 15} and ${productionDeploys['2027-04'] * 15} credits); ${linted}.`);
