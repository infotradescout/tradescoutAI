import { createHash } from "node:crypto";

/** This module accepts observations supplied by a caller. It never collects URLs. */
export const MIGRATION_MAX_PAGES_PER_CHUNK = 256;
export const MIGRATION_MAX_CHUNKS = 16;
export const MIGRATION_MAX_CHUNK_BYTES = 2 * 1024 * 1024;
export const MIGRATION_MAX_REDIRECT_HOPS = 10;
export const MIGRATION_MAX_SCHEMA_IDENTITIES = 64;
export const MIGRATION_MAX_URL_LENGTH = 2_048;

export type MigrationSide = "legacy_live" | "predicted_live";
export type MigrationUniverseSource = "sitemap_and_discovery" | "supplied" | "unknown";
export type MigrationRobotsDecision = "allowed" | "disallowed" | "unknown";

export type MigrationRedirectHop = {
  url: string;
  status: 301 | 302 | 303 | 307 | 308;
  location: string;
};

export type MigrationDocumentObservation = {
  /** null means observed absent; an unavailable page has no document at all. */
  title: string | null;
  description: string | null;
  h1: readonly string[];
  canonical: string | null;
  metaRobots: readonly string[];
  xRobotsTag: readonly string[];
  robotsTxt: MigrationRobotsDecision;
  inSitemap: boolean | null;
  schema: readonly { type: string; id: string | null; semanticSha256: string }[];
};

export type MigrationPageObservation =
  | {
      state: "unavailable";
      requestedUrl: string;
      observedAt: string;
      reason: string;
    }
  | {
      state: "observed";
      requestedUrl: string;
      observedAt: string;
      responseSha256: string;
      finalUrl: string;
      status: number;
      redirects: readonly MigrationRedirectHop[];
      document: MigrationDocumentObservation | null;
    };

export type MigrationManifestChunkInput = {
  sequence: number;
  final: boolean;
  /** A collector must disclose when it stopped before its planned URL universe. */
  truncated: boolean;
  pages: readonly MigrationPageObservation[];
};

export type MigrationPlanRef = {
  planId: string;
  revision: number;
  evidenceDigest: string;
  planHash: string;
};

export type MigrationManifestInput = {
  planRef: MigrationPlanRef;
  side: MigrationSide;
  /** Every declared origin is distinct; www, scheme, and port are not collapsed. */
  origins: readonly string[];
  expectedUrlUniverseSource: MigrationUniverseSource;
  declaredUrlCount: number | null;
  chunks: readonly MigrationManifestChunkInput[];
};

export type NormalizedMigrationPage =
  | { state: "unavailable"; requestedUrl: string; observedAt: string; reason: string }
  | {
      state: "observed";
      requestedUrl: string;
      observedAt: string;
      responseSha256: string;
      finalUrl: string;
      status: number;
      redirects: readonly MigrationRedirectHop[];
      document: MigrationDocumentObservation | null;
    };

export type MigrationCoverage = {
  expectedUrlUniverseSource: MigrationUniverseSource;
  declaredUrlCount: number | null;
  observedUrlCount: number;
  chunkCount: number;
  complete: boolean;
  truncated: boolean;
  unknownCount: number;
  duplicateCount: number;
  missingFinalChunk: boolean;
  sequenceGap: boolean;
};

export type MigrationManifest = {
  planRef: MigrationPlanRef;
  side: MigrationSide;
  origins: readonly string[];
  coverage: MigrationCoverage;
  pages: readonly NormalizedMigrationPage[];
  sha256: string;
};

export class MigrationManifestInputError extends Error {
  constructor(
    readonly code: string,
    message: string
  ) {
    super(message);
    this.name = "MigrationManifestInputError";
  }
}

