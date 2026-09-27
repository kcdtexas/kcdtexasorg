// Fails the build if any text/background color pair in the site palette
// drops below WCAG AA (4.5:1). Reads the :root blocks in src/styles/global.css:
// the light palette, plus a dark one if the site has one.
import { readFileSync } from 'node:fs';

const MIN = 4.5;
const css = readFileSync('src/styles/global.css', 'utf8');

// Pairs of [text, background] custom properties that the templates use together.
const PAIRS = [
  ['fg', 'bg'],
  ['muted', 'bg'],
  ['accent', 'bg'],
  ['fg', 'surface'],
  ['muted', 'surface'],
  ['accent-contrast', 'accent'],
  ['band-fg', 'band'],
  ['band-muted', 'band'],
];

function readVars(block) {
  const vars = {};
  for (const [, name, value] of block.matchAll(/--([a-z-]+):\s*(#[0-9a-f]{6})\s*;/gi)) vars[name] = value;
  return vars;
}

function luminance(hex) {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function ratio(a, b) {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

const blocks = [...css.matchAll(/:root\s*\{([^}]*)\}/g)].map((m) => m[1]);
if (blocks.length < 1) {
  console.error('Expected a :root palette block in src/styles/global.css');
  process.exit(1);
}

const failures = [];
const modes = [['light', blocks[0]], ['dark', blocks[1]]].filter(([, block]) => block);
modes.forEach(([mode, block]) => {
  const vars = readVars(block);
  for (const [text, background] of PAIRS) {
    if (!vars[text] || !vars[background]) {
      failures.push(`${mode}: --${text} or --${background} is not set`);
      continue;
    }
    const r = ratio(vars[text], vars[background]);
    if (r < MIN) failures.push(`${mode}: --${text} on --${background} is ${r.toFixed(2)}:1 (needs ${MIN}:1)`);
  }
});

if (failures.length) {
  console.error('Contrast check failed:\n  ' + failures.join('\n  '));
  process.exit(1);
}
console.log(`Contrast check passed: ${PAIRS.length} pairs in ${modes.map(([m]) => m).join(' and ')} mode.`);
