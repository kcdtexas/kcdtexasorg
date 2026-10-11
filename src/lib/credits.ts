// The loyalty credits' rules, with no imports, so tests/credits.mjs can run them on made-up histories.
// src/lib/loyalty.ts feeds them the Edition records from src/data/history/.

export const KINDS = ['organizers', 'speakers', 'sponsors'] as const;
export type Kind = (typeof KINDS)[number];

/** One kind's public record for an Edition: who took part, whether the source lists everyone, and where it is. */
export interface PeopleRecord { names: readonly string[]; complete: boolean; source: string }
export interface SponsorRecord { ids: readonly string[]; complete: boolean; source: string }

/** An Edition's history file (src/data/history/<year>.ts). A kind with no public record is left out. */
export interface EditionHistory {
  year: number;
  organizers?: PeopleRecord;
  speakers?: PeopleRecord;
  sponsors?: SponsorRecord;
}

export interface Credit {
  /** The first Edition. */
  since: number;
  /** How many Editions, this one included. */
  editions: number;
}

/** A name for matching: no accents, apostrophes or extra spaces, lower case ("Peter ONeill" is "Peter O’Neill"). */
export const norm = (name: string) =>
  name.normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/[’‘']/g, '').replace(/\s+/g, ' ').trim().toLowerCase();

const keysOf = (kind: Kind, record: PeopleRecord | SponsorRecord): string[] =>
  kind === 'sponsors' ? [...(record as SponsorRecord).ids] : (record as PeopleRecord).names.map(norm);

/**
 * Checks one history file's default export and returns it typed. A bad shape throws with the file's name.
 * `editions` lists every Edition's year (a canceled one isn't an Edition).
 */
export function validateHistory(file: string, value: unknown, editions: readonly number[]): EditionHistory {
  const fail = (problem: string): never => { throw new Error(`${file}: ${problem}`); };
  if (!value || typeof value !== 'object' || Array.isArray(value)) fail('the default export must be an object');
  const v = value as Record<string, unknown>;
  for (const key of Object.keys(v)) if (key !== 'year' && !(KINDS as readonly string[]).includes(key)) fail(`unknown field "${key}"`);
  if (!Number.isInteger(v.year)) fail('"year" must be a whole number');
  const stem = file.split('/').pop()!.replace(/\.ts$/, '');
  if (String(v.year) !== stem) fail(`"year" is ${v.year}, but the file is named ${stem}`);
  if (!editions.includes(v.year as number)) fail(`${v.year} is not a KCD Texas Edition (${editions.join(', ')})`);
  for (const kind of KINDS) {
    const r = v[kind];
    if (r === undefined) continue;
    if (!r || typeof r !== 'object' || Array.isArray(r)) fail(`"${kind}" must be an object`);
    const rec = r as Record<string, unknown>;
    const list = kind === 'sponsors' ? 'ids' : 'names';
    for (const key of Object.keys(rec)) if (key !== list && key !== 'complete' && key !== 'source') fail(`"${kind}" has an unknown field "${key}"`);
    const items = rec[list];
    if (!Array.isArray(items) || items.some((x) => typeof x !== 'string' || !x.trim())) fail(`"${kind}.${list}" must be a list of non-empty strings`);
    if (kind === 'sponsors' && (items as string[]).some((id) => !/^[a-z0-9-]+$/.test(id))) fail('"sponsors.ids" must be logo file names, such as "grafana"');
    if (typeof rec.complete !== 'boolean') fail(`"${kind}.complete" must be true or false`);
    // A public page a reader can open, never an API address.
    if (typeof rec.source !== 'string' || !/^https:\/\/[^\s/]+\/\S*$/.test(rec.source) || /(?:^https:\/\/api\.|\/api\/)/i.test(rec.source)) {
      fail(`"${kind}.source" must be a public https page, not an API address`);
    }
  }
  return v as unknown as EditionHistory;
}

/** Adds `extra` records to `base`, joining the lists of an Edition's kind; a joined record is complete only if both are. */
export function mergeHistory(base: readonly EditionHistory[], extra: readonly EditionHistory[]): EditionHistory[] {
  const byYear = new Map(base.map((h) => [h.year, { ...h }]));
  for (const e of extra) {
    const h = byYear.get(e.year) ?? { year: e.year };
    for (const kind of KINDS) {
      const add = e[kind] as (PeopleRecord & SponsorRecord) | undefined;
      if (!add) continue;
      const has = h[kind] as (PeopleRecord & SponsorRecord) | undefined;
      const list = kind === 'sponsors' ? 'ids' : 'names';
      (h as Record<string, unknown>)[kind] = has
        ? { [list]: [...has[list], ...add[list]], complete: has.complete && add.complete, source: has.source }
        : add;
    }
    byYear.set(e.year, h);
  }
  return [...byYear.values()].sort((a, b) => a.year - b.year);
}

/**
 * The records a kind's credits read: the Editions' own, or in a test build (`test`, the test history) the two joined.
 * The Organizers' credits in a test build read the test history alone: it starts in 2026, so a real Organizer who
 * also organized an earlier Edition would show a wrong "since".
 */
export function recordsFor(kind: Kind, history: readonly EditionHistory[], test: readonly EditionHistory[] | null): readonly EditionHistory[] {
  if (!test) return history;
  return kind === 'organizers' ? test : mergeHistory(history, test);
}

export interface CreditRule {
  /** Every Edition's year, in any order. */
  editions: readonly number[];
  /** The Edition the credit is for. */
  current: number;
  /** Every Edition from this year until the current one needs a complete record of the kind. */
  from: number;
}

/**
 * The credit for one Organizer, Speaker (their names: the printed one and any confirmed variants) or sponsor (its
 * id) in the current Edition, or null. It prints only when every earlier Edition from `rule.from` has a complete
 * record of the kind, so a missing year can never print a wrong "since"; an incomplete record counts as missing.
 * When the current Edition has a record of the kind, the entry must be on it.
 *
 * Any earlier record that lists the entry proves that year, complete or not, and before `rule.from` too. The credit
 * counts from the first year listed, and only when every Edition from that year on has a complete record. Otherwise
 * the entry gets no credit, as a missing or incomplete record could make its "since" or its count wrong.
 */
export function creditFor(history: readonly EditionHistory[], kind: Kind, keys: readonly string[], rule: CreditRule): Credit | null {
  const record = (year: number) => history.find((h) => h.year === year)?.[kind];
  /** Every Edition from `year` up to the current one has a complete record of the kind. */
  const completeFrom = (year: number) => rule.editions.filter((y) => y >= year && y < rule.current).every((y) => record(y)?.complete);
  if (!completeFrom(rule.from)) return null;
  const wanted = new Set(kind === 'sponsors' ? keys : keys.map(norm));
  const on = (r: PeopleRecord | SponsorRecord | undefined) => Boolean(r) && keysOf(kind, r!).some((k) => wanted.has(k));
  const now = record(rule.current);
  if ((now || kind === 'sponsors') && !on(now)) return null;
  const years = history.filter((h) => h.year < rule.current && on(h[kind])).map((h) => h.year).sort((a, b) => a - b);
  if (!years.length || !completeFrom(years[0])) return null;
  return { since: years[0], editions: years.length + 1 };
}
