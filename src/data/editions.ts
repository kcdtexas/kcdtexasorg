// The Editions page (Marketing Committee). Every line names its public source.
// Figures come from the Edition files; the footer's short list stays in edition-2026.ts (pastEditions).
import { edition2026 } from './edition-2026';
import { currentEdition } from './site';
import { paths } from './nav';

const e = edition2026;

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
      source: { text: 'CNCF transparency report, 2026', href: e.reportUrl },
    },
    {
      year: 2025,
      title: 'KCD Texas 2025',
      place: `${e.city}, at the Austin Central Library. The first independent KCD Texas.`,
      facts: [
        '29 Speakers on 3 stages',
        `${e.proposals2025} proposals submitted`,
        'Keynotes by Chris Aniszczyk (CNCF) and Ricardo Rocha (CERN)',
      ],
      link: null,
      source: { text: 'CNCF transparency report, 2025', href: e.report2025Url },
    },
    {
      year: 2024,
      title: 'KCD Texas 2024',
      place: `${e.city}, co-located with Texas Linux Fest.`,
      facts: [],
      link: null,
      source: { text: 'CNCF transparency report, 2026', href: e.reportUrl },
    },
  ],

  canceled: 'The 2023 Edition was canceled.',
} as const;
