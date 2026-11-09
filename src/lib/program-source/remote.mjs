// Reading from a program platform: the address rules, the fetch, and the redaction that keeps the CSV's address out
// of every message. PROGRAM_CSV_URL is a secret (CLAUDE.md): an error names the variable, never its value. Pretalx's
// public API needs no key (ADR 0014).
//
// Addresses must be https. The one exception is for tests: a plain-http server on this machine (127.0.0.1,
// localhost or [::1]) stands in for the platform and the photo host, and KCD_PROGRAM_TEST_BASE points the
// Pretalx reader at it. Both are refused on the hosts and in GitHub Actions (CF_PAGES, NETLIFY or
// GITHUB_ACTIONS set), so a real production build can't be redirected, and even elsewhere they reach only this
// machine. Every request names the site in its User-Agent, and no email address (config.mjs). A busy server or a
// failing gateway gets one retry (retryWait); any other error fails at once.
import { pretalx, userAgent } from './config.mjs';

const LOOPBACK = new Set(['127.0.0.1', 'localhost', '[::1]']);

/** True where tests may use local plain-http servers: never on Cloudflare Pages, Netlify or in GitHub Actions. */
export const localTestsAllowed = (env) => !env.CF_PAGES && !env.NETLIFY && !env.GITHUB_ACTIONS;

/** The message with every secret value (as is and URL-encoded) replaced by its variable's name. */
export function redact(message, env) {
  let out = String(message);
  for (const [name, value] of [['PROGRAM_CSV_URL', env.PROGRAM_CSV_URL]]) {
    if (typeof value !== 'string' || !value) continue;
    for (const v of new Set([value, encodeURIComponent(value), encodeURI(value)])) out = out.split(v).join(`<${name}>`);
  }
  return out;
}

/** A program source failure: the build stops with this message, which names no secret. `status` is the HTTP status
 *  when the server answered with an error. */
