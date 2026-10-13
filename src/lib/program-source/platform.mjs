// Where the program comes from, and reading it. The rules (ADR 0009, docs/program-csv.md):
//   - a closed gate reads nothing;
//   - real data only in a Netlify production build (CONTEXT=production) with a gate open: from Sessionize when
//     SESSIONIZE_ENDPOINT_ID is set, else from the CSV at PROGRAM_CSV_URL, and the build fails when neither is;
//   - every other build (deploy previews, branch deploys, local builds) uses the test data and never looks at
//     those variables;
//   - a failed fetch or data that doesn't validate fails the build, so the host keeps the last good deploy.
// Every error message is redacted: it names the variables, never their values.
import { adaptCsv } from './csv.mjs';
import { publicProgram, programVersion } from './model.mjs';
import { fetchable, fetchBytes, ProgramSourceError, redact, sessionizeBase, sessionizePhoto } from './remote.mjs';
import { adaptSessionize } from './sessionize.mjs';

/**
 * @typedef {{ speakersPublic: boolean, schedulePublic: boolean }} Gates
 * @typedef {{ kind: 'none' } | { kind: 'test' } | { kind: 'sessionize' } | { kind: 'csv' }} Choice
 */

export const gatesOpen = (gates) => Boolean(gates.speakersPublic || gates.schedulePublic);

/**
 * Which source a build reads. Only a production build with a gate open looks at the platform variables.
 * @param {Gates} gates
 * @param {Record<string, string | undefined>} env
 * @returns {Choice}
 */
export function chooseSource(gates, env) {
  if (!gatesOpen(gates)) return { kind: 'none' };
  if (env.CONTEXT !== 'production') return { kind: 'test' };
  if (env.SESSIONIZE_ENDPOINT_ID) {
    if (!/^[A-Za-z0-9_-]{1,64}$/.test(env.SESSIONIZE_ENDPOINT_ID)) throw new ProgramSourceError('SESSIONIZE_ENDPOINT_ID is not a Sessionize endpoint ID (letters, digits, "-" and "_").', env);
    return { kind: 'sessionize' };
  }
  if (env.PROGRAM_CSV_URL) {
    if (!fetchable(env.PROGRAM_CSV_URL, env)) throw new ProgramSourceError('PROGRAM_CSV_URL must be an https address.', env);
    return { kind: 'csv' };
  }
  throw new ProgramSourceError('A program gate is open in a production build, but neither SESSIONIZE_ENDPOINT_ID nor PROGRAM_CSV_URL is set. Add one to the host\'s production environment variables (docs/program-csv.md).', env);
}

/**
 * Reads the platform the choice names, as raw program records. Throws a redacted ProgramSourceError.
 * @param {Choice} choice
 * @param {Record<string, string | undefined>} env
 */
export async function readPlatform(choice, env) {
  try {
    if (choice.kind === 'sessionize') {
      const url = `${sessionizeBase(env)}/${encodeURIComponent(env.SESSIONIZE_ENDPOINT_ID ?? '')}/view/All`;
      const { body } = await fetchBytes(url, { env, what: 'Sessionize (the All view of SESSIONIZE_ENDPOINT_ID)', accept: 'application/json' });
      let data;
      try { data = JSON.parse(body.toString('utf8')); } catch { throw new Error('Sessionize (the All view of SESSIONIZE_ENDPOINT_ID): the response is not JSON'); }
      // Photos only from Sessionize's hosts; the CSV's may be on any https host.
      return adaptSessionize(data, undefined, (url) => sessionizePhoto(url, env));
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
