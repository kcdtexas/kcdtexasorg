// The program's Share Cards (CONTEXT.md), 1200 × 630, in the broadcast kit: one per Session and one per Speaker,
// "I'm speaking at KCD Texas 2027". Drawn at build time like the site's cards, only while a program gate is open.
// A build-time budget caps how many are drawn, so the daily and Event Day rebuilds stay fast; past the cap a page
// keeps the title card.
import { edition2027, shortDate } from '../../data/edition-2027';
import { formatName, program, sessionsOf, speakersOf, timeRange, type Session, type Speaker } from '../program';
import { CARD } from './cards';
import { chip, color, h, img, photo, type, type Node } from './kit';

/** At most this many program cards per build. A Session's card takes about 0.1 s to draw and a Speaker's about 0.85 s,
 *  its photo band most of it; tests/run-program.mjs holds 150 of them to a time budget. */
export const PROGRAM_CARD_BUDGET = 150;
const PAD = 56;
const domain = 'kcdtexas.org';
// The year is in the chip beside it.
const dateLine = `KCD Texas · ${edition2027.city} · ${shortDate(edition2027.eventDay)}`;

type Entry = { id: string; alt: string; draw: () => Promise<Node> };

/** Where the "Sample" stamp sits: this far from the top and right edges, in a test build's cards. */
export const STAMP_INSET = 24;
// A test build's cards carry a "Sample" stamp, so a test image never passes for a real announcement.
const stamp = () => program?.sample
  ? h('div', { position: 'absolute', top: STAMP_INSET, right: STAMP_INSET, padding: '10px 20px', background: color.fg, color: color.bg, fontSize: 36, ...type.label, lineHeight: 1 }, 'Sample')
  : null;
const altOf = (alt: string) => (program?.sample ? `Sample: ${alt}` : alt);

/** Smaller type for longer words, so a title fits in its lines. */
const fit = (s: string, sizes: [number, number][]) => sizes.find(([max]) => s.length <= max)?.[1] ?? sizes.at(-1)![1];

function sessionCard(s: Session): Entry {
  const who = speakersOf(s).map((p) => p.name).join(', ');
  // A no-break space: satori drops a plain one after the hyphenated word in spaced capitals.
  const kind = [formatName[s.format], s.endUser ? 'End-User\u00a0Story' : ''].filter(Boolean).join(' · ');
  const cell = (label: string, value: string, last = false) =>
    h('div', { flex: last ? 1.4 : 1, flexDirection: 'column', gap: 6, padding: '14px 0 16px', paddingLeft: last ? 28 : 0, borderRight: last ? 'none' : `1px solid ${color.line}` },
      h('div', { fontSize: 20, color: color.muted, ...type.label }, label),
      h('div', { fontSize: 46, color: color.gold, ...type.display, textTransform: 'none', lineHeight: 1 }, value));
  return {
    id: `session-${s.slug}`,
    alt: altOf(`${s.title}, ${kind}${who ? `, by ${who}` : ''}, at KCD Texas ${edition2027.year}${s.start ? `, ${timeRange(s.start, s.end!)} Central, ${s.room}` : ''}.`),
    draw: async () => h('div', { width: CARD.width, height: CARD.height, flexDirection: 'column', padding: `40px ${PAD}px 0`, background: color.bg, color: color.fg },
      h('div', { alignItems: 'center', gap: 18 },
        chip(String(edition2027.year), 24),
        h('div', { fontSize: 22, color: color.muted, ...type.label }, dateLine)),
      h('div', { marginTop: 26, fontSize: 22, color: color.gold, ...type.label }, kind),
      h('div', { marginTop: 10, fontSize: fit(s.title, [[40, 76], [70, 62], [100, 52], [Infinity, 44]]), ...type.display, lineHeight: 0.95, maxHeight: 250, overflow: 'hidden' }, s.title),
      h('div', { marginTop: 16, fontSize: who.length > 60 ? 26 : 32, ...type.head }, who),
      s.start ? h('div', { position: 'absolute', left: PAD, right: PAD, bottom: 64, borderTop: `3px solid ${color.fg}`, borderBottom: `1px solid ${color.line}` },
        cell('Time (Central)', timeRange(s.start, s.end!)),
        cell('Room', s.room ?? '', true)) : null,
      h('div', { position: 'absolute', right: PAD, bottom: 22, fontSize: 22, color: color.muted, ...type.bold }, domain),
      stamp(),
    ),
  };
}

function speakerCard(p: Speaker): Entry {
  const first = sessionsOf(p)[0];
  const initials = p.name.split(/\s+/).filter((w) => /^\p{L}/u.test(w)).map((w) => w[0]).slice(0, 2).join('');
  const bandH = 200;
  return {
    id: `speaker-${p.slug}`,
    alt: altOf(`${p.name} is speaking at KCD Texas ${edition2027.year} in ${edition2027.city}${first ? `: ${first.title}` : ''}.`),
    draw: async () => h('div', { width: CARD.width, height: CARD.height, flexDirection: 'column', background: color.bg, color: color.fg },
      img(await photo('src/assets/photos/band-043-171.jpg', CARD.width, bandH), CARD.width, bandH),
      h('div', { height: 6, background: color.gold }),
      h('div', { flex: 1, padding: `0 ${PAD}px`, gap: 36, alignItems: 'flex-start' },
        // The photo's place, with the Speaker's initials: the card has no Speaker photo.
        h('div', { width: 220, height: 220, marginTop: -110, alignItems: 'center', justifyContent: 'center', background: color.surface, border: `6px solid ${color.bg}`, fontSize: 96, color: color.fg, ...type.display }, initials),
        h('div', { flex: 1, flexDirection: 'column', gap: 10, paddingTop: 30 },
          h('div', { fontSize: 24, color: color.gold, ...type.label }, `I’m speaking at KCD Texas ${edition2027.year}`),
          h('div', { fontSize: fit(p.name, [[18, 72], [28, 60], [Infinity, 50]]), ...type.head }, p.name),
          p.tagline ? h('div', { fontSize: 24, color: color.muted, ...type.text }, p.tagline) : null,
          first ? h('div', { marginTop: 8, fontSize: first.title.length > 70 ? 26 : 30, ...type.bold, maxHeight: 84, overflow: 'hidden' }, first.title) : null,
        ),
      ),
      h('div', { position: 'absolute', left: PAD, bottom: 26, fontSize: 24, color: color.muted, ...type.bold }, `${edition2027.city} · ${shortDate(edition2027.eventDay)}`),
      h('div', { position: 'absolute', right: PAD, bottom: 26, fontSize: 24, color: color.muted, ...type.bold }, domain),
      stamp(),
    ),
  };
}

/** Every program card this build draws: the Sessions, then the Speakers, up to the budget. */
export const programCards: Entry[] = program
  ? [...program.sessions.map(sessionCard), ...program.speakers.map(speakerCard)].slice(0, PROGRAM_CARD_BUDGET)
  : [];

/** A page's own card, or null past the budget. */
export function programCard(kind: 'session' | 'speaker', slug: string): { id: string; alt: string } | null {
  const c = programCards.find((x) => x.id === `${kind}-${slug}`);
  return c ? { id: c.id, alt: c.alt } : null;
}
