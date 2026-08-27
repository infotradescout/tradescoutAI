import {
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { createReadStream } from "fs";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { randomUUID } from "crypto";

/**
 * Cloudflare R2 storage service (S3-compatible)
 */
export function isR2StorageConfigured(): boolean {
  return Boolean(
    String(process.env.R2_ACCOUNT_ID || "").trim() &&
      String(process.env.R2_ACCESS_KEY_ID || "").trim() &&
      String(process.env.R2_SECRET_ACCESS_KEY || "").trim() &&
      String(process.env.R2_BUCKET_NAME || "").trim()
  );
}

export class R2StorageService {
  private s3Client: S3Client;
  private bucketName: string;
  private publicUrlBase: string;

  constructor() {
    const accountId = process.env.R2_ACCOUNT_ID;
    const accessKeyId = process.env.R2_ACCESS_KEY_ID;
    const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
    this.bucketName = process.env.R2_BUCKET_NAME || "";
    this.publicUrlBase = process.env.R2_PUBLIC_URL || "";

    if (!accountId || !accessKeyId || !secretAccessKey || !this.bucketName) {
      throw new Error(
        "R2 configuration missing. Set R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, and R2_BUCKET_NAME in .env"
      );
    }

    this.s3Client = new S3Client({
      region: "auto",
      endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId,
        secretAccessKey,
      },
    });
  }

  /**
   * Generate a pre-signed upload URL for direct client uploads
   */
  async getUploadURL(): Promise<{ uploadURL: string; fileId: string; publicUrl: string }> {
    const fileId = randomUUID();
    const key = `uploads/${fileId}`;

    const command = new PutObjectCommand({
      Bucket: this.bucketName,
      Key: key,
    });

    // Generate pre-signed URL valid for 5 minutes
    const uploadURL = await getSignedUrl(this.s3Client, command, { expiresIn: 300 });

    // Public URL (configure R2 custom domain or use R2.dev subdomain)
    const publicUrl = `${this.publicUrlBase}/${key}`;

    return { uploadURL, fileId, publicUrl };
  }

  /**
   * Generate a pre-signed upload URL for a specific key.
   * Note: Do not include ContentType in the signed command, so clients can send their own header safely.
   */
  async getUploadURLForKey(key: string): Promise<{ uploadURL: string }> {
    const command = new PutObjectCommand({
      Bucket: this.bucketName,
      Key: key,
    });

    const uploadURL = await getSignedUrl(this.s3Client, command, { expiresIn: 300 });
    return { uploadURL };
  }

  /**
   * Generate a pre-signed download URL for a key.
   */
  async getDownloadURL(key: string, opts?: { filename?: string }): Promise<string> {
    const filename = opts?.filename?.trim() || "";

    const command = new GetObjectCommand({
      Bucket: this.bucketName,
      Key: key,
      ...(filename
        ? {
            ResponseContentDisposition: `attachment; filename="${filename.replace(/"/g, "")}"`,
          }
        : {}),
    });

    return await getSignedUrl(this.s3Client, command, { expiresIn: 300 });
  }

  /**
   * Private uploads (account-only): store objects under a non-public prefix and return the object key.
   */
  async getPrivateUploadURL(userId: string): Promise<{ uploadURL: string; objectKey: string }> {
    const fileId = randomUUID();
    const safeUserId = String(userId || "")
      .trim()
      .replace(/[^a-zA-Z0-9_-]/g, "");
    const objectKey = `private/${safeUserId || "user"}/${fileId}`;
    const { uploadURL } = await this.getUploadURLForKey(objectKey);
    return { uploadURL, objectKey };
  }

  /**
   * Upload a public asset from the server filesystem under a stable key.
   * This is used only by the one-time JW Stone migration worker.
   */
  async uploadPublicAssetFromDisk(
    key: string,
    filePath: string,
    contentType: string,
    contentLength?: number
  ): Promise<void> {
    const normalizedKey = String(key || "").replace(/^\/+/, "");
    if (!normalizedKey.startsWith("uploads/")) {
      throw new Error("Public asset keys must stay under uploads/");
    }

    await this.s3Client.send(
      new PutObjectCommand({
        Bucket: this.bucketName,
        Key: normalizedKey,
        Body: createReadStream(filePath),
        ContentType: contentType,
        CacheControl: "public, max-age=31536000, immutable",
        ...(Number.isFinite(contentLength) ? { ContentLength: contentLength } : {}),
      })
    );
  }

  async hasObject(key: string): Promise<boolean> {
    try {
      await this.s3Client.send(
        new HeadObjectCommand({
          Bucket: this.bucketName,
          Key: String(key || "").replace(/^\/+/, ""),
        })
      );
      return true;
    } catch (error: any) {
      const statusCode = Number(error?.$metadata?.httpStatusCode || 0);
      const code = String(error?.Code || error?.name || "");
      if (statusCode === 404 || code === "NotFound" || code === "NoSuchKey") return false;
      throw error;
    }
  }

  async putTextObject(key: string, value: string): Promise<void> {
    const normalizedKey = String(key || "").replace(/^\/+/, "");
    if (!normalizedKey.startsWith("uploads/") && !normalizedKey.startsWith("private/")) {
      throw new Error("Text object keys must stay under uploads/ or private/");
    }

    await this.s3Client.send(
      new PutObjectCommand({
        Bucket: this.bucketName,
        Key: normalizedKey,
        Body: value,
        ContentType: "application/json; charset=utf-8",
        CacheControl: "no-store",
      })
    );
  }

  /**
   * Upload file directly (fallback if client upload fails)
   */
  async uploadFile(buffer: Buffer, contentType: string): Promise<string> {
    const fileId = randomUUID();
    const ext = this.getExtensionFromContentType(contentType);
    const key = `uploads/${fileId}${ext}`;

    await this.s3Client.send(
      new PutObjectCommand({
        Bucket: this.bucketName,
        Key: key,
        Body: buffer,
        ContentType: contentType,
      })
    );

    return `${this.publicUrlBase}/${key}`;
  }

  /**
   * Get file extension from content type
   */
  private getExtensionFromContentType(contentType: string): string {
    const mimeMap: Record<string, string> = {
      "image/jpeg": ".jpg",
      "image/jpg": ".jpg",
      "image/png": ".png",
      "image/gif": ".gif",
      "image/webp": ".webp",
      "video/mp4": ".mp4",
      "video/webm": ".webm",
      "video/quicktime": ".mov",
    };
    return mimeMap[contentType.toLowerCase()] || "";
  }
}

