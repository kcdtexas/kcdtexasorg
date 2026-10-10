// The test history: what test builds add to src/data/history/, so the About page, the walls and a Speaker page
// show credits. --program-sample reads it for the Organizers and the Speakers, --sponsors-sample for the sponsors,
// and the pages then say "Sample". A normal build never reads it, and the 2026 page never does.
import type { EditionHistory } from '../lib/credits';
import { fixtureEarlierSpeakers } from './program-fixture';
import { sampleSponsors2027 } from './sponsors-2027';

/** Test builds start each kind's history here, so they need no 2024 or 2025 record. */
export const testHistoryFrom = 2026;

const source = 'https://example.com/';

export const testHistory: readonly EditionHistory[] = [
  // The fixture's made-up earlier-Edition entry: Fixture Speaker 4 spoke in 2026.
  { year: fixtureEarlierSpeakers.year, speakers: { names: [...fixtureEarlierSpeakers.names], complete: true, source } },
  // The sample tiles stand in for real 2027 Sponsorships.
  { year: 2027, sponsors: { ids: sampleSponsors2027.map((s) => s.id), complete: false, source } },
];
