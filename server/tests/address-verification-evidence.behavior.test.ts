import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { GetObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { LocalStorageService } from "../localStorage";
import {
  assertAddressVerificationEvidence,
  getAddressVerificationEvidenceDownload,
  isAddressVerificationEvidenceKey,
  snapshotAddressVerificationEvidence,
} from "../services/addressVerificationEvidence";

const state = vi.hoisted(() => ({ root: "", send: vi.fn() }));
vi.mock("../runtimePaths", () => ({
  runtimePaths: {
    get privateUploads() {
      return path.join(state.root, "private");
    },
    get publicUploads() {
      return path.join(state.root, "public");
    },
  },
}));
vi.mock("../r2Client", () => ({
  requireR2Configuration: () => ({
    bucketName: "controlled-test-bucket",
    publicUrlBase: "https://storage.invalid",
  }),
  createR2Client: () => ({ send: state.send }),
}));

const owner = "member-1";
const id = "123e4567-e89b-12d3-a456-426614174000";
const sourceKey = `private/${owner}/${id}`;
const contentType = "application/pdf";
const original = Buffer.from("%PDF-1.7\nOriginal address evidence\n%%EOF");
const replacement = Buffer.from("%PDF-1.7\nDifferent address evidence\n%%EOF");

describe("address verification evidence snapshots", () => {
  beforeEach(async () => {
    state.root = await mkdtemp(path.join(os.tmpdir(), "address-evidence-test-"));
    state.send.mockReset();
    vi.stubEnv("R2_BUCKET_NAME", "");
    vi.stubEnv("R2_ACCESS_KEY_ID", "");
  });
  afterEach(async () => {
    vi.unstubAllEnvs();
    await rm(state.root, { recursive: true, force: true });
  });
  it("keeps the saved local bytes after the member replaces the original upload", async () => {
    const uploads = new LocalStorageService();
    await uploads.savePrivateFile(owner, id, original, contentType);
    const evidence = await snapshotAddressVerificationEvidence(sourceKey, owner, contentType);
    expect(isAddressVerificationEvidenceKey(evidence, owner)).toBe(true);
    expect(evidence).not.toBe(sourceKey);
    await uploads.savePrivateFile(owner, id, replacement, contentType);
    const download = await getAddressVerificationEvidenceDownload(
      evidence,
      owner,
      contentType,
      "proof.pdf"
    );
    expect("filePath" in download).toBe(true);
    expect(await readFile((download as { filePath: string }).filePath)).toEqual(original);
    const overwritePath = evidence.split("/").slice(2).join("/");
    await expect(
      uploads.savePrivateFile("address-evidence", overwritePath, replacement, contentType)
    ).rejects.toThrow("Invalid private upload path");
    await expect(
      assertAddressVerificationEvidence(evidence, owner, contentType)
    ).resolves.toBeUndefined();
  });
  it("rejects absent, empty, oversized, and mismatched uploaded files", async () => {
    const uploads = new LocalStorageService();
    await expect(
      snapshotAddressVerificationEvidence(sourceKey, owner, contentType)
    ).rejects.toThrow("not found");
    for (const bytes of [
      Buffer.alloc(0),
      Buffer.from("<html>fake document</html>"),
      Buffer.concat([original, Buffer.alloc(10 * 1024 * 1024)]),
    ]) {
      await uploads.savePrivateFile(owner, id, bytes, contentType);
      await expect(
        snapshotAddressVerificationEvidence(sourceKey, owner, contentType)
      ).rejects.toThrow();
    }
  });
  it("rejects foreign ownership, path traversal, and mutable keys as saved evidence", async () => {
    for (const key of [
      sourceKey,
      `private/address-evidence/${owner}/../../secret`,
      `private/address-evidence/member-2/${id}`,
    ]) {
      expect(isAddressVerificationEvidenceKey(key, owner)).toBe(false);
      await expect(assertAddressVerificationEvidence(key, owner, contentType)).rejects.toThrow();
    }
    await expect(
      snapshotAddressVerificationEvidence(sourceKey, "member-2", contentType)
    ).rejects.toThrow();
  });
  it("fails the evidence check if the saved local object is missing or unreadable", async () => {
    const uploads = new LocalStorageService();
    await uploads.savePrivateFile(owner, id, original, contentType);
    const evidence = await snapshotAddressVerificationEvidence(sourceKey, owner, contentType);
    const download = await getAddressVerificationEvidenceDownload(
      evidence,
      owner,
      contentType,
      "proof.pdf"
    );
    const filePath = (download as { filePath: string }).filePath;
    await writeFile(filePath, Buffer.alloc(0));
    await expect(assertAddressVerificationEvidence(evidence, owner, contentType)).rejects.toThrow();
    await rm(filePath);
    await expect(assertAddressVerificationEvidence(evidence, owner, contentType)).rejects.toThrow();
  });
  it("stores independent R2 evidence bytes with a server-generated key using a controlled SDK transport", async () => {
    vi.stubEnv("R2_BUCKET_NAME", "controlled-test-bucket");
    vi.stubEnv("R2_ACCESS_KEY_ID", "synthetic-test-value");
    const objects = new Map([[sourceKey, original]]);
    state.send.mockImplementation(async (command) => {
      const key = command.input.Key;
      if (command instanceof GetObjectCommand) {
        if (!objects.has(key)) throw new Error("NoSuchKey");
        return {
          Body: (async function* () {
            yield objects.get(key)!;
          })(),
        };
      }
      if (command instanceof PutObjectCommand) {
        objects.set(key, Buffer.from(command.input.Body as Buffer));
        return {};
      }
      throw new Error("Unexpected SDK operation");
    });
    const evidence = await snapshotAddressVerificationEvidence(sourceKey, owner, contentType);
    objects.set(sourceKey, replacement);
    expect(objects.get(evidence)).toEqual(original);
    expect(evidence).toMatch(/^private\/address-evidence\/member-1\/[0-9a-f-]{36}$/);
    await expect(
      assertAddressVerificationEvidence(evidence, owner, contentType)
    ).resolves.toBeUndefined();
    const writes = state.send.mock.calls.filter(([command]) => command instanceof PutObjectCommand);
    expect(writes).toHaveLength(1);
    expect(writes[0][0].input).toMatchObject({ Key: evidence, ContentType: contentType });
    objects.delete(evidence);
    await expect(assertAddressVerificationEvidence(evidence, owner, contentType)).rejects.toThrow(
      "NoSuchKey"
    );
  });
});
