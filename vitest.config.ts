import "dotenv/config";
import { defineConfig } from "vitest/config";
import path from "path";

const r = (p: string) => path.resolve(__dirname, p);

const serialNoSkips = ["1", "true", "yes", "on"].includes(
  String(process.env.VITEST_SERIAL || "").toLowerCase()
);
const htmlReportFile = `./test-results/vitest-report-${process.pid}.html`;
const focusedDirectConnectRun = process.argv.some((arg) =>
  /direct-connect-(intake|routing-spine|contractor-card|dispatch-ledger)\.contract/i.test(arg)
);
const reporters = focusedDirectConnectRun ? ["default"] : ["default", "html"];

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: [
      "server/tests/**/*.test.ts",
      "server/utils/**/*.test.ts",
      "client/src/**/*.test.{ts,tsx}",
    ],
    exclude: ["node_modules", "dist", ".idea", ".git", ".cache"],
    passWithNoTests: false,
    fileParallelism: !serialNoSkips,
    reporters,
    outputFile: {
      // Keep Vitest HTML output out of git-tracked root files (and inside an ignored folder).
      html: htmlReportFile,
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
