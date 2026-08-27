import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const read = (relativePath: string) =>
  fs.readFileSync(path.resolve(process.cwd(), relativePath), "utf8").replace(/\r\n/g, "\n");

describe("Render Docker deploy lifecycle", () => {
  it("keeps the migration runner executable in the pruned production image", () => {
    const dockerfile = read("Dockerfile");
    const packageJson = JSON.parse(read("package.json"));
    const mediaGate = read("scripts/ensure-public-media-ready.mjs");

    expect(packageJson.dependencies?.["drizzle-kit"]).toBe("^0.31.9");
    expect(packageJson.devDependencies?.["drizzle-kit"]).toBeUndefined();
    expect(dockerfile).toContain("COPY --from=builder /app/drizzle.config.ts ./drizzle.config.ts");
    expect(dockerfile).toContain("COPY --from=builder /app/shared ./shared");
    expect(dockerfile).toContain("COPY --from=builder /app/scripts ./scripts");
    expect(dockerfile).toContain("COPY --from=builder /app/migrations ./migrations");
    expect(dockerfile.indexOf("COPY --from=builder /app/scripts ./scripts")).toBeLessThan(
      dockerfile.indexOf("node scripts/ensure-public-media-ready.mjs")
    );
    expect(dockerfile).toContain(
      'CMD ["sh", "-c", "node scripts/ensure-public-media-ready.mjs && exec node dist/index.js"]'
    );
    expect(packageJson.scripts?.["media:ensure:production"]).toBe(
      "node scripts/ensure-public-media-ready.mjs"
    );
    expect(mediaGate).toContain("RENDER_GIT_COMMIT");
    expect(mediaGate).toContain("deploymentMarkerObjectKey");
    expect(mediaGate).not.toContain("client/public");
  });

  it("keeps provider configuration on commit-triggered migrate, verify, and readiness", () => {
    const blueprint = read("render.yaml");

    expect(blueprint).toContain("name: tradescoutAI");
    expect(blueprint).toContain("runtime: docker");
    expect(blueprint).toContain("dockerfilePath: ./Dockerfile");
    expect(blueprint).toContain("autoDeployTrigger: commit");
    expect(blueprint).toContain(
      "preDeployCommand: npm run media:migrate:red-graniti && npm run media:migrate:jw-stone && npm run db:migrate && npm run db:verify:required"
    );
    expect(blueprint).toContain("healthCheckPath: /api/health");
    expect(blueprint).toContain("RUNTIME_MIGRATIONS_MODE");
    expect(blueprint).toContain('value: "off"');
    expect(blueprint).toContain("R2_ACCOUNT_ID");
    expect(blueprint).toContain("R2_ACCESS_KEY_ID");
    expect(blueprint).toContain("R2_SECRET_ACCESS_KEY");
    expect(blueprint).toContain("R2_BUCKET_NAME");
  });

  it("uses the IPv4 public release-health endpoint for the container probe", () => {
    const dockerfile = read("Dockerfile");

    expect(dockerfile).toContain('"http://127.0.0.1:${PORT:-5000}/api/health"');
    expect(dockerfile).not.toContain('"http://localhost:${PORT:-5000}/api/health"');
    expect(dockerfile).not.toContain("/api/scout/health");
    expect(dockerfile).toContain("--start-period=10m");
  });
});