// Fallback local storage for development
export class LocalStorageService {
  private uploadDir: string;
  private publicUrlBase: string;
  private privateUploadDir: string;

  constructor() {
    this.uploadDir = process.env.UPLOAD_DIR || "./public/uploads";
    this.privateUploadDir = process.env.PRIVATE_UPLOAD_DIR || "./private/uploads";
    const configuredBase = (process.env.PUBLIC_URL_BASE || "/uploads").trim();
    this.publicUrlBase = configuredBase.replace(/\/+$/, "") || "/uploads";
  }

  async init(): Promise<void> {
    const fs = await import("fs/promises");
    await fs.mkdir(this.uploadDir, { recursive: true });
  }

  private async initPrivate(): Promise<void> {
    const fs = await import("fs/promises");
    await fs.mkdir(this.privateUploadDir, { recursive: true });
  }

  async getUploadURL(): Promise<string> {
    const fileId = randomUUID();
    // Always return same-origin upload path so production never leaks localhost origins.
    return `/api/objects/upload/${fileId}`;
  }

  async getPrivateUploadURL(userId: string): Promise<{ uploadURL: string; objectKey: string }> {
    const fileId = randomUUID();
    const safeUserId = String(userId || "")
      .trim()
      .replace(/[^a-zA-Z0-9_-]/g, "");
    if (!safeUserId) throw new Error("A valid private upload owner is required");
    return {
      uploadURL: `/api/objects/upload-private/${safeUserId}/${fileId}`,
      objectKey: `private/${safeUserId}/${fileId}`,
    };
  }

