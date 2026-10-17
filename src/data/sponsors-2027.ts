// The 2027 sponsors, as the Sponsor Committee announces them (owner-actions A64). Empty until the first one
// signs; while it is empty, every wall shows the 2026 sponsors as before. Pushing = announcing (ADR 0009):
// add a sponsor only once the Organizers have announced it.
import { sponsorsSample } from './edition-2027';

export type Tier2027 = 'platinum' | 'gold' | 'silver';

export interface Sponsor2027 {
  /** The Sponsor's stable id across Editions: its logo's file name, as in edition-2026.ts (src/lib/loyalty.ts). */
  id: string;
  name: string;
  tier: Tier2027;
  /** The logo's file name in src/assets/logos/, without ".svg"; null shows the name as a text tile. */
  logo: string | null;
  /** The sponsor's site. */
  link: string;
  /** The logo's alt text: the sponsor's name as it writes it. */
  alt: string;
  /** A sample tile (--sponsors-sample): its name is its "Sample" label. */
  sample?: boolean;
}

/** The announced 2027 Sponsorships: the real ones only, never the sample tiles. */
export const announcedSponsors2027: Sponsor2027[] = [];

// build.sh --sponsors-sample: plain text tiles, one row per tier, to see the 2027 wall in tests and design reviews.
// No logos and no company names, real or made up; check-dist blocks "Sample" in any other build. The first tile of
// each tier returns from 2026 (it takes a 2026 sponsor's id, never its name or logo), to show the "2nd year" credit.
const sample = (tier: Tier2027, name: string, n: number, returning: string): Sponsor2027[] =>
  Array.from({ length: n }, (_, i) => ({ id: i === 0 ? returning : `sample-${tier}-${i + 1}`, name: `Sample ${name} sponsor`, tier, logo: null, link: '', alt: '', sample: true }));

/** The sample tiles, which only --sponsors-sample builds show (and src/data/history-test.ts credits). */
export const sampleSponsors2027: Sponsor2027[] = [...sample('platinum', 'Platinum', 2, 'solo'), ...sample('gold', 'Gold', 4, 'grafana'), ...sample('silver', 'Silver', 3, 'isovalent')];

export const sponsors2027: Sponsor2027[] = sponsorsSample ? sampleSponsors2027 : announcedSponsors2027;
