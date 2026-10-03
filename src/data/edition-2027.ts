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

/** Today's date in Central time, as YYYY-MM-DD. */
export function todayCentral(now = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: ZONE, year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
}

/** The Phase on a given day (CONTEXT.md): CFP Phase until the CFP closes, then Countdown, Event Day, Recap. */
export function phaseOn(day: string): Phase {
  if (day <= edition2027.cfp.closes) return 'cfp';
  if (day < edition2027.eventDay) return 'countdown';
  if (day === edition2027.eventDay) return 'event-day';
  return 'recap';
}

/** The day the build describes: today, but never before the announcement. */
export const asOfDay = [todayCentral(), edition2027.announced].sort().at(-1)!;
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

/** Where "Now" sits on the key-dates strip, which runs from Oct 1, 2026 to Apr 30, 2027. */
export const timeline = { start: '2026-10-01', end: '2027-05-01' } as const;
export function timelinePercent(day: string): number {
  const span = at(timeline.end).getTime() - at(timeline.start).getTime();
  return Math.min(100, Math.max(0, ((at(day).getTime() - at(timeline.start).getTime()) / span) * 100));
}
