import { S3Client } from "@aws-sdk/client-s3";

export type ServerObjectStorageProvider = "cloudflare-r2" | "aws-s3";

export type ServerObjectStorageConfiguration = Readonly<{
  provider: ServerObjectStorageProvider;
  accessKeyId: string;
  secretAccessKey: string;
  bucketName: string;
  region: string;
  endpoint?: string;
}>;

type EnvironmentGroup = Readonly<{
  values: Record<string, string>;
  missing: string[];
  present: number;
}>;

function envValue(env: NodeJS.ProcessEnv, key: string): string {
  return String(env[key] || "").trim();
}

function environmentGroup(env: NodeJS.ProcessEnv, keys: readonly string[]): EnvironmentGroup {
  const values = Object.fromEntries(keys.map((key) => [key, envValue(env, key)]));
  const missing = keys.filter((key) => !values[key]);
  return Object.freeze({
    values,
    missing,
    present: keys.length - missing.length,
  });
}

function incompleteConfigurationError(r2: EnvironmentGroup, aws: EnvironmentGroup): Error {
  const details: string[] = [];
  if (r2.present > 0) details.push(`R2 missing ${r2.missing.join(", ")}`);
  if (aws.present > 0) details.push(`AWS S3 missing ${aws.missing.join(", ")}`);
  return new Error(`Incomplete server object storage configuration (${details.join("; ")})`);
}

/**
 * Selects the existing production object store without exposing credentials.
 * A complete R2 contract wins; a complete AWS S3 contract is the established
 * production fallback. Partial provider configuration is never mixed.
 */
export function getServerObjectStorageConfiguration(
  env: NodeJS.ProcessEnv = process.env
): ServerObjectStorageConfiguration | null {
  const r2 = environmentGroup(env, [
    "R2_ACCOUNT_ID",
    "R2_ACCESS_KEY_ID",
    "R2_SECRET_ACCESS_KEY",
    "R2_BUCKET_NAME",
  ]);
  const aws = environmentGroup(env, [
    "AWS_ACCESS_KEY_ID",
    "AWS_SECRET_ACCESS_KEY",
    "AWS_REGION",
    "AWS_S3_BUCKET",
  ]);

  if (r2.missing.length === 0) {
    return Object.freeze({
      provider: "cloudflare-r2",
      accessKeyId: r2.values.R2_ACCESS_KEY_ID,
      secretAccessKey: r2.values.R2_SECRET_ACCESS_KEY,
      bucketName: r2.values.R2_BUCKET_NAME,
      region: "auto",
      endpoint: `https://${r2.values.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    });
  }

  if (aws.missing.length === 0) {
    return Object.freeze({
      provider: "aws-s3",
      accessKeyId: aws.values.AWS_ACCESS_KEY_ID,
      secretAccessKey: aws.values.AWS_SECRET_ACCESS_KEY,
      bucketName: aws.values.AWS_S3_BUCKET,
      region: aws.values.AWS_REGION,
    });
  }

  if (r2.present === 0 && aws.present === 0) return null;
  throw incompleteConfigurationError(r2, aws);
}

export function requireServerObjectStorageConfiguration(
  env: NodeJS.ProcessEnv = process.env
): ServerObjectStorageConfiguration {
  const configuration = getServerObjectStorageConfiguration(env);
  if (!configuration) {
    throw new Error(
      "Server object storage is not configured; expected complete R2 or AWS S3 environment contract"
    );
  }
  return configuration;
}

export function createServerObjectStorageClient(
  configuration: ServerObjectStorageConfiguration
): S3Client {
  return new S3Client({
    region: configuration.region,
    ...(configuration.endpoint ? { endpoint: configuration.endpoint } : {}),
    credentials: {
      accessKeyId: configuration.accessKeyId,
      secretAccessKey: configuration.secretAccessKey,
    },
  });
}
