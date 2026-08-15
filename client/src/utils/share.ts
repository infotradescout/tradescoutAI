import { toast } from "@/hooks/use-toast";

let cachedAffiliateCode: string | null | undefined;
let affiliateCodePromise: Promise<string | null> | null = null;

async function fetchAffiliateCode(): Promise<string | null> {
  if (cachedAffiliateCode !== undefined) return cachedAffiliateCode;
  if (affiliateCodePromise) return affiliateCodePromise;

  affiliateCodePromise = (async () => {
    try {
      const res = await fetch("/api/affiliate/dashboard", {
        credentials: "include",
        headers: {
          Accept: "application/json",
        },
      });

      if (res.status === 401) {
        cachedAffiliateCode = null;
        return null;
      }

      if (!res.ok) {
        cachedAffiliateCode = null;
        return null;
      }

      const json: any = await res.json().catch(() => null);
      const code: unknown = json?.program?.affiliateCode ?? json?.program?.referralCode;
      cachedAffiliateCode = typeof code === "string" && code.length > 0 ? code : null;
      return cachedAffiliateCode;
    } catch {
      cachedAffiliateCode = null;
      return null;
    } finally {
      affiliateCodePromise = null;
    }
  })();

  return affiliateCodePromise;
}

function resolveOrigin(): string {
  if (typeof window === "undefined" || !window.location?.origin) {
    return "";
  }
  return window.location.origin;
}

function isSelfAttributingPublicProfileUrl(url: URL): boolean {
  const pathname = String(url.pathname || "");
  return (
    pathname.startsWith("/u/") || pathname.startsWith("/p/") || pathname.startsWith("/profile/")
  );
}

export async function buildAffiliateUrl(
  rawPathOrUrl: string,
  options?: { affiliateCodeOverride?: string; suppressRef?: boolean; forceRef?: boolean }
): Promise<string> {
  const origin = resolveOrigin();

  // Normalise into an absolute URL first
  let baseUrl: string;
  if (rawPathOrUrl.startsWith("http://") || rawPathOrUrl.startsWith("https://")) {
    baseUrl = rawPathOrUrl;
  } else {
    baseUrl = origin + rawPathOrUrl;
  }

  // Callers that explicitly require a clean URL should not need account state
  // just to share it. In addition to avoiding an unnecessary request, this
  // keeps privacy-sensitive, self-contained share flows fully local.
  if (options?.suppressRef === true && options.forceRef !== true) {
    return baseUrl;
  }

  const affiliateCode =
    options?.affiliateCodeOverride != null && options.affiliateCodeOverride !== ""
      ? options.affiliateCodeOverride
      : await fetchAffiliateCode();

  if (!affiliateCode) {
    return baseUrl;
  }

  try {
    const url = new URL(baseUrl, origin || undefined);

    // By default, logged-in shares should carry the affiliate code.
    // Public profile URLs are self-attributing and should stay clean.
    // Otherwise, only suppress ?ref when a caller explicitly opts out.
    const suppressRef =
      options?.forceRef === true
        ? false
        : options?.suppressRef === true || isSelfAttributingPublicProfileUrl(url);

    if (!suppressRef) {
      url.searchParams.set("ref", affiliateCode);
    }
    return url.toString();
  } catch {
    return baseUrl;
  }
}

export type ShareContextKind =
  | "community_post"
  | "profile"
  | "business"
  | "listing"
  | "offer"
  | "event"
  | "page";

export interface ShareOptions {
  path?: string;
  url?: string;
  title?: string;
  text?: string;
  /**
   * Human label used in success toasts, e.g. "Post link", "Profile link".
   */
  contextLabel?: string;
  /**
   * Optional explicit affiliate code when it is already known (e.g. on /affiliate dashboard).
   */
  affiliateCodeOverride?: string;
  /**
   * Keep the URL clean (no ?ref=...) only when a caller explicitly requests it.
   */
  suppressRef?: boolean;
  /**
   * Force attaching ?ref=... even if another caller might otherwise suppress it.
   */
  forceRef?: boolean;
  /** Optional richer preview details for the universal Share Card. */
  kind?: ShareContextKind;
  imageUrl?: string;
  sourceName?: string;
}

