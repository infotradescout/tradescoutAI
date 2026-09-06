import { randomUUID } from "node:crypto";
import { createReadStream } from "node:fs";
import { mkdir, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { DeleteObjectCommand, GetObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import { LocalStorageService, R2StorageService } from "../localStorage";
import { createR2Client, requireR2Configuration } from "../r2Client";
import { runtimePaths } from "../runtimePaths";
import { isOwnedPrivateObjectKey } from "./businessVerificationWorkflow";

const MAX_EVIDENCE_BYTES = 10 * 1024 * 1024;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ownerSegment = (userId: string) => userId.trim().replace(/[^a-zA-Z0-9_-]/g, "");

// Four segments distinguish immutable evidence from the three-segment member upload
// namespace. No member upload endpoint can issue a URL or write to this namespace.
export function isAddressVerificationEvidenceKey(key: unknown, userId: string): key is string {
  if (typeof key !== "string") return false;
  const parts = key.split("/");
  return (
    parts.length === 4 &&
    parts[0] === "private" &&
    parts[1] === "address-evidence" &&
    Boolean(ownerSegment(userId)) &&
    parts[2] === ownerSegment(userId) &&
    UUID.test(parts[3])
  );
}

async function readBounded(
  stream: AsyncIterable<Uint8Array>,
  contentType: string
): Promise<Buffer> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of stream) {
    const bytes = Buffer.from(chunk);
    size += bytes.length;
    if (size > MAX_EVIDENCE_BYTES) throw new Error("Choose a document of 10 MB or less");
    chunks.push(bytes);
  }
  const bytes = Buffer.concat(chunks);
  const matches =
    contentType === "application/pdf"
      ? bytes.subarray(0, 5).toString() === "%PDF-"
      : contentType === "image/jpeg"
        ? bytes.subarray(0, 3).equals(Buffer.from([0xff, 0xd8, 0xff]))
        : contentType === "image/png"
          ? bytes
              .subarray(0, 8)
              .equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
          : false;
  if (!size || !matches) throw new Error("Upload a readable PDF, JPG, or PNG document");
  return bytes;
}

function evidencePath(key: string, userId: string): string {
  if (!isAddressVerificationEvidenceKey(key, userId))
    throw new Error("Invalid verification evidence");
  const [, , owner, id] = key.split("/");
  return path.join(runtimePaths.privateUploads, "address-evidence", owner, id);
}

function useR2(): boolean {
  return Boolean(process.env.R2_BUCKET_NAME && process.env.R2_ACCESS_KEY_ID);
}

async function readR2(key: string, contentType: string): Promise<Buffer> {
  const configuration = requireR2Configuration();
  const result = await createR2Client(configuration).send(
    new GetObjectCommand({
      Bucket: configuration.bucketName,
      Key: key,
    })
  );
  if (!result.Body) throw new Error("Verification document not found");
  return readBounded(result.Body as AsyncIterable<Uint8Array>, contentType);
}

export async function snapshotAddressVerificationEvidence(
  sourceKey: string,
  userId: string,
  contentType: string
): Promise<string> {
  if (!isOwnedPrivateObjectKey(sourceKey, userId))
    throw new Error("Upload your own private document");
  const key = `private/address-evidence/${ownerSegment(userId)}/${randomUUID()}`;
  if (useR2()) {
    const bytes = await readR2(sourceKey, contentType);
    const configuration = requireR2Configuration();
    await createR2Client(configuration).send(
      new PutObjectCommand({
        Bucket: configuration.bucketName,
        Key: key,
        Body: bytes,
        ContentType: contentType,
      })
    );
  } else {
    const sourcePath = await new LocalStorageService().getPrivateFilePathFromObjectKey(sourceKey);
    if (!sourcePath) throw new Error("Verification document not found");
    const bytes = await readBounded(createReadStream(sourcePath), contentType);
    const destination = evidencePath(key, userId);
    await mkdir(path.dirname(destination), { recursive: true, mode: 0o700 });
    await writeFile(destination, bytes, { flag: "wx", mode: 0o600 });
  }
  return key;
}

export async function assertAddressVerificationEvidence(
  key: string,
  userId: string,
  contentType: string
): Promise<void> {
  if (!isAddressVerificationEvidenceKey(key, userId))
    throw new Error("Verification evidence not found");
  if (useR2()) await readR2(key, contentType);
  else await readBounded(createReadStream(evidencePath(key, userId)), contentType);
}

export async function getAddressVerificationEvidenceDownload(
  key: string,
  userId: string,
  contentType: string,
  filename: string
): Promise<{ url: string } | { filePath: string }> {
  await assertAddressVerificationEvidence(key, userId, contentType);
  if (useR2()) return { url: await new R2StorageService().getDownloadURL(key, { filename }) };
  return { filePath: evidencePath(key, userId) };
}

/** Call only after the lifecycle owner proves this task's copy is unreferenced. */
export async function discardAddressVerificationEvidence(key: string, userId: string): Promise<void> {
  if (!isAddressVerificationEvidenceKey(key, userId))
    throw new Error("Invalid verification evidence");
  if (useR2()) {
    const configuration = requireR2Configuration();
    await createR2Client(configuration).send(
      new DeleteObjectCommand({ Bucket: configuration.bucketName, Key: key }),
      { abortSignal: AbortSignal.timeout(5000) }
    );
    return;
  }
  try {
    await unlink(evidencePath(key, userId));
  } catch (error) {
    if ((error as NodeJS.ErrnoException)?.code !== "ENOENT") throw error;
  }
}
