// The 2027 schedule page's words (Session Committee). Dates come from the Edition file.
import { cfpSentence, edition2027, longDate, programSample, programState, shortDate, shortDateYear } from './edition-2027';

const e = edition2027;
// The program's words follow its gate, never the date (plan-release-5): its day, "soon" if the day passes
// without the release, then out.
const prog = programState();
const when = {
  dated: { desc: `are announced together on ${shortDateYear(e.schedule)}. Until then, see the call for proposals and the 2026 program.`, lead: `The Schedule comes out ${shortDateYear(e.schedule)}, together with the Speakers and the keynotes.`, fact: shortDate(e.schedule) },
  soon: { desc: 'are coming soon. Until then, see the 2026 program.', lead: 'The Schedule comes out soon, together with the Speakers and the keynotes.', fact: 'Coming soon' },
  out: { desc: 'are out.', lead: 'The Schedule is out, with the Speakers and the keynotes.', fact: 'Out now' },
}[prog];

export const schedule = {
  title: `The KCD Texas ${e.year} Schedule`,
  description: `The KCD Texas ${e.year} Schedule, its Speakers and the keynotes ${when.desc}`,
  kicker: 'Schedule',
  lead: `${when.lead} The Session Committee selects the Sessions.`,
  // build.sh --program-public: the gate is open but this build has no program data.
  sample: programSample ? 'Sample: this test build has no program data.' : '',
  facts: [
    { term: 'Call for proposals closes', text: shortDateYear(e.cfp.closes) },
    { term: 'Schedule and Speakers', text: when.fact },
    { term: 'Event', text: `${longDate(e.eventDay)}, ${e.city}` },
  ],
  // The CFP Phase only: from Feb 1 the call is closed.
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
