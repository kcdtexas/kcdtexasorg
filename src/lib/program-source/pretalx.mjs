// The Pretalx adapter: the event's public REST API (https://docs.pretalx.org/api/) to the raw records
// src/lib/program-source/model.mjs allowlists. With no key, the API shows only what Pretalx itself publishes: the
// confirmed Sessions of the released, public schedule, their Speakers, the rooms, the breaks, and the answers to the
// custom fields set to "Publish answers" (ADR 0014, docs/pretalx.md). What it reads, 50 entries a page:
//   the event:          slug, custom_domain
//   questions/:         id, identifier, question (the label), variant, target, icon, position, options (expanded)
//   submission-types/:  id, name
//   rooms/:             id, name, position
//   schedules/latest/:  id, the newest released version of the schedule
//   submissions/:       code, title, abstract, description, speakers (codes, in order), submission_type, state, slots,
//                       answers (expanded: question, answer, options)
//   speakers/:          code, name, biography, avatar_url, answers (expanded)
//   slots/?schedule=:   that version's slots: id, schedule, room, start, end, submission (a code, or null for a
//                       break), description (a break's title)
//
// What Pretalx doesn't say directly:
//   - the format is the session type's name (formatNames in config.mjs);
//   - an End-User Story, the Level, the job title and company, and the website are custom fields, found by their
//     label or identifier (pretalx.fields in config.mjs); a Yes/No answer is "True" or "False", and a choice is read
//     by its option, since the answer's text is in the language the Speaker used;
//   - names and labels come as one string or as one per language ({"en": "..."});
//   - a break in several rooms comes once per room, and becomes one break: across every room when it's in each room
//     that has a Session, else named by its rooms;
//   - a Session given more than once has one slot per time: each becomes its own Session, and each repeat names the
//     first in `repeatOf`, so the model keeps only the first while the Schedule isn't public;
//   - times carry an offset, and become Central wall-clock times (central.mjs);
//   - Speaker photos are on pretalx.com, or on the event's custom domain when it has one, so a photo address anywhere
//     else is dropped (remote.mjs);
//   - the abstract and the description are two fields; the site shows them as one text, the abstract first, and
//     once when they're the same.
// Only confirmed Sessions are read. Errors name a record by its list, position and code, never by its content.
import { formatNames, pretalx, yes } from './config.mjs';
import { toCentral } from './central.mjs';
import { mapLinks } from './links.mjs';
import { fetchBytes, pretalxBase, pretalxPhoto } from './remote.mjs';

/** The lists the adapter reads. */
const LISTS = ['questions', 'submission-types', 'rooms', 'submissions', 'speakers', 'slots'];
/** The lists that come with their answers or options expanded, so one request per page does. */
const EXPAND = { questions: 'options', submissions: 'answers', speakers: 'answers' };
const PAGE_SIZE = 50;

const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const isStr = (v) => typeof v === 'string';
const optStr = (v) => v === null || v === undefined || typeof v === 'string';
/** A Pretalx code as the site keeps it: letters, digits, "-" and "_". */
const isCode = (v) => typeof v === 'string' && /^[A-Za-z0-9_-]{1,64}$/.test(v);
/** One string, or one per language. */
const isText = (v) => isStr(v) || (isObj(v) && Object.values(v).every(isStr));
const optText = (v) => v === null || v === undefined || isText(v);

/** One string, or one per language, as one string: English first, else the first language with text. Null when
 *  there's no text. Line breaks become "\n". */
export function i18n(v) {
  const clean = (s) => (s.trim() ? s.replace(/\r\n?/g, '\n').trim() : null);
  if (isStr(v)) return clean(v);
  if (!isObj(v)) return null;
  for (const key of ['en', ...Object.keys(v).sort()]) if (isStr(v[key]) && clean(v[key])) return clean(v[key]);
  return null;
}

