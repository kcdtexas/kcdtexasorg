#!/usr/bin/env bash
# Builds kcdtexas.org. The same script runs locally and in CI.
#
# Usage: scripts/build.sh [--zip] [--serve] [--skip-install] [--now YYYY-MM-DD] [--tickets-day YYYY-MM-DD]
#                         [--program-public] [--sponsors-sample] [--program-sample[=speakers]] [--clock HH:MM]
#   --zip           also write out/kcdtexas-<commit>.zip (for Cloudflare Pages
#                   dashboard uploads; Netlify drag-and-drop takes the dist/ folder)
#   --serve         preview the built site at http://127.0.0.1:4321
#   --skip-install  reuse node_modules instead of running npm ci
#   --now DAY       build as if DAY were today in Central time, to test date-driven text
#                   (tests/time-machine.mjs). Never in production: the build refuses it there.
#   --tickets-day DAY  build as if tickets went on sale on DAY, a sample day for tests and design
#                   reviews; the pages label it "Sample day", and the ticket links open the chapter
#                   page as a stand-in. Never in production either.
#   --program-public  build as if the Speakers and the Schedule were public, with no program data;
#                   the pages say "Sample". Never in production.
#   --sponsors-sample  fill the 2027 wall with plain "Sample" tiles, no logos or names. Never in
#                   production, and never deployed.
#   --program-sample  open the program gates on test data: the 2026 Schedule and the made-up fixture
#                   (src/lib/program.ts). The program pages, the Event Day page and the loyalty credits
#                   say "Sample". Never in production, and never deployed.
#   --program-sample=speakers  the same test data with only the `speakersPublic` gate open: the Speakers, the
#                   titles and the abstracts, with no times, rooms, calendar files or Event Day page.
#   --clock HH:MM   the time of day the build describes (Central), with --now, for the Event Day page's
#                   "Updated" stamp and its now and next. Never in production.
set -euo pipefail

cd "$(dirname "$0")/.."

# No build telemetry: this project collects no data, including about itself.
export ASTRO_TELEMETRY_DISABLED=1

zip=false
serve=false
install=true
# The build day and the samples come only from the flags, never from inherited variables.
unset KCD_BUILD_DAY KCD_BUILD_CLOCK KCD_TICKETS_DAY KCD_PROGRAM_PUBLIC KCD_SPONSORS_SAMPLE KCD_PROGRAM_SAMPLE
production() { [ "${CONTEXT:-}" = production ] || [ "${GITHUB_REF:-}" = refs/heads/release ]; }
while [ $# -gt 0 ]; do
  case "$1" in
    --zip) zip=true ;;
    --serve) serve=true ;;
    --skip-install) install=false ;;
    --now)
      [[ "${2:-}" =~ ^[0-9]{4}-[0-9]{2}-[0-9]{2}$ ]] || { echo "--now needs a date as YYYY-MM-DD" >&2; exit 2; }
      # Netlify sets CONTEXT; a production deploy must describe the real day.
      if production; then
        echo "--now is not allowed in a production build" >&2; exit 2
      fi
      export KCD_BUILD_DAY="$2"; shift ;;
    --tickets-day)
      [[ "${2:-}" =~ ^[0-9]{4}-[0-9]{2}-[0-9]{2}$ ]] || { echo "--tickets-day needs a date as YYYY-MM-DD" >&2; exit 2; }
      if production; then
        echo "--tickets-day is not allowed in a production build" >&2; exit 2
      fi
      export KCD_TICKETS_DAY="$2"; shift ;;
    --program-public)
      if production; then echo "--program-public is not allowed in a production build" >&2; exit 2; fi
      export KCD_PROGRAM_PUBLIC=1 ;;
    --sponsors-sample)
      if production; then echo "--sponsors-sample is not allowed in a production build" >&2; exit 2; fi
      export KCD_SPONSORS_SAMPLE=1 ;;
    --program-sample)
      if production; then echo "--program-sample is not allowed in a production build" >&2; exit 2; fi
      export KCD_PROGRAM_SAMPLE=1 ;;
    --program-sample=speakers)
      if production; then echo "--program-sample is not allowed in a production build" >&2; exit 2; fi
      export KCD_PROGRAM_SAMPLE=speakers ;;
    --clock)
      [[ "${2:-}" =~ ^([01][0-9]|2[0-3]):[0-5][0-9]$ ]] || { echo "--clock needs a time as HH:MM" >&2; exit 2; }
      if production; then echo "--clock is not allowed in a production build" >&2; exit 2; fi
      export KCD_BUILD_CLOCK="$2"; shift ;;
    *) echo "Unknown option: $1" >&2; exit 2 ;;
  esac
  shift
