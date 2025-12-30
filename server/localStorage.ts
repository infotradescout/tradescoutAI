import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
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

  constructor() {
    this.uploadDir = process.env.UPLOAD_DIR || "./public/uploads";
    this.publicUrlBase = process.env.PUBLIC_URL_BASE || "http://localhost:5000/uploads";
  }

  async init(): Promise<void> {
    const fs = await import("fs/promises");
    await fs.mkdir(this.uploadDir, { recursive: true });
  }

  async getUploadURL(): Promise<string> {
    const fileId = randomUUID();
    return `http://localhost:5000/api/objects/upload/${fileId}`;
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
