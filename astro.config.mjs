import { fileURLToPath } from 'node:url';
import { defineConfig } from 'astro/config';
import { runnerImport } from 'vite';
import tailwindcss from '@tailwindcss/vite';

// The hero bill's fit values, computed from the font for what the bill says in this build (src/lib/bill-css.ts).
// The module is loaded with the build's KCD_* variables, so test builds (--now and the samples) fit their own bill.
function billFitCss() {
  const id = 'virtual:bill-fit.css';
  const resolved = `\0${id}`;
  return {
    name: 'kcd-bill-fit-css',
    resolveId: (source) => (source === id ? resolved : undefined),
    async load(source) {
      if (source !== resolved) return undefined;
      const { module } = await runnerImport(fileURLToPath(new URL('./src/lib/bill-css.ts', import.meta.url)), {
        configFile: false, envPrefix: ['KCD_'], logLevel: 'error',
      });
      return module.billCss();
    },
  };
}

export default defineConfig({
  site: 'https://kcdtexas.org',
  build: {
    // Keep all CSS in external files so the strict CSP in _headers needs no hashes.
    inlineStylesheets: 'never',
  },
  vite: {
    plugins: [tailwindcss(), billFitCss()],
  },
});