/** A label as the comparison sees it: lowercase, "&" as "and", and any run of other characters as one space. */
const norm = (s) => String(s ?? '').normalize('NFKC').toLowerCase().replace(/&/g, ' and ').replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
/** True when a custom field has one of the names, as its label or its identifier. */
const named = (q, names) => names.some((n) => norm(n) === norm(i18n(q.question)) || (isStr(q.identifier) && norm(n) === norm(q.identifier)));
/** The id of the field an answer belongs to, expanded or not. */
const fieldOf = (a) => (isObj(a?.question) ? a.question.id : a?.question);

/** A URL field's icon, as a label links.mjs knows. The address decides first; then the icon, so a name.github.io
 *  address in a GitHub field is a GitHub link. An icon this doesn't name counts for nothing. */
const ICON = { github: 'github', bsky: 'bluesky', linkedin: 'linkedin', mastodon: 'mastodon', twitter: 'twitter', web: 'website', instagram: 'instagram' };

/**
 * The problems with the event's and the lists' shapes; empty when they're valid.
 * @param {any} data
 * @param {typeof pretalx} [settings]
 */
export function validatePretalx(data, settings = pretalx) {
  if (!isObj(data)) return ['the data is not an object'];
  const problems = [];
  if (!isObj(data.event)) problems.push('the event is not an object');
  else if (data.event.slug !== settings.event) problems.push(`the event's short form is not ${settings.event}`);
  if (!isObj(data.schedule) || !Number.isInteger(data.schedule.id)) problems.push('the released schedule has no id');
  for (const key of LISTS) if (!Array.isArray(data[key])) problems.push(`${key} is not a list`);
  if (problems.length) return problems;
  const answers = (r, at) => {
    if (!Array.isArray(r.answers)) return problems.push(`${at}.answers is not a list`);
    r.answers.forEach((a, j) => {
      if (!isObj(a)) return problems.push(`${at}.answers[${j}] is not an object (the answers aren't expanded)`);
      if (!Number.isInteger(fieldOf(a))) problems.push(`${at}.answers[${j}].question is not an id`);
      if (!optStr(a.answer)) problems.push(`${at}.answers[${j}].answer is not text`);
      if (a.options !== undefined && a.options !== null && !(Array.isArray(a.options) && a.options.every(Number.isInteger))) problems.push(`${at}.answers[${j}].options is not a list of ids`);
      return undefined;
    });
    return undefined;
  };
  data.questions.forEach((q, i) => {
    const at = `questions[${i}]`;
    if (!isObj(q)) return problems.push(`${at} is not an object`);
    if (!Number.isInteger(q.id)) problems.push(`${at}.id is not an id`);
    if (!isText(q.question)) problems.push(`${at}.question is not text`);
    if (!optStr(q.identifier)) problems.push(`${at}.identifier is not text`);
    for (const k of ['variant', 'target']) if (!isStr(q[k])) problems.push(`${at}.${k} is not text`);
    if (q.options !== undefined && q.options !== null && !(Array.isArray(q.options) && q.options.every((o) => isObj(o) && Number.isInteger(o.id) && isText(o.answer)))) {
      problems.push(`${at}.options is not a list of options (the options aren't expanded)`);
    }
    return undefined;
  });
  data['submission-types'].forEach((t, i) => {
    if (!isObj(t) || !Number.isInteger(t.id) || !isText(t.name) || !i18n(t.name)) problems.push(`submission-types[${i}] needs an id and a name`);
  });
  data.rooms.forEach((r, i) => {
    if (!isObj(r) || !Number.isInteger(r.id) || !isText(r.name) || !i18n(r.name)) problems.push(`rooms[${i}] needs an id and a name`);
  });
  for (const list of ['submissions', 'speakers']) {
    const codes = new Set();
    data[list].forEach((r, i) => {
      const at = `${list}[${i}]`;
      if (!isObj(r)) return problems.push(`${at} is not an object`);
      if (!isCode(r.code)) problems.push(`${at}.code is not a Pretalx code (letters, digits, "-" and "_")`);
      else if (codes.has(r.code)) problems.push(`${at} (${r.code}) comes twice`);
      else codes.add(r.code);
      if (list === 'submissions') {
        if (!isText(r.title) || !i18n(r.title)) problems.push(`${at}.title is missing`);
        for (const k of ['abstract', 'description']) if (!optText(r[k])) problems.push(`${at}.${k} is not text`);
        if (!(Array.isArray(r.speakers) && r.speakers.every(isCode))) problems.push(`${at}.speakers is not a list of codes`);
        if (!Number.isInteger(r.submission_type)) problems.push(`${at}.submission_type is not an id`);
        if (!optStr(r.state)) problems.push(`${at}.state is not text`);
        if (!(Array.isArray(r.slots) && r.slots.every(Number.isInteger))) problems.push(`${at}.slots is not a list of ids`);
      } else {
        if (!isText(r.name) || !i18n(r.name)) problems.push(`${at} has no name`);
        if (!optText(r.biography)) problems.push(`${at}.biography is not text`);
        if (!optStr(r.avatar_url)) problems.push(`${at}.avatar_url is not text`);
      }
      answers(r, at);
      return undefined;
    });
  }
  // Every slot must come from the released version: Pretalx keeps the older ones too (readPretalx).
  const others = [];
  data.slots.forEach((sl, i) => {
    const at = `slots[${i}]`;
    if (!isObj(sl)) return problems.push(`${at} is not an object`);
    if (!Number.isInteger(sl.id)) problems.push(`${at}.id is not an id`);
    if (sl.schedule !== data.schedule.id) others.push({ i, schedule: Number.isInteger(sl.schedule) ? sl.schedule : '(none)' });
    if (sl.room !== null && sl.room !== undefined && !Number.isInteger(sl.room)) problems.push(`${at}.room is not an id`);
    if (sl.submission !== null && sl.submission !== undefined && !isCode(sl.submission)) problems.push(`${at}.submission is not a code`);
    if (!optText(sl.description)) problems.push(`${at}.description is not text`);
    for (const k of ['start', 'end']) {
      if (!optStr(sl[k])) problems.push(`${at}.${k} is not text`);
      else try { toCentral(sl[k]); } catch (e) { problems.push(`${at}.${k} is ${e.message}`); }
    }
    return undefined;
  });
  if (others.length) {
    const from = [...new Set(others.map((o) => o.schedule))].join(', ');
    const which = others.length === 1 ? `slots[${others[0].i}] is` : `${others.length} slots, from slots[${others[0].i}] on, are`;
    problems.unshift(`${which} from schedule ${from}, not from the released one (${data.schedule.id})`);
  }
  return problems;
}

