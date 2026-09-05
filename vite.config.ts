import { defineConfig } from 'vite';

export default defineConfig({
  root: 'src/web',
  // Relative asset paths, so the built page works from a subdirectory —
  // GitHub Pages serves a project site under /<repo>/, not at the domain root.
  base: './',
  build: { outDir: '../../dist', emptyOutDir: true },
});
