// Reading from a program platform: the address rules, the fetch, and the redaction that keeps the platform's
// address out of every message. SESSIONIZE_ENDPOINT_ID is a secret (CLAUDE.md): an error names the variable,
// never its value, and never the address built from it.
//
// Addresses must be https. The one exception is for tests: a plain-http server on this machine (127.0.0.1,
// localhost or [::1]) stands in for the platform and the photo host, and KCD_PROGRAM_TEST_BASE points the
// Sessionize reader at it. Both are refused on Netlify and in GitHub Actions (NETLIFY or GITHUB_ACTIONS set), so
// a real production build can't be redirected, and even elsewhere they reach only this machine.
import { sessionize } from './config.mjs';

const LOOPBACK = new Set(['127.0.0.1', 'localhost', '[::1]']);

/** True where tests may use local plain-http servers: never on Netlify or in GitHub Actions. */
export const localTestsAllowed = (env) => !env.NETLIFY && !env.GITHUB_ACTIONS;

/** The message with every secret value (as is and URL-encoded) replaced by its variable's name. */
export function redact(message, env) {
  let out = String(message);
  for (const [name, value] of [['SESSIONIZE_ENDPOINT_ID', env.SESSIONIZE_ENDPOINT_ID]]) {
    if (typeof value !== 'string' || !value) continue;
    for (const v of new Set([value, encodeURIComponent(value), encodeURI(value)])) out = out.split(v).join(`<${name}>`);
  }
  return out;
}

/** A program source failure: the build stops with this message, which names no secret. */
export class ProgramSourceError extends Error {
  constructor(message, env = {}) {
    super(redact(message, env));
    this.name = 'ProgramSourceError';
  }
}

/** True for an address the readers may fetch: https, or a local test server where tests are allowed. */
export function fetchable(raw, env) {
  let url;
  try { url = new URL(raw); } catch { return false; }
  if (url.username || url.password) return false;
  if (url.protocol === 'https:') return true;
  return url.protocol === 'http:' && LOOPBACK.has(url.hostname) && localTestsAllowed(env);
}

/** A test variable's address on this machine, or null when it's unset. Refused on Netlify and in GitHub Actions. */
export function localTestUrl(name, env) {
  const test = env[name];
  if (!test) return null;
  if (!localTestsAllowed(env)) throw new ProgramSourceError(`${name} is for tests only and is refused on Netlify and in GitHub Actions. Remove it from the environment.`, env);
  let url;
  try { url = new URL(test); } catch { url = null; }
  if (!url || !/^https?:$/.test(url.protocol) || !LOOPBACK.has(url.hostname)) throw new ProgramSourceError(`${name} must be a server on this machine (127.0.0.1, localhost or [::1]).`, env);
  return test.replace(/\/+$/, '');
}

/** The Sessionize API v2 base: the real one, or a local test server named by KCD_PROGRAM_TEST_BASE. */
export const sessionizeBase = (env) => localTestUrl('KCD_PROGRAM_TEST_BASE', env) ?? sessionize.base;

/**
 * Fetches an address and returns its body as a Buffer. `what` names the request in errors, never with the address.
 * @param {string} url
 * @param {{ env: Record<string, string | undefined>, what: string, maxBytes?: number, accept?: string, timeoutMs?: number }} options
 */
export async function fetchBytes(url, { env, what, maxBytes = 20 * 1024 * 1024, accept = '*/*', timeoutMs = 30_000 }) {
  if (!fetchable(url, env)) throw new ProgramSourceError(`${what}: the address must be https`, env);
  let res;
  try {
    res = await fetch(url, { redirect: 'follow', signal: AbortSignal.timeout(timeoutMs), headers: { accept } });
  } catch (e) {
    const code = e?.cause?.code ?? (e?.name === 'TimeoutError' ? 'timed out' : 'network error');
    throw new ProgramSourceError(`${what}: the request failed (${code})`, env);
  }
  if (res.url && !fetchable(res.url, env)) throw new ProgramSourceError(`${what}: redirected to an address that isn't https`, env);
  if (!res.ok) throw new ProgramSourceError(`${what}: the platform answered HTTP ${res.status}`, env);
  const length = Number(res.headers.get('content-length') ?? 0);
  if (length > maxBytes) throw new ProgramSourceError(`${what}: the response is larger than ${maxBytes} bytes`, env);
  let body;
  try { body = Buffer.from(await res.arrayBuffer()); } catch { throw new ProgramSourceError(`${what}: the response was cut off`, env); }
  if (body.length > maxBytes) throw new ProgramSourceError(`${what}: the response is larger than ${maxBytes} bytes`, env);
  return { body, type: res.headers.get('content-type') ?? '' };
}
