// The 2026 page's words (Marketing Committee). Figures come from edition-2026.ts, the program from program-2026.ts.
import { edition2026 as e } from './edition-2026';
import { keynotes2026, speakers2026 } from './program-2026';

const recorded = speakers2026.filter((s) => s.youtube).length;

export const page2026 = {
  title: `KCD Texas ${e.year} · ${e.city} · ${e.date}`,
  description: `KCD Texas ${e.year} in ${e.city} on ${e.date}: ${e.speakers} Speakers and ${e.sponsorCount} sponsors. The full program with links to ${e.recordings} talk recordings.`,
  kicker: 'Past Edition',
  heading: `KCD Texas ${e.year}`,
  lead: `${e.city}, ${e.date}, at ${e.venue}. One day of Kubernetes and cloud native talks and workshops.`,

  facts: [
    { term: 'Speakers', text: `${e.speakers}, plus ${e.hosts} hosts` },
    { term: 'Workshops', text: String(e.workshops) },
    { term: 'Sponsors', text: String(e.sponsorCount) },
    { term: 'Recordings', text: `${e.recordings} talks` },
  ],
  factsSource: 'Source:',
  factsLink: 'CNCF transparency report, 2026',

  keynotes: {
    title: 'Keynotes',
    noRecording: 'Spoke to a full room. No recording published.',
  },

  program: {
    title: 'The program',
    intro: `${e.speakers} Speakers, ${e.firstTimeSpeakers} of them first-time Speakers, and ${e.hosts} hosts. ${keynotes2026.filter((k) => k.youtube).length + recorded} talks have a recording on YouTube. The titles come from those recordings, so a talk without one is listed by its Speaker.`,
    asPrinted: 'Names and affiliations as printed on the 2026 Event Page in May 2026.',
    recordedTitle: 'Talks with recordings',
    otherTitle: 'Also on the program',
    otherNote: 'These Sessions have no published recording.',
    hostsTitle: 'Hosts',
    watch: 'Watch on YouTube',
    allTalks: 'All 2026 talks on YouTube',
    recap: 'The 2026 recap video',
  },

  sponsors: {
    title: `The ${e.sponsorCount} sponsors of 2026`,
    addOnsLabel: 'Add-ons:',
    partnersTitle: 'Partners',
  },

  organizers: {
    title: 'The 2026 Organizers',
    asPrinted: 'Names, companies and titles as printed on the 2026 Event Page.',
  },

  lookBack: {
    title: 'Look back',
    links: [
      { text: 'Photos from the day', note: 'photos.kcdtexas.org', href: e.photosUrl },
      { text: 'The KCD Texas 2026 transparency report', note: 'CNCF', href: e.reportUrl },
      { text: 'The 2026 Event Page', note: 'community.cncf.io', href: e.eventPageUrl },
    ],
  },
} as const;
