// Markdown as plain text. Pretalx stores abstracts, descriptions and biographies as Markdown; the site shows them as
// plain text, escaped, with their line breaks (ADR 0014, docs/pretalx.md). plainText() removes the marks and keeps
// the words: emphasis, code marks, headings, quote and list markers go; a link keeps its text, an image its alt text,
// an address in angle brackets the address; HTML tags go, as they're never shown. Emphasis counts only in pairs at
// the edges of words, so "5 * 3", "2*3*4" and snake_case stay as written, and so does anything in code, in a web
// address, or escaped with a backslash.

/** Hides a character from the rules below until the end. Private-use code points don't come from Pretalx's text. */
const hide = (c) => String.fromCharCode(0xe000 + c.charCodeAt(0));
const unhide = (s) => s.replace(/[-]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xe000));
/** Hides the characters the rules act on, inside code and web addresses. */
const shield = (s) => s.replace(/[*_~`[\]()<>#!\\|&]/g, hide);

/** A link's or an image's destination, with an optional title: one level of parentheses inside. */
const DEST = String.raw`\((?:[^()\n]|\([^()\n]*\))*\)`;
const WORD = String.raw`\p{L}\p{N}`;
const NAMED = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };

/**
 * @param {string} md Markdown, as a Speaker wrote it
 * @returns {string} the words, with the line breaks; blank lines collapsed to one
 */
export function plainText(md) {
  if (typeof md !== 'string') return md;
  // A fenced code block keeps its lines and loses its fences.
  const lines = [];
  let fence = null;
  for (const line of md.replace(/\r\n?/g, '\n').split('\n')) {
    const f = /^\s{0,3}(`{3,}|~{3,})(.*)$/.exec(line);
    if (!fence && f) { fence = f[1]; continue; }
    if (fence && f && f[1][0] === fence[0] && f[1].length >= fence.length && !f[2].trim()) { fence = null; continue; }
    lines.push(fence ? shield(line) : line);
  }
  let s = lines.join('\n');
  // Escaped characters, inline code, comments, addresses in angle brackets and bare web addresses: kept as written.
  s = s.replace(/\\([!-/:-@[-`{-~])/g, (_, c) => hide(c));
  s = s.replace(/(?<!`)(`+)(?!`)(.+?)(?<!`)\1(?!`)/g, (_, ticks, code) => shield(code.length > 1 && code.startsWith(' ') && code.endsWith(' ') ? code.slice(1, -1) : code));
  s = s.replace(/<!--[\s\S]*?-->/g, '');
  s = s.replace(/<((?:https?|ftp):\/\/[^\s<>]+|mailto:[^\s<>]+|[^\s<>@]+@[^\s<>@]+\.[^\s<>@]+)>/gi, (_, address) => shield(address.replace(/^mailto:/i, '')));
  s = s.replace(/\b(?:https?|ftp):\/\/[^\s<>()[\]]+/gi, shield);
  // Images keep their alt text and links their text; a reference's definition goes.
  s = s.replace(new RegExp(String.raw`!\[([^\]\n]*)\](?:${DEST}|\[[^\]\n]*\])`, 'g'), '$1');
  s = s.replace(new RegExp(String.raw`\[([^\]\n]+)\](?:${DEST}|\[[^\]\n]*\])`, 'g'), '$1');
  s = s.replace(/^[ \t]{0,3}\[[^\]\n]+\]:[ \t]*\S.*$/gm, '');
  // Tags go: a line break tag and the end of a block become a line break, any other tag nothing.
  s = s.replace(/<br\s*\/?>/gi, '\n');
  s = s.replace(/<\/(?:p|div|li|h[1-6]|blockquote|pre|tr|ul|ol|table)\s*>/gi, '\n');
  s = s.replace(/<\/?[A-Za-z][A-Za-z0-9-]*(?:\s[^<>]*)?\/?>/g, '');
  // Line by line: quote markers, headings, rules and headings' underlines, list markers and task boxes.
  s = s.split('\n').map((raw) => {
    const line = raw.replace(/^[ \t]{0,3}(?:>[ \t]?)+/, '');
    const heading = /^[ \t]{0,3}#{1,6}(?:[ \t]+(.*?))?(?:[ \t]+#+)?[ \t]*$/.exec(line);
    if (heading) return heading[1] ?? '';
    if (/^[ \t]{0,3}(?:(?:-[ \t]*){3,}|(?:\*[ \t]*){3,}|(?:_[ \t]*){3,}|=+[ \t]*)$/.test(line)) return '';
    return line.replace(/^[ \t]*(?:[-*+]|\d{1,9}[.)])[ \t]+(?:\[[ xX]\][ \t]+)?/, '');
  }).join('\n');
  // Emphasis: a pair of marks at the edges of words, strongest first, twice for nesting; strikethrough too.
  const pair = (mark, c) => new RegExp(String.raw`(^|[^${WORD}${c}])${mark}(?=[^\s${c}])([^\n]*?[^\s${c}])${mark}(?![${WORD}${c}])`, 'gmu');
  const STAR = String.raw`\*`;
  for (let round = 0; round < 2; round += 1) {
    for (const [mark, c] of [[STAR.repeat(3), STAR], ['___', '_'], [STAR.repeat(2), STAR], ['__', '_'], [STAR, STAR], ['_', '_']]) s = s.replace(pair(mark, c), '$1$2');
    s = s.replace(/~~(?=\S)([^\n]*?\S)~~/g, '$1');
  }
  // Character references as the characters, then the kept characters back.
  s = s.replace(/&(#\d{1,7}|#x[0-9a-f]{1,6}|[a-z]+);/gi, (all, ref) => {
    if (ref[0] !== '#') return NAMED[ref.toLowerCase()] ?? all;
    const code = ref[1] === 'x' || ref[1] === 'X' ? parseInt(ref.slice(2), 16) : parseInt(ref.slice(1), 10);
    return code > 0 && code <= 0x10ffff && !(code >= 0xd800 && code <= 0xdfff) ? String.fromCodePoint(code) : all;
  });
  s = unhide(s);
  return s.split('\n').map((line) => line.replace(/[ \t]+$/, '')).join('\n').replace(/\n{3,}/g, '\n\n').trim();
}
