// Sizes the hero's 2027 bill (Bill2027.astro, hero.css .slots) from the font's own metrics at build time, so
// the bill keeps filling the measure whatever its notes say. The widths come from HarfBuzz, the shaper Chromium,
// Firefox and Safari's text stacks share, run on Archivo at wdth 62 with default features (kerning on), the
// way the bill sets its type.
//
// HarfBuzz reads plain OpenType, not WOFF2, so the WOFF2 file is unpacked here (Brotli is in node:zlib) into a
// small sfnt that keeps only the tables shaping needs. The outlines (glyf, loca, gvar) are left out: advances
// come from hmtx and HVAR, kerning from GPOS.
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join } from 'node:path';
import { brotliDecompressSync } from 'node:zlib';

/** One note on the bill, rendered as `<li class="note"><b>{label}</b> {text}</li>`. */
export interface BillNote { label: string; text: string }
/** The bill's fit widths, in em: CSS sets the font size to 99.5cqi divided by them. */
export interface BillFits {
  /** The whole one-row bill: every note at 0.7em with its separator, then the end-user link. */
  fit: number;
  /** The notes alone at 1em with separators between them (the ≤1099px layout). */
  notesFit: number;
  /** The end-user link alone at 1em (the phone layout). */
  slotFit: number;
}

const FONT = 'public/fonts/archivo/archivo-latin-wdth-normal.woff2';
const WDTH = 62;
const NOTE_SIZE = 0.7; // .slots .note { font-size: 0.7em }
const SEP_PAD = 0.295; // .slots .note::after { padding: 0 0.295em }, in the note's em
const LINK_GAP = 0.3; // .eu-link { gap: 0.3em }
// "→" is not in the Archivo Latin subset, so browsers draw it from a fallback font and its width depends on the
// reader's system. Fallback arrows in the common sans faces (Arial and its Liberation clone, DejaVu, Noto) are
// 0.58 to 1 em wide, so the fit counts the widest.
const ARROW = 1;

// ---- WOFF2 to sfnt ----

// The WOFF2 known-table tags by index (WOFF2 spec, table 3); _ stands for a trailing space.
const KNOWN_TAGS = ('cmap head hhea hmtx maxp name OS/2 post cvt_ fpgm glyf loca prep CFF_ VORG EBDT EBLC gasp hdmx kern ' +
  'LTSH PCLT VDMX vhea vmtx BASE GDEF GPOS GSUB EBSC JSTF MATH CBDT CBLC COLR CPAL SVG_ sbix acnt avar ' +
  'bdat bloc bsln cvar fdsc feat fmtx fvar gvar hsty just lcar mort morx opbd prop trak Zapf Silf Glat ' +
  'Gloc Feat Sill').split(' ').map((t) => t.replace('_', ' '));
// What HarfBuzz needs to map, vary, advance and kern glyphs.
const KEEP = new Set(['cmap', 'head', 'hhea', 'hmtx', 'maxp', 'OS/2', 'fvar', 'avar', 'HVAR', 'GDEF', 'GPOS', 'GSUB']);

