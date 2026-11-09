// Markdown as plain text. Pretalx stores abstracts, descriptions and biographies as Markdown; the site shows them as
// plain text, escaped, with their line breaks (ADR 0014, docs/pretalx.md). plainText() removes the marks and keeps
// the words: emphasis, code marks, headings, quote markers and bullets go; numbered items keep their numbers; a link
// keeps its text, an image its alt text, an address in angle brackets the address. Of HTML, only the formatting tags
// Pretalx itself allows go; Pretalx shows any other tag as text, and so does the site (`kubectl logs <pod-name>`).
// Emphasis counts only in pairs at the edges of words, so "5 * 3", "2*3*4" and snake_case stay as written, and so
// does anything in code, in a web address, or escaped with a backslash.
//
// Every step reads the text in one pass, or a few, so even a very long bio stays fast; the Pretalx adapter also caps
// each text before it gets here.

/** Hides a character from the steps below until the end, as a private-use character (the input's are dropped). */
const hide = (c) => String.fromCharCode(0xe000 + c.charCodeAt(0));
const unhide = (s) => s.replace(/[\ue021-\ue07e]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xe000));
/** Hides the characters the steps act on, inside code and web addresses. */
const shield = (s) => s.replace(/[*_~`[\]()<>#!\\|&]/g, hide);

/** A link's or an image's destination, with an optional title: one level of parentheses inside. */
const DEST = String.raw`\((?:[^()\n]|\([^()\n]*\))*\)`;
/** The tags Pretalx allows in its text, as it renders them; it shows any other tag as text. */
const ALLOWED = 'a|abbr|acronym|b|blockquote|br|code|del|div|em|hr|i|ins|li|ol|strong|ul|p|pre|span|table|tbody|thead|tr|td|th|h[1-6]|img';
/** The tags whose end, or which alone, end a line. */
const BREAKS = /^(?:br|hr|p|div|li|h[1-6]|blockquote|pre|tr|table|ul|ol)$/i;
/** The character references Pretalx would show as characters; any other name stays as written. */
const NAMED = {
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: '\u00a0', copy: '\u00a9', reg: '\u00ae', trade: '\u2122',
  mdash: '\u2014', ndash: '\u2013', hellip: '\u2026', laquo: '\u00ab', raquo: '\u00bb', lsquo: '\u2018', rsquo: '\u2019',
  ldquo: '\u201c', rdquo: '\u201d',
};
const isWord = (c) => c !== undefined && /[\p{L}\p{N}]/u.test(c);
const isSpace = (c) => c === undefined || /\s/.test(c);

/** Code spans on one line: a run of backticks up to the next run of the same length. The code keeps its text. */
function codeSpans(line) {
  const runs = [...line.matchAll(/`+/g)].map((m) => ({ start: m.index, end: m.index + m[0].length, len: m[0].length }));
  if (runs.length < 2) return line;
  const next = new Array(runs.length).fill(-1);
  const last = new Map();
  for (let i = runs.length - 1; i >= 0; i -= 1) {
    next[i] = last.get(runs[i].len) ?? -1;
    last.set(runs[i].len, i);
  }
  let out = '';
  let at = 0;
  for (let i = 0; i < runs.length;) {
    const j = next[i];
    if (j < 0) { i += 1; continue; }
    const code = line.slice(runs[i].end, runs[j].start);
    out += line.slice(at, runs[i].start) + shield(code.length > 1 && code.startsWith(' ') && code.endsWith(' ') ? code.slice(1, -1) : code);
    at = runs[j].end;
    i = j + 1;
  }
  return out + line.slice(at);
}

/** HTML comments go: each up to the first "-->" after it. */
function uncomment(s) {
  let out = '';
  let at = 0;
  for (let open = s.indexOf('<!--'); open >= 0; open = s.indexOf('<!--', at)) {
    const close = s.indexOf('-->', open + 4);
    if (close < 0) break;
    out += s.slice(at, open);
    at = close + 3;
  }
  return out + s.slice(at);
}

/** One line's emphasis marks, removed in pairs. A run of * or _ opens at the start of a word and closes at the end
 *  of one; ~~ opens before text and closes after it. A run that closes pairs with the nearest open run of the same
 *  kind and length, so one pass over the line does it. */
function unemphasize(line) {
  const runs = [];
  for (const m of line.matchAll(/\*+|_+|~+/g)) {
    const mark = m[0];
    if (mark[0] === '~' && mark.length !== 2) continue;
    const before = line[m.index - 1];
    const after = line[m.index + mark.length];
    const strike = mark[0] === '~';
    runs.push({
      start: m.index,
      len: mark.length,
      key: mark,
      open: !isSpace(after) && (strike || !isWord(before)),
      close: !isSpace(before) && (strike || !isWord(after)),
    });
  }
  const open = new Map();
  const gone = new Set();
  runs.forEach((run, i) => {
    const waiting = open.get(run.key);
    if (run.close && waiting?.length) {
      gone.add(waiting.pop());
      gone.add(i);
    } else if (run.open) {
      if (waiting) waiting.push(i);
      else open.set(run.key, [i]);
    }
  });
  if (!gone.size) return line;
  let out = '';
  let at = 0;
  runs.forEach((run, i) => {
    if (!gone.has(i)) return;
    out += line.slice(at, run.start);
    at = run.start + run.len;
  });
  return out + line.slice(at);
}

