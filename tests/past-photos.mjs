// The photos on the Past Edition pages as the built pages show them (dist/ from a normal build), checked against the
// pages' data (src/data/page-2025.ts, src/data/page-2024.ts) and the owner's picks:
// - Each day (/2025/, /2024/): directly after the figures and their sources, directly before the keynotes, the owner's
//   three photos, each with its time, caption and alt text, then the photos' credit, and no link (the album at
//   photos.kcdtexas.org is 2026's). The first photo is the page's LCP element on phones and wide screens, so it alone
//   loads eagerly.
// - /2025/'s keynotes: a photo for each, as on /2026/, with its alt text, all lazy, and the credit.
// - /2025/'s team photo: above the Organizers' cards, its caption and credit under it, at most 640 px wide.
// - No srcset offers more pixels than the photo's file has, and no original photo file is published.
// - /2024/ keeps its text-only keynotes, has no team photo and shows none of 2025's photos. The home page's day keeps
//   its album link.
// tests/run-local.mjs runs it.
// Usage: node tests/past-photos.mjs
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { build } from 'esbuild';

const failures = [];
let checks = 0;
const expect = (ok, message) => { checks += 1; if (!ok) failures.push(message); };

if (!existsSync('dist/index.html')) {
  console.error('dist/ is missing. Run scripts/build.sh first.');
  process.exit(1);
}

// The pages' data as the build reads it. (src/data/home.ts needs Astro's import.meta.env, so the album's address
// comes from the 2026 Edition's file.)
const entry = [
  "export { page2025 } from './src/data/page-2025.ts';",
  "export { page2024 } from './src/data/page-2024.ts';",
  "export { edition2026 } from './src/data/edition-2026.ts';",
].join('\n');
const bundled = await build({ stdin: { contents: entry, resolveDir: process.cwd(), loader: 'ts' }, bundle: true, write: false, format: 'esm', platform: 'node', logLevel: 'silent' });
const { page2025: p, page2024: p24, edition2026 } = await import(`data:text/javascript;base64,${Buffer.from(bundled.outputFiles[0].text).toString('base64')}`);

