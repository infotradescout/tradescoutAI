import "dotenv/config";
import { defineConfig } from "vitest/config";
import path from "path";

const r = (p: string) => path.resolve(__dirname, p);

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: ["server/tests/**/*.test.ts", "client/src/**/*.test.ts"],
    exclude: ["node_modules", "dist", ".idea", ".git", ".cache"],
    passWithNoTests: false,
    reporter: ["default", "html"],
    outputFile: {
      // Keep Vitest HTML output out of git-tracked root files (and inside an ignored folder).
      html: "./test-results/vitest-report.html",
    },
  },
  resolve: {
    alias: {
      // Match Vite/TS aliases so client imports like "@/hooks/useAuth" resolve in tests.
      "@": r("client/src"),
      // Critical: ensure @shared/schema resolves in Vitest the same way as in Vite/TS
      "@shared": r("shared"),
    },
  },
});
