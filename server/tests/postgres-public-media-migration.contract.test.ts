import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { getServerObjectStorageConfiguration } from "../serverObjectStorage";
import { serverObjectStorageConfiguration } from "../../scripts/server-object-storage.mjs";

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
    expect(
      journal.entries.find((entry: { tag?: string }) => entry.tag === "0127_public_media_objects")
    ).toMatchObject({
      idx: 130,
      tag: "0127_public_media_objects",
    });
  });

  it("keeps PostgreSQL behind complete R2 and AWS S3 configurations", () => {
    const r2 = {
      R2_ACCOUNT_ID: "test-account",
      R2_ACCESS_KEY_ID: "test-r2-key",
      R2_SECRET_ACCESS_KEY: "test-r2-secret",
      R2_BUCKET_NAME: "test-r2-bucket",
    };
    const aws = {
      AWS_ACCESS_KEY_ID: "test-aws-key",
      AWS_SECRET_ACCESS_KEY: "test-aws-secret",
      AWS_REGION: "us-east-1",
      AWS_S3_BUCKET: "test-aws-bucket",
    };
    const database = { DATABASE_URL: "postgresql://unused/database" };
    for (const configuration of [
      getServerObjectStorageConfiguration,
      serverObjectStorageConfiguration,
    ]) {
      expect(configuration({ ...r2, ...aws, ...database })?.provider).toBe("cloudflare-r2");
      expect(configuration({ ...aws, ...database })?.provider).toBe("aws-s3");
      expect(configuration(database)?.provider).toBe("postgres-public-media");
    }
  });
});
