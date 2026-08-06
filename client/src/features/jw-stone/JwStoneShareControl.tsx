import { useState } from "react";
import { Share2 } from "lucide-react";
import { share } from "@/utils/share";

type JwStoneShareControlProps = {
  destination: string;
  title: string;
  text: string;
  label?: string;
  className?: string;
  imageUrl?: string;
};

/**
 * Guest-safe share control for marketplace stones.
 * Uses the platform share helper without auth/affiliate QueryClient wiring.
 */
export function JwStoneShareControl({
  destination,
  title,
  text,
  label = "Share",
  className,
  imageUrl,
}: JwStoneShareControlProps) {
  const [busy, setBusy] = useState(false);

  const onShare = async () => {
    if (busy || typeof window === "undefined") return;
    setBusy(true);
    try {
      const url = new URL(destination, `${window.location.origin}/`).toString();
      await share({ url, title, text, imageUrl, kind: "profile" });
    } finally {
      setBusy(false);
    }
  };

  return (
    <button
      type="button"
      onClick={() => void onShare()}
      disabled={busy}
      aria-label={label}
      className={className}
      data-testid="jw-stone-share"
    >
      <Share2 className="h-3.5 w-3.5" aria-hidden="true" />
      {label}
    </button>
  );
}
