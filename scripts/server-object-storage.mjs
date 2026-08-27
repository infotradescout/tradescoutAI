const R2_KEYS = [
  "R2_ACCOUNT_ID",
  "R2_ACCESS_KEY_ID",
  "R2_SECRET_ACCESS_KEY",
  "R2_BUCKET_NAME",
];
const AWS_S3_KEYS = [
  "AWS_ACCESS_KEY_ID",
  "AWS_SECRET_ACCESS_KEY",
  "AWS_REGION",
  "AWS_S3_BUCKET",
];

function envValue(environment, key) {
  return String(environment[key] || "").trim();
}

function environmentGroup(environment, keys) {
  const values = Object.fromEntries(keys.map((key) => [key, envValue(environment, key)]));
  const missing = keys.filter((key) => !values[key]);
  return Object.freeze({ values, missing, present: keys.length - missing.length });
}

export function serverObjectStorageConfiguration(environment = process.env) {
  const r2 = environmentGroup(environment, R2_KEYS);
  const aws = environmentGroup(environment, AWS_S3_KEYS);

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

  const databaseUrl = envValue(environment, "DATABASE_URL");
  if (databaseUrl) {
    return Object.freeze({
      provider: "postgres-public-media",
      bucketName: "postgres-public-media",
      databaseUrl,
    });
  }

  if (r2.present === 0 && aws.present === 0) return null;
  const details = [];
  if (r2.present > 0) details.push(`R2 missing ${r2.missing.join(", ")}`);
  if (aws.present > 0) details.push(`AWS S3 missing ${aws.missing.join(", ")}`);
  throw new Error(`Incomplete server object storage configuration (${details.join("; ")})`);
}

export function requireServerObjectStorageConfiguration(environment = process.env) {
  const configuration = serverObjectStorageConfiguration(environment);
  if (!configuration) {
    throw new Error(
      "Server object storage is not configured; expected complete R2, AWS S3, or production database contract"
    );
  }
  return configuration;
}

export function serverObjectStorageClientOptions(configuration) {
  if (configuration.provider === "postgres-public-media") {
    throw new TypeError("PostgreSQL public media does not use S3 client options");
  }
  return {
    region: configuration.region,
    ...(configuration.endpoint ? { endpoint: configuration.endpoint } : {}),
    credentials: {
      accessKeyId: configuration.accessKeyId,
      secretAccessKey: configuration.secretAccessKey,
    },
  };
}

export async function createServerObjectStorageClient(configuration) {
  if (configuration.provider === "postgres-public-media") {
    const pg = await import("pg");
    const Pool = pg.default?.Pool || pg.Pool;
    const pool = new Pool({
      connectionString: configuration.databaseUrl,
      max: 8,
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 10_000,
    });
    return createPostgresPublicMediaS3Client({
      query: (text, values = []) => pool.query(text, values),
      close: () => pool.end(),
    });
  }

  const { S3Client } = await import("@aws-sdk/client-s3");
  return new S3Client(serverObjectStorageClientOptions(configuration));
}
import { createPostgresPublicMediaS3Client } from "../shared/postgresPublicMediaS3Client.mjs";
