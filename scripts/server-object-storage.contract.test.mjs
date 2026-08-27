import assert from "node:assert/strict";
import test from "node:test";
import {
  serverObjectStorageClientOptions,
  serverObjectStorageConfiguration,
} from "./server-object-storage.mjs";

const r2 = {
  R2_ACCOUNT_ID: "account",
  R2_ACCESS_KEY_ID: "r2-access",
  R2_SECRET_ACCESS_KEY: "r2-secret",
  R2_BUCKET_NAME: "r2-bucket",
};
const aws = {
  AWS_ACCESS_KEY_ID: "aws-access",
  AWS_SECRET_ACCESS_KEY: "aws-secret",
  AWS_REGION: "us-west-2",
  AWS_S3_BUCKET: "aws-bucket",
};

test("complete R2 configuration takes precedence", () => {
  const configuration = serverObjectStorageConfiguration({ ...aws, ...r2 });
  assert.equal(configuration.provider, "cloudflare-r2");
  assert.equal(configuration.bucketName, "r2-bucket");
  assert.equal(
    serverObjectStorageClientOptions(configuration).endpoint,
    "https://account.r2.cloudflarestorage.com"
  );
});

test("complete AWS S3 configuration is used when R2 is absent or partial", () => {
  const configuration = serverObjectStorageConfiguration({
    R2_ACCOUNT_ID: "partial",
    ...aws,
  });
  assert.deepEqual(configuration, {
    provider: "aws-s3",
    accessKeyId: "aws-access",
    secretAccessKey: "aws-secret",
    bucketName: "aws-bucket",
    region: "us-west-2",
  });
  assert.equal(serverObjectStorageClientOptions(configuration).endpoint, undefined);
});

test("partial storage contracts fail without mixing credentials", () => {
  assert.throws(
    () =>
      serverObjectStorageConfiguration({
        R2_BUCKET_NAME: "partial-r2",
        AWS_REGION: "us-east-1",
      }),
    /R2 missing R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY; AWS S3 missing AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, AWS_S3_BUCKET/
  );
});

test("an empty environment reports object storage as unconfigured", () => {
  assert.equal(serverObjectStorageConfiguration({}), null);
});

test("production PostgreSQL is the persistent fallback when object credentials are absent", () => {
  assert.deepEqual(
    serverObjectStorageConfiguration({ DATABASE_URL: "postgresql://production/database" }),
    {
      provider: "postgres-public-media",
      bucketName: "postgres-public-media",
      databaseUrl: "postgresql://production/database",
    }
  );
});
