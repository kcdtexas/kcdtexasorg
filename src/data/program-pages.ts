// The program pages' words (Session Committee): the Session and Speaker pages, the Speakers list and the Event Day
// page. Names, titles, times and rooms come from src/lib/program.ts.
import { edition2027, longDate, programSampleGates } from './edition-2027';
import type { Session, Speaker } from '../lib/program';

const e = edition2027;

/** The label on every page that shows the test program (build.sh --program-sample): with only the Speakers public,
 *  the Sessions have no times or rooms. */
export const programSampleLabel = programSampleGates.schedulePublic
  ? 'Sample: this test build shows made-up Speakers and Sessions, not the 2027 program.'
  : 'Sample: this test build shows made-up Speakers and Sessions, without times or rooms, not the 2027 program.';

export const programPages = {
  year: e.year,
  dayLine: `${longDate(e.eventDay)}, ${e.city}`,
  sample: programSampleLabel,
  session: {
    // The kicker and the closing link go to the Schedule, or to the Speakers while only they are public.
    kicker: `KCD Texas ${e.year} Schedule`,
    kickerSpeakers: `KCD Texas ${e.year} Speakers`,
    description: (s: Session) => `${s.title}: a Session at KCD Texas ${e.year} in ${e.city} on ${longDate(e.eventDay)}.`,
    time: 'Time (Central)',
    room: 'Room',
    day: 'Day',
    calendar: 'Add to calendar',
    about: 'About this Session',
    noAbstract: 'The abstract is coming.',
    speaker: 'Speaker',
    speakers: 'Speakers',
    back: 'See the whole Schedule',
    backSpeakers: 'See all the Speakers',
  },
  speakers: {
    title: `The KCD Texas ${e.year} Speakers`,
    kicker: 'Speakers',
    description: `The Speakers at KCD Texas ${e.year} in ${e.city} on ${longDate(e.eventDay)}, and their Sessions.`,
    lead: (n: number) => `${n} Speakers, by surname. Each one’s page has their Sessions.`,
  },
  speaker: {
    kicker: `KCD Texas ${e.year} Speaker`,
    description: (p: Speaker) => `${p.name} speaks at KCD Texas ${e.year} in ${e.city} on ${longDate(e.eventDay)}.`,
    sessions: 'Sessions',
    about: 'About',
    noBio: 'The bio is coming.',
    links: 'Links',
    card: 'Share Card',
    cardText: 'Download the Share Card (PNG)',
    all: 'All Speakers',
  },
} as const;
