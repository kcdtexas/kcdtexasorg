import { defineConfig } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  site: 'https://kcdtexas.org',
  build: {
    // Keep all CSS in external files so the strict CSP in _headers needs no hashes.
    inlineStylesheets: 'never',
  },
  vite: {
    plugins: [tailwindcss()],
  },
});
