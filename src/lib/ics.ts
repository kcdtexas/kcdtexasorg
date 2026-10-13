// Calendar files (RFC 5545) for the Schedule, built at build time: one per Session, and one for the whole
// Schedule. Times stay Central local times with the America/Chicago zone, so a calendar shows them right in any
// time zone. /schedule.js builds the personal My Schedule file in the browser with the same rules.

export const ZONE = 'America/Chicago';

// America/Chicago since 2007: CDT from the second Sunday of March, CST from the first Sunday of November.
const VTIMEZONE = [
  'BEGIN:VTIMEZONE', `TZID:${ZONE}`,
  'BEGIN:DAYLIGHT', 'TZOFFSETFROM:-0600', 'TZOFFSETTO:-0500', 'TZNAME:CDT', 'DTSTART:20070311T020000', 'RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=2SU', 'END:DAYLIGHT',
  'BEGIN:STANDARD', 'TZOFFSETFROM:-0500', 'TZOFFSETTO:-0600', 'TZNAME:CST', 'DTSTART:20071104T020000', 'RRULE:FREQ=YEARLY;BYMONTH=11;BYDAY=1SU', 'END:STANDARD',
  'END:VTIMEZONE',
];

export interface IcsEvent {
  uid: string;
  title: string;
  /** Central local time, 'YYYY-MM-DDTHH:MM'. */
  start: string;
  end: string;
  location: string;
  url: string;
  description?: string;
}

const local = (t: string) => `${t.slice(0, 10).replace(/-/g, '')}T${t.slice(11, 16).replace(':', '')}00`;
const escape = (s: string) => s.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');

/** Folds a line at 75 octets, as RFC 5545 asks, without splitting a character. */
function fold(line: string): string {
  const out: string[] = [];
  let cur = '';
  let size = 0;
  for (const ch of line) {
    const n = Buffer.byteLength(ch);
    if (size + n > (out.length ? 74 : 75)) { out.push(cur); cur = ''; size = 0; }
    cur += ch;
    size += n;
  }
  out.push(cur);
  return out.join('\r\n ');
}

/** A calendar file with these events. `stamp` is the build time in UTC, as 'YYYYMMDDTHHMMSSZ'. */
export function calendar(name: string, events: IcsEvent[], stamp: string): string {
  const lines = [
    'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//KCD Texas//kcdtexas.org//EN', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH',
    `X-WR-CALNAME:${escape(name)}`, `X-WR-TIMEZONE:${ZONE}`,
    ...VTIMEZONE,
    ...events.flatMap((e) => [
      'BEGIN:VEVENT',
      `UID:${e.uid}`,
      `DTSTAMP:${stamp}`,
      `DTSTART;TZID=${ZONE}:${local(e.start)}`,
      `DTEND;TZID=${ZONE}:${local(e.end)}`,
      `SUMMARY:${escape(e.title)}`,
      `LOCATION:${escape(e.location)}`,
      `URL:${e.url}`,
      ...(e.description ? [`DESCRIPTION:${escape(e.description)}`] : []),
      'END:VEVENT',
    ]),
    'END:VCALENDAR',
  ];
  return lines.map(fold).join('\r\n') + '\r\n';
}

/** The build time as an iCalendar UTC stamp. */
export const stampNow = () => new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+Z$/, 'Z');
