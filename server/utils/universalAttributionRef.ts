import type { Request, Response } from "express";

const BLOCKED_TARGET_PREFIXES = ["/admin", "/staff", "/api", "/ref"];

const ELIGIBLE_TARGET_PREFIXES = [
  "/scout",
  "/community",
  "/community-feed",
  "/exchange",
  "/homescout-listings",
  "/direct-connect",
  "/tradedeals",
  "/tradepartners",
  "/county",
  "/u/",
  "/p/",
  "/profile/",
  "/business/",
] as const;

export type UniversalAttributionFailureCode =
  | "MISSING_TAG"
  | "INVALID_TAG"
  | "DISALLOWED_DEFAULT_TAG"
  | "UNKNOWN_TAG"
  | "MISSING_TARGET"
  | "INVALID_TARGET";

export type UniversalAttributionValidation =
  | { ok: true; tag: string; target: string }
  | { ok: false; code: UniversalAttributionFailureCode; reason: string };

function normalizeTag(rawTag: unknown): string {
  return String(rawTag || "").trim();
}

export function isDefaultLookingAffiliateTag(tag: string): boolean {
  return /^user\d{4,}$/i.test(String(tag || "").trim());
}

function hasBlockedPrefix(pathname: string): boolean {
  return BLOCKED_TARGET_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  );
}

function hasEligiblePrefix(pathname: string): boolean {
  return ELIGIBLE_TARGET_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(prefix)
  );
}

export function validateUniversalAttributionTarget(
  rawTarget: unknown
):
  | { ok: true; target: string }
  | { ok: false; code: "MISSING_TARGET" | "INVALID_TARGET"; reason: string } {
  const target = String(rawTarget || "").trim();

  if (!target) {
    return { ok: false, code: "MISSING_TARGET", reason: "Target is required" };
  }

  if (target === "/") {
    return { ok: false, code: "INVALID_TARGET", reason: "Root-only targets are blocked" };
  }

  if (target.startsWith("//")) {
    return {
      ok: false,
      code: "INVALID_TARGET",
      reason: "Protocol-relative targets are blocked",
    };
  }

  if (/^[a-z][a-z0-9+.-]*:/i.test(target) || target.includes("://")) {
    return { ok: false, code: "INVALID_TARGET", reason: "External targets are blocked" };
  }

  if (!target.startsWith("/")) {
    return {
      ok: false,
      code: "INVALID_TARGET",
      reason: "Target must be an internal absolute path",
    };
  }

  if (target.includes("\\") || /[\u0000-\u001F]/.test(target)) {
    return { ok: false, code: "INVALID_TARGET", reason: "Malformed target" };
  }

  let parsed: URL;
  try {
    parsed = new URL(target, "https://www.thetradescout.com");
  } catch {
    return { ok: false, code: "INVALID_TARGET", reason: "Malformed target" };
  }

  const pathname = parsed.pathname || "/";

  if (pathname === "/") {
    return { ok: false, code: "INVALID_TARGET", reason: "Root-only targets are blocked" };
  }

  if (hasBlockedPrefix(pathname)) {
    return {
      ok: false,
      code: "INVALID_TARGET",
      reason: "Target points to a blocked internal namespace",
    };
  }

  if (!hasEligiblePrefix(pathname)) {
    return {
      ok: false,
      code: "INVALID_TARGET",
      reason: "Target is not an eligible internal share destination",
    };
  }

  const normalizedTarget = `${pathname}${parsed.search || ""}${parsed.hash || ""}`;
  return { ok: true, target: normalizedTarget };
}

export async function validateUniversalAttributionClick(params: {
  rawTag: unknown;
  rawTarget: unknown;
  tagExists: (tag: string) => Promise<boolean>;
}): Promise<UniversalAttributionValidation> {
  const tag = normalizeTag(params.rawTag);
  if (!tag) {
    return { ok: false, code: "MISSING_TAG", reason: "Affiliate tag is required" };
  }

  if (!/^[A-Za-z0-9][A-Za-z0-9-]{2,63}$/.test(tag)) {
    return { ok: false, code: "INVALID_TAG", reason: "Affiliate tag format is invalid" };
  }

  if (isDefaultLookingAffiliateTag(tag)) {
    return {
      ok: false,
      code: "DISALLOWED_DEFAULT_TAG",
      reason: "Default-looking tags are not allowed",
    };
  }

  const targetValidation = validateUniversalAttributionTarget(params.rawTarget);
  if (!targetValidation.ok) {
    return targetValidation;
  }

  const exists = await params.tagExists(tag);
  if (!exists) {
    return { ok: false, code: "UNKNOWN_TAG", reason: "Affiliate tag does not exist" };
  }

  return { ok: true, tag, target: targetValidation.target };
}

export async function handleUniversalAttributionClick(params: {
  req: Request;
  res: Response;
  rawTag: unknown;
  rawTarget: unknown;
  tagExists: (tag: string) => Promise<boolean>;
  getExistingAttribution: (req: Request) => string | null;
  setAttributionCookie: (res: Response, tag: string) => void;
  onAttributionAccepted: (args: { tag: string; target: string }) => Promise<void>;
  now?: () => Date;
}): Promise<void> {
  const result = await validateUniversalAttributionClick({
    rawTag: params.rawTag,
    rawTarget: params.rawTarget,
    tagExists: params.tagExists,
  });

  if (!result.ok) {
    params.res.status(400).json({
      code: result.code,
      message: result.reason,
    });
    return;
  }

  if (!params.getExistingAttribution(params.req)) {
    params.setAttributionCookie(params.res, result.tag);
  }

  const nowIso = (params.now ? params.now() : new Date()).toISOString();
  const reqAny = params.req as any;
  if (reqAny.session) {
    reqAny.session.referralAttribution = {
      referralCode: result.tag,
      destination: result.target,
      source: "universal_ref",
      attributedAt: nowIso,
    };
  }

  await params.onAttributionAccepted({ tag: result.tag, target: result.target });
  params.res.redirect(302, result.target);
}
