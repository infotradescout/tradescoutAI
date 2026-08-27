import { S3Client } from "@aws-sdk/client-s3";

export type R2Configuration = Readonly<{
  accountId: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucketName: string;
  publicUrlBase: string;
}>;

function envValue(env: NodeJS.ProcessEnv, key: string): string {
  return String(env[key] || "").trim();
}

export function getR2Configuration(env: NodeJS.ProcessEnv = process.env): R2Configuration | null {
  const values = {
    accountId: envValue(env, "R2_ACCOUNT_ID"),
    accessKeyId: envValue(env, "R2_ACCESS_KEY_ID"),
    secretAccessKey: envValue(env, "R2_SECRET_ACCESS_KEY"),
    bucketName: envValue(env, "R2_BUCKET_NAME"),
    publicUrlBase: envValue(env, "R2_PUBLIC_URL").replace(/\/+$/, ""),
  };

  const required = [
    ["R2_ACCOUNT_ID", values.accountId],
    ["R2_ACCESS_KEY_ID", values.accessKeyId],
    ["R2_SECRET_ACCESS_KEY", values.secretAccessKey],
    ["R2_BUCKET_NAME", values.bucketName],
  ] as const;
  const present = required.filter(([, value]) => Boolean(value));
  if (present.length === 0) return null;

  const missing = required.filter(([, value]) => !value).map(([key]) => key);
  if (missing.length > 0) {
    throw new Error(`Incomplete R2 configuration; missing ${missing.join(", ")}`);
  }
  return Object.freeze(values);
}

export function requireR2Configuration(env: NodeJS.ProcessEnv = process.env): R2Configuration {
  const configuration = getR2Configuration(env);
  if (!configuration) throw new Error("R2 storage is not configured");
  return configuration;
}

export function createR2Client(configuration: R2Configuration): S3Client {
  return new S3Client({
    region: "auto",
    endpoint: `https://${configuration.accountId}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: configuration.accessKeyId,
      secretAccessKey: configuration.secretAccessKey,
    },
  });
}
