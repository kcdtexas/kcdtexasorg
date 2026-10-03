// The 2027 CFP page's words (Session Committee). Dates come from the Edition file.
import { edition2027, longDate, shortDate, shortDateYear } from './edition-2027';

const e = edition2027;

export const cfp = {
  title: `Speak at KCD Texas ${e.year}`,
  description: `The KCD Texas ${e.year} call for proposals opens ${shortDateYear(e.cfp.opens)} and closes ${shortDateYear(e.cfp.closes)}. What we look for, and how to submit.`,
  lead: `Tell us how your team runs Kubernetes and cloud native in production. The call for proposals runs from ${shortDateYear(e.cfp.opens)} to ${shortDateYear(e.cfp.closes)}.`,
  dates: [
    { term: 'Opens', text: shortDateYear(e.cfp.opens) },
    { term: 'Closes', text: `${shortDateYear(e.cfp.closes)}, ${e.cfp.closesTime} Central` },
    { term: 'Event', text: `${longDate(e.eventDay)}, ${e.city}` },
  ],
  submit: `Submit on Sessionize from ${shortDate(e.cfp.opens)}.`,
  submitNote: 'The link goes here when the call for proposals opens.',
  lookFor: {
    title: 'What we look for',
    intro: 'Practical talks grounded in real experience with Kubernetes and the tools around it. The strongest proposals show how something works in production: the numbers, the versions, the trade-offs, and what you’d do differently.',
    points: [
      'Talks and hands-on workshops at any level: beginner, intermediate or advanced. Say which one yours is.',
      'Specifics: the system, the scale, what failed, what you measured.',
      'A title that says what the talk is about, and an abstract someone can read in 30 seconds. Put the details in the notes for reviewers.',
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
  conduct: 'Speakers agree to the',
  questions: 'Questions? Email',
} as const;
