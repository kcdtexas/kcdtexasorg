// The 2025 page's words (Marketing Committee). Figures come from edition-2025.ts, the program from program-2025.ts.
import { edition2025 as e } from './edition-2025';
import { hosts2025, sessions2025, sources2025 } from './program-2025';
import { splitProgram, type PastPage } from './past-page';

const { recorded, others } = splitProgram(sessions2025);
const rooms = [...new Set(sessions2025.map((s) => s.room))];
// The photos are from the 2025 photographer's set, a web-size export (1,024 px wide when landscape), chosen by the
// owner on 2026-11-08. Each file keeps the set's number (KCD2025-103 is 2025-103); the times are the camera's.
// Each section with these photos credits the photographer, in one piece: no-break spaces keep a narrow screen from
// splitting the credit across two lines.
const photographer = 'Redford Lindsey';
const credit = (label: 'Photo' | 'Photos') => `${label}: ${photographer}.`.replace(/ /g, '\u00a0');

export const page2025: PastPage = {
  year: e.year,
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

  day: {
    title: `A day at KCD Texas ${e.year}`,
    photos: [
      { id: '2025-103', time: '10:36 a.m.', caption: 'A full main hall for the keynotes.', alt: 'The main hall from the back during a keynote: rows of attendees, and the slide on both big screens.' },
      { id: '2025-230', time: '3:00 p.m.', caption: 'The hallway track between sessions.', alt: 'Three attendees talk behind an open laptop: one with a hand on his chin, one in a cap with a paper bag on his arm.' },
      { id: '2025-324', time: '5:15 p.m.', caption: 'A prize from the closing raffle.', alt: 'A smiling raffle winner holds a LEGO box and a round shield with the Kubernetes logo.' },
    ],
    credit: credit('Photos'),
    // The files are 1,024 px wide: half and full size.
    widths: [512, 1024],
  },

  keynotes: {
    title: 'Keynotes',
    sessions: sessions2025.filter((s) => s.format === 'keynote'),
    noRecording: 'No recording published.',
    // Each keynote's Speaker on stage (photos 48, 78 and 105, the owner confirmed who is who), cropped 4:5 to the scale
    // of 2026's keynote photos.
    photos: {
      'Chris Aniszczyk': { file: 'aniszczyk-2025', alt: 'Chris Aniszczyk speaks into a microphone on stage at KCD Texas 2025, in a light shirt with a blue print.' },
      'Andrew Martin': { file: 'martin-2025', alt: 'Andrew Martin smiles on stage at KCD Texas 2025, a microphone in one hand and the other raised to his blue cap.' },
      'Ricardo Rocha': { file: 'rocha-2025', alt: 'Ricardo Rocha speaks at the podium at KCD Texas 2025, gesturing with both hands, in a dark t-shirt.' },
    },
    photoCredit: credit('Photos'),
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
    note: 'Sponsors shown by name had no logo file we could use.',
    source: { text: 'The 2025 Event Page', href: e.sponsorsSource },
    partnersTitle: 'Partners',
    partnerGroups: e.partnerGroups,
  },

  organizers: {
    title: 'The 2025 Organizers',
    names: e.organizers.names,
    photos: e.organizers.photos,
    note: 'The team as listed on the KCD Texas 2025 application to CNCF in October 2024.',
    source: { text: 'The application on GitHub', href: e.organizers.source },
    group: {
      file: '2025-261',
      alt: 'About 20 people in matching teal KCD shirts pose in front of the Austin 2025 backdrop, the front row kneeling.',
      caption: `The ${e.year} Organizers and volunteers.`,
      credit: credit('Photo'),
    },
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
