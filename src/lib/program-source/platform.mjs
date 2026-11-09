// Where the program comes from, and reading it. The rules (ADR 0009, ADR 0014, docs/pretalx.md,
// docs/program-csv.md):
//   - a closed gate reads nothing;
//   - real data only in a production build (src/lib/build-context.mjs: Cloudflare Pages building `main`, or a
//     Netlify production deploy) with a gate open: from the CSV at PROGRAM_CSV_URL when it's set, else from
//     Pretalx's public API (the event in config.mjs), which needs no key;
//   - every other build (deploy previews, branch deploys, local builds) uses the test data, reads nothing and never
//     looks at PROGRAM_CSV_URL;
//   - a failed fetch or data that doesn't validate fails the build, so the host keeps the last good deploy.
// Every error message is redacted: it names PROGRAM_CSV_URL, never its value.
import { isProductionBuild } from '../build-context.mjs';
import { adaptCsv } from './csv.mjs';
import { publicProgram, programVersion } from './model.mjs';
import { adaptPretalx, readPretalx } from './pretalx.mjs';
import { fetchable, fetchBytes, ProgramSourceError, redact, pretalxPhoto } from './remote.mjs';

/**
 * @typedef {{ speakersPublic: boolean, schedulePublic: boolean }} Gates
 * @typedef {{ kind: 'none' } | { kind: 'test' } | { kind: 'pretalx' } | { kind: 'csv' }} Choice
 */

export const gatesOpen = (gates) => Boolean(gates.speakersPublic || gates.schedulePublic);

/**
 * Which source a build reads. Only a production build with a gate open looks at PROGRAM_CSV_URL; without it, the
 * build reads Pretalx.
 * @param {Gates} gates
 * @param {Record<string, string | undefined>} env
 * @returns {Choice}
 */
export function chooseSource(gates, env) {
  if (!gatesOpen(gates)) return { kind: 'none' };
  if (!isProductionBuild(env)) return { kind: 'test' };
  if (env.PROGRAM_CSV_URL) {
    if (!fetchable(env.PROGRAM_CSV_URL, env)) throw new ProgramSourceError('PROGRAM_CSV_URL must be an https address.', env);
    return { kind: 'csv' };
  }
  return { kind: 'pretalx' };
}

/**
 * Reads the platform the choice names, as raw program records. Throws a redacted ProgramSourceError.
 * @param {Choice} choice
 * @param {Record<string, string | undefined>} env
 */
export async function readPlatform(choice, env) {
  try {
    if (choice.kind === 'pretalx') {
      // Photos only from Pretalx's hosts; the CSV's may be on any https host.
      return adaptPretalx(await readPretalx(env), undefined, (url, hosts) => pretalxPhoto(url, env, hosts));
    }
    if (choice.kind === 'csv') {
      const { body } = await fetchBytes(env.PROGRAM_CSV_URL ?? '', { env, what: 'The program CSV (PROGRAM_CSV_URL)', accept: 'text/csv, text/plain' });
      return adaptCsv(body.toString('utf8'));
    }
  } catch (e) {
    // A fresh error: no cause or stack from a fetch that could carry the address.
    throw new ProgramSourceError(`The program could not be read: ${e instanceof Error ? e.message : String(e)}`, env);
  }
  throw new ProgramSourceError(`readPlatform has no platform for "${choice.kind}"`, env);
}

/**
 * The public model and its version from raw records, with the gates applied.
 * @param {Parameters<typeof publicProgram>[0]} src
 * @param {Gates} gates
 * @param {Record<string, string | undefined>} env
 */
export function publicModel(src, gates, env) {
  try {
    const model = publicProgram(src, { schedulePublic: gates.schedulePublic, speakersPublic: gates.speakersPublic, photoAllowed: (url) => fetchable(url, env) });
    return { model, version: programVersion(model) };
  } catch (e) {
    throw new ProgramSourceError(`The program data is not valid: ${e instanceof Error ? e.message : String(e)}`, env);
  }
}

export { redact };
