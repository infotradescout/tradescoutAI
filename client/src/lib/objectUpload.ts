import { apiRequest } from "@/lib/queryClient";

export interface UploadResult {
  publicUrl: string;
  rawUploadUrl: string;
}

// Uploads a single File or data URL to object storage and returns a stable, public-facing URL.
export async function uploadObject(file: File | string): Promise<UploadResult> {
  // Get upload URL from backend
  const { uploadURL } = await apiRequest("POST", "/api/objects/upload");

  let body: BodyInit;
  let contentType: string;

  if (typeof file === "string") {
    // Data URL or remote URL – best-effort fetch then re-upload
    const response = await fetch(file);
    const blob = await response.blob();
    body = blob;
    contentType = blob.type || "application/octet-stream";
  } else {
    body = file;
    contentType = file.type || "application/octet-stream";
  }

  await fetch(uploadURL, {
    method: "PUT",
    body,
    headers: {
      "Content-Type": contentType,
    },
  });

  const raw = typeof uploadURL === "string" ? uploadURL : String(uploadURL);
  const publicUrl = raw.split("?")[0];

  return { publicUrl, rawUploadUrl: raw };
}
