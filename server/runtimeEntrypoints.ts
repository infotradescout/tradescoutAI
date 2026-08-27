import fs from "node:fs";
import path from "node:path";

export function resolveRuntimeEntrypoint(
  bundledName: string,
  sourceRelativePath: string,
  cwd = process.cwd()
): string {
  const bundledPath = path.join(cwd, "dist", "release", bundledName);
  if (process.env.NODE_ENV === "production" && fs.existsSync(bundledPath)) {
    return bundledPath;
  }
  return path.join(cwd, sourceRelativePath);
}
