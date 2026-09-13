import { createHash, createSign, randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { JW_STONE_PRICING_DRIVE_FOLDER_ID } from "@shared/jwStoneMemberPricing";
import { createServerObjectStorageClient, getServerObjectStorageConfiguration } from "../serverObjectStorage";

const API = "https://www.googleapis.com/drive/v3";
export const receivingHash = (bytes: Buffer | string) => createHash("sha256").update(bytes).digest("hex");
let cachedToken: { token: string; expiresAt: number } | undefined;
export function receivingConfigured(): boolean {
  return process.env.JW_STONE_RECEIVING_ENABLED === "true" && Boolean(process.env.JW_STONE_RECEIVING_DRIVE_FOLDER_ID?.trim());
}
async function accessToken(): Promise<string> {
  if (cachedToken && cachedToken.expiresAt > Date.now()) return cachedToken.token;
  let credentials: { client_email?: string; private_key?: string } | undefined;
  const encoded = process.env.JW_STONE_DRIVE_SERVICE_ACCOUNT_JSON_BASE64;
  if (encoded) credentials = JSON.parse(Buffer.from(encoded, "base64").toString("utf8"));
  else if (process.env.GOOGLE_APPLICATION_CREDENTIALS) credentials = JSON.parse(await readFile(process.env.GOOGLE_APPLICATION_CREDENTIALS, "utf8"));
  let body: URLSearchParams;
  if (credentials?.client_email && credentials.private_key) {
    const iat = Math.floor(Date.now() / 1000);
    const unsigned = `${Buffer.from(JSON.stringify({ alg: "RS256", typ: "JWT" })).toString("base64url")}.${Buffer.from(JSON.stringify({ iss: credentials.client_email, scope: "https://www.googleapis.com/auth/drive", aud: "https://oauth2.googleapis.com/token", iat, exp: iat + 3600 })).toString("base64url")}`;
    const signer = createSign("RSA-SHA256"); signer.update(unsigned); signer.end();
    body = new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion: `${unsigned}.${signer.sign(credentials.private_key).toString("base64url")}` });
  } else {
    const { GOOGLE_CLIENT_ID: id, GOOGLE_CLIENT_SECRET: secret, JW_STONE_DRIVE_REFRESH_TOKEN: refresh } = process.env;
    if (!id || !secret || !refresh) throw new Error("Receiving Drive authorization is not configured");
    body = new URLSearchParams({ client_id: id, client_secret: secret, refresh_token: refresh, grant_type: "refresh_token" });
  }
  const response = await fetch("https://oauth2.googleapis.com/token", { method: "POST", body, signal: AbortSignal.timeout(10000) });
  if (!response.ok) throw new Error(`Receiving Drive authorization failed (${response.status})`);
  const data = await response.json() as { access_token?: string; expires_in?: number };
  if (!data.access_token) throw new Error("Receiving Drive token is missing");
  cachedToken = { token: data.access_token, expiresAt: Date.now() + Math.max(1, Math.min(Number(data.expires_in) || 3600, 3600) - 60) * 1000 };
  return data.access_token;
}
export async function createReceivingMediaSession() {
  if (!receivingConfigured()) throw new Error("Employee receiving is not enabled");
  const folderId = process.env.JW_STONE_RECEIVING_DRIVE_FOLDER_ID!.trim();
  const rootId = process.env.JW_STONE_DRIVE_FOLDER_ID?.trim() || JW_STONE_PRICING_DRIVE_FOLDER_ID;
  const configuration = getServerObjectStorageConfiguration();
  if (!configuration) throw new Error("Receiving photo storage is not configured");
  const storage = createServerObjectStorageClient(configuration);
  const token = await accessToken();
  const request = (url: string, init: RequestInit = {}) => fetch(url, { ...init, headers: { ...init.headers, Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(30000) });
  const metadata = await request(`${API}/files/${encodeURIComponent(folderId)}?supportsAllDrives=true&fields=id,mimeType,trashed,parents,capabilities(canAddChildren)`);
  if (!metadata.ok) throw new Error("Receiving source folder is unavailable");
  const folder = await metadata.json() as { mimeType?: string; trashed?: boolean; parents?: string[]; capabilities?: { canAddChildren?: boolean } };
  if (folder.mimeType !== "application/vnd.google-apps.folder" || folder.trashed || !folder.parents?.includes(rootId) || !folder.capabilities?.canAddChildren) throw new Error("Receiving requires a writable subfolder of the JW Stone source folder");
  // Receipt manifests include costs. Never put them in a publicly shared folder.
  let pageToken = "";
  do {
    const response = await request(`${API}/files/${encodeURIComponent(folderId)}/permissions?supportsAllDrives=true&fields=nextPageToken,permissions(type)&pageSize=100${pageToken ? `&pageToken=${encodeURIComponent(pageToken)}` : ""}`);
    if (!response.ok) throw new Error("Receiving source folder privacy could not be verified");
    const permissions = await response.json() as { permissions?: { type?: string }[]; nextPageToken?: string };
    if (!Array.isArray(permissions.permissions) || permissions.permissions.some(p => p.type === "anyone" || p.type === "domain")) throw new Error("Receiving source folder must be private to JW Stone staff");
    pageToken = permissions.nextPageToken || "";
  } while (pageToken);
  return {
    folderId,
    async allocateIds(count: number): Promise<string[]> {
      const response = await request(`${API}/files/generateIds?count=${count}&space=drive&type=files`);
      if (!response.ok) throw new Error("Receiving source identifiers could not be allocated");
      const data = await response.json() as { ids?: string[] };
      if (!data.ids || data.ids.length !== count || data.ids.some(id => !/^[a-zA-Z0-9_-]+$/.test(id))) throw new Error("Invalid receiving source identifiers");
      return data.ids;
    },
    async putFile(id: string, name: string, mimeType: string, bytes: Buffer, receiptId: string): Promise<void> {
      const hash = receivingHash(bytes);
      const existing = await request(`${API}/files/${encodeURIComponent(id)}?supportsAllDrives=true&fields=id,trashed,parents,appProperties`);
      if (existing.ok) {
        const item = await existing.json() as { trashed?: boolean; parents?: string[]; appProperties?: Record<string, string> };
        if (item.trashed || !item.parents?.includes(folderId) || item.appProperties?.receiptId !== receiptId || item.appProperties?.sha256 !== hash) throw new Error("Receiving source file changed; a manager must resolve the conflict");
        return;
      }
      if (existing.status !== 404) throw new Error("Receiving source file could not be checked");
      const boundary = `jw-${randomUUID()}`;
      const metadata = { id, name, mimeType, parents: [folderId], appProperties: { receiptId, sha256: hash } };
      const body = Buffer.concat([Buffer.from(`--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(metadata)}\r\n--${boundary}\r\nContent-Type: ${mimeType}\r\n\r\n`), bytes, Buffer.from(`\r\n--${boundary}--\r\n`)]);
      const response = await request(`https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&supportsAllDrives=true&fields=id`, { method: "POST", headers: { "Content-Type": `multipart/related; boundary=${boundary}` }, body: body as unknown as BodyInit });
      if (!response.ok) throw new Error(`Receiving source upload failed (${response.status}); retry the same arrival`);
    },
    async putPublicPhoto(receiptId: string, index: number, bytes: Buffer): Promise<string> {
      const path = `images/businesses/jw-stone/receiving/${receiptId}/${index + 1}-${receivingHash(bytes).slice(0, 20)}.jpg`;
      await storage.send(new PutObjectCommand({ Bucket: configuration.bucketName, Key: `public-media/${path}`, Body: bytes, ContentType: "image/jpeg", CacheControl: "public, max-age=31536000, immutable" }));
      return `/${path}`;
    },
  };
}
