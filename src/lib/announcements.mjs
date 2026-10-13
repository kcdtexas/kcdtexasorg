// The Event Day announcements file (src/data/announcements-2027.yaml), read and checked. The build stops on a bad
// entry with a message that names the entry and the field, so a mistake made in GitHub's web editor on Event Day
// never reaches the site: the host keeps the last good deploy (docs/event-day.md).
//
// The file holds one key, `announcements`: empty, or a list of entries, each with
//   at:   when it's posted, Central time, "YYYY-MM-DD HH:MM", in the week up to and including Event Day;
//   text: one line in double quotes, at most 280 characters;
//   link: optional, an https address.
// Without the quotes, a # starts a comment that cuts the text short and a colon breaks the file, so the build
// refuses unquoted text, and any comment inside an entry.
import { isMap, isScalar, parseDocument } from 'yaml';

export const ANNOUNCEMENTS_FILE = 'src/data/announcements-2027.yaml';
const FIELDS = ['at', 'text', 'link'];
export const MAX_TEXT = 280;
const QUOTES = 'Put the text in double quotes, and write a quote inside it as \\".';

/** The day `n` days before 'YYYY-MM-DD'. */
const daysBefore = (day, n) => new Date(Date.parse(`${day}T12:00:00Z`) - n * 86400000).toISOString().slice(0, 10);

/** True when an entry's node holds a comment: on a field's line, between its fields, or after its last one. */
const hasComment = (node) => Boolean(node.comment) || node.items.some((p) => p.key?.commentBefore || p.key?.comment || p.value?.commentBefore || p.value?.comment);

/**
 * The announcements in the file's text, oldest first, with `at` as 'YYYY-MM-DDTHH:MM'. Throws on a bad file.
 * @param {string} source the file's text
 * @param {string} eventDay 'YYYY-MM-DD'
 * @returns {{ at: string, text: string, link: string | null }[]}
 */
export function parseAnnouncements(source, eventDay) {
  const fail = (msg) => { throw new Error(`${ANNOUNCEMENTS_FILE}: ${msg}`); };
  const doc = parseDocument(source, { uniqueKeys: true, prettyErrors: true });
  if (doc.errors.length) fail(`it isn't valid YAML. ${doc.errors[0].message.split('\n')[0].replace(/:$/, '.')} ${QUOTES}`);
  const top = doc.toJS();
  if (top === null || top === undefined) return [];
  if (typeof top !== 'object' || Array.isArray(top) || Object.keys(top).some((k) => k !== 'announcements')) fail('the file must have one key, "announcements", with the entries under it.');
  const list = top.announcements ?? [];
  if (!Array.isArray(list)) fail('"announcements" must be a list of entries, each starting with "- at:".');
  // The entries' nodes, in the same order, for how each field is written.
  const nodes = doc.get('announcements')?.items ?? [];
  const first = daysBefore(eventDay, 6);
  return list.map((entry, i) => {
    const name = `entry ${i + 1}${entry && typeof entry.at === 'string' ? ` (at "${entry.at}")` : ''}`;
    const bad = (field, msg) => fail(`${name}: "${field}" ${msg}`);
    const node = nodes[i];
    if (!entry || typeof entry !== 'object' || Array.isArray(entry) || !isMap(node)) fail(`${name}: an entry needs "at" and "text", and may have "link".`);
    for (const key of Object.keys(entry)) if (!FIELDS.includes(key)) bad(key, 'is not a field. The fields are "at", "text" and "link".');
    const at = entry.at;
    const m = typeof at === 'string' ? at.match(/^(\d{4}-\d{2}-\d{2}) ([01]\d|2[0-3]):([0-5]\d)$/) : null;
    const t = m ? Date.parse(`${m[1]}T00:00:00Z`) : NaN;
    if (Number.isNaN(t) || new Date(t).toISOString().slice(0, 10) !== m[1]) bad('at', `must be a Central time as "YYYY-MM-DD HH:MM" in quotes, such as "${eventDay} 10:15".`);
    if (m[1] < first || m[1] > eventDay) bad('at', `must be on Event Day (${eventDay}) or in the 6 days before it.`);
    if (entry.text === undefined || entry.text === null || (typeof entry.text === 'string' && !entry.text.trim())) bad('text', 'is missing or empty.');
    const textNode = node.get('text', true);
    if (!isScalar(textNode) || textNode.type !== 'QUOTE_DOUBLE') bad('text', 'must be in double quotes, such as text: "Lunch is in the hall."');
    const text = entry.text.trim();
    if (/[\r\n]/.test(text)) bad('text', 'must be one line.');
    if (text.length > MAX_TEXT) bad('text', `is ${text.length} characters; the most is ${MAX_TEXT}.`);
    if (hasComment(node)) fail(`${name}: has a # comment, which the page would leave out. Put all of the text inside the double quotes, and remove the comment.`);
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

const monthDay = new Intl.DateTimeFormat('en-US', { timeZone: 'UTC', month: 'short', day: 'numeric' });

/**
 * When an announcement was posted, as the Event Day page prints it: the time alone ("10:15 a.m.") when it was
 * posted on the build's day, else the date too ("Apr 20, 3:00 p.m."), so an earlier day's never reads as today's.
 * The site's styles: clock() in src/lib/program.ts and shortDate() in src/data/edition-2027.ts.
 * @param {string} at 'YYYY-MM-DDTHH:MM', Central
 * @param {string} day the build's Central day, 'YYYY-MM-DD'
 */
export function postedAt(at, day) {
  const [h, m] = at.slice(11, 16).split(':').map(Number);
  const time = `${h % 12 || 12}:${String(m).padStart(2, '0')} ${h < 12 ? 'a.m.' : 'p.m.'}`;
  return at.slice(0, 10) === day ? time : `${monthDay.format(new Date(`${at.slice(0, 10)}T12:00:00Z`))}, ${time}`;
}