function woff2ToSfnt(woff2: Buffer): Uint8Array {
  if (woff2.toString('latin1', 0, 4) !== 'wOF2') throw new Error(`${FONT}: not a WOFF2 file`);
  const flavor = woff2.readUInt32BE(4);
  if (flavor === 0x74746366) throw new Error(`${FONT}: font collections are not supported`);
  const numTables = woff2.readUInt16BE(12);
  const compressedSize = woff2.readUInt32BE(20);
  let pos = 48;
  const base128 = () => {
    let n = 0;
    for (let i = 0; i < 5; i++) {
      const b = woff2[pos++];
      n = n * 128 + (b & 0x7f);
      if (!(b & 0x80)) return n;
    }
    throw new Error(`${FONT}: bad UIntBase128`);
  };
  const entries: { tag: string; offset: number; length: number; transformed: boolean }[] = [];
  let offset = 0;
  for (let i = 0; i < numTables; i++) {
    const flags = woff2[pos++];
    const tag = (flags & 0x3f) === 63 ? woff2.toString('latin1', pos, (pos += 4)) : KNOWN_TAGS[flags & 0x3f];
    const version = flags >> 6;
    const origLength = base128();
    // glyf and loca are transformed at version 0; every other table is transformed at any other version.
    const transformed = tag === 'glyf' || tag === 'loca' ? version === 0 : version !== 0;
    const length = transformed ? base128() : origLength;
    entries.push({ tag, offset, length, transformed });
    offset += length;
  }
  const data = brotliDecompressSync(woff2.subarray(pos, pos + compressedSize));

  const kept = entries.filter((e) => KEEP.has(e.tag));
  for (const e of kept) if (e.transformed) throw new Error(`${FONT}: the ${e.tag} table is transformed; only glyf and loca can be`);
  kept.sort((a, b) => (a.tag < b.tag ? -1 : 1));
  const headerSize = 12 + 16 * kept.length;
  const size = kept.reduce((n, e) => n + ((e.length + 3) & ~3), headerSize);
  const out = Buffer.alloc(size);
  out.writeUInt32BE(flavor, 0);
  out.writeUInt16BE(kept.length, 4);
  let p = headerSize;
  kept.forEach((e, i) => {
    const rec = 12 + 16 * i;
    out.write(e.tag, rec, 'latin1');
    out.writeUInt32BE(p, rec + 8);
    out.writeUInt32BE(e.length, rec + 12);
    data.copy(out, p, e.offset, e.offset + e.length);
    p += (e.length + 3) & ~3;
  });
  return out; // searchRange and checksums stay zero; HarfBuzz does not need them.
}

// ---- Shaping ----

// harfbuzzjs (MIT) is the HarfBuzz WebAssembly build that satori also uses. It is CommonJS without types, so it
// loads through require with the few calls used here typed below.
interface HbFont { setVariations(v: Record<string, number>): void }
interface HbBuffer {
  addText(text: string): void;
  guessSegmentProperties(): void;
  json(): { ax: number }[];
  destroy(): void;
}
interface Hb {
  createBlob(data: Uint8Array): unknown;
  createFace(blob: unknown, index: number): { upem: number };
  createFont(face: unknown): HbFont;
  createBuffer(): HbBuffer;
  shape(font: HbFont, buffer: HbBuffer): void;
}

const require = createRequire(join(process.cwd(), 'package.json'));
const hb = (await (require('harfbuzzjs') as Promise<Hb>));

let fonts: { upem: number; at: (weight: number) => HbFont } | undefined;
function archivo() {
  if (!fonts) {
    const face = hb.createFace(hb.createBlob(woff2ToSfnt(readFileSync(join(process.cwd(), FONT)))), 0);
    const byWeight = new Map<number, HbFont>();
    fonts = {
      upem: face.upem,
      at(weight) {
        let font = byWeight.get(weight);
        if (!font) {
          font = hb.createFont(face);
          font.setVariations({ wdth: WDTH, wght: weight });
          byWeight.set(weight, font);
        }
        return font;
      },
    };
  }
  return fonts;
}

/** The advance width of one run of uppercased text, in em. */
export function width(text: string, weight: number): number {
  if (!text) return 0;
  const { upem, at } = archivo();
  const buffer = hb.createBuffer();
  buffer.addText(text.toUpperCase());
  buffer.guessSegmentProperties();
  hb.shape(at(weight), buffer);
  const units = buffer.json().reduce((n, g) => n + g.ax, 0);
  buffer.destroy();
  return units / upem;
}

const up2 = (n: number) => Math.ceil(n * 100 - 1e-9) / 100;

/** Fit widths for a bill of these notes and an end line labelled `link`: a link with its arrow, or, with
 *  `arrow: false`, a plain statement (Event Day and the Recap). */
export function billFits(notes: BillNote[], link: string, { arrow = true } = {}): BillFits {
  // Each note is two runs: the label at 900, then a space and the text at 700.
  const note = notes.map((n) => width(n.label, 900) + width(` ${n.text}`, 700));
  const separator = width('·', 700) + 2 * SEP_PAD;
  const linkWidth = width(link, 900) + (arrow ? LINK_GAP + ARROW : 0);
  const notesWidth = note.reduce((sum, w) => sum + w, 0);
  return {
    fit: up2(NOTE_SIZE * (notesWidth + notes.length * separator) + linkWidth),
    notesFit: up2(notesWidth + Math.max(0, notes.length - 1) * separator),
    slotFit: up2(linkWidth),
  };
}
