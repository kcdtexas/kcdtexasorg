// The 2025 page's words (Marketing Committee). Figures come from edition-2025.ts, the program from program-2025.ts.
import { edition2025 as e } from './edition-2025';
import { hosts2025, sessions2025, sources2025 } from './program-2025';
import { splitProgram, type PastPage } from './past-page';

const { recorded, others } = splitProgram(sessions2025);
const rooms = [...new Set(sessions2025.map((s) => s.room))];

export const page2025: PastPage = {
  title: `KCD Texas ${e.year} · ${e.city} · ${e.date}`,
  description: `KCD Texas ${e.year} at the ${e.venue} on ${e.date}: ${e.speakers} Speakers on ${e.stages} stages. The full program with links to ${e.recordings} recordings.`,
  kicker: 'Past Edition',
  heading: `KCD Texas ${e.year}`,
  lead: `${e.city}, ${e.date}, at the ${e.venue}. The first independent KCD Texas: one day of Kubernetes and cloud native talks and workshops on ${e.stages} stages.`,

  facts: [
    { term: 'Speakers', text: String(e.speakers) },
    { term: 'Stages', text: String(e.stages) },
    { term: 'Proposals', text: e.proposals },
    { term: 'Recordings', text: `${e.recordings} Sessions` },
  ],
  factsSources: [
    { text: 'CNCF transparency report, 2025', href: e.reportUrl },
    { text: 'the 2025 playlist on YouTube', href: e.talksUrl },
  ],

  keynotes: {
    title: 'Keynotes',
    sessions: sessions2025.filter((s) => s.format === 'keynote'),
    noRecording: 'No recording published.',
  },

  program: {
    title: 'The program',
    intro: `${e.speakers} Speakers in ${sessions2025.length} Sessions, ${e.workshops} of them workshops, on ${e.stages} stages: ${rooms.join(', ').replace(/, ([^,]*)$/, ' and $1')}. ${e.recordings} Sessions have a recording on YouTube.`,
    recordedTitle: 'Talks with recordings',
    recorded,
    otherTitle: 'Also on the program',
    otherNote: 'These Sessions have no published recording.',
    others,
    hostsTitle: 'Hosts',
    hosts: hosts2025,
    asPrinted: 'Titles, times and stages from the 2025 Schedule. Names and affiliations as printed on the 2025 Event Page in May 2025.',
    sources: [
      { text: 'The 2025 Schedule', href: sources2025.schedule },
      { text: 'The 2025 Event Page', href: sources2025.eventPage },
    ],
    watch: 'Watch on YouTube',
    more: [
      { text: 'All 2025 talks on YouTube', href: e.talksUrl },
      { text: 'The 2025 recap video', href: e.recapUrl },
    ],
  },

  sponsors: {
    title: 'The sponsors of 2025',
    tiers: e.tiers,
    note: 'A sponsor shown by name had no logo file we could use.',
    source: { text: 'The 2025 Event Page', href: e.sponsorsSource },
    partnersTitle: 'Partners',
    partnerGroups: e.partnerGroups,
  },

  organizers: {
    title: 'The 2025 Organizers',
    names: e.organizers.names,
    note: 'The team as listed on the KCD Texas 2025 application to CNCF in October 2024.',
    source: { text: 'The application on GitHub', href: e.organizers.source },
  },

  lookBack: {
    title: 'Look back',
    links: [
      { text: 'The KCD Texas 2025 transparency report', note: 'CNCF', href: e.reportUrl },
      { text: 'The 2025 Event Page', note: 'community.cncf.io', href: e.eventPageUrl },
      { text: 'The 2025 Schedule', note: 'Sessionize', href: e.scheduleUrl },
    ],
  },
};
