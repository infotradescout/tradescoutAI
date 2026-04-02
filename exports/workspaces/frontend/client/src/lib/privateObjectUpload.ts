import { buildApiUrl } from "@/lib/apiBaseUrl";
import { apiRequest } from "@/lib/queryClient";

export interface PrivateUploadResult {
  objectKey: string;
  rawUploadUrl: string;
}

// Uploads a single File or data URL to private object storage and returns an opaque objectKey.
// The objectKey is not a public URL and must be downloaded via an authenticated server route.
export async function uploadPrivateObject(file: File | string): Promise<PrivateUploadResult> {
  const uploadMeta = await apiRequest("POST", "/api/objects/upload-private");
  const uploadURL = String(uploadMeta?.uploadURL || "");
  const hintedObjectKey = typeof uploadMeta?.objectKey === "string" ? uploadMeta.objectKey : "";

  if (!uploadURL) {
    throw new Error("Upload URL unavailable. Please try again.");
  }

  let body: BodyInit;
  let contentType: string;

  if (typeof file === "string") {
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
    console.error("Private object upload failed", {
      status: putResponse.status,
      statusText: putResponse.statusText,
    });
    throw new Error("Upload failed. Please try again.");
  }

  let responseObjectKey = "";
  try {
    responseObjectKey = (await putResponse.text()).trim();
  } catch {
    responseObjectKey = "";
  }

  const objectKey = hintedObjectKey || responseObjectKey;
  if (!objectKey) {
    throw new Error("Upload completed but objectKey was missing.");
  }

  return { objectKey, rawUploadUrl: uploadURL };
}
