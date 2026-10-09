// The 2027 CFP page's words (Session Committee). Dates come from the Edition file.
import { edition2026 } from './edition-2026';
import { edition2027, longDate, phase, programState, programStatus, shortDateYear, ticketsStatus } from './edition-2027';

const e = edition2027;
// The program's day follows its gate, like every program word: no date once the day passes without the release.
const late = programState() === 'soon';

export const cfp = {
  title: `Speak at KCD Texas ${e.year}`,
  description: phase === 'cfp'
    ? `The KCD Texas ${e.year} call for proposals opens ${shortDateYear(e.cfp.opens)}, and closes ${shortDateYear(e.cfp.closes)}. What we look for, and how to submit.`
    : `The KCD Texas ${e.year} call for proposals closed on ${shortDateYear(e.cfp.closes)}. Thanks to everyone who sent a proposal.`,
  kicker: 'Call for proposals',
  lead: `Tell us how your team runs Kubernetes and cloud native in production. The call for proposals runs from ${shortDateYear(e.cfp.opens)}, to ${shortDateYear(e.cfp.closes)}.`,
  dates: [
    { term: 'Opens', text: shortDateYear(e.cfp.opens) },
    { term: 'Closes', text: `${shortDateYear(e.cfp.closes)}, ${e.cfp.closesTime} Central` },
    { term: 'Speakers announced', text: `${late ? 'Coming soon' : shortDateYear(e.schedule)}, with the Schedule` },
    { term: 'Event', text: `${longDate(e.eventDay)}, ${e.city}` },
  ],

  // The link to submit, from the Session Committee once its platform is set. The page names no
  // platform until then (a Co-Organizer, 2026-10-08), and while the link is empty it links nowhere.
  submitUrl: '',
  submitButton: 'Submit a proposal',
  // Before the call opens, and while it is open without a link.
  submit: 'The link to submit is coming soon.',
  closed: `The call for proposals closed on ${shortDateYear(e.cfp.closes)}.`,
  // After the close: where to go next (plan-release-5), the Schedule by the program's gate, then tickets.
  next: {
    before: 'What’s next:',
    schedule: `the Schedule (${programStatus()})`,
    and: 'and',
    tickets: `tickets (${ticketsStatus()[0].toLowerCase()}${ticketsStatus().slice(1)})`,
  },

  lookFor: {
    title: 'What we look for',
    intro: 'Practical talks from real experience with Kubernetes and the tools around it. The strongest proposals show how something works in production: the numbers, the versions, the trade-offs, and what you’d do differently.',
    points: [
      'Talks and hands-on workshops at any level: beginner, intermediate or advanced. Say which one yours is.',
      'Specifics: the system, the scale, what failed, what you measured.',
      'Work at a vendor? Tell us what you learned, not what you sell. Sales talks and product demos don’t get selected.',
    ],
  },
  endUser: {
    title: 'Your End-User Story',
    text: 'If your organization runs cloud native for its own business rather than selling it, tell us how. Mark your proposal as an End-User Story and it gets a label on the Schedule.',
    employer: 'You don’t have to name your employer’s systems. Ask us for help with your company’s review.',
    // One line on the call-for-proposals social card.
    cardLine: 'Run cloud native for your own business? Tell us your End-User Story.',
  },
  firstTime: {
    title: 'First-time Speakers',
    text: 'First time speaking? Ask for a mentor when you submit.',
  },
  writing: {
    title: 'Writing a strong proposal',
    points: [
      'A title that says what the talk is about.',
      'Who it’s for, and what they’ll be able to do afterwards.',
      'An abstract someone can read in 30 seconds. Put the details in the notes for reviewers.',
    ],
  },
  choose: {
    title: 'How we choose',
    text: `The Session Committee selects the Sessions. The selected Speakers, the keynotes and the Schedule ${late ? 'come out together soon' : `are announced together on ${shortDateYear(e.schedule)}`}.`,
    proposals: `KCD Texas 2025 received ${edition2026.proposals2025} proposals.`,
    proposalsSource: 'CNCF transparency report, 2025',
  },
  conduct: {
    title: 'Code of Conduct',
    before: 'Speakers agree to the',
    cncf: 'CNCF Code of Conduct',
    page: 'Our Code of Conduct page says how to report a problem.',
  },
  questions: 'Questions? Email',
} as const;
