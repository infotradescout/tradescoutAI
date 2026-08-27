import type { Express, Request, Response } from "express";
import express from "express";
import fs from "fs";
import path from "path";
import { streamPublicObject } from "./publicMediaStorage";
import { runtimePaths } from "./runtimePaths";

const IMAGE_EXT_RE = /\.(png|jpe?g|gif|webp|svg|bmp|avif)$/i;
const COMMON_IMAGE_EXTS = [".png", ".jpg", ".jpeg", ".webp", ".gif", ".svg", ".bmp", ".avif"];

function sanitizeUploadRelativePath(raw: string): string {
  const normalized = String(raw || "")
    .replace(/^\/+/, "")
    .replace(/\\/g, "/");
  const parts = normalized
    .split("/")
    .map((p) => p.trim())
    .filter(Boolean);
  if (parts.some((p) => p === "." || p === "..")) return "";
  return parts.join("/");
}

function buildCandidateRelativePaths(uploadPath: string): string[] {
  const clean = sanitizeUploadRelativePath(uploadPath);
  if (!clean) return [];

  const parts = clean.split("/");
  const fileName = parts[parts.length - 1] || "";
  const baseName = fileName.replace(/\.[a-z0-9]+$/i, "");

  const candidates = new Set<string>([clean]);

  if (baseName && baseName !== fileName) {
    const withNoExt = [...parts.slice(0, -1), baseName].join("/");
    candidates.add(withNoExt);
  }

  // If request has no extension, try common image variants.
  if (baseName === fileName) {
    for (const ext of COMMON_IMAGE_EXTS) {
      const withExt = [...parts.slice(0, -1), `${baseName}${ext}`].join("/");
      candidates.add(withExt);
    }
  }

  return Array.from(candidates);
}

async function streamFromR2IfPresent(
  req: Request,
  res: Response,
  uploadPath: string
): Promise<boolean> {
  const candidates = buildCandidateRelativePaths(uploadPath);
  for (const relative of candidates) {
    const key = `uploads/${relative}`;
    const result = await streamPublicObject({ req, res, key });
    if (result === "served") return true;
    if (result === "not_found") continue;
    return false;
  }
  return false;
}

export function registerUploadsFallback(app: Express) {
  const uploadsPath = runtimePaths.publicUploads;

  // Keep direct disk serving first for fast path.
  app.use(
    "/uploads",
    express.static(uploadsPath, {
      maxAge: process.env.NODE_ENV === "production" ? "1y" : "0",
    })
  );

  // Miss handler: try extension variants and server object-storage keys.
  app.get("/uploads/*", async (req, res) => {
    try {
      const requested = String(req.path || "").replace(/^\/uploads\/?/, "");
      const candidates = buildCandidateRelativePaths(requested);

      // Local disk fallback (handles extension mismatch and moved naming).
      for (const relative of candidates) {
        const fullPath = path.resolve(uploadsPath, relative);
        if (!fullPath.startsWith(path.resolve(uploadsPath) + path.sep)) continue;
        if (fs.existsSync(fullPath)) {
          return res.sendFile(fullPath);
        }
      }

      // Object-store fallback (handles cases where DB paths outlive local upload files).
      const streamed = await streamFromR2IfPresent(req, res, requested);
      if (streamed) return;

      // Avoid noisy broken-image UX for known image requests.
      if (IMAGE_EXT_RE.test(requested)) {
        return res.redirect(302, "/icon-192.png");
      }

      return res.status(404).send("Not found");
    } catch (error) {
      console.error("[uploads-fallback] Unexpected error:", error);
      return res.status(404).send("Not found");
    }
  });
}
