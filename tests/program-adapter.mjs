// The program platform's tests (src/lib/program-source/, scripts/program-check.mjs), with no real network: a local
// HTTP server stands in for Sessionize, the photo host, the CSV's address and the live site.
//   1. The Sessionize adapter on tests/fixtures/sessionize-all.json, each quirk, Central time across DST, the
//      validation failures, the allowlist (the planted marker never reaches the model) and the program version.
//   2. The CSV fallback on tests/fixtures/program.csv.
//   3. The rules: which builds read the platform, the redaction of the endpoint ID and the CSV address in every
//      error, the test-only addresses refused on Netlify and in GitHub Actions, and the photos.
//   4. scripts/program-check.mjs.
//   5. Unless --no-builds: full builds (scripts/build.sh) with a gate opened in src/data/edition-2027.ts for the
//      run and restored after: production from the local Sessionize and the CSV, a program with more Share Cards
//      than a build draws, a deploy preview and a branch deploy (the test data, no request), production with no
//      variable, and production with a failing platform.
// Usage: node tests/program-adapter.mjs [--no-builds]
import { spawn } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import sharp from 'sharp';
import { centralOf, centralToUtc, toCentral } from '../src/lib/program-source/central.mjs';
import { adaptCsv, parseCsv } from '../src/lib/program-source/csv.mjs';
import { linkKind } from '../src/lib/program-source/links.mjs';
import { programVersion, publicProgram } from '../src/lib/program-source/model.mjs';
import { downloadPhoto } from '../src/lib/program-source/photos.mjs';
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
const csvText = readFileSync('tests/fixtures/program.csv', 'utf8');
const ID = 'fxEndpoint42';
const CSV_SECRET = 'csv-token-fx9';
const both = { speakersPublic: true, schedulePublic: true };
const speakersOnly = { speakersPublic: true, schedulePublic: false };
const closed = { speakersPublic: false, schedulePublic: false };
const clean = Object.fromEntries(Object.entries(process.env).filter(([k]) => !/^(?:CONTEXT|NETLIFY|GITHUB_ACTIONS|GITHUB_OUTPUT|SESSIONIZE_ENDPOINT_ID|PROGRAM_CSV_URL|KCD_)/.test(k)));

