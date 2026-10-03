#!/usr/bin/env bash
# Builds kcdtexas.org. The same script runs locally and in CI.
#
# Usage: scripts/build.sh [--zip] [--serve] [--skip-install] [--now YYYY-MM-DD]
#   --zip           also write out/kcdtexas-<commit>.zip (for Cloudflare Pages
#                   dashboard uploads; Netlify drag-and-drop takes the dist/ folder)
#   --serve         preview the built site at http://127.0.0.1:4321
#   --skip-install  reuse node_modules instead of running npm ci
#   --now DAY       build as if DAY were today in Central time, to test date-driven text
#                   (tests/time-machine.mjs). Never in production: the build refuses it there.
set -euo pipefail

cd "$(dirname "$0")/.."

# No build telemetry: this project collects no data, including about itself.
export ASTRO_TELEMETRY_DISABLED=1

zip=false
serve=false
install=true
# The build day comes only from --now, never from an inherited variable.
unset KCD_BUILD_DAY
while [ $# -gt 0 ]; do
  case "$1" in
    --zip) zip=true ;;
    --serve) serve=true ;;
    --skip-install) install=false ;;
    --now)
      [[ "${2:-}" =~ ^[0-9]{4}-[0-9]{2}-[0-9]{2}$ ]] || { echo "--now needs a date as YYYY-MM-DD" >&2; exit 2; }
      # Netlify sets CONTEXT; a production deploy must describe the real day.
      if [ "${CONTEXT:-}" = production ] || [ "${GITHUB_REF:-}" = refs/heads/release ]; then
        echo "--now is not allowed in a production build" >&2; exit 2
      fi
      export KCD_BUILD_DAY="$2"; shift ;;
    *) echo "Unknown option: $1" >&2; exit 2 ;;
  esac
  shift
done

step() { printf '\n==> %s\n' "$1"; }

if [ -n "${KCD_BUILD_DAY:-}" ]; then
  echo "Building as if today were $KCD_BUILD_DAY (Central time). Test builds only."
fi

step "Checking Node.js (needs 22.12 or newer)"
node -e '
  const [maj, min] = process.versions.node.split(".").map(Number);
  if (maj < 22 || (maj === 22 && min < 12)) {
    console.error(`Node ${process.versions.node} is too old; install Node 22.12 or newer.`);
    process.exit(1);
  }
  console.log(`Node ${process.versions.node}`);
'

if $install; then
  step "Installing dependencies"
  npm ci --no-audit --no-fund
fi

step "Checking the shared foundation stays site-neutral (ADR 0006)"
if grep -ril 'kcd' src/foundation; then
  echo "src/foundation must not mention a specific site." >&2
  exit 1
fi

step "Checking templates use design tokens, not raw colors"
# Colors live only in src/foundation/ and src/styles/. Templates use semantic
# tokens (bg, fg, accent, band...), so a new design direction is a token swap
# plus a few signature components, never a hunt through every page.
if grep -rnE '#[0-9a-fA-F]{3}([0-9a-fA-F]{3})?([0-9a-fA-F]{2})?\b|rgba?\(|hsla?\(' src --include='*.astro' --include='*.ts' --include='*.tsx' --include='*.jsx'; then
  echo "Raw colors found in templates. Add a token in src/styles/global.css and use it instead." >&2
  exit 1
fi

step "Checking color contrast (WCAG AA)"
node scripts/check-contrast.mjs

step "Type-checking"
npx astro check

step "Building the site"
npx astro build

step "Writing _redirects, _headers and sitemap.xml"
node scripts/write-host-files.mjs

step "Checking the build output"
node scripts/check-dist.mjs

if $zip; then
  step "Zipping dist/"
  commit="$(git rev-parse --short HEAD 2>/dev/null || echo local)"
  mkdir -p out
  rm -f "out/kcdtexas-${commit}.zip"
  (cd dist && zip -qr "../out/kcdtexas-${commit}.zip" .)
  echo "Wrote out/kcdtexas-${commit}.zip"
fi

if $serve; then
  step "Serving dist/ at http://127.0.0.1:4321"
  npx astro preview --host 127.0.0.1 --port 4321
fi
