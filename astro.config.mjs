// @ts-check
import { defineConfig } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';
import relativeLinks from 'astro-relative-links';
// https://astro.build/config
export default defineConfig({
  vite: {
    plugins: [tailwindcss()],
  },

  integrations: [relativeLinks()],

  server: {
    port: 3000,
    open: true,
    host: true,
  },
});
