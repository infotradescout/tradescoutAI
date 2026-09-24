import { S3Client } from "@aws-sdk/client-s3";
import { createPostgresPublicMediaS3Client } from "@shared/postgresPublicMediaS3Client.mjs";

export type ServerObjectStorageProvider =
  | "cloudflare-r2"
  | "aws-s3"
  | "neon-s3"
  | "postgres-public-media";

type S3ObjectStorageConfiguration = Readonly<{
  provider: "cloudflare-r2" | "aws-s3" | "neon-s3";
  accessKeyId: string;
  secretAccessKey: string;
  bucketName: string;
  region: string;
  endpoint?: string;
}>;

type PostgresObjectStorageConfiguration = Readonly<{
  provider: "postgres-public-media";
  bucketName: "postgres-public-media";
  databaseUrl: string;
}>;

export type ServerObjectStorageConfiguration =
  | S3ObjectStorageConfiguration
  | PostgresObjectStorageConfiguration;

export type ServerObjectStorageClient = {
  send(command: unknown): Promise<any>;
  close?: () => Promise<void>;
};

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
 * Without an explicit selection, preserve the established R2 -> AWS -> database
 * order. Neon is opt-in: injected AWS variables must never silently select AWS
 * or fall back to the database when a Neon contract is incomplete.
 */
export function getServerObjectStorageConfiguration(
  env: NodeJS.ProcessEnv = process.env
): ServerObjectStorageConfiguration | null {
  const selected = envValue(env, "SERVER_OBJECT_STORAGE_PROVIDER").toLowerCase();
  if (
    selected &&
    !["cloudflare-r2", "aws-s3", "neon-s3", "postgres-public-media"].includes(selected)
  ) {
    throw new Error("Invalid SERVER_OBJECT_STORAGE_PROVIDER");
  }
  const endpoint = envValue(env, "AWS_ENDPOINT_URL_S3");
  if (endpoint && selected !== "neon-s3") {
    throw new Error("AWS_ENDPOINT_URL_S3 requires SERVER_OBJECT_STORAGE_PROVIDER=neon-s3");
  }
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

  if (selected === "neon-s3") {
    const missing = [...aws.missing, ...(!endpoint ? ["AWS_ENDPOINT_URL_S3"] : [])];
    if (missing.length > 0) {
      throw new Error(
        `Incomplete Neon object storage configuration (missing ${missing.join(", ")})`
      );
    }
    let url: URL;
    try {
      url = new URL(endpoint);
    } catch {
      throw new Error("AWS_ENDPOINT_URL_S3 must be a bare HTTPS Neon branch storage endpoint");
    }
    if (
      url.protocol !== "https:" ||
      !/^br-[a-z0-9-]+\.storage(?:\.[a-z0-9-]+)*\.aws\.neon\.tech$/.test(url.hostname) ||
      url.port ||
      url.username ||
      url.password ||
      url.pathname !== "/" ||
      url.search ||
      url.hash
    ) {
      throw new Error("AWS_ENDPOINT_URL_S3 must be a bare HTTPS Neon branch storage endpoint");
    }
    return Object.freeze({
      provider: "neon-s3",
      accessKeyId: aws.values.AWS_ACCESS_KEY_ID,
      secretAccessKey: aws.values.AWS_SECRET_ACCESS_KEY,
      bucketName: aws.values.AWS_S3_BUCKET,
      region: aws.values.AWS_REGION,
      endpoint: url.origin,
    });
  }

  if (selected === "cloudflare-r2" && r2.missing.length > 0) {
    throw new Error(`Incomplete R2 configuration (missing ${r2.missing.join(", ")})`);
  }
  if (selected === "aws-s3" && aws.missing.length > 0) {
    throw new Error(`Incomplete AWS S3 configuration (missing ${aws.missing.join(", ")})`);
  }

  if ((!selected || selected === "cloudflare-r2") && r2.missing.length === 0) {
    return Object.freeze({
      provider: "cloudflare-r2",
      accessKeyId: r2.values.R2_ACCESS_KEY_ID,
      secretAccessKey: r2.values.R2_SECRET_ACCESS_KEY,
      bucketName: r2.values.R2_BUCKET_NAME,
      region: "auto",
      endpoint: `https://${r2.values.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    });
  }

  if ((!selected || selected === "aws-s3") && aws.missing.length === 0) {
    return Object.freeze({
      provider: "aws-s3",
      accessKeyId: aws.values.AWS_ACCESS_KEY_ID,
      secretAccessKey: aws.values.AWS_SECRET_ACCESS_KEY,
      bucketName: aws.values.AWS_S3_BUCKET,
      region: aws.values.AWS_REGION,
    });
  }

  const databaseUrl = envValue(env, "DATABASE_URL");
  if (selected === "postgres-public-media" && !databaseUrl) {
    throw new Error("Incomplete PostgreSQL public media configuration (missing DATABASE_URL)");
  }
  if (databaseUrl) {
    return Object.freeze({
      provider: "postgres-public-media",
      bucketName: "postgres-public-media",
      databaseUrl,
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
      "Server object storage is not configured; expected complete R2, AWS S3, explicitly selected Neon S3, or production database contract"
    );
  }
  return configuration;
}

export function createServerObjectStorageClient(
  configuration: ServerObjectStorageConfiguration
): ServerObjectStorageClient {
  if (configuration.provider === "postgres-public-media") {
    return createPostgresPublicMediaS3Client({
      query: async (text: string, values: unknown[] = []) => {
        const { pool } = await import("./db");
        return await pool.query(text, values as any[]);
      },
    });
  }
  return new S3Client({
    region: configuration.region,
    ...(configuration.endpoint ? { endpoint: configuration.endpoint } : {}),
    ...(configuration.provider === "neon-s3"
      ? { forcePathStyle: true, requestChecksumCalculation: "WHEN_REQUIRED" as const }
      : {}),
    credentials: {
      accessKeyId: configuration.accessKeyId,
      secretAccessKey: configuration.secretAccessKey,
    },
  });
}
