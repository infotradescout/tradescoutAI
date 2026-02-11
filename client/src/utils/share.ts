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

  const affiliateCode =
    options?.affiliateCodeOverride != null && options.affiliateCodeOverride !== ""
      ? options.affiliateCodeOverride
      : await fetchAffiliateCode();

  if (!affiliateCode) {
    return baseUrl;
  }

  try {
    const url = new URL(baseUrl, origin || undefined);

    const pathname = url.pathname || "";
    const looksLikePublicProfile =
      pathname.startsWith("/profile/") || pathname.startsWith("/business/");

    // Special rule: public profile links should stay clean (no ?ref=...),
    // but still count as referrals server-side via clean attribution.
    const suppressRef =
      options?.forceRef === true ? false : options?.suppressRef === true || looksLikePublicProfile;

    if (!suppressRef) {
      url.searchParams.set("ref", affiliateCode);
    }
    return url.toString();
  } catch {
    return baseUrl;
  }
}

interface ShareOptions {
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
   * Keep the URL clean (no ?ref=...). Use for profile/business pages where
   * server-side clean attribution counts as a referral without the query param.
   */
  suppressRef?: boolean;
  /**
   * Force attaching ?ref=... even if the path looks like a public profile.
   */
  forceRef?: boolean;
}

export async function share(options: ShareOptions): Promise<void> {
  const origin = resolveOrigin();
  const baseInput =
    options.url ??
    (options.path
      ? options.path.startsWith("http")
        ? options.path
        : origin + options.path
      : origin || "/");

  try {
    const finalUrl = await buildAffiliateUrl(baseInput, {
      affiliateCodeOverride: options.affiliateCodeOverride,
      suppressRef: options.suppressRef,
      forceRef: options.forceRef,
    });

    const title = options.title;
    const text = (options.text || "").toString().slice(0, 200);
    const label = options.contextLabel || "Link";

    if (typeof navigator !== "undefined" && (navigator as any).share) {
      try {
        await (navigator as any).share({ title, text, url: finalUrl });
        return;
      } catch (err: any) {
        if (err && (err.name === "AbortError" || err.name === "NotAllowedError")) {
          return;
        }
        // Fall through to clipboard on other errors
      }
    }

    if (
      typeof navigator !== "undefined" &&
      (navigator as any).clipboard &&
      typeof (navigator as any).clipboard.writeText === "function"
    ) {
      await (navigator as any).clipboard.writeText(finalUrl);
      toast({
        title: `${label} copied`,
        description: `${label} copied to your clipboard.`,
      });
    } else {
      toast({
        title: "Unable to share automatically",
        description: "Copy the link from your browser address bar to share.",
        variant: "destructive",
      });
    }
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
  const baseInput =
    options.url ??
    (options.path
      ? options.path.startsWith("http")
        ? options.path
        : origin + options.path
      : origin || "/");

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
