// The hero bill's fit values as CSS, for what the bill says in this build (home.hero.bill). astro.config.mjs
// serves it as `virtual:bill-fit.css`, bundled with the other styles: the CSP allows no inline styles, and the
// values come from the font's metrics (bill-fit.ts), not from hand-measured constants.
import { billFits } from './bill-fit';
import { home } from '../data/home';

export function billCss(): string {
  const { notes, end } = home.hero.bill;
  const f = billFits(notes, end.label, { arrow: Boolean(end.href) });
  // A statement without notes (Event Day, the Recap) fills the measure at every width.
  const notesFit = notes.length ? f.notesFit : f.fit;
  return `@layer components { .slots { --fit: ${f.fit}; --notes-fit: ${notesFit}; --slot-fit: ${f.slotFit}; } }\n`;
}
