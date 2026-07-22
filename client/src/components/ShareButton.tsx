import { useState } from "react";
import { Share2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { apiRequest } from "@/lib/queryClient";
import {
  buildAffiliateShareSlug,
  normalizeAffiliateShareDestination,
} from "@/lib/publicProfileItemDestination";
import { inferShareKind, share, type ShareContextKind } from "@/utils/share";

type ShareButtonProps = {
  /** Relative path being shared, e.g. "/u/jw-stone" or "/exchange/tools/abc123". */
  destination: string;
  /** Shown to the native share sheet / used as clipboard fallback context. */
  title?: string;
  text?: string;
  className?: string;
  variant?: "default" | "outline" | "ghost" | "secondary";
  size?: "default" | "sm" | "lg" | "icon";
  label?: string;
  kind?: ShareContextKind;
  imageUrl?: string;
};

/**
 * Drop-in share action for any profile, inventory item, listing, photo, etc.
 * Logged-in users get a personal affiliate link (reusing the existing
 * affiliate_share_links / /r/:slug system) so anything they share carries
 * their own referral attribution automatically -- no separate "become an
 * affiliate" step. Signed-out visitors just get a plain link to the page.
 */
export function ShareButton({
  destination,
  title,
  text,
  className,
  variant = "outline",
  size = "sm",
  label = "Share",
  kind,
  imageUrl,
}: ShareButtonProps) {
  const { user, isAuthenticated } = useAuth();
  const [isSharing, setIsSharing] = useState(false);
  const accessibleLabel = label?.trim() || `Share ${title?.trim() || "link"}`;

  const handleShare = async () => {
    if (isSharing) return;
    setIsSharing(true);
    try {
      const origin = window.location.origin;
      let shareUrl = new URL(destination, `${origin}/`).toString();

      if (isAuthenticated && user?.id) {
        const affiliateDestination = normalizeAffiliateShareDestination(destination);
        const slug = affiliateDestination ? buildAffiliateShareSlug(String(user.id), shareUrl) : "";
        try {
          if (affiliateDestination) {
            const res = await apiRequest("POST", "/api/affiliate/share-links", {
              destination: affiliateDestination,
              slug,
            });
            const json = await res.json();
            if (json?.shortUrl) shareUrl = json.shortUrl;
          }
        } catch (err: any) {
          // A 409 means this user already has a share link for this exact
          // destination (deterministic slug) -- reuse it rather than fail.
          if (err?.status === 409 && slug) {
            shareUrl = `${origin}/r/${slug}`;
          }
          // Any other failure: fall back to the plain canonical link below.
        }
      }

      await share({
        url: shareUrl,
        title,
        text,
        contextLabel: label?.trim() ? `${label.trim()} link` : "Link",
        kind: kind || inferShareKind(destination),
        imageUrl,
      });
    } finally {
      setIsSharing(false);
    }
  };

  return (
    <Button
      type="button"
      variant={variant}
      size={size}
      className={className}
      onClick={handleShare}
      disabled={isSharing}
      aria-label={accessibleLabel}
      title={accessibleLabel}
    >
      <Share2 className="h-4 w-4" />
      {label ? <span className="ml-1.5">{label}</span> : null}
    </Button>
  );
}

export default ShareButton;
