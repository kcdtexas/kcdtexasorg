// The loyalty credits: "Sponsor since", "Organizer since" and "Speaker since" (plan-release-6). One registry holds
// every Edition's history, one file per Edition in src/data/history/, each checked when the build loads it. Every
// year comes from those records, never typed by hand, and one Edition alone gets no credit. A name matches across
// Editions exactly (ignoring case, accents and spacing) or through the confirmed lists in src/data/returning-*.ts.
//
// A kind's credits print only when every earlier Edition from where its history starts has a complete record of
// that kind (src/lib/credits.ts), so a missing year can never print a wrong "since". A person listed on any earlier
// record, complete or not, gets a credit only when every record from that first year on is complete. Test builds
// add the test history (src/data/history-test.ts) and start every kind's history there; their Organizer credits
// come from the test history alone, so only its made-up Organizer shows one.
import { editions } from '../data/editions';
import { edition2027, programDataSample, sponsorsSample } from '../data/edition-2027';
import { testHistory, testHistoryFrom } from '../data/history-test';
import { heldOrganizers, returningOrganizers } from '../data/returning-organizers';
import { returningSpeakers } from '../data/returning-speakers';
import { creditFor, KINDS, norm, recordsFor, validateHistory, type Credit, type EditionHistory, type Kind } from './credits';

export { norm, type Credit };

/** Every Edition's year: the past ones and the current one. */
const editionYears = [...editions.past.map((p) => p.year), edition2027.year];
const firstEdition = Math.min(...editionYears);

// The registry: every file in src/data/history/, so a new Edition's file joins with no code change.
const files = import.meta.glob<{ default: unknown }>('../data/history/*.ts', { eager: true });
export const history: readonly EditionHistory[] = Object.entries(files)
  .map(([file, mod]) => validateHistory(`src/data/history/${file.split('/').pop()}`, mod.default, editionYears))
  .sort((a, b) => a.year - b.year);

/**
 * Where each kind's history starts: every Edition from this year on needs a complete record before that kind's
 * credits print. The Organizers' starts in 2025, as the 2024 team isn't public; a name on an incomplete 2024 record
 * still holds that person's credit back. The Speakers' and the sponsors' start at the first Edition (null) until a
 * year is set here.
 */
export const historyFrom: Record<Kind, number | null> = { organizers: 2025, speakers: null, sponsors: null };

// Test builds: the test history, from testHistoryFrom, for the kinds their flag covers.
const tested: Record<Kind, boolean> = { organizers: programDataSample, speakers: programDataSample, sponsors: sponsorsSample };
const records = Object.fromEntries(KINDS.map((kind) => [kind, recordsFor(kind, history, tested[kind] ? testHistory : null)])) as Record<Kind, readonly EditionHistory[]>;
const ruleFor = (kind: Kind, current: number) => ({
  editions: editionYears,
  current,
  from: tested[kind] ? testHistoryFrom : historyFrom[kind] ?? firstEdition,
});

/** "Speaker since": a Speaker in `edition` who also spoke in an earlier Edition. */
export function speakerCredit(name: string, edition: number = edition2027.year): Credit | null {
  const names = [name, ...(returningSpeakers.find((r) => norm(r.name) === norm(name))?.earlier ?? [])];
  return creditFor(records.speakers, 'speakers', names, ruleFor('speakers', edition));
}

/** "Sponsor since": a sponsor of this Edition that also backed an earlier one. */
export function sponsorCredit(id: string): Credit | null {
  return creditFor(records.sponsors, 'sponsors', [id], ruleFor('sponsors', edition2027.year));
}

/** "Organizer since": a 2027 Organizer who also organized an earlier Edition, unless their credit is held. */
export function organizerCredit(name: string): Credit | null {
  if (heldOrganizers.some((h) => norm(h.name) === norm(name))) return null;
  const names = [name, ...(returningOrganizers.find((r) => norm(r.name) === norm(name))?.earlier ?? [])];
  return creditFor(records.organizers, 'organizers', names, ruleFor('organizers', edition2027.year));
}

/** True when this build's Organizer credits come from the test history: the About page then adds its made-up
 *  Organizer (src/data/history-test.ts) and says "Sample". */
export const organizerCreditsSample = tested.organizers;
