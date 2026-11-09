// The program platform's tests (src/lib/program-source/, scripts/program-check.mjs), with no real network: a local
// HTTP server stands in for Pretalx, the photo host, the CSV's address and the live site.
//   1. The Pretalx adapter on tests/fixtures/pretalx-event.json: the mapping, each quirk (custom fields by label or
//      identifier, choices by option, breaks across rooms, a Session given twice, one string or one per language),
//      Central time across DST, the validation failures, the allowlist (the planted marker never reaches the model)
//      and the program version.
//   2. The CSV fallback on tests/fixtures/program.csv.
//   3. The rules: which builds read the platform, the CSV before Pretalx, the redaction of the CSV address in every
//      error, the test-only addresses refused on Cloudflare Pages, Netlify and in GitHub Actions, reading Pretalx
//      page by page and its failures, the User-Agent, and the photos.
//   4. scripts/program-check.mjs.
//   5. Unless --no-builds: full builds (scripts/build.sh) with a gate opened in src/data/edition-2027.ts for the
//      run and restored after: production from the local Pretalx (both gates, then only `speakersPublic`) and from
//      the CSV, a program with more Share Cards than a build draws, a deploy preview and a branch deploy (the test
//      data, no request), production before Pretalx releases a schedule, and production with a failing platform.
// Usage: node tests/program-adapter.mjs [--no-builds]
import { spawn } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import sharp from 'sharp';
import { centralOf, centralToUtc, toCentral } from '../src/lib/program-source/central.mjs';
import { pretalx, userAgent } from '../src/lib/program-source/config.mjs';
import { adaptCsv, parseCsv } from '../src/lib/program-source/csv.mjs';
import { linkKind } from '../src/lib/program-source/links.mjs';
import { programVersion, publicProgram } from '../src/lib/program-source/model.mjs';
import { downloadPhoto } from '../src/lib/program-source/photos.mjs';
import { buildKind, isProductionBuild } from '../src/lib/build-context.mjs';
import { chooseSource, publicModel, readPlatform } from '../src/lib/program-source/platform.mjs';
import { adaptPretalx, i18n, validatePretalx } from '../src/lib/program-source/pretalx.mjs';
import { fetchable, fetchBytes, pretalxBase, pretalxPhoto, redact } from '../src/lib/program-source/remote.mjs';

const failures = [];
let checks = 0;
const expect = (ok, message) => { checks += 1; if (!ok) failures.push(message); };
async function rejects(fn, test, message) {
  try { await fn(); expect(false, `${message}: no error`); } catch (e) { expect(test(String(e?.message ?? e)), `${message}: ${e?.message ?? e}`); }
}

const marker = readFileSync('src/data/program-fixture.ts', 'utf8').match(/plantedMarker = '([^']+)'/)[1];
const fixtureText = readFileSync('tests/fixtures/pretalx-event.json', 'utf8');
const csvText = readFileSync('tests/fixtures/program.csv', 'utf8');
const CSV_SECRET = 'csv-token-fx9';
const both = { speakersPublic: true, schedulePublic: true };
const speakersOnly = { speakersPublic: true, schedulePublic: false };
const closed = { speakersPublic: false, schedulePublic: false };
const clean = Object.fromEntries(Object.entries(process.env).filter(([k]) => !/^(?:CONTEXT|NETLIFY|CF_PAGES|GITHUB_ACTIONS|GITHUB_OUTPUT|PROGRAM_CSV_URL|KCD_)/.test(k)));
/** The event's API path, as the reader asks for it. */
const EVENT = `/api/events/${pretalx.event}/`;
/** Pretalx's own photo host in the fixture, which the local server serves instead. */
const AVATARS = 'https://pretalx.com/media/avatars/';