export function migrationSha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function stableJson(value: unknown): string {
  const seen = new Set<object>();
  let visitedNodes = 0;
  const normalize = (item: unknown, depth = 0): unknown => {
    visitedNodes += 1;
    if (depth > 32 || visitedNodes > 100_000) {
      throw new MigrationManifestInputError(
        "INPUT_COMPLEXITY",
        "Input exceeds JSON complexity bounds"
      );
    }
    if (item === null || typeof item === "boolean") return item;
    if (typeof item === "string") {
      if (item.length > 100_000) {
        throw new MigrationManifestInputError("INPUT_COMPLEXITY", "Input string exceeds bounds");
      }
      return item;
    }
    if (typeof item === "number") {
      if (!Number.isFinite(item))
        throw new MigrationManifestInputError("INVALID_NUMBER", "Non-finite number");
      return item;
    }
    if (!item || typeof item !== "object" || seen.has(item)) {
      throw new MigrationManifestInputError("INVALID_INPUT", "Input must be finite JSON data");
    }
    seen.add(item);
    try {
      const descriptors = Object.getOwnPropertyDescriptors(item);
      if (Object.values(descriptors).some((descriptor) => !Object.hasOwn(descriptor, "value"))) {
        throw new MigrationManifestInputError("INVALID_INPUT", "Input must not contain accessors");
      }
      if (Array.isArray(item)) return item.map((entry) => normalize(entry, depth + 1));
      const prototype = Object.getPrototypeOf(item);
      if (prototype !== Object.prototype && prototype !== null) {
        throw new MigrationManifestInputError("INVALID_INPUT", "Input must be plain JSON data");
      }
      const result: Record<string, unknown> = {};
      for (const key of Object.keys(item).sort())
        result[key] = normalize((item as Record<string, unknown>)[key], depth + 1);
      return result;
    } finally {
      seen.delete(item);
    }
  };
  return JSON.stringify(normalize(value));
}

function projectedRecord(value: unknown, allowedKeys: readonly string[]): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new MigrationManifestInputError("INVALID_INPUT", "Input must be a plain record");
  }
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) {
    throw new MigrationManifestInputError("INVALID_INPUT", "Input must be plain JSON data");
  }
  const keys = Reflect.ownKeys(value);
  if (keys.length > allowedKeys.length || keys.some((key) => !allowedKeys.includes(String(key)))) {
    throw new MigrationManifestInputError("INVALID_INPUT", "Input contains unexpected fields");
  }
  const projected: Record<string, unknown> = {};
  for (const key of allowedKeys) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (descriptor && !Object.hasOwn(descriptor, "value")) {
      throw new MigrationManifestInputError("INVALID_INPUT", "Input must not contain accessors");
    }
    projected[key] = descriptor?.value;
  }
  return projected;
}

function projectedArray<T>(value: unknown, maxLength: number, project: (entry: unknown) => T): T[] {
  if (!Array.isArray(value) || value.length > maxLength) {
    throw new MigrationManifestInputError("INPUT_COMPLEXITY", "Input array exceeds bounds");
  }
  if (Reflect.ownKeys(value).length !== value.length + 1) {
    throw new MigrationManifestInputError("INVALID_INPUT", "Input array must be dense JSON data");
  }
  const projected: T[] = [];
  for (let index = 0; index < value.length; index += 1) {
    const descriptor = Object.getOwnPropertyDescriptor(value, String(index));
    if (!descriptor || !Object.hasOwn(descriptor, "value")) {
      throw new MigrationManifestInputError(
        "INVALID_INPUT",
        "Input array must not contain accessors"
      );
    }
    projected.push(project(descriptor.value));
  }
  return projected;
}

function projectedPage(value: unknown): MigrationPageObservation {
  if (!value || typeof value !== "object") {
    throw new MigrationManifestInputError("INVALID_INPUT", "Page must be a plain record");
  }
  const state = Object.getOwnPropertyDescriptor(value as object, "state")?.value;
  const keys =
    state === "unavailable"
      ? ["state", "requestedUrl", "observedAt", "reason"]
      : [
          "state",
          "requestedUrl",
          "observedAt",
          "responseSha256",
          "finalUrl",
          "status",
          "redirects",
          "document",
        ];
  const page = projectedRecord(value, keys);
  if (state === "unavailable") return page as unknown as MigrationPageObservation;
  const document = page.document;
  let projectedDocument: MigrationDocumentObservation | null;
  if (document === null) {
    projectedDocument = null;
  } else {
    const record = projectedRecord(document, [
      "title",
      "description",
      "h1",
      "canonical",
      "metaRobots",
      "xRobotsTag",
      "robotsTxt",
      "inSitemap",
      "schema",
    ]);
    projectedDocument = {
      ...record,
      h1: projectedArray(record.h1, 32, (entry) => entry),
      metaRobots: projectedArray(record.metaRobots, 32, (entry) => entry),
      xRobotsTag: projectedArray(record.xRobotsTag, 32, (entry) => entry),
      schema: projectedArray(record.schema, MIGRATION_MAX_SCHEMA_IDENTITIES, (entry) =>
        projectedRecord(entry, ["type", "id", "semanticSha256"])
      ),
    } as unknown as MigrationDocumentObservation;
  }
  return {
    ...page,
    redirects: projectedArray(page.redirects, MIGRATION_MAX_REDIRECT_HOPS, (entry) =>
      projectedRecord(entry, ["url", "status", "location"])
    ),
    document: projectedDocument,
  } as unknown as MigrationPageObservation;
}

