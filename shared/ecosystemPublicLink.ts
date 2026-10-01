/** Qualified public navigation identity; never an account/ownership mapping. */
export type EcosystemPublicLinkPointer = Readonly<{
  app: "mealscout";
  tenantId: string;
  sourceId: string;
}>;
export type ApprovedEcosystemPublicLink = Readonly<{
  reference: string;
  app: "mealscout";
  publicLabel: string;
  canonicalUrl: string;
  sourceRevision: string;
  publicationRevision: string;
  expiresAt: string;
  access: "public_link_only";
}>;

export const MEALSCOUT_PUBLIC_LINK_ORIGIN = "https://mealscout.onrender.com";
const blockKind = "ecosystemPublicLinks";
const isRecord = (v: unknown): v is Record<string, unknown> => Boolean(v && typeof v === "object" && !Array.isArray(v));
const exactKeys = (v: Record<string, unknown>, keys: readonly string[]) =>
  Object.keys(v).length === keys.length && keys.every(k => Object.hasOwn(v, k));

export function readEcosystemPublicLinkPointer(value: unknown): EcosystemPublicLinkPointer | null {
  if (!isRecord(value) || !exactKeys(value, ["app", "tenantId", "sourceId"]) || value.app !== "mealscout"
    || typeof value.tenantId !== "string" || !/^[a-f0-9]{32}$/.test(value.tenantId)
    || typeof value.sourceId !== "string" || !/^[a-zA-Z0-9_-]{1,80}$/.test(value.sourceId)) return null;
  return Object.freeze({ app: "mealscout", tenantId: value.tenantId, sourceId: value.sourceId });
}
export function ecosystemPublicLinkKey(p: EcosystemPublicLinkPointer): string {
  return `${p.app}:${p.tenantId}:${p.sourceId}`;
}
export function buildMealScoutSharingLink(p: EcosystemPublicLinkPointer): string {
  return `${MEALSCOUT_PUBLIC_LINK_ORIGIN}/api/ecosystem/public-links/${p.tenantId}/${p.sourceId}`;
}
export function parseMealScoutSharingLink(value: unknown): EcosystemPublicLinkPointer | null {
  if (typeof value !== "string" || value.length > 300) return null;
  try {
    const u = new URL(value);
    if (u.origin !== MEALSCOUT_PUBLIC_LINK_ORIGIN || u.href !== value || u.username || u.password || u.search || u.hash) return null;
    const match = u.pathname.match(/^\/api\/ecosystem\/public-links\/([a-f0-9]{32})\/([a-zA-Z0-9_-]{1,80})$/);
    return match ? readEcosystemPublicLinkPointer({ app: "mealscout", tenantId: match[1], sourceId: match[2] }) : null;
  } catch { return null; }
}
export function readProfileEcosystemPublicLinks(blocks: unknown): EcosystemPublicLinkPointer[] {
  if (!Array.isArray(blocks) || blocks.length > 200) return [];
  const matches = blocks.filter(b => isRecord(b) && b.type === "custom" && isRecord(b.data) && b.data.kind === blockKind);
  if (matches.length !== 1) return [];
  const data = matches[0].data;
  if (!exactKeys(data, ["kind", "references"]) || !Array.isArray(data.references) || data.references.length > 3) return [];
  const refs = data.references.map(readEcosystemPublicLinkPointer);
  if (refs.some(p => !p)) return [];
  const valid = refs as EcosystemPublicLinkPointer[];
  return new Set(valid.map(ecosystemPublicLinkKey)).size === valid.length ? valid : [];
}
export function upsertProfileEcosystemPublicLinks(blocks: unknown[], refs: EcosystemPublicLinkPointer[]): unknown[] {
  if (refs.length > 3 || refs.some(p => !readEcosystemPublicLinkPointer(p))
    || new Set(refs.map(ecosystemPublicLinkKey)).size !== refs.length) throw new Error("Choose up to three different public links.");
  const others = blocks.filter(b => !(isRecord(b) && b.type === "custom" && isRecord(b.data) && b.data.kind === blockKind));
  if (others.length + (refs.length ? 1 : 0) > 200) throw new Error("This profile already has the maximum number of content blocks.");
  return refs.length ? [...others, { type: "custom", data: { kind: blockKind, references: refs.map(p => ({ ...p })) } }] : others;
}
export function isMealScoutPublicProfileDestination(raw: unknown, sourceId: string): raw is string {
  if (typeof raw !== "string") return false;
  try {
    const u = new URL(raw);
    const tail = u.pathname.split("/").at(-1) ?? "";
    return u.origin === "https://www.mealscout.us" && u.href === raw && !u.username && !u.password && !u.search && !u.hash
      && /^\/(restaurant|truck|bar|caterer|private-chef)\/[a-z0-9][a-z0-9-]{0,119}$/.test(u.pathname)
      && tail.lastIndexOf("--") >= 1
      && tail.slice(tail.lastIndexOf("--") + 2) === sourceId;
  } catch { return false; }
}

const envelopeKeys = ["app", "tenantId", "sourceId", "publication", "exportApproval", "publicLabel", "canonicalUrl",
  "sourceRevision", "publicationRevision", "approvedAt", "expiresAt"];
/** Unknown fields fail closed: a private upstream field is never forwarded. */
export function projectApprovedEcosystemPublicLink(raw: unknown, pointer: EcosystemPublicLinkPointer, now: number): ApprovedEcosystemPublicLink | null {
  if (!Number.isFinite(now) || !isRecord(raw) || !exactKeys(raw, envelopeKeys)
    || raw.app !== pointer.app || raw.tenantId !== pointer.tenantId || raw.sourceId !== pointer.sourceId
    || raw.publication !== "published" || raw.exportApproval !== "approved"
    || typeof raw.publicLabel !== "string" || !raw.publicLabel.trim() || raw.publicLabel.length > 120 || /[<>\x00-\x1f]/.test(raw.publicLabel)
    || typeof raw.sourceRevision !== "string" || !/^[a-f0-9]{40}$/.test(raw.sourceRevision)
    || typeof raw.publicationRevision !== "string" || !/^g[a-f0-9]{32}_p[1-9][0-9]{0,18}_a[1-9][0-9]{0,18}$/.test(raw.publicationRevision)
    || typeof raw.approvedAt !== "string" || typeof raw.expiresAt !== "string"
    || !isMealScoutPublicProfileDestination(raw.canonicalUrl, pointer.sourceId)) return null;
  const approved = Date.parse(raw.approvedAt), expires = Date.parse(raw.expiresAt);
  if (!Number.isFinite(approved) || !Number.isFinite(expires) || approved > now || expires <= now || expires <= approved
    || expires > now + 1000) return null;
  return Object.freeze({ reference: ecosystemPublicLinkKey(pointer), app: "mealscout", publicLabel: raw.publicLabel,
    canonicalUrl: raw.canonicalUrl, sourceRevision: raw.sourceRevision, publicationRevision: raw.publicationRevision,
    expiresAt: raw.expiresAt, access: "public_link_only" });
}
