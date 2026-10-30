// Prints this build's kind for scripts/build.sh: "production", "preview" or "local" (src/lib/build-context.mjs).
// Usage: node scripts/build-context.mjs
import { buildKind } from '../src/lib/build-context.mjs';

console.log(buildKind(process.env));
