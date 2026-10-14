// The loyalty credits as the built pages print them (dist/ from a normal build). Each past Edition's page prints
// exactly the credits its history gives as of that Edition, for its Organizers, Speakers and sponsors; the first
// Edition prints none; the home page's 2026 wall matches /2026/'s; no credit's year is typed by hand in src/; and every
// Organizer card has a photo or initials. The home page's Organizers match About's.
// tests/run-local.mjs runs it; tests/run-program.mjs checks the credits' layout and the tier sizes in a browser.
// Usage: node tests/credits-pages.mjs
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { build } from 'esbuild';

const failures = [];
let checks = 0;
const expect = (ok, message) => { checks += 1; if (!ok) failures.push(message); };

if (!existsSync('dist/index.html')) {
  console.error('dist/ is missing. Run scripts/build.sh first.');
  process.exit(1);
}
if (existsSync('dist/.test-build')) {
  console.log('Credits on the pages: skipped, dist/ is a test build.');
  process.exit(0);
}

// The past Editions' history files and the credits' rules, bundled from src/ as the build reads them.
const PAST = [2024, 2025, 2026];
const entry = [
  ...PAST.map((y) => `export { default as h${y} } from './src/data/history/${y}.ts';`),
  "export { creditFor, norm } from './src/lib/credits.ts';",
  "export { returningOrganizers, heldOrganizers } from './src/data/returning-organizers.ts';",
  "export { returningSpeakers } from './src/data/returning-speakers.ts';",
  "export { edition2024 } from './src/data/edition-2024.ts';",
  "export { edition2025 } from './src/data/edition-2025.ts';",
  "export { edition2026 } from './src/data/edition-2026.ts';",
  "export { edition2027 } from './src/data/edition-2027.ts';",
].join('\n');
const bundled = await build({ stdin: { contents: entry, resolveDir: process.cwd(), loader: 'ts' }, bundle: true, write: false, format: 'esm', platform: 'node', logLevel: 'silent' });
const m = await import(`data:text/javascript;base64,${Buffer.from(bundled.outputFiles[0].text).toString('base64')}`);
const history = PAST.map((y) => m[`h${y}`]);
const editions = [...PAST, m.edition2027.year];
const first = Math.min(...editions);

