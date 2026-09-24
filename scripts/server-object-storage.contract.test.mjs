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

const neon = {
  ...aws,
  SERVER_OBJECT_STORAGE_PROVIDER: "neon-s3",
  AWS_ENDPOINT_URL_S3: "https://br-test.storage.c-2.us-east-1.aws.neon.tech/",
};

test("explicit Neon selects the branch endpoint with path-style addressing", () => {
  const configuration = serverObjectStorageConfiguration({ ...r2, ...neon });
  assert.equal(configuration.provider, "neon-s3");
  assert.equal(configuration.bucketName, aws.AWS_S3_BUCKET);
  assert.deepEqual(serverObjectStorageClientOptions(configuration), {
    region: aws.AWS_REGION,
    endpoint: "https://br-test.storage.c-2.us-east-1.aws.neon.tech",
    forcePathStyle: true,
    requestChecksumCalculation: "WHEN_REQUIRED",
    credentials: { accessKeyId: aws.AWS_ACCESS_KEY_ID, secretAccessKey: aws.AWS_SECRET_ACCESS_KEY },
  });
});

test("partial Neon settings never fall back to R2 or PostgreSQL", () => {
  for (const key of [
    "AWS_ACCESS_KEY_ID",
    "AWS_SECRET_ACCESS_KEY",
    "AWS_REGION",
    "AWS_S3_BUCKET",
    "AWS_ENDPOINT_URL_S3",
  ]) {
    assert.throws(
      () =>
        serverObjectStorageConfiguration({
          ...r2,
          ...neon,
          DATABASE_URL: "postgresql://unused/database",
          [key]: " ",
        }),
      new RegExp(`missing ${key}`)
    );
  }
});

test("Neon endpoint injection alone and invalid provider selections fail closed", () => {
  assert.throws(
    () =>
      serverObjectStorageConfiguration({
        ...neon,
        SERVER_OBJECT_STORAGE_PROVIDER: "",
        DATABASE_URL: "postgresql://unused/database",
      }),
    /requires SERVER_OBJECT_STORAGE_PROVIDER=neon-s3/
  );
  assert.throws(
    () =>
      serverObjectStorageConfiguration({
        ...neon,
        SERVER_OBJECT_STORAGE_PROVIDER: "neon-typo",
      }),
    /Invalid SERVER_OBJECT_STORAGE_PROVIDER/
  );
});

test("Neon requires a bare HTTPS branch endpoint", () => {
  for (const endpoint of [
    "not-a-url",
    "http://br-test.storage.us-east-1.aws.neon.tech",
    "https://br-test.storage.us-east-1.aws.neon.tech/bucket",
    "https://br-test.storage.us-east-1.aws.neon.tech?secret=hidden",
    "https://user:secret@br-test.storage.us-east-1.aws.neon.tech",
    "https://br-test.storage.us-east-1.aws.neon.tech.evil.example",
  ]) {
    assert.throws(
      () => serverObjectStorageConfiguration({ ...neon, AWS_ENDPOINT_URL_S3: endpoint }),
      /AWS_ENDPOINT_URL_S3 must be a bare HTTPS Neon branch storage endpoint/
    );
  }
});

test("explicit legacy selection is honored without injected Neon endpoint settings", () => {
  const configuration = serverObjectStorageConfiguration({
    ...r2,
    ...aws,
    SERVER_OBJECT_STORAGE_PROVIDER: "aws-s3",
  });
  assert.equal(configuration.provider, "aws-s3");
  assert.equal(serverObjectStorageClientOptions(configuration).endpoint, undefined);
  assert.throws(
    () =>
      serverObjectStorageConfiguration({
        ...neon,
        SERVER_OBJECT_STORAGE_PROVIDER: "aws-s3",
      }),
    /AWS_ENDPOINT_URL_S3 requires SERVER_OBJECT_STORAGE_PROVIDER=neon-s3/
  );
  assert.throws(
    () =>
      serverObjectStorageConfiguration({
        ...aws,
        SERVER_OBJECT_STORAGE_PROVIDER: "cloudflare-r2",
      }),
    /Incomplete R2 configuration/
  );
  assert.throws(
    () =>
      serverObjectStorageConfiguration({
        ...aws,
        SERVER_OBJECT_STORAGE_PROVIDER: "postgres-public-media",
      }),
    /missing DATABASE_URL/
  );
});
