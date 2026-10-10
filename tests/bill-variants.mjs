// Every way the hero's 2027 bill can read (src/data/home.ts, the bills), for the bill test in tests/browser.mjs:
// each variant's fit values come from the font (billFits in src/lib/bill-fit.ts) and the bill must stay inside its
// measure. tests/run-time-machine.mjs fails a build whose bill isn't listed here, so the list follows the words.
import { laterOnSale } from './sample-days.mjs';

const cfpEnd = { end: 'Your End-User Story here', arrow: true };
const countdownEnd = { end: 'Watch the 2026 talks', arrow: true };
const note = (label, text) => ({ label, text });

const cfp = ['opens Nov 1', 'open now'].flatMap((call) => [note('Keynotes:', 'announced Mar 1'), note('Tickets:', 'on sale now')]
  .map((third) => ({ name: `CFP Phase, the call ${call}, ${third.label} ${third.text}`, notes: [note('Sponsorships:', 'open now'), note('Call for proposals:', call), third], ...cfpEnd })));

// A sample sale day after the build day reads "on sale" and its date (the time machine's run, tests/sample-days.mjs).
const countdown = ['coming soon', laterOnSale, 'on sale now'].flatMap((tickets) => ['Mar 1', 'coming soon', 'out now']
  .map((schedule) => ({ name: `Countdown, tickets ${tickets}, Schedule ${schedule}`, notes: [note('Tickets:', tickets), note('Schedule:', schedule), note('Sponsorships:', 'open now')], ...countdownEnd })));

export const BILL_VARIANTS = [
  ...cfp,
  ...countdown,
  { name: 'Event Day', notes: [], end: 'Today in Dallas', arrow: false },
  { name: 'Recap', notes: [], end: 'Thank you, Dallas', arrow: false },
];

/** The words of a bill, the way the tests compare them: "Label text · Label text | end", or the end alone. */
export const billWords = ({ notes, end }) => (notes.length ? `${notes.map((n) => `${n.label} ${n.text}`).join(' · ')} | ${end}` : end);
