// The 2027 schedule page's words (Session Committee). Dates come from the Edition file.
import { cfpSentence, edition2027, longDate, programDataSample, programSample, programState, shortDate, shortDateYear } from './edition-2027';
import { programSampleLabel } from './program-pages';

const e = edition2027;
// The program's words follow its gates, never the date (plan-release-5): its day, "soon" if the day passes
// without the release, the Speakers alone if only their gate opens, then out.
const prog = programState();
const all = `The KCD Texas ${e.year} Schedule, its Speakers and the keynotes`;
const selects = 'The Session Committee selects the Sessions.';
const when = {
  dated: { desc: `${all} are announced together on ${shortDateYear(e.schedule)}. Until then, see the call for proposals and the 2026 program.`, lead: `The Schedule comes out ${shortDateYear(e.schedule)}, together with the Speakers and the keynotes. ${selects}`, facts: [{ term: 'Schedule and Speakers', text: shortDate(e.schedule) }] },
  soon: { desc: `${all} are coming soon. Until then, see the 2026 program.`, lead: `The Schedule comes out soon, together with the Speakers and the keynotes. ${selects}`, facts: [{ term: 'Schedule and Speakers', text: 'Coming soon' }] },
  speakers: { desc: `The KCD Texas ${e.year} Speakers are out, and the Schedule comes out soon.`, lead: 'The Speakers are out. The Schedule comes out soon.', facts: [{ term: 'Speakers', text: 'Out now' }, { term: 'Schedule', text: 'Coming soon' }] },
  out: { desc: `${all} are out.`, lead: 'The Schedule is out, with the Speakers and the keynotes. The Session Committee selected the Sessions.', facts: [{ term: 'Schedule and Speakers', text: 'Out now' }] },
}[prog];

export const schedule = {
  title: `The KCD Texas ${e.year} Schedule`,
  description: when.desc,
  kicker: 'Schedule',
  lead: when.lead,
  // build.sh --program-public: the gate is open but this build has no program data.
  sample: programDataSample ? programSampleLabel : programSample ? 'Sample: this test build has no program data.' : '',
  // While only the Speakers are public, the link to them.
  meetSpeakers: 'Meet the Speakers',
  // The Schedule itself, once its gate is open (src/lib/program.ts).
  program: {
    title: 'Sessions by time',
    speakers: 'All Speakers',
    ics: 'Add the whole Schedule to your calendar (.ics)',
  },
  facts: [
    { term: 'Call for proposals closes', text: shortDateYear(e.cfp.closes) },
    ...when.facts,
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
