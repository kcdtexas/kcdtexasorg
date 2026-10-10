// Central time (America/Chicago) for program times. Platforms hand over event-local times with no offset
// (Sessionize's startsAt), which are Central wall-clock times; a time with an offset or "Z" is converted.
// The model keeps 'YYYY-MM-DDTHH:MM' in Central, so a wall-clock time that doesn't exist (the hour skipped when
// daylight saving time starts) is refused rather than shifted.
const ZONE = 'America/Chicago';
const parts = new Intl.DateTimeFormat('en-US', {
  timeZone: ZONE, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit',
});

/** 'YYYY-MM-DDTHH:MM' in Central for an instant. */
export function centralOf(date) {
  const p = Object.fromEntries(parts.formatToParts(date).map((x) => [x.type, x.value]));
  return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}`;
}

/** The instant of a Central wall-clock time, or null when that time doesn't exist (the spring-forward hour).
 *  In the repeated hour when daylight saving time ends, the first (daylight) one. */
export function centralToUtc(local) {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(local);
  if (!m) return null;
  const wall = Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5]);
  // Central is UTC-5 (CDT) or UTC-6 (CST): try both, earlier first.
  for (const hours of [5, 6]) {
    const at = new Date(wall + hours * 3600_000);
    if (centralOf(at) === local) return at;
  }
  return null;
}

const LOCAL = /^(\d{4}-\d{2}-\d{2})[T ](\d{2}:\d{2})(?::\d{2}(?:\.\d+)?)?$/;
const ZONED = /^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}:?\d{2})$/i;

/** A platform's time as 'YYYY-MM-DDTHH:MM' in Central; null when it's empty; throws on anything else. */
export function toCentral(value) {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value !== 'string') throw new Error('not a time');
  const v = value.trim();
  const local = LOCAL.exec(v);
  if (local) {
    const t = `${local[1]}T${local[2]}`;
    if (!centralToUtc(t)) throw new Error('a Central time that does not exist (the hour skipped for daylight saving time)');
    return t;
  }
  if (ZONED.test(v)) {
    const d = new Date(v.replace(' ', 'T').replace(/([+-]\d{2})(\d{2})$/, '$1:$2'));
    if (Number.isNaN(d.getTime())) throw new Error('not a time');
    return centralOf(d);
  }
  throw new Error('not a time as YYYY-MM-DDTHH:MM');
}
