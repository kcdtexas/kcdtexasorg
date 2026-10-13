// The Event Day announcements file's rules (src/lib/announcements.mjs) on made-up files: the text must be in double
// quotes, so a # can't cut it short and a colon can't break the file, and no comment may sit inside an entry. The
// example in src/data/announcements-2027.yaml and the one in docs/event-day.md must pass as written there. And the
// page prints the date of an announcement posted before the build's day, so it doesn't read as today's.
// tests/run-local.mjs runs it; tests/run-program.mjs checks the file in real builds.
// Usage: node tests/announcements.mjs
import { readFileSync } from 'node:fs';
import { importTs } from '../scripts/lib/import-ts.mjs';
import { ANNOUNCEMENTS_FILE, MAX_TEXT, parseAnnouncements, postedAt } from '../src/lib/announcements.mjs';

const failures = [];
let checks = 0;
const expect = (ok, message) => { checks += 1; if (!ok) failures.push(message); };
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

const { edition2027, shortDate } = await importTs(new URL('../src/data/edition-2027.ts', import.meta.url));
const DAY = '2027-04-23';
const file = (entries) => `# A header comment.\nannouncements:\n# The example comment.\n${entries}`;
const parse = (entries) => parseAnnouncements(file(entries), DAY);
/** The error message parsing these entries throws, or '' when they pass. */
const error = (entries) => { try { parse(entries); return ''; } catch (e) { return e.message; } };

