import { sanitizePublicProfileText } from "@shared/publicListingSafety";

export type PublicProfileServiceDetail = { name: string; description: string };

function isRecord(value: unknown): value is Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function isPublicRecord(value: Record<string, unknown>): boolean {
  return (
    value.private !== true &&
    value.internal !== true &&
    value.public !== false &&
    value.isPublic !== false &&
    (value.visibility === undefined || value.visibility === "public")
  );
}

/** Read only explicit scopes from the public services contract, aligned to existing visible names. */
export function readPublicProfileServiceDetails(
  contentBlocks: unknown,
  serviceNames: readonly string[]
): PublicProfileServiceDetail[] {
  if (!Array.isArray(contentBlocks)) return [];
  const visibleNames = new Set(serviceNames);
  const descriptions = new Map<string, string>();
  for (const block of contentBlocks) {
    if (!isRecord(block) || block.type !== "services" || !isPublicRecord(block)) continue;
    const data = block.data;
    if (!isRecord(data) || !isPublicRecord(data) || !Array.isArray(data.items)) continue;
    for (const item of data.items) {
      if (!isRecord(item) || !isPublicRecord(item)) continue;
      // Keep the existing reader's truthy-field precedence, including malformed values.
      const candidate = item.title || item.name || item.label || item.description || item.text;
      if (typeof candidate !== "string" || typeof item.description !== "string") continue;
      const name = sanitizePublicProfileText(candidate.trim(), 180);
      const description = sanitizePublicProfileText(item.description, 800);
      if (!visibleNames.has(name) || !description || descriptions.has(name)) continue;
      if (
        description.toLowerCase() === name.toLowerCase() ||
        description.toLowerCase() === sanitizePublicProfileText(candidate, 800).toLowerCase()
      )
        continue;
      descriptions.set(name, description);
    }
  }
  return serviceNames.flatMap((name) => {
    const description = descriptions.get(name);
    return description ? [{ name, description }] : [];
  });
}
