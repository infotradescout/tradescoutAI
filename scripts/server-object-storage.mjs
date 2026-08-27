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
      "Server object storage is not configured; expected complete R2 or AWS S3 environment contract"
    );
  }
  return configuration;
}

export function serverObjectStorageClientOptions(configuration) {
  return {
    region: configuration.region,
    ...(configuration.endpoint ? { endpoint: configuration.endpoint } : {}),
    credentials: {
      accessKeyId: configuration.accessKeyId,
      secretAccessKey: configuration.secretAccessKey,
    },
  };
}
