// Loads a self-contained TypeScript file (no imports of its own but Node's, such as src/data/edition-2027.ts)
// in plain Node. Node only reads .ts directly when it is built with type stripping, and some builds
// (Linux distribution packages, for one) are not, so the scripts and tests transpile with the
// TypeScript compiler the repo already depends on.
import { readFileSync } from 'node:fs';
import ts from 'typescript';

export async function importTs(url) {
  const { outputText } = ts.transpileModule(readFileSync(url, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
  });
  // A data: URL module can import Node's own modules (node:fs and the like), but nothing by path or package name.
  if (/^\s*(?:import|export)\b[^;]*\bfrom\s*['"](?!node:)/m.test(outputText)) throw new Error(`${url}: has imports; importTs only loads self-contained files`);
  return import(`data:text/javascript;base64,${Buffer.from(outputText).toString('base64')}`);
}
