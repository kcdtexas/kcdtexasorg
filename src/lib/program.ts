// The program: the only reader of Sessions and Speakers (ADR 0009). A source hands over raw records; the allowlist
// below copies only the public fields into the model, so anything else a platform sends (emails, phone numbers,
// review notes, the planted marker) never reaches a page, a card or a log.
//
// The gates (`program` in src/data/edition-2027.ts):
//   closed: no program at all, and no source is read;
//   speakersPublic: the Speakers, the titles and the abstracts, with no times or rooms;
//   schedulePublic: adds the times and the rooms.
// A test build with --program-sample opens both on test data: the 2026 Schedule (src/data/program-2026-schedule.ts)
// moved to the 2027 Event Day, plus the made-up fixture (src/data/program-fixture.ts). The pages label it "Sample".
// Real data comes through a platform adapter, read only in a production build with a gate open (plan-release-6);
// until one exists, an open gate without the sample fails the build.
import { edition2026 } from '../data/edition-2026';
import { edition2027, programDataSample } from '../data/edition-2027';
import { home } from '../data/home';
import { asPrinted, hosts2026, keynotes2026, speakers2026 } from '../data/program-2026';
import { breaks2026, rooms2026, sessions2026 } from '../data/program-2026-schedule';
import { fixtureSessions, fixtureSpeakers } from '../data/program-fixture';
import { norm, peopleCreditsShown, speakerCredit, type Credit } from './loyalty';

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
  /** Downloaded at build time once a platform adapter exists; null shows the placeholder. */
  photo: string | null;
  links: { kind: LinkKind; url: string }[];
  /** "Speaker since": a Returning Speaker (CONTEXT.md), from src/lib/loyalty.ts. */
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

// The allowlist. Links keep only these kinds, and only https.
const LINK_KINDS = ['site', 'linkedin', 'github', 'bluesky', 'mastodon', 'x'] as const;
type LinkKind = (typeof LINK_KINDS)[number];
const text = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim() : null);
const isFormat = (v: string): v is Format => (FORMATS as readonly string[]).includes(v);
const isTime = (v: unknown): v is string => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(v);

