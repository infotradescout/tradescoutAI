import { describe, expect, it } from "vitest";
import { GetObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import {
  createServerObjectStorageClient,
  getServerObjectStorageConfiguration,
} from "../serverObjectStorage";

const r2Environment = {
  R2_ACCOUNT_ID: "account",
  R2_ACCESS_KEY_ID: "r2-access",
  R2_SECRET_ACCESS_KEY: "r2-secret",
  R2_BUCKET_NAME: "r2-bucket",
};

const awsEnvironment = {
  AWS_ACCESS_KEY_ID: "aws-access",
  AWS_SECRET_ACCESS_KEY: "aws-secret",
  AWS_REGION: "us-east-1",
  AWS_S3_BUCKET: "aws-bucket",
};

const neonEnvironment = {
  ...awsEnvironment,
  SERVER_OBJECT_STORAGE_PROVIDER: "neon-s3",
  AWS_ENDPOINT_URL_S3: "https://br-test.storage.c-2.us-east-1.aws.neon.tech/",
};

describe("server object storage selection", () => {
  it("prefers a complete R2 configuration when both providers are available", () => {
    const configuration = getServerObjectStorageConfiguration({
      ...r2Environment,
      ...awsEnvironment,
    });

    expect(configuration).toMatchObject({
      provider: "cloudflare-r2",
      bucketName: "r2-bucket",
      region: "auto",
      endpoint: "https://account.r2.cloudflarestorage.com",
    });
  });

  it("uses the established AWS S3 contract when R2 is not fully configured", () => {
    const configuration = getServerObjectStorageConfiguration({
      R2_ACCOUNT_ID: "incomplete-r2",
      ...awsEnvironment,
    });

    expect(configuration).toEqual({
      provider: "aws-s3",
      accessKeyId: "aws-access",
      secretAccessKey: "aws-secret",
      bucketName: "aws-bucket",
      region: "us-east-1",
    });
  });

  it("returns null when neither production contract is configured", () => {
    expect(getServerObjectStorageConfiguration({})).toBeNull();
  });

  it("uses the existing production database when no S3-compatible contract is complete", () => {
    expect(
      getServerObjectStorageConfiguration({
        R2_ACCOUNT_ID: "incomplete-r2",
        DATABASE_URL: "postgresql://production/database",
      })
    ).toEqual({
      provider: "postgres-public-media",
      bucketName: "postgres-public-media",
      databaseUrl: "postgresql://production/database",
    });
  });

  it("rejects partial configuration without mixing providers", () => {
    expect(() =>
      getServerObjectStorageConfiguration({
        R2_ACCOUNT_ID: "incomplete-r2",
        AWS_REGION: "us-east-1",
      })
    ).toThrow(
      "Incomplete server object storage configuration (R2 missing R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME; AWS S3 missing AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, AWS_S3_BUCKET)"
    );
  });

  it("selects Neon only explicitly and keeps the existing bucket/key contract", async () => {
    const configuration = getServerObjectStorageConfiguration({
      ...r2Environment,
      ...neonEnvironment,
      DATABASE_URL: "postgresql://unused/database",
    });
    expect(configuration).toMatchObject({
      provider: "neon-s3",
      bucketName: "aws-bucket",
      endpoint: "https://br-test.storage.c-2.us-east-1.aws.neon.tech",
      region: "us-east-1",
    });
    const client = createServerObjectStorageClient(configuration!) as S3Client;
    try {
      expect(client.config.forcePathStyle).toBe(true);
      expect(await client.config.requestChecksumCalculation()).toBe("WHEN_REQUIRED");
      expect(await client.config.credentials()).toMatchObject({
        accessKeyId: awsEnvironment.AWS_ACCESS_KEY_ID,
        secretAccessKey: awsEnvironment.AWS_SECRET_ACCESS_KEY,
      });
      const key = "public-media/images/businesses/example/photo.webp";
      // Signing is local; no storage request is made.
      const url = new URL(
        await getSignedUrl(
          client,
          new GetObjectCommand({
            Bucket: configuration!.bucketName,
            Key: key,
          })
        )
      );
      expect(url.origin).toBe("https://br-test.storage.c-2.us-east-1.aws.neon.tech");
      expect(url.pathname).toBe(`/aws-bucket/${key}`);
    } finally {
      client.destroy();
    }
  });

  it.each([
    "AWS_ACCESS_KEY_ID",
    "AWS_SECRET_ACCESS_KEY",
    "AWS_REGION",
    "AWS_S3_BUCKET",
    "AWS_ENDPOINT_URL_S3",
  ])("rejects missing Neon %s even when a legacy store is complete", (key) => {
    expect(() =>
      getServerObjectStorageConfiguration({
        ...r2Environment,
        ...neonEnvironment,
        DATABASE_URL: "postgresql://unused/database",
        [key]: " ",
      })
    ).toThrow(`missing ${key}`);
  });

  it.each([
    "not-a-url",
    "http://br-test.storage.us-east-1.aws.neon.tech",
    "https://br-test.storage.us-east-1.aws.neon.tech/bucket",
    "https://br-test.storage.us-east-1.aws.neon.tech?secret=hidden",
    "https://user:secret@br-test.storage.us-east-1.aws.neon.tech",
    "https://br-test.storage.us-east-1.aws.neon.tech.evil.example",
  ])("rejects a malformed or non-Neon endpoint without echoing it", (endpoint) => {
    expect(() =>
      getServerObjectStorageConfiguration({
        ...neonEnvironment,
        AWS_ENDPOINT_URL_S3: endpoint,
      })
    ).toThrow("AWS_ENDPOINT_URL_S3 must be a bare HTTPS Neon branch storage endpoint");
  });

  it("does not silently interpret injected Neon settings as AWS or PostgreSQL", () => {
    expect(() =>
      getServerObjectStorageConfiguration({
        ...neonEnvironment,
        SERVER_OBJECT_STORAGE_PROVIDER: "",
        DATABASE_URL: "postgresql://unused/database",
      })
    ).toThrow("requires SERVER_OBJECT_STORAGE_PROVIDER=neon-s3");
    expect(() =>
      getServerObjectStorageConfiguration({
        ...neonEnvironment,
        SERVER_OBJECT_STORAGE_PROVIDER: "neon-typo",
      })
    ).toThrow("Invalid SERVER_OBJECT_STORAGE_PROVIDER");
  });

  it("allows explicit legacy selection without another provider taking precedence", () => {
    expect(
      getServerObjectStorageConfiguration({
        ...r2Environment,
        ...awsEnvironment,
        SERVER_OBJECT_STORAGE_PROVIDER: "aws-s3",
      })?.provider
    ).toBe("aws-s3");
    expect(() =>
      getServerObjectStorageConfiguration({
        ...awsEnvironment,
        SERVER_OBJECT_STORAGE_PROVIDER: "cloudflare-r2",
      })
    ).toThrow("Incomplete R2 configuration");
  });
});
