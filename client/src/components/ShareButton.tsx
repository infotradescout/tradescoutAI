import { useState } from "react";
import { Share2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { apiRequest } from "@/lib/queryClient";
import { normalizeAffiliateShareDestination } from "@/lib/publicProfileItemDestination";

// A short, deterministic, non-cryptographic hash (cyrb53) so repeat shares of
// the same content by the same user reuse one link instead of minting a new
// affiliate_share_links row -- and therefore one accumulating view/share
// count -- every time they hit the button.
function shortHash(input: string): string {
  let h1 = 0xdeadbeef ^ input.length;
  let h2 = 0x41c6ce57 ^ input.length;
  for (let i = 0; i < input.length; i++) {
    const ch = input.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(36);
}

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
}: ShareButtonProps) {
  const { user, isAuthenticated } = useAuth();
  const { toast } = useToast();
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
        const slug = affiliateDestination
          ? `s-${shortHash(`${user.id}:${affiliateDestination}`)}`
          : "";
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

      if (typeof navigator.share === "function") {
        try {
          await navigator.share({ title, text, url: shareUrl });
          return;
        } catch (err: any) {
          // Closing the native share sheet is an intentional user action. Other
          // failures should still leave the visitor with a usable share link.
          if (err?.name === "AbortError") return;
        }
      }

      try {
        if (!navigator.clipboard?.writeText) {
          throw new Error("Clipboard API unavailable");
        }
        await navigator.clipboard.writeText(shareUrl);
        toast({ title: "Link copied", description: shareUrl });
      } catch {
        toast({
          title: "Unable to share automatically",
          description: "Copy the link from your browser address bar to share.",
          variant: "destructive",
        });
      }
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
