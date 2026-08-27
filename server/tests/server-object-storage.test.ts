import { describe, expect, it } from "vitest";
import { getServerObjectStorageConfiguration } from "../serverObjectStorage";

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
});
