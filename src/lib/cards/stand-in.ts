// A drawn stand-in for a Speaker photo, for test builds only: a plain grey silhouette (a head and shoulders) on the
// card's dark surface, made from an SVG with sharp in the kit's colors. It is never a real person's photo, and it
// is never served as a page's photo: only one fixture Speaker's Share Card uses it, so a test build draws both kinds
// of card.
import sharp from 'sharp';
import { color } from './kit';

/** The fixture Speaker whose Share Card shows the stand-in in a test build; the others keep their initials. */
export const STAND_IN_SPEAKER = 'fx-1';

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="400" viewBox="0 0 400 400">
  <rect width="400" height="400" fill="${color.surface}"/>
  <circle cx="200" cy="160" r="78" fill="${color.muted}"/>
  <path d="M40 400 C40 290 110 250 200 250 C290 250 360 290 360 400 Z" fill="${color.muted}"/>
</svg>`;

let drawn: Promise<Buffer> | null = null;
/** The stand-in as a 400 px square WebP, like a downloaded photo's large size. Drawn once per build. */
export const standInPhoto = () => (drawn ??= sharp(Buffer.from(svg)).webp({ quality: 72 }).toBuffer());
