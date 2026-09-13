// Actual receiving media module with an in-memory Drive boundary. No external writes.
import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import * as crypto from "node:crypto";
import { stripTypeScriptTypes } from "node:module";
import { SourceTextModule, SyntheticModule, createContext } from "node:vm";

const source = stripTypeScriptTypes(await readFile(new URL("../server/services/jwStoneReceivingMedia.ts", import.meta.url), "utf8"));
const digest = (algorithm, bytes) => crypto.createHash(algorithm).update(bytes).digest("hex");

async function existingFile({ original, actual = original, mimeType, omitChecksum = false }) {
  const requests = [];
  const context = createContext({
    Buffer, URLSearchParams, AbortSignal,
    process: { env: {
      JW_STONE_RECEIVING_ENABLED: "true", JW_STONE_RECEIVING_DRIVE_FOLDER_ID: "test-private",
      JW_STONE_DRIVE_FOLDER_ID: "test-root", GOOGLE_CLIENT_ID: "test-only",
      GOOGLE_CLIENT_SECRET: "test-only", JW_STONE_DRIVE_REFRESH_TOKEN: "test-only",
    } },
    fetch: async (url, init = {}) => {
      requests.push({ url, method: init.method || "GET" });
      let data;
      if (url === "https://oauth2.googleapis.com/token") data = { access_token: "test-only", expires_in: 3600 };
      else if (url.includes("/permissions?")) data = { permissions: [{ type: "user" }] };
      else if (url.includes("/files/test-private?")) data = { mimeType: "application/vnd.google-apps.folder", parents: ["test-root"], capabilities: { canAddChildren: true } };
      else if (url.includes("/files/test-file?")) {
        const fields = new Set(new URL(url).searchParams.get("fields").split(","));
        // A Drive edit changes the blob checksum but preserves app properties.
        const metadata = { id: "test-file", mimeType, parents: ["test-private"],
          appProperties: { receiptId: "test-receipt", sha256: digest("sha256", original) },
          ...(!omitChecksum ? { md5Checksum: digest("md5", actual) } : {}),
        };
        data = Object.fromEntries(Object.entries(metadata).filter(([key]) => fields.has(key)));
      } else throw new Error(`Unexpected external operation: ${init.method || "GET"} ${url}`);
      return { ok: true, status: 200, json: async () => data };
    },
  });
  const dependencies = {
    "node:crypto": crypto,
    "node:fs/promises": { readFile: async () => { throw new Error("Unexpected credentials file read"); } },
    "@aws-sdk/client-s3": { PutObjectCommand: class {} },
    "@shared/jwStoneMemberPricing": { JW_STONE_PRICING_DRIVE_FOLDER_ID: "test-root" },
    "../serverObjectStorage": {
      getServerObjectStorageConfiguration: () => ({ bucketName: "test-only" }),
      createServerObjectStorageClient: () => ({ send: async () => { throw new Error("Unexpected public storage write"); } }),
    },
  };
  const module = new SourceTextModule(source, { context });
  await module.link(specifier => {
    const exports = dependencies[specifier];
    assert.ok(exports, `Unexpected import ${specifier}`);
    return new SyntheticModule(Object.keys(exports), function () {
      for (const [key, value] of Object.entries(exports)) this.setExport(key, value);
    }, { context });
  });
  await module.evaluate();
  return { media: await module.namespace.createReceivingMediaSession(), requests };
}

for (const [label, mimeType, original, changed] of [
  ["private receipt", "application/json", '{"sellPriceCents":1250}', '{"sellPriceCents":9900}'],
  ["photo", "image/jpeg", "original photo bytes", "replacement photo bytes"],
]) {
  test(`unchanged ${label} can be reused after an upload response is lost`, async () => {
    const bytes = Buffer.from(original);
    const { media, requests } = await existingFile({ original: bytes, mimeType });
    await media.putFile("test-file", "test-file", mimeType, bytes, "test-receipt");
    assert.equal(requests.filter(request => request.method !== "GET" && !request.url.includes("oauth2")).length, 0);
  });
  test(`Drive-edited ${label} cannot be reused with stale app properties`, async () => {
    const bytes = Buffer.from(original);
    const { media } = await existingFile({ original: bytes, actual: Buffer.from(changed), mimeType });
    await assert.rejects(media.putFile("test-file", "test-file", mimeType, bytes, "test-receipt"), /source file changed/);
  });
}
test("missing authoritative blob checksum cannot acknowledge an existing receipt", async () => {
  const bytes = Buffer.from('{"sellPriceCents":1250}');
  const { media } = await existingFile({ original: bytes, mimeType: "application/json", omitChecksum: true });
  await assert.rejects(media.putFile("test-file", "test-file", "application/json", bytes, "test-receipt"), /source file changed/);
});
