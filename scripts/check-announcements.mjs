// Checks the Event Day announcements file before the build (src/lib/announcements.mjs has the rules), so a bad
// entry stops the build early with a message that names the entry and the field.
// Usage: node scripts/check-announcements.mjs [file]   (default src/data/announcements-2027.yaml)
import { readFileSync } from 'node:fs';
import { importTs } from './lib/import-ts.mjs';
import { ANNOUNCEMENTS_FILE, parseAnnouncements } from '../src/lib/announcements.mjs';

const { edition2027 } = await importTs(new URL('../src/data/edition-2027.ts', import.meta.url));
const file = process.argv[2] ?? ANNOUNCEMENTS_FILE;
try {
  const list = parseAnnouncements(readFileSync(file, 'utf8'), edition2027.eventDay);
  console.log(`${file}: ${list.length} ${list.length === 1 ? 'announcement' : 'announcements'}, all valid.`);
} catch (e) {
  console.error(e instanceof Error ? e.message : String(e));
  process.exit(1);
}
