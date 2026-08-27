import assert from "node:assert/strict";
import test from "node:test";
import { GetObjectCommand, HeadObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import {
  createPostgresPublicMediaS3Client,
  isSafePostgresPublicObjectKey,
  postgresConditionalStatus,
  publicObjectEtag,
  resolvePostgresPublicMediaCommandOperation,
  resolvePostgresByteRange,
} from "../shared/postgresPublicMediaS3Client.mjs";

test("PostgreSQL adapter uses stable Smithy operation names after bundling", () => {
  const bundledCommand = {
    constructor: { name: "HeadObjectCommand2" },
    schema: [9, "com.amazonaws.s3", "HeadObject"],
    input: { Key: "public-media/images/stone.webp" },
  };

  assert.equal(resolvePostgresPublicMediaCommandOperation(bundledCommand), "HeadObject");
});

test("PostgreSQL public object keys reject traversal and private prefixes", () => {
  assert.equal(isSafePostgresPublicObjectKey("public-media/images/stone.webp"), true);
  assert.equal(isSafePostgresPublicObjectKey("uploads/public-photo.jpg"), true);
  assert.equal(isSafePostgresPublicObjectKey("public-media/../private/secret"), false);
  assert.equal(isSafePostgresPublicObjectKey("private/user/secret"), false);
  assert.equal(isSafePostgresPublicObjectKey("public-media\\secret"), false);
});

test("PostgreSQL byte ranges support bounded and suffix reads", () => {
  assert.deepEqual(resolvePostgresByteRange("bytes=1-3", 5), {
    start: 1,
    end: 3,
    length: 3,
  });
  assert.deepEqual(resolvePostgresByteRange("bytes=-2", 5), {
    start: 3,
    end: 4,
    length: 2,
  });
  assert.equal(resolvePostgresByteRange("bytes=8-9", 5), null);
});

test("PostgreSQL conditions preserve ETag and modification semantics", () => {
  const object = {
    ETag: '"abc"',
    LastModified: new Date("2026-08-20T12:00:00.750Z"),
  };
  assert.equal(postgresConditionalStatus({ IfNoneMatch: 'W/"abc"' }, object), 304);
  assert.equal(postgresConditionalStatus({ IfMatch: 'W/"abc"' }, object), 412);
  assert.equal(postgresConditionalStatus({ IfMatch: '"different"' }, object), 412);
  assert.equal(
    postgresConditionalStatus(
      { IfModifiedSince: new Date("2026-08-20T12:00:00.000Z") },
      object
    ),
    304
  );
});

test("PostgreSQL adapter writes, heads, and ranges immutable public objects", async () => {
  let row = null;
  const query = async (sql, values = []) => {
    if (sql.includes("INSERT INTO public_media_objects")) {
      row = {
        object_key: values[0],
        body: values[1],
        content_length: values[1].length,
        content_type: values[2],
        etag: values[3],
        cache_control: values[4],
        metadata: JSON.parse(values[5]),
        updated_at: new Date("2026-08-20T12:00:00.000Z"),
      };
      return { rows: [] };
    }
    if (sql.includes("substring(body")) {
      const start = Number(values[1]) - 1;
      return { rows: [{ body: row.body.subarray(start, start + Number(values[2])) }] };
    }
    if (sql.includes("SELECT body")) return { rows: row ? [{ body: row.body }] : [] };
    return { rows: row ? [row] : [] };
  };
  const client = createPostgresPublicMediaS3Client({ query });
  const key = "public-media/images/stone.webp";
  const body = Buffer.from("stone");

  await client.send(
    new PutObjectCommand({
      Bucket: "database",
      Key: key,
      Body: body,
      ContentType: "image/webp",
      Metadata: { "migration-id": "test" },
    })
  );
  const head = await client.send(new HeadObjectCommand({ Bucket: "database", Key: key }));
  assert.equal(head.ContentLength, 5);
  assert.equal(head.ETag, publicObjectEtag(body));
  assert.equal(head.Metadata["migration-id"], "test");

  const ranged = await client.send(
    new GetObjectCommand({ Bucket: "database", Key: key, Range: "bytes=1-3" })
  );
  const chunks = [];
  for await (const chunk of ranged.Body) chunks.push(Buffer.from(chunk));
  assert.equal(Buffer.concat(chunks).toString("utf8"), "ton");
  assert.equal(ranged.ContentRange, "bytes 1-3/5");
});
