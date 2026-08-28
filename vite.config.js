import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    // three.js core alone is ~512 kB minified (~130 kB gzipped) and the project
    // scope rules out code-splitting it. Raised so the build stays pristine,
    // but low enough that real bundle growth still warns.
    chunkSizeWarningLimit: 700,
  },
  test: {
    environment: 'node',
    include: ['tests/**/*.test.js'],
  },
});
