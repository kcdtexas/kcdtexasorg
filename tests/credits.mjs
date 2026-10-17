// The loyalty credits' rules (src/lib/credits.ts) on made-up histories: a credit's first year and count come from
// the records, the count prints as "3rd year" (a gap in the years counts true), one Edition alone gets nothing, a missing or incomplete record hides that kind's credits, a name on an earlier
// incomplete record holds that person's credit back, a sponsor needs a Sponsorship in the current Edition, a test
// build's Organizer credits read the test history alone, and a history file with a bad shape fails with its file
// name.
// tests/run-local.mjs runs it; tests/run-program.mjs checks the same rules in real builds.
// Usage: node --experimental-strip-types tests/credits.mjs (Node 22.12 needs the flag to read TypeScript)
import { existsSync, readFileSync } from 'node:fs';
import { creditFor, creditText, mergeHistory, ordinal, recordsFor, validateHistory } from '../src/lib/credits.ts';

const failures = [];
let checks = 0;
const expect = (ok, message) => { checks += 1; if (!ok) failures.push(message); };
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

const source = 'https://example.com/';
const people = (names, complete = true) => ({ names, complete, source });
const ids = (list, complete = true) => ({ ids: list, complete, source });
const editions = [2024, 2025, 2026, 2027];
const rule = (from) => ({ editions, current: 2027, from });

const full = [
  { year: 2024, organizers: people(['Ann Example']), speakers: people(['Bo Example']), sponsors: ids(['acme']) },
  { year: 2025, organizers: people(['Ann Example', 'Cy Example']), speakers: people(['Cy Example']), sponsors: ids(['acme', 'bolt']) },
  { year: 2026, organizers: people(['Cy Example', 'Di Example']), speakers: people(['Bo Example']), sponsors: ids(['bolt']) },
  { year: 2027, organizers: people(['Ann Example', 'Cy Example', 'Di Example', 'Ed Example']), sponsors: ids(['acme', 'bolt', 'cog']) },
];

// The year and the count come from the records.
expect(same(creditFor(full, 'organizers', ['Ann Example'], rule(2024)), { since: 2024, editions: 3 }), 'Ann: expected since 2024, 3 Editions');
expect(same(creditFor(full, 'organizers', ['Cy Example'], rule(2024)), { since: 2025, editions: 3 }), 'Cy: expected since 2025, 3 Editions');
expect(same(creditFor(full, 'organizers', ['Di Example'], rule(2024)), { since: 2026, editions: 2 }), 'Di: expected since 2026');
expect(same(creditFor(full, 'speakers', ['Bo Example'], rule(2024)), { since: 2024, editions: 3 }), 'Bo: expected Speaker since 2024');
expect(same(creditFor(full, 'sponsors', ['acme'], rule(2024)), { since: 2024, editions: 3 }), 'acme: expected since 2024');
// The words: the count as English orders it, "3rd year".
for (const [n, want] of [[2, '2nd'], [3, '3rd'], [4, '4th'], [10, '10th'], [11, '11th'], [12, '12th'], [13, '13th'], [21, '21st'], [22, '22nd'], [23, '23rd'], [101, '101st'], [111, '111th'], [112, '112th']]) {
  expect(ordinal(n) === want, `ordinal(${n}) is ${ordinal(n)}, not ${want}`);
}
expect(creditText(creditFor(full, 'organizers', ['Ann Example'], rule(2024))) === '3rd year', 'Ann: the credit does not print "3rd year"');
expect(creditText(creditFor(full, 'organizers', ['Di Example'], rule(2024))) === '2nd year', 'Di: the credit does not print "2nd year"');
// Names match ignoring case, accents and apostrophes, and through a confirmed variant.
expect(creditFor(full, 'organizers', ['ann  EXAMPLE'], rule(2024))?.since === 2024, 'a name in another case does not match');
expect(creditFor(full, 'organizers', ['Ann Newname', 'Ann Example'], rule(2024))?.since === 2024, 'a confirmed variant does not match');

