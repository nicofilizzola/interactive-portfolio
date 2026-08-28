import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    // The bundle is ~525 kB minified (~132 kB gzipped), nearly all of it
    // WebGLRenderer + three's core, and the project scope rules out
    // code-splitting it. Raised so the build stays pristine, but tight enough
    // that a three upgrade or real bundle growth still warns.
    chunkSizeWarningLimit: 600,
  },
  test: {
    environment: 'node',
    include: ['tests/**/*.test.js'],
  },
});
