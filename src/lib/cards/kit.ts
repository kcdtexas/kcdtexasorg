// The broadcast kit's building blocks for build-time images: the dark theme's tokens, Archivo, and
// helpers to draw with satori. Colors come from src/foundation/tokens.css, so the cards follow the site.
// Everything is read from disk at build time; nothing is fetched from the network.
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import sharp from 'sharp';

const root = (path: string) => resolve(process.cwd(), path);

/** The dark theme's tokens (the screen block for data-theme="dark"), plus --gold from the root. */
function darkTokens(): Record<string, string> {
  const css = readFileSync(root('src/foundation/tokens.css'), 'utf8');
  const block = (selector: string) => {
    const start = css.indexOf(selector);
    if (start < 0) throw new Error(`tokens.css: ${selector} not found`);
    return css.slice(css.indexOf('{', start) + 1, css.indexOf('}', start));
  };
  const read = (body: string) =>
    Object.fromEntries([...body.matchAll(/--([\w-]+):\s*([^;]+);/g)].map((m) => [m[1], m[2].trim()]));
  return { ...read(block(':root {')), ...read(block(':root[data-theme="dark"]')) };
}

const t = darkTokens();
/** Gold for highlights, magenta only for actions, as on the site's dark theme. */
export const color = {
  bg: t.bg,
  fg: t.fg,
  muted: t.muted,
  line: t.line,
  surface: t.surface,
  gold: t.gold,
  onGold: t['on-signal'],
  action: t.action,
  onAction: t['on-action'],
  tile: t.tile,
};

const font = (file: string) => readFileSync(root(`src/assets/fonts/archivo/${file}`));
/** Static Archivo instances (OFL), made from the site's variable font with fonttools. */
export const fonts = [
  { name: 'Archivo', data: font('Archivo-Regular.ttf'), weight: 400 as const, style: 'normal' as const },
  { name: 'Archivo', data: font('Archivo-Bold.ttf'), weight: 700 as const, style: 'normal' as const },
  { name: 'Archivo SemiCondensed', data: font('Archivo-SemiCondensed-ExtraBold.ttf'), weight: 800 as const, style: 'normal' as const },
  { name: 'Archivo Condensed', data: font('Archivo-Condensed-Black.ttf'), weight: 900 as const, style: 'normal' as const },
];

/** Type styles: the site's headline (62% wide, 900), section title (68%, 800) and text. */
export const type = {
  display: { fontFamily: 'Archivo Condensed', fontWeight: 900, lineHeight: 0.92, textTransform: 'uppercase' as const },
  head: { fontFamily: 'Archivo SemiCondensed', fontWeight: 800, lineHeight: 1.05 },
  label: { fontFamily: 'Archivo', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase' as const },
  text: { fontFamily: 'Archivo', fontWeight: 400, lineHeight: 1.3 },
  bold: { fontFamily: 'Archivo', fontWeight: 700, lineHeight: 1.3 },
};

export type Node = { type: string; props: Record<string, unknown> };
type Style = Record<string, unknown>;
type Child = Node | string | false | null | undefined;

/** A satori element. Every box is a flex box, as satori requires for more than one child. */
export function h(type: string, style: Style, ...children: Child[]): Node {
  const kids = children.filter((c): c is Node | string => Boolean(c));
  return { type, props: { style: { display: 'flex', ...style }, children: kids.length === 1 ? kids[0] : kids } };
}

export function img(src: string, width: number, height: number, style: Style = {}): Node {
  return { type: 'img', props: { src, width, height, style } };
}

/** A photo, cropped to cover the box and resized to its size, as a JPEG data URI. */
export async function photo(path: string, width: number, height: number, position = 'centre'): Promise<string> {
  const jpeg = await sharp(root(path)).resize(width, height, { fit: 'cover', position }).jpeg({ quality: 82 }).toBuffer();
  return `data:image/jpeg;base64,${jpeg.toString('base64')}`;
}

/** A PNG asset (such as the badge), resized, as a data URI. */
export async function png(path: string, width: number): Promise<string> {
  const out = await sharp(root(path)).resize({ width }).png().toBuffer();
  return `data:image/png;base64,${out.toString('base64')}`;
}

/** A sponsor logo as an SVG data URI, with its aspect ratio from the viewBox. */
export function logo(id: string): { src: string; ar: number } {
  const svg = readFileSync(root(`src/assets/logos/${id}.svg`), 'utf8');
  const box = svg.match(/viewBox="([^"]+)"/)?.[1].trim().split(/[\s,]+/).map(Number);
  if (!box || box.length !== 4) throw new Error(`logo ${id}: no viewBox`);
  return { src: `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`, ar: box[2] / box[3] };
}

/** The lower third's grammar: a gold chip, then a plate. */
export function chip(text: string, size: number): Node {
  return h('div', { padding: `${Math.round(size * 0.3)}px ${Math.round(size * 0.5)}px`, background: color.gold, color: color.onGold, fontSize: size, ...type.label, letterSpacing: '0.08em', lineHeight: 1 }, text);
}

/** A door: a tag naming the audience and an action plate in the action color. */
export function door(tag: string, action: string, size: number): Node {
  return h('div', { alignItems: 'stretch' },
    h('div', { alignItems: 'center', padding: `0 ${Math.round(size * 0.6)}px`, background: color.fg, color: color.bg, fontSize: size * 0.8, ...type.label }, tag),
    h('div', { alignItems: 'center', padding: `${Math.round(size * 0.55)}px ${Math.round(size * 0.75)}px`, background: color.action, color: color.onAction, fontSize: size, ...type.bold, lineHeight: 1 }, action),
  );
}
