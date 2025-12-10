import 'dotenv/config';
import { defineConfig } from 'vitest/config';
import path from 'path';

const r = (p: string) => path.resolve(__dirname, p);

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['server/tests/**/*.test.ts'],
    exclude: ['node_modules', 'dist', '.idea', '.git', '.cache'],
    passWithNoTests: false,
    reporter: ['default', 'html'],
    outputFile: {
      html: './test-results.html',
    },
  },
  resolve: {
    alias: {
      // Keep any existing aliases you rely on
      '@': r('./'),
      // Critical: ensure @shared/schema resolves in Vitest the same way as in Vite/TS
      '@shared': r('shared'),
    },
  },
});