/**
 * The event and its lists as raw program records. Throws when they don't validate, when a required custom field
 * isn't public, or when a Session's type isn't a known format.
 * @param {any} data the event and the lists, as readPretalx returns them
 * @param {typeof pretalx} [settings]
 * @param {(url: string, hosts: string[]) => boolean} [photoAllowed] the photo addresses kept: Pretalx's hosts, and
 *   `hosts`, the event's custom domain; readPlatform passes the build's environment, which decides whether a local
 *   test server counts too
 */
export function adaptPretalx(data, settings = pretalx, photoAllowed = (url, hosts) => pretalxPhoto(url, {}, hosts)) {
  const problems = validatePretalx(data, settings);
  if (problems.length) throw new Error(`the Pretalx data is not valid: ${problems.slice(0, 10).join('; ')}${problems.length > 10 ? `; and ${problems.length - 10} more` : ''}`);

  // The custom fields, in Pretalx's order. A required one that isn't public stops the build: without it, every
  // End-User Story would lose its label, or every Speaker the line under their name, and no error would say so.
  const questions = [...data.questions].sort((a, b) => (a.position ?? 0) - (b.position ?? 0) || a.id - b.id);
  // Each field is asked per proposal or per speaker; one of the same name asked the other way doesn't count.
  const fields = (key, target, required) => {
    const found = questions.filter((q) => q.target === target && named(q, settings.fields[key]));
    if (required && !found.length) {
      throw new Error(`Pretalx has no public custom field per ${target === 'speaker' ? 'speaker' : 'proposal'} named ${settings.fields[key].map((n) => `"${n}"`).join(' or ')}. In Pretalx, turn on "Publish answers" for the field and keep it active, or add its label to pretalx.fields.${key} in src/lib/program-source/config.mjs (docs/pretalx.md).`);
    }
    return new Set(found.map((q) => q.id));
  };
  const endUser = fields('endUser', 'submission', true);
  const level = fields('level', 'submission', false);
  const tagline = fields('tagline', 'speaker', true);
  const website = fields('website', 'speaker', false);
  const byId = new Map(questions.map((q) => [q.id, q]));
  const place = (a) => questions.indexOf(byId.get(fieldOf(a)));
  const optionText = new Map(questions.flatMap((q) => (Array.isArray(q.options) ? q.options : []).map((o) => [o.id, i18n(o.answer)])));
  /** A record's answers to some fields, as text, in the fields' order: a choice by its options' text. */
  const said = (record, ids) => record.answers
    .filter((a) => ids.has(fieldOf(a)))
    .sort((a, b) => place(a) - place(b))
    .map((a) => {
      const q = byId.get(fieldOf(a));
      const picked = (a.options ?? []).map((id) => optionText.get(id)).filter(Boolean);
      return (q.variant === 'choices' || q.variant === 'multiple_choice') && picked.length ? picked.join(', ') : i18n(a.answer);
    })
    .filter(Boolean);

  const types = new Map(data['submission-types'].map((t) => [t.id, i18n(t.name)]));
  const rooms = [...data.rooms].sort((a, b) => (a.position ?? Number.MAX_SAFE_INTEGER) - (b.position ?? Number.MAX_SAFE_INTEGER) || a.id - b.id);
  const roomName = new Map(rooms.map((r) => [r.id, i18n(r.name)]));
  const order = (id) => rooms.findIndex((r) => r.id === id);
  const roomOf = (sl, at) => {
    if (sl.room === null || sl.room === undefined) return null;
    if (!roomName.has(sl.room)) throw new Error(`${at}: its room (${sl.room}) is not one of the rooms`);
    return roomName.get(sl.room);
  };
  // The released schedule's slots that have a time; a slot without one isn't scheduled.
  const slotIds = new Set(data.slots.map((sl) => sl.id));
  const timed = data.slots.map((sl, i) => ({ sl, at: `slots[${i}]` })).filter(({ sl }) => sl.start && sl.end);

  const sessions = [];
  const confirmed = new Set();
  data.submissions.forEach((s, i) => {
    if (s.state !== undefined && s.state !== null && s.state !== 'confirmed') return;
    confirmed.add(s.code);
    const at = `submissions[${i}] (Session ${s.code})`;
    // A confirmed Session's slots are in the released version's list, unless Pretalx changed between the requests.
    const lost = s.slots.find((id) => !slotIds.has(id));
    if (lost !== undefined) throw new Error(`${at}: its slot ${lost} is not among the slots of the released schedule (${data.schedule.id})`);
    const type = types.get(s.submission_type);
    if (type === undefined) throw new Error(`${at}: its session type (${s.submission_type}) is not one of the session types`);
    const format = formatNames[type.toLowerCase()];
    if (!format) throw new Error(`${at}: its session type (${s.submission_type}) is not a known format (formatNames in src/lib/program-source/config.mjs)`);
    // The same text pasted into both fields shows once.
    const texts = [...new Set([i18n(s.abstract), i18n(s.description)].filter(Boolean))];
    const record = {
      id: s.code,
      title: i18n(s.title),
      abstract: texts.join('\n\n') || null,
      format,
      endUser: said(s, endUser).some((t) => yes.includes(t.toLowerCase())),
      // Read for later: no page shows it yet, so the allowlist drops it.
      level: said(s, level)[0] ?? null,
      speakers: [...s.speakers],
      recording: null,
    };
    const times = timed
      .filter(({ sl }) => sl.submission === s.code)
      .sort((a, b) => toCentral(a.sl.start).localeCompare(toCentral(b.sl.start)) || order(a.sl.room) - order(b.sl.room));
    if (!times.length) sessions.push({ ...record, start: null, end: null, room: null });
    times.forEach(({ sl, at: where }, n) => sessions.push({
      ...record,
      ...(n ? { id: `${s.code}-${n + 1}`, repeatOf: s.code } : {}),
      start: toCentral(sl.start),
      end: toCentral(sl.end),
      room: roomOf(sl, where),
    }));
  });

  // Breaks. A break in several rooms comes once per room, and becomes one break: across every room when it's in each
  // room that has a Session, else named by its rooms, in their order ("Fixture Room B, Fixture Lobby").
  const sessionRooms = new Set(timed.filter(({ sl }) => confirmed.has(sl.submission) && sl.room !== null && sl.room !== undefined).map(({ sl }) => sl.room));
  const groups = new Map();
  for (const { sl, at } of timed) {
    if (sl.submission !== null && sl.submission !== undefined) continue;
    const title = i18n(sl.description) ?? 'Break';
    const [start, end] = [toCentral(sl.start), toCentral(sl.end)];
    const key = JSON.stringify([title, start, end]);
    if (!groups.has(key)) groups.set(key, { title, start, end, rooms: new Set() });
    if (roomOf(sl, at) !== null) groups.get(key).rooms.add(sl.room);
  }
  const breaks = [...groups.values()].map(({ title, start, end, rooms: within }) => ({
    title,
    start,
    end,
    room: !within.size || [...sessionRooms].every((r) => within.has(r)) ? null : [...within].sort((a, b) => order(a) - order(b)).map((r) => roomName.get(r)).join(', '),
  })).sort((a, b) => a.start.localeCompare(b.start) || (a.room ?? '').localeCompare(b.room ?? ''));

  // Speakers. Their links come from the public URL fields: the kind from the address, else from the field's icon or
  // label, and an address in the website field that nothing else names is the Speaker's website.
  const hosts = customDomain(data.event);
  const speakers = data.speakers.map((p) => ({
    id: p.code,
    name: i18n(p.name),
    tagline: said(p, tagline)[0] ?? null,
    bio: i18n(p.biography),
    photo: isStr(p.avatar_url) && p.avatar_url && photoAllowed(p.avatar_url, hosts) ? p.avatar_url : null,
    links: mapLinks(p.answers
      .filter((a) => byId.get(fieldOf(a))?.variant === 'url' && byId.get(fieldOf(a))?.target === 'speaker' && i18n(a.answer))
      .sort((a, b) => place(a) - place(b))
      .map((a) => {
        const q = byId.get(fieldOf(a));
        return { url: i18n(a.answer), type: ICON[q.icon] ?? null, title: i18n(q.question), fallback: website.has(q.id) ? 'site' : null };
      })),
  }));

  return { speakers, sessions, rooms: rooms.map((r) => roomName.get(r.id)), breaks };
}

