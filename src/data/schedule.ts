// The 2027 schedule page's words (Session Committee). Dates come from the Edition file.
import { cfpSentence, edition2027, longDate, shortDate, shortDateYear } from './edition-2027';

const e = edition2027;

export const schedule = {
  title: `The KCD Texas ${e.year} Schedule`,
  description: `The KCD Texas ${e.year} Schedule, its Speakers and the keynotes are announced together on ${shortDateYear(e.schedule)}. Until then, see the call for proposals and the 2026 program.`,
  kicker: 'Schedule',
  lead: `The Schedule comes out ${shortDateYear(e.schedule)}, together with the Speakers and the keynotes. The Session Committee selects the Sessions.`,
  facts: [
    { term: 'Call for proposals closes', text: shortDateYear(e.cfp.closes) },
    { term: 'Schedule and Speakers', text: shortDate(e.schedule) },
    { term: 'Event', text: `${longDate(e.eventDay)}, ${e.city}` },
  ],
  speak: {
    title: 'Want to speak?',
    text: `The call for proposals ${cfpSentence()}. Submit a talk or a hands-on workshop, and mark it as an End-User Story if your organization runs cloud native for its own business.`,
    link: 'Read the CFP guide',
  },
  past: {
    title: 'The 2026 program',
    text: 'See who spoke at KCD Texas 2026 in Austin, and watch the recordings.',
    link: 'See the 2026 program',
    talks: 'Watch all 2026 talks on YouTube',
  },
} as const;
