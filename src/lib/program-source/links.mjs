// A Speaker's link kind, from its address first and the platform's label second. Sessionize sends GitHub and
// Bluesky as "Other" with a free-text title, so the host decides; Twitter becomes x, a company website or a blog
// becomes site, and Sessionize's own profile link, Instagram and Facebook are dropped (null).
const HOSTS = [
  [/(^|\.)github\.com$/, 'github'],
  [/(^|\.)bsky\.app$/, 'bluesky'],
  [/(^|\.)linkedin\.com$/, 'linkedin'],
  [/(^|\.)(twitter|x)\.com$/, 'x'],
  [/(^|\.)(sessionize|instagram|facebook|fb)\.com$/, null],
];
const LABELS = [
  [/^twitter$|^x$/i, 'x'],
  [/^linkedin$/i, 'linkedin'],
  [/^(company_website|blog|website|web site|site|homepage|home page|portfolio)$/i, 'site'],
  [/^mastodon$/i, 'mastodon'],
];

/**
 * @param {string} url
 * @param {{ type?: string | null, title?: string | null, fallback?: string | null }} [hint]
 *   Sessionize's linkType and title; `fallback` is the kind for an address nothing else names.
 * @returns {string | null}
 */
export function linkKind(url, { type = null, title = null, fallback = null } = {}) {
  let parsed;
  try { parsed = new URL(url); } catch { return null; }
  if (parsed.protocol !== 'https:') return null;
  const host = parsed.hostname.toLowerCase().replace(/^www\./, '');
  for (const [pattern, kind] of HOSTS) if (pattern.test(host)) return kind;
  if (/^sessionize$|^instagram$|^facebook$/i.test(type ?? '')) return null;
  for (const label of [type, title]) {
    for (const [pattern, kind] of LABELS) if (label && pattern.test(label.trim())) return kind;
  }
  // A Mastodon profile is https://<server>/@<name>.
  if (/^\/@[\w.-]+\/?$/.test(parsed.pathname)) return 'mastodon';
  return fallback;
}

/** The links with a kind, the first of each kind, in the order given. */
export function mapLinks(links, fallback = null) {
  const out = [];
  for (const l of links) {
    const kind = linkKind(l.url, { type: l.type, title: l.title, fallback });
    if (kind && !out.some((o) => o.kind === kind)) out.push({ kind, url: l.url });
  }
  return out;
}