export type ShareCardPayload = {
  url: string;
  title: string;
  text: string;
  contextLabel: string;
  kind: ShareContextKind;
  imageUrl?: string;
  sourceName: string;
};

export const SHARE_CARD_EVENT = "tradescout:open-share-card";

export function inferShareKind(pathOrUrl: string): ShareContextKind {
  let pathname = pathOrUrl;
  try {
    pathname = new URL(pathOrUrl, resolveOrigin() || "https://www.thetradescout.com").pathname;
  } catch {
    // Use the raw path for the conservative fallbacks below.
  }
  if (/^\/community\/(post\/)?/i.test(pathname)) return "community_post";
  if (/^\/(u|p|profile|contractors|helpers)\//i.test(pathname)) return "profile";
  if (/^\/business\//i.test(pathname)) return "business";
  if (/^\/(exchange|marketplace|handmade|homescout)/i.test(pathname)) return "listing";
  if (/offer|promo|deal/i.test(pathname)) return "offer";
  if (/event/i.test(pathname)) return "event";
  return "page";
}

export async function share(options: ShareOptions): Promise<void> {
  const origin = resolveOrigin();
  const currentHref =
    typeof window !== "undefined" && window.location?.href ? window.location.href : origin || "/";
  const baseInput =
    options.url ??
    (options.path
      ? options.path.startsWith("http")
        ? options.path
        : origin + options.path
      : currentHref);

  try {
    const finalUrl = await buildAffiliateUrl(baseInput, {
      affiliateCodeOverride: options.affiliateCodeOverride,
      suppressRef: options.suppressRef,
      forceRef: options.forceRef,
    });

    const title = options.title || "Share from TradeScout";
    const text = (options.text || "").toString().slice(0, 200);
    const label = options.contextLabel || "Link";
    if (typeof window === "undefined") return;

    const payload: ShareCardPayload = {
      url: finalUrl,
      title,
      text,
      contextLabel: label,
      kind: options.kind || inferShareKind(finalUrl),
      imageUrl: options.imageUrl,
      sourceName: options.sourceName || "TradeScout",
    };
    window.dispatchEvent(new CustomEvent<ShareCardPayload>(SHARE_CARD_EVENT, { detail: payload }));
  } catch {
    toast({
      title: "Unable to share",
      description: "Something went wrong while preparing the share link.",
      variant: "destructive",
    });
  }
}

export async function shareToPlatform(options: {
  platform: "facebook" | "twitter" | "email";
  path?: string;
  url?: string;
  title?: string;
  text?: string;
  affiliateCodeOverride?: string;
  suppressRef?: boolean;
  forceRef?: boolean;
}): Promise<void> {
  const origin = resolveOrigin();
  const currentHref =
    typeof window !== "undefined" && window.location?.href ? window.location.href : origin || "/";
  const baseInput =
    options.url ??
    (options.path
      ? options.path.startsWith("http")
        ? options.path
        : origin + options.path
      : currentHref);

  try {
    const finalUrl = await buildAffiliateUrl(baseInput, {
      affiliateCodeOverride: options.affiliateCodeOverride,
      suppressRef: options.suppressRef,
      forceRef: options.forceRef,
    });

    const title = options.title || "Check this out";
    const text = (options.text || "").toString().slice(0, 200);

    let shareUrl = "";
    switch (options.platform) {
      case "facebook":
        shareUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(finalUrl)}`;
        break;
      case "twitter":
        shareUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text || title)}&url=${encodeURIComponent(
          finalUrl
        )}`;
        break;
      case "email":
        shareUrl = `mailto:?subject=${encodeURIComponent(title)}&body=${encodeURIComponent(text + "\n\n" + finalUrl)}`;
        break;
    }

    if (shareUrl && typeof window !== "undefined" && typeof window.open === "function") {
      window.open(shareUrl, "_blank", "noopener,noreferrer");
    }
  } catch {
    toast({
      title: "Unable to share",
      description: "Something went wrong while preparing the share link.",
      variant: "destructive",
    });
  }
}
