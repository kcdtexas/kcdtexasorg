// The Event Day announcements file (src/data/announcements-2027.yaml), read and checked. The build stops on a bad
// entry with a message that names the entry and the field, so a mistake made in GitHub's web editor on Event Day
// never reaches the site: the host keeps the last good deploy (docs/event-day.md).
//
// The file holds one key, `announcements`: empty, or a list of entries, each with
//   at:   when it's posted, Central time, "YYYY-MM-DD HH:MM", in the week up to and including Event Day;
//   text: one line of plain text, at most 280 characters;
//   link: optional, an https address.
import { parse } from 'yaml';

export const ANNOUNCEMENTS_FILE = 'src/data/announcements-2027.yaml';
const FIELDS = ['at', 'text', 'link'];
const MAX_TEXT = 280;

/** The day `n` days before 'YYYY-MM-DD'. */
const daysBefore = (day, n) => new Date(Date.parse(`${day}T12:00:00Z`) - n * 86400000).toISOString().slice(0, 10);

/**
 * The announcements in the file's text, oldest first, with `at` as 'YYYY-MM-DDTHH:MM'. Throws on a bad file.
 * @param {string} source the file's text
 * @param {string} eventDay 'YYYY-MM-DD'
 * @returns {{ at: string, text: string, link: string | null }[]}
 */
export function parseAnnouncements(source, eventDay) {
  const fail = (msg) => { throw new Error(`${ANNOUNCEMENTS_FILE}: ${msg}`); };
  let doc;
  try {
    doc = parse(source, { uniqueKeys: true, prettyErrors: true });
  } catch (e) {
    fail(`it isn't valid YAML. ${e instanceof Error ? e.message.split('\n')[0].replace(/:$/, '.') : e}`);
  }
  if (doc === null || doc === undefined) return [];
  if (typeof doc !== 'object' || Array.isArray(doc) || Object.keys(doc).some((k) => k !== 'announcements')) fail('the file must have one key, "announcements", with the entries under it.');
  const list = doc.announcements ?? [];
  if (!Array.isArray(list)) fail('"announcements" must be a list of entries, each starting with "- at:".');
  const first = daysBefore(eventDay, 6);
  return list.map((entry, i) => {
    const name = `entry ${i + 1}${entry && typeof entry.at === 'string' ? ` (at "${entry.at}")` : ''}`;
    const bad = (field, msg) => fail(`${name}: "${field}" ${msg}`);
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) fail(`${name}: an entry needs "at" and "text", and may have "link".`);
    for (const key of Object.keys(entry)) if (!FIELDS.includes(key)) bad(key, 'is not a field. The fields are "at", "text" and "link".');
    const at = entry.at;
    const m = typeof at === 'string' ? at.match(/^(\d{4}-\d{2}-\d{2}) ([01]\d|2[0-3]):([0-5]\d)$/) : null;
    const t = m ? Date.parse(`${m[1]}T00:00:00Z`) : NaN;
    if (Number.isNaN(t) || new Date(t).toISOString().slice(0, 10) !== m[1]) bad('at', `must be a Central time as "YYYY-MM-DD HH:MM" in quotes, such as "${eventDay} 10:15".`);
    if (m[1] < first || m[1] > eventDay) bad('at', `must be on Event Day (${eventDay}) or in the 6 days before it.`);
    if (typeof entry.text !== 'string' || !entry.text.trim()) bad('text', 'is missing or empty.');
    const text = entry.text.trim();
    if (/[\r\n]/.test(text)) bad('text', 'must be one line.');
    if (text.length > MAX_TEXT) bad('text', `is ${text.length} characters; the most is ${MAX_TEXT}.`);
    let link = null;
    if (entry.link !== undefined && entry.link !== null) {
      let url = null;
      try { url = typeof entry.link === 'string' && !/\s/.test(entry.link) ? new URL(entry.link) : null; } catch {}
      if (!url || url.protocol !== 'https:') bad('link', 'must be an https address, such as https://kcdtexas.org/code-of-conduct/.');
      link = entry.link;
    }
    return { at: `${m[1]}T${m[2]}:${m[3]}`, text, link };
  }).sort((a, b) => a.at.localeCompare(b.at));
}
