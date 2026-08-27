import { createHash } from "node:crypto";
import { Readable } from "node:stream";

const SAFE_PUBLIC_OBJECT_KEY = /^(?:public-media|uploads)\/[A-Za-z0-9._/-]+$/;

function storageError(status, name, message) {
  const error = new Error(message || name);
  error.name = name;
  error.$metadata = { httpStatusCode: status };
  return error;
}

export function isSafePostgresPublicObjectKey(value) {
  const key = String(value || "");
  return (
    SAFE_PUBLIC_OBJECT_KEY.test(key) &&
    !key.includes("\\") &&
    !key.split("/").some((segment) => segment === "." || segment === "..")
  );
}

export function publicObjectEtag(body) {
  const bytes = Buffer.isBuffer(body) ? body : Buffer.from(body);
  return `"${createHash("sha256").update(bytes).digest("hex")}"`;
}

function comparableEtag(value) {
  return String(value || "").trim().replace(/^W\//i, "");
}

function etagHeaderMatches(header, etag, weakComparison) {
  if (!header) return false;
  return String(header)
    .split(",")
    .map((value) => value.trim())
    .some(
      (value) =>
        value === "*" ||
        (weakComparison
          ? comparableEtag(value) === comparableEtag(etag)
          : value === etag)
    );
}

export function postgresConditionalStatus(input, object) {
  const etag = String(object.ETag || "");
  const modified = object.LastModified instanceof Date ? object.LastModified : new Date(0);
  const modifiedSeconds = Math.floor(modified.getTime() / 1000);
  if (input.IfMatch && !etagHeaderMatches(input.IfMatch, etag, false)) return 412;
  if (
    !input.IfMatch &&
    input.IfUnmodifiedSince instanceof Date &&
    modifiedSeconds > Math.floor(input.IfUnmodifiedSince.getTime() / 1000)
  ) {
    return 412;
  }
  if (input.IfNoneMatch && etagHeaderMatches(input.IfNoneMatch, etag, true)) return 304;
  if (
    !input.IfNoneMatch &&
    input.IfModifiedSince instanceof Date &&
    modifiedSeconds <= Math.floor(input.IfModifiedSince.getTime() / 1000)
  ) {
    return 304;
  }
  return null;
}

export function resolvePostgresByteRange(value, totalBytes) {
  const range = String(value || "");
  if (!Number.isSafeInteger(totalBytes) || totalBytes <= 0 || !/^bytes=(?:\d+-\d*|-\d+)$/.test(range)) {
    return null;
  }

  const spec = range.slice("bytes=".length);
  if (spec.startsWith("-")) {
    const suffixBytes = Number(spec.slice(1));
    if (!Number.isSafeInteger(suffixBytes) || suffixBytes <= 0) return null;
    const length = Math.min(suffixBytes, totalBytes);
    return Object.freeze({ start: totalBytes - length, end: totalBytes - 1, length });
  }

  const [startText, endText] = spec.split("-");
  const start = Number(startText);
  if (!Number.isSafeInteger(start) || start < 0 || start >= totalBytes) return null;
  const requestedEnd = endText ? Number(endText) : totalBytes - 1;
  if (!Number.isSafeInteger(requestedEnd) || requestedEnd < start) return null;
  const end = Math.min(requestedEnd, totalBytes - 1);
  return Object.freeze({ start, end, length: end - start + 1 });
}

async function bodyToBuffer(body) {
  if (Buffer.isBuffer(body)) return body;
  if (body instanceof Uint8Array || typeof body === "string") return Buffer.from(body);
  if (body && typeof body.transformToByteArray === "function") {
    return Buffer.from(await body.transformToByteArray());
  }
  const chunks = [];
  for await (const chunk of body || []) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
}

function toObjectMetadata(row) {
  return {
    AcceptRanges: "bytes",
    ContentLength: Number(row.content_length),
    ContentType: row.content_type,
    ETag: row.etag,
    LastModified: row.updated_at instanceof Date ? row.updated_at : new Date(row.updated_at),
    CacheControl: row.cache_control,
    Metadata: row.metadata || {},
  };
}

export function createPostgresPublicMediaS3Client(options) {
  if (!options || typeof options.query !== "function") {
    throw new TypeError("PostgreSQL public-media client requires a query function");
  }

  async function metadataForKey(key) {
    if (!isSafePostgresPublicObjectKey(key)) {
      throw storageError(404, "NoSuchKey", "Public object key was rejected");
    }
    const result = await options.query(
      `SELECT object_key, content_length, content_type, etag, cache_control, metadata, updated_at
         FROM public_media_objects
        WHERE object_key = $1`,
      [key]
    );
    const row = result?.rows?.[0];
    if (!row) throw storageError(404, "NoSuchKey", "Public object was not found");
    return toObjectMetadata(row);
  }

  return Object.freeze({
    async send(command) {
      const name = String(command?.constructor?.name || "");
      const input = command?.input || {};
      const key = String(input.Key || "");

      if (name === "PutObjectCommand") {
        if (!isSafePostgresPublicObjectKey(key)) {
          throw storageError(400, "InvalidObjectKey", "Public object key was rejected");
        }
        const body = await bodyToBuffer(input.Body);
        if (body.length <= 0 || body.length > 25 * 1024 * 1024) {
          throw storageError(400, "InvalidObjectBody", "Public object body size was rejected");
        }
        const contentType = String(input.ContentType || "application/octet-stream").toLowerCase();
        const etag = publicObjectEtag(body);
        await options.query(
          `INSERT INTO public_media_objects (
             object_key, body, content_type, etag, cache_control, metadata, created_at, updated_at
           ) VALUES ($1, $2, $3, $4, $5, $6::jsonb, NOW(), NOW())
           ON CONFLICT (object_key) DO UPDATE SET
             body = EXCLUDED.body,
             content_type = EXCLUDED.content_type,
             etag = EXCLUDED.etag,
             cache_control = EXCLUDED.cache_control,
             metadata = EXCLUDED.metadata,
             updated_at = NOW()`,
          [
            key,
            body,
            contentType,
            etag,
            String(input.CacheControl || "public, max-age=31536000, immutable"),
            JSON.stringify(input.Metadata || {}),
          ]
        );
        return { ETag: etag, $metadata: { httpStatusCode: 200 } };
      }

      if (name !== "HeadObjectCommand" && name !== "GetObjectCommand") {
        throw new TypeError(`Unsupported public-media object command: ${name || "unknown"}`);
      }

      const metadata = await metadataForKey(key);
      const conditionalStatus = postgresConditionalStatus(input, metadata);
      if (conditionalStatus) {
        throw storageError(
          conditionalStatus,
          conditionalStatus === 304 ? "NotModified" : "PreconditionFailed"
        );
      }
      if (name === "HeadObjectCommand") return metadata;

      let range;
      if (input.Range) {
        range = resolvePostgresByteRange(input.Range, metadata.ContentLength);
        if (!range) throw storageError(416, "InvalidRange", "Requested range is not satisfiable");
      }
      const result = range
        ? await options.query(
            `SELECT substring(body FROM $2 FOR $3) AS body
               FROM public_media_objects
              WHERE object_key = $1`,
            [key, range.start + 1, range.length]
          )
        : await options.query(
            `SELECT body
               FROM public_media_objects
              WHERE object_key = $1`,
            [key]
          );
      const body = result?.rows?.[0]?.body;
      if (!body) throw storageError(404, "NoSuchKey", "Public object was not found");
      const bytes = Buffer.isBuffer(body) ? body : Buffer.from(body);
      return {
        ...metadata,
        ContentLength: bytes.length,
        ...(range
          ? { ContentRange: `bytes ${range.start}-${range.end}/${metadata.ContentLength}` }
          : {}),
        Body: Readable.from([bytes]),
      };
    },
    async close() {
      if (typeof options.close === "function") await options.close();
    },
  });
}
