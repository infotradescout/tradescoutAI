import { buildApiUrl } from "@/lib/apiBaseUrl";
import { apiRequest } from "@/lib/queryClient";

export interface UploadResult {
  publicUrl: string;
  rawUploadUrl: string;
}

/**
 * Keep profile media on the same-origin /uploads route even when R2 returns
 * its public CDN URL. This makes stored profile data portable across domains
 * while preserving the exact object created by the normal upload pipeline.
 */
export function normalizeUploadedObjectPublicUrl(value: string): string {
  const candidate = value.trim();
  if (!candidate) return "";
  try {
    const url = new URL(candidate, "https://www.thetradescout.com");
    if (url.pathname.startsWith("/uploads/")) {
      return `${url.pathname}${url.search}`;
    }
  } catch {
    return candidate;
  }
  return candidate;
}

// Uploads a single File or data URL to object storage and returns a stable, public-facing URL.
export async function uploadObject(file: File | string): Promise<UploadResult> {
  const uploadMeta = await apiRequest("POST", "/api/objects/upload");
  const uploadURL = String(uploadMeta?.uploadURL || "");
  const hintedPublicUrl = typeof uploadMeta?.publicUrl === "string" ? uploadMeta.publicUrl : "";

  if (!uploadURL) {
    throw new Error("Upload URL unavailable. Please try again.");
  }

  let body: BodyInit;
  let contentType: string;

  if (typeof file === "string") {
    // Data URL or remote URL: fetch and re-upload.
    const response = await fetch(file);
    const blob = await response.blob();
    body = blob;
    contentType = blob.type || "application/octet-stream";
  } else {
    body = file;
    contentType = file.type || "application/octet-stream";
  }

  const putResponse = await fetch(buildApiUrl(uploadURL), {
    method: "PUT",
    body,
    headers: {
      "Content-Type": contentType,
    },
  });

  if (!putResponse.ok) {
    console.error("Object upload failed", {
      status: putResponse.status,
      statusText: putResponse.statusText,
    });
    throw new Error("Upload failed. Please try again.");
  }

  let responsePublicUrl = "";
  try {
    responsePublicUrl = (await putResponse.text()).trim();
  } catch {
    responsePublicUrl = "";
  }

  const raw = uploadURL;
  const fallbackPublicUrl = raw.split("?")[0];
  const publicUrl = hintedPublicUrl || responsePublicUrl || fallbackPublicUrl;

  return { publicUrl, rawUploadUrl: raw };
}