/** The host of the event's custom domain, as a host photos may come from, when it's an https address. */
function customDomain(event) {
  if (!isStr(event.custom_domain) || !event.custom_domain) return [];
  try {
    const url = new URL(event.custom_domain);
    return url.protocol === 'https:' ? [url.hostname] : [];
  } catch {
    return [];
  }
}

/** What a 401 or a 403 means, and a 404 for the released schedule. */
const UNRELEASED = 'Pretalx publishes the Sessions, the Speakers and the rooms only once a schedule is released and public (docs/pretalx.md)';

/** One response as JSON. A 401 or 403 means Pretalx doesn't publish it yet; `notFound` says what a 404 means. */
async function getJson(url, env, what, { notFound = null } = {}) {
  let body;
  try {
    ({ body } = await fetchBytes(url, { env, what, accept: 'application/json' }));
  } catch (e) {
    if (e?.status === 401 || e?.status === 403) throw new Error(`${e.message}: ${UNRELEASED}`);
    if (e?.status === 404 && notFound) throw new Error(`${e.message}: ${notFound}`);
    throw e;
  }
  try {
    return JSON.parse(body.toString('utf8'));
  } catch {
    throw new Error(`${what}: the response is not JSON`);
  }
}

/** Every page of one list, following `next` on the same host, up to pretalx.maxPages pages. `filter` narrows it. */
async function readList(name, env, filter = '') {
  const query = [EXPAND[name] ? `expand=${EXPAND[name]}` : '', filter, `page_size=${PAGE_SIZE}`].filter(Boolean).join('&');
  const first = new URL(`${pretalxBase(env)}/events/${encodeURIComponent(pretalx.event)}/${name}/?${query}`);
  const results = [];
  const seen = new Set();
  let count = null;
  let url = first.href;
  for (let page = 1; url; page += 1) {
    const what = `Pretalx (${name}, page ${page})`;
    if (page > pretalx.maxPages) throw new Error(`Pretalx (${name}): more than ${pretalx.maxPages} pages`);
    seen.add(url);
    const body = await getJson(url, env, what);
    if (!isObj(body) || !Array.isArray(body.results)) throw new Error(`${what}: the response is not a list`);
    if (page === 1 && Number.isInteger(body.count)) count = body.count;
    results.push(...body.results);
    if (body.next === null || body.next === undefined) break;
    let next;
    try { next = new URL(body.next, url); } catch { throw new Error(`${what}: the next page's address is not an address`); }
    if (next.origin !== first.origin) throw new Error(`${what}: the next page is on another host`);
    if (seen.has(next.href)) throw new Error(`${what}: the next page is one already read`);
    url = next.href;
  }
  // A list that changes between its pages can repeat or skip an entry; the next build reads it again.
  if (count !== null && count !== results.length) throw new Error(`Pretalx (${name}): it counted ${count} entries but sent ${results.length}, so the list changed while it was read`);
  return results;
}

