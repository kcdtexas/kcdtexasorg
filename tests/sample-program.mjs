// The sample program's names: a test build with --program-sample shows made-up Speakers and Sessions
// (src/data/program-sample-schedule.ts and the fixture, src/data/program-fixture.ts), never a real person's name.
//
// The records check compares the made-up data with every Edition's records in src/data/: the Speakers, hosts and
// Organizers of 2024 to 2027, the Session titles (the 2026 Schedule's included), the taglines as printed, and the
// companies (sponsors, Partners, employers and affiliations). No made-up name may equal a real one, or share both
// its first name and its surname; no made-up title or tagline may equal a real one, or a title share more than half
// of its longer words with one; and no made-up tagline or
// title may name a real company.
//
// The build check reads a --program-sample build's program pages (dist/2027/: the Schedule, the Session and Speaker
// pages, the Event Day page and the calendar files) and its Share Cards. No real Speaker's or host's name, no real
// Session title and no real tagline may appear in them, the head's card text included; the site footer, which lists
// the 2027 Organizers on every page, is left out. Each Share Card draws a Session's or a Speaker's own text, the same
// text the page shows, so its file name must be a made-up Session's or Speaker's too, as must every Speaker and
// Session page.
//
// tests/run-program.mjs runs both, the build check on the --program-sample and --program-sample=speakers builds.
// Usage: node tests/sample-program.mjs (the records check, and the build check when dist/ is a sample build)
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';
import { importTs } from '../scripts/lib/import-ts.mjs';

/** As src/lib/credits.ts matches names: ignoring case, accents, apostrophes and spacing. */
const norm = (s) => s.normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/[’‘']/g, '').replace(/\s+/g, ' ').trim().toLowerCase();
/** As src/lib/program.ts makes a page's slug. */
const slugOf = (s) => s.normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/['’]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 64).replace(/-+$/, '');
const firstLast = (name) => { const w = norm(name).split(' '); return `${w[0]} ${w.at(-1)}`; };
const unique = (list) => [...new Set(list.filter(Boolean))];

/** Every Edition's records in src/data/, loaded through Vite as the build loads them. */
export async function realRecords() {
  const vite = await createServer({ configFile: false, logLevel: 'silent', appType: 'custom', server: { middlewareMode: true, ws: false, watch: null }, optimizeDeps: { noDiscovery: true, include: [] } });
  try {
    const load = (file) => vite.ssrLoadModule(`/src/data/${file}.ts`);
    const [h2024, h2025, h2026, h2027] = await Promise.all(['2024', '2025', '2026', '2027'].map((y) => load(`history/${y}`).then((m) => m.default)));
    const { sessions2024, hosts2024 } = await load('program-2024');
    const { sessions2025, hosts2025 } = await load('program-2025');
    const { keynotes2026, speakers2026, hosts2026 } = await load('program-2026');
    const { sessions2026 } = await load('program-2026-schedule');
    const { edition2024 } = await load('edition-2024');
    const { edition2025 } = await load('edition-2025');
    const { edition2026 } = await load('edition-2026');
    const { about } = await load('about');
    const { returningSpeakers } = await load('returning-speakers');
    const { returningOrganizers } = await load('returning-organizers');

    const past = [...sessions2024, ...sessions2025];
    const people = [...past.flatMap((s) => s.speakers), ...hosts2024, ...hosts2025, ...keynotes2026, ...speakers2026, ...hosts2026];
    const sponsors = [edition2024, edition2025].flatMap((e) => e.tiers.flatMap((t) => t.sponsors))
      .concat(Object.values(edition2026.sponsors).flat());
    const partners = [edition2024, edition2025, edition2026].flatMap((e) => e.partners ?? []).flatMap((p) => p.names ?? []);
    return {
      names: unique([
        ...[h2024, h2025, h2026, h2027].flatMap((h) => [...(h.organizers?.names ?? []), ...(h.speakers?.names ?? [])]),
        ...people.map((p) => p.name),
        ...sessions2026.flatMap((s) => s.speakers),
        ...edition2026.talks.map((t) => t.name),
        ...edition2026.organizers.map((o) => o.name),
        ...about.organizers2027.map((o) => o.name),
        ...[...returningSpeakers, ...returningOrganizers].flatMap((r) => [r.name, ...r.earlier]),
      ]),
      titles: unique([...past, ...sessions2026, ...keynotes2026, ...speakers2026, ...edition2026.talks].map((s) => s.title)),
      // As a page prints a tagline: the printed lines on one line.
      taglines: unique(people.map((p) => p.printed.join(' · '))),
      companies: unique([
        ...people.filter((p) => p.printed.length > 1).map((p) => p.printed[0]),
        ...edition2026.talks.map((t) => t.affiliation),
        ...edition2026.organizers.map((o) => o.company),
        ...about.organizers2027.map((o) => o.employer),
        ...sponsors.map((s) => s.name),
        ...partners,
      ]),
    };
  } finally {
    await vite.close();
  }
}

/** The test program's made-up Speakers and Sessions. */
export async function madeUpRecords() {
  const sample = await importTs(new URL('../src/data/program-sample-schedule.ts', import.meta.url));
  const fixture = await importTs(new URL('../src/data/program-fixture.ts', import.meta.url));
  const speakers = [...sample.sampleSpeakers, ...fixture.fixtureSpeakers];
  const sessions = [...sample.sampleSessions, ...fixture.fixtureSessions];
  return {
    names: speakers.map((s) => s.name),
    titles: sessions.map((s) => s.title),
    taglines: unique(speakers.map((s) => s.tagline)),
  };
}

/** The records check: one line per made-up name, title or tagline that is real. */
export function checkRecords(real, made) {
  const failures = [];
  const realNames = new Set(real.names.map(norm));
  const realPairs = new Set(real.names.map(firstLast));
  for (const name of made.names) {
    if (realNames.has(norm(name))) failures.push(`"${name}" is a real Speaker's, host's or Organizer's name`);
    else if (realPairs.has(firstLast(name))) failures.push(`"${name}" has a real person's first name and surname`);
  }
  const realTitles = new Set(real.titles.map(norm));
  for (const title of made.titles) if (realTitles.has(norm(title))) failures.push(`"${title}" is a real Session's title`);
  // Nor a real title reworded: no made-up title shares more than half of its words (of four letters or more) with one.
  const words = (t) => new Set(norm(t).split(/[^a-z0-9]+/).filter((w) => w.length >= 4));
  for (const title of made.titles) {
    const mine = words(title);
    for (const r of real.titles) {
      const shared = [...words(r)].filter((w) => mine.has(w)).length;
      if (mine.size && shared / mine.size > 0.5) failures.push(`"${title}" shares ${shared} of its ${mine.size} words with the real title "${r}"`);
    }
  }
  const realTaglines = new Set(real.taglines.map(norm));
  for (const tagline of made.taglines) if (realTaglines.has(norm(tagline))) failures.push(`"${tagline}" is a real Speaker's tagline`);
  // A company as a whole word, so a short one never matches inside another word.
  const escape = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  for (const company of real.companies.filter((c) => c.trim().length >= 3)) {
    const pattern = new RegExp(`(?<![\\p{L}\\p{N}])${escape(norm(company))}(?![\\p{L}\\p{N}])`, 'u');
    for (const text of [...made.taglines, ...made.titles]) if (pattern.test(norm(text))) failures.push(`"${text}" names a real company or Partner (${company})`);
  }
  return failures;
}

const walk = (dir) => readdirSync(dir).flatMap((n) => { const p = join(dir, n); return statSync(p).isDirectory() ? walk(p) : [p]; });
const decode = (html) => html.replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n))).replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
  .replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');

