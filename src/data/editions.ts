// The Editions page (Marketing Committee). Every line names its public source.
// Figures come from the Edition files; the footer's short list stays in edition-2026.ts (pastEditions).
import { edition2026 } from './edition-2026';
import { edition2025 } from './edition-2025';
import { edition2024 } from './edition-2024';
import { sessions2025 } from './program-2025';
import { currentEdition } from './site';
import { paths } from './nav';

const e = edition2026;
const keynotes2025 = sessions2025.filter((s) => s.format === 'keynote').map((s) => s.speakers[0].name);

export const editions = {
  title: 'Editions',
  description: 'Every KCD Texas Edition: Dallas in 2027, and Austin in 2026, 2025 and 2024, with the figures from CNCF’s transparency reports.',
  kicker: 'KCD Texas since 2024',
  lead: `KCD Texas has run in ${edition2026.city} every year since 2024. The ${currentEdition.year} Edition moves to ${currentEdition.city}.`,

  current: {
    label: 'Current Edition',
    year: currentEdition.year,
    title: `KCD Texas ${currentEdition.year}`,
    line: `${currentEdition.city}, ${currentEdition.when}.`,
    link: { text: `Dates, the call for proposals and Sponsorships for ${currentEdition.year}`, href: paths.home },
  },

  past: [
    {
      year: 2026,
      title: 'KCD Texas 2026',
      place: `${e.city}, ${e.date}, at ${e.venue}`,
      facts: [
        `${e.speakers} Speakers and ${e.hosts} hosts`,
        `${e.sponsorCount} sponsors`,
        `${e.recordings} talk recordings`,
      ],
      link: { text: 'The 2026 program, sponsors and recordings', href: paths.edition2026 },
      sources: [{ text: 'CNCF transparency report, 2026', href: e.reportUrl }],
    },
    {
      year: 2025,
      title: 'KCD Texas 2025',
      place: `${edition2025.city}, at the ${edition2025.venue}. The first independent KCD Texas.`,
      facts: [
        `${edition2025.speakers} Speakers on ${edition2025.stages} stages`,
        `${edition2025.proposals} proposals submitted`,
        `Keynotes by ${keynotes2025.join(', ').replace(/, ([^,]*)$/, ' and $1')}`,
      ],
      link: { text: 'The 2025 program, sponsors and recordings', href: paths.edition2025 },
      sources: [{ text: 'CNCF transparency report, 2025', href: edition2025.reportUrl }],
    },
    {
      year: 2024,
      title: 'KCD Texas 2024',
      place: `${edition2024.city}, co-located with ${edition2024.coLocated.name}.`,
      facts: [
        `${edition2024.speakers} Speakers on ${edition2024.tracks} tracks`,
      ],
      link: { text: 'The 2024 program and sponsors', href: paths.edition2024 },
      sources: [
        { text: 'CNCF transparency report, 2025', href: edition2024.report2025Url },
        { text: 'the KCD Texas 2024 Schedule', href: edition2024.scheduleUrl },
      ],
    },
  ],

  canceled: 'The 2023 Edition was canceled.',
} as const;
