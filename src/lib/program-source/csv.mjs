// The CSV fallback, for a program platform that isn't Sessionize or has no API: one CSV file, read from
// PROGRAM_CSV_URL, in the format docs/program-csv.md describes. Each row is a speaker, a session or a break
// (the "type" column); columns the format doesn't name are ignored. Errors name a row and a column, never a value
// or an id: the ids are the Organizers' own, and the refresh check's log is public. Each record carries its row as
// `ref`, so the allowlist's errors (model.mjs) name the row too.
import { formatNames, no, yes } from './config.mjs';
import { toCentral } from './central.mjs';
import { mapLinks } from './links.mjs';

/** RFC 4180 rows: quoted fields may hold commas, quotes ("") and line breaks. A leading BOM is skipped. Empty rows
 *  are left out, unless `keepEmpty` keeps them, so each row's place is its row number in the spreadsheet. */
export function parseCsv(input, { keepEmpty = false } = {}) {
  const s = input.replace(/^﻿/, '');
  const rows = [];
  let row = [];
  let field = '';
  let quoted = false;
  for (let i = 0; i < s.length; i += 1) {
    const c = s[i];
    if (quoted) {
      if (c === '"' && s[i + 1] === '"') { field += '"'; i += 1; }
      else if (c === '"') quoted = false;
      else field += c;
    } else if (c === '"' && field === '') quoted = true;
    else if (c === ',') { row.push(field); field = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && s[i + 1] === '\n') i += 1;
      row.push(field); rows.push(row); row = []; field = '';
    } else field += c;
  }
  if (quoted) throw new Error('the CSV has a quote that is never closed');
  if (field !== '' || row.length) { row.push(field); rows.push(row); }
  return keepEmpty ? rows : rows.filter(filled);
}

const filled = (row) => row.some((f) => f.trim() !== '');

export const COLUMNS = ['type', 'id', 'title', 'name', 'format', 'end_user', 'speakers', 'start', 'end', 'room', 'abstract', 'tagline', 'bio', 'photo', 'links', 'recording'];

/** The CSV as raw program records. Throws with every problem found (up to 10). */
export function adaptCsv(input) {
  // Empty rows stay in the count, so "row 7" in an error is row 7 in the spreadsheet.
  const rows = parseCsv(input, { keepEmpty: true });
  const top = rows.findIndex(filled);
  if (top < 0) throw new Error('the program CSV is empty');
  const header = rows[top].map((h) => h.trim().toLowerCase());
  for (const need of ['type', 'id', 'title', 'name']) if (!header.includes(need)) throw new Error(`the program CSV has no "${need}" column`);
  const problems = [];
  const speakers = [];
  const sessions = [];
  const breaks = [];
  const rooms = [];
  rows.forEach((cells, i) => {
    if (i <= top || !filled(cells)) return;
    const line = i + 1;
    const get = (col) => {
      const at = header.indexOf(col);
      return at < 0 ? '' : (cells[at] ?? '').trim();
    };
    const time = (col) => {
      try { return toCentral(get(col)); } catch (e) { problems.push(`row ${line}, ${col}: ${e.message}`); return null; }
    };
    const type = get('type').toLowerCase();
    const ref = `row ${line}`;
    if (type === 'speaker') {
      if (!get('id') || !get('name')) problems.push(`row ${line}: a speaker needs an id and a name`);
      speakers.push({
        ref, id: get('id'), name: get('name'), tagline: get('tagline') || null, bio: get('bio') || null, photo: get('photo') || null,
        links: mapLinks(get('links').split(/[\s;]+/).filter(Boolean).map((url) => ({ url })), 'site'),
      });
    } else if (type === 'session') {
      const format = formatNames[get('format').toLowerCase()];
      const eu = get('end_user').toLowerCase();
      if (!get('id') || !get('title')) problems.push(`row ${line}: a session needs an id and a title`);
      if (!format) problems.push(`row ${line}, format: not a known format (keynote, talk, workshop or panel)`);
      if (!yes.includes(eu) && !no.includes(eu)) problems.push(`row ${line}, end_user: not yes or no`);
      const room = get('room') || null;
      if (room && !rooms.includes(room)) rooms.push(room);
      sessions.push({
        ref, id: get('id'), title: get('title'), abstract: get('abstract') || null, format: format ?? '', endUser: yes.includes(eu),
        speakers: get('speakers').split(';').map((x) => x.trim()).filter(Boolean),
        start: time('start'), end: time('end'), room, recording: get('recording') || null,
      });
    } else if (type === 'break') {
      const start = time('start');
      const end = time('end');
      if (!get('title') || !start || !end) problems.push(`row ${line}: a break needs a title, a start and an end`);
      else breaks.push({ ref, title: get('title'), start, end, room: get('room') || null });
    } else problems.push(`row ${line}, type: not speaker, session or break`);
  });
  // Ids are unique within speakers and within sessions, and a session's Speakers are speaker rows.
  for (const list of [speakers, sessions]) {
    const ids = new Set();
    for (const r of list) {
      if (r.id && ids.has(r.id)) problems.push(`${r.ref}, id: an earlier ${list === speakers ? 'speaker' : 'session'} row has the same id`);
      ids.add(r.id);
    }
  }
  const speakerIds = new Set(speakers.map((p) => p.id));
  for (const s of sessions) {
    const unknown = s.speakers.filter((id) => !speakerIds.has(id)).length;
    if (unknown) problems.push(`${s.ref}, speakers: ${unknown === 1 ? 'an id matches' : `${unknown} ids match`} no speaker row`);
  }
  if (problems.length) throw new Error(`the program CSV is not valid: ${problems.slice(0, 10).join('; ')}${problems.length > 10 ? `; and ${problems.length - 10} more` : ''}`);
  return { speakers, sessions, rooms, breaks };
}