done

step() { printf '\n==> %s\n' "$1"; }

if [ -n "${KCD_BUILD_DAY:-}" ]; then
  echo "Building as if today were $KCD_BUILD_DAY (Central time). Test builds only."
fi
if [ -n "${KCD_TICKETS_DAY:-}" ]; then
  echo "Building with a sample ticket sale day, $KCD_TICKETS_DAY. Test builds only."
fi
if [ -n "${KCD_PROGRAM_PUBLIC:-}" ]; then
  echo "Building as if the program were public (no program data). Test builds only."
fi
if [ -n "${KCD_SPONSORS_SAMPLE:-}" ]; then
  echo "Building with sample 2027 sponsor tiles. Test builds only; never deploy this build."
fi
if [ "${KCD_PROGRAM_SAMPLE:-}" = 1 ]; then
  echo "Building with the sample program (the 2026 Schedule and the fixture). Test builds only; never deploy this build."
elif [ -n "${KCD_PROGRAM_SAMPLE:-}" ]; then
  echo "Building with the sample Speakers and Sessions, no times or rooms (the 2026 Schedule and the fixture). Test builds only; never deploy this build."
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

step "Choosing the program data"
# Real program data only in a production build (src/lib/program-source/platform.mjs). Every other build with a
# gate open (deploy previews, branch deploys, local builds) uses the test program and never sees the platform's
# variables.
if [ "${CONTEXT:-}" != production ]; then
  unset SESSIONIZE_ENDPOINT_ID PROGRAM_CSV_URL
  gates="$(node scripts/program-check.mjs --which-gates)"
  if [ -z "${KCD_PROGRAM_SAMPLE:-}" ] && [ "$gates" != closed ]; then
    # The test program opens the same gates as the Edition file: only the Speakers', or the Schedule's too.
    echo "A program gate is open, and this isn't a production build: using the test program, labeled \"Sample\"."
    if [ "$gates" = speakers ]; then export KCD_PROGRAM_SAMPLE=speakers; else export KCD_PROGRAM_SAMPLE=1; fi
  else
    echo "Not a production build: no real program data."
  fi
elif [ "$(node scripts/program-check.mjs --gates)" = open ]; then
  echo "A program gate is open: reading the program platform."
else
  echo "The program gates are closed: no program data."
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

step "Checking the Event Day announcements"
node scripts/check-announcements.mjs

step "Checking color contrast (WCAG AA)"
node scripts/check-contrast.mjs

step "Type-checking"
npx astro check

step "Building the site"
npx astro build

# A test-flag build marks dist/ as one, so no deploy can publish it: check-dist fails a marked build in a
# production context, and the preview deploy refuses it.
test_flags=()
for v in KCD_BUILD_DAY KCD_BUILD_CLOCK KCD_TICKETS_DAY KCD_PROGRAM_PUBLIC KCD_SPONSORS_SAMPLE KCD_PROGRAM_SAMPLE; do
  if [ -n "${!v:-}" ]; then test_flags+=("$v"); fi
done
if [ ${#test_flags[@]} -gt 0 ]; then
  printf 'A test build (%s). Never deploy it.\n' "${test_flags[*]}" > dist/.test-build
fi

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