/** The build check on dist/: one line per real name, title or tagline found, and per page or card not made up. */
export function checkSampleBuild(real, made, dist = 'dist') {
  const failures = [];
  const program = join(dist, '2027');
  const pages = walk(program).filter((f) => {
    const path = relative(program, f).split(sep).join('/');
    return /^(?:schedule|sessions|speakers|today)\//.test(path) && /\.(?:html|ics)$/.test(path) || /^[^/]+\.ics$/.test(path);
  });
  if (!pages.some((f) => f.endsWith(join('speakers', 'index.html')))) return [`${program}: no Speakers page; build with --program-sample first`];
  // Whole names and titles, and taglines long enough not to be a common job title alone.
  const needles = [
    ...real.names.filter((n) => n.trim().includes(' ')).map((n) => ['a real name', n]),
    ...real.titles.filter((t) => t.length >= 16).map((t) => ['a real title', t]),
    ...real.taglines.filter((t) => t.length >= 16).map((t) => ['a real tagline', t]),
  ].map(([what, s]) => [what, s, norm(s)]);
  for (const file of pages) {
    // An .ics folds its long lines: unfold them first.
    const raw = readFileSync(file, 'utf8').replace(/\r?\n[ \t]/g, '').replace(/\\([,;\\])/g, '$1');
    const text = norm(decode(raw.replace(/<footer class="site-footer"[^>]*>[\s\S]*?<\/footer>/, '')).replace(/<[^>]+>/g, ' '));
    for (const [what, s, n] of needles) if (text.includes(n)) failures.push(`${file}: ${what}: ${s}`);
  }
  // Every Speaker and Session page, and every Share Card, is a made-up one's.
  const speakerSlugs = new Set(made.names.map(slugOf));
  const sessionSlugs = new Set(made.titles.map(slugOf));
  const dirs = (d) => (existsSync(d) ? readdirSync(d).filter((n) => statSync(join(d, n)).isDirectory()) : []);
  for (const slug of dirs(join(program, 'speakers'))) if (!speakerSlugs.has(slug)) failures.push(`${program}/speakers/${slug}/: not a made-up Speaker's page`);
  for (const slug of dirs(join(program, 'sessions'))) if (!sessionSlugs.has(slug)) failures.push(`${program}/sessions/${slug}/: not a made-up Session's page`);
  const cards = readdirSync(join(dist, 'cards')).filter((n) => /^(?:session|speaker)-/.test(n));
  if (!cards.length) failures.push(`${dist}/cards: no Share Cards`);
  for (const card of cards) {
    const [, kind, slug] = card.match(/^(session|speaker)-(.+)\.png$/) ?? [];
    if (!(kind === 'session' ? sessionSlugs : speakerSlugs).has(slug)) failures.push(`${dist}/cards/${card}: not a made-up ${kind ?? 'program'}'s Share Card`);
  }
  return failures;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const real = await realRecords();
  const made = await madeUpRecords();
  const failures = checkRecords(real, made);
  let builds = 0;
  if (existsSync('dist/.test-build') && existsSync('dist/2027/speakers/fixture-speaker-1')) {
    builds = 1;
    failures.push(...checkSampleBuild(real, made));
  }
  for (const f of failures) console.error(`✗ ${f}`);
  console.log(`Sample program: ${made.names.length} made-up names, ${made.titles.length} titles and ${made.taglines.length} taglines against ${real.names.length} real names, ${real.titles.length} titles, ${real.taglines.length} taglines and ${real.companies.length} companies${builds ? ', and the sample build in dist/' : ''}: ${failures.length ? `${failures.length} failures` : 'no match'}.`);
  process.exit(failures.length ? 1 : 0);
}
