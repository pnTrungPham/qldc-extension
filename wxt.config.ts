import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'wxt';

export default defineConfig({
  modules: ['@wxt-dev/module-react'],
  manifest: {
    name: 'Resident Management',
    permissions: ['unlimitedStorage'],
    // No popup, so a toolbar click reaches background.ts.
    action: {},
  },
  // WXT points `@` at srcDir, and the copied app imports `@/…` from src/.
  srcDir: 'src',
  entrypointsDir: '../entrypoints',
  // Explicit imports, like the copied app; auto-imports would also scan src/components and src/hooks.
  imports: false,
  vite: () => ({
    plugins: [tailwindcss()],
    build: {
      // `wp i18n make-pot` reads this bundle (see lib/i18n.ts). terser because it can turn off folding
      // `c ? i18n.__('A') : i18n.__('B')` into `i18n.__(c ? 'A' : 'B')`, which make-pot cannot read.
      minify: 'terser',
      terserOptions: {
        compress: { conditionals: false },
        format: { comments: /translators:/i },
      },
    },
  }),
});
