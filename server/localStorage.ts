import { GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { randomUUID } from "crypto";

/**
 * Cloudflare R2 storage service (S3-compatible)
 */
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
   * Upload file directly (fallback if client upload fails)
   */
  async uploadFile(buffer: Buffer, contentType: string): Promise<string> {
    const fileId = randomUUID();
    const ext = this.getExtensionFromContentType(contentType);
    const key = `uploads/${fileId}${ext}`;

    return this.uploadPublicFileForKey(key, buffer, contentType);
  }

  /**
   * Store a first-party public asset under the same uploads namespace used by
   * browser uploads. Intended for deterministic, source-backed seed media.
   */
  async uploadPublicFileForKey(key: string, buffer: Buffer, contentType: string): Promise<string> {
    const normalizedKey = key.replace(/^\/+/, "");
    if (
      !normalizedKey.startsWith("uploads/") ||
      normalizedKey.split("/").some((part) => part === "." || part === "..")
    ) {
      throw new Error("Public upload key must stay under uploads/");
    }

    await this.s3Client.send(
      new PutObjectCommand({
        Bucket: this.bucketName,
        Key: normalizedKey,
        Body: buffer,
        ContentType: contentType,
        CacheControl: "public, max-age=31536000, immutable",
      })
    );

    return `${this.publicUrlBase}/${normalizedKey}`;
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

  async getPrivateUploadURL(): Promise<{ uploadURL: string; objectKey: string }> {
    const fileId = randomUUID();
    return {
      uploadURL: `/api/objects/upload-private/${fileId}`,
      objectKey: `private/${fileId}`,
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

  async savePrivateFile(fileId: string, buffer: Buffer, _contentType: string): Promise<string> {
    await this.initPrivate();

    const path = await import("path");
    const fs = await import("fs/promises");

    // Keep private objects extension-less; contentType is stored in DB metadata when needed.
    const filePath = path.join(this.privateUploadDir, fileId);
    await fs.writeFile(filePath, buffer);

    return `private/${fileId}`;
  }

  async getPrivateFilePathFromObjectKey(objectKey: string): Promise<string | null> {
    const path = await import("path");
    const fs = await import("fs/promises");

    if (typeof objectKey !== "string") return null;
    const trimmed = objectKey.trim();
    if (!trimmed.startsWith("private/")) return null;

    // Allow either private/<uuid> or private/<user>/<uuid> by taking the last segment.
    const parts = trimmed.split("/").filter(Boolean);
    const fileId = parts[parts.length - 1] || "";

    // We generate IDs as UUIDs; enforce that here to prevent traversal/overwrite.
    const isSafeUploadId = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      fileId
    );
    if (!isSafeUploadId) return null;

    await this.initPrivate();
    const filePath = path.join(this.privateUploadDir, fileId);

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