// The real file, and its example with the "# " taken off each line.
const real = readFileSync(ANNOUNCEMENTS_FILE, 'utf8');
expect(Array.isArray(parseAnnouncements(real, edition2027.eventDay)), `${ANNOUNCEMENTS_FILE} doesn't pass`);
const example = real.split('\n').filter((l) => /^# (?:- |  )\w+:/.test(l)).map((l) => l.slice(2)).join('\n');
const fromFile = parseAnnouncements(`announcements:\n${example}\n`, edition2027.eventDay);
expect(fromFile.length === 1 && fromFile[0].text === 'The 10:30 Sessions start 10 minutes late.' && fromFile[0].link, `the file's example doesn't pass as one entry with a text and a link: ${JSON.stringify(fromFile)}`);
// The runbook's example, as an Organizer copies it.
const runbook = readFileSync('docs/event-day.md', 'utf8').match(/```yaml\n([\s\S]*?)\n\s*```/)?.[1] ?? '';
const indent = runbook.match(/^ */)[0].length;
const fromRunbook = parseAnnouncements(`announcements:\n${runbook.split('\n').map((l) => l.slice(indent)).join('\n')}\n`, edition2027.eventDay);
expect(same(fromRunbook, fromFile), `docs/event-day.md's example doesn't pass, or differs from the file's: ${JSON.stringify(fromRunbook)}`);

// In double quotes, a # and a colon are text, and \" is a quote.
expect(same(parse('- at: "2027-04-23 12:00"\n  text: "Join us in room #2 for lunch: it runs late."\n'), [{ at: '2027-04-23T12:00', text: 'Join us in room #2 for lunch: it runs late.', link: null }]), 'a # or a colon in double quotes is cut or refused');
expect(parse('- at: "2027-04-23 12:00"\n  text: "The \\"Ask the Speakers\\" table is open."\n')[0]?.text === 'The "Ask the Speakers" table is open.', 'a \\" inside the quotes is not a quote');
// Entries come out oldest first, and comments before, between and after the entries are fine.
expect(same(parse('# Before.\n- at: "2027-04-23 12:00"\n  text: "Second."\n# Between.\n- at: "2027-04-22 18:00"\n  text: "First."\n  link: https://example.com/\n# After.\n').map((a) => a.text), ['First.', 'Second.']), 'comments outside the entries are refused, or the entries are not oldest first');
expect(parse('').length === 0 && parse('# Only a comment.\n').length === 0, 'an empty list is refused');

// Text that isn't in double quotes: a # cuts it short, a colon breaks the file, and the rest is refused too.
const quotes = /entry 1 \(at "2027-04-23 12:00"\): "text" must be in double quotes/;
for (const [what, text] of [
  ['with a #, which YAML would cut to "Join us in room"', 'Join us in room #2 for lunch.'],
  ['plain', 'Doors open at 8.'],
  ['in single quotes', "'Doors open at 8.'"],
  ['folded over lines', '>\n    Doors open\n    at 8.'],
  ['a number', '42'],
]) expect(quotes.test(error(`- at: "2027-04-23 12:00"\n  text: ${text}\n`)), `text ${what} passes: ${error(`- at: "2027-04-23 12:00"\n  text: ${text}\n`) || 'no error'}`);
// A file that isn't valid YAML: an unquoted colon, or a quote inside the text that isn't written as \".
const hint = /^src\/data\/announcements-2027\.yaml: it isn't valid YAML\. .+ Put the text in double quotes, and write a quote inside it as \\"\.$/;
const colon = error('- at: "2027-04-23 12:00"\n  text: Note: lunch runs late.\n');
expect(hint.test(colon), `unquoted text with a colon fails without the hint: ${colon || 'no error'}`);
const quote = error('- at: "2027-04-23 12:00"\n  text: "Room "B" is open."\n');
expect(hint.test(quote), `a quote inside the text, not written as \\", fails without the hint: ${quote || 'no error'}`);

// A comment inside an entry: after a field, between fields, or in place of a field.
const comment = /entry 1 \(at "2027-04-23 12:00"\): has a # comment, which the page would leave out\. Put all of the text inside the double quotes, and remove the comment\./;
for (const [what, entry] of [
  ['after the text', '- at: "2027-04-23 12:00"\n  text: "Lunch is served" # in room 2\n'],
  ['after the time', '- at: "2027-04-23 12:00" # noon\n  text: "Lunch is served."\n'],
  ['between the fields', '- at: "2027-04-23 12:00"\n  # in room 2\n  text: "Lunch is served."\n'],
  ['in place of a link', '- at: "2027-04-23 12:00"\n  text: "Lunch is served."\n  # link: https://example.com/\n- at: "2027-04-23 12:30"\n  text: "Second."\n'],
  ['after the last field of the last entry', '- at: "2027-04-23 12:00"\n  text: "Lunch is served."\n  # link: https://example.com/\n'],
  ['after the link', '- at: "2027-04-23 12:00"\n  text: "Lunch is served."\n  link: https://example.com/ #menu\n'],
]) expect(comment.test(error(entry)), `a comment ${what} passes: ${error(entry) || 'no error'}`);
expect(parse('- at: "2027-04-23 12:00"\n  text: "Lunch is served."\n  link: https://example.com/menu#today\n')[0]?.link === 'https://example.com/menu#today', 'a # inside a link counts as a comment');

// The other rules, each naming the entry and the field.
for (const [what, entry, pattern] of [
  ['a field that is not one', '- at: "2027-04-23 12:00"\n  txt: "Lunch."\n', /entry 1 \(at "2027-04-23 12:00"\): "txt" is not a field/],
  ['a time with one hour digit', '- at: "2027-04-23 9:15"\n  text: "Doors open."\n', /entry 1 \(at "2027-04-23 9:15"\): "at" must be a Central time/],
  ['a day a week early', '- at: "2027-04-16 09:15"\n  text: "Doors open."\n', /"at" must be on Event Day \(2027-04-23\) or in the 6 days before it/],
  ['no text', '- at: "2027-04-23 12:00"\n', /"text" is missing or empty/],
  ['empty quotes', '- at: "2027-04-23 12:00"\n  text: " "\n', /"text" is missing or empty/],
  ['a line break', '- at: "2027-04-23 12:00"\n  text: "One.\\nTwo."\n', /"text" must be one line/],
  [`${MAX_TEXT + 1} characters`, `- at: "2027-04-23 12:00"\n  text: "${'x'.repeat(MAX_TEXT + 1)}"\n`, new RegExp(`"text" is ${MAX_TEXT + 1} characters; the most is ${MAX_TEXT}`)],
  ['an http link', '- at: "2027-04-23 12:00"\n  text: "Lunch."\n  link: http://example.com/\n', /"link" must be an https address/],
  ['the second entry', '- at: "2027-04-23 09:15"\n  text: "Doors open."\n- at: "2027-04-23 10:15"\n  text: "More."\n  link: http://example.com/\n', /^src\/data\/announcements-2027\.yaml: entry 2 \(at "2027-04-23 10:15"\): "link" must be an https address/],
]) expect(pattern.test(error(entry)), `${what}: ${error(entry) || 'no error'}`);
expect(parse(`- at: "2027-04-17 08:00"\n  text: "${'x'.repeat(MAX_TEXT)}"\n`).length === 1, `${MAX_TEXT} characters, 6 days before, is refused`);

// When it was posted: the time alone on the build's day; the date too on an earlier one, in the site's date style
// (shortDate in src/data/edition-2027.ts), as on the day after Event Day.
for (const [at, day, want] of [
  ['2027-04-23T10:15', '2027-04-23', '10:15 a.m.'],
  ['2027-04-23T12:00', '2027-04-23', '12:00 p.m.'],
  ['2027-04-23T00:05', '2027-04-23', '12:05 a.m.'],
  ['2027-04-20T15:00', '2027-04-23', `${shortDate('2027-04-20')}, 3:00 p.m.`],
  ['2027-04-17T08:30', '2027-04-23', 'Apr 17, 8:30 a.m.'],
  ['2027-04-23T18:45', '2027-04-24', 'Apr 23, 6:45 p.m.'],
]) expect(postedAt(at, day) === want, `postedAt(${at}) on ${day} is "${postedAt(at, day)}", not "${want}"`);

if (failures.length) {
  console.error(`Announcement tests failed (${failures.length} of ${checks}):\n  ${failures.join('\n  ')}`);
  process.exit(1);
}
console.log(`Announcement tests passed: ${checks} checks.`);
