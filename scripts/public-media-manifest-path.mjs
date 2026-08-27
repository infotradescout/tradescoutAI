import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export function resolvePublicMediaManifest(filename, moduleUrl = import.meta.url) {
  const configuredDirectory = String(process.env.PUBLIC_MEDIA_MANIFEST_DIR || "").trim();
  const scriptDirectory = path.dirname(fileURLToPath(moduleUrl));
  const candidates = [
    configuredDirectory ? path.join(configuredDirectory, filename) : null,
    path.join(scriptDirectory, "manifests", filename),
    path.resolve(process.cwd(), "scripts", "data", filename),
  ].filter(Boolean);
  const resolved = candidates.find((candidate) => fs.existsSync(candidate));
  if (!resolved) {
    throw new Error(`Missing public media manifest ${filename}`);
  }
  return resolved;
}
