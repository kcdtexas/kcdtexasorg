// Fails the build if a color pair the templates use together drops below WCAG AA, in either theme.
// Reads src/foundation/tokens.css: the light tokens on :root, and the dark tokens, which appear twice
// (for the device setting and for the visitor's choice) and must stay identical. Also checks that
// theme-color.json matches each theme's page color.
import { readFileSync } from 'node:fs';

const css = readFileSync('src/foundation/tokens.css', 'utf8');
const themeColor = JSON.parse(readFileSync('src/foundation/theme-color.json', 'utf8'));

// [text or foreground, background, minimum]. 4.5 for text; 3 for large text and the edges of buttons.
const PAIRS = [
  ['fg', 'bg', 4.5],
  ['muted', 'bg', 4.5],
  ['link', 'bg', 4.5],
  ['link-hover', 'bg', 4.5],
  ['action', 'bg', 3],              // button edges, open slots (slot labels are 28 px and up)
  ['on-action', 'action', 4.5],
  ['on-action', 'action-hover', 4.5],
  ['year', 'bg', 3],                // the title's "2027", display size
  ['dateline', 'bg', 4.5],
  ['figure', 'bg', 4.5],
  ['on-signal', 'signal', 4.5],     // "Dallas" on the key-dates block
  ['on-plate', 'plate', 4.5],       // the captions on the band's photos
  ['fg', 'surface', 4.5],
  ['band-fg', 'band', 4.5],
  ['band-muted', 'band', 4.5],
  ['band-link', 'band', 4.5],
  ['on-action', 'band-action', 4.5],
  ['on-action', 'band-action-hover', 4.5],
  ['band-action', 'band', 3],
  ['foot-fg', 'foot', 4.5],
  ['foot-muted', 'foot', 4.5],
];
// Critique of Round 0: in dark, the speak band's "Submit a talk" must stand out at 4.5:1.
const DARK_ONLY = [['band-action', 'band', 4.5]];

function block(re, label) {
  const m = css.match(re);
  if (!m) {
    console.error(`Contrast check: no ${label} token block in src/foundation/tokens.css`);
    process.exit(1);
  }
  return m[1];
}

function readVars(body) {
  const vars = {};
  for (const [, name, value] of body.matchAll(/--([a-z-]+):\s*([^;]+);/gi)) vars[name] = value.trim();
  // Resolve var(--x) references within the same set.
  for (let i = 0; i < 3; i += 1) {
    for (const [k, v] of Object.entries(vars)) {
      const ref = v.match(/^var\(--([a-z-]+)\)$/);
      if (ref && vars[ref[1]]) vars[k] = vars[ref[1]];
    }
  }
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

const light = readVars(block(/:root\s*\{([^}]*)\}/, 'light'));
const darkDevice = block(/:root:not\(\[data-theme="light"\]\)\s*\{([^}]*)\}/, 'dark (device)');
const darkChoice = block(/:root\[data-theme="dark"\]\s*\{([^}]*)\}/, 'dark (choice)');
const norm = (s) => s.replace(/\s+/g, ' ').trim();
const failures = [];
if (norm(darkDevice) !== norm(darkChoice)) failures.push('the two dark token blocks differ; keep them identical');
const dark = { ...light, ...readVars(darkChoice) };

let checked = 0;
for (const [mode, vars, pairs] of [['light', light, PAIRS], ['dark', dark, [...PAIRS, ...DARK_ONLY]]]) {
  for (const [text, background, min] of pairs) {
    const [a, b] = [vars[text], vars[background]];
    if (!/^#[0-9a-f]{6}$/i.test(a ?? '') || !/^#[0-9a-f]{6}$/i.test(b ?? '')) {
      failures.push(`${mode}: --${text} or --${background} is not a 6-digit hex color (${a}, ${b})`);
      continue;
    }
    checked += 1;
    const r = ratio(a, b);
    if (r < min) failures.push(`${mode}: --${text} on --${background} is ${r.toFixed(2)}:1 (needs ${min}:1)`);
  }
  if (themeColor[mode]?.toLowerCase() !== vars.bg.toLowerCase()) failures.push(`${mode}: theme-color.json (${themeColor[mode]}) differs from --bg (${vars.bg})`);
}

if (failures.length) {
  console.error('Contrast check failed:\n  ' + failures.join('\n  '));
  process.exit(1);
}
console.log(`Contrast check passed: ${checked} pairs in light and dark.`);
