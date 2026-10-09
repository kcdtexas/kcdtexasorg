// The 2027 sponsors, as the Sponsor Committee announces them (owner-actions A64). Empty until the first one
// signs; while it is empty, every wall shows the 2026 sponsors as before. Pushing = announcing (ADR 0009):
// add a sponsor only once the Organizers have announced it.
import { sponsorsSample } from './edition-2027';

export type Tier2027 = 'platinum' | 'gold' | 'silver';

export interface Sponsor2027 {
  name: string;
  tier: Tier2027;
  /** The logo's file name in src/assets/logos/, without ".svg"; null shows the name as a text tile. */
  logo: string | null;
  /** The sponsor's site. */
  link: string;
  /** The logo's alt text: the sponsor's name as it writes it. */
  alt: string;
}

const announced: Sponsor2027[] = [];

// build.sh --sponsors-sample: plain text tiles, one row per tier, to see the 2027 wall in tests and design reviews.
// No logos and no company names, real or made up; check-dist blocks "Sample" in any other build.
const sample = (tier: Tier2027, name: string, n: number): Sponsor2027[] =>
  Array.from({ length: n }, () => ({ name: `Sample ${name} sponsor`, tier, logo: null, link: '', alt: '' }));

export const sponsors2027: Sponsor2027[] = sponsorsSample
  ? [...sample('platinum', 'Platinum', 2), ...sample('gold', 'Gold', 4), ...sample('silver', 'Silver', 3)]
  : announced;
