// The test history: what test builds add to src/data/history/, so the About page, the walls and a Speaker page
// show credits. --program-sample reads it for the Organizers and the Speakers, --sponsors-sample for the sponsors,
// and the pages then say "Sample". The Organizers' credits then read it alone (src/lib/credits.ts), so only the
// made-up Organizer below shows one. A normal build never reads it, and the 2026 page never does.
import type { EditionHistory } from '../lib/credits';
import { fixtureEarlierSpeakers } from './program-fixture';
import { sampleSponsors2027 } from './sponsors-2027';

/** Test builds start each kind's history here, so they need no 2024 or 2025 record. */
export const testHistoryFrom = 2026;

const source = 'https://example.com/';

/** The made-up Organizer that --program-sample builds add to About's list, with initials and no photo. */
export const fixtureOrganizer = { name: 'Fixture Organizer', employer: 'Fixture Company', title: '' };
const organizers = { names: [fixtureOrganizer.name], complete: true, source };

export const testHistory: readonly EditionHistory[] = [
  // The made-up Organizer organized 2025, 2026 and 2027: About shows "3rd year".
  { year: 2025, organizers },
  // The fixture's made-up earlier-Edition entry: Fixture Speaker 4 spoke in 2026.
  { year: fixtureEarlierSpeakers.year, organizers, speakers: { names: [...fixtureEarlierSpeakers.names], complete: true, source } },
  // The sample tiles stand in for real 2027 Sponsorships.
  { year: 2027, organizers, sponsors: { ids: sampleSponsors2027.map((s) => s.id), complete: false, source } },
];
