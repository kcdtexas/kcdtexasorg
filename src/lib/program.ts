// The program: the only reader of Sessions and Speakers (ADR 0009). A source hands over raw records; the allowlist
// (src/lib/program-source/model.mjs) copies only the public fields into the model, so anything else a platform
// sends (emails, phone numbers, review notes, the planted marker) never reaches a page, a card or a log.
//
// The gates (`program` in src/data/edition-2027.ts):
//   closed: no program at all, and no source is read;
//   speakersPublic: the Speakers, the titles and the abstracts, with no times or rooms;
//   schedulePublic: adds the times and the rooms.
// A test build with --program-sample opens both on test data, and --program-sample=speakers only `speakersPublic`:
// the made-up sample Schedule (src/data/program-sample-schedule.ts, in the 2026 Schedule's shape) and the made-up
// fixture (src/data/program-fixture.ts). No real name reaches a test build. The pages label it "Sample".
// Real data comes from Sessionize or the CSV fallback (src/lib/program-source/), read only in a production build
// (CONTEXT=production) with a gate open; scripts/build.sh gives every other build with a gate open the test data.
// Speaker photos are downloaded and resized at build time and served from /2027/speakers/ (ADR 0007), and the
// public model's hash is published at /2027/program-version.txt for the refresh check (scripts/program-check.mjs).
import { asOfDay, edition2027, programDataSample, programSampleGates } from '../data/edition-2027';
import { fixtureOrganizer } from '../data/history-test';
import { hosts2024 } from '../data/program-2024';
import { hosts2025 } from '../data/program-2025';
import { hosts2026 } from '../data/program-2026';
import { fixtureEarlierSpeakers, fixtureSessions, fixtureSpeakers } from '../data/program-fixture';
import { sampleBreaks, sampleRooms, sampleSessions, sampleSpeakers } from '../data/program-sample-schedule';
import { returningOrganizers } from '../data/returning-organizers';
import { returningSpeakers } from '../data/returning-speakers';
import { history, norm, speakerCredit, type Credit } from './loyalty';
import { LINK_KINDS } from './program-source/model.mjs';
import { downloadPhotos } from './program-source/photos.mjs';
import { chooseSource, publicModel, readPlatform } from './program-source/platform.mjs';

export type Format = 'keynote' | 'talk' | 'workshop' | 'panel';
export const FORMATS: readonly Format[] = ['keynote', 'talk', 'workshop', 'panel'];

/** A Speaker as a source hands it over. Fields outside the allowlist are dropped. */
export interface RawSpeaker {
  id: string;
  name: string;
  tagline?: string | null;
  bio?: string | null;
  photo?: string | null;
  links?: readonly { kind: string; url: string }[];
  [field: string]: unknown;
}

/** A Session as a source hands it over. Fields outside the allowlist are dropped. */
export interface RawSession {
  id: string;
  title: string;
  abstract?: string | null;
  format: string;
  endUser?: boolean;
  speakers: readonly string[];
  /** Central local time, 'YYYY-MM-DDTHH:MM'. */
  start?: string | null;
  end?: string | null;
  room?: string | null;
  recording?: string | null;
  [field: string]: unknown;
}

export interface Speaker {
  id: string;
  slug: string;
  name: string;
  /** The tagline as printed. */
  tagline: string | null;
  bio: string | null;
  /** The photo, downloaded at build time and served from our domain, in two square sizes; null shows the
   *  placeholder (the test data has none). */
  photo: { small: string; large: string } | null;
  links: { kind: LinkKind; url: string }[];
  /** A Returning Speaker's credit (CONTEXT.md), "2nd year", from src/lib/loyalty.ts. */
  credit: Credit | null;
}

export interface Session {
  id: string;
  slug: string;
  title: string;
  abstract: string | null;
  format: Format;
  endUser: boolean;
  speakerIds: string[];
  /** Central local time, 'YYYY-MM-DDTHH:MM'; null until the Schedule is public. */
  start: string | null;
  end: string | null;
  room: string | null;
  /** The recording, for the Recap. */
  recording: string | null;
}