  async saveFile(fileId: string, buffer: Buffer, contentType: string): Promise<string> {
    await this.init();

    const path = await import("path");
    const fs = await import("fs/promises");

    const ext = this.getExtensionFromContentType(contentType);
    const filename = `${fileId}${ext}`;
    const filePath = path.join(this.uploadDir, filename);

    await fs.writeFile(filePath, buffer);

    return `${this.publicUrlBase}/${filename}`;
  }

  async savePrivateFile(
    userId: string,
    fileId: string,
    buffer: Buffer,
    _contentType: string
  ): Promise<string> {
    await this.initPrivate();

    const path = await import("path");
    const fs = await import("fs/promises");
    const safeUserId = String(userId || "")
      .trim()
      .replace(/[^a-zA-Z0-9_-]/g, "");
    const isSafeUploadId = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      fileId
    );
    if (!safeUserId || !isSafeUploadId) throw new Error("Invalid private upload path");

    const privateRoot = path.resolve(this.privateUploadDir);
    const ownerDir = path.resolve(privateRoot, safeUserId);
    const filePath = path.resolve(ownerDir, fileId);
    const rootPrefix = privateRoot.endsWith(path.sep) ? privateRoot : `${privateRoot}${path.sep}`;
    const ownerPrefix = ownerDir.endsWith(path.sep) ? ownerDir : `${ownerDir}${path.sep}`;
    if (!ownerDir.startsWith(rootPrefix) || !filePath.startsWith(ownerPrefix)) {
      throw new Error("Invalid private upload path");
    }

    // Keep private objects extension-less; contentType is stored in DB metadata when needed.
    await fs.mkdir(ownerDir, { recursive: true });
    await fs.writeFile(filePath, buffer);

    return `private/${safeUserId}/${fileId}`;
  }

  async getPrivateFilePathFromObjectKey(objectKey: string): Promise<string | null> {
    const path = await import("path");
    const fs = await import("fs/promises");

    if (typeof objectKey !== "string") return null;
    const trimmed = objectKey.trim();
    const parts = trimmed.split("/").filter(Boolean);
    if (parts.length !== 3 || parts[0] !== "private") return null;
    const ownerSegment = parts[1] || "";
    const fileId = parts[2] || "";
    if (!/^[a-zA-Z0-9_-]+$/.test(ownerSegment)) return null;

    // We generate IDs as UUIDs; enforce that here to prevent traversal/overwrite.
    const isSafeUploadId = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      fileId
    );
    if (!isSafeUploadId) return null;

    await this.initPrivate();
    const privateRoot = path.resolve(this.privateUploadDir);
    const ownerDir = path.resolve(privateRoot, ownerSegment);
    const filePath = path.resolve(ownerDir, fileId);
    const rootPrefix = privateRoot.endsWith(path.sep) ? privateRoot : `${privateRoot}${path.sep}`;
    const ownerPrefix = ownerDir.endsWith(path.sep) ? ownerDir : `${ownerDir}${path.sep}`;
    if (!ownerDir.startsWith(rootPrefix) || !filePath.startsWith(ownerPrefix)) return null;

    try {
      await fs.stat(filePath);
      return filePath;
    } catch {
      return null;
    }
  }

  private getExtensionFromContentType(contentType: string): string {
    const mimeMap: Record<string, string> = {
      "image/jpeg": ".jpg",
      "image/jpg": ".jpg",
      "image/png": ".png",
      "image/gif": ".gif",
      "image/webp": ".webp",
      "video/mp4": ".mp4",
      "video/webm": ".webm",
      "video/quicktime": ".mov",
    };
    return mimeMap[contentType.toLowerCase()] || "";
  }
}