// The 2024 page's words (Marketing Committee). Figures come from edition-2024.ts, the program from program-2024.ts.
import { edition2024 as e } from './edition-2024';
import { hosts2024, sessions2024, sources2024 } from './program-2024';
import { splitProgram, type PastPage } from './past-page';

const { recorded, others } = splitProgram(sessions2024);

export const page2024: PastPage = {
  year: e.year,
  title: `KCD Texas ${e.year} · ${e.city} · ${e.date}`,
  description: `KCD Texas ${e.year} in ${e.city} on ${e.date}, co-located with ${e.coLocated.name}: ${e.speakers} Speakers on ${e.tracks} tracks. The full KCD Texas program.`,
  kicker: 'Past Edition',
  heading: `KCD Texas ${e.year}`,
  lead: `${e.city}, ${e.date}, co-located with ${e.coLocated.name}. KCD Texas ran ${e.tracks} tracks of talks and workshops on the festival’s first day.`,

  facts: [
    { term: 'Speakers', text: String(e.speakers) },
    { term: 'Tracks', text: String(e.tracks) },
    { term: 'Keynotes', text: String(e.keynotes) },
    { term: 'Recordings', text: e.recordings === 1 ? '1 keynote' : `${e.recordings} Sessions` },
  ],
  factsSources: [
    { text: 'the KCD Texas 2024 Schedule', href: e.scheduleUrl },
    { text: 'Texas Linux Fest’s KCD Texas page', href: e.tlfKcdUrl },
    { text: 'the 2024 playlist on YouTube', href: e.talksUrl },
  ],

  keynotes: {
    title: 'Keynotes',
    sessions: sessions2024.filter((s) => s.format === 'keynote'),
    noRecording: 'No recording published.',
  },

  program: {
    title: 'The program',
    intro: `${e.speakers} Speakers in ${sessions2024.length} Sessions across ${e.tracks} rooms: talks, ${e.workshops} workshops and lightning talks, with open-space discussions in the afternoon.`,
    recordedTitle: 'Talks with recordings',
    recorded,
    otherTitle: 'Talks and workshops',
    otherNote: 'These Sessions have no published recording.',
    others,
    hostsTitle: 'Hosts',
    hosts: hosts2024,
    asPrinted: 'Titles, names and affiliations as printed on the KCD Texas 2024 Schedule. A person who is also in the 2026 program or team is listed under the name this site uses for 2026.',
    sources: [
      { text: 'The KCD Texas 2024 Schedule', href: sources2024.schedule },
      { text: 'The 2024 Event Page', href: sources2024.eventPage },
    ],
    watch: 'Watch on YouTube',
    more: [
      { text: 'The 2024 playlist on YouTube', href: e.talksUrl },
    ],
  },

  sponsors: {
    title: 'The sponsors of 2024',
    tiers: e.tiers,
    note: `Sponsors shown by name had no logo file we could use. ${e.coLocated.name}’s own sponsor page lists more companies whose packages included KCD Texas.`,
    source: { text: 'The 2024 Event Page', href: e.sponsorsSource },
    logoCredits: [
      {
        title: 'Rocky Linux logo',
        author: 'the Rocky Linux project',
        source: { text: 'rocky-linux/branding on GitHub', href: 'https://github.com/rocky-linux/branding/blob/main/logo/src/logo-primary_black.svg' },
        license: { text: 'CC BY-SA 4.0', href: 'https://creativecommons.org/licenses/by-sa/4.0/' },
      },
    ],
    partnersTitle: 'Partners',
    partnerGroups: e.partnerGroups,
  },

  organizers: {
    title: 'The 2024 Organizers',
    names: e.organizers.names,
    note: 'The team as listed on the KCD Texas application to CNCF, opened in February 2023. The 2023 Edition was canceled, and the team may have changed by April 2024.',
    source: { text: 'The application on GitHub', href: e.organizers.source },
  },

  lookBack: {
    title: 'Look back',
    links: [
      { text: 'The 2024 Event Page', note: 'community.cncf.io', href: e.eventPageUrl },
      { text: 'KCD Texas at Texas Linux Fest 2024', note: '2024.texaslinuxfest.org', href: e.tlfKcdUrl },
      { text: 'The KCD Texas 2024 Schedule', note: 'Sessionize', href: e.scheduleUrl },
    ],
  },
};