// A person's other names, from the confirmed lists; a held Organizer gets none.
const aliases = { organizers: m.returningOrganizers, speakers: m.returningSpeakers, sponsors: [] };
const namesOf = (kind, key) => {
  const same = aliases[kind].find((r) => [r.name, ...r.earlier].some((n) => m.norm(n) === m.norm(key)));
  return same ? [key, same.name, ...same.earlier] : [key];
};
/** What a credit prints for `key` in `kind`, as of `year`, from the history; null for none. */
const expected = (kind, key, year) => {
  const keys = namesOf(kind, key);
  if (kind === 'organizers' && m.heldOrganizers.some((h) => keys.some((k) => m.norm(k) === m.norm(h.name)))) return null;
  const c = m.creditFor(history, kind, keys, { editions, current: year, from: first });
  return c ? `${kind === 'sponsors' ? 'Since' : kind === 'speakers' ? 'Speaker since' : 'Organizer since'} ${c.since}` : null;
};
const read = (path) => readFileSync(join('dist', path), 'utf8');
const decode = (s) => s.replace(/&#39;|&#x27;/g, "'").replace(/&amp;/g, '&').replace(/&quot;/g, '"').trim();

/** A page's printed credits: each one with the name or logo it follows, in page order. */
const printed = (html) => [...html.matchAll(/(?:<b>([^<]+)<\/b>|<h3 class="(?:pg-kn-name|kn-name)"[^>]*>([^<]+)<\/h3>|data-logo="([^"]+)"|<span class="sp-name"[^>]*>([^<]+)<\/span>|<span class="credit"[^>]*>([^<]+)<\/span>)/g)]
  .reduce((list, x) => {
    const label = x[1] ?? x[2] ?? x[3] ?? x[4];
    if (label) list.last = decode(label);
    else list.push([list.last, decode(x[5])]);
    return list;
  }, Object.assign([], { last: null }));
const section = (html, id) => html.match(new RegExp(`<section[^>]*aria-labelledby="${id}"[\\s\\S]*?</section>`))?.[0] ?? '';
const same = (got, want, where) => {
  const g = got.map(([n, c]) => `${n}: ${c}`).sort().join('; ');
  const w = want.map(([n, c]) => `${n}: ${c}`).sort().join('; ');
  expect(g === w, `${where}: prints ${g || 'no credit'}; the history gives ${w || 'none'}`);
};

// 1. Each past Edition's page: its credits, kind by kind, are exactly the history's as of that Edition.
const tiersOf = { 2024: m.edition2024.tiers, 2025: m.edition2025.tiers };
for (const year of PAST) {
  const html = read(`${year}/index.html`);
  const h = history.find((x) => x.year === year);
  const want = (kind, keys, label = (k) => k) => keys.map((k) => [label(k), expected(kind, k, year)]).filter(([, c]) => c);
  same(printed(section(html, 'organizers')), want('organizers', h.organizers.names), `/${year}/ Organizers`);
  same(printed(section(html, 'keynotes') + section(html, 'program')), want('speakers', h.speakers.names), `/${year}/ Speakers`);
  // A sponsor with a logo shows its id (data-logo); one without shows its name.
  const logoLabel = (id) => {
    const s = (tiersOf[year] ?? []).flatMap((t) => t.sponsors).find((x) => x.id === id);
    return s && !s.logo ? s.name : id;
  };
  same(printed(section(html, 'sponsors')), want('sponsors', h.sponsors.ids, logoLabel), `/${year}/ sponsors`);
}

// 2. The first Edition prints no credit at all.
expect(!/class="credit"/.test(read(`${first}/index.html`)), `/${first}/, the first Edition, prints a credit`);

// 3. The 2026 wall prints the same credits wherever it shows.
const wall2026 = printed(section(read('2026/index.html'), 'sponsors')).filter(([, c]) => /^Since /.test(c));
for (const path of ['index.html', '2027/sponsors/index.html']) {
  const html = read(path);
  // The 2026 wall: its tiers, up to the Partners line (edition2026.partners).
  const wall = html.match(/<div class="tiers">(?:(?!<div class="tiers">)[\s\S])*?<p class="partners">/g)?.at(-1) ?? '';
  if (!wall) continue;
  same(printed(wall), wall2026, `/${path.replace(/index\.html$/, '')} 2026 wall`);
}

// 4. Every Organizer card has a photo or initials; the 2024 page's initials are the people with no headshot.
const cards = (html) => [...(section(html, 'organizers') || section(html, 'team-title')).matchAll(/<li>([\s\S]*?)<\/li>/g)].map((x) => x[1]);
for (const path of ['index.html', 'about/index.html', '2026/index.html', '2025/index.html', '2024/index.html']) {
  const html = read(path);
  const list = cards(html);
  expect(list.length > 0, `/${path.replace(/index\.html$/, '')}: no Organizer cards`);
  for (const c of list) {
    const name = c.match(/<b>([^<]+)<\/b>/)?.[1];
    const img = c.match(/<img[^>]*class="pg-org-photo"[^>]*>/)?.[0];
    const photo = Boolean(img) && /\salt(?:="")?[\s>]/.test(img);
    const initials = /<svg[^>]*class="pg-org-photo"[^>]*aria-hidden="true"[\s\S]*?<text[^>]*>\p{L}{1,2}<\/text>/u.test(c);
    expect(name && (photo || initials), `/${path.replace(/index\.html$/, '')}: ${name ?? 'a card'} has neither a photo with empty alt nor initials`);
  }
}
const initialsOn = (path) => cards(read(path)).filter((c) => /<svg[^>]*class="pg-org-photo"/.test(c)).map((c) => c.match(/<b>([^<]+)<\/b>/)[1]).join(', ');
expect(initialsOn('2024/index.html') === 'Chris Aniszczyk, Jim Angel, Laura Santamaria, Aly Ibrahim, Joaquin Rodriguez, Moeez Mustafa, Alvin Estrada',
  `/2024/: initials for ${initialsOn('2024/index.html')}`);
for (const path of ['2025/index.html', '2026/index.html']) expect(!initialsOn(path), `/${path.replace(/index\.html$/, '')}: initials for ${initialsOn(path)}`);
// The past cards print no title: the 2024 and 2025 records have none.
for (const year of [2024, 2025]) expect(!/class="pg-aff"/.test(section(read(`${year}/index.html`), 'organizers')), `/${year}/: an Organizer card prints a title`);

// 5. The home page's Organizers are About's, with the same credits.
const team = (html) => cards(html).map((c) => `${c.match(/<b>([^<]+)<\/b>/)[1]}: ${c.match(/<span class="credit">([^<]+)<\/span>/)?.[1] ?? '-'}`).join('; ');
expect(team(read('index.html')) === team(read('about/index.html')), `the home page's Organizers differ from About's:\n  ${team(read('index.html'))}\n  ${team(read('about/index.html'))}`);

// 6. No credit's year is typed by hand: no "since 2025" in the site's source.
const files = (dir) => readdirSync(dir).flatMap((f) => (statSync(join(dir, f)).isDirectory() ? files(join(dir, f)) : [join(dir, f)]));
for (const file of files('src').filter((f) => /\.(?:astro|ts|tsx|yaml|md)$/.test(f))) {
  const hit = readFileSync(file, 'utf8').match(/\b(?:Sponsor|Organizer|Speaker) since \d{4}\b|['"`>]Since \d{4}\b/);
  // Comments may name an example year; printed words may not.
  const line = hit && readFileSync(file, 'utf8').split('\n').find((l) => l.includes(hit[0]));
  expect(!line || /^\s*(?:\/\/|\*|\/\*)/.test(line), `${file}: "${hit?.[0]}" typed by hand`);
}

if (failures.length) {
  console.error(`Credits on the pages: ${failures.length} of ${checks} checks failed:`);
  for (const f of failures) console.error(`  ✗ ${f}`);
  process.exit(1);
}
console.log(`Credits on the pages passed: ${checks} checks.`);
