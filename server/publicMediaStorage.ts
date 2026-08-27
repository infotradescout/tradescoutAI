import { GetObjectCommand, HeadObjectCommand } from "@aws-sdk/client-s3";
import type { Request, Response } from "express";
import {
  createServerObjectStorageClient,
  getServerObjectStorageConfiguration,
} from "./serverObjectStorage";

export type PublicMediaStreamResult = "served" | "not_found" | "unconfigured" | "error";

type ObjectStorageSender = {
  send(command: unknown): Promise<any>;
};

type ReadPublicMediaBufferOptions = {
  key: string;
  maxBytes: number;
  client?: ObjectStorageSender;
  bucketName?: string;
};

type StreamPublicMediaOptions = {
  req: Request;
  res: Response;
  key: string;
  cacheControl?: string;
  client?: ObjectStorageSender;
  bucketName?: string;
};

const DEFAULT_PUBLIC_CACHE_CONTROL = "public, max-age=31536000, immutable";

function requestHeader(req: Request, name: string): string | undefined {
  const value = req.get(name);
  return value && value.trim() ? value.trim() : undefined;
}

function requestDate(req: Request, name: string): Date | undefined {
  const value = requestHeader(req, name);
  if (!value) return undefined;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

function requestRange(req: Request): string | undefined {
  const value = requestHeader(req, "range");
  if (!value) return undefined;
  return /^bytes=(?:\d+-\d*|-\d+)$/.test(value) ? value : "invalid";
}

function setObjectHeaders(res: Response, object: Record<string, any>, cacheControl: string): void {
  res.setHeader("Cache-Control", cacheControl);
  res.setHeader("CDN-Cache-Control", cacheControl);
  res.setHeader("Surrogate-Control", cacheControl);
  res.setHeader("Accept-Ranges", object.AcceptRanges || "bytes");
  res.setHeader("X-Content-Type-Options", "nosniff");
  if (object.ContentType) res.setHeader("Content-Type", object.ContentType);
  if (Number.isFinite(Number(object.ContentLength))) {
    res.setHeader("Content-Length", String(object.ContentLength));
  }
  if (object.ETag) res.setHeader("ETag", object.ETag);
  if (object.LastModified instanceof Date) {
    res.setHeader("Last-Modified", object.LastModified.toUTCString());
  }
  if (object.ContentRange) res.setHeader("Content-Range", object.ContentRange);
}

function errorStatus(error: any): number {
  return Number(error?.$metadata?.httpStatusCode || error?.statusCode || 0);
}

function isNotFound(error: any): boolean {
  const status = errorStatus(error);
  const code = String(error?.Code || error?.code || error?.name || "");
  return status === 404 || code === "NoSuchKey" || code === "NotFound";
}

async function objectBodyToBuffer(body: any, maxBytes: number): Promise<Buffer | null> {
  if (body && typeof body.transformToByteArray === "function") {
    const bytes = Buffer.from(await body.transformToByteArray());
    return bytes.length > 0 && bytes.length <= maxBytes ? bytes : null;
  }

  const chunks: Buffer[] = [];
  let totalBytes = 0;
  for await (const chunk of body || []) {
    const bytes = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    totalBytes += bytes.length;
    if (totalBytes > maxBytes) {
      if (typeof body?.destroy === "function") body.destroy();
      return null;
    }
    chunks.push(bytes);
  }
  return totalBytes > 0 ? Buffer.concat(chunks) : null;
}

/**
 * Reads a server-owned public object for another server feature (for example,
 * a generated social card). Callers must resolve the key through a public
 * allowlist before invoking this helper.
 */
export async function readPublicObjectBuffer(
  options: ReadPublicMediaBufferOptions
): Promise<Buffer | null> {
  if (!Number.isSafeInteger(options.maxBytes) || options.maxBytes <= 0) return null;

  let client = options.client;
  let bucketName = options.bucketName;
  if (!client || !bucketName) {
    let configuration;
    try {
      configuration = getServerObjectStorageConfiguration();
    } catch (error) {
      console.error("[public-media] server object storage configuration is incomplete", {
        message: error instanceof Error ? error.message : "unknown configuration error",
      });
      return null;
    }
    if (!configuration) return null;
    client = createServerObjectStorageClient(configuration);
    bucketName = configuration.bucketName;
  }

  try {
    const head = await client.send(new HeadObjectCommand({ Bucket: bucketName, Key: options.key }));
    const declaredBytes = Number(head.ContentLength);
    if (
      !Number.isSafeInteger(declaredBytes) ||
      declaredBytes <= 0 ||
      declaredBytes > options.maxBytes
    ) {
      return null;
    }

    const object = await client.send(
      new GetObjectCommand({ Bucket: bucketName, Key: options.key })
    );
    const responseBytes = Number(object.ContentLength);
    if (
      Number.isFinite(responseBytes) &&
      (responseBytes <= 0 || responseBytes > options.maxBytes)
    ) {
      return null;
    }
    return await objectBodyToBuffer(object.Body, options.maxBytes);
  } catch (error: any) {
    if (isNotFound(error)) return null;
    console.error("[public-media] object buffer read failed", {
      key: options.key,
      status: errorStatus(error) || undefined,
      code: String(error?.Code || error?.code || error?.name || "unknown"),
    });
    return null;
  }
}

export async function streamPublicObject(
  options: StreamPublicMediaOptions
): Promise<PublicMediaStreamResult> {
  const { req, res, key } = options;
  const cacheControl = options.cacheControl || DEFAULT_PUBLIC_CACHE_CONTROL;
  const range = requestRange(req);
  if (range === "invalid") {
    res.setHeader("Cache-Control", "no-store");
    res.setHeader("Accept-Ranges", "bytes");
    res.status(416).end();
    return "served";
  }

  let client = options.client;
  let bucketName = options.bucketName;
  if (!client || !bucketName) {
    let configuration;
    try {
      configuration = getServerObjectStorageConfiguration();
    } catch (error) {
      console.error("[public-media] server object storage configuration is incomplete", {
        message: error instanceof Error ? error.message : "unknown configuration error",
      });
      return "error";
    }
    if (!configuration) return "unconfigured";
    client = createServerObjectStorageClient(configuration);
    bucketName = configuration.bucketName;
  }

  const conditionalInput = {
    IfMatch: requestHeader(req, "if-match"),
    IfNoneMatch: requestHeader(req, "if-none-match"),
    IfModifiedSince: requestDate(req, "if-modified-since"),
    IfUnmodifiedSince: requestDate(req, "if-unmodified-since"),
  };

  try {
    if (req.method === "HEAD") {
      const object = await client.send(
        new HeadObjectCommand({
          Bucket: bucketName,
          Key: key,
          ...conditionalInput,
        })
      );
      setObjectHeaders(res, object, cacheControl);
      res.status(200).end();
      return "served";
    }

    const object = await client.send(
      new GetObjectCommand({
        Bucket: bucketName,
        Key: key,
        ...(range ? { Range: range } : {}),
        ...conditionalInput,
      })
    );
    setObjectHeaders(res, object, cacheControl);
    res.status(object.ContentRange ? 206 : 200);

    const body = object.Body;
    if (body && typeof body.pipe === "function") {
      body.pipe(res);
      return "served";
    }
    if (body && typeof body.transformToByteArray === "function") {
      const bytes = await body.transformToByteArray();
      res.send(Buffer.from(bytes));
      return "served";
    }

    if (!res.headersSent) res.status(502).end();
    return "error";
  } catch (error: any) {
    if (isNotFound(error)) return "not_found";
    const status = errorStatus(error);
    if (status === 304) {
      res.status(304).end();
      return "served";
    }
    if (status === 412 || status === 416) {
      res.setHeader("Cache-Control", "no-store");
      res.status(status).end();
      return "served";
    }
    console.error("[public-media] object read failed", {
      key,
      status: status || undefined,
      code: String(error?.Code || error?.code || error?.name || "unknown"),
    });
    return "error";
  }
}
