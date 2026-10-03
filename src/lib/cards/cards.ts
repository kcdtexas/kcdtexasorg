// The launch social cards, 1200 × 630, in the broadcast kit (docs: the private broadcast kit spec).
// Words and dates come from the data files; the build draws them with satori and resvg.
import satori from 'satori';
import { Resvg } from '@resvg/resvg-js';
import sharp from 'sharp';
import { edition2027, shortDate } from '../../data/edition-2027';
import { edition2026 } from '../../data/edition-2026';
import { currentEdition, prospectus } from '../../data/site';
import { cfp } from '../../data/cfp';
import { color, fonts, type, h, img, photo, png, logo, chip, door, type Node } from './kit';

export const CARD = { width: 1200, height: 630 } as const;
const PAD = 56;
const domain = 'kcdtexas.org';
const dateLine = `${currentEdition.city} · ${currentEdition.when}`;

/** The title card: the room photo, the 2027 badge, the gold date line. The default link preview. */
async function titleCard(): Promise<Node> {
  const bandH = 318;
  const badge = 236;
  return h('div', { width: CARD.width, height: CARD.height, flexDirection: 'column', background: color.bg, color: color.fg },
    img(await photo('src/assets/photos/band-043-171.jpg', CARD.width, bandH), CARD.width, bandH),
    h('div', { height: 6, background: color.gold }),
    h('div', { flex: 1, alignItems: 'center', padding: `0 ${PAD}px`, gap: 40 },
      img(await png('src/assets/brand/badge-2027-600.png', badge * 2), badge, Math.round(badge * 586 / 600), { marginTop: -150 }),
      h('div', { flex: 1, flexDirection: 'column', gap: 14 },
        h('div', { fontSize: 24, color: color.muted, ...type.label }, 'Kubernetes Community Days'),
        h('div', { fontSize: 62, ...type.head }, `KCD Texas ${edition2027.year}`),
        h('div', { fontSize: 58, color: color.gold, ...type.display, textTransform: 'none', lineHeight: 1 }, dateLine),
      ),
    ),
    h('div', { position: 'absolute', right: PAD, bottom: 30, fontSize: 24, color: color.muted, ...type.bold }, domain),
  );
}

/** The sponsor board: past sponsors by tier on white tiles, Platinum largest, as on the site's wall. */
function sponsorCard(): Node {
  // Sizes follow wall.css: every logo in a tier covers the same area (height = size / sqrt(aspect)),
  // Platinum 1.5× Gold, Silver 0.75×; Grafana Labs' square mark a little larger, optically.
  const gold = 48;
  const boost: Record<string, number> = { grafana: 1.15 };
  const gap = 10;
  const inner = CARD.width - 2 * PAD;
  const goldCell = (inner - 7 * gap) / 8;
  const tiers = [
    { name: 'Platinum', list: edition2026.sponsors.platinum, size: 1.5 * gold, cell: 2 * goldCell + gap, cellH: 1.5 * gold + 22 },
    { name: 'Gold', list: edition2026.sponsors.gold, size: gold, cell: goldCell, cellH: 1.12 * gold + 18 },
    { name: 'Silver', list: edition2026.sponsors.silver, size: 0.75 * gold, cell: goldCell, cellH: 0.75 * gold + 16 },
  ];
  const tile = (id: string, size: number, cell: number, cellH: number) => {
    const { src, ar } = logo(id);
    let lh = (size * (boost[id] ?? 1)) / Math.sqrt(ar);
    lh = Math.min(lh, (cell - 16) / ar); // never wider than the tile
    return h('div', { width: cell, height: cellH, alignItems: 'center', justifyContent: 'center', background: color.tile },
      img(src, Math.round(lh * ar), Math.round(lh)));
  };
  return h('div', { width: CARD.width, height: CARD.height, flexDirection: 'column', padding: `36px ${PAD}px 0`, background: color.bg, color: color.fg },
    h('div', { alignItems: 'center', gap: 18 },
      chip(String(edition2027.year), 30),
      h('div', { fontSize: 76, ...type.display, lineHeight: 0.9 }, 'Sponsorships are open'),
    ),
    h('div', { marginTop: 18, alignItems: 'center', justifyContent: 'space-between' },
      door('Sponsors', prospectus.label, 26),
      h('div', { fontSize: 28, ...type.bold }, domain),
    ),
    h('div', { marginTop: 26, fontSize: 28, ...type.head }, `${edition2026.sponsorCount} companies backed KCD Texas ${edition2026.year}`),
    ...tiers.flatMap((tr) => [
      // The tier name between two rules, as on the site's wall.
      h('div', { marginTop: 10, alignItems: 'center', gap: 16, fontSize: 18, color: color.muted, ...type.label },
        h('div', { flex: 1, height: 1, background: color.line }), tr.name, h('div', { flex: 1, height: 1, background: color.line })),
      h('div', { marginTop: 8, justifyContent: 'center', gap },
        ...tr.list.map((s) => tile(s.id, tr.size, tr.cell, tr.cellH))),
    ]),
  );
}

