// The loyalty credits: "Sponsor since", "Organizer since" and "Speaker since". One registry holds
// every Edition's history, one file per Edition in src/data/history/, each checked when the build loads it. Every
// year comes from those records, never typed by hand, and one Edition alone gets no credit. A name matches across
// Editions exactly (ignoring case, accents and spacing) or through the confirmed lists in src/data/returning-*.ts.
//
// A kind's credits print only when every earlier Edition from where its history starts has a complete record of
// that kind (src/lib/credits.ts), so a missing year can never print a wrong "since". A person listed on any earlier
// record, complete or not, gets a credit only when every record from that first year on is complete. Test builds
// add the test history (src/data/history-test.ts) and start every kind's history there; their Organizer credits
// come from the test history alone, so only its made-up Organizer shows one.
//
// Each credit is as of one Edition: on an Edition's page it counts only that Edition's records and the earlier ones,
// so a first year shows none there. A past Edition's credits always read the Editions' own records, in test builds
// too, so its page never changes with the test data.
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
 * credits print. Each kind starts at the first Edition (null) unless a year is set here.
 */
export const historyFrom: Record<Kind, number | null> = { organizers: null, speakers: null, sponsors: null };

// Test builds: the test history, from testHistoryFrom, for the kinds their flag covers.
const tested: Record<Kind, boolean> = { organizers: programDataSample, speakers: programDataSample, sponsors: sponsorsSample };
const records = Object.fromEntries(KINDS.map((kind) => [kind, recordsFor(kind, history, tested[kind] ? testHistory : null)])) as Record<Kind, readonly EditionHistory[]>;
const ruleFor = (kind: Kind, current: number) => ({
  editions: editionYears,
  current,
  from: tested[kind] && current === edition2027.year ? testHistoryFrom : historyFrom[kind] ?? firstEdition,
});
/** The records a credit for `edition` reads: a past Edition's are the Editions' own, in every build. */
const recordsAt = (kind: Kind, edition: number) => (edition < edition2027.year ? history : records[kind]);

/** A person's names: the one given and, when a confirmed list holds them under any of their names, all the others. */
const namesOf = (list: readonly { name: string; earlier: readonly string[] }[], name: string) => {
  const same = list.find((r) => [r.name, ...r.earlier].some((n) => norm(n) === norm(name)));
  return same ? [name, same.name, ...same.earlier] : [name];
};

/** "Speaker since": a Speaker in `edition` who also spoke in an earlier Edition. */
export function speakerCredit(name: string, edition: number = edition2027.year): Credit | null {
  const names = namesOf(returningSpeakers, name);
  return creditFor(recordsAt('speakers', edition), 'speakers', names, ruleFor('speakers', edition));
}

/** "Sponsor since": a sponsor of `edition` that also backed an earlier one. */
export function sponsorCredit(id: string, edition: number = edition2027.year): Credit | null {
  return creditFor(recordsAt('sponsors', edition), 'sponsors', [id], ruleFor('sponsors', edition));
}

/** "Organizer since": an Organizer of `edition` who also organized an earlier one, unless their credit is held. */
export function organizerCredit(name: string, edition: number = edition2027.year): Credit | null {
  const names = namesOf(returningOrganizers, name);
  if (heldOrganizers.some((h) => names.some((n) => norm(n) === norm(h.name)))) return null;
  return creditFor(recordsAt('organizers', edition), 'organizers', names, ruleFor('organizers', edition));
}

/** True when this build's Organizer credits come from the test history: the About page then adds its made-up
 *  Organizer (src/data/history-test.ts) and says "Sample". */
export const organizerCreditsSample = tested.organizers;