// One Edition alone shows nothing.
expect(creditFor(full, 'organizers', ['Ed Example'], rule(2024)) === null, 'a first-time Organizer gets a credit');
expect(creditFor(full, 'sponsors', ['cog'], rule(2024)) === null, 'a first-time sponsor gets a credit');
expect(creditFor(full, 'speakers', ['New Speaker'], rule(2024)) === null, 'a first-time Speaker gets a credit');
expect(creditFor([full[3]], 'organizers', ['Ann Example'], rule(2027)) === null, 'the current Edition alone gives a credit');

// A missing record hides that kind, and only that kind.
const no2025Speakers = full.map((h) => (h.year === 2025 ? { ...h, speakers: undefined } : h));
expect(creditFor(no2025Speakers, 'speakers', ['Bo Example'], rule(2024)) === null, 'a missing 2025 Speakers record still prints Speaker credits');
expect(creditFor(no2025Speakers, 'organizers', ['Ann Example'], rule(2024))?.since === 2024, 'a missing Speakers record hides the Organizer credits');
const no2024 = full.filter((h) => h.year !== 2024);
expect(creditFor(no2024, 'organizers', ['Cy Example'], rule(2024)) === null, 'a missing 2024 file still prints credits that start at 2024');
// Where the history starts: from 2025, 2024 is not needed.
expect(creditFor(no2024, 'organizers', ['Cy Example'], rule(2025))?.since === 2025, 'history from 2025 still asks for 2024');

// A credit as of a past Edition counts that Edition and the ones before it: the first Edition gets none, a later
// Edition's records never change an earlier page, and a sponsor that skipped a year keeps its first year.
const asOf = (current) => ({ editions, current, from: 2024 });
expect(['Ann Example'].every((n) => creditFor(full, 'organizers', [n], asOf(2024)) === null) && creditFor(full, 'sponsors', ['acme'], asOf(2024)) === null, 'the first Edition gets a credit');
expect(same(creditFor(full, 'organizers', ['Ann Example'], asOf(2025)), { since: 2024, editions: 2 }), 'as of 2025: Ann is not "since 2024" over 2 Editions');
expect(creditFor(full, 'organizers', ['Cy Example'], asOf(2025)) === null, 'as of 2025: a first-time 2025 Organizer gets a credit');
expect(same(creditFor(full, 'organizers', ['Cy Example'], asOf(2026)), { since: 2025, editions: 2 }), 'as of 2026: Cy is not "since 2025"');
expect(creditFor(full, 'organizers', ['Di Example'], asOf(2026)) === null, 'as of 2026: a 2027 record gives a 2026 first-timer a credit');
expect(same(creditFor(full, 'speakers', ['Bo Example'], asOf(2026)), { since: 2024, editions: 2 }), 'as of 2026: a Speaker who skipped 2025 is not "since 2024"');
// A gap counts true: in 2024 and 2026 is a "2nd year", where "since 2024" would claim 2025 too.
expect(creditText(creditFor(full, 'speakers', ['Bo Example'], asOf(2026))) === '2nd year', 'as of 2026: a Speaker who skipped 2025 does not print "2nd year"');
expect(creditFor(full.map((h) => (h.year === 2026 ? { ...h, sponsors: ids(['acme']) } : h)), 'sponsors', ['acme'], asOf(2026))?.since === 2024, 'as of 2026: a sponsor that skipped 2025 is not "since 2024"');
expect(creditFor(full, 'organizers', ['Ann Example'], asOf(2026)) === null, 'as of 2026: someone not on the 2026 record gets a credit there');

// An incomplete record counts as missing.
const partial2026 = full.map((h) => (h.year === 2026 ? { ...h, sponsors: ids(['bolt'], false) } : h));
expect(creditFor(partial2026, 'sponsors', ['bolt'], rule(2024)) === null, 'an incomplete 2026 sponsors record still prints sponsor credits');
expect(creditFor(partial2026, 'organizers', ['Di Example'], rule(2024))?.since === 2026, 'an incomplete sponsors record hides another kind');

