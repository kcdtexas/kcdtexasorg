// The program platform's tests (src/lib/program-source/), with no real network: a local HTTP server stands in
// for Sessionize.
//   1. The Sessionize adapter on tests/fixtures/sessionize-all.json, each quirk, Central time across DST, the
//      validation failures and the allowlist (the planted marker never reaches the model).
//   2. The rules: which builds read the platform, the redaction of the endpoint ID in every error, and the
//      test-only address refused on Netlify and in GitHub Actions.
//   3. Unless --no-builds: full builds (scripts/build.sh) with a gate opened in src/data/edition-2027.ts for the
//      run and restored after: production from the local Sessionize, a deploy preview (the test data, no
//      request), production with no variable, and production with a failing platform.
// Usage: node tests/program-adapter.mjs [--no-builds]
import { spawn } from 'node:child_process';
import { existsSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { join } from 'node:path';
import { centralOf, centralToUtc, toCentral } from '../src/lib/program-source/central.mjs';
import { linkKind } from '../src/lib/program-source/links.mjs';
import { publicProgram } from '../src/lib/program-source/model.mjs';
import { chooseSource, publicModel, readPlatform } from '../src/lib/program-source/platform.mjs';
import { fetchable, redact, sessionizeBase } from '../src/lib/program-source/remote.mjs';
import { adaptSessionize, validateAll } from '../src/lib/program-source/sessionize.mjs';

const failures = [];
let checks = 0;
const expect = (ok, message) => { checks += 1; if (!ok) failures.push(message); };
async function rejects(fn, test, message) {
  try { await fn(); expect(false, `${message}: no error`); } catch (e) { expect(test(String(e?.message ?? e)), `${message}: ${e?.message ?? e}`); }
}

const marker = readFileSync('src/data/program-fixture.ts', 'utf8').match(/plantedMarker = '([^']+)'/)[1];
const fixtureText = readFileSync('tests/fixtures/sessionize-all.json', 'utf8');
const ID = 'fxEndpoint42';
const both = { speakersPublic: true, schedulePublic: true };
const speakersOnly = { speakersPublic: true, schedulePublic: false };
const closed = { speakersPublic: false, schedulePublic: false };
const clean = Object.fromEntries(Object.entries(process.env).filter(([k]) => !/^(?:CONTEXT|NETLIFY|GITHUB_ACTIONS|GITHUB_OUTPUT|SESSIONIZE_ENDPOINT_ID|PROGRAM_CSV_URL|KCD_)/.test(k)));

