// The program allowlist and the program version. A source (the test data, Sessionize, the CSV) hands over raw
// records; publicProgram() copies only the public fields, so anything else a platform sends (emails, phone
// numbers, review notes, the planted marker) never reaches the model. The gates apply here too: with only
// speakersPublic open, the times, rooms and breaks are dropped.
//
// programVersion() hashes that public model, sorted, so the build (/2027/program-version.txt) and
// scripts/program-check.mjs get the same value from the same data, and a new value means the pages change.
import { createHash } from 'node:crypto';

export const FORMATS = /** @type {const} */ (['keynote', 'talk', 'workshop', 'panel']);
export const LINK_KINDS = /** @type {const} */ (['site', 'linkedin', 'github', 'bluesky', 'mastodon', 'x']);

const text = (v) => (typeof v === 'string' && v.trim() ? v.trim() : null);
export const isTime = (v) => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(v);
const isHttps = (v) => typeof v === 'string' && /^https:\/\/[^\s"<>]+$/.test(v);

/**
 * @typedef {{ id: string, name: string, tagline: string | null, bio: string | null, photo: string | null, links: { kind: string, url: string }[] }} PublicSpeaker
 * @typedef {{ id: string, title: string, abstract: string | null, format: string, endUser: boolean, speakerIds: string[], start: string | null, end: string | null, room: string | null, recording: string | null }} PublicSession
 * @typedef {{ title: string, start: string, end: string, room: string | null }} PublicBreak
 * @typedef {{ speakers: PublicSpeaker[], sessions: PublicSession[], rooms: string[], breaks: PublicBreak[] }} PublicProgram
 */

/** @returns {PublicSpeaker} */
function allowSpeaker(r, photoAllowed) {
  return {
    id: String(r.id),
    name: String(r.name).trim(),
    tagline: text(r.tagline),
    bio: text(r.bio),
    // The photo's source address, downloaded at build time (src/lib/program-source/photos.mjs).
    photo: typeof r.photo === 'string' && photoAllowed(r.photo) ? r.photo : null,
    links: (Array.isArray(r.links) ? r.links : [])
      .filter((l) => LINK_KINDS.includes(l?.kind) && isHttps(l?.url))
      .map((l) => ({ kind: l.kind, url: l.url })),
  };
}

/** How an error names a record: by the source's own reference when it gives one (a CSV row, whose ids are the
 *  Organizers' own and stay out of the logs), else by the platform's id. */
const nameOf = (r, fallback) => (typeof r.ref === 'string' ? r.ref : fallback);

/** @returns {PublicSession} */
function allowSession(r, schedule) {
  const name = nameOf(r, `Session ${r.id}`);
  const format = String(r.format ?? '').toLowerCase();
  if (!FORMATS.includes(format)) throw new Error(`${name}: the format is not one of ${FORMATS.join(', ')}`);
  if (typeof r.title !== 'string' || !r.title.trim()) throw new Error(`${name}: no title`);
  if (schedule && !(isTime(r.start) && isTime(r.end) && text(r.room))) throw new Error(`${name}: the Schedule is public, but it has no time or room`);
  if (schedule && r.end <= r.start) throw new Error(`${name}: it ends before it starts`);
  return {
    id: String(r.id),
    title: r.title.trim(),
    abstract: text(r.abstract),
    format,
    endUser: r.endUser === true,
    speakerIds: (r.speakers ?? []).map(String),
    start: schedule ? r.start : null,
    end: schedule ? r.end : null,
    room: schedule ? text(r.room) : null,
    recording: isHttps(r.recording) ? r.recording : null,
  };
}

/** @returns {PublicBreak} */
function allowBreak(b, i) {
  if (!text(b.title) || !isTime(b.start) || !isTime(b.end) || b.end <= b.start) throw new Error(`${nameOf(b, `Break ${i + 1}`)}: it needs a title and a start before its end`);
  return { title: b.title.trim(), start: b.start, end: b.end, room: text(b.room) };
}

/**
 * The public program: the allowlisted fields, with the gates applied, and only the Speakers who have a Session.
 * With a gate open, an empty program fails: the Schedule's gate needs a Session, and the Speakers' gate a Speaker.
 * @param {{ speakers: readonly any[], sessions: readonly any[], rooms: readonly string[], breaks: readonly any[] }} src
 * @param {{ schedulePublic: boolean, speakersPublic?: boolean, photoAllowed?: (url: string) => boolean }} options
 * @returns {PublicProgram}
 */
export function publicProgram(src, { schedulePublic, speakersPublic = true, photoAllowed = isHttps }) {
  const sessions = src.sessions.map((r) => allowSession(r, schedulePublic));
  const name = (i) => nameOf(src.sessions[i], `Session ${sessions[i].id}`);
  const ids = new Set();
  sessions.forEach((s, i) => {
    if (ids.has(s.id)) throw new Error(`${name(i)}: the id is used twice`);
    ids.add(s.id);
  });
  const speaking = new Set(sessions.flatMap((s) => s.speakerIds));
  const speakers = src.speakers.filter((r) => speaking.has(String(r.id))).map((r) => allowSpeaker(r, photoAllowed));
  sessions.forEach((s, i) => {
    const missing = s.speakerIds.filter((id) => !speakers.some((p) => p.id === id));
    if (missing.length) throw new Error(`${name(i)}: unknown Speakers${typeof src.sessions[i].ref === 'string' ? '' : ` ${missing.join(', ')}`}`);
  });
  // An empty program would build an empty Schedule or Speakers list, and the Schedule's calendar link would lead
  // nowhere: the platform, or its API settings, left the accepted Sessions out.
  if (schedulePublic && !sessions.length) throw new Error('the Schedule is public (schedulePublic), but the program has no Sessions. Check that the platform lists the accepted Sessions.');
  if (speakersPublic && !speakers.length) throw new Error('the Speakers are public (speakersPublic), but the program has no Speakers. Check that the platform lists the accepted Sessions and their Speakers.');
  return {
    speakers,
    sessions,
    rooms: schedulePublic ? src.rooms.map(String).filter((r) => sessions.some((s) => s.room === r)) : [],
    breaks: schedulePublic ? src.breaks.map(allowBreak) : [],
  };
}

/** JSON with sorted keys, so equal models give equal text. */
function canonical(value) {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value && typeof value === 'object') return `{${Object.keys(value).sort().map((k) => `${JSON.stringify(k)}:${canonical(value[k])}`).join(',')}}`;
  return JSON.stringify(value ?? null);
}

/**
 * The program version: a SHA-256 of the public model, with Sessions, Speakers and breaks sorted.
 * @param {PublicProgram} model
 */
export function programVersion(model) {
  const by = (key) => (a, b) => (key(a) < key(b) ? -1 : key(a) > key(b) ? 1 : 0);
  const sorted = {
    format: 1,
    sessions: [...model.sessions].sort(by((s) => s.id)),
    speakers: [...model.speakers].sort(by((s) => s.id)),
    rooms: model.rooms,
    breaks: [...model.breaks].sort(by((b) => `${b.start} ${b.end} ${b.room ?? ''} ${b.title}`)),
  };
  return createHash('sha256').update(canonical(sorted)).digest('hex');
}
