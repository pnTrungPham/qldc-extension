import { fileURLToPath } from 'node:url';
import tailwindcss from '@tailwindcss/vite';

// The same app as a plain website (GitHub Pages), without the extension shell (background.ts).
export default {
  root: 'entrypoints/app',
  base: './',
  publicDir: fileURLToPath(new URL('public', import.meta.url)),
  resolve: { alias: { '@': fileURLToPath(new URL('src', import.meta.url)) } },
  esbuild: { jsx: 'automatic' },
  plugins: [tailwindcss()],
  build: { outDir: fileURLToPath(new URL('.output/web', import.meta.url)), emptyOutDir: true },
};
