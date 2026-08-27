import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const read = (relativePath: string) =>
  fs.readFileSync(path.resolve(process.cwd(), relativePath), "utf8").replace(/\r\n/g, "\n");

describe("production PostgreSQL public-media fallback", () => {
  it("creates a bounded public-only byte store in the existing database", () => {
    const migration = read("migrations/0127_public_media_objects.sql");
    const journal = JSON.parse(read("migrations/meta/_journal.json"));

    expect(migration).toContain("CREATE TABLE IF NOT EXISTS public_media_objects");
    expect(migration).toContain("body BYTEA NOT NULL");
    expect(migration).toContain("content_length BIGINT GENERATED ALWAYS AS");
    expect(migration).toContain("object_key ~ '^(public-media|uploads)/");
    expect(migration).toContain("octet_length(body) <= 26214400");
    expect(migration).toContain("jsonb_typeof(metadata) = 'object'");
    expect(migration).toContain("tradescout-schema:0127:v1");
    expect(migration).not.toMatch(/private\//);
    expect(journal.entries.at(-1)).toMatchObject({
      idx: 130,
      tag: "0127_public_media_objects",
    });
  });

  it("keeps PostgreSQL behind complete R2 and AWS S3 configurations", () => {
    const runtime = read("server/serverObjectStorage.ts");
    const migrationRuntime = read("scripts/server-object-storage.mjs");

    for (const source of [runtime, migrationRuntime]) {
      expect(source.indexOf("if (r2.missing.length === 0)")).toBeLessThan(
        source.indexOf("if (aws.missing.length === 0)")
      );
      expect(source.indexOf("if (aws.missing.length === 0)")).toBeLessThan(
        source.indexOf("if (databaseUrl)")
      );
      expect(source).toContain("DATABASE_URL");
      expect(source).toContain("createPostgresPublicMediaS3Client");
    }
  });
});