function allowSpeaker(r: RawSpeaker): Omit<Speaker, 'slug' | 'credit'> {
  return {
    id: r.id,
    name: r.name.trim(),
    tagline: text(r.tagline),
    bio: text(r.bio),
    photo: null,
    links: (r.links ?? [])
      .filter((l): l is { kind: LinkKind; url: string } => (LINK_KINDS as readonly string[]).includes(l.kind) && /^https:\/\/[^\s"<>]+$/.test(l.url))
      .map((l) => ({ kind: l.kind, url: l.url })),
  };
}

function allowSession(r: RawSession, schedule: boolean): Omit<Session, 'slug'> {
  const format = r.format.toLowerCase();
  if (!isFormat(format)) throw new Error(`Session ${r.id}: unknown format "${r.format}"`);
  if (schedule && !(isTime(r.start) && isTime(r.end) && text(r.room))) throw new Error(`Session ${r.id}: the Schedule is public, but it has no time or room`);
  return {
    id: r.id,
    title: r.title.trim(),
    abstract: text(r.abstract),
    format,
    endUser: r.endUser === true,
    speakerIds: [...r.speakers],
    start: schedule ? r.start! : null,
    end: schedule ? r.end! : null,
    room: schedule ? text(r.room) : null,
    recording: text(r.recording),
  };
}

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
  /** Which Edition each Session belongs to, for the Returning Speaker credit. */
  edition: (sessionId: string) => number;
  rooms: readonly string[];
  breaks: readonly Break[];
}

// The 2026 Schedule as test data, moved to the 2027 Event Day at the same times. Taglines are the 2026 Event
// Page's printed lines; the End-User Stories are the Sessions of the Speakers whose talks the home page shows as
// 2026 End-User talks (by Speaker: Sessionize's titles differ a little from the recordings').
function sample(): Source {
  const day = edition2027.eventDay;
  const moved = (t: string) => `${day}${t.slice(10)}`;
  const printed = new Map([...keynotes2026, ...speakers2026, ...hosts2026].map((e) => [norm(e.name), asPrinted(e) || null]));
  const endUsers = new Set(edition2026.talks
    .filter((t) => home.speak.talks.includes(t.face) || t.youtube === home.speak.photoYoutube)
    .map((t) => norm(t.name)));

  const speakers = new Map<string, RawSpeaker>();
  const idOf = (name: string) => {
    const key = norm(name);
    if (!speakers.has(key)) speakers.set(key, { id: `s26-${speakers.size + 1}`, name, tagline: printed.get(key) ?? null });
    return speakers.get(key)!.id;
  };
  const sessions: RawSession[] = sessions2026.map((s, i) => ({
    id: `s26-s${i + 1}`, title: s.title, format: s.format, endUser: s.speakers.some((n) => endUsers.has(norm(n))),
    speakers: s.speakers.map(idOf), start: moved(s.start), end: moved(s.end), room: s.room,
  }));
  // A fixture Speaker with a 2026 Speaker's name is the same person: one Speaker with both Sessions.
  const fixtureIds = new Map(fixtureSpeakers.map((f) => [f.id, speakers.get(norm(f.name))?.id ?? f.id]));
  const fixture = fixtureSpeakers.filter((f) => fixtureIds.get(f.id) === f.id);
  const fixtureSessionIds = new Set(fixtureSessions.map((s) => s.id));
  return {
    speakers: [...speakers.values(), ...fixture],
    sessions: [...sessions, ...fixtureSessions.map((s) => ({ ...s, speakers: s.speakers.map((id) => fixtureIds.get(id) ?? id) }))],
    edition: (id) => (fixtureSessionIds.has(id) ? edition2027.year : edition2026.year),
    rooms: [...rooms2026, ...new Set(fixtureSessions.map((s) => s.room!))],
    breaks: breaks2026.map((b) => ({ ...b, start: moved(b.start), end: moved(b.end) })),
  };
}

function source(): Source {
  if (programDataSample) return sample();
  throw new Error('A program gate is open, but no platform adapter is set up yet. Test builds use --program-sample.');
}

function build(src: Source, schedulePublic: boolean): Program {
  const sessions = src.sessions.map((r) => allowSession(r, schedulePublic));
  const order = (s: Omit<Session, 'slug'>) => `${s.start ?? ''} ${String(src.rooms.indexOf(s.room ?? '')).padStart(3, '0')} ${s.title}`;
  sessions.sort((a, b) => order(a).localeCompare(order(b)));
  const takenSessions = new Set<string>();
  const takenSpeakers = new Set<string>();
  const speaking = new Set(sessions.flatMap((s) => s.speakerIds));
  const speakers = src.speakers
    .filter((r) => speaking.has(r.id))
    .map(allowSpeaker)
    .sort((a, b) => a.name.split(' ').at(-1)!.localeCompare(b.name.split(' ').at(-1)!) || a.name.localeCompare(b.name))
    .map((s) => {
      // The credit counts only this Edition's Sessions: test data from 2026 never credits itself.
      const here = sessions.some((x) => x.speakerIds.includes(s.id) && src.edition(x.id) === edition2027.year);
      return { ...s, slug: slugify(s.name, takenSpeakers), credit: peopleCreditsShown && here ? speakerCredit(s.name) : null };
    });
  for (const s of sessions) {
    const missing = s.speakerIds.filter((id) => !speakers.some((p) => p.id === id));
    if (missing.length) throw new Error(`Session ${s.id}: unknown Speakers ${missing.join(', ')}`);
  }
  return {
    sample: programDataSample,
    schedulePublic,
    day: edition2027.eventDay,
    sessions: sessions.map((s) => ({ ...s, slug: slugify(s.title, takenSessions) })),
    speakers,
    rooms: schedulePublic ? src.rooms.filter((r) => sessions.some((s) => s.room === r)) : [],
    breaks: schedulePublic ? [...src.breaks] : [],
  };
}

/** The gates this build uses: the Edition's, or both open in a --program-sample test build. */
export const gates = programDataSample ? { speakersPublic: true, schedulePublic: true } : edition2027.program;

/** The program, or null while both gates are closed (then no source is read at all). */
export const program: Program | null = gates.speakersPublic || gates.schedulePublic
  ? build(source(), gates.schedulePublic)
  : null;

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
