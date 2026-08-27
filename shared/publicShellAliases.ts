import manifest from "../scripts/data/public-shell-local-dedupe-manifest.json";

export const PUBLIC_SHELL_ALIASES = Object.freeze(
  manifest.entries
    .filter((entry) => entry.kind === "alias" && "canonicalPath" in entry)
    .map((entry) => Object.freeze([entry.publicPath, entry.canonicalPath as string] as const))
);
const ALIASES: ReadonlyMap<string, string> = new Map(PUBLIC_SHELL_ALIASES);

export function resolvePublicShellAlias(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const pathname = value.trim().split(/[?#]/, 1)[0] || "";
  if (!pathname.startsWith("/") || /[\\\0%]/.test(pathname) || pathname.includes("..")) return null;
  return ALIASES.get(pathname) ?? null;
}