// A name on an earlier record proves that year, even on an incomplete record or one before the history starts. The
// credit counts from the first year that lists the person, and prints only when every record from then on is
// complete; otherwise the person's credit is held back, never printed with a later year.
const partial2024 = full.map((h) => (h.year === 2024 ? { ...h, organizers: people(['Ann Example'], false) } : h));
expect(creditFor(partial2024, 'organizers', ['Ann Example'], rule(2025)) === null, 'history from 2025: a name on an incomplete 2024 record gets a credit (it would say "since 2025")');
expect(creditFor(partial2024, 'organizers', ['Cy Example'], rule(2025))?.since === 2025, 'history from 2025: a name missing from an incomplete 2024 record loses its "since 2025"');
expect(same(creditFor(full, 'organizers', ['Ann Example'], rule(2025)), { since: 2024, editions: 3 }), 'history from 2025: a name on a complete 2024 record is not credited from 2024');
expect(creditFor([{ ...full[1], organizers: people(['Di Example'], false) }, full[2], full[3]], 'organizers', ['Di Example'], rule(2026)) === null, 'history from 2026: a name on an incomplete 2025 record gets "since 2026"');
expect(creditFor(full.map((h) => (h.year === 2025 ? { year: 2025 } : h)), 'organizers', ['Ann Example'], rule(2026)) === null, 'history from 2026: a name listed in 2024 gets a credit though 2025 has no record');
const partialSponsors2024 = full.map((h) => (h.year === 2024 ? { ...h, sponsors: ids(['acme'], false) } : h));
expect(creditFor(partialSponsors2024, 'sponsors', ['acme'], rule(2025)) === null && creditFor(partialSponsors2024, 'sponsors', ['bolt'], rule(2025))?.since === 2025, 'history from 2025: the sponsors on an incomplete 2024 record are not held back, or the others are');

// A sponsor needs a Sponsorship in the current Edition.
const no2027Sponsors = full.map((h) => (h.year === 2027 ? { ...h, sponsors: undefined } : h));
expect(creditFor(no2027Sponsors, 'sponsors', ['acme'], rule(2024)) === null, 'a sponsor with no 2027 Sponsorship gets a credit');
expect(creditFor(full, 'sponsors', ['zeta'], rule(2024)) === null, 'a sponsor not on the 2027 list gets a credit');

// Test records join an Edition's lists; the joined record is complete only if both are.
const merged = mergeHistory(full, [{ year: 2026, speakers: people(['Test Speaker']) }, { year: 2027, sponsors: ids(['test-1'], false) }]);
expect(creditFor(merged, 'speakers', ['Test Speaker'], rule(2024))?.since === 2026, 'a test record does not join its Edition');
expect(creditFor(merged, 'speakers', ['Bo Example'], rule(2024))?.since === 2024, 'a test record replaces the real one');
expect(merged.find((h) => h.year === 2027).sponsors.complete === false, 'a joined record with an incomplete part is complete');

// The records a test build reads. Its history starts in 2026, so with the real records joined, an Organizer of 2025
// and 2026 would show a wrong "since 2026". The Organizers' credits read the test history alone: no real Organizer
// gets one, and the made-up Organizer gets the one its history gives. The Speakers' and the sponsors' join the two.
const from2026 = full.filter((h) => h.year >= 2026);
const test = [
  { year: 2025, organizers: people(['Test Organizer']) },
  { year: 2026, organizers: people(['Test Organizer']), speakers: people(['Test Speaker']) },
  { year: 2027, organizers: people(['Test Organizer']) },
];
expect(recordsFor('organizers', from2026, null) === from2026 && recordsFor('speakers', from2026, null) === from2026, 'a normal build does not read the Editions\' records alone');
expect(creditFor(mergeHistory(from2026, test), 'organizers', ['Cy Example'], rule(2026))?.since === 2026, 'the joined records no longer show the wrong "since 2026" this rule prevents');
expect(creditFor(recordsFor('organizers', from2026, test), 'organizers', ['Cy Example'], rule(2026)) === null, 'a real Organizer gets a credit in a test build');
expect(same(creditFor(recordsFor('organizers', from2026, test), 'organizers', ['Test Organizer'], rule(2026)), { since: 2025, editions: 3 }), 'the made-up Organizer lacks "since 2025", 3 Editions');
expect(creditFor(recordsFor('speakers', from2026, test), 'speakers', ['Test Speaker'], rule(2026))?.since === 2026 && creditFor(recordsFor('speakers', from2026, test), 'speakers', ['Bo Example'], rule(2026))?.since === 2026, 'a test build\'s Speakers do not read the test and the real records joined');

