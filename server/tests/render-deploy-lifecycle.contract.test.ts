import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const read = (relativePath: string) =>
  fs.readFileSync(path.resolve(process.cwd(), relativePath), "utf8").replace(/\r\n/g, "\n");

describe("Render Docker deploy lifecycle", () => {
  it("keeps the migration runner and database TLS guard executable in the pruned image", () => {
    const dockerfile = read("Dockerfile");
    const runtimePackage = JSON.parse(read("runtime/package.json"));
    const mediaGate = read("scripts/ensure-public-media-ready.mjs");

    expect(runtimePackage.dependencies?.["drizzle-kit"]).toBe("0.31.9");
    expect(dockerfile).toContain("COPY --from=runtime-deps /runtime/node_modules ./node_modules");
    expect(dockerfile).toContain(
      "COPY --from=builder /app/runtime/drizzle.config.mjs ./runtime/drizzle.config.mjs"
    );
    expect(dockerfile).toContain(
      "COPY --from=builder /app/shared/database-url-security.mjs /app/runtime/database-url-security.mjs"
    );
    expect(dockerfile).toContain(
      "COPY --from=builder /app/runtime/run-release.mjs /app/runtime/run-release.mjs"
    );
    expect(dockerfile).toContain("COPY --from=builder /app/migrations ./migrations");
    expect(dockerfile).not.toContain("COPY --from=builder /app/server ./server");
    expect(dockerfile).not.toContain("COPY --from=builder /app/shared ./shared");
    expect(dockerfile).not.toContain("COPY --from=builder /app/scripts ./scripts");
    expect(dockerfile).not.toContain("COPY --from=builder /app/client ./client");
    expect(dockerfile).not.toContain("COPY --from=builder /app/docs ./docs");
    expect(dockerfile).not.toContain("COPY --from=builder /app/data ./data");
    expect(dockerfile).toContain(
      'CMD ["sh", "-c", "node runtime/run-release.mjs check-required-production-schema scripts/check-required-production-schema.mjs && node runtime/run-release.mjs ensure-public-media-ready scripts/ensure-public-media-ready.mjs && exec node dist/index.js"]'
    );
    expect(mediaGate).toContain("RENDER_GIT_COMMIT");
    expect(mediaGate).toContain("deploymentMarkerObjectKey");
    expect(mediaGate).not.toContain("client/public");
  });

  it("keeps provider configuration on commit-triggered verified-TLS migrate and readiness", () => {
    const blueprint = read("render.yaml");

    expect(blueprint).toContain("name: tradescoutAI");
    expect(blueprint).toContain("runtime: docker");
    expect(blueprint).toContain("dockerfilePath: ./Dockerfile");
    expect(blueprint).toContain("autoDeployTrigger: commit");
    expect(blueprint).toContain(
      "preDeployCommand: node runtime/run-release.mjs run-production-predeploy scripts/run-production-predeploy.mjs"
    );
    expect(blueprint).not.toContain("preDeployCommand: node dist/release/");
    expect(blueprint).toContain("healthCheckPath: /api/health");
    expect(blueprint).toContain("RUNTIME_MIGRATIONS_MODE");
    expect(blueprint).toContain('value: "off"');
    expect(blueprint).toContain("R2_ACCOUNT_ID");
    expect(blueprint).toContain("R2_ACCESS_KEY_ID");
    expect(blueprint).toContain("R2_SECRET_ACCESS_KEY");
    expect(blueprint).toContain("R2_BUCKET_NAME");
    expect(blueprint).toContain("AWS_ACCESS_KEY_ID");
    expect(blueprint).toContain("AWS_SECRET_ACCESS_KEY");
    expect(blueprint).toContain("AWS_REGION");
    expect(blueprint).toContain("AWS_S3_BUCKET");
  });

  it("uses the IPv4 public release-health endpoint for the container probe", () => {
    const dockerfile = read("Dockerfile");

    expect(dockerfile).toContain('"http://127.0.0.1:${PORT:-5000}/api/health"');
    expect(dockerfile).not.toContain('"http://localhost:${PORT:-5000}/api/health"');
    expect(dockerfile).not.toContain("/api/scout/health");
    expect(dockerfile).toContain("--start-period=10m");
  });
});
