// The 2027 Edition: its dates and the Phase they put the home page in.
// Every date the site shows lives here, never in a template (ADR 0009: pushing = announcing).
// All dates and times are Central time (America/Chicago).

export const edition2027 = {
  year: 2027,
  city: 'Dallas',
  // The day the Website presents this Edition; "As of" on the key dates never shows an earlier day.
  announced: '2026-10-28',
  sponsorships: { status: 'Open now' },
  cfp: {
    opens: '2026-11-01',
    closes: '2027-01-31',
    closesTime: '11:59 p.m.',
    keynotesAnnounced: 'February',
  },
  tickets: { onSale: '2027-02-01' },
  speakersAnnounced: 'February',
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

/** The day the build describes: the build day, in Central time. "Now" and "As of" on the key dates use it. */
export const asOfDay = todayCentral();
export const phase: Phase = phaseOn(asOfDay);

const at = (day: string) => new Date(`${day}T12:00:00Z`);
/** "Nov 1" */
export const shortDate = (day: string) => new Intl.DateTimeFormat('en-US', { timeZone: 'UTC', month: 'short', day: 'numeric' }).format(at(day));
/** "Jan 31, 2027" */
export const shortDateYear = (day: string) => `${shortDate(day)}, ${day.slice(0, 4)}`;
/** "April 23, 2027" */
export const longDate = (day: string) => new Intl.DateTimeFormat('en-US', { timeZone: 'UTC', month: 'long', day: 'numeric', year: 'numeric' }).format(at(day));

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

/** "On sale Feb 1" or "On sale now", for tickets on the build day. */
export function ticketsStatus(day = asOfDay): string {
  return day < edition2027.tickets.onSale ? `On sale ${shortDate(edition2027.tickets.onSale)}` : 'On sale now';
}

/** "Apr 23 · Dallas", or "Today · Dallas" on Event Day, for the Edition on the build day. */
export function eventStatus(day = asOfDay): string {
  return `${day === edition2027.eventDay ? 'Today' : shortDate(edition2027.eventDay)} · ${edition2027.city}`;
}

/** Where "Now" sits on the key-dates strip, which runs from Oct 1, 2026 to Apr 30, 2027. */
export const timeline = { start: '2026-10-01', end: '2027-05-01' } as const;
export function timelinePercent(day: string): number {
  const span = at(timeline.end).getTime() - at(timeline.start).getTime();
  return Math.min(100, Math.max(0, ((at(day).getTime() - at(timeline.start).getTime()) / span) * 100));
}
