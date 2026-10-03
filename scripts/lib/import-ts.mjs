// Loads a self-contained TypeScript data file (no imports of its own, such as src/data/edition-2027.ts)
// in plain Node. Node only reads .ts directly when it is built with type stripping, and some builds
// (Linux distribution packages, for one) are not, so the scripts and tests transpile with the
// TypeScript compiler the repo already depends on.
import { readFileSync } from 'node:fs';
import ts from 'typescript';

export async function importTs(url) {
  const { outputText } = ts.transpileModule(readFileSync(url, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
  });
  if (/^\s*(?:import|export)\b[^;]*\bfrom\s*['"]/m.test(outputText)) throw new Error(`${url}: has imports; importTs only loads self-contained files`);
  return import(`data:text/javascript;base64,${Buffer.from(outputText).toString('base64')}`);
}
