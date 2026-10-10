// The 2027 Edition: its dates and the Phase they put the home page in.
// Every date the site shows lives here, never in a template (ADR 0009: pushing = announcing).
// All dates and times are Central time (America/Chicago).

// The day tickets go on sale, once CNCF sets it (owner-actions A62); null until then. `scripts/build.sh
// --tickets-day DAY` sets KCD_TICKETS_DAY to try a sample day in tests and design reviews: the pages then
// label it "Sample day", and production builds refuse the flag.
const ticketsDay: string | null = null;
const sampleTicketsDay = import.meta.env?.KCD_TICKETS_DAY as string | undefined;
if (sampleTicketsDay && !/^\d{4}-\d{2}-\d{2}$/.test(sampleTicketsDay)) throw new Error(`KCD_TICKETS_DAY must be YYYY-MM-DD, not ${sampleTicketsDay}`);
/** True only in a test build with a sample ticket day. */
export const ticketsSample = Boolean(sampleTicketsDay);

// Where to buy tickets, once CNCF sends the link (owner-actions A62); null until then. A sample ticket day also
// sets a stand-in link, the KCD Texas chapter page (contact.chapterUrl in site.ts), so test builds can show the
// "Get tickets" state. This file imports nothing, so the address is repeated here.
const ticketsUrl: string | null = null;
const sampleTicketsUrl = 'https://community2.cncf.io/kcd-texas/';

// Two more test-only switches, set by scripts/build.sh like --tickets-day and refused in production builds:
// --program-public (KCD_PROGRAM_PUBLIC=1) builds as if the program were out, with no program data, and
// --sponsors-sample (KCD_SPONSORS_SAMPLE=1) fills the 2027 wall with plain "Sample" tiles (sponsors-2027.ts).
// The pages label both "Sample", and check-dist blocks the word in any other build.
/** True only in a test build with --program-public. */
export const programSample = import.meta.env?.KCD_PROGRAM_PUBLIC === '1';
/** True only in a test build with --sponsors-sample. */
export const sponsorsSample = import.meta.env?.KCD_SPONSORS_SAMPLE === '1';

// The last day sponsorships are open: through Event Day, Apr 23. With null, they also stay open through Event Day.
// The day after is a rebuild day in scripts/rebuild-dates.mjs.
const sponsorshipsLastDay: string | null = '2027-04-23';

export const edition2027 = {
  year: 2027,
  city: 'Dallas',
  sponsorships: { closes: sponsorshipsLastDay },
  cfp: {
    opens: '2026-11-01',
    closes: '2027-01-31',
    closesTime: '11:59 p.m.',
  },
  // "Coming soon" until CNCF sets the day (a Co-Organizer, 2026-10-08); setting `ticketsDay` above adds
  // it to scripts/rebuild-dates.mjs.
  tickets: {
    onSale: (sampleTicketsDay || ticketsDay) as string | null,
    url: (sampleTicketsDay ? sampleTicketsUrl : ticketsUrl) as string | null,
  },
  // The Speakers, the keynotes and the Schedule are announced together on this day (a Co-Organizer, 2026-10-08).
  schedule: '2027-03-01',
  eventDay: '2027-04-23',
  eventNote: 'One day, in person. Venue announced soon.',
  managerLetter: 'November',
} as const;

export type Phase = 'cfp' | 'countdown' | 'event-day' | 'recap';

const ZONE = 'America/Chicago';

/** Today's date in Central time, as YYYY-MM-DD. `scripts/build.sh --now YYYY-MM-DD` sets KCD_BUILD_DAY to
 *  build as if that day were today (tests/time-machine.mjs); production builds never set it. */
export function todayCentral(now?: Date): string {
  // "?." so plain Node can import this file too (scripts/rebuild-dates.mjs, the tests).
  const override = import.meta.env?.KCD_BUILD_DAY;
  if (!now && override) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(override)) throw new Error(`KCD_BUILD_DAY must be YYYY-MM-DD, not ${override}`);
    return override;
  }
  return new Intl.DateTimeFormat('en-CA', { timeZone: ZONE, year: 'numeric', month: '2-digit', day: '2-digit' }).format(now ?? new Date());
}

/** The Phase on a given day (CONTEXT.md): CFP Phase until the CFP closes, then Countdown, Event Day, Recap. */
export function phaseOn(day: string): Phase {
  if (day <= edition2027.cfp.closes) return 'cfp';
  if (day < edition2027.eventDay) return 'countdown';
  if (day === edition2027.eventDay) return 'event-day';
  return 'recap';
}

/** The day the build describes: the build day, in Central time. NOW on the key dates uses it. */
export const asOfDay = todayCentral();
export const phase: Phase = phaseOn(asOfDay);

/** The manager letter line: its month in the CFP Phase; from Feb 1 that month has passed, so "soon". */
export const managerLetterLine = `An approval letter is coming ${phase === 'cfp' ? `in ${edition2027.managerLetter}` : 'soon'}, with the cost and what your team gets back.`;

const at = (day: string) => new Date(`${day}T12:00:00Z`);
/** "Nov 1" */
export const shortDate = (day: string) => new Intl.DateTimeFormat('en-US', { timeZone: 'UTC', month: 'short', day: 'numeric' }).format(at(day));
/** "Jan 31, 2027" */
export const shortDateYear = (day: string) => `${shortDate(day)}, ${day.slice(0, 4)}`;
/** "April 23, 2027" */
export const longDate = (day: string) => new Intl.DateTimeFormat('en-US', { timeZone: 'UTC', month: 'long', day: 'numeric', year: 'numeric' }).format(at(day));

