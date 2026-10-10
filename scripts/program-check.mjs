// The refresh check: has the program on the platform changed since the live site was built?
//
// Usage:
//   node scripts/program-check.mjs --gates
//       Prints "open" when a program gate is open in the checked-out src/data/edition-2027.ts, else "closed".
//       Reads nothing else. scripts/build.sh and the workflow use it.
//   node scripts/program-check.mjs --which-gates
//       Prints "closed", "speakers" (only `speakersPublic` open) or "schedule" (the Schedule's gate open), from the
//       same file. scripts/build.sh uses it to pick the test program for a non-production build.
//   node scripts/program-check.mjs
//       Prints exactly "changed" or "unchanged" on stdout, and nothing else: no program data, no hash. When
//       GITHUB_OUTPUT is set, it also appends "changed=true" or "changed=false" to that file, and "version=" with
//       the program version it computed (empty while the gates are closed). The workflow's rebuild job waits until
//       the live site publishes that version, so the next run doesn't deploy the same change again.
//       - Both gates closed: "unchanged", and no platform call.
//       - A gate open: reads the platform as a production build does (src/lib/program-source/platform.mjs):
//         Sessionize when SESSIONIZE_ENDPOINT_ID is set, else the CSV at PROGRAM_CSV_URL. It computes the program
//         version with those gates, then compares it with the live https://kcdtexas.org/2027/program-version.txt.
//         A missing or unreadable live file counts as "changed".
//       - Exit 0 after printing. On a failure (no variable set, a failed fetch, data that doesn't validate) it
//         prints a redacted message on stderr, nothing on stdout, writes no output, and exits 1.
//   Tests only: KCD_PROGRAM_TEST_BASE (the Sessionize base) and KCD_PROGRAM_LIVE_URL (the live file) may name a
//   server on this machine; both are refused on Netlify and in GitHub Actions.
import { appendFileSync } from 'node:fs';
import { importTs } from './lib/import-ts.mjs';
import { liveVersionUrl } from '../src/lib/program-source/config.mjs';
import { chooseSource, gatesOpen, publicModel, readPlatform } from '../src/lib/program-source/platform.mjs';
import { fetchBytes, localTestUrl, redact } from '../src/lib/program-source/remote.mjs';

const { edition2027 } = await importTs(new URL('../src/data/edition-2027.ts', import.meta.url));
const gates = edition2027.program;

/** Whether the platform's program differs from the live one, and the platform's program version. */
async function check(env) {
  if (!gatesOpen(gates)) return { changed: false, version: '' };
  // The check stands in for the production build, so it reads the platform as one.
  const prod = { ...env, CONTEXT: 'production' };
  const { version } = publicModel(await readPlatform(chooseSource(gates, prod), prod), gates, prod);
  const live = localTestUrl('KCD_PROGRAM_LIVE_URL', env) ?? liveVersionUrl;
  try {
    const { body } = await fetchBytes(live, { env, what: 'The live program version', maxBytes: 4096, accept: 'text/plain' });
    return { changed: body.toString('utf8').trim() !== version, version };
  } catch {
    return { changed: true, version };
  }
}

if (process.argv.includes('--gates')) {
  console.log(gatesOpen(gates) ? 'open' : 'closed');
} else if (process.argv.includes('--which-gates')) {
  console.log(gates.schedulePublic ? 'schedule' : gates.speakersPublic ? 'speakers' : 'closed');
} else {
  try {
    const { changed, version } = await check(process.env);
    if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, `changed=${changed}\nversion=${version}\n`);
    console.log(changed ? 'changed' : 'unchanged');
  } catch (e) {
    console.error(redact(e instanceof Error ? e.message : String(e), process.env));
    process.exit(1);
  }
}
