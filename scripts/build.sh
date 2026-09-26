#!/usr/bin/env bash
# Builds kcdtexas.org. The same script runs locally and in CI.
#
# Usage: scripts/build.sh [--zip] [--serve] [--skip-install]
#   --zip           also write out/kcdtexas-<commit>.zip (for Cloudflare Pages
#                   dashboard uploads; Netlify drag-and-drop takes the dist/ folder)
#   --serve         preview the built site at http://127.0.0.1:4321
#   --skip-install  reuse node_modules instead of running npm ci
set -euo pipefail

cd "$(dirname "$0")/.."

# No build telemetry: this project collects no data, including about itself.
export ASTRO_TELEMETRY_DISABLED=1

zip=false
serve=false
install=true
for arg in "$@"; do
  case "$arg" in
    --zip) zip=true ;;
    --serve) serve=true ;;
    --skip-install) install=false ;;
    *) echo "Unknown option: $arg" >&2; exit 2 ;;
  esac
done

step() { printf '\n==> %s\n' "$1"; }

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

step "Checking color contrast (WCAG AA)"
node scripts/check-contrast.mjs

step "Type-checking"
npx astro check

step "Building the site"
npx astro build

step "Writing _redirects and _headers"
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
