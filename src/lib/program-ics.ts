// The program's calendar files: one per Session and one for the whole Schedule (src/lib/ics.ts).
import { edition2027 } from '../data/edition-2027';
import { paths } from '../data/nav';
import { calendar, stampNow, type IcsEvent } from './ics';
import { program, speakersOf, type Session } from './program';

const SITE = 'https://kcdtexas.org';

const event = (s: Session): IcsEvent => ({
  uid: `${s.id}@kcdtexas.org`,
  title: s.title,
  start: s.start!,
  end: s.end!,
  location: `${s.room}, KCD Texas ${edition2027.year}, ${edition2027.city}`,
  url: `${SITE}${paths.sessions}${s.slug}/`,
  description: speakersOf(s).map((p) => p.name).join(', '),
});

/** The Sessions with a time: none until the Schedule is public. */
export const timed = () => (program?.schedulePublic ? program.sessions.filter((s) => s.start && s.end) : []);

export const sessionIcs = (s: Session) => calendar(s.title, [event(s)], stampNow());
export const scheduleIcs = () => calendar(`KCD Texas ${edition2027.year}`, timed().map(event), stampNow());

export const icsResponse = (body: string) => new Response(body, { headers: { 'Content-Type': 'text/calendar; charset=utf-8' } });
