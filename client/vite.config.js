import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// The dev server proxies /api and /socket.io to the Express server so the
// browser only ever talks to one origin and CORS stays out of the way.
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    host: true,
    proxy: {
      '/api': {
        target: process.env.VITE_PROXY_TARGET || 'http://localhost:5000',
        changeOrigin: true,
      },
      '/socket.io': {
        target: process.env.VITE_PROXY_TARGET || 'http://localhost:5000',
        ws: true,
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
    chunkSizeWarningLimit: 900,
  },
  // Vitest reads this same file, so tests resolve modules exactly as the app
  // does. Two configs would eventually disagree, and the failure shows up as a
  // test that passes while the real build is broken.
  test: {
    // jsdom implements enough of the DOM in Node that React can render into
    // it. No browser is launched, so the suite stays fast enough to run on
    // every save.
    environment: 'jsdom',
    // Expose describe/it/expect without importing them, matching the style of
    // the server's node:test suites.
    globals: true,
    setupFiles: ['./src/test/setup.js'],
    css: true,
    include: ['src/**/*.{test,spec}.{js,jsx}'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      reportsDirectory: './coverage',
      include: ['src/**/*.{js,jsx}'],
      // Infrastructure and entry points: no behaviour of their own to assert.
      exclude: ['src/test/**', 'src/main.jsx', '**/*.test.{js,jsx}'],
      // Deliberately no `thresholds` yet. The client starts at 0% coverage,
      // so an 80% gate would fail every run and teach us to ignore it. The
      // number gets ratcheted up as suites land, which keeps the gate
      // meaningful instead of theatrical.
    },
  },
});
