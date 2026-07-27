import fs from "fs";
import path from "path";

const STALE_ENTRY_STYLESHEET = /^\/assets\/index-[A-Za-z0-9_-]+\.css$/;
const CURRENT_ENTRY_STYLESHEET = /href=["']\/assets\/(index-[A-Za-z0-9_-]+\.css)["']/i;
const DUPLICATED_VITE_ASSET_PATH = /^\/assets\/assets\/([A-Za-z0-9][A-Za-z0-9._-]*)$/;
const HASHED_VITE_ASSET_FILENAME =
  /^[A-Za-z0-9][A-Za-z0-9._-]*-[A-Za-z0-9_-]{6,}\.(?:js|css|map)$/;

/**
 * Vite's preload dependency map stores root-relative build files as
 * "assets/<file>". Browsers run Vite's helper, which adds the leading slash.
 * Static JavaScript crawlers can instead resolve the raw string relative to
 * the entry chunk and request "/assets/assets/<file>".
 *
 * Canonicalize only a single, hashed build artifact that actually exists.
 * Unknown or nested paths still fail closed through the normal asset 404.
 */
export function resolveCanonicalDuplicatedAssetPath(
  publicDistPath: string,
  requestPath: string
): string | null {
  const filename = DUPLICATED_VITE_ASSET_PATH.exec(requestPath)?.[1];
  if (!filename || !HASHED_VITE_ASSET_FILENAME.test(filename)) return null;

  const assetPath = path.join(publicDistPath, "assets", filename);
  try {
    if (!fs.statSync(assetPath).isFile()) return null;
  } catch {
    return null;
  }

  return `/assets/${filename}`;
}

/**
 * Resolve the current built entry stylesheet for a missing previous-deploy
 * entry stylesheet. Other missing assets fail closed because substituting an
 * arbitrary JS chunk can execute an incompatible module graph.
 */
export function resolveCurrentEntryStylesheet(
  publicDistPath: string,
  requestPath: string
): string | null {
  if (!STALE_ENTRY_STYLESHEET.test(requestPath)) return null;

  const indexPath = path.join(publicDistPath, "index.html");
  let template = "";
  try {
    template = fs.readFileSync(indexPath, "utf8");
  } catch {
    return null;
  }

  const filename = CURRENT_ENTRY_STYLESHEET.exec(template)?.[1];
  if (!filename) return null;

  const stylesheetPath = path.join(publicDistPath, "assets", filename);
  return fs.existsSync(stylesheetPath) ? stylesheetPath : null;
}