/** The last day sponsorships are open: the day set above, or Event Day until one is set. */
export const sponsorshipsCloses = (): string => edition2027.sponsorships.closes ?? edition2027.eventDay;

/** "Open now" through the last day of sponsorships, then "Closed", for sponsorships on the build day. */
export function sponsorshipsStatus(day = asOfDay): string {
  return day <= sponsorshipsCloses() ? 'Open now' : 'Closed';
}

/** "Opens Nov 1", "Open now" or "Closed", for the CFP on the build day. */
export function cfpStatus(day = asOfDay): string {
  if (day < edition2027.cfp.opens) return `Opens ${shortDate(edition2027.cfp.opens)}`;
  if (day <= edition2027.cfp.closes) return 'Open now';
  return 'Closed';
}

/** "opens Nov 1", "is open now" or "is closed": the CFP status to end "The call for proposals …". */
export function cfpSentence(day = asOfDay): string {
  if (day < edition2027.cfp.opens) return `opens ${shortDate(edition2027.cfp.opens)}`;
  if (day <= edition2027.cfp.closes) return 'is open now';
  return 'is closed';
}

/** "Coming soon" until the sale day is set, then "On sale <day>" or "On sale now", for tickets on the build day. */
export function ticketsStatus(day = asOfDay): string {
  const on = edition2027.tickets.onSale;
  if (!on) return 'Coming soon';
  return day < on ? `On sale ${shortDate(on)}` : 'On sale now';
}

/** "are coming soon", "go on sale <day>" or "are on sale now": the tickets status to end "Tickets …". */
export function ticketsSentence(day = asOfDay): string {
  const on = edition2027.tickets.onSale;
  if (!on) return 'are coming soon';
  return day < on ? `go on sale ${shortDate(on)}` : 'are on sale now';
}

// The four facts the home page and the header follow (plan-release-5, "The state model"). They are independent:
// tickets can go on sale in the CFP Phase, the program can come out late, and sponsorships close before it.

/** Sponsorships are open on `day`: through their last day (sponsorshipsStatus). */
export const sponsorshipsOpen = (day = asOfDay): boolean => sponsorshipsStatus(day) === 'Open now';

/** The site asks for sponsors on `day`: sponsorships are open and Event Day hasn't come. Sponsorships run through
 *  Event Day, but that day's pages ask no one to sponsor: the Sponsor buttons, the pitch and the open wall slot
 *  stay through Apr 22. The key dates and the sponsors page follow sponsorshipsOpen() and close from Apr 24. */
export const sponsorAsk = (day = asOfDay): boolean => sponsorshipsOpen(day) && day < edition2027.eventDay;

/** Tickets are on sale on `day`: the sale day has come and CNCF's ticket link is in. */
export const ticketsOnSale = (day = asOfDay): boolean => ticketsStatus(day) === 'On sale now' && Boolean(edition2027.tickets.url);

/** The Speakers, the keynotes and the Schedule are public. False until the program pipeline (src/lib/program.ts,
 *  a later project) opens its `schedulePublic` gate; that project switches this one function. */
export function programPublic(): boolean {
  return programSample;
}

/** Where the program stands, by its gate, never by the date alone: 'out' once public; 'dated' before its day;
 *  'soon' if the day passes without the release. */
export function programState(day = asOfDay): 'out' | 'dated' | 'soon' {
  if (programPublic()) return 'out';
  return day < edition2027.schedule ? 'dated' : 'soon';
}

/** "Mar 1", "coming soon" or "out now": the program's status, by programState(). */
export function programStatus(day = asOfDay): string {
  const s = programState(day);
  return s === 'out' ? 'out now' : s === 'dated' ? shortDate(edition2027.schedule) : 'coming soon';
}

/** "Apr 23 · Dallas", or "Today · Dallas" on Event Day, for the Edition on the build day. */
export function eventStatus(day = asOfDay): string {
  return `${day === edition2027.eventDay ? 'Today' : shortDate(edition2027.eventDay)} · ${edition2027.city}`;
}

/** Where NOW sits among the dated key-date items on `day`: on the last item that has started, while it runs
 *  ('on'), or just after it ('after'); before the first item until one starts ('before'); nowhere outside the
 *  key-dates window. It only moves forward, through the items in date order. /now.js repeats this rule. */
export function nowOn(spans: { key: string; from: string; until: string }[], day = asOfDay): { key: string; at: 'before' | 'on' | 'after' } | null {
  if (day < timeline.start || day >= timeline.end || spans.length === 0) return null;
  const ordered = [...spans].sort((a, b) => a.from.localeCompare(b.from));
  const last = ordered.filter((s) => s.from <= day).at(-1);
  if (!last) return { key: ordered[0].key, at: 'before' };
  return { key: last.key, at: day <= last.until ? 'on' : 'after' };
}

/** Where "Now" sits on the key-dates strip, which runs from Oct 1, 2026 to Apr 30, 2027. */
export const timeline = { start: '2026-10-01', end: '2027-05-01' } as const;
export function timelinePercent(day: string): number {
  const span = at(timeline.end).getTime() - at(timeline.start).getTime();
  return Math.min(100, Math.max(0, ((at(day).getTime() - at(timeline.start).getTime()) / span) * 100));
}