/**
 * The event and every list the adapter needs, from Pretalx's public API: the real one, or a local test server named
 * by KCD_PROGRAM_TEST_BASE. Throws a plain Error; readPlatform redacts it.
 * @param {Record<string, string | undefined>} env
 */
export async function readPretalx(env) {
  const event = `${pretalxBase(env)}/events/${encodeURIComponent(pretalx.event)}/`;
  const data = { event: await getJson(event, env, `Pretalx (the event ${pretalx.event})`, { notFound: `there is no public event ${pretalx.event} (pretalx.event in src/lib/program-source/config.mjs)` }) };
  for (const name of ['questions', 'submission-types', 'rooms']) data[name] = await readList(name, env);
  // The newest released version of the schedule; logged out, Pretalx shows no other. Then the program's own lists,
  // close together, so a new release is unlikely to fall between them.
  data.schedule = await getJson(`${event}schedules/latest/`, env, 'Pretalx (the released schedule)', { notFound: UNRELEASED });
  if (!isObj(data.schedule) || !Number.isInteger(data.schedule.id)) throw new Error('Pretalx (the released schedule): it has no id');
  for (const name of ['submissions', 'speakers']) data[name] = await readList(name, env);
  // Only that version's slots. With no filter, slots/ gives the latest published version, but only by a documented
  // default: any filter returns every released version, and each Session would show once per version. So the reader
  // names the version, and validatePretalx checks that every slot is from it.
  data.slots = await readList('slots', env, `schedule=${data.schedule.id}`);
  return data;
}
