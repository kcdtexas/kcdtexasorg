// Where the program comes from, and reading it. The rules (ADR 0009):
//   - a closed gate reads nothing;
//   - real data only in a Netlify production build (CONTEXT=production) with a gate open, from Sessionize with
//     SESSIONIZE_ENDPOINT_ID, and the build fails when it isn't set;
//   - every other build (deploy previews, branch deploys, local builds) uses the test data and never looks at
//     that variable;
//   - a failed fetch or data that doesn't validate fails the build, so the host keeps the last good deploy.
// Every error message is redacted: it names the variable, never its value.
import { publicProgram } from './model.mjs';
import { fetchable, fetchBytes, ProgramSourceError, redact, sessionizeBase } from './remote.mjs';
import { adaptSessionize } from './sessionize.mjs';

/**
 * @typedef {{ speakersPublic: boolean, schedulePublic: boolean }} Gates
 * @typedef {{ kind: 'none' } | { kind: 'test' } | { kind: 'sessionize' }} Choice
 */

export const gatesOpen = (gates) => Boolean(gates.speakersPublic || gates.schedulePublic);

/**
 * Which source a build reads. Only a production build with a gate open looks at the platform variable.
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
  throw new ProgramSourceError('A program gate is open in a production build, but SESSIONIZE_ENDPOINT_ID is not set. Add it to the host\'s production environment variables.', env);
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
      return adaptSessionize(data);
    }
  } catch (e) {
    // A fresh error: no cause or stack from a fetch that could carry the address.
    throw new ProgramSourceError(`The program could not be read: ${e instanceof Error ? e.message : String(e)}`, env);
  }
  throw new ProgramSourceError(`readPlatform has no platform for "${choice.kind}"`, env);
}

/**
 * The public model from raw records, with the gates applied.
 * @param {Parameters<typeof publicProgram>[0]} src
 * @param {Gates} gates
 * @param {Record<string, string | undefined>} env
 */
export function publicModel(src, gates, env) {
  try {
    return { model: publicProgram(src, { schedulePublic: gates.schedulePublic, photoAllowed: (url) => fetchable(url, env) }) };
  } catch (e) {
    throw new ProgramSourceError(`The program data is not valid: ${e instanceof Error ? e.message : String(e)}`, env);
  }
}

export { redact };
