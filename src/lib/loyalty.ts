// The loyalty credits: "Sponsor since", "Organizer since" and "Speaker since" (plan-release-6). Each year comes from
// the per-Edition records, never typed by hand, and one Edition alone gets no credit. A name matches across Editions
// exactly (ignoring case, accents and spacing) or through the confirmed lists in src/data/returning-*.ts.
import { about } from '../data/about';
import { edition2026 } from '../data/edition-2026';
import { edition2027, programDataSample, sponsorsSample } from '../data/edition-2027';
import { keynotes2026, speakers2026 } from '../data/program-2026';
import { fixtureEarlierSpeakers } from '../data/program-fixture';
import { returningOrganizers } from '../data/returning-organizers';
import { returningSpeakers } from '../data/returning-speakers';
import { sponsors2027 } from '../data/sponsors-2027';

// The credits show only in test builds (--sponsors-sample on the walls, --program-sample on
// About and the program pages), which label them "Sample".
export const sponsorCreditsShown = sponsorsSample;
export const peopleCreditsShown = programDataSample;

export interface Credit {
  /** The first Edition. */
  since: number;
  /** How many Editions, this one included. */
  editions: number;
}

/** A name for matching: no accents, apostrophes or extra spaces, lower case ("Peter ONeill" is "Peter O’Neill"). */
export const norm = (name: string) =>
  name.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/[’‘']/g, '').replace(/\s+/g, ' ').trim().toLowerCase();

function credit(years: number[]): Credit | null {
  const set = [...new Set(years)].sort();
  return set.length >= 2 ? { since: set[0], editions: set.length } : null;
}

// Who spoke in each earlier Edition, from its public program. Hosts count only if they spoke, so the 2026 hosts
// are left out. 2025 joins once a public source exists. A --program-sample build adds the fixture's made-up entry.
const speakersByEdition: { year: number; names: Set<string> }[] = [
  { year: 2026, names: new Set([...keynotes2026, ...speakers2026, ...(programDataSample && fixtureEarlierSpeakers.year === 2026 ? fixtureEarlierSpeakers.names.map((name) => ({ name })) : [])].map((e) => norm(e.name))) },
];

/** "Speaker since": a Speaker in `edition` who also spoke in an earlier Edition. */
export function speakerCredit(name: string, edition: number = edition2027.year): Credit | null {
  const names = new Set([norm(name), ...(returningSpeakers.find((r) => norm(r.name) === norm(name))?.earlier ?? []).map(norm)]);
  const years = speakersByEdition.filter((e) => e.year < edition && [...names].some((n) => e.names.has(n))).map((e) => e.year);
  return years.length ? credit([...years, edition]) : null;
}

// Each Edition's sponsors by their stable id (the logo's file name).
const sponsorsByEdition: { year: number; ids: Set<string> }[] = [
  { year: 2026, ids: new Set([...edition2026.sponsors.platinum, ...edition2026.sponsors.gold, ...edition2026.sponsors.silver].map((s) => s.id)) },
  { year: 2027, ids: new Set(sponsors2027.map((s) => s.id)) },
];

/** "Sponsor since": a sponsor in two or more Editions. */
export function sponsorCredit(id: string): Credit | null {
  return credit(sponsorsByEdition.filter((e) => e.ids.has(id)).map((e) => e.year));
}

// Each Edition's Organizers, as publicly listed with their consent.
const organizersByEdition: { year: number; names: Set<string> }[] = [
  { year: 2026, names: new Set(edition2026.organizers.map((o) => norm(o.name))) },
  { year: 2027, names: new Set(about.organizers2027.map((o) => norm(o.name))) },
];

/** "Organizer since": a 2027 Organizer who also organized an earlier Edition. */
export function organizerCredit(name: string): Credit | null {
  const names = [norm(name), ...(returningOrganizers.find((r) => norm(r.name) === norm(name))?.earlier ?? []).map(norm)];
  return credit(organizersByEdition.filter((e) => names.some((n) => e.names.has(n))).map((e) => e.year));
}

/** "2nd year", "3rd year". */
export const nthYear = (n: number) => `${n}${n % 10 === 1 && n % 100 !== 11 ? 'st' : n % 10 === 2 && n % 100 !== 12 ? 'nd' : n % 10 === 3 && n % 100 !== 13 ? 'rd' : 'th'} year`;
