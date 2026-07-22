import fs from "fs";
import path from "path";

const STALE_ENTRY_STYLESHEET = /^\/assets\/index-[A-Za-z0-9_-]+\.css$/;
const CURRENT_ENTRY_STYLESHEET = /href=["']\/assets\/(index-[A-Za-z0-9_-]+\.css)["']/i;

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