/** One line's block marks: quote markers, a heading's hashes, a rule or a heading's underline, a bullet and its task
 *  box. A numbered item keeps its number. */
function unblock(raw) {
  const line = raw.replace(/^[ \t]{0,3}(?:>[ \t]?)+/, '');
  const heading = /^[ \t]{0,3}#{1,6}(?=[ \t]|$)/.exec(line);
  if (heading) return line.slice(heading[0].length).trim().replace(/(?:^|[ \t])#+$/, '').trim();
  if (/^[ \t]{0,3}\S/.test(line) && /^(?:-{3,}|\*{3,}|_{3,}|=+)$/.test(line.replace(/[ \t]+/g, ''))) return '';
  return line.replace(/^[ \t]*[-*+][ \t]+(?:\[[ xX]\][ \t]+)?/, '');
}

/** An allowed tag as text: a line break for a break or a block's end, the alt text for an image, else nothing. */
function untag(tag, slash, name) {
  if (/^img$/i.test(name)) {
    const alt = /\balt[ \t\n]*=[ \t\n]*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+))/i.exec(tag);
    return alt ? alt[1] ?? alt[2] ?? alt[3] : '';
  }
  return BREAKS.test(name) && (slash || /^(?:br|hr)$/i.test(name)) ? '\n' : '';
}

/** A character reference as its character, unless it names a control character, a private-use one the steps use, a
 *  surrogate, or no character; those, and names Pretalx wouldn't show, stay as written. */
function decode(ref, body) {
  if (body[0] !== '#') return Object.hasOwn(NAMED, body) ? NAMED[body] : ref;
  const code = body[1] === 'x' || body[1] === 'X' ? parseInt(body.slice(2), 16) : parseInt(body.slice(1), 10);
  const bad = code <= 0x1f || (code >= 0x7f && code <= 0x9f) || (code >= 0xd800 && code <= 0xdfff) || (code >= 0xe000 && code <= 0xe0ff) || code > 0x10ffff;
  return bad ? ref : String.fromCodePoint(code);
}

/**
 * @param {string} md Markdown, as a Speaker wrote it
 * @returns {string} the words, with the line breaks; blank lines collapsed to one
 */
export function plainText(md) {
  if (typeof md !== 'string') return md;
  // The private-use characters the steps use to hide others are dropped from the input: no font shows them anyway.
  const input = md.replace(/\r\n?/g, '\n').replace(/[\ue000-\ue0ff]/g, '');
  // A fenced code block keeps its lines and loses its fences.
  const lines = [];
  let fence = null;
  for (const line of input.split('\n')) {
    const f = /^[ \t]{0,3}(`{3,}|~{3,})(.*)$/.exec(line);
    if (!fence && f) { fence = f[1]; continue; }
    if (fence && f && f[1][0] === fence[0] && f[1].length >= fence.length && !f[2].trim()) { fence = null; continue; }
    lines.push(fence ? shield(line) : line);
  }
  let s = lines.join('\n');
  // Kept as written: escaped characters (a backslash at a line's end is just a line break), inline code, addresses in
  // angle brackets and bare web addresses. Comments go.
  s = s.replace(/\\\n/g, '\n').replace(/\\([!-/:-@[-`{-~])/g, (_, c) => hide(c));
  s = s.split('\n').map(codeSpans).join('\n');
  s = uncomment(s);
  s = s.replace(/<((?:https?|ftp):\/\/[^\s<>]+|mailto:[^\s<>]+|[^\s<>@]+@[^\s<>@.]+(?:\.[^\s<>@.]+)+)>/gi, (_, address) => shield(address.replace(/^mailto:/i, '')));
  s = s.replace(/\b(?:https?|ftp):\/\/[^\s<>()[\]]+/gi, shield);
  // Images keep their alt text and links their text; a reference's definition goes, and only a real one: a label, a
  // destination, and maybe a title.
  s = s.replace(new RegExp(String.raw`!\[([^[\]\n]*)\](?:${DEST}|\[[^[\]\n]*\])`, 'g'), '$1');
  s = s.replace(new RegExp(String.raw`\[([^[\]\n]+)\](?:${DEST}|\[[^[\]\n]*\])`, 'g'), '$1');
  s = s.replace(/^[ \t]{0,3}\[[^[\]\n]+\]:[ \t]*(?:<[^>\n]*>|\S+)(?:[ \t]+(?:"[^"\n]*"|'[^'\n]*'|\([^)\n]*\)))?[ \t]*$/gm, '');
  // Pretalx's formatting tags go; every other tag stays as written.
  s = s.replace(new RegExp(String.raw`<(/?)(${ALLOWED})(?=[\s/>])[^<>]*>`, 'gi'), untag);
  // Line by line: the block marks, then the emphasis.
  s = s.split('\n').map((line) => unemphasize(unblock(line))).join('\n');
  // Character references as their characters, then the hidden characters back.
  s = unhide(s.replace(/&(#[0-9]{1,7}|#[xX][0-9a-fA-F]{1,6}|[A-Za-z][A-Za-z0-9]{1,31});/g, decode));
  return s.split('\n').map((line) => line.trimEnd()).join('\n').replace(/\n{3,}/g, '\n\n').trim();
}
