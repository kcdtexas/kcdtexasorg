// The Sessionize adapter: the API v2 "All" view (https://sessionize.com/api/v2/<endpoint id>/view/All) to the raw
// records src/lib/program-source/model.mjs allowlists. The view's shape:
//   sessions[]: id, title, description, startsAt, endsAt, isServiceSession, isPlenumSession, speakers (ids),
//               categoryItems (item ids), questionAnswers ({ questionId, answerValue }), roomId, recordingUrl, status
//   speakers[]: id, firstName, lastName, fullName, bio, tagLine, profilePicture, links ({ title, url, linkType })
//   categories[]: id, title, items ({ id, name }); questions[]: id, question; rooms[]: id, name, sort
//
// What Sessionize doesn't say directly:
//   - the format is the item picked in the "Session format" category (config.mjs names it);
//   - an End-User Story is marked by a category or a question (config.mjs);
//   - links are mapped by their address (links.mjs);
//   - service sessions (registration, lunch, sponsor callouts) become breaks: a plenum one spans every room;
//   - isPlenumSession doesn't mean keynote: the 2026 keynotes weren't plenum;
//   - times are event-local with no offset, so they're Central (central.mjs);
//   - Speaker photos are on Sessionize's own hosts, so a photo address anywhere else is dropped (remote.mjs).
// Only accepted Sessions are read. Errors name a record by its position and field, never by its content.
import { formatNames, no, sessionize as names, yes } from './config.mjs';
import { toCentral } from './central.mjs';
import { mapLinks } from './links.mjs';
import { sessionizePhoto } from './remote.mjs';

const str = (v) => typeof v === 'string';
const optStr = (v) => v === null || v === undefined || typeof v === 'string';
const id = (v) => (typeof v === 'string' && v.length > 0) || Number.isInteger(v);
const arr = (v) => Array.isArray(v);
const same = (a, b) => String(a ?? '').trim().toLowerCase() === String(b ?? '').trim().toLowerCase();

/** The problems with an All view's shape; empty when it's valid. */
export function validateAll(data) {
  const problems = [];
  if (!data || typeof data !== 'object' || Array.isArray(data)) return ['the response is not an object'];
  for (const key of ['sessions', 'speakers', 'rooms']) if (!arr(data[key])) problems.push(`${key} is not a list`);
  for (const key of ['categories', 'questions']) if (data[key] !== undefined && data[key] !== null && !arr(data[key])) problems.push(`${key} is not a list`);
  if (problems.length) return problems;
  data.sessions.forEach((s, i) => {
    const at = `sessions[${i}]`;
    if (!s || typeof s !== 'object') return problems.push(`${at} is not an object`);
    if (!id(s.id)) problems.push(`${at}.id is missing`);
    if (!str(s.title) || !s.title.trim()) problems.push(`${at}.title is missing`);
    if (!optStr(s.description)) problems.push(`${at}.description is not text`);
    for (const k of ['startsAt', 'endsAt']) {
      if (!optStr(s[k])) problems.push(`${at}.${k} is not text`);
      else try { toCentral(s[k]); } catch (e) { problems.push(`${at}.${k} is ${e.message}`); }
    }
    if (s.speakers !== undefined && !(arr(s.speakers) && s.speakers.every((x) => id(x) || id(x?.id)))) problems.push(`${at}.speakers is not a list of ids`);
    if (s.categoryItems !== undefined && !(arr(s.categoryItems) && s.categoryItems.every(id))) problems.push(`${at}.categoryItems is not a list of ids`);
    if (s.questionAnswers !== undefined && !arr(s.questionAnswers)) problems.push(`${at}.questionAnswers is not a list`);
    if (s.roomId !== undefined && s.roomId !== null && !id(s.roomId)) problems.push(`${at}.roomId is not an id`);
    if (!optStr(s.recordingUrl)) problems.push(`${at}.recordingUrl is not text`);
  });
  data.speakers.forEach((p, i) => {
    const at = `speakers[${i}]`;
    if (!p || typeof p !== 'object') return problems.push(`${at} is not an object`);
    if (!id(p.id)) problems.push(`${at}.id is missing`);
    const name = str(p.fullName) && p.fullName.trim() ? p.fullName : [p.firstName, p.lastName].filter(str).join(' ');
    if (!name.trim()) problems.push(`${at} has no name`);
    for (const k of ['bio', 'tagLine', 'profilePicture']) if (!optStr(p[k])) problems.push(`${at}.${k} is not text`);
    if (p.links !== undefined && p.links !== null && !(arr(p.links) && p.links.every((l) => l && str(l.url)))) problems.push(`${at}.links is not a list of links`);
  });
  data.rooms.forEach((r, i) => {
    if (!r || !id(r.id) || !str(r.name) || !r.name.trim()) problems.push(`rooms[${i}] needs an id and a name`);
  });
  (data.categories ?? []).forEach((c, i) => {
    if (!c || !str(c.title) || !arr(c.items) || !c.items.every((x) => x && id(x.id) && str(x.name))) problems.push(`categories[${i}] needs a title and items with ids and names`);
  });
  (data.questions ?? []).forEach((q, i) => {
    if (!q || !id(q.id) || !str(q.question)) problems.push(`questions[${i}] needs an id and a question`);
  });
  return problems;
}

