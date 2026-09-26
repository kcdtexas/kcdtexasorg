// Local production-like server for the built site.
//
// Serves dist/ the way Netlify does for this project: applies _redirects
// (exact paths, 301/302, a real file wins over a redirect) and _headers
// (all matching blocks), and answers unknown paths with 404.html.
// Optionally mounts a private review folder at /_review/ (local only,
// never part of the build).
//
// Usage: node scripts/serve.mjs [--dir dist] [--host 127.0.0.1] [--port 8090] [--review <dir>]
import { createServer } from 'node:http';
import { existsSync, readFileSync, statSync, createReadStream } from 'node:fs';
import { resolve, join, extname, sep } from 'node:path';

const args = Object.fromEntries(
  process.argv.slice(2).reduce((pairs, arg, i, all) => {
    if (arg.startsWith('--')) pairs.push([arg.slice(2), all[i + 1]?.startsWith('--') ? true : all[i + 1] ?? true]);
    return pairs;
  }, []),
);
const root = resolve(args.dir ?? 'dist');
const host = args.host ?? '127.0.0.1';
const port = Number(args.port ?? 8090);
const reviewRoot = args.review ? resolve(args.review) : null;

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.xml': 'application/xml; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.md': 'text/plain; charset=utf-8',
  '.yaml': 'text/yaml; charset=utf-8',
  '.ics': 'text/calendar; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.avif': 'image/avif',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.pdf': 'application/pdf',
};

function loadRedirects() {
  const file = join(root, '_redirects');
  if (!existsSync(file)) return new Map();
  const rules = new Map();
  for (const line of readFileSync(file, 'utf8').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const [from, to, code = '301'] = trimmed.split(/\s+/);
    rules.set(from.replace(/\/$/, '') || '/', { to, code: Number(code) });
  }
  return rules;
}

function loadHeaders() {
  const file = join(root, '_headers');
  if (!existsSync(file)) return [];
  const blocks = [];
  let current = null;
  for (const line of readFileSync(file, 'utf8').split('\n')) {
    if (!line.trim() || line.trim().startsWith('#')) continue;
    if (!/^\s/.test(line)) {
      current = { pattern: line.trim(), headers: [] };
      blocks.push(current);
    } else if (current) {
      const i = line.indexOf(':');
      current.headers.push([line.slice(0, i).trim(), line.slice(i + 1).trim()]);
    }
  }
  return blocks;
}

function matches(pattern, path) {
  if (pattern.endsWith('*')) return path.startsWith(pattern.slice(0, -1));
  return path === pattern;
}

// Map a URL path to a file inside base, or null. Blocks path traversal.
function findFile(base, path) {
  const target = resolve(join(base, decodeURIComponent(path)));
  if (target !== base && !target.startsWith(base + sep)) return null;
  const candidates = [target, join(target, 'index.html'), `${target}.html`];
  return candidates.find((c) => existsSync(c) && statSync(c).isFile()) ?? null;
}

function send(req, res, status, file, extraHeaders) {
  const headers = { 'Content-Type': TYPES[extname(file)] ?? 'application/octet-stream', ...extraHeaders };
  res.writeHead(status, headers);
  if (req.method === 'HEAD') return res.end();
  createReadStream(file).pipe(res);
}

const server = createServer((req, res) => {
  // Re-read on every request so a rebuild shows up without restarting.
  const redirects = loadRedirects();
  const headerBlocks = loadHeaders();
  const url = new URL(req.url, `http://${req.headers.host ?? 'localhost'}`);
  const path = url.pathname;
  const log = (status) => console.log(`${req.method} ${path} ${status}`);

  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.writeHead(405, { Allow: 'GET, HEAD' }).end();
    return log(405);
  }

  if (reviewRoot && (path === '/_review' || path.startsWith('/_review/'))) {
    const file = findFile(reviewRoot, path.slice('/_review'.length) || '/');
    const noindex = { 'X-Robots-Tag': 'noindex, nofollow', 'Cache-Control': 'no-store' };
    if (file) {
      log(200);
      return send(req, res, 200, file, noindex);
    }
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8', ...noindex }).end('Not found in the review folder\n');
    return log(404);
  }

  const headers = {};
  for (const block of headerBlocks) {
    if (matches(block.pattern, path)) for (const [name, value] of block.headers) headers[name] = value;
  }

  const file = findFile(root, path);
  if (file) {
    log(200);
    return send(req, res, 200, file, headers);
  }

  const rule = redirects.get(path.replace(/\/$/, '') || '/');
  if (rule) {
    res.writeHead(rule.code, { ...headers, Location: rule.to, 'Content-Type': 'text/plain; charset=utf-8' });
    res.end(req.method === 'HEAD' ? undefined : `Redirecting to ${rule.to}\n`);
    return log(rule.code);
  }

  const notFound = join(root, '404.html');
  if (existsSync(notFound)) {
    log(404);
    return send(req, res, 404, notFound, headers);
  }
  res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }).end('Not found\n');
  log(404);
});

server.listen(port, host, () => {
  console.log(`Serving ${root} at http://${host}:${port}/` + (reviewRoot ? ` (review pages at /_review/ from ${reviewRoot})` : ''));
});
