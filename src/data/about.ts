// The About page's words (Core Event Committee). Figures come from the Edition files.
import { edition2026 } from './edition-2026';
import { edition2027, longDate } from './edition-2027';

const e = edition2027;

export const about = {
  title: 'About KCD Texas',
  description: 'KCD Texas is the yearly Kubernetes Community Day in Texas, organized by local volunteers and supported by CNCF. Its history, its Committees and how to get involved.',
  kicker: 'About',
  lead: 'KCD Texas is a Kubernetes Community Day: a one-day conference organized by local volunteers and supported by the Cloud Native Computing Foundation (CNCF). It’s the annual conference of Cloud Native Texas, the community behind the monthly meetups in Austin, Dallas and Houston.',
  money: 'KCD Texas is not-for-profit: sponsorship and tickets pay for the event.',
  kcdLink: 'Kubernetes Community Days on cncf.io',

  timeline: {
    title: 'How we got here',
    // Every line from the CNCF transparency reports (the private research notes list the sources).
    rows: [
      { year: '2023', text: 'Canceled.' },
      { year: '2024', text: 'Austin, co-located with Texas Linux Fest.' },
      { year: '2025', text: `Austin Central Library. The first independent KCD Texas. ${edition2026.checkedIn2025} attendees checked in.` },
      { year: String(edition2026.year), text: `TCEA, ${edition2026.city}, ${edition2026.date}. ${edition2026.checkedIn} attendees checked in, with ${edition2026.speakers} Speakers and ${edition2026.sponsorCount} sponsors.` },
      { year: String(e.year), text: `${e.city}, ${longDate(e.eventDay)}.`, current: true },
    ],
    source: 'Source: CNCF transparency reports for',
    joiner: ' and ',
    sources: [
      { label: '2025', href: edition2026.report2025Url },
      { label: String(edition2026.year), href: edition2026.reportUrl },
    ],
    more: `See the ${edition2026.year} Edition`,
  },

  committees: {
    title: 'Committees',
    intro: 'Organizers work in seven Committees, each owning one area of the event.',
    list: [
      { name: 'Core Event', text: 'the format of the day, tickets, the Code of Conduct and accessibility at the event' },
      { name: 'Session', text: 'the call for proposals and choosing the Sessions' },
      { name: 'Sponsor', text: 'Sponsorships and the prospectus' },
      { name: 'Marketing', text: 'announcements, the KCD Texas chapter and Short Links' },
      { name: 'Venue', text: 'the venue and getting there' },
      { name: 'Volunteer', text: 'the Volunteers who help run Event Day' },
      { name: 'Finance', text: 'the event’s money: tickets and sponsorship' },
    ],
  },

  organizers: {
    title: 'Organizers',
    soon: `The ${e.year} Organizers, with their employers, are listed here soon.`,
  },
  // The 2027 Organizer roster. Empty until the roster form comes back with each person's consent (A28);
  // while empty, the page shows the "soon" line above.
  organizers2027: [] as { name: string; employer: string; role: string }[],

  involved: {
    title: 'Get involved',
    chapter: 'Join the KCD Texas chapter',
    chapterNote: 'on the CNCF community site to hear about each Edition first.',
    community: 'Come to a Cloud Native Texas meetup',
    communityNote: 'in Austin, Dallas or Houston.',
    help: 'Want to volunteer on Event Day or help organize? Email',
  },
};