// The file check: the right shape passes, and every bad shape names the file.
const good = { year: 2025, organizers: people(['Ann Example']), speakers: people(['Bo Example']), sponsors: ids(['acme']) };
expect(validateHistory('src/data/history/2025.ts', good, editions) === good, 'a good history file fails the check');
expect(validateHistory('src/data/history/2024.ts', { year: 2024, speakers: people(['Bo Example']) }, editions).year === 2024, 'a file with only some kinds fails the check');
const bad = [
  ['not an object', null],
  ['the year differs from the file name', { ...good, year: 2024 }],
  ['not an Edition', { ...good, year: 2023 }],
  ['an unknown kind', { ...good, volunteers: people([]) }],
  ['names not a list', { ...good, speakers: { names: 'Bo Example', complete: true, source } }],
  ['an empty name', { ...good, speakers: people(['']) }],
  ['sponsors by name', { ...good, sponsors: { names: ['Acme'], complete: true, source } }],
  ['a sponsor id with spaces', { ...good, sponsors: ids(['Acme Inc']) }],
  ['complete missing', { ...good, organizers: { names: ['Ann Example'], source } }],
  ['source an API address', { ...good, speakers: { ...people(['Bo Example']), source: 'https://sessionize.com/api/v2/abc/view/All' } }],
  ['source not https', { ...good, speakers: { ...people(['Bo Example']), source: 'http://example.com/' } }],
];
for (const [what, value] of bad) {
  const file = what === 'the year differs from the file name' || what === 'not an Edition' ? `src/data/history/${value?.year === 2023 ? 2023 : 2025}.ts` : 'src/data/history/2025.ts';
  let message = '';
  try { validateHistory(file, value, editions); } catch (e) { message = e.message; }
  expect(message.startsWith(`${file}: `), `a history file with ${what} passes the check, or fails without its name (${message || 'no error'})`);
}

// A normal build's About page: the 2027 Organizers' credits, exactly. Skipped when dist/ is missing or is a test
// build, which credits only the made-up Organizer (tests/run-program.mjs).
const about = new URL('../dist/about/index.html', import.meta.url);
if (existsSync(about) && !existsSync(new URL('../dist/.test-build', import.meta.url))) {
  // The words a screen reader hears: the tab, then its hidden role.
  const expected = {
    'Mars Toktonaliev': '4th year as an Organizer',
    'Rich Boyd': '3rd year as an Organizer', 'Harsha Thirimanna': '3rd year as an Organizer', 'Mara Ruvalcaba': '3rd year as an Organizer', 'Jamie Prince': '3rd year as an Organizer',
    'Cris Nevares': '2nd year as an Organizer', 'Joel Hernandez': '2nd year as an Organizer', 'Srihari Nagaram': '2nd year as an Organizer', 'Vishwa Gandhi': '2nd year as an Organizer',
    'Amy Marrich': null, 'Akshay Mittal': null, 'Myroslav Mishov': null,
  };
  const list = readFileSync(about, 'utf8').match(/<ul class="pg-org"[^>]*>([\s\S]*?)<\/ul>/)?.[1] ?? '';
  const shown = Object.fromEntries([...list.matchAll(/<li[^>]*>([\s\S]*?)<\/li>/g)].map(([, li]) => [
    li.match(/<b[^>]*>([^<]*)<\/b>/)?.[1], li.match(/<span class="credit">([^<]*)<span class="sr-only">([^<]*)<\/span><\/span>/)?.slice(1).join('') ?? null,
  ]));
  const sorted = (o) => Object.fromEntries(Object.entries(o).sort(([a], [b]) => a.localeCompare(b)));
  expect(same(sorted(shown), sorted(expected)), `About's Organizer credits differ from the table: ${JSON.stringify(shown)}`);
} else {
  console.log('Credit tests: no normal build in dist/, so About\'s credits were not checked.');
}

if (failures.length) {
  console.error(`Credit tests failed (${failures.length} of ${checks}):\n  ${failures.join('\n  ')}`);
  process.exit(1);
}
console.log(`Credit tests passed: ${checks} checks.`);