const read = (path) => readFileSync(join('dist', path), 'utf8');
const decode = (s) => s.replace(/&#39;|&#x27;/g, "'").replace(/&amp;/g, '&').replace(/&quot;/g, '"');
const section = (html, id) => html.match(new RegExp(`<section[^>]*aria-labelledby="${id}"[\\s\\S]*?</section>`))?.[0] ?? '';
const imgs = (html) => html.match(/<img\b[^>]*>/g) ?? [];
const attr = (tag, name) => { const v = tag.match(new RegExp(`\\s${name}="([^"]*)"`))?.[1]; return v === undefined ? undefined : decode(v); };
/** The widths a srcset offers ("512w"), smallest first. */
const offered = (tag) => (attr(tag, 'srcset') ?? '').split(',').map((c) => Number(c.trim().split(/\s+/)[1]?.replace(/w$/, ''))).filter(Boolean);
/** A photo credit: it reads `want`, and its no-break spaces keep it on one line. */
const credits = (got, want) => typeof got === 'string' && got.replace(/\u00a0/g, ' ') === want && !/ /.test(got);

const y25 = read('2025/index.html');
const y24 = read('2024/index.html');

// 1. Each day: the owner's picks (each photo's file, the camera's time and the caption, in order, and the credit),
// directly between the figures' sources and the keynotes.
const DAYS = [
  {
    path: '/2025/', html: y25, page: p, title: 'A day at KCD Texas 2025', credit: 'Photos: Redford Lindsey.',
    picks: [
      ['2025-103', '10:36 a.m.', 'A full main hall for the keynotes.'],
      ['2025-230', '3:00 p.m.', 'The hallway track between sessions.'],
      ['2025-324', '5:15 p.m.', 'A prize from the closing raffle.'],
    ],
  },
  {
    path: '/2024/', html: y24, page: p24, title: 'A day at KCD Texas 2024', credit: 'Photos: the KCD Texas 2024 team.',
    picks: [
      ['2024-5359', '9:09 a.m.', 'The welcome, before the keynotes.'],
      ['2024-5370', '12:05 p.m.', 'A group photo on the terrace, with downtown Austin behind.'],
      ['2024-5374', '4:42 p.m.', 'Hack the Cluster, a hands-on security workshop.'],
    ],
  },
];
for (const { path, html, page, title, credit, picks } of DAYS) {
  const day = section(html, 'day');
  expect(Boolean(page.day) && day !== '', `${path} has no day section`);
  if (!page.day || !day) continue;
  const sources = html.match(/<p class="pg-src">Sources:[\s\S]*?<\/p>/)?.[0];
  expect(Boolean(sources) && html.includes(`${sources}${day}<section class="page-sec" aria-labelledby="keynotes">`),
    `${path}: the day is not directly between the figures' sources and the keynotes`);
  expect(page.day.title === title && new RegExp(`^<section class="page-sec page-wide" aria-labelledby="day"><h2 id="day" class="page-h2">${title}</h2>`).test(day),
    `${path}: the day doesn't open as a page section with the heading "${title}"`);
  const figures = [...day.matchAll(/<figure>([\s\S]*?)<\/figure>/g)].map((x) => x[1]);
  expect(figures.length === 3 && page.day.photos.length === 3, `${path}: the day shows ${figures.length} photos, not 3`);
  page.day.photos.forEach((photo, i) => {
    const fig = figures[i] ?? '';
    const img = imgs(fig)[0] ?? '';
    const [id, time, caption] = picks[i] ?? [];
    expect(photo.id === id && photo.time === time && photo.caption === caption,
      `${path} day photo ${i + 1}: ${photo.id} at ${photo.time}, "${photo.caption}", not the owner's ${id} at ${time}, "${caption}"`);
    expect(attr(img, 'alt') === photo.alt && photo.alt.trim() !== '', `${path} day photo ${i + 1}: alt "${attr(img, 'alt')}", not "${photo.alt}"`);
    expect(fig.includes(`<figcaption><b>${photo.time}</b> ${photo.caption}</figcaption>`), `${path} day photo ${i + 1}: no caption "${photo.time} ${photo.caption}"`);
    expect(new RegExp(`/_astro/${photo.id}\\.`).test(attr(img, 'src') ?? ''), `${path} day photo ${i + 1} isn't ${photo.id}`);
    expect(offered(img).join() === page.day.widths.join(), `${path} day photo ${i + 1} offers ${offered(img).join(', ')} px, not ${page.day.widths.join(', ')}`);
    // The first photo is the LCP element: eager and first in line. The others wait until they're near the screen.
    const first = i === 0;
    expect(attr(img, 'loading') === (first ? 'eager' : 'lazy') && attr(img, 'fetchpriority') === (first ? 'high' : undefined),
      `${path} day photo ${i + 1}: loading "${attr(img, 'loading')}", fetchpriority "${attr(img, 'fetchpriority')}"`);
  });
  expect(day.includes(`</div><p class="pg-src">${page.day.credit}</p></section>`) && credits(page.day.credit, credit),
    `${path}: the day has no "${credit}" line after the photos`);
  expect(!/<a\b/.test(day), `${path}: the day links somewhere (the album is 2026's only)`);
}

// 2. /2025/'s keynotes: a photo each, the photo layout of /2026/, lazy, credited.
const keynotes = section(y25, 'keynotes');
expect(keynotes.includes('<ul class="pg-keynotes">'), '/2025/: the keynotes are not in the photo layout');
const cards = [...keynotes.matchAll(/<li>([\s\S]*?)<\/li>/g)].map((x) => x[1]);
expect(cards.length === p.keynotes.sessions.length && cards.length === 3, `/2025/: ${cards.length} keynote cards`);
p.keynotes.sessions.forEach((k, i) => {
  const name = k.speakers[0].name;
  const photo = p.keynotes.photos?.[name];
  const img = imgs(cards[i] ?? '')[0] ?? '';
  expect(Boolean(photo) && attr(img, 'class') === 'pg-kn-photo', `/2025/: no keynote photo for ${name}`);
  expect(photo && attr(img, 'alt') === photo.alt && photo.alt.startsWith(`${name} `) && photo.alt.includes('KCD Texas 2025'),
    `/2025/: ${name}'s keynote photo has the alt "${attr(img, 'alt')}"`);
  expect((cards[i] ?? '').includes(`<h3 class="pg-kn-name">${name}`), `/2025/: keynote card ${i + 1} isn't ${name}'s`);
  expect(attr(img, 'loading') === 'lazy' && attr(img, 'fetchpriority') === undefined, `/2025/: ${name}'s keynote photo isn't lazy`);
});
expect(keynotes.includes(`</ul><p class="pg-src">${p.keynotes.photoCredit}</p></section>`) && credits(p.keynotes.photoCredit, 'Photos: Redford Lindsey.'),
  '/2025/: the keynotes have no "Photos: Redford Lindsey." line');

// 3. /2025/'s team photo: before the cards, with its caption and credit, at most 640 px wide.
const organizers = section(y25, 'organizers');
const g = p.organizers.group;
const team = organizers.match(/<h2 id="organizers" class="page-h2">[^<]*<\/h2><figure>([\s\S]*?)<\/figure><ul class="pg-org">/)?.[1] ?? '';
expect(Boolean(g) && team !== '', '/2025/: no team photo between the Organizers\' heading and their cards');
const teamImg = imgs(team)[0] ?? '';
expect(g && attr(teamImg, 'alt') === g.alt, `/2025/: the team photo's alt is "${attr(teamImg, 'alt')}"`);
expect(g && team.includes(`<figcaption class="pg-src">${g.caption} ${g.credit}</figcaption>`) && g.caption === 'The 2025 Organizers and volunteers.' && credits(g.credit, 'Photo: Redford Lindsey.'),
  '/2025/: the team photo\'s caption isn\'t "The 2025 Organizers and volunteers. Photo: Redford Lindsey."');
expect(attr(teamImg, 'width') === '640' && attr(teamImg, 'loading') === 'lazy', `/2025/: the team photo is ${attr(teamImg, 'width')} px wide, loading "${attr(teamImg, 'loading')}"`);

// 4. No srcset on /2025/, /2024/ or the home page offers more pixels than the file has: the largest width it offers
// is the file's own (Astro sets the width attribute to the file's when no width is given), or 1,024 px for the team
// photo.
for (const [path, html] of [['/2025/', y25], ['/2024/', y24], ['/', read('index.html')]]) {
  for (const img of imgs(html).filter((t) => attr(t, 'srcset'))) {
    const widest = Math.max(...offered(img));
    const file = attr(img, 'src');
    const limit = img === teamImg ? 1024 : Number(attr(img, 'width'));
    expect(widest <= limit, `${path}: ${file} offers ${widest} px, more than its ${limit} px`);
  }
}
// Reading a photo's width in a component publishes the original file too; none is.
const published = readdirSync('dist/_astro').filter((f) => /^(?:2025-\d+|2024-\d+|082|138|206)\.[^._]+\.jpg$/.test(f));
expect(!published.length, `original photo files published: ${published.join(', ')}`);

// 5. /2024/: text-only keynotes with no credit line, no team photo (the owner chose neither), none of 2025's photos.
// The home page: the 2026 day with its album link.
const keynotes24 = section(y24, 'keynotes');
expect(keynotes24.includes('<ul class="pg-keynotes pg-keynotes--text">') && !/<img\b/.test(keynotes24) && !/Photos?:/.test(keynotes24) && !p24.keynotes.photos && !p24.keynotes.photoCredit,
  '/2024/: the keynotes are not text-only');
expect(!/<figure>/.test(section(y24, 'organizers')) && !/Photos?:/.test(section(y24, 'organizers')) && !p24.organizers.group, '/2024/ has a team photo');
expect(!/Redford/.test(y24) && !/\/_astro\/2025-/.test(y24), '/2024/ shows 2025\'s photos');
const homeDay = read('index.html').match(/<section class="day" aria-labelledby="day-title">[\s\S]*?<\/section>/)?.[0] ?? '';
expect(new RegExp(`<p class="more"><a href="${edition2026.photosUrl}">[^<]+</a></p></div></section>$`).test(homeDay) && (homeDay.match(/<figure>/g) ?? []).length === 3,
  'the home page\'s day lost its photos or its album link');
expect(!homeDay.includes('pg-src') && imgs(homeDay).every((t) => offered(t).join() === '1000,2000' && attr(t, 'loading') === 'lazy'),
  'the home page\'s day changed: a credit, other sizes, or an eager photo');

if (failures.length) {
  console.error(`Photos on the past pages: ${failures.length} of ${checks} checks failed:`);
  for (const f of failures) console.error(`  ✗ ${f}`);
  process.exit(1);
}
console.log(`Photos on the past pages passed: ${checks} checks.`);