function projectedChunk(value: unknown): MigrationManifestChunkInput {
  const chunk = projectedRecord(value, ["sequence", "final", "truncated", "pages"]);
  return {
    ...chunk,
    pages: projectedArray(chunk.pages, MIGRATION_MAX_PAGES_PER_CHUNK, projectedPage),
  } as unknown as MigrationManifestChunkInput;
}

function limitedText(value: unknown, name: string, max: number): string {
  if (typeof value !== "string" || value.length > max || /[\u0000-\u001f\u007f]/.test(value)) {
    throw new MigrationManifestInputError("INVALID_TEXT", `${name} is invalid`);
  }
  return value.normalize("NFC");
}

function normalizedDigest(value: unknown, name: string): string {
  if (typeof value !== "string" || !/^[a-f0-9]{64}$/i.test(value)) {
    throw new MigrationManifestInputError("INVALID_DIGEST", `${name} must be a SHA-256 digest`);
  }
  return value.toLowerCase();
}

/** URL identity for parity, never a network-fetch authorization. */
export function normalizeMigrationUrl(value: unknown): string {
  if (typeof value !== "string" || !value || value.length > MIGRATION_MAX_URL_LENGTH) {
    throw new MigrationManifestInputError("INVALID_URL", "URL is empty or too long");
  }
  if (/[\\\u0000-\u001f\u007f]/.test(value)) {
    throw new MigrationManifestInputError("INVALID_URL", "URL contains unsafe characters");
  }
  // URL() resolves dot segments. Refuse ambiguous raw paths before that can
  // silently merge two historical destinations into one manifest key.
  const rawPath = value.match(/^https?:\/\/[^/?#]+([^?#]*)/i)?.[1] || "";
  if (/(?:^|\/)(?:\.|%2e){1,2}(?:\/|$)/i.test(rawPath) || /%(?:2f|5c)/i.test(rawPath)) {
    throw new MigrationManifestInputError("INVALID_URL", "Ambiguous path encoding");
  }
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    throw new MigrationManifestInputError("INVALID_URL", "URL cannot be parsed");
  }
  if (
    !["http:", "https:"].includes(parsed.protocol) ||
    parsed.username ||
    parsed.password ||
    parsed.port ||
    !parsed.hostname.includes(".") ||
    parsed.hostname.endsWith(".") ||
    parsed.hostname.startsWith("[") ||
    /^\d+(?:\.\d+){3}$/.test(parsed.hostname) ||
    /\.(?:localhost|local|internal|lan|home|arpa)$/i.test(parsed.hostname) ||
    !parsed.hostname.split(".").every((label) => /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/i.test(label))
  ) {
    throw new MigrationManifestInputError("INVALID_URL", "URL must use a public DNS host");
  }
  parsed.hash = "";
  return parsed.toString();
}

function normalizeOrigin(value: unknown): string {
  const normalized = normalizeMigrationUrl(value);
  const url = new URL(normalized);
  if (url.pathname !== "/" || url.search) {
    throw new MigrationManifestInputError("INVALID_ORIGIN", "Origin must have no path or query");
  }
  return url.origin;
}

function directives(values: readonly string[], name: string): string[] {
  if (!Array.isArray(values) || values.length > 32) {
    throw new MigrationManifestInputError("INVALID_DIRECTIVES", `${name} must be bounded`);
  }
  return [...new Set(values.map((value) => limitedText(value, name, 200).trim().toLowerCase()))]
    .filter(Boolean)
    .sort();
}

function normalizeDocument(
  value: MigrationDocumentObservation | null
): MigrationDocumentObservation | null {
  if (value === null) return null;
  if (!value || typeof value !== "object") {
    throw new MigrationManifestInputError(
      "INVALID_DOCUMENT",
      "Document is required or observed absent"
    );
  }
  if (!Array.isArray(value.h1) || value.h1.length > 32) {
    throw new MigrationManifestInputError("INVALID_DOCUMENT", "H1 list must be bounded");
  }
  if (!["allowed", "disallowed", "unknown"].includes(value.robotsTxt)) {
    throw new MigrationManifestInputError("INVALID_DOCUMENT", "Invalid robots.txt observation");
  }
  if (value.inSitemap !== null && typeof value.inSitemap !== "boolean") {
    throw new MigrationManifestInputError("INVALID_DOCUMENT", "Invalid sitemap observation");
  }
  if (!Array.isArray(value.schema) || value.schema.length > MIGRATION_MAX_SCHEMA_IDENTITIES) {
    throw new MigrationManifestInputError("INVALID_DOCUMENT", "Schema list must be bounded");
  }
  return {
    title: value.title === null ? null : limitedText(value.title, "title", 512).trim(),
    description:
      value.description === null
        ? null
        : limitedText(value.description, "description", 2_048).trim(),
    h1: value.h1.map((heading) => limitedText(heading, "h1", 512).trim()),
    canonical: value.canonical === null ? null : normalizeMigrationUrl(value.canonical),
    metaRobots: directives(value.metaRobots, "meta robots"),
    xRobotsTag: directives(value.xRobotsTag, "X-Robots-Tag"),
    robotsTxt: value.robotsTxt,
    inSitemap: value.inSitemap,
    schema: value.schema
      .map((entry) => ({
        type: limitedText(entry.type, "schema type", 200).trim(),
        id: entry.id === null ? null : limitedText(entry.id, "schema id", 2_048).trim(),
        semanticSha256: normalizedDigest(entry.semanticSha256, "schema digest"),
      }))
      .sort((a, b) => stableJson(a).localeCompare(stableJson(b))),
  };
}

function normalizePage(
  page: MigrationPageObservation,
  origins: Set<string>
): NormalizedMigrationPage {
  const requestedUrl = normalizeMigrationUrl(page.requestedUrl);
  if (!origins.has(new URL(requestedUrl).origin)) {
    throw new MigrationManifestInputError(
      "UNDECLARED_ORIGIN",
      "Requested URL is outside declared origins"
    );
  }
  const observedAt = limitedText(page.observedAt, "observedAt", 50);
  if (!Number.isFinite(Date.parse(observedAt))) {
    throw new MigrationManifestInputError("INVALID_TIME", "Observation time must be parseable");
  }
  if (page.state === "unavailable") {
    return {
      state: "unavailable",
      requestedUrl,
      observedAt,
      reason: limitedText(page.reason, "reason", 200),
    };
  }
  if (
    page.state !== "observed" ||
    !Number.isInteger(page.status) ||
    page.status < 100 ||
    page.status > 599
  ) {
    throw new MigrationManifestInputError("INVALID_RESPONSE", "Response status is invalid");
  }
  if (!Array.isArray(page.redirects) || page.redirects.length > MIGRATION_MAX_REDIRECT_HOPS) {
    throw new MigrationManifestInputError("INVALID_REDIRECTS", "Redirect chain is unbounded");
  }
  const finalUrl = normalizeMigrationUrl(page.finalUrl);
  const redirects = page.redirects.map((hop) => {
    if (![301, 302, 303, 307, 308].includes(hop.status)) {
      throw new MigrationManifestInputError("INVALID_REDIRECTS", "Redirect status is invalid");
    }
    return {
      url: normalizeMigrationUrl(hop.url),
      status: hop.status,
      location: normalizeMigrationUrl(hop.location),
    };
  });
  let expectedHopUrl = requestedUrl;
  const visited = new Set<string>();
  for (const hop of redirects) {
    if (hop.url !== expectedHopUrl || visited.has(hop.url)) {
      throw new MigrationManifestInputError(
        "INVALID_REDIRECTS",
        "Redirect chain is disconnected or cyclic"
      );
    }
    visited.add(hop.url);
    expectedHopUrl = hop.location;
  }
  if (finalUrl !== expectedHopUrl || visited.has(finalUrl)) {
    throw new MigrationManifestInputError(
      "INVALID_REDIRECTS",
      "Redirect target is disconnected or cyclic"
    );
  }
  return {
    state: "observed",
    requestedUrl,
    observedAt,
    responseSha256: normalizedDigest(page.responseSha256, "response digest"),
    finalUrl,
    status: page.status,
    redirects,
    document: normalizeDocument(page.document),
  };
}

/** Builds a bounded deterministic manifest, exposing incomplete coverage instead of hiding it. */
export function buildMigrationManifest(input: MigrationManifestInput): MigrationManifest {
  if (
    !input ||
    !Array.isArray(input.origins) ||
    input.origins.length < 1 ||
    input.origins.length > 8
  ) {
    throw new MigrationManifestInputError(
      "INVALID_ORIGINS",
      "Provide one to eight declared origins"
    );
  }
  if (
    !Array.isArray(input.chunks) ||
    input.chunks.length < 1 ||
    input.chunks.length > MIGRATION_MAX_CHUNKS
  ) {
    throw new MigrationManifestInputError("CHUNK_LIMIT", "Chunk count is outside bounds");
  }
  if (!["legacy_live", "predicted_live"].includes(input.side)) {
    throw new MigrationManifestInputError("INVALID_SIDE", "Invalid manifest side");
  }
  if (!["sitemap_and_discovery", "supplied", "unknown"].includes(input.expectedUrlUniverseSource)) {
    throw new MigrationManifestInputError("INVALID_UNIVERSE", "Invalid URL universe source");
  }
  if (
    input.declaredUrlCount !== null &&
    (!Number.isSafeInteger(input.declaredUrlCount) || input.declaredUrlCount < 0)
  ) {
    throw new MigrationManifestInputError("INVALID_COUNT", "Declared URL count is invalid");
  }
  const ref = input.planRef;
  if (
    !ref ||
    typeof ref.planId !== "string" ||
    !ref.planId.trim() ||
    !Number.isSafeInteger(ref.revision) ||
    ref.revision < 1
  ) {
    throw new MigrationManifestInputError("INVALID_PLAN_REF", "Manifest plan reference is invalid");
  }
  const planRef = {
    planId: ref.planId.trim(),
    revision: ref.revision,
    evidenceDigest: normalizedDigest(ref.evidenceDigest, "evidence digest"),
    planHash: normalizedDigest(ref.planHash, "plan hash"),
  };
  const origins = [...new Set(input.origins.map(normalizeOrigin))].sort();
  if (origins.length !== input.origins.length) {
    throw new MigrationManifestInputError(
      "DUPLICATE_ORIGIN",
      "Declared origins contain duplicates"
    );
  }
  const allowed = new Set(origins);
  const sortedChunks = projectedArray(input.chunks, MIGRATION_MAX_CHUNKS, projectedChunk).sort(
    (a, b) => a.sequence - b.sequence
  );
  const pages: NormalizedMigrationPage[] = [];
  let truncated = false;
  let sequenceGap = false;
  for (const [index, chunk] of sortedChunks.entries()) {
    if (!Number.isSafeInteger(chunk.sequence) || chunk.sequence !== index) sequenceGap = true;
    if (!Array.isArray(chunk.pages) || chunk.pages.length > MIGRATION_MAX_PAGES_PER_CHUNK) {
      throw new MigrationManifestInputError("PAGE_LIMIT", "Page count exceeds the per-chunk bound");
    }
    if (typeof chunk.final !== "boolean" || typeof chunk.truncated !== "boolean") {
      throw new MigrationManifestInputError("INVALID_CHUNK", "Chunk flags are invalid");
    }
    truncated ||= chunk.truncated;
    const normalizedPages = chunk.pages.map((page) => normalizePage(page, allowed));
    if (
      Buffer.byteLength(
        stableJson({
          sequence: chunk.sequence,
          final: chunk.final,
          truncated: chunk.truncated,
          pages: normalizedPages,
        }),
        "utf8"
      ) > MIGRATION_MAX_CHUNK_BYTES
    ) {
      throw new MigrationManifestInputError("BYTE_LIMIT", "Chunk exceeds the metadata byte bound");
    }
    pages.push(...normalizedPages);
  }
  const missingFinalChunk =
    !sortedChunks.at(-1)?.final || sortedChunks.slice(0, -1).some((chunk) => chunk.final);
  pages.sort(
    (a, b) =>
      a.requestedUrl.localeCompare(b.requestedUrl) || stableJson(a).localeCompare(stableJson(b))
  );
  let duplicateCount = 0;
  for (let index = 1; index < pages.length; index += 1) {
    if (pages[index].requestedUrl === pages[index - 1].requestedUrl) duplicateCount += 1;
  }
  const unknownCount = pages.filter((page) => page.state === "unavailable").length;
  const coverage: MigrationCoverage = {
    expectedUrlUniverseSource: input.expectedUrlUniverseSource,
    declaredUrlCount: input.declaredUrlCount,
    observedUrlCount: pages.length,
    chunkCount: sortedChunks.length,
    complete:
      !truncated &&
      !sequenceGap &&
      !missingFinalChunk &&
      duplicateCount === 0 &&
      unknownCount === 0 &&
      input.expectedUrlUniverseSource !== "unknown" &&
      input.declaredUrlCount === pages.length,
    truncated,
    unknownCount,
    duplicateCount,
    missingFinalChunk,
    sequenceGap,
  };
  const body = { planRef, side: input.side, origins, coverage, pages };
  return { ...body, sha256: migrationSha256(stableJson(body)) };
}
