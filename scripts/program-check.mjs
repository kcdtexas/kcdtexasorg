// The program's gates, for scripts/build.sh and the workflows.
//
// Usage:
//   node scripts/program-check.mjs --gates
//       Prints "open" when a program gate is open in the checked-out src/data/edition-2027.ts, else "closed".
//       Reads nothing else.
import { importTs } from './lib/import-ts.mjs';
import { gatesOpen } from '../src/lib/program-source/platform.mjs';

const { edition2027 } = await importTs(new URL('../src/data/edition-2027.ts', import.meta.url));
const gates = edition2027.program;

if (process.argv.includes('--gates')) {
  console.log(gatesOpen(gates) ? 'open' : 'closed');
} else {
  console.error('Usage: node scripts/program-check.mjs --gates');
  process.exit(2);
}
