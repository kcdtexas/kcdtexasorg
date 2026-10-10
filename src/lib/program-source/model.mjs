// The program allowlist. A source (the test data, Sessionize) hands over raw records; publicProgram() copies only
// the public fields, so anything else a platform sends (emails, phone numbers, review notes, the planted marker)
// never reaches the model. The gates apply here too: with only speakersPublic open, the times, rooms and breaks
// are dropped.

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

/** @returns {PublicSession} */
function allowSession(r, schedule) {
  const format = String(r.format ?? '').toLowerCase();
  if (!FORMATS.includes(format)) throw new Error(`Session ${r.id}: the format is not one of ${FORMATS.join(', ')}`);
  if (typeof r.title !== 'string' || !r.title.trim()) throw new Error(`Session ${r.id}: no title`);
  if (schedule && !(isTime(r.start) && isTime(r.end) && text(r.room))) throw new Error(`Session ${r.id}: the Schedule is public, but it has no time or room`);
  if (schedule && r.end <= r.start) throw new Error(`Session ${r.id}: it ends before it starts`);
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
  if (!text(b.title) || !isTime(b.start) || !isTime(b.end) || b.end <= b.start) throw new Error(`Break ${i + 1}: it needs a title and a start before its end`);
  return { title: b.title.trim(), start: b.start, end: b.end, room: text(b.room) };
}

/**
 * The public program: the allowlisted fields, with the gates applied, and only the Speakers who have a Session.
 * @param {{ speakers: readonly any[], sessions: readonly any[], rooms: readonly string[], breaks: readonly any[] }} src
 * @param {{ schedulePublic: boolean, photoAllowed?: (url: string) => boolean }} options
 * @returns {PublicProgram}
 */
export function publicProgram(src, { schedulePublic, photoAllowed = isHttps }) {
  const sessions = src.sessions.map((r) => allowSession(r, schedulePublic));
  const ids = new Set();
  for (const s of sessions) {
    if (ids.has(s.id)) throw new Error(`Session ${s.id}: the id is used twice`);
    ids.add(s.id);
  }
  const speaking = new Set(sessions.flatMap((s) => s.speakerIds));
  const speakers = src.speakers.filter((r) => speaking.has(String(r.id))).map((r) => allowSpeaker(r, photoAllowed));
  for (const s of sessions) {
    const missing = s.speakerIds.filter((id) => !speakers.some((p) => p.id === id));
    if (missing.length) throw new Error(`Session ${s.id}: unknown Speakers ${missing.join(', ')}`);
  }
  return {
    speakers,
    sessions,
    rooms: schedulePublic ? src.rooms.map(String).filter((r) => sessions.some((s) => s.room === r)) : [],
    breaks: schedulePublic ? src.breaks.map(allowBreak) : [],
  };
}
