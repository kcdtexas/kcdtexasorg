// The CSV fallback, for a program platform that isn't Sessionize or has no API: one CSV file, read from
// PROGRAM_CSV_URL, in the format docs/program-csv.md describes. Each row is a speaker, a session or a break
// (the "type" column); columns the format doesn't name are ignored. Errors name a row and a column, never a value.
import { formatNames, no, yes } from './config.mjs';
import { toCentral } from './central.mjs';
import { mapLinks } from './links.mjs';

/** RFC 4180 rows: quoted fields may hold commas, quotes ("") and line breaks. A leading BOM is skipped. */
export function parseCsv(input) {
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
  return rows.filter((r) => r.some((f) => f.trim() !== ''));
}

export const COLUMNS = ['type', 'id', 'title', 'name', 'format', 'end_user', 'speakers', 'start', 'end', 'room', 'abstract', 'tagline', 'bio', 'photo', 'links', 'recording'];

/** The CSV as raw program records. Throws with every problem found (up to 10). */
export function adaptCsv(input) {
  const rows = parseCsv(input);
  if (!rows.length) throw new Error('the program CSV is empty');
  const header = rows[0].map((h) => h.trim().toLowerCase());
  for (const need of ['type', 'id', 'title', 'name']) if (!header.includes(need)) throw new Error(`the program CSV has no "${need}" column`);
  const problems = [];
  const speakers = [];
  const sessions = [];
  const breaks = [];
  const rooms = [];
  rows.slice(1).forEach((cells, i) => {
    const line = i + 2;
    const get = (col) => {
      const at = header.indexOf(col);
      return at < 0 ? '' : (cells[at] ?? '').trim();
    };
    const time = (col) => {
      try { return toCentral(get(col)); } catch (e) { problems.push(`row ${line}, ${col}: ${e.message}`); return null; }
    };
    const type = get('type').toLowerCase();
    if (type === 'speaker') {
      if (!get('id') || !get('name')) problems.push(`row ${line}: a speaker needs an id and a name`);
      speakers.push({
        id: get('id'), name: get('name'), tagline: get('tagline') || null, bio: get('bio') || null, photo: get('photo') || null,
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
        id: get('id'), title: get('title'), abstract: get('abstract') || null, format: format ?? '', endUser: yes.includes(eu),
        speakers: get('speakers').split(';').map((x) => x.trim()).filter(Boolean),
        start: time('start'), end: time('end'), room, recording: get('recording') || null,
      });
    } else if (type === 'break') {
      const start = time('start');
      const end = time('end');
      if (!get('title') || !start || !end) problems.push(`row ${line}: a break needs a title, a start and an end`);
      else breaks.push({ title: get('title'), start, end, room: get('room') || null });
    } else problems.push(`row ${line}, type: not speaker, session or break`);
  });
  const ids = new Set();
  for (const p of speakers) {
    if (p.id && ids.has(p.id)) problems.push(`speaker ${p.id}: the id is used twice`);
    ids.add(p.id);
  }
  if (problems.length) throw new Error(`the program CSV is not valid: ${problems.slice(0, 10).join('; ')}${problems.length > 10 ? `; and ${problems.length - 10} more` : ''}`);
  return { speakers, sessions, rooms, breaks };
}
