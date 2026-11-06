// Which kind of build this is, on either host (ADR 0012). Only a production build may read the program platform
// (ADR 0009), and only a production build must describe the real day:
//   - Cloudflare Pages: CF_PAGES=1 and CF_PAGES_BRANCH=main, the production branch (ADR 0011). Pages sets both
//     itself, so a pull request can't turn its preview into a production build. On Pages, CONTEXT counts for
//     nothing.
//   - Netlify (kept as the rollback until it's shut down): CONTEXT=production, which Netlify sets for the
//     production branch's deploys.
// Everything else is not: deploy previews, branch deploys, local builds and tests.
//
// scripts/build.sh asks through scripts/build-context.mjs; src/lib/program-source/platform.mjs and
// scripts/check-dist.mjs import it.

/** The production branch on Cloudflare Pages. */
export const PRODUCTION_BRANCH = 'main';

/**
 * True for a production build: Pages building `main`, or a Netlify production deploy.
 * @param {Record<string, string | undefined>} env
 */
export function isProductionBuild(env) {
  if (env.CF_PAGES) return env.CF_PAGES === '1' && env.CF_PAGES_BRANCH === PRODUCTION_BRANCH;
  return env.CONTEXT === 'production';
}

/**
 * The build's kind in a word, for messages: "production", "preview" (a host's other builds: previews and branch
 * deploys) or "local".
 * @param {Record<string, string | undefined>} env
 */
export function buildKind(env) {
  if (isProductionBuild(env)) return 'production';
  return env.CF_PAGES || env.NETLIFY || env.CONTEXT ? 'preview' : 'local';
}