// The local stand-in for every remote address. Pretalx's lists come from the fixture, 50 entries a page at most (or
// `pageMax`), with `next` links as Pretalx sends them. Photos on Pretalx's host, and the CSV's on any host, come from
// here; Fixture Person D's, on another host, stays where it is, so a request for it would fail.
const state = { mode: 'ok', pretalx: fixtureText, csv: csvText, live: null, requests: [], agents: [], pageMax: 50, endlessClosed: false };
const photo = await sharp({ create: { width: 600, height: 400, channels: 3, background: { r: 200, g: 40, b: 90 } } }).jpeg().toBuffer();
const avatar = await sharp({ create: { width: 400, height: 500, channels: 3, background: { r: 30, g: 120, b: 160 } } }).webp().toBuffer();
const server = createServer((req, res) => {
  state.requests.push(req.url);
  state.agents.push(req.headers['user-agent'] ?? '');
  const send = (status, type, body) => { res.writeHead(status, { 'content-type': type }); res.end(body); };
  const local = (s, from) => s.replaceAll(from, `${origin}/photos/`);
  const url = new URL(req.url, origin);
  if (url.pathname.startsWith(EVENT)) {
    const name = url.pathname.slice(EVENT.length).replace(/\/$/, '');
    if (state.mode === '500') return send(500, 'text/plain', 'down');
    if (state.mode === 'notjson') return send(200, 'application/json', '<html>');
    // Until a schedule is released and public, Pretalx answers 401 for the program's lists; the event, its custom
    // fields and its session types stay public.
    if (state.mode === 'unreleased' && !['', 'questions', 'submission-types'].includes(name)) return send(401, 'application/json', '{"detail":"Authentication credentials were not provided."}');
    const data = JSON.parse(local(state.pretalx, AVATARS));
    if (name === '') return state.mode === 'noevent' ? send(404, 'application/json', '{"detail":"Not found."}') : send(200, 'application/json', JSON.stringify(data.event));
    if (!Array.isArray(data[name])) return send(404, 'application/json', '{"detail":"Not found."}');
    if (state.mode === 'nolist') return send(200, 'application/json', '{"detail":"Not a list."}');
    const size = Math.min(Number(url.searchParams.get('page_size') ?? 50), state.pageMax);
    const page = Number(url.searchParams.get('page') ?? 1);
    const at = (p) => { const u = new URL(url); u.searchParams.set('page', String(p)); return u.href; };
    let next = page * size < data[name].length ? at(page + 1) : null;
    if (next && state.mode === 'nexthost') next = next.replace('127.0.0.1', 'localhost');
    if (next && state.mode === 'nextloop') next = url.href;
    const count = data[name].length + (state.mode === 'count' ? 1 : 0);
    return send(200, 'application/json', JSON.stringify({ count, next, previous: page > 1 ? at(page - 1) : null, results: data[name].slice((page - 1) * size, page * size) }));
  }
  if (req.url === `/sheets/${CSV_SECRET}/program.csv`) return state.mode === '500' ? send(500, 'text/plain', 'down') : send(200, 'text/csv', local(state.csv, 'https://photos.fixture.invalid/'));
  if (req.url === '/photos/text.jpg') return send(200, 'text/html', '<html>');
  if (req.url === '/photos/broken.jpg') return send(200, 'image/jpeg', 'not a jpeg');
  if (/^\/photos\/[a-z]\.jpg$/.test(req.url)) return send(200, 'image/jpeg', photo);
  if (/^\/photos\/[A-Za-z0-9_]+\.webp$/.test(req.url)) return send(200, 'image/webp', avatar);
  if (req.url === '/live/program-version.txt' && state.live !== null) return send(200, 'text/plain', state.live);
  // A response with no Content-Length that never ends, until the client closes the connection.
  if (req.url === '/endless') {
    res.writeHead(200, { 'content-type': 'image/jpeg' });
    const chunk = Buffer.alloc(64 * 1024, 7);
    const timer = setInterval(() => res.write(chunk), 2);
    res.on('close', () => { clearInterval(timer); state.endlessClosed = true; });
    return undefined;
  }
  return send(404, 'text/plain', 'not found');
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const origin = `http://127.0.0.1:${server.address().port}`;
const testEnv = { KCD_PROGRAM_TEST_BASE: `${origin}/api` };
const prodPretalx = { ...testEnv, CONTEXT: 'production' };
const prodCsv = { ...testEnv, CONTEXT: 'production', PROGRAM_CSV_URL: `${origin}/sheets/${CSV_SECRET}/program.csv` };
const fixture = () => JSON.parse(fixtureText);
const apiRequests = () => state.requests.filter((u) => u.startsWith('/api/'));
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

// The gates, opened in the Edition file for one step and always restored, and the announcements file likewise.
const EDITION = 'src/data/edition-2027.ts';
const editionText = readFileSync(EDITION, 'utf8');
const EVENT_DAY = editionText.match(/eventDay: '(\d{4}-\d{2}-\d{2})'/)[1];
const ANNOUNCEMENTS = 'src/data/announcements-2027.yaml';
const announcementsText = readFileSync(ANNOUNCEMENTS, 'utf8');
const CLOSED = 'program: { speakersPublic: false, schedulePublic: false }';
if (!editionText.includes(CLOSED)) throw new Error(`${EDITION}: the gates aren't closed as "${CLOSED}"; these tests open them for a run`);
const restore = () => { writeFileSync(EDITION, editionText); writeFileSync(ANNOUNCEMENTS, announcementsText); };
process.on('exit', restore);
for (const sig of ['SIGINT', 'SIGTERM']) process.on(sig, () => { restore(); process.exit(130); });
async function withGates(gates, fn) {
  writeFileSync(EDITION, editionText.replace(CLOSED, `program: { speakersPublic: ${gates.speakersPublic}, schedulePublic: ${gates.schedulePublic} }`));
  try { return await fn(); } finally { restore(); }
}

try {
  // 1. The Pretalx adapter.
  const raw = adaptPretalx(fixture());
  const session = (id) => raw.sessions.find((s) => s.id === id);
  const speaker = (c) => raw.speakers.find((s) => s.id === `FXSPK${c.toUpperCase()}`);
  // The site links to the call for proposals on Pretalx: the reader asks for that event.
  const cfp = readFileSync('src/data/cfp.ts', 'utf8').match(/submitUrl: '([^']+)'/)?.[1] ?? '';
  expect(cfp === `${new URL(pretalx.base).origin}/${pretalx.event}/cfp`, `src/data/cfp.ts links to ${cfp}, but config.mjs reads the event ${pretalx.event} at ${pretalx.base}`);
  expect(raw.rooms.join('|') === `Fixture Hall|Fixture Room B|Fixture Storage ${marker}`, `rooms are ${raw.rooms.join('|')}, not in their position order`);
  expect(session('FXKEY1')?.format === 'keynote' && session('FXEUS2')?.format === 'talk' && session('FXWRK4')?.format === 'workshop' && session('FXALL5')?.format === 'talk', 'the format does not come from the session type');
  expect(session('FXEUS2')?.endUser === true, 'a "True" End-User Story answer does not mark a Session');
  expect(session('FXKEY1')?.endUser === false && session('FXWRK4')?.endUser === false, 'a "False" End-User Story answer marks a Session');
  expect(session('FXTLK3')?.endUser === false && session('FXALL5')?.endUser === false, 'a Session with no End-User Story answer is marked');
  expect(!session('FXREJ6') && !session('FXACC7') && raw.sessions.length === 5, `a Session that isn't confirmed is read (${raw.sessions.map((s) => s.id).join()})`);
  expect(JSON.stringify(raw.breaks) === JSON.stringify([
    { title: 'Registration', start: '2027-04-23T08:00', end: '2027-04-23T08:45', room: null },
    { title: 'Fixture Sponsor Callout', start: '2027-04-23T12:00', end: '2027-04-23T12:15', room: 'Fixture Hall' },
    { title: 'Lunch', start: '2027-04-23T12:15', end: '2027-04-23T13:00', room: null },
  ]), `breaks are not read, or a break in every room is not one break: ${JSON.stringify(raw.breaks)}`);
  expect(session('FXKEY1')?.start === '2027-04-23T09:00' && session('FXKEY1')?.end === '2027-04-23T09:30', `a time in UTC is not converted to Central: ${session('FXKEY1')?.start}`);
  expect(session('FXWRK4')?.start === '2027-04-23T13:00' && session('FXWRK4')?.end === '2027-04-23T13:50' && session('FXEUS2')?.start === '2027-04-23T10:00', 'a time with an offset is not converted to Central');
  expect(session('FXALL5')?.room === 'Fixture Hall' && session('FXTLK3')?.room === 'Fixture Room B', 'rooms are not mapped by id');
  expect(session('FXWRK4')?.speakers.join() === 'FXSPKC,FXSPKD' && session('FXALL5')?.speakers.join() === 'FXSPKD,FXSPKA,FXSPKB,FXSPKC', 'a Session loses a Speaker, or the Speakers\' order');
  expect(session('FXKEY1')?.abstract === 'A made-up keynote abstract for the adapter tests.\n\nA made-up second paragraph,\nfrom the description field.', `the abstract and the description are not one text: ${JSON.stringify(session('FXKEY1')?.abstract)}`);
  expect(session('FXTLK3')?.abstract === 'A made-up talk with a description and no abstract.' && session('FXWRK4')?.abstract === null, 'a description alone, or empty texts, are wrong');
  const pasted = adaptPretalx(JSON.parse(fixtureText.replace('"description": "A made-up second paragraph,\\r\\nfrom the description field."', '"description": "A made-up keynote abstract for the adapter tests.\\r\\n"'))).sessions.find((s) => s.id === 'FXKEY1');
  expect(pasted?.abstract === 'A made-up keynote abstract for the adapter tests.', `the same text in the abstract and the description shows twice: ${JSON.stringify(pasted?.abstract)}`);
  expect(session('FXKEY1')?.level === 'Beginner' && session('FXEUS2')?.level === 'Intermediate' && session('FXTLK3')?.level === null, `the Level is not read by its option (${session('FXEUS2')?.level})`);
  expect(session('FXKEY1')?.recording === null, 'Pretalx gives no recording, but the Session has one');
  expect(speaker('a')?.name === 'Fixture Person A' && speaker('a')?.tagline === 'Platform Engineer, Fixture Company' && speaker('a')?.bio === 'Fixture Person A is made up for the adapter tests.', 'the name, tagline or bio is not mapped');
  expect(speaker('c')?.bio === null && speaker('d')?.bio === null && speaker('d')?.tagline === null, 'a missing bio or job title is not null');
  const kinds = (c) => speaker(c).links.map((l) => `${l.kind} ${l.url}`).join(', ');
  expect(kinds('a') === 'site https://fixture-a.example/, github https://github.com/fixture-person-a', `Speaker A's links are ${kinds('a')}, not site, github (in the fields' order)`);
  expect(kinds('b') === 'linkedin https://www.linkedin.com/in/fixture-person-b', `Speaker B's links are ${kinds('b')}, not linkedin (the website field by its host; Instagram and plain http dropped)`);
  expect(kinds('c') === 'mastodon https://mastodon.fixture.example/@fixturec, x https://x.com/fixture_person_c', `Speaker C's links are ${kinds('c')}, not mastodon, x (a Pretalx profile dropped)`);
  const githubPages = adaptPretalx(JSON.parse(fixtureText.replace('https://github.com/fixture-person-a', 'https://fixture-person-a.github.io/'))).speakers[0].links.map((l) => `${l.kind} ${l.url}`).join(', ');
  expect(githubPages === 'site https://fixture-a.example/, github https://fixture-person-a.github.io/', `a GitHub field's github.io address is not a GitHub link: ${githubPages}`);
  for (const [url, hint, kind] of [
    ['https://github.com/x', { type: 'github', title: 'GitHub' }, 'github'], ['https://bsky.app/profile/x', { type: 'bluesky' }, 'bluesky'],
    ['https://x.com/x', {}, 'x'], ['https://example.com/', { type: 'twitter' }, 'x'], ['https://example.com/', { type: 'website' }, 'site'],
    ['https://example.com/', { title: 'Blog' }, 'site'], ['https://example.com/', { type: 'linkedin' }, 'linkedin'], ['https://example.com/@x', {}, 'mastodon'],
    ['https://pretalx.com/kcd-texas-2027/speaker/X/', { fallback: 'site' }, null], ['https://sessionize.com/x', { fallback: 'site' }, null],
    ['https://example.com/', { type: 'instagram', fallback: 'site' }, null], ['https://example.com/', { type: 'discord' }, null],
    ['https://example.com/', { title: 'Something' }, null], ['https://example.com/', { fallback: 'site' }, 'site'], ['http://github.com/x', {}, null],
    ['https://fixture.github.io/', { type: 'github' }, 'github'], ['https://fixture.example/', { type: 'bluesky' }, 'bluesky'], ['https://fixture.example/', { title: 'Bsky' }, 'bluesky'],
  ]) expect(linkKind(url, hint) === kind, `linkKind(${url}, ${JSON.stringify(hint)}) is ${linkKind(url, hint)}, not ${kind}`);
  // One string, or one per language: English first, else the first language with text.
  expect(i18n('  Talk ') === 'Talk' && i18n({ de: 'Vortrag', en: 'Talk' }) === 'Talk' && i18n({ es: '', de: 'Vortrag' }) === 'Vortrag' && i18n({}) === null && i18n({ en: ' ' }) === null && i18n(null) === null && i18n('a\r\nb') === 'a\nb', 'i18n is wrong');
  const plain = JSON.parse(fixtureText, (k, v) => (v && typeof v === 'object' && !Array.isArray(v) && typeof v.en === 'string' && Object.values(v).every((x) => typeof x === 'string') ? v.en : v));
  expect(JSON.stringify(adaptPretalx(plain)) === JSON.stringify(raw), 'plain strings, as Pretalx sends them for ?lang=en, give another program');

  // The custom fields: by label, whatever its case, spaces and punctuation, or by identifier. A missing End-User Story
  // or job title field stops the build; a missing Level or website field doesn't.
  const broken = (edit) => { const d = fixture(); edit(d); return d; };
  const renamed = adaptPretalx(broken((d) => { d.questions[0].question = { en: 'End-user story' }; d.questions[2].question = 'JOB TITLE & COMPANY:'; }));
  expect(renamed.sessions.find((s) => s.id === 'FXEUS2')?.endUser && renamed.speakers[0].tagline === 'Platform Engineer, Fixture Company', 'a field is not found by a label that differs only in case, spaces, punctuation or "&"');
  const byIdentifier = adaptPretalx(broken((d) => { d.questions[0].question = { en: 'A label the site does not know' }; d.questions[0].identifier = 'end-user-story'; }));
  expect(byIdentifier.sessions.find((s) => s.id === 'FXEUS2')?.endUser === true, 'a field is not found by its identifier');
  await rejects(() => adaptPretalx(broken((d) => { d.questions = d.questions.filter((q) => q.id !== 7001); })), (m) => /no public custom field per proposal named "End-User Story" or "Is this an End-User Story\?"/.test(m) && /turn on "Publish answers" for the field and keep it active/.test(m) && /pretalx\.fields\.endUser/.test(m), 'no End-User Story field');
  await rejects(() => adaptPretalx(broken((d) => { d.questions[0].target = 'speaker'; })), (m) => /no public custom field per proposal named "End-User Story"/.test(m), 'an End-User Story field asked per speaker');
  await rejects(() => adaptPretalx(broken((d) => { d.questions[2].question = { en: 'Pronouns' }; })), (m) => /no public custom field per speaker named "Job title and company"/.test(m) && /pretalx\.fields\.tagline/.test(m) && !m.includes('Pronouns'), 'no job title field');
  const noLevel = adaptPretalx(broken((d) => { d.questions = d.questions.filter((q) => q.id !== 7002); }));
  expect(noLevel.sessions.every((s) => s.level === null) && noLevel.sessions.length === 5, 'a missing Level field fails, or keeps a Level');
  const noWebsite = adaptPretalx(broken((d) => { d.questions[3].question = { en: 'Another address' }; }));
  expect(noWebsite.speakers[0].links.map((l) => l.kind).join() === 'github' && noWebsite.speakers[1].links.map((l) => l.kind).join() === 'linkedin', 'without a website field, an address no rule names is kept, or a known host is dropped');

  // The session types: a type the site doesn't know, or one Pretalx doesn't list, stops the build, naming it by id.
  await rejects(() => adaptPretalx(broken((d) => { d['submission-types'][0].name = { en: 'Fireside chat' }; })), (m) => /submissions\[1\] \(Session FXEUS2\): its session type \(9001\) is not a known format/.test(m) && !m.includes('Fireside'), 'an unknown session type');
  await rejects(() => adaptPretalx(broken((d) => { d.submissions[0].submission_type = 9999; })), (m) => /submissions\[0\] \(Session FXKEY1\): its session type \(9999\) is not one of the session types/.test(m), 'a missing session type');

  // Breaks: one per title and time, across every room when it's in each room with a Session, else named by its rooms
  // (a lobby with no Session too); with no title, "Break".
  const lobby = adaptPretalx(broken((d) => {
    d.rooms.push({ id: 104, name: { en: 'Fixture Lobby' }, description: null, uuid: '00000000-0000-4000-8000-000000000104', guid: null, capacity: null, position: 3, hidden: false });
    d.slots.push({ id: 6100, room: 104, start: '2027-04-23T07:30:00-05:00', end: '2027-04-23T08:00:00-05:00', submission: null, schedule: 5001, description: { en: 'Coffee' }, duration: 30 });
    d.slots.push({ id: 6101, room: 104, start: '2027-04-23T16:00:00-05:00', end: '2027-04-23T16:15:00-05:00', submission: null, schedule: 5001, description: null, duration: 15 });
    d.slots.push({ id: 6102, room: 102, start: '2027-04-23T16:00:00-05:00', end: '2027-04-23T16:15:00-05:00', submission: null, schedule: 5001, description: { en: '' }, duration: 15 });
    d.slots.push({ id: 6103, room: 101, start: '2027-04-23T17:00:00-05:00', end: '2027-04-23T17:30:00-05:00', submission: null, schedule: 5001, description: { en: 'Closing drinks' }, duration: 30 });
    d.slots.push({ id: 6104, room: 102, start: '2027-04-23T17:00:00-05:00', end: '2027-04-23T17:30:00-05:00', submission: null, schedule: 5001, description: { en: 'Closing drinks' }, duration: 30 });
    d.slots.push({ id: 6105, room: 104, start: '2027-04-23T17:00:00-05:00', end: '2027-04-23T17:30:00-05:00', submission: null, schedule: 5001, description: { en: 'Closing drinks' }, duration: 30 });
  }));
  const breaksAt = (t) => lobby.breaks.filter((b) => b.start === t).map((b) => `${b.title} @ ${b.room}`).join(' | ');
  expect(breaksAt('2027-04-23T07:30') === 'Coffee @ Fixture Lobby' && breaksAt('2027-04-23T16:00') === 'Break @ Fixture Room B, Fixture Lobby' && breaksAt('2027-04-23T17:00') === 'Closing drinks @ null' && breaksAt('2027-04-23T12:00') === 'Fixture Sponsor Callout @ Fixture Hall',
    `breaks in some rooms, in a lobby, or with no title are wrong: ${JSON.stringify(lobby.breaks)}`);

  // A Session given twice: two Sessions, the second naming the first; while only the Speakers are public, one.
  const repeated = adaptPretalx(broken((d) => { d.slots.push({ id: 6012, room: 102, start: '2027-04-23T15:00:00-05:00', end: '2027-04-23T15:50:00-05:00', submission: 'FXWRK4', schedule: 5001, description: null, duration: 50 }); }));
  const workshops = (list) => list.filter((s) => s.title.startsWith('Fixture Workshop'));
  expect(workshops(repeated.sessions).map((s) => `${s.id} ${s.start} ${s.repeatOf ?? '-'}`).join() === 'FXWRK4 2027-04-23T13:00 -,FXWRK4-2 2027-04-23T15:00 FXWRK4', `a Session given twice is wrong: ${workshops(repeated.sessions).map((s) => `${s.id} ${s.start}`).join()}`);
  const twice = publicProgram(repeated, { schedulePublic: true });
  expect(workshops(twice.sessions).length === 2 && !JSON.stringify(twice).includes('repeatOf'), 'the Schedule does not show a Session given twice twice, or the model keeps repeatOf');
  const once = publicProgram(repeated, { schedulePublic: false });
  expect(workshops(once.sessions).map((s) => s.id).join() === 'FXWRK4', 'with only the Speakers public, a Session given twice shows twice');
  // A slot with no time isn't scheduled: with the Schedule public, its Session fails.
  const unscheduled = adaptPretalx(broken((d) => { d.slots[4].start = null; }));
  expect(unscheduled.sessions.find((s) => s.id === 'FXTLK3')?.start === null, 'a slot with no time gives a time');
  await rejects(() => publicProgram(unscheduled, { schedulePublic: true }), (m) => /Session FXTLK3: the Schedule is public, but it has no time or room/.test(m), 'a Session with no scheduled slot, with the Schedule public');

  // Photos: only from Pretalx's host or its subdomains, or the event's custom domain (https). The fixture's D is on
  // Gravatar: dropped.
  for (const [url, env, hosts, want] of [
    ['https://pretalx.com/media/avatars/a.webp', {}, [], true], ['https://cdn.pretalx.com/media/a.webp', {}, [], true],
    ['https://notpretalx.com/a.webp', {}, [], false], ['https://pretalx.com.example.net/a.webp', {}, [], false],
    ['http://pretalx.com/media/avatars/a.webp', {}, [], false], ['https://u:p@pretalx.com/a.webp', {}, [], false],
    ['https://www.gravatar.com/avatar/x', {}, [], false], ['https://cfp.fixture.example/a.webp', {}, ['cfp.fixture.example'], true],
    ['https://cfp.fixture.example/a.webp', {}, [], false], ['not an address', {}, [], false],
    [`${origin}/photos/a.jpg`, {}, [], true], [`${origin}/photos/a.jpg`, { NETLIFY: 'true' }, [], false],
  ]) expect(pretalxPhoto(url, env, hosts) === want, `pretalxPhoto(${url}, ${JSON.stringify(env)}, ${JSON.stringify(hosts)}) is ${!want}`);
  expect(speaker('a')?.photo === 'https://pretalx.com/media/avatars/FXSPKA_fixture.webp' && speaker('d')?.photo === null, 'a photo on Pretalx is dropped, or one on Gravatar kept');
  const custom = (domain) => adaptPretalx(broken((d) => {
    d.event.custom_domain = domain;
    d.speakers[3].avatar_url = 'https://cfp.fixture.example/media/avatars/FXSPKD.webp';
    d.speakers[2].avatar_url = 'https://cfp.fixture.example.evil.invalid/media/avatars/FXSPKC.webp';
  }));
  expect(custom('https://cfp.fixture.example').speakers[3].photo === 'https://cfp.fixture.example/media/avatars/FXSPKD.webp' && custom('https://cfp.fixture.example').speakers[2].photo === null, 'a photo on the event\'s custom domain is dropped, or one on a look-alike host kept');
  expect(custom('http://cfp.fixture.example').speakers[3].photo === null && custom('not an address').speakers[3].photo === null, 'a custom domain that is not https lets its photos in');
  // Optional fields left out, and odd values: no error, and nothing made up.
  const sparse = adaptPretalx(broken((d) => {
    delete d.speakers[0].biography; delete d.speakers[0].avatar_url; delete d.submissions[0].description; delete d.questions[0].identifier;
    delete d.rooms[0].position; delete d.event.custom_domain; d.speakers[1].avatar_url = ''; d.submissions[1].answers[0].answer = null; d.submissions[1].answers[1].options = null;
  }));
  expect(sparse.speakers[0].bio === null && sparse.speakers[0].photo === null && sparse.speakers[1].photo === null && sparse.sessions[0].abstract === 'A made-up keynote abstract for the adapter tests.'
    && sparse.sessions.find((s) => s.id === 'FXEUS2')?.endUser === false && sparse.sessions.find((s) => s.id === 'FXEUS2')?.level === 'Intermedio', 'missing or odd optional fields are wrong');

  // The allowlist and the gates: the planted marker never reaches the model. The fixture plants it in every text field
  // the allowlist drops, and in no field it keeps.
  const fx = fixture();
  for (const [field, value] of [
    ["the event's email", fx.event.email], ["the event's logo", fx.event.logo], ["a field's help text", fx.questions[0].help_text.en],
    ["another speaker field's label", fx.questions[7].question.en], ['a Level option', fx.questions[1].options[3].answer.en],
    ["a Session's image", fx.submissions[0].image], ["a Session's notes", fx.submissions[0].notes], ["a Session's internal notes", fx.submissions[0].internal_notes],
    ["a Session's answer to another field", fx.submissions[0].answers[2].answer], ['a rejected Session', fx.submissions[5].title],
    ["a Session that isn't confirmed", fx.submissions[6].title], ["a Speaker's email", fx.speakers[0].email], ["a Speaker's internal notes", fx.speakers[0].internal_notes],
    ["a Speaker's answer to another field", fx.speakers[0].answers[3].answer], ['an Instagram link', fx.speakers[1].answers[2].answer],
    ['a plain-http link', fx.speakers[1].answers[3].answer], ['a Pretalx profile link', fx.speakers[2].answers[2].answer],
    ['a photo on another host', fx.speakers[3].avatar_url], ['a Speaker with no confirmed Session', fx.speakers[4].name],
    ["a room's description", fx.rooms[0].description.en], ['a hidden room with no Session', fx.rooms[2].name.en], ["a Session's slot description", fx.slots[9].description.en],
  ]) expect(String(value).includes(marker), `the fixture has no planted marker in ${field}`);
  const model = publicProgram(raw, { schedulePublic: true });
  expect(!JSON.stringify(model).includes(marker), 'the planted marker reaches the model');
  expect(session('FXWRK4')?.level.includes(marker) && model.sessions.every((s) => !('level' in s)), 'the Level is not read, or reaches the model');
  expect(model.speakers.length === 4 && !model.speakers.some((s) => s.name.includes('Person E')), 'a Speaker with no confirmed Session reaches the model');
  expect(model.rooms.join('|') === 'Fixture Hall|Fixture Room B', `the model's rooms are ${model.rooms.join('|')}`);
  expect(!JSON.stringify(model).includes('instagram') && !JSON.stringify(model).includes('gravatar') && !JSON.stringify(model).includes('slides.fixture'), 'a dropped link, photo or answer reaches the model');
  const early = publicProgram(raw, { schedulePublic: false });
  expect(early.sessions.every((s) => s.start === null && s.end === null && s.room === null) && !early.rooms.length && !early.breaks.length, 'speakersPublic alone keeps times, rooms or breaks');
  expect(!JSON.stringify(early).includes(marker), 'the planted marker reaches the speakersPublic model');

  // The program version: stable, sorted, and blind to dropped fields.
  const v = programVersion(model);
  expect(/^[0-9a-f]{64}$/.test(v) && v === programVersion(publicProgram(adaptPretalx(fixture()), { schedulePublic: true })), 'the program version is not a stable SHA-256');
  const shuffled = fixture();
  for (const key of ['questions', 'submission-types', 'rooms', 'submissions', 'speakers', 'slots']) shuffled[key].reverse();
  expect(programVersion(publicProgram(adaptPretalx(shuffled), { schedulePublic: true })) === v, 'the program version depends on Pretalx\'s order');
  const otherMarker = JSON.parse(fixtureText.replaceAll(marker, 'another-dropped-value'));
  expect(programVersion(publicProgram(adaptPretalx(otherMarker), { schedulePublic: true })) === v, 'a dropped field changes the program version');
  const retitled = fixture();
  retitled.submissions[1].title += ' (updated)';
  expect(programVersion(publicProgram(adaptPretalx(retitled), { schedulePublic: true })) !== v, 'a new title keeps the program version');
  const moved = fixture();
  moved.slots[2].room = 102;
  expect(programVersion(publicProgram(adaptPretalx(moved), { schedulePublic: true })) !== v, 'a room change keeps the program version');
  expect(programVersion(early) !== v, 'the gates do not change the program version');

  // Central time, across daylight saving time (2027: Mar 14 and Nov 7), in central.mjs and through the adapter.
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
  const across = (start, end) => adaptPretalx(broken((d) => { d.slots[2].start = start; d.slots[2].end = end; })).sessions.find((s) => s.id === 'FXKEY1');
  for (const [start, end, want] of [
    ['2027-03-14T07:30:00Z', '2027-03-14T08:30:00Z', '2027-03-14T01:30 2027-03-14T03:30'], ['2027-11-07T06:30:00Z', '2027-11-07T07:45:00Z', '2027-11-07T01:30 2027-11-07T01:45'],
    ['2027-01-15T15:15:00Z', '2027-01-15T15:45:00Z', '2027-01-15T09:15 2027-01-15T09:45'], ['2027-04-23T22:00:00+08:00', '2027-04-23T22:30:00+08:00', '2027-04-23T09:00 2027-04-23T09:30'],
  ]) expect(`${across(start, end)?.start} ${across(start, end)?.end}` === want, `the slot ${start} to ${end} is ${across(start, end)?.start} to ${across(start, end)?.end} in Central, not ${want}`);

  // Validation failures name the list, the position and the field, never the content.
  for (const [what, data, pattern] of [
    ['not an object', [], /not an object/],
    ['no submissions', broken((d) => { delete d.submissions; }), /submissions is not a list/],
    ['another event', broken((d) => { d.event.slug = 'kcd-texas-2026'; }), /the event's short form is not kcd-texas-2027/],
    ['a missing title', broken((d) => { d.submissions[2].title = ''; }), /submissions\[2\]\.title is missing/],
    ['an odd code', broken((d) => { d.submissions[1].code = `FX EUS2 ${marker}<`; }), /submissions\[1\]\.code is not a Pretalx code/],
    ['a code twice', broken((d) => { d.speakers[1].code = 'FXSPKA'; }), /speakers\[1\] \(FXSPKA\) comes twice/],
    ['a bad time', broken((d) => { d.slots[2].start = 'soon'; }), /slots\[2\]\.start is not a time/],
    ['a skipped-hour time', broken((d) => { d.slots[2].start = '2027-03-14T02:15:00'; }), /slots\[2\]\.start is a Central time that does not exist/],
    ['speakers not a list', broken((d) => { d.submissions[0].speakers = 'FXSPKA'; }), /submissions\[0\]\.speakers is not a list of codes/],
    ['answers not expanded', broken((d) => { d.submissions[0].answers = [8001]; }), /submissions\[0\]\.answers\[0\] is not an object \(the answers aren't expanded\)/],
    ['options not expanded', broken((d) => { d.questions[1].options = [7101, 7102]; }), /questions\[1\]\.options is not a list of options \(the options aren't expanded\)/],
    ['a nameless speaker', broken((d) => { d.speakers[0].name = ' '; }), /speakers\[0\] has no name/],
    ['a bad room', broken((d) => { d.rooms[0].name = null; }), /rooms\[0\] needs an id and a name/],
    ['a nameless session type', broken((d) => { d['submission-types'][2].name = {}; }), /submission-types\[2\] needs an id and a name/],
    ['an unknown room', broken((d) => { d.slots[3].room = 999; }), /slots\[3\]: its room \(999\) is not one of the rooms/],
  ]) await rejects(() => adaptPretalx(data), (m) => pattern.test(m) && !m.includes(marker), `the adapter on ${what}`);
  expect(validatePretalx(fixture()).length === 0, `the fixture does not validate: ${validatePretalx(fixture()).join('; ')}`);
  await rejects(() => publicProgram(adaptPretalx(broken((d) => { d.slots[2].end = '2027-04-23T13:00:00Z'; })), { schedulePublic: true }), (m) => /Session FXKEY1: it ends before it starts/.test(m), 'a Session that ends before it starts');
  await rejects(() => publicProgram(adaptPretalx(broken((d) => { d.submissions[0].speakers.push('NOBODY'); })), { schedulePublic: true }), (m) => /Session FXKEY1: unknown Speakers NOBODY/.test(m), 'a Session with an unknown Speaker');
  // An empty program fails while a gate is open: a released schedule with only breaks has no Sessions and no
  // Speakers, and would build an empty Schedule and Speakers list, and a link to a calendar file that isn't built.
  const onlyBreaks = broken((d) => { d.submissions = d.submissions.filter((s) => s.state !== 'confirmed'); });
  await rejects(() => publicProgram(adaptPretalx(onlyBreaks), { schedulePublic: true }), (m) => /the Schedule is public \(schedulePublic\), but the program has no Sessions/.test(m), 'only breaks, with the Schedule public');
  await rejects(() => publicProgram(adaptPretalx(onlyBreaks), { schedulePublic: false }), (m) => /the Speakers are public \(speakersPublic\), but the program has no Speakers/.test(m), 'only breaks, with only the Speakers public');
  await rejects(() => publicModel(adaptPretalx(onlyBreaks), both, {}), (m) => /^The program data is not valid: the Schedule is public/.test(m), 'publicModel on an empty program');
  await rejects(() => publicProgram(adaptCsv('type,id,title,name,start,end\nbreak,,Lunch,,2027-04-23 12:00,2027-04-23 13:00\n'), { schedulePublic: true }), (m) => /no Sessions/.test(m), 'a CSV with only a break');

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
  // The CSV's photos may be on any https host.
  expect(publicModel(csv, both, prodCsv).model.speakers.find((s) => s.id === 'p1')?.photo === 'https://photos.fixture.invalid/a.jpg', 'a CSV photo on another https host is dropped');
  for (const [what, text, pattern] of [
    ['no type column', 'id,title,name\n', /no "type" column/],
    ['an unknown type', 'type,id,title,name\nroom,1,x,\n', /row 2, type/],
    ['an unknown format', 'type,id,title,name,format\nsession,1,x,,fireside\n', /row 2, format/],
    ['a bad end_user', 'type,id,title,name,format,end_user\nsession,1,x,,talk,maybe\n', /row 2, end_user/],
    ['a bad time', 'type,id,title,name,format,start\nsession,1,x,,talk,noon\n', /row 2, start/],
    ['an open quote', 'type,id,title,name\nspeaker,1,,"x\n', /never closed/],
  ]) await rejects(() => adaptCsv(text), (m) => pattern.test(m), `the CSV on ${what}`);
  // Errors name the CSV's rows as the spreadsheet numbers them (empty rows count), never its ids: the refresh
  // check's log is public, and an id could be a name. The allowlist's errors on a CSV's records do too.
  expect(JSON.stringify(parseCsv('a\n\n,\nb\n', { keepEmpty: true })) === JSON.stringify([['a'], [''], ['', ''], ['b']]) && JSON.stringify(parseCsv('a\n\n,\nb\n')) === JSON.stringify([['a'], ['b']]), 'parseCsv keeps or drops empty rows wrongly');
  const secretId = 'jane-q-example';
  for (const [what, text, pattern] of [
    ['a speaker id used twice, after an empty row', `type,id,title,name\nspeaker,${secretId},,A\n,,,\nspeaker,${secretId},,B\n`, /row 4, id: an earlier speaker row has the same id/],
    ['a session id used twice', `type,id,title,name,format,speakers\nspeaker,p1,,A\nsession,${secretId},T1,,talk,p1\nsession,${secretId},T2,,talk,p1\n`, /row 4, id: an earlier session row has the same id/],
    ['an unknown Speaker', `type,id,title,name,format,speakers\nspeaker,p1,,A\nsession,s1,T1,,talk,p1;${secretId}\n`, /row 3, speakers: an id matches no speaker row/],
  ]) await rejects(() => adaptCsv(text), (m) => pattern.test(m) && !m.includes(secretId), `the CSV on ${what}`);
  for (const [what, text, pattern] of [
    ['a Session with no time or room', `type,id,title,name,format,speakers\nspeaker,p1,,A\nsession,${secretId},T1,,talk,p1\n`, /^row 3: the Schedule is public, but it has no time or room/],
    ['a Session that ends before it starts', `type,id,title,name,format,speakers,start,end,room\nspeaker,p1,,A\n\nsession,${secretId},T1,,talk,p1,2027-04-23 10:00,2027-04-23 09:00,Hall\n`, /^row 4: it ends before it starts/],
    ['a break that ends before it starts', `type,id,title,name,format,speakers,start,end,room\nspeaker,p1,,A\nsession,s1,T1,,talk,p1,2027-04-23 10:00,2027-04-23 11:00,Hall\nbreak,,Lunch,,,,2027-04-23 13:00,2027-04-23 12:00,\n`, /^row 4: it needs a title and a start before its end/],
  ]) await rejects(() => publicProgram(adaptCsv(text), { schedulePublic: true }), (m) => pattern.test(m) && !m.includes(secretId), `the allowlist on a CSV with ${what}`);

  // 3. The rules. A Proxy proves which variables a choice reads.
  const watched = (env) => {
    const read = new Set();
    return { read, env: new Proxy(env, { get: (t, k) => { read.add(k); return t[k]; } }) };
  };
  for (const context of [undefined, 'deploy-preview', 'branch-deploy', 'dev']) {
    for (const gates of [both, speakersOnly]) {
      const w = watched({ ...testEnv, CONTEXT: context, PROGRAM_CSV_URL: prodCsv.PROGRAM_CSV_URL });
      expect(chooseSource(gates, w.env).kind === 'test', `CONTEXT=${context} with a gate open does not use the test data`);
      expect(!w.read.has('PROGRAM_CSV_URL') && !w.read.has('KCD_PROGRAM_TEST_BASE'), `CONTEXT=${context} reads the platform's variables`);
    }
  }
  // Cloudflare Pages (ADR 0012): production only when Pages builds `main`; Pages sets CF_PAGES and the branch itself,
  // and on Pages, CONTEXT counts for nothing.
  for (const [pages, want] of [
    [{ CF_PAGES: '1', CF_PAGES_BRANCH: 'main' }, 'pretalx'],
    [{ CF_PAGES: '1', CF_PAGES_BRANCH: 'cloudflare' }, 'test'],
    [{ CF_PAGES: '1', CF_PAGES_BRANCH: 'main-copy' }, 'test'],
    [{ CF_PAGES: '1', CF_PAGES_BRANCH: 'feature', CONTEXT: 'production' }, 'test'],
    [{ CF_PAGES: '1', CONTEXT: 'production' }, 'test'],
    [{ CF_PAGES: 'true', CF_PAGES_BRANCH: 'main' }, 'test'],
  ]) {
    for (const gates of [both, speakersOnly]) {
      const w = watched({ ...pages });
      const kind = chooseSource(gates, w.env).kind;
      expect(kind === want, `Pages ${JSON.stringify(pages)} with a gate open reads ${kind}, not ${want}`);
      if (want === 'test') expect(!w.read.has('PROGRAM_CSV_URL'), `Pages ${JSON.stringify(pages)} reads PROGRAM_CSV_URL`);
    }
  }
  for (const env of [{}, { CONTEXT: 'deploy-preview' }, { NETLIFY: 'true', CONTEXT: 'deploy-preview' }, { CF_PAGES: '1', CF_PAGES_BRANCH: 'x' }]) {
    expect(!isProductionBuild(env) && buildKind(env) === (Object.keys(env).length ? 'preview' : 'local'), `${JSON.stringify(env)} counts as a production build, or as the wrong kind`);
  }
  for (const env of [{ CONTEXT: 'production' }, { NETLIFY: 'true', CONTEXT: 'production' }, { CF_PAGES: '1', CF_PAGES_BRANCH: 'main' }]) {
    expect(isProductionBuild(env) && buildKind(env) === 'production', `${JSON.stringify(env)} doesn't count as a production build`);
  }
  for (const context of [undefined, 'production']) {
    const w = watched({ CONTEXT: context, PROGRAM_CSV_URL: prodCsv.PROGRAM_CSV_URL });
    expect(chooseSource(closed, w.env).kind === 'none' && !w.read.has('PROGRAM_CSV_URL'), `closed gates read a source (CONTEXT=${context})`);
  }
  expect(chooseSource(both, { CONTEXT: 'production' }).kind === 'pretalx' && chooseSource(speakersOnly, { CONTEXT: 'production' }).kind === 'pretalx', 'production with a gate open does not read Pretalx');
  expect(chooseSource(speakersOnly, { CONTEXT: 'production', PROGRAM_CSV_URL: 'https://example.com/p.csv' }).kind === 'csv', 'production with the CSV address does not read the CSV instead of Pretalx');
  // GitHub passes a secret that isn't set as an empty string.
  expect(chooseSource(both, { CONTEXT: 'production', PROGRAM_CSV_URL: '' }).kind === 'pretalx', 'an empty PROGRAM_CSV_URL counts as set');
  await rejects(() => chooseSource(both, { CONTEXT: 'production', NETLIFY: 'true', PROGRAM_CSV_URL: `http://127.0.0.1/${CSV_SECRET}` }), (m) => /must be an https address/.test(m) && !m.includes(CSV_SECRET), 'a plain-http CSV address on Netlify');

  // The test addresses: this machine only, and never on Cloudflare Pages, Netlify or in GitHub Actions.
  expect(pretalxBase({}) === 'https://pretalx.com/api' && pretalxBase(testEnv) === `${origin}/api`, 'the Pretalx base is wrong');
  for (const extra of [{ CF_PAGES: '1' }, { NETLIFY: 'true' }, { GITHUB_ACTIONS: 'true' }]) {
    await rejects(() => pretalxBase({ ...testEnv, ...extra }), (m) => /refused on Cloudflare Pages, Netlify and in GitHub Actions/.test(m), `KCD_PROGRAM_TEST_BASE with ${Object.keys(extra)[0]}`);
    expect(!fetchable(`${origin}/photos/a.jpg`, extra), `a plain-http photo is allowed with ${Object.keys(extra)[0]}`);
  }
  await rejects(() => pretalxBase({ KCD_PROGRAM_TEST_BASE: 'https://evil.example/api' }), (m) => /a server on this machine/.test(m), 'a remote KCD_PROGRAM_TEST_BASE');
  expect(fetchable('https://cdn.example/a.jpg', { NETLIFY: 'true' }) && !fetchable('http://cdn.example/a.jpg', {}) && !fetchable('https://u:p@cdn.example/a.jpg', {}), 'fetchable is wrong');

  // Reading the platform: the local Pretalx, every list in one request each, with the site's User-Agent.
  state.requests.length = 0;
  state.agents.length = 0;
  const live = await readPlatform(chooseSource(both, prodPretalx), prodPretalx);
  const asked = ['', 'questions/?expand=options&page_size=50', 'submission-types/?page_size=50', 'rooms/?page_size=50', 'submissions/?expand=answers&page_size=50', 'speakers/?expand=answers&page_size=50', 'slots/?page_size=50'].map((p) => `${EVENT}${p}`);
  expect(apiRequests().join(' ') === asked.join(' ') && live.sessions.length === 5, `readPlatform asks for ${apiRequests().join(' ')}`);
  expect(/kcdtexas\.org/.test(userAgent) && !/@/.test(userAgent) && state.agents.length === 7 && state.agents.every((a) => a === userAgent), `a request doesn't name the site in its User-Agent, or names an email address: ${[...new Set(state.agents)].join(' | ')}`);
  const viaServer = publicModel(live, both, prodPretalx);
  expect(viaServer.model.speakers.find((s) => s.name.endsWith(' A'))?.photo === `${origin}/photos/FXSPKA_fixture.webp`, 'a local test photo is dropped');
  expect(live.speakers.find((s) => s.name.endsWith(' D'))?.photo === null, 'readPlatform keeps a photo on another host');
  // Page by page: a server that sends 2 entries a page gives the same program.
  state.pageMax = 2;
  state.requests.length = 0;
  const paged = await readPlatform(chooseSource(both, prodPretalx), prodPretalx);
  state.pageMax = 50;
  const pages = (name) => apiRequests().filter((u) => u.startsWith(`${EVENT}${name}/`)).length;
  expect(JSON.stringify(paged) === JSON.stringify(live) && pages('submissions') === 4 && pages('slots') === 6 && pages('questions') === 5 && apiRequests().includes(`${EVENT}submissions/?expand=answers&page_size=50&page=4`), `reading 2 entries a page gives another program, or the wrong pages (${pages('submissions')} of submissions)`);
  const viaCsv = await readPlatform(chooseSource(both, prodCsv), prodCsv);
  expect(viaCsv.sessions.length === 3, 'readPlatform does not read the CSV');
  // Failures: redacted, and each says what failed.
  const noServer = { ...prodPretalx, KCD_PROGRAM_TEST_BASE: 'http://127.0.0.1:9/api' };
  for (const [mode, env, pattern, pageMax = 50] of [
    ['500', prodPretalx, /Pretalx \(the event kcd-texas-2027\): the server answered HTTP 500/],
    ['notjson', prodPretalx, /Pretalx \(the event kcd-texas-2027\): the response is not JSON/],
    ['noevent', prodPretalx, /Pretalx \(the event kcd-texas-2027\): the server answered HTTP 404: there is no public event kcd-texas-2027 \(pretalx\.event in src\/lib\/program-source\/config\.mjs\)/],
    ['unreleased', prodPretalx, /Pretalx \(rooms, page 1\): the server answered HTTP 401: Pretalx publishes the Sessions, the Speakers and the rooms only once a schedule is released and public/],
    ['nolist', prodPretalx, /Pretalx \(questions, page 1\): the response is not a list/],
    ['nexthost', prodPretalx, /Pretalx \(questions, page 1\): the next page is on another host/, 2],
    ['nextloop', prodPretalx, /Pretalx \(questions, page 1\): the next page is one already read/, 2],
    ['count', prodPretalx, /Pretalx \(questions\): it counted 10 entries but sent 9, so the list changed while it was read/],
    ['ok', noServer, /Pretalx \(the event kcd-texas-2027\): the request failed/],
    ['500', prodCsv, /HTTP 500/],
  ]) {
    state.mode = mode;
    state.pageMax = pageMax;
    await rejects(() => readPlatform(chooseSource(both, env), env), (m) => pattern.test(m) && !m.includes(CSV_SECRET) && !m.includes('127.0.0.1') && /could not be read/.test(m), `a ${mode} platform (${env.PROGRAM_CSV_URL ? 'CSV' : 'Pretalx'})`);
  }
  state.mode = 'ok';
  state.pageMax = 50;
  expect(!redact(`x ${prodCsv.PROGRAM_CSV_URL} and ${encodeURIComponent(prodCsv.PROGRAM_CSV_URL)} y`, prodCsv).includes(CSV_SECRET), 'redact keeps the CSV address');

  // The photos: square WebP in two sizes, from our server only.
  const pic = await downloadPhoto(`${origin}/photos/a.jpg`, 'Speaker 1', {});
  const [small, large] = await Promise.all([sharp(pic.small).metadata(), sharp(pic.large).metadata()]);
  expect(small.format === 'webp' && small.width === 160 && small.height === 160 && large.width === 400 && large.height === 400, `the photo sizes are ${small.width}x${small.height} and ${large.width}x${large.height}`);
  expect(!small.exif && !large.exif, 'a photo keeps its metadata');
  const fromPretalx = await downloadPhoto(`${origin}/photos/FXSPKA_fixture.webp`, 'Speaker 7', {});
  expect((await sharp(fromPretalx.large).metadata()).width === 400, 'a WebP photo, as Pretalx serves them, is not read');
  await rejects(() => downloadPhoto(`${origin}/photos/missing.png`, 'Speaker 2', {}), (m) => /Speaker 2's photo: the server answered HTTP 404/.test(m), 'a missing photo');
  await rejects(() => downloadPhoto(`${origin}/photos/text.jpg`, 'Speaker 3', {}), (m) => /not an image/.test(m), 'a photo that is HTML');
  await rejects(() => downloadPhoto(`${origin}/photos/broken.jpg`, 'Speaker 4', {}), (m) => /could not be read/.test(m), 'a broken photo');
  await rejects(() => downloadPhoto(`${origin}/photos/a.jpg`, 'Speaker 5', { NETLIFY: 'true' }), (m) => /must be https/.test(m), 'a plain-http photo on Netlify');
  // Every download stops at its cap as it streams: a response with no Content-Length is never read past it.
  const started = Date.now();
  await rejects(() => fetchBytes(`${origin}/endless`, { env: {}, what: 'An endless download', maxBytes: 1_000_000 }), (m) => m === 'An endless download: the response is larger than 1000000 bytes', 'a response with no Content-Length that never ends');
  await rejects(() => downloadPhoto(`${origin}/endless`, 'Speaker 6', {}), (m) => /Speaker 6's photo: the response is larger than \d+ bytes/.test(m), 'an endless photo');
  for (let i = 0; i < 50 && !state.endlessClosed; i += 1) await new Promise((r) => setTimeout(r, 20));
  expect(state.endlessClosed && Date.now() - started < 15_000, `an endless response is still read after the cap (${Date.now() - started} ms, closed ${state.endlessClosed})`);

  // 4. scripts/program-check.mjs.
  const out = join(outDir, 'output');
  const check = (env) => { writeFileSync(out, ''); return run(process.execPath, ['scripts/program-check.mjs'], { ...env, GITHUB_OUTPUT: out }); };
  const checkEnv = { ...testEnv, KCD_PROGRAM_LIVE_URL: `${origin}/live/program-version.txt` };
  let res = await run(process.execPath, ['scripts/program-check.mjs', '--gates'], {});
  expect(res.status === 0 && res.out === 'closed\n', `--gates with the gates closed prints ${JSON.stringify(res.out)}`);
  for (const [gates, want] of [[closed, 'closed'], [speakersOnly, 'speakers'], [both, 'schedule']]) {
    res = await withGates(gates, () => run(process.execPath, ['scripts/program-check.mjs', '--which-gates'], {}));
    expect(res.status === 0 && res.out === `${want}\n`, `--which-gates prints ${JSON.stringify(res.out)}, not "${want}"`);
  }
  state.requests.length = 0;
  res = await check(checkEnv);
  expect(res.status === 0 && res.out === 'unchanged\n' && readFileSync(out, 'utf8') === 'changed=false\n' && state.requests.length === 0, `closed gates: ${JSON.stringify(res.out)}, ${state.requests.length} requests`);
  await withGates(both, async () => {
    res = await run(process.execPath, ['scripts/program-check.mjs', '--gates'], {});
    expect(res.out === 'open\n', `--gates with a gate open prints ${JSON.stringify(res.out)}`);
    // Only changed= goes to GITHUB_OUTPUT, and the program version goes nowhere: not to the log, not to the output.
    state.live = null;
    res = await check(checkEnv);
    expect(res.status === 0 && res.out === 'changed\n' && readFileSync(out, 'utf8') === 'changed=true\n', `no live file: ${JSON.stringify(res.out)} ${res.err}, output ${JSON.stringify(readFileSync(out, 'utf8'))}`);
    expect(!res.log.includes(viaServer.version), 'program-check prints the program version');
    state.live = `${viaServer.version}\n`;
    res = await check(checkEnv);
    expect(res.status === 0 && res.out === 'unchanged\n' && readFileSync(out, 'utf8') === 'changed=false\n', `the same program: ${JSON.stringify(res.out)} ${res.err}`);
    expect(!res.log.includes(viaServer.version), 'program-check prints the program version');
    state.pretalx = fixtureText.replaceAll(marker, 'another-dropped-value');
    res = await check(checkEnv);
    expect(res.out === 'unchanged\n', 'a dropped field counts as a change');
    state.pretalx = fixtureText.replace('Opening the Made-Up Day', 'Opening the Made-Up Day, Updated');
    res = await check(checkEnv);
    expect(res.out === 'changed\n', 'a new title does not count as a change');
    // A new release that moves a Session to another room.
    state.pretalx = fixtureText.replace('"id": 6005, "room": 102', '"id": 6005, "room": 101');
    res = await check(checkEnv);
    expect(state.pretalx !== fixtureText && res.out === 'changed\n', 'a Session in another room does not count as a change');
    // An empty program fails the check: never "changed", so it can't start a deploy.
    state.pretalx = JSON.stringify(onlyBreaks);
    res = await check(checkEnv);
    expect(res.status === 1 && res.out === '' && readFileSync(out, 'utf8') === '' && /the program has no Sessions/.test(res.err), `program-check with an empty program: exit ${res.status}, stdout ${JSON.stringify(res.out)}, stderr ${res.err.trim()}`);
    state.pretalx = fixtureText;
    // With PROGRAM_CSV_URL set, the check reads the CSV and not Pretalx.
    state.requests.length = 0;
    res = await check({ ...checkEnv, PROGRAM_CSV_URL: prodCsv.PROGRAM_CSV_URL });
    expect(res.status === 0 && res.out === 'changed\n' && !apiRequests().length, `the CSV check: ${JSON.stringify(res.out)} ${res.err}, ${apiRequests().length} requests to Pretalx`);
    // The check's log is public: a bad CSV row is named by its row number, never by an id.
    state.csv = `${csvText}session,${secretId},Fixture Talk: One More,,Talk,no,ghost-${secretId}\n`;
    res = await check({ ...checkEnv, PROGRAM_CSV_URL: prodCsv.PROGRAM_CSV_URL });
    expect(res.status === 1 && res.out === '' && /row 9, speakers: an id matches no speaker row/.test(res.err) && !res.err.includes(secretId) && !res.err.includes(CSV_SECRET), `program-check with a bad CSV row: exit ${res.status}, stderr ${res.err.trim()}`);
    state.csv = csvText;
    for (const [mode, env, pattern] of [
      ['unreleased', checkEnv, /HTTP 401: Pretalx publishes the Sessions, the Speakers and the rooms only once a schedule is released and public/],
      ['500', checkEnv, /HTTP 500/],
      ['ok', { ...checkEnv, GITHUB_ACTIONS: 'true' }, /refused on Cloudflare Pages, Netlify and in GitHub Actions/],
    ]) {
      state.mode = mode;
      res = await check(env);
      expect(res.status === 1 && res.out === '' && readFileSync(out, 'utf8') === '' && pattern.test(res.err), `program-check with a ${mode} platform${env.GITHUB_ACTIONS ? ' in GitHub Actions' : ''}: exit ${res.status}, stdout ${JSON.stringify(res.out)}, stderr ${res.err.trim()}`);
    }
    state.mode = 'ok';
  });

  // 5. Full builds with a gate open.
  if (!process.argv.includes('--no-builds')) {
    const build = (env, flags = []) => run('bash', ['scripts/build.sh', '--skip-install', ...flags], env);
    const walk = (dir) => readdirSync(dir).flatMap((n) => { const p = join(dir, n); return statSync(p).isDirectory() ? walk(p) : [p]; });
    const served = () => walk('dist').filter((f) => /\.(?:html|xml|txt|ics|js|css|json|svg)$|(?:^|\/)_(?:redirects|headers)$/.test(f));
    await withGates(both, async () => {
      // Production, from the local Pretalx: the pages, the photos, the version, and nothing dropped.
      state.requests.length = 0;
      let b = await build(prodPretalx);
      expect(b.status === 0, `the production build from Pretalx fails:\n${b.log.slice(-2500)}`);
      if (b.status === 0) {
        expect(!b.log.includes(marker) && /reading the program from Pretalx/.test(b.log), 'the production build log contains the marker, or does not say it reads Pretalx');
        expect(!/Warning: \w+ is set in a/.test(b.log), 'the production build warns about the platform\'s variables');
        expect(apiRequests().length === 7 && state.requests.filter((u) => u.startsWith('/photos/')).length === 3, `the build made ${state.requests.join(', ')} requests, not 7 to Pretalx and three photos`);
        const speakers = readdirSync('dist/2027/speakers').filter((n) => statSync(join('dist/2027/speakers', n)).isDirectory()).sort();
        expect(speakers.join() === 'fixture-person-a,fixture-person-b,fixture-person-c,fixture-person-d', `Speaker pages: ${speakers.join()}`);
        expect(readdirSync('dist/2027/sessions').filter((n) => n.endsWith('.ics')).length === 5, 'not every confirmed Session has a calendar file');
        const photos = readdirSync('dist/2027/speakers').filter((n) => n.endsWith('.webp')).sort();
        expect(photos.join() === ['a', 'b', 'c'].flatMap((x) => [`fixture-person-${x}-large.webp`, `fixture-person-${x}-small.webp`]).join(), `photo files: ${photos.join()}`);
        const page = readFileSync('dist/2027/speakers/fixture-person-a/index.html', 'utf8');
        expect(/<img src="\/2027\/speakers\/fixture-person-a-large\.webp"/.test(page), 'the Speaker page does not load its photo from our domain');
        expect(page.includes('Platform Engineer, Fixture Company') && page.includes('https://github.com/fixture-person-a') && page.includes('https://fixture-a.example/'), 'the Speaker page lacks the job title or a link');
        expect(/<span>FD<\/span>|<span>FP<\/span>/.test(readFileSync('dist/2027/speakers/fixture-person-d/index.html', 'utf8')), 'a Speaker with no photo lacks the placeholder');
        expect((await sharp(readFileSync('dist/2027/speakers/fixture-person-a-small.webp')).metadata()).width === 160, 'the small photo is not 160 px');
        // check-dist refuses an image from another host, in a page or in a stylesheet.
        const css = walk('dist').find((f) => f.endsWith('.css'));
        const [pageBefore, cssBefore] = [page, readFileSync(css, 'utf8')];
        writeFileSync('dist/2027/speakers/fixture-person-a/index.html', page.replace('</body>', '<img src="https://pretalx.example/media/fx.jpg" alt=""></body>'));
        writeFileSync(css, `${cssBefore}\n.fx{background:url("https://pretalx.example/media/fx.png")}`);
        const guard = await run(process.execPath, ['scripts/check-dist.mjs'], {});
        expect(guard.status === 1 && /fixture-person-a\/index\.html: loads from another host: https:\/\/pretalx\.example\/media\/fx\.jpg/.test(guard.log) && /\.css: loads from another host: https:\/\/pretalx\.example\/media\/fx\.png/.test(guard.log), `check-dist passes an external image:\n${guard.log.slice(-800)}`);
        writeFileSync('dist/2027/speakers/fixture-person-a/index.html', pageBefore);
        writeFileSync(css, cssBefore);
        // The published program version is the one scripts/program-check.mjs computes from the platform.
        expect(readFileSync('dist/2027/program-version.txt', 'utf8') === `${viaServer.version}\n`, 'the published program version is not the platform\'s');
        expect(!/\bSample\b/.test(readFileSync('dist/2027/schedule/index.html', 'utf8')), 'the production Schedule says "Sample"');
        for (const f of served()) {
          const body = readFileSync(f, 'utf8');
          expect(!body.includes(marker) && !body.includes(origin) && !body.includes('127.0.0.1:') && !body.includes('/media/avatars/') && !body.includes('gravatar') && !body.includes('photos.fixture.invalid'), `${f}: contains the marker or a platform address`);
        }
        const schedule = readFileSync('dist/2027/schedule/index.html', 'utf8');
        expect(/Fixture Sponsor Callout/.test(schedule) && /Fixture Talk: Everyone on Stage/.test(schedule) && !/Rejected|Not Confirmed/.test(schedule), 'the Schedule lacks a break or a Session, or shows one that isn\'t confirmed');
        expect(/<li class="sch-item" data-id="FXEUS2"[^>]*data-eu="1"/.test(schedule) && /<li class="sch-item" data-id="FXKEY1"[^>]*data-eu="0"/.test(schedule), 'the Schedule does not mark the End-User Story, or marks another Session');
        expect(readFileSync('dist/2027/sessions/fixture-keynote-opening-the-made-up-day/index.html', 'utf8').includes('A made-up keynote abstract for the adapter tests.\n\nA made-up second paragraph,\nfrom the description field.'), 'the Session page does not show the abstract and the description');
      }

      // Production, from the CSV: with PROGRAM_CSV_URL set, nothing from Pretalx.
      state.requests.length = 0;
      b = await build(prodCsv);
      expect(b.status === 0 && existsSync('dist/2027/speakers/fixture-person-c/index.html') && !b.log.includes(CSV_SECRET) && /reading the program CSV/.test(b.log) && !apiRequests().length, `the production build from the CSV fails, prints its address or reads Pretalx:\n${b.log.slice(-1500)}`);

      // More Share Cards than a build draws: 151 Sessions by one Speaker, read in four pages. The build draws the
      // first 150, Sessions first, and the 151st Session and the Speaker keep the title card.
      const budget = Number(readFileSync('src/lib/cards/program-cards.ts', 'utf8').match(/PROGRAM_CARD_BUDGET = (\d+)/)[1]);
      const many = fixture();
      const talk = many.submissions.find((s) => s.code === 'FXEUS2');
      const at = (minutes) => `2027-04-23T${String(8 + Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}:00-05:00`;
      many.submissions = Array.from({ length: budget + 1 }, (_, i) => ({ ...talk, code: `FXLOAD${i}`, title: `Fixture Load Session ${i + 1}`, speakers: ['FXSPKA'], slots: [7000 + i] }));
      many.slots = many.submissions.map((s, i) => ({ id: 7000 + i, room: 101, start: at(i * 3), end: at(i * 3 + 30), submission: s.code, schedule: 5001, description: null, duration: 30 }));
      state.pretalx = JSON.stringify(many);
      state.requests.length = 0;
      b = await build(prodPretalx);
      state.pretalx = fixtureText;
      expect(b.status === 0 && apiRequests().filter((u) => u.startsWith(`${EVENT}submissions/`)).length === Math.ceil((budget + 1) / 50), `the production build with ${budget + 1} Sessions fails, or doesn't read them page by page:\n${b.log.slice(-1500)}`);
      if (b.status === 0) {
        const drawn = readdirSync('dist/cards').filter((n) => /^(?:session|speaker)-/.test(n));
        const cardOf = (page) => readFileSync(`dist/2027/${page}/index.html`, 'utf8').match(/<meta property="og:image" content="[^"]*\/cards\/([a-z0-9-]+)\.png"/)?.[1];
        expect(drawn.length === budget && drawn.every((n) => n.startsWith('session-')), `${budget + 1} Sessions and a Speaker drew ${drawn.length} cards (${drawn.filter((n) => n.startsWith('speaker-')).length} Speakers'), not the first ${budget}`);
        expect(cardOf('sessions/fixture-load-session-1') === 'session-fixture-load-session-1' && cardOf(`sessions/fixture-load-session-${budget + 1}`) === 'default' && cardOf('speakers/fixture-person-a') === 'default',
          `past the budget a page does not keep the title card: ${cardOf(`sessions/fixture-load-session-${budget + 1}`)}, ${cardOf('speakers/fixture-person-a')}`);
        expect(!/Download the Share Card/.test(readFileSync('dist/2027/speakers/fixture-person-a/index.html', 'utf8')), 'a Speaker past the budget offers a Share Card to download');
      }

      // The Speakers' and the Organizers' own words may hold what check-dist's draft-marker checks look for: an
      // abstract, a bio, a tagline, a title and a room that say "Sample", "TODO", "[TBD", "${HOME}" and "{name}", or
      // give an image's address as text. A production build passes with them (data-ugc marks them for check-dist).
      const said = 'Sample code for every demo, a TODO list, [TBD], ${HOME}, {name} and https://example.com/slides/diagram.png';
      const words = fixture();
      words.submissions[0].abstract = `${said}.`;
      words.submissions[0].description = null;
      words.submissions[1].title = 'Sample Apps and a TODO List [TBD] for {name}';
      words.speakers[0].biography = `Slides with the diagram: https://example.com/slides/diagram.png. ${said}.`;
      words.speakers[1].answers[0].answer = 'Sample TODO [TBD] ${HOME} {name}';
      words.rooms[1].name = { en: 'TODO Room [TBD] {name}' };
      state.pretalx = JSON.stringify(words);
      b = await build(prodPretalx);
      expect(b.status === 0, `the production build fails on the Speakers' and Organizers' own words:\n${b.log.slice(-2500)}`);
      if (b.status === 0) {
        const page = (path) => readFileSync(`dist/2027/${path}/index.html`, 'utf8');
        expect(page('sessions/fixture-keynote-opening-the-made-up-day').includes(`<p class="ses-abstract" data-ugc>${said}.</p>`)
          && page('speakers/fixture-person-a').includes('<p data-ugc>Slides with the diagram: https://example.com/slides/diagram.png.')
          && page('speakers/fixture-person-b').includes('Sample TODO [TBD] ${HOME} {name}')
          && /Sample Apps and a TODO List \[TBD\] for \{name\}/.test(page('schedule')) && /TODO Room \[TBD\] \{name\}/.test(page('schedule')),
        'the production build does not show the Speakers\' and Organizers\' own words as they wrote them');
      }
      // On Event Day, with an announcement in the same words. scripts/build.sh refuses --now and --clock in production,
      // so this runs its build steps itself, with the day and the time those flags would set.
      writeFileSync(ANNOUNCEMENTS, `${announcementsText}- at: "${EVENT_DAY} 09:00"\n  text: "${said}."\n`);
      let steps = '';
      let stepsOk = true;
      for (const [cmd, args, env] of [
        ['npx', ['astro', 'build'], { ...prodPretalx, KCD_BUILD_DAY: EVENT_DAY, KCD_BUILD_CLOCK: '12:00', ASTRO_TELEMETRY_DISABLED: '1' }],
        [process.execPath, ['scripts/write-host-files.mjs'], {}],
        [process.execPath, ['scripts/check-dist.mjs'], { CONTEXT: 'production', KCD_BUILD_DAY: EVENT_DAY }],
      ]) {
        const r = await run(cmd, args, env);
        steps += r.log;
        if (r.status !== 0) { stepsOk = false; break; }
      }
      writeFileSync(ANNOUNCEMENTS, announcementsText);
      state.pretalx = fixtureText;
      expect(stepsOk && readFileSync('dist/2027/today/index.html', 'utf8').includes(`<li><time datetime="${EVENT_DAY}T09:00">9:00 a.m.</time> <span data-ugc>${said}.</span></li>`),
        `production on Event Day fails on the Speakers' and Organizers' own words, or lacks the announcement:\n${steps.slice(-2500)}`);

      // A deploy preview, a branch deploy and a Cloudflare Pages preview with the gates open, the test base and the
      // CSV address set to this server: the test data, labeled "Sample" and marked as a test build, and no request.
      for (const [context, hostEnv] of [['deploy-preview', { CONTEXT: 'deploy-preview' }], ['branch-deploy', { CONTEXT: 'branch-deploy' }],
        ['Pages preview', { CF_PAGES: '1', CF_PAGES_BRANCH: 'cloudflare' }]]) {
        state.requests.length = 0;
        b = await build({ ...prodCsv, ...hostEnv });
        expect(b.status === 0 && state.requests.length === 0, `the ${context} build fails or reads the platform (${state.requests.length} requests):\n${b.log.slice(-1500)}`);
        expect(b.status === 0 && /using the test program/.test(b.log) && /\bSample\b/.test(readFileSync('dist/2027/schedule/index.html', 'utf8')) && !existsSync('dist/2027/speakers/fixture-person-a')
          && /KCD_PROGRAM_SAMPLE/.test(readFileSync('dist/.test-build', 'utf8')), `the ${context} build does not use the labeled test data`);
        // It warns that the CSV address is set where it shouldn't be, naming the variable, never its value.
        expect(b.log.includes('Warning: PROGRAM_CSV_URL is set in a preview build. Set it for production only') && !b.log.includes(CSV_SECRET), `the ${context} build doesn't warn about PROGRAM_CSV_URL, or prints its value:\n${b.log.slice(0, 1500)}`);
      }

      // Production before Pretalx releases a schedule, and with a failing platform: the build fails, and says why.
      state.mode = 'unreleased';
      b = await build(prodPretalx);
      expect(b.status !== 0 && /HTTP 401: Pretalx publishes the Sessions, the Speakers and the rooms only once a schedule is released and public/.test(b.log), `production before a schedule release doesn't fail clearly:\n${b.log.slice(-1500)}`);
      state.mode = '500';
      b = await build(prodPretalx);
      expect(b.status !== 0 && /HTTP 500/.test(b.log), `production with a failing platform doesn't fail:\n${b.log.slice(-1500)}`);
      state.mode = 'ok';
      // Production with an empty program, only breaks: the build fails and says why.
      state.pretalx = JSON.stringify(onlyBreaks);
      b = await build(prodPretalx);
      expect(b.status !== 0 && /the program has no Sessions/.test(b.log), `production with an empty program doesn't fail clearly:\n${b.log.slice(-1500)}`);
      state.pretalx = fixtureText;
    });
    await withGates(speakersOnly, async () => {
      // Production with only the Speakers' gate open: Pretalx still needs a released schedule, and the site still shows
      // no time, room, calendar file or Event Day page, and a Session given twice once.
      state.pretalx = JSON.stringify(broken((d) => { d.slots.push({ id: 6012, room: 102, start: '2027-04-23T15:00:00-05:00', end: '2027-04-23T15:50:00-05:00', submission: 'FXWRK4', schedule: 5001, description: null, duration: 50 }); }));
      state.requests.length = 0;
      let b = await build(prodPretalx);
      state.pretalx = fixtureText;
      expect(b.status === 0 && apiRequests().length === 7 && existsSync('dist/2027/speakers/fixture-person-a/index.html') && existsSync('dist/2027/speakers/fixture-person-a-large.webp')
        && !existsSync('dist/2027/today') && !existsSync('dist/2027/schedule.ics') && !/data-schedule/.test(readFileSync('dist/2027/schedule/index.html', 'utf8'))
        && !readdirSync('dist/2027/sessions').some((n) => n.endsWith('.ics')) && readdirSync('dist/2027/sessions').filter((n) => n.startsWith('fixture-workshop')).length === 1,
      `production from Pretalx with only speakersPublic open shows a time, a room or a Session twice, or fails:\n${b.log.slice(-1500)}`);
      if (b.status === 0) {
        for (const f of walk('dist/2027').filter((p) => /[\\/](?:speakers|sessions)[\\/].*\.html$/.test(p))) {
          const body = readFileSync(f, 'utf8');
          expect(!/data-start="\d|class="(?:sch-time|sch-room|page-facts)"/.test(body) && !body.includes('Fixture Room B'), `${f}: shows a time or a room with only speakersPublic open`);
        }
      }
      // A deploy preview with only the Speakers' gate open: the speakers-only test data, with no times or rooms, and
      // no request to the platform.
      state.requests.length = 0;
      b = await build({ ...prodCsv, CONTEXT: 'deploy-preview' });
      expect(state.requests.length === 0, `the speakers-only deploy preview reads the platform (${state.requests.length} requests)`);
      expect(b.status === 0 && /using the test program/.test(b.log) && existsSync('dist/2027/speakers/index.html') && existsSync('dist/2027/sessions')
        && !existsSync('dist/2027/today') && !existsSync('dist/2027/schedule.ics') && !/data-schedule/.test(readFileSync('dist/2027/schedule/index.html', 'utf8')),
      `the deploy preview with only speakersPublic open does not use the speakers-only test data:\n${b.log.slice(-1500)}`);
    });

    // The privacy page's lines while the program pages exist (test builds on the test data): where My Schedule is
    // kept, and the offline copy, through Event Day and from the day after, when the offline worker deletes it.
    await withGates(both, async () => {
      for (const [day, offline, gone] of [
        ['2027-04-23', 'When you open a program page, such as a Session or a Speaker’s page, your browser keeps a copy so it opens without a connection. The copy stays in your browser. After Event Day, your browser deletes it the next time you open a 2027 page.', 'Until Event Day'],
        ['2027-04-24', 'Until Event Day, your browser kept a copy of the program pages you opened. It deletes the copy the next time you open a 2027 page.', 'without a connection'],
      ]) {
        const b = await build({}, ['--now', day]);
        const privacy = b.status === 0 ? readFileSync('dist/privacy/index.html', 'utf8') : '';
        expect(privacy.includes('If you star a Session, your browser keeps My Schedule in its local storage, on this device only. It isn’t sent to us.') && privacy.includes(offline) && !privacy.includes(gone),
          `on ${day}, the privacy page lacks the My Schedule line or the right offline line${b.status === 0 ? '' : `:\n${b.log.slice(-1500)}`}`);
      }
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
