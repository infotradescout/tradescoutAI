import { createHash } from "node:crypto";
import { buildMealScoutSharingLink, ecosystemPublicLinkKey, projectApprovedEcosystemPublicLink,
  readProfileEcosystemPublicLinks, type EcosystemPublicLinkPointer } from "../../shared/ecosystemPublicLink";

export type PublicLinkProfile = { id: string; slug: string; businessId: string | null; publiclyReleased: boolean;
  updatedAt: unknown; contentBlocks: unknown };
export type ReceiverDependencies = {
  getPublicProfile: (slug: string) => Promise<PublicLinkProfile | null | undefined>;
  readEnvelope: (pointer: EcosystemPublicLinkPointer, signal: AbortSignal) => Promise<unknown>;
  enabled: () => boolean;
  now?: () => number;
  monotonicNow?: () => number;
  timeoutMs?: number;
};
const unavailable = Object.freeze({ state: "unavailable" as const, reference: null });
function binding(profile: PublicLinkProfile) {
  return createHash("sha256").update(JSON.stringify([profile.id, profile.slug, profile.businessId,
    profile.publiclyReleased, profile.updatedAt, readProfileEcosystemPublicLinks(profile.contentBlocks)])).digest("hex");
}
export function createEcosystemPublicLinkReceiver(deps: ReceiverDependencies) {
  return async (slug: string, pointer: EcosystemPublicLinkPointer) => {
    if (!deps.enabled()) return unavailable;
    const bound = Object.freeze({ app: pointer.app, tenantId: pointer.tenantId, sourceId: pointer.sourceId });
    const now = deps.now ?? Date.now, monotonic = deps.monotonicNow ?? (() => performance.now());
    const budget = deps.timeoutMs ?? 750;
    if (!Number.isInteger(budget) || budget < 10 || budget > 750) return unavailable;
    const startWall = now(), startMono = monotonic();
    if (!Number.isFinite(startWall) || !Number.isFinite(startMono)) return unavailable;
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout> | undefined;
    const expired = () => {
      const wall = now(), elapsed = monotonic() - startMono;
      return controller.signal.aborted || !Number.isFinite(wall) || wall < startWall || wall - startWall >= budget
        || !Number.isFinite(elapsed) || elapsed < 0 || elapsed >= budget;
    };
    try {
      return await Promise.race([
        new Promise<typeof unavailable>(resolve => { timer = setTimeout(() => { controller.abort(); resolve(unavailable); }, budget); }),
        (async () => {
          const first = await deps.getPublicProfile(slug);
          if (expired() || !first || first.slug !== slug
            || !readProfileEcosystemPublicLinks(first.contentBlocks).some(p => ecosystemPublicLinkKey(p) === ecosystemPublicLinkKey(bound))) return unavailable;
          const identity = binding(first);
          const envelope = await deps.readEnvelope(bound, controller.signal);
          if (expired()) return unavailable;
          const last = await deps.getPublicProfile(slug);
          if (expired() || !last || last.slug !== slug || binding(last) !== identity) return unavailable;
          const reference = projectApprovedEcosystemPublicLink(envelope, bound, Math.max(now(), startWall + monotonic() - startMono));
          if (expired() || !reference || Date.parse(reference.expiresAt) <= now()) return unavailable;
          return Object.freeze({ state: "available" as const, reference });
        })(),
      ]);
    } catch { return unavailable; }
    finally { clearTimeout(timer); controller.abort(); }
  };
}

/** Fixed publisher origin; full body obeys caller deadline and 4KB bound. */
export async function readMealScoutPublicLinkEnvelope(pointer: EcosystemPublicLinkPointer, signal: AbortSignal,
  request: typeof fetch = fetch): Promise<unknown> {
  if (signal.aborted) return null;
  const response = await request(buildMealScoutSharingLink(pointer), {
    method: "GET", signal, redirect: "error", credentials: "omit", cache: "no-store",
    headers: { Accept: "application/json" },
  });
  if (!response.ok || !/^application\/json(?:;|$)/i.test(response.headers.get("content-type") ?? "")
    || Number(response.headers.get("content-length") ?? 0) > 4096) { await response.body?.cancel(); return null; }
  const reader = response.body?.getReader();
  if (!reader) return null;
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const part = await reader.read();
      if (part.done) break;
      size += part.value.byteLength;
      if (signal.aborted || size > 4096 || chunks.length >= 256) { await reader.cancel(); return null; }
      chunks.push(part.value);
    }
    if (signal.aborted) return null;
    const bytes = new Uint8Array(size);
    let offset = 0;
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
    return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
  } finally { reader.releaseLock(); }
}
