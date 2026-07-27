import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const routeFiles = [
  "server/routes.ts",
  "server/routes/business-claim.ts",
  "server/routes/direct-connect.ts",
  "server/routes/tradepartner-express.ts",
  "server/routes/worker-tasks.ts",
];
const authActionCall =
  /(?:passwordResetService|emailVerificationService)\.(?:createToken|consumeToken|consumeCodeForUser|resetPassword|verifyEmail|exchangeCodeForToken)\(/;

describe("auth action token async route contracts", () => {
  it("awaits every password reset and email verification store call", () => {
    const callSites: string[] = [];

    for (const relativePath of routeFiles) {
      const source = fs
        .readFileSync(path.join(repoRoot, relativePath), "utf8")
        .replace(/\r\n/g, "\n");
      for (const [index, line] of source.split("\n").entries()) {
        if (!authActionCall.test(line)) continue;
        callSites.push(`${relativePath}:${index + 1}`);
        expect(line, `${relativePath}:${index + 1}`).toMatch(
          /\bawait\s+(?:passwordResetService|emailVerificationService)\./
        );
      }
    }

    expect(callSites).toHaveLength(14);
  });
});
