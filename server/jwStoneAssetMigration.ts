import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";
import { isR2StorageConfigured, R2StorageService } from "./localStorage";

const JW_STONE_ASSET_ROOT = "images/businesses/jw-stone";
const JW_STONE_MIGRATION_MARKER = "private/system/jw-stone/inventory-assets-v1.json";
const JW_STONE_ASSET_DIRECTORIES = [
  "inventory-source",
  "inventory",
  "color-slivers",
  "color-collage",
  "material-covers",
] as const;
const IMAGE_EXT_RE = /\.(png|jpe?g|gif|webp|svg|bmp|avif)$/i;
const CONTENT_TYPES: Record<string, string> = {
  ".avif": "image/avif",
  ".bmp": "image/bmp",
  ".gif": "image/gif",
  ".jpeg": "image/jpeg",
  ".jpg": "image/jpeg",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".webp": "image/webp",
};

type MigrationFile = {
  absolutePath: string;
  relativePath: string;
  size: number;
};

async function collectFiles(root: string): Promise<MigrationFile[]> {
  const files: MigrationFile[] = [];

  async function visit(directory: string, relativeDirectory: string): Promise<void> {
    const entries = await fsp.readdir(directory, { withFileTypes: true });
    for (const entry of entries) {
      const relativePath = relativeDirectory
        ? path.posix.join(relativeDirectory, entry.name)
        : entry.name;
      const absolutePath = path.join(directory, entry.name);
      if (entry.isDirectory()) {
        await visit(absolutePath, relativePath);
        continue;
      }
      if (!entry.isFile() || !IMAGE_EXT_RE.test(entry.name)) continue;
      const stat = await fsp.stat(absolutePath);
      files.push({ absolutePath, relativePath, size: stat.size });
    }
  }

  for (const directory of JW_STONE_ASSET_DIRECTORIES) {
    const absoluteDirectory = path.join(root, directory);
    if (fs.existsSync(absoluteDirectory)) {
      await visit(absoluteDirectory, directory);
    }
  }

  return files.sort((a, b) => a.relativePath.localeCompare(b.relativePath));
}

function contentTypeFor(relativePath: string): string {
  return CONTENT_TYPES[path.extname(relativePath).toLowerCase()] || "application/octet-stream";
}

export async function runJwStoneAssetMigration(publicDistPath: string): Promise<void> {
  if (process.env.NODE_ENV !== "production") return;
  if (!isR2StorageConfigured()) {
    console.warn("[JW Stone assets] R2 is not configured; keeping the bundled fallback.");
    return;
  }

  const storage = new R2StorageService();
  if (await storage.hasObject(JW_STONE_MIGRATION_MARKER)) {
    console.log("[JW Stone assets] R2 migration marker found; nothing to copy.");
    return;
  }

  const root = path.join(publicDistPath, JW_STONE_ASSET_ROOT);
  if (!fs.existsSync(root)) {
    console.warn("[JW Stone assets] Bundled source tree is missing; migration deferred.");
    return;
  }

  const files = await collectFiles(root);
  if (!files.length) {
    console.warn("[JW Stone assets] No bundled inventory assets found; migration deferred.");
    return;
  }

  let nextIndex = 0;
  let totalBytes = 0;
  const worker = async (): Promise<void> => {
    while (nextIndex < files.length) {
      const file = files[nextIndex++];
      const key = `uploads/jw-stone/${file.relativePath}`;
      await storage.uploadPublicAssetFromDisk(
        key,
        file.absolutePath,
        contentTypeFor(file.relativePath),
        file.size
      );
      totalBytes += file.size;
    }
  };

  const workerCount = Math.min(4, files.length);
  await Promise.all(Array.from({ length: workerCount }, () => worker()));

  await storage.putTextObject(
    JW_STONE_MIGRATION_MARKER,
    JSON.stringify({
      version: 1,
      completedAt: new Date().toISOString(),
      fileCount: files.length,
      totalBytes,
    })
  );

  console.log(
    `[JW Stone assets] Migrated ${files.length} inventory assets (${totalBytes} bytes) to R2.`
  );
}