// The local stand-in for Sessionize.
const state = { mode: 'ok', fixture: fixtureText, requests: [] };
const server = createServer((req, res) => {
  state.requests.push(req.url);
  const send = (status, type, body) => { res.writeHead(status, { 'content-type': type }); res.end(body); };
  const local = (s) => s.replaceAll('https://photos.fixture.invalid/', `${origin}/photos/`);
  if (req.url === `/api/v2/${ID}/view/All`) {
    if (state.mode === '500') return send(500, 'text/plain', 'down');
    if (state.mode === 'notjson') return send(200, 'application/json', '<html>');
    if (state.mode === 'invalid') return send(200, 'application/json', JSON.stringify({ sessions: 'none' }));
    return send(200, 'application/json', local(state.fixture));
  }
  return send(404, 'text/plain', 'not found');
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const origin = `http://127.0.0.1:${server.address().port}`;
const testEnv = { KCD_PROGRAM_TEST_BASE: `${origin}/api/v2` };
const prodSessionize = { ...testEnv, CONTEXT: 'production', SESSIONIZE_ENDPOINT_ID: ID };
const fixture = () => JSON.parse(fixtureText);

/** A child process, run without blocking the local server. */
function run(cmd, args, env) {
  return new Promise((resolve) => {
    const merged = Object.fromEntries(Object.entries({ ...clean, ...env }).filter(([, v]) => v !== undefined));
    const child = spawn(cmd, args, { env: merged });
    let out = '';
    let err = '';
    child.stdout.on('data', (d) => { out += d; });
    child.stderr.on('data', (d) => { err += d; });
    child.on('close', (status) => resolve({ status, out, err, log: out + err }));
  });
}

// The gates, opened in the Edition file for one step and always restored.
const EDITION = 'src/data/edition-2027.ts';
const editionText = readFileSync(EDITION, 'utf8');
const CLOSED = 'program: { speakersPublic: false, schedulePublic: false }';
if (!editionText.includes(CLOSED)) throw new Error(`${EDITION}: the gates aren't closed as "${CLOSED}"; these tests open them for a run`);
const restore = () => writeFileSync(EDITION, editionText);
process.on('exit', restore);
for (const sig of ['SIGINT', 'SIGTERM']) process.on(sig, () => { restore(); process.exit(130); });
async function withGates(gates, fn) {
  writeFileSync(EDITION, editionText.replace(CLOSED, `program: { speakersPublic: ${gates.speakersPublic}, schedulePublic: ${gates.schedulePublic} }`));
  try { return await fn(); } finally { restore(); }
}

try {
  // 1. The Sessionize adapter.
  const raw = adaptSessionize(fixture());
  const session = (id) => raw.sessions.find((s) => s.id === id);
  const speaker = (n) => raw.speakers.find((s) => s.id.endsWith(`0000000000${n}`));
  expect(raw.rooms.join('|') === 'Fixture Hall|Fixture Room B', `rooms are ${raw.rooms.join('|')}, not in their sort order`);
  expect(session('1001')?.format === 'keynote' && session('1002')?.format === 'talk' && session('1004')?.format === 'workshop' && session('1005')?.format === 'panel', 'the format does not come from the "Session format" category');
  expect(session('1005')?.format === 'panel' && session('1001')?.format === 'keynote', 'isPlenumSession decides the format');
  expect(session('1002')?.endUser === true, 'the End-User Story category does not mark a Session');
  expect(session('1003')?.endUser === true, 'the End-User Story question does not mark a Session');
  expect(session('1004')?.endUser === false && session('1001')?.endUser === false, 'a "No" category item or a "No" answer marks an End-User Story');
  expect(!session('1006'), 'a declined Session is read');
  expect(raw.sessions.length === 5 && !raw.sessions.some((s) => /Registration|Lunch|Callout/.test(s.title)), 'service sessions are read as Sessions');
  expect(JSON.stringify(raw.breaks) === JSON.stringify([
    { title: 'Registration', start: '2027-04-23T08:00', end: '2027-04-23T08:45', room: null },
    { title: 'Fixture Sponsor Callout', start: '2027-04-23T12:00', end: '2027-04-23T12:15', room: 'Fixture Hall' },
    { title: 'Lunch', start: '2027-04-23T12:15', end: '2027-04-23T13:00', room: null },
  ]), `service sessions are not breaks, plenum ones in every room: ${JSON.stringify(raw.breaks)}`);
  expect(session('1001')?.start === '2027-04-23T09:00' && session('1004')?.end === '2027-04-23T14:30', 'event-local times are not kept as Central wall-clock times');
  expect(session('1005')?.room === 'Fixture Hall' && session('1003')?.room === 'Fixture Room B', 'rooms are not mapped by id');
  expect(session('1004')?.speakers.length === 2, 'a Session loses a Speaker');
  const kinds = (n) => speaker(n).links.map((l) => l.kind).join(',');
  expect(kinds('a') === 'github,bluesky,x', `Speaker A's links map to ${kinds('a')}, not github,bluesky,x (by host; Twitter to x; Sessionize dropped)`);
  expect(kinds('b') === 'linkedin,site', `Speaker B's links map to ${kinds('b')}, not linkedin,site (Instagram dropped)`);
  expect(kinds('c') === 'site,mastodon', `Speaker C's links map to ${kinds('c')}, not site,mastodon (Blog to site; Facebook dropped)`);
  expect(speaker('a').name === 'Fixture Person A' && speaker('a').tagline === 'Platform Engineer, Fixture Company', 'the name or tagline is not mapped');
  for (const [url, hint, kind] of [
    ['https://github.com/x', { type: 'Other', title: 'Github' }, 'github'], ['https://bsky.app/profile/x', { type: 'Other' }, 'bluesky'],
    ['https://x.com/x', {}, 'x'], ['https://example.com/', { type: 'Twitter' }, 'x'], ['https://example.com/', { type: 'Company_Website' }, 'site'],
    ['https://example.com/', { type: 'Blog' }, 'site'], ['https://sessionize.com/x', { type: 'Sessionize' }, null], ['https://example.com/', { type: 'Sessionize' }, null],
    ['https://example.com/', { type: 'Other', title: 'Something' }, null], ['https://example.com/', { fallback: 'site' }, 'site'], ['http://github.com/x', {}, null],
  ]) expect(linkKind(url, hint) === kind, `linkKind(${url}, ${JSON.stringify(hint)}) is ${linkKind(url, hint)}, not ${kind}`);

  // The allowlist and the gates: the planted marker never reaches the model.
  const model = publicProgram(raw, { schedulePublic: true });
  expect(!JSON.stringify(model).includes(marker), 'the planted marker reaches the model');
  expect(!JSON.stringify(model).includes('instagram') && !JSON.stringify(model).includes('sessionize.com') && !JSON.stringify(model).includes('live.fixture'), 'a dropped link or field reaches the model');
  expect(model.speakers.length === 4 && !model.speakers.some((s) => s.name.includes('Person E')), 'a Speaker with no accepted Session reaches the model');
  expect(model.speakers.find((s) => s.name.endsWith(' A'))?.photo === 'https://photos.fixture.invalid/a.jpg', 'the photo address is not kept for download');
  expect(model.sessions.find((s) => s.id === '1002')?.recording === 'https://www.youtube.com/watch?v=fixture1002', 'the recording is dropped');
  const early = publicProgram(raw, { schedulePublic: false });
  expect(early.sessions.every((s) => s.start === null && s.end === null && s.room === null) && !early.rooms.length && !early.breaks.length, 'speakersPublic alone keeps times, rooms or breaks');
  expect(!JSON.stringify(early).includes(marker), 'the planted marker reaches the speakersPublic model');

  // Central time, across daylight saving time (2027: Mar 14 and Nov 7).
  expect(toCentral('2027-04-23T09:15:00') === '2027-04-23T09:15' && toCentral('2027-04-23 09:15') === '2027-04-23T09:15', 'an event-local time is not kept');
  expect(toCentral('2027-04-23T14:15:00Z') === '2027-04-23T09:15', 'a UTC time in April is not CDT (UTC-5)');
  expect(toCentral('2027-01-15T15:15:00Z') === '2027-01-15T09:15', 'a UTC time in January is not CST (UTC-6)');
  expect(toCentral('2027-03-14T08:30:00Z') === '2027-03-14T03:30' && toCentral('2027-03-14T07:59:00Z') === '2027-03-14T01:59', 'the spring-forward hour is wrong');
  expect(toCentral('2027-11-07T06:30:00Z') === '2027-11-07T01:30' && toCentral('2027-11-07T07:30:00Z') === '2027-11-07T01:30', 'the repeated fall-back hour is wrong');
  expect(toCentral('2027-04-23T09:15:00-05:00') === '2027-04-23T09:15' && toCentral('2027-04-23T10:15:00-0400') === '2027-04-23T09:15', 'an offset time is wrong');
  expect(centralToUtc('2027-04-23T09:00')?.toISOString() === '2027-04-23T14:00:00.000Z' && centralToUtc('2027-12-01T09:00')?.toISOString() === '2027-12-01T15:00:00.000Z', 'centralToUtc is wrong');
  expect(centralToUtc('2027-03-14T02:30') === null && centralOf(new Date('2027-03-14T08:00:00Z')) === '2027-03-14T03:00', 'the skipped hour exists');
  await rejects(() => toCentral('2027-03-14T02:30:00'), (m) => /does not exist/.test(m), 'a time in the skipped hour');
  await rejects(() => toCentral('next Friday'), (m) => /not a time/.test(m), 'text as a time');

  // Validation failures name the record and field, never the content.
  const broken = (edit) => { const d = fixture(); edit(d); return d; };
  for (const [what, data, pattern] of [
    ['not an object', [], /not an object/],
    ['no sessions', broken((d) => { delete d.sessions; }), /sessions is not a list/],
    ['a missing title', broken((d) => { d.sessions[2].title = ''; }), /sessions\[2\]\.title is missing/],
    ['a bad time', broken((d) => { d.sessions[0].startsAt = 'soon'; }), /sessions\[0\]\.startsAt is not a time/],
    ['a skipped-hour time', broken((d) => { d.sessions[0].startsAt = '2027-03-14T02:15:00'; }), /sessions\[0\]\.startsAt is a Central time that does not exist/],
    ['speakers not a list', broken((d) => { d.sessions[0].speakers = 'A'; }), /sessions\[0\]\.speakers is not a list/],
    ['a nameless speaker', broken((d) => { d.speakers[0].fullName = ''; d.speakers[0].firstName = null; d.speakers[0].lastName = null; }), /speakers\[0\] has no name/],
    ['a bad room', broken((d) => { d.rooms[0].name = null; }), /rooms\[0\] needs an id and a name/],
    ['no format category', broken((d) => { d.categories = d.categories.filter((c) => c.title !== 'Session format'); }), /no "Session format" category/],
    ['no format picked', broken((d) => { d.sessions[0].categoryItems = []; }), /Session 1001\): no "Session format" item/],
    ['an unknown format', broken((d) => { d.categories[0].items[0].name = 'Fireside chat'; }), /Session 1001\): its "Session format" item is not a known format/],
  ]) await rejects(() => adaptSessionize(data), (m) => pattern.test(m) && !m.includes(marker) && !m.includes('Fireside'), `the adapter on ${what}`);
  expect(validateAll(fixture()).length === 0, 'the fixture does not validate');
  await rejects(() => publicProgram(adaptSessionize(broken((d) => { d.sessions[0].endsAt = '2027-04-23T08:00:00'; })), { schedulePublic: true }), (m) => /ends before it starts/.test(m), 'a Session that ends before it starts');
  await rejects(() => publicProgram(adaptSessionize(broken((d) => { d.sessions[0].speakers.push('nobody'); })), { schedulePublic: true }), (m) => /unknown Speakers nobody/.test(m), 'a Session with an unknown Speaker');

  // 2. The rules. A Proxy proves which variables a choice reads.
  const watched = (env) => {
    const read = new Set();
    return { read, env: new Proxy(env, { get: (t, k) => { read.add(k); return t[k]; } }) };
  };
  for (const context of [undefined, 'deploy-preview', 'branch-deploy', 'dev']) {
    for (const gates of [both, speakersOnly]) {
      const w = watched({ CONTEXT: context, SESSIONIZE_ENDPOINT_ID: ID });
      expect(chooseSource(gates, w.env).kind === 'test', `CONTEXT=${context} with a gate open does not use the test data`);
      expect(!w.read.has('SESSIONIZE_ENDPOINT_ID'), `CONTEXT=${context} reads the platform variable`);
    }
  }
  for (const context of [undefined, 'production']) {
    const w = watched({ CONTEXT: context, SESSIONIZE_ENDPOINT_ID: ID });
    expect(chooseSource(closed, w.env).kind === 'none' && !w.read.has('SESSIONIZE_ENDPOINT_ID'), `closed gates read a source (CONTEXT=${context})`);
  }
  expect(chooseSource(both, { CONTEXT: 'production', SESSIONIZE_ENDPOINT_ID: ID }).kind === 'sessionize', 'production with the ID does not read Sessionize');
  await rejects(() => chooseSource(both, { CONTEXT: 'production' }), (m) => /SESSIONIZE_ENDPOINT_ID is not set/.test(m), 'production with a gate open and no variable');
  await rejects(() => chooseSource(both, { CONTEXT: 'production', SESSIONIZE_ENDPOINT_ID: 'bad/id?x' }), (m) => /not a Sessionize endpoint ID/.test(m) && !m.includes('bad/id'), 'a malformed endpoint ID');

  // The test address: this machine only, and never on Netlify or in GitHub Actions.
  expect(sessionizeBase({}) === 'https://sessionize.com/api/v2' && sessionizeBase(testEnv) === `${origin}/api/v2`, 'the Sessionize base is wrong');
  for (const extra of [{ NETLIFY: 'true' }, { GITHUB_ACTIONS: 'true' }]) {
    await rejects(() => sessionizeBase({ ...testEnv, ...extra }), (m) => /refused on Netlify and in GitHub Actions/.test(m), `KCD_PROGRAM_TEST_BASE with ${Object.keys(extra)[0]}`);
    expect(!fetchable(`${origin}/api/v2`, extra), `a plain-http address is allowed with ${Object.keys(extra)[0]}`);
  }
  await rejects(() => sessionizeBase({ KCD_PROGRAM_TEST_BASE: 'https://evil.example/api' }), (m) => /a server on this machine/.test(m), 'a remote KCD_PROGRAM_TEST_BASE');
  expect(fetchable('https://cdn.example/a.jpg', { NETLIFY: 'true' }) && !fetchable('http://cdn.example/a.jpg', {}) && !fetchable('https://u:p@cdn.example/a.jpg', {}), 'fetchable is wrong');

  // Reading the platform: the local Sessionize, and redacted failures.
  state.requests.length = 0;
  const live = await readPlatform(chooseSource(both, prodSessionize), prodSessionize);
  expect(state.requests.includes(`/api/v2/${ID}/view/All`) && live.sessions.length === 5, 'readPlatform does not read the All view');
  expect(publicModel(live, both, prodSessionize).model.sessions.length === 5, 'publicModel drops a Session');
  const noServer = { ...prodSessionize, KCD_PROGRAM_TEST_BASE: 'http://127.0.0.1:9/api/v2' };
  for (const [mode, env, pattern] of [
    ['500', prodSessionize, /HTTP 500/], ['notjson', prodSessionize, /not JSON/], ['invalid', prodSessionize, /sessions is not a list/],
    ['ok', noServer, /the request failed/],
  ]) {
    state.mode = mode;
    await rejects(() => readPlatform(chooseSource(both, env), env), (m) => pattern.test(m) && !m.includes(ID) && !m.includes('127.0.0.1') && /could not be read/.test(m), `a ${mode} platform`);
  }
  state.mode = 'ok';
  expect(!redact(`https://sessionize.com/api/v2/${ID}/view/All and ${encodeURIComponent(ID)}`, prodSessionize).includes(ID), 'redact keeps the endpoint ID');

  // 3. Full builds with a gate open.
  if (!process.argv.includes('--no-builds')) {
    const build = (env, flags = []) => run('bash', ['scripts/build.sh', '--skip-install', ...flags], env);
    const walk = (dir) => readdirSync(dir).flatMap((n) => { const p = join(dir, n); return statSync(p).isDirectory() ? walk(p) : [p]; });
    const served = () => walk('dist').filter((f) => /\.(?:html|xml|txt|ics|js|css|json|svg)$|(?:^|\/)_(?:redirects|headers)$/.test(f));
    await withGates(both, async () => {
      // Production, from the local Sessionize: the pages, and nothing dropped.
      state.requests.length = 0;
      let b = await build(prodSessionize);
      expect(b.status === 0, `the production build from Sessionize fails:\n${b.log.slice(-2500)}`);
      if (b.status === 0) {
        expect(!b.log.includes(ID) && !b.log.includes(marker), 'the production build log contains the endpoint ID or the marker');
        expect(!walk('dist').some((f) => readFileSync(f).includes(ID)), 'a built file contains the endpoint ID');
        expect(state.requests.join() === `/api/v2/${ID}/view/All`, `the build made ${state.requests.join(', ')} requests, not one All view`);
        const speakers = readdirSync('dist/2027/speakers').filter((n) => statSync(join('dist/2027/speakers', n)).isDirectory()).sort();
        expect(speakers.join() === 'fixture-person-a,fixture-person-b,fixture-person-c,fixture-person-d', `Speaker pages: ${speakers.join()}`);
        expect(readdirSync('dist/2027/sessions').filter((n) => n.endsWith('.ics')).length === 5, 'not every accepted Session has a calendar file');
        expect(!/\bSample\b/.test(readFileSync('dist/2027/schedule/index.html', 'utf8')), 'the production Schedule says "Sample"');
        for (const f of served()) {
          const body = readFileSync(f, 'utf8');
          expect(!body.includes(marker) && !body.includes(origin) && !body.includes('127.0.0.1:') && !body.includes('photos.fixture.invalid'), `${f}: contains the marker or a platform address`);
        }
        const schedule = readFileSync('dist/2027/schedule/index.html', 'utf8');
        expect(/Fixture Sponsor Callout/.test(schedule) && /Fixture Panel: Plenum, but Not a Keynote/.test(schedule) && !/Declined/.test(schedule), 'the Schedule lacks a break or a Session, or shows a declined one');
      }

      // A deploy preview with the gates open and the variable set: the test data, and no request.
      state.requests.length = 0;
      b = await build({ ...prodSessionize, CONTEXT: 'deploy-preview' });
      expect(b.status === 0 && state.requests.length === 0, `the deploy preview fails or reads the platform (${state.requests.length} requests):\n${b.log.slice(-1500)}`);
      expect(b.status === 0 && /using the test program/.test(b.log) && /\bSample\b/.test(readFileSync('dist/2027/schedule/index.html', 'utf8')) && !existsSync('dist/2027/speakers/fixture-person-a'), 'the deploy preview does not use the test data');

      // Production with no variable, and with a failing platform: the build fails, with a redacted message.
      b = await build({ CONTEXT: 'production' });
      expect(b.status !== 0 && /SESSIONIZE_ENDPOINT_ID is not set/.test(b.log), `production with no variable doesn't fail clearly:\n${b.log.slice(-1500)}`);
      state.mode = '500';
      b = await build(prodSessionize);
      expect(b.status !== 0 && /HTTP 500/.test(b.log) && !b.log.includes(ID), `production with a failing platform doesn't fail, or prints the ID:\n${b.log.slice(-1500)}`);
      state.mode = 'ok';
    });
    // The gates closed again: a normal build.
    const b = await build({});
    expect(b.status === 0 && !existsSync('dist/2027/speakers'), `the normal build fails, or builds Speaker pages:\n${b.log.slice(-1500)}`);
  }
} finally {
  restore();
  server.close();
}

if (failures.length) {
  console.error(`Program adapter tests failed (${failures.length} of ${checks}):\n  ${failures.join('\n  ')}`);
  process.exit(1);
}
console.log(`Program adapter tests passed: ${checks} checks.`);