// The local stand-in for every remote address.
const state = { mode: 'ok', fixture: fixtureText, live: null, requests: [] };
const photo = await sharp({ create: { width: 600, height: 400, channels: 3, background: { r: 200, g: 40, b: 90 } } }).jpeg().toBuffer();
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
  if (req.url === `/sheets/${CSV_SECRET}/program.csv`) return state.mode === '500' ? send(500, 'text/plain', 'down') : send(200, 'text/csv', local(csvText));
  if (req.url === '/photos/text.jpg') return send(200, 'text/html', '<html>');
  if (req.url === '/photos/broken.jpg') return send(200, 'image/jpeg', 'not a jpeg');
  if (/^\/photos\/[a-z]\.jpg$/.test(req.url)) return send(200, 'image/jpeg', photo);
  if (req.url === '/live/program-version.txt' && state.live !== null) return send(200, 'text/plain', state.live);
  return send(404, 'text/plain', 'not found');
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const origin = `http://127.0.0.1:${server.address().port}`;
const testEnv = { KCD_PROGRAM_TEST_BASE: `${origin}/api/v2` };
const prodSessionize = { ...testEnv, CONTEXT: 'production', SESSIONIZE_ENDPOINT_ID: ID };
const prodCsv = { CONTEXT: 'production', PROGRAM_CSV_URL: `${origin}/sheets/${CSV_SECRET}/program.csv` };
const fixture = () => JSON.parse(fixtureText);
// scripts/program-check.mjs writes its GITHUB_OUTPUT here.
const outDir = mkdtempSync(join(tmpdir(), 'kcd-program-check-'));

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

  // The program version: stable, sorted, and blind to dropped fields.
  const v = programVersion(model);
  expect(/^[0-9a-f]{64}$/.test(v) && v === programVersion(publicProgram(adaptSessionize(fixture()), { schedulePublic: true })), 'the program version is not a stable SHA-256');
  const shuffled = fixture();
  shuffled.sessions.reverse(); shuffled.speakers.reverse(); shuffled.categories.reverse();
  expect(programVersion(publicProgram(adaptSessionize(shuffled), { schedulePublic: true })) === v, 'the program version depends on the platform\'s order');
  const otherMarker = JSON.parse(fixtureText.replaceAll(marker, 'another-dropped-value'));
  expect(programVersion(publicProgram(adaptSessionize(otherMarker), { schedulePublic: true })) === v, 'a dropped field changes the program version');
  const retitled = fixture();
  retitled.sessions[1].title += ' (updated)';
  expect(programVersion(publicProgram(adaptSessionize(retitled), { schedulePublic: true })) !== v, 'a new title keeps the program version');
  const moved = fixture();
  moved.sessions[0].roomId = 102;
  expect(programVersion(publicProgram(adaptSessionize(moved), { schedulePublic: true })) !== v, 'a room change keeps the program version');
  expect(programVersion(early) !== v, 'the gates do not change the program version');

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

  // 2. The CSV fallback.
  const rows = parseCsv('a,"b,c","d ""e""\nf"\r\n\r\n1,2,3\n');
  expect(JSON.stringify(rows) === JSON.stringify([['a', 'b,c', 'd "e"\nf'], ['1', '2', '3']]), `parseCsv is wrong: ${JSON.stringify(rows)}`);
  const csv = adaptCsv(csvText);
  const csvModel = publicProgram(csv, { schedulePublic: true });
  expect(csv.sessions.length === 3 && csv.speakers.length === 3 && csv.breaks.length === 1, 'the CSV rows are not read by type');
  expect(csvModel.rooms.join('|') === 'Fixture Hall|Fixture Room B', 'the CSV rooms are not in order of first use');
  expect(csv.sessions[0].abstract === 'A made-up abstract, with a comma, "quotes" and\na second line.', 'a quoted CSV field is wrong');
  expect(csv.sessions[1].endUser && !csv.sessions[0].endUser && !csv.sessions[2].endUser && csv.sessions[2].format === 'panel', 'the CSV format or end_user is wrong');
  expect(csv.sessions[2].speakers.join() === 'p1,p2,p3' && csv.sessions[2].start === '2027-04-23T15:00', 'the CSV speakers or times are wrong');
  expect(csv.speakers[0].links.map((l) => l.kind).join() === 'github,site' && csv.speakers[1].links.map((l) => l.kind).join() === 'linkedin,bluesky', 'the CSV links are not mapped by host');
  expect(!JSON.stringify(csvModel).includes(marker), 'the planted marker reaches the CSV model');
  for (const [what, text, pattern] of [
    ['no type column', 'id,title,name\n', /no "type" column/],
    ['an unknown type', 'type,id,title,name\nroom,1,x,\n', /row 2, type/],
    ['an unknown format', 'type,id,title,name,format\nsession,1,x,,fireside\n', /row 2, format/],
    ['a bad end_user', 'type,id,title,name,format,end_user\nsession,1,x,,talk,maybe\n', /row 2, end_user/],
    ['a bad time', 'type,id,title,name,format,start\nsession,1,x,,talk,noon\n', /row 2, start/],
    ['an open quote', 'type,id,title,name\nspeaker,1,,"x\n', /never closed/],
  ]) await rejects(() => adaptCsv(text), (m) => pattern.test(m), `the CSV on ${what}`);

  // 3. The rules. A Proxy proves which variables a choice reads.
  const watched = (env) => {
    const read = new Set();
    return { read, env: new Proxy(env, { get: (t, k) => { read.add(k); return t[k]; } }) };
  };
  for (const context of [undefined, 'deploy-preview', 'branch-deploy', 'dev']) {
    for (const gates of [both, speakersOnly]) {
      const w = watched({ CONTEXT: context, SESSIONIZE_ENDPOINT_ID: ID, PROGRAM_CSV_URL: prodCsv.PROGRAM_CSV_URL });
      expect(chooseSource(gates, w.env).kind === 'test', `CONTEXT=${context} with a gate open does not use the test data`);
      expect(!w.read.has('SESSIONIZE_ENDPOINT_ID') && !w.read.has('PROGRAM_CSV_URL'), `CONTEXT=${context} reads the platform variables`);
    }
  }
  for (const context of [undefined, 'production']) {
    const w = watched({ CONTEXT: context, SESSIONIZE_ENDPOINT_ID: ID });
    expect(chooseSource(closed, w.env).kind === 'none' && !w.read.has('SESSIONIZE_ENDPOINT_ID'), `closed gates read a source (CONTEXT=${context})`);
  }
  expect(chooseSource(both, { CONTEXT: 'production', SESSIONIZE_ENDPOINT_ID: ID }).kind === 'sessionize', 'production with the ID does not read Sessionize');
  expect(chooseSource(speakersOnly, { CONTEXT: 'production', PROGRAM_CSV_URL: 'https://example.com/p.csv' }).kind === 'csv', 'production with the CSV address does not read the CSV');
  expect(chooseSource(both, { CONTEXT: 'production', SESSIONIZE_ENDPOINT_ID: ID, PROGRAM_CSV_URL: 'https://example.com/p.csv' }).kind === 'sessionize', 'Sessionize does not come first');
  await rejects(() => chooseSource(both, { CONTEXT: 'production' }), (m) => /neither SESSIONIZE_ENDPOINT_ID nor PROGRAM_CSV_URL is set/.test(m), 'production with a gate open and no variable');
  await rejects(() => chooseSource(both, { CONTEXT: 'production', SESSIONIZE_ENDPOINT_ID: 'bad/id?x' }), (m) => /not a Sessionize endpoint ID/.test(m) && !m.includes('bad/id'), 'a malformed endpoint ID');
  await rejects(() => chooseSource(both, { CONTEXT: 'production', NETLIFY: 'true', PROGRAM_CSV_URL: `http://127.0.0.1/${CSV_SECRET}` }), (m) => /must be an https address/.test(m) && !m.includes(CSV_SECRET), 'a plain-http CSV address on Netlify');

  // The test addresses: this machine only, and never on Netlify or in GitHub Actions.
  expect(sessionizeBase({}) === 'https://sessionize.com/api/v2' && sessionizeBase(testEnv) === `${origin}/api/v2`, 'the Sessionize base is wrong');
  for (const extra of [{ NETLIFY: 'true' }, { GITHUB_ACTIONS: 'true' }]) {
    await rejects(() => sessionizeBase({ ...testEnv, ...extra }), (m) => /refused on Netlify and in GitHub Actions/.test(m), `KCD_PROGRAM_TEST_BASE with ${Object.keys(extra)[0]}`);
    expect(!fetchable(`${origin}/photos/a.jpg`, extra), `a plain-http photo is allowed with ${Object.keys(extra)[0]}`);
  }
  await rejects(() => sessionizeBase({ KCD_PROGRAM_TEST_BASE: 'https://evil.example/api' }), (m) => /a server on this machine/.test(m), 'a remote KCD_PROGRAM_TEST_BASE');
  expect(fetchable('https://cdn.example/a.jpg', { NETLIFY: 'true' }) && !fetchable('http://cdn.example/a.jpg', {}) && !fetchable('https://u:p@cdn.example/a.jpg', {}), 'fetchable is wrong');

  // Reading the platform: the local Sessionize and CSV, and redacted failures.
  state.requests.length = 0;
  const live = await readPlatform(chooseSource(both, prodSessionize), prodSessionize);
  expect(state.requests.includes(`/api/v2/${ID}/view/All`) && live.sessions.length === 5, 'readPlatform does not read the All view');
  const viaServer = publicModel(live, both, prodSessionize);
  expect(viaServer.model.speakers.find((s) => s.name.endsWith(' A'))?.photo === `${origin}/photos/a.jpg`, 'a local test photo is dropped');
  const viaCsv = await readPlatform(chooseSource(both, prodCsv), prodCsv);
  expect(viaCsv.sessions.length === 3, 'readPlatform does not read the CSV');
  const noServer = { ...prodSessionize, KCD_PROGRAM_TEST_BASE: 'http://127.0.0.1:9/api/v2' };
  for (const [mode, env, pattern] of [
    ['500', prodSessionize, /HTTP 500/], ['notjson', prodSessionize, /not JSON/], ['invalid', prodSessionize, /sessions is not a list/],
    ['ok', noServer, /the request failed/], ['500', prodCsv, /HTTP 500/],
  ]) {
    state.mode = mode;
    await rejects(() => readPlatform(chooseSource(both, env), env), (m) => pattern.test(m) && !m.includes(ID) && !m.includes(CSV_SECRET) && !m.includes('127.0.0.1') && /could not be read/.test(m), `a ${mode} platform (${env.PROGRAM_CSV_URL ? 'CSV' : 'Sessionize'})`);
  }
  state.mode = 'ok';
  expect(!redact(`https://sessionize.com/api/v2/${ID}/view/All and ${encodeURIComponent(ID)}`, prodSessionize).includes(ID), 'redact keeps the endpoint ID');
  expect(!redact(`x ${prodCsv.PROGRAM_CSV_URL} and ${encodeURIComponent(prodCsv.PROGRAM_CSV_URL)} y`, prodCsv).includes(CSV_SECRET), 'redact keeps the CSV address');

  // The photos: square WebP in two sizes, from our server only.
  const pic = await downloadPhoto(`${origin}/photos/a.jpg`, 'Speaker 1', {});
  const [small, large] = await Promise.all([sharp(pic.small).metadata(), sharp(pic.large).metadata()]);
  expect(small.format === 'webp' && small.width === 160 && small.height === 160 && large.width === 400 && large.height === 400, `the photo sizes are ${small.width}x${small.height} and ${large.width}x${large.height}`);
  expect(!small.exif && !large.exif, 'a photo keeps its metadata');
  await rejects(() => downloadPhoto(`${origin}/photos/missing.png`, 'Speaker 2', {}), (m) => /Speaker 2's photo: the platform answered HTTP 404/.test(m), 'a missing photo');
  await rejects(() => downloadPhoto(`${origin}/photos/text.jpg`, 'Speaker 3', {}), (m) => /not an image/.test(m), 'a photo that is HTML');
  await rejects(() => downloadPhoto(`${origin}/photos/broken.jpg`, 'Speaker 4', {}), (m) => /could not be read/.test(m), 'a broken photo');
  await rejects(() => downloadPhoto(`${origin}/photos/a.jpg`, 'Speaker 5', { NETLIFY: 'true' }), (m) => /must be https/.test(m), 'a plain-http photo on Netlify');

  // 4. scripts/program-check.mjs.
  const out = join(outDir, 'output');
  const check = (env) => { writeFileSync(out, ''); return run(process.execPath, ['scripts/program-check.mjs'], { ...env, GITHUB_OUTPUT: out }); };
  const checkEnv = { ...testEnv, SESSIONIZE_ENDPOINT_ID: ID, KCD_PROGRAM_LIVE_URL: `${origin}/live/program-version.txt` };
  let res = await run(process.execPath, ['scripts/program-check.mjs', '--gates'], {});
  expect(res.status === 0 && res.out === 'closed\n', `--gates with the gates closed prints ${JSON.stringify(res.out)}`);
  for (const [gates, want] of [[closed, 'closed'], [speakersOnly, 'speakers'], [both, 'schedule']]) {
    res = await withGates(gates, () => run(process.execPath, ['scripts/program-check.mjs', '--which-gates'], {}));
    expect(res.status === 0 && res.out === `${want}\n`, `--which-gates prints ${JSON.stringify(res.out)}, not "${want}"`);
  }
  state.requests.length = 0;
  res = await check(checkEnv);
  expect(res.status === 0 && res.out === 'unchanged\n' && readFileSync(out, 'utf8') === 'changed=false\nversion=\n' && state.requests.length === 0, `closed gates: ${JSON.stringify(res.out)}, ${state.requests.length} requests`);
  await withGates(both, async () => {
    res = await run(process.execPath, ['scripts/program-check.mjs', '--gates'], {});
    expect(res.out === 'open\n', `--gates with a gate open prints ${JSON.stringify(res.out)}`);
    // The version goes to GITHUB_OUTPUT only, for the rebuild job's wait: never to the log.
    state.live = null;
    res = await check(checkEnv);
    expect(res.status === 0 && res.out === 'changed\n' && readFileSync(out, 'utf8') === `changed=true\nversion=${viaServer.version}\n`, `no live file: ${JSON.stringify(res.out)} ${res.err}, output ${JSON.stringify(readFileSync(out, 'utf8'))}`);
    expect(!res.log.includes(viaServer.version), 'program-check prints the program version');
    state.live = `${viaServer.version}\n`;
    res = await check(checkEnv);
    expect(res.status === 0 && res.out === 'unchanged\n' && readFileSync(out, 'utf8') === `changed=false\nversion=${viaServer.version}\n`, `the same program: ${JSON.stringify(res.out)} ${res.err}`);
    expect(!res.log.includes(viaServer.version), 'program-check prints the program version');
    state.fixture = fixtureText.replaceAll(marker, 'another-dropped-value');
    res = await check(checkEnv);
    expect(res.out === 'unchanged\n', 'a dropped field counts as a change');
    state.fixture = fixtureText.replace('Opening the Made-Up Day', 'Opening the Made-Up Day, Updated');
    res = await check(checkEnv);
    expect(res.out === 'changed\n', 'a new title does not count as a change');
    state.fixture = fixtureText;
    res = await check({ ...checkEnv, SESSIONIZE_ENDPOINT_ID: undefined, PROGRAM_CSV_URL: prodCsv.PROGRAM_CSV_URL });
    expect(res.status === 0 && res.out === 'changed\n', `the CSV check: ${JSON.stringify(res.out)} ${res.err}`);
    for (const [label, env, pattern] of [
      ['no variable', { ...checkEnv, SESSIONIZE_ENDPOINT_ID: undefined }, /neither SESSIONIZE_ENDPOINT_ID nor PROGRAM_CSV_URL/],
      ['a failing platform', checkEnv, /HTTP 500/],
      ['GitHub Actions with a test address', { ...checkEnv, GITHUB_ACTIONS: 'true' }, /refused on Netlify and in GitHub Actions/],
    ]) {
      state.mode = label === 'a failing platform' ? '500' : 'ok';
      res = await check(env);
      expect(res.status === 1 && res.out === '' && readFileSync(out, 'utf8') === '' && pattern.test(res.err) && !res.err.includes(ID), `program-check with ${label}: exit ${res.status}, stdout ${JSON.stringify(res.out)}, stderr ${res.err.trim()}`);
    }
    state.mode = 'ok';
  });

  // 5. Full builds with a gate open.
  if (!process.argv.includes('--no-builds')) {
    const build = (env, flags = []) => run('bash', ['scripts/build.sh', '--skip-install', ...flags], env);
    const walk = (dir) => readdirSync(dir).flatMap((n) => { const p = join(dir, n); return statSync(p).isDirectory() ? walk(p) : [p]; });
    const served = () => walk('dist').filter((f) => /\.(?:html|xml|txt|ics|js|css|json|svg)$|(?:^|\/)_(?:redirects|headers)$/.test(f));
    await withGates(both, async () => {
      // Production, from the local Sessionize: the pages, the photos, the version, and nothing dropped.
      state.requests.length = 0;
      let b = await build(prodSessionize);
      expect(b.status === 0, `the production build from Sessionize fails:\n${b.log.slice(-2500)}`);
      if (b.status === 0) {
        expect(!b.log.includes(ID) && !b.log.includes(marker), 'the production build log contains the endpoint ID or the marker');
        expect(!walk('dist').some((f) => readFileSync(f).includes(ID)), 'a built file contains the endpoint ID');
        expect(state.requests.filter((u) => u.startsWith('/api/')).length === 1 && state.requests.filter((u) => u.startsWith('/photos/')).length === 3, `the build made ${state.requests.join(', ')} requests, not one All view and three photos`);
        const speakers = readdirSync('dist/2027/speakers').filter((n) => statSync(join('dist/2027/speakers', n)).isDirectory()).sort();
        expect(speakers.join() === 'fixture-person-a,fixture-person-b,fixture-person-c,fixture-person-d', `Speaker pages: ${speakers.join()}`);
        expect(readdirSync('dist/2027/sessions').filter((n) => n.endsWith('.ics')).length === 5, 'not every accepted Session has a calendar file');
        const photos = readdirSync('dist/2027/speakers').filter((n) => n.endsWith('.webp')).sort();
        expect(photos.join() === ['a', 'b', 'c'].flatMap((x) => [`fixture-person-${x}-large.webp`, `fixture-person-${x}-small.webp`]).join(), `photo files: ${photos.join()}`);
        const page = readFileSync('dist/2027/speakers/fixture-person-a/index.html', 'utf8');
        expect(/<img src="\/2027\/speakers\/fixture-person-a-large\.webp"/.test(page), 'the Speaker page does not load its photo from our domain');
        expect(/<span>FD<\/span>|<span>FP<\/span>/.test(readFileSync('dist/2027/speakers/fixture-person-d/index.html', 'utf8')), 'a Speaker with no photo lacks the placeholder');
        expect((await sharp(readFileSync('dist/2027/speakers/fixture-person-a-small.webp')).metadata()).width === 160, 'the small photo is not 160 px');
        // check-dist refuses an image from another host, in a page or in a stylesheet.
        const css = walk('dist').find((f) => f.endsWith('.css'));
        const [pageBefore, cssBefore] = [page, readFileSync(css, 'utf8')];
        writeFileSync('dist/2027/speakers/fixture-person-a/index.html', page.replace('</body>', '<p data-photo="https://cdn.sessionize.example/fx.jpg"></p></body>'));
        writeFileSync(css, `${cssBefore}\n.fx{background:url("https://cdn.sessionize.example/fx.png")}`);
        const guard = await run(process.execPath, ['scripts/check-dist.mjs'], {});
        expect(guard.status === 1 && /an image from another host: https:\/\/cdn\.sessionize\.example\/fx\.jpg/.test(guard.log) && /loads from another host: https:\/\/cdn\.sessionize\.example\/fx\.png/.test(guard.log), `check-dist passes an external image:\n${guard.log.slice(-800)}`);
        writeFileSync('dist/2027/speakers/fixture-person-a/index.html', pageBefore);
        writeFileSync(css, cssBefore);
        // The published program version is the one scripts/program-check.mjs computes from the platform.
        expect(readFileSync('dist/2027/program-version.txt', 'utf8') === `${viaServer.version}\n`, 'the published program version is not the platform\'s');
        expect(!/\bSample\b/.test(readFileSync('dist/2027/schedule/index.html', 'utf8')), 'the production Schedule says "Sample"');
        for (const f of served()) {
          const body = readFileSync(f, 'utf8');
          expect(!body.includes(marker) && !body.includes(origin) && !body.includes('127.0.0.1:') && !body.includes('photos.fixture.invalid'), `${f}: contains the marker or a platform address`);
        }
        const schedule = readFileSync('dist/2027/schedule/index.html', 'utf8');
        expect(/Fixture Sponsor Callout/.test(schedule) && /Fixture Panel: Plenum, but Not a Keynote/.test(schedule) && !/Declined/.test(schedule), 'the Schedule lacks a break or a Session, or shows a declined one');
      }

      // Production, from the CSV.
      b = await build(prodCsv);
      expect(b.status === 0 && existsSync('dist/2027/speakers/fixture-person-c/index.html') && !b.log.includes(CSV_SECRET), `the production build from the CSV fails or prints its address:\n${b.log.slice(-1500)}`);

      // More Share Cards than a build draws: 151 Sessions by one Speaker. The build draws the first 150, Sessions
      // first, and the 151st Session and the Speaker keep the title card.
      const budget = Number(readFileSync('src/lib/cards/program-cards.ts', 'utf8').match(/PROGRAM_CARD_BUDGET = (\d+)/)[1]);
      const many = fixture();
      const talk = many.sessions.find((s) => s.id === '1002');
      const at = (minutes) => `2027-04-23T${String(8 + Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}:00`;
      many.sessions = Array.from({ length: budget + 1 }, (_, i) => ({ ...talk, id: String(3000 + i), title: `Fixture Load Session ${i + 1}`, speakers: [many.speakers[0].id], startsAt: at(i * 3), endsAt: at(i * 3 + 30) }));
      state.fixture = JSON.stringify(many);
      b = await build(prodSessionize);
      state.fixture = fixtureText;
      expect(b.status === 0, `the production build with ${budget + 1} Sessions fails:\n${b.log.slice(-1500)}`);
      if (b.status === 0) {
        const drawn = readdirSync('dist/cards').filter((n) => /^(?:session|speaker)-/.test(n));
        const cardOf = (page) => readFileSync(`dist/2027/${page}/index.html`, 'utf8').match(/<meta property="og:image" content="[^"]*\/cards\/([a-z0-9-]+)\.png"/)?.[1];
        expect(drawn.length === budget && drawn.every((n) => n.startsWith('session-')), `${budget + 1} Sessions and a Speaker drew ${drawn.length} cards (${drawn.filter((n) => n.startsWith('speaker-')).length} Speakers'), not the first ${budget}`);
        expect(cardOf('sessions/fixture-load-session-1') === 'session-fixture-load-session-1' && cardOf(`sessions/fixture-load-session-${budget + 1}`) === 'default' && cardOf('speakers/fixture-person-a') === 'default',
          `past the budget a page does not keep the title card: ${cardOf(`sessions/fixture-load-session-${budget + 1}`)}, ${cardOf('speakers/fixture-person-a')}`);
        expect(!/Download the Share Card/.test(readFileSync('dist/2027/speakers/fixture-person-a/index.html', 'utf8')), 'a Speaker past the budget offers a Share Card to download');
      }

      // A deploy preview and a branch deploy with the gates open and both variables set to this server: the test
      // data, labeled "Sample" and marked as a test build, and no request to the platform.
      for (const context of ['deploy-preview', 'branch-deploy']) {
        state.requests.length = 0;
        b = await build({ ...prodSessionize, ...prodCsv, CONTEXT: context });
        expect(b.status === 0 && state.requests.length === 0, `the ${context} build fails or reads the platform (${state.requests.length} requests):\n${b.log.slice(-1500)}`);
        expect(b.status === 0 && /using the test program/.test(b.log) && /\bSample\b/.test(readFileSync('dist/2027/schedule/index.html', 'utf8')) && !existsSync('dist/2027/speakers/fixture-person-a')
          && /KCD_PROGRAM_SAMPLE/.test(readFileSync('dist/.test-build', 'utf8')), `the ${context} build does not use the labeled test data`);
      }

      // Production with no variable, and with a failing platform: the build fails, with a redacted message.
      b = await build({ CONTEXT: 'production' });
      expect(b.status !== 0 && /neither SESSIONIZE_ENDPOINT_ID nor PROGRAM_CSV_URL is set/.test(b.log), `production with no variable doesn't fail clearly:\n${b.log.slice(-1500)}`);
      state.mode = '500';
      b = await build(prodSessionize);
      expect(b.status !== 0 && /HTTP 500/.test(b.log) && !b.log.includes(ID), `production with a failing platform doesn't fail, or prints the ID:\n${b.log.slice(-1500)}`);
      state.mode = 'ok';
    });
    // A deploy preview with only the Speakers' gate open: the speakers-only test data, with no times or rooms, and no
    // request to the platform.
    await withGates(speakersOnly, async () => {
      state.requests.length = 0;
      const b = await build({ ...prodSessionize, ...prodCsv, CONTEXT: 'deploy-preview' });
      expect(state.requests.length === 0, `the speakers-only deploy preview reads the platform (${state.requests.length} requests)`);
      expect(b.status === 0 && /using the test program/.test(b.log) && existsSync('dist/2027/speakers/index.html') && existsSync('dist/2027/sessions')
        && !existsSync('dist/2027/today') && !existsSync('dist/2027/schedule.ics') && !/data-schedule/.test(readFileSync('dist/2027/schedule/index.html', 'utf8')),
      `the deploy preview with only speakersPublic open does not use the speakers-only test data:\n${b.log.slice(-1500)}`);
    });
    // The gates closed again: a normal build, with no program version.
    const b = await build({});
    expect(b.status === 0 && !existsSync('dist/2027/program-version.txt') && !existsSync('dist/2027/speakers'), `the normal build fails, or publishes a program version or Speaker files:\n${b.log.slice(-1500)}`);
  }
} finally {
  restore();
  server.close();
  rmSync(outDir, { recursive: true, force: true });
}

if (failures.length) {
  console.error(`Program adapter tests failed (${failures.length} of ${checks}):\n  ${failures.join('\n  ')}`);
  process.exit(1);
}
console.log(`Program adapter tests passed: ${checks} checks.`);