/** A plenary item with no Speaker: registration, a break, lunch. */
export interface Break { title: string; start: string; end: string; room: string | null }

export interface Program {
  /** Test data: the pages say "Sample". */
  sample: boolean;
  schedulePublic: boolean;
  day: string;
  sessions: Session[];
  speakers: Speaker[];
  rooms: string[];
  breaks: Break[];
}

// The allowlist (src/lib/program-source/model.mjs) keeps links of these kinds, and only https.
type LinkKind = (typeof LINK_KINDS)[number];

/** "kubernetes-at-the-edge", unique within `taken`. */
function slugify(s: string, taken: Set<string>): string {
  const base = s.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/['’]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 64).replace(/-+$/, '') || 'item';
  let slug = base;
  for (let n = 2; taken.has(slug); n += 1) slug = `${base}-${n}`;
  taken.add(slug);
  return slug;
}

interface Source {
  speakers: readonly RawSpeaker[];
  sessions: readonly RawSession[];
  rooms: readonly string[];
  breaks: readonly Break[];
}

// The test data: the made-up sample Schedule and the fixture. Their names are made up, so none may be a real
// person's: a Speaker, host or Organizer of any Edition in src/data/. A match fails the build, before any page
// could show it. tests/sample-program.mjs also checks the built pages for the real names, titles and taglines.
function sample(): Source {
  const real = new Set([
    ...history.flatMap((h) => [...(h.organizers?.names ?? []), ...(h.speakers?.names ?? [])]),
    ...[...hosts2024, ...hosts2025, ...hosts2026].map((p) => p.name),
    ...[...returningSpeakers, ...returningOrganizers].flatMap((r) => [r.name, ...r.earlier]),
  ].map(norm));
  const madeUp = [
    ...sampleSpeakers.map((s) => ['src/data/program-sample-schedule.ts', s.name]),
    ...fixtureSpeakers.map((s) => ['src/data/program-fixture.ts', s.name]),
    ...fixtureEarlierSpeakers.names.map((n) => ['src/data/program-fixture.ts', n]),
    ['src/data/history-test.ts', fixtureOrganizer.name],
  ];
  const clash = madeUp.find(([, name]) => real.has(norm(name)));
  if (clash) throw new Error(`${clash[0]}: "${clash[1]}" is a real Speaker's, host's or Organizer's name; the test data's names are made up`);
  return {
    speakers: [...sampleSpeakers, ...fixtureSpeakers],
    sessions: [...sampleSessions, ...fixtureSessions],
    rooms: [...sampleRooms, ...new Set(fixtureSessions.map((s) => s.room!))],
    breaks: [...sampleBreaks],
  };
}

/** The build's environment: the host's variables, read here at build time and never inlined into the bundle. */
const env = process.env as Record<string, string | undefined>;

async function source(): Promise<Source> {
  if (programDataSample) return sample();
  const choice = chooseSource(edition2027.program, env);
  // scripts/build.sh builds every non-production build with a gate open on the test data (--program-sample).
  if (choice.kind !== 'sessionize' && choice.kind !== 'csv') throw new Error('A program gate is open outside a production build: build with scripts/build.sh, which uses the test data there.');
  const raw = await readPlatform(choice, env);
  return raw;
}

interface Built { program: Program; version: string; photos: Map<string, { small: Buffer; large: Buffer }> }

async function build(src: Source, open: { speakersPublic: boolean; schedulePublic: boolean }): Promise<Built> {
  const { model, version } = publicModel(src, open, env);
  const sessions = model.sessions.map((s) => ({ ...s, format: s.format as Format }));
  const order = (s: Omit<Session, 'slug'>) => `${s.start ?? ''} ${String(model.rooms.indexOf(s.room ?? '')).padStart(3, '0')} ${s.title}`;
  sessions.sort((a, b) => order(a).localeCompare(order(b)));
  const takenSessions = new Set<string>();
  const takenSpeakers = new Set<string>();
  const speakers = model.speakers
    .sort((a, b) => a.name.split(' ').at(-1)!.localeCompare(b.name.split(' ').at(-1)!) || a.name.localeCompare(b.name))
    .map((s) => {
      // The credit needs a Session in this Edition.
      const here = sessions.some((x) => x.speakerIds.includes(s.id));
      return { ...s, links: s.links as Speaker['links'], slug: slugify(s.name, takenSpeakers), credit: here ? speakerCredit(s.name) : null };
    });
  // The photos, downloaded and resized now; a Speaker without one keeps the placeholder. An error names the Speaker
  // by the source's reference when it gives one (a CSV row: its ids stay out of the logs), else by place and id.
  const refs = new Map(src.speakers.map((r) => [String(r.id), typeof r.ref === 'string' ? r.ref : null]));
  const photos = await downloadPhotos(speakers.flatMap((s, i) => (s.photo ? [{ key: s.slug, url: s.photo, label: refs.get(s.id) ?? `Speaker ${i + 1} (${s.id})` }] : [])), env);
  return {
    version,
    photos,
    program: {
      sample: programDataSample,
      schedulePublic: open.schedulePublic,
      day: edition2027.eventDay,
      sessions: sessions.map((s) => ({ ...s, slug: slugify(s.title, takenSessions) })),
      speakers: speakers.map((s) => ({ ...s, photo: photos.has(s.slug) ? { small: `/2027/speakers/${s.slug}-small.webp`, large: `/2027/speakers/${s.slug}-large.webp` } : null })),
      rooms: model.rooms,
      breaks: model.breaks,
    },
  };
}

/** The gates this build uses: the Edition's, or the sample's in a --program-sample test build. */
export const gates = programDataSample ? programSampleGates : edition2027.program;

// Read once per build while a gate is open; a closed gate reads no source at all.
const built = gates.speakersPublic || gates.schedulePublic ? await build(await source(), gates) : null;

/** The program, or null while both gates are closed. */
export const program: Program | null = built?.program ?? null;
/** The public model's hash, published at /2027/program-version.txt while a gate is open; null while both are closed. */
export const programVersion: string | null = built?.version ?? null;
/** Offline use (/sw.js): while the program pages exist, through Event Day. From the day after, the build's worker
 *  clears its copies and removes itself. */
export const offlineCopy = program !== null && asOfDay <= edition2027.eventDay;
/** The Speaker photos as WebP, by Speaker slug, for src/pages/2027/speakers/[photo].webp.ts. */
export const speakerPhotos: ReadonlyMap<string, { small: Buffer; large: Buffer }> = built?.photos ?? new Map();

// Helpers for the pages.
export const speakersOf = (s: Session) => s.speakerIds.map((id) => program!.speakers.find((p) => p.id === id)!);
export const sessionsOf = (p: Speaker) => program!.sessions.filter((s) => s.speakerIds.includes(p.id));
export const formatName: Record<Format, string> = { keynote: 'Keynote', talk: 'Talk', workshop: 'Workshop', panel: 'Panel' };

/** "9:30 a.m." from 'YYYY-MM-DDTHH:MM'. */
export function clock(t: string): string {
  const [h, m] = t.slice(11, 16).split(':').map(Number);
  return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${h < 12 ? 'a.m.' : 'p.m.'}`;
}
/** "9:30–10:00 a.m.", or "11:30 a.m.–12:15 p.m." across noon. */
export function timeRange(start: string, end: string): string {
  const [a, b] = [clock(start), clock(end)];
  return a.slice(-4) === b.slice(-4) ? `${a.slice(0, -5)}–${b}` : `${a}–${b}`;
}
/** "0930", for ids. */
export const hhmm = (t: string) => t.slice(11, 16).replace(':', '');