/** The scoreboard: the call for proposals, its dates and the End-User Story invitation. */
function cfpCard(): Node {
  const cell = (item: string, status: string, last = false) =>
    h('div', { flex: 1, flexDirection: 'column', gap: 8, padding: '18px 0 20px', borderRight: last ? 'none' : `1px solid ${color.line}`, paddingLeft: last ? 32 : 0 },
      h('div', { fontSize: 22, color: color.muted, ...type.label }, item),
      h('div', { fontSize: 72, color: color.gold, ...type.display, textTransform: 'none', lineHeight: 0.95 }, status),
    );
  return h('div', { width: CARD.width, height: CARD.height, flexDirection: 'column', padding: `44px ${PAD}px 0`, background: color.bg, color: color.fg },
    h('div', { alignItems: 'center', gap: 18 },
      chip(String(edition2027.year), 26),
      h('div', { fontSize: 26, color: color.muted, ...type.label }, `KCD Texas · ${dateLine}`),
    ),
    h('div', { marginTop: 22, fontSize: 92, ...type.display, lineHeight: 0.9, flexDirection: 'column' },
      h('div', {}, 'The call for'), h('div', {}, 'proposals is open')),
    h('div', { marginTop: 30, borderTop: `3px solid ${color.fg}`, borderBottom: `1px solid ${color.line}` },
      cell('Opens', shortDate(edition2027.cfp.opens)),
      cell('Closes', shortDate(edition2027.cfp.closes), true),
    ),
    h('div', { marginTop: 22, alignItems: 'center', justifyContent: 'space-between' },
      h('div', { fontSize: 28, ...type.bold }, cfp.endUser.cardLine),
    ),
    h('div', { position: 'absolute', left: PAD, bottom: 34 }, door('Speakers', `Submit a talk at ${domain}`, 26)),
  );
}

export const cards = {
  default: {
    draw: titleCard,
    alt: `A KCD Texas ${edition2026.year} session room above the KCD Texas badge and the line “${dateLine}”.`,
  },
  sponsorships: {
    draw: sponsorCard,
    alt: `Sponsorships for KCD Texas ${edition2027.year} are open. The ${edition2026.sponsorCount} companies that backed KCD Texas ${edition2026.year}, by tier.`,
  },
  cfp: {
    draw: cfpCard,
    alt: `The KCD Texas ${edition2027.year} call for proposals is open, from ${shortDate(edition2027.cfp.opens)} to ${shortDate(edition2027.cfp.closes)}.`,
  },
} satisfies Record<string, { draw: () => Node | Promise<Node>; alt: string }>;

export type CardId = keyof typeof cards;

/** Draws a card as an optimized PNG (palette-quantized, so photo cards stay under 300 KB). */
export async function renderCard(id: CardId): Promise<Buffer> {
  const svg = await satori((await cards[id].draw()) as never, { ...CARD, fonts });
  const raw = new Resvg(svg, { fitTo: { mode: 'width', value: CARD.width }, font: { loadSystemFonts: false } }).render().asPng();
  return sharp(raw).png({ palette: true, quality: 90, effort: 10, compressionLevel: 9 }).toBuffer();
}