/**
 * The All view as raw program records. Throws when the data doesn't validate or a Session's format is missing.
 * @param {any} data the parsed JSON
 * @param {typeof names} [settings]
 * @param {(url: string) => boolean} [photoAllowed] the photo addresses kept: Sessionize's hosts; readPlatform passes
 *   the build's environment, which decides whether a local test server counts too
 */
export function adaptSessionize(data, settings = names, photoAllowed = (url) => sessionizePhoto(url, {})) {
  const problems = validateAll(data);
  if (problems.length) {
    const shown = problems.slice(0, 10).join('; ');
    throw new Error(`the Sessionize data is not valid: ${shown}${problems.length > 10 ? `; and ${problems.length - 10} more` : ''}`);
  }
  const categories = data.categories ?? [];
  const questions = data.questions ?? [];
  const items = new Map(categories.flatMap((c) => c.items.map((x) => [String(x.id), { category: c.title, name: x.name }])));
  const hasFormat = categories.some((c) => same(c.title, settings.formatCategory));
  const euQuestion = questions.find((q) => same(q.question, settings.endUserQuestion));
  const rooms = [...data.rooms].sort((a, b) => (a.sort ?? 0) - (b.sort ?? 0) || String(a.name).localeCompare(String(b.name)));
  const roomName = (rid) => (rid === null || rid === undefined ? null : rooms.find((r) => String(r.id) === String(rid))?.name.trim() ?? null);

  const sessions = [];
  const breaks = [];
  data.sessions.forEach((s, i) => {
    const start = toCentral(s.startsAt);
    const end = toCentral(s.endsAt);
    if (s.isServiceSession === true) {
      // A service session spans every room when it's plenum, else it's in its own room.
      if (start && end) breaks.push({ title: s.title.trim(), start, end, room: s.isPlenumSession === true ? null : roomName(s.roomId) });
      return;
    }
    if (s.status !== undefined && s.status !== null && !same(s.status, 'Accepted')) return;
    const picked = (s.categoryItems ?? []).map((x) => items.get(String(x))).filter(Boolean);
    if (!hasFormat) throw new Error(`the Sessionize data has no "${settings.formatCategory}" category. Add it to the Call for Speakers and the API endpoint, or rename formatCategory in src/lib/program-source/config.mjs.`);
    const formatItem = picked.find((x) => same(x.category, settings.formatCategory));
    const format = formatItem ? formatNames[formatItem.name.trim().toLowerCase()] : undefined;
    if (!formatItem) throw new Error(`sessions[${i}] (Session ${s.id}): no "${settings.formatCategory}" item is picked`);
    if (!format) throw new Error(`sessions[${i}] (Session ${s.id}): its "${settings.formatCategory}" item is not a known format (formatNames in src/lib/program-source/config.mjs)`);
    const euCategory = picked.some((x) => (same(x.category, settings.endUserCategory) && !no.includes(x.name.trim().toLowerCase())) || same(x.name, settings.endUserCategory));
    const euAnswer = euQuestion ? (s.questionAnswers ?? []).some((a) => String(a?.questionId) === String(euQuestion.id) && yes.includes(String(a?.answerValue ?? '').trim().toLowerCase())) : false;
    sessions.push({
      id: String(s.id),
      title: s.title,
      abstract: s.description ?? null,
      format,
      endUser: euCategory || euAnswer,
      speakers: (s.speakers ?? []).map((x) => String(x?.id ?? x)),
      start,
      end,
      room: roomName(s.roomId),
      recording: s.recordingUrl ?? null,
    });
  });

  const speakers = data.speakers.map((p) => ({
    id: String(p.id),
    name: (str(p.fullName) && p.fullName.trim() ? p.fullName : [p.firstName, p.lastName].filter(str).join(' ')).trim(),
    tagline: p.tagLine ?? null,
    bio: p.bio ?? null,
    photo: str(p.profilePicture) && photoAllowed(p.profilePicture) ? p.profilePicture : null,
    links: mapLinks((p.links ?? []).map((l) => ({ url: l.url, type: l.linkType ?? null, title: l.title ?? null }))),
  }));

  return { speakers, sessions, rooms: rooms.map((r) => r.name.trim()), breaks };
}