export class ProgramSourceError extends Error {
  constructor(message, env = {}, status = undefined) {
    super(redact(message, env));
    this.name = 'ProgramSourceError';
    if (status !== undefined) this.status = status;
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

/** True for a Speaker photo the Pretalx reader keeps: https on Pretalx's own host or one of its subdomains, or on one
 *  of `hosts` (the event's custom domain), or a local test server where tests are allowed. Every other photo address
 *  is dropped. */
export function pretalxPhoto(raw, env, hosts = []) {
  if (!fetchable(raw, env)) return false;
  const { protocol, hostname } = new URL(raw);
  return protocol === 'http:' || hostname === pretalx.photoHost || hostname.endsWith(`.${pretalx.photoHost}`) || hosts.includes(hostname);
}

/** A test variable's address on this machine, or null when it's unset. Refused on Cloudflare Pages, Netlify and in
 *  GitHub Actions. */
export function localTestUrl(name, env) {
  const test = env[name];
  if (!test) return null;
  if (!localTestsAllowed(env)) throw new ProgramSourceError(`${name} is for tests only and is refused on Cloudflare Pages, Netlify and in GitHub Actions. Remove it from the environment.`, env);
  let url;
  try { url = new URL(test); } catch { url = null; }
  if (!url || !/^https?:$/.test(url.protocol) || !LOOPBACK.has(url.hostname)) throw new ProgramSourceError(`${name} must be a server on this machine (127.0.0.1, localhost or [::1]).`, env);
  return test.replace(/\/+$/, '');
}

/** Pretalx's API base: the real one, or a local test server named by KCD_PROGRAM_TEST_BASE. */
export const pretalxBase = (env) => localTestUrl('KCD_PROGRAM_TEST_BASE', env) ?? pretalx.base;

/** The most redirects one request follows. */
const MAX_REDIRECTS = 5;

/**
 * How long to wait before the one retry, in milliseconds, or null for none: a busy server (429) that asks for 30
 * seconds or less (3 seconds when it doesn't say), or a gateway's error (502, 503, 504) after 2 seconds.
 * @param {Response} res
 */
function retryWait(res) {
  if (res.status === 429) {
    const after = (res.headers.get('retry-after') ?? '').trim();
    if (!after) return 3000;
    const seconds = /^\d+$/.test(after) ? Number(after) : (Date.parse(after) - Date.now()) / 1000;
    if (Number.isNaN(seconds)) return 3000;
    return seconds <= 30 ? Math.max(0, seconds) * 1000 : null;
  }
  return [502, 503, 504].includes(res.status) ? 2000 : null;
}

/**
 * One request, following redirects by hand: every address on the way must be https (or a local test server where
 * tests are allowed) and pass `allowed`, so no request goes to a host the reader may not use.
 * @param {string} url
 * @param {{ env: Record<string, string | undefined>, what: string, accept: string, timeoutMs: number, allowed: ((url: string) => boolean) | null }} options
 */
async function request(url, { env, what, accept, timeoutMs, allowed }) {
  const signal = AbortSignal.timeout(timeoutMs);
  let current = url;
  for (let hops = 0; ; hops += 1) {
    let res;
    try {
      res = await fetch(current, { redirect: 'manual', signal, headers: { accept, 'user-agent': userAgent } });
    } catch (e) {
      const code = e?.cause?.code ?? (e?.name === 'TimeoutError' ? 'timed out' : 'network error');
      throw new ProgramSourceError(`${what}: the request failed (${code})`, env);
    }
    const location = res.headers.get('location');
    if (res.status < 300 || res.status > 399 || !location) return res;
    await res.body?.cancel().catch(() => {});
    if (hops === MAX_REDIRECTS) throw new ProgramSourceError(`${what}: more than ${MAX_REDIRECTS} redirects`, env);
    let next = '';
    try { next = new URL(location, current).href; } catch { /* not an address: refused below */ }
    if (!fetchable(next, env)) throw new ProgramSourceError(`${what}: redirected to an address that isn't https`, env);
    if (allowed && !allowed(next)) throw new ProgramSourceError(`${what}: redirected to a host that isn't allowed`, env);
    current = next;
  }
}

/**
 * Fetches an address and returns its body as a Buffer. `what` names the request in errors, never with the address.
 * `allowed`, when given, decides which addresses the request may start at and be redirected to.
 * @param {string} url
 * @param {{ env: Record<string, string | undefined>, what: string, maxBytes?: number, accept?: string, timeoutMs?: number, allowed?: ((url: string) => boolean) | null }} options
 */
export async function fetchBytes(url, { env, what, maxBytes = 20 * 1024 * 1024, accept = '*/*', timeoutMs = 30_000, allowed = null }) {
  if (!fetchable(url, env)) throw new ProgramSourceError(`${what}: the address must be https`, env);
  if (allowed && !allowed(url)) throw new ProgramSourceError(`${what}: the address is on a host that isn't allowed`, env);
  let res = await request(url, { env, what, accept, timeoutMs, allowed });
  // One retry at most, for a busy server or a failing gateway: the refresh on Event Day runs every 5 minutes anyway.
  const wait = res.ok ? null : retryWait(res);
  if (wait !== null) {
    await res.body?.cancel().catch(() => {});
    await new Promise((resolve) => setTimeout(resolve, wait));
    res = await request(url, { env, what, accept, timeoutMs, allowed });
  }
  if (!res.ok) {
    await res.body?.cancel().catch(() => {});
    throw new ProgramSourceError(`${what}: the server answered HTTP ${res.status}${wait !== null ? ', also on the one retry' : ''}`, env, res.status);
  }
  const tooLarge = () => new ProgramSourceError(`${what}: the response is larger than ${maxBytes} bytes`, env);
  if (Number(res.headers.get('content-length') ?? 0) > maxBytes) {
    await res.body?.cancel().catch(() => {});
    throw tooLarge();
  }
  // The body as it streams in, stopped at the cap, so a response without a Content-Length is never read past it.
  const chunks = [];
  let size = 0;
  try {
    for await (const chunk of res.body ?? []) {
      size += chunk.byteLength;
      // Leaving the loop cancels the stream, which closes the connection.
      if (size > maxBytes) break;
      chunks.push(chunk);
    }
  } catch {
    throw new ProgramSourceError(`${what}: the response was cut off`, env);
  }
  if (size > maxBytes) throw tooLarge();
  return { body: Buffer.concat(chunks), type: res.headers.get('content-type') ?? '' };
}
