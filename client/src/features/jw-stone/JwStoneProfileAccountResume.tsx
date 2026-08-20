import { useEffect, useState } from "react";
import { JW_STONE_PUBLIC_IDENTITY } from "@shared/jwStonePresentation";
import { PublicProfileAccountDialog } from "@/components/profile/PublicProfileAccountDialog";
import type { ProfileAccountMode } from "@/components/profile/profileAccountClient";

function readResumeRequest(): { open: boolean; mode: ProfileAccountMode } {
  if (typeof window === "undefined") return { open: false, mode: "create" };
  try {
    const params = new URL(window.location.href).searchParams;
    return {
      open: params.get("profileAccount") === "1",
      mode: params.get("profileAccountMode") === "signin" ? "signin" : "create",
    };
  } catch {
    return { open: false, mode: "create" };
  }
}

function clearResumeRequest(): void {
  if (typeof window === "undefined") return;
  try {
    const url = new URL(window.location.href);
    url.searchParams.delete("profileAccount");
    url.searchParams.delete("profileAccountMode");
    window.history.replaceState(window.history.state, "", `${url.pathname}${url.search}${url.hash}`);
  } catch {
    // ignore
  }
}

export function JwStoneProfileAccountResume() {
  const [request] = useState(readResumeRequest);
  const [open, setOpen] = useState(request.open);

  useEffect(() => {
    if (!request.open) return;
    setOpen(true);
  }, [request.open]);

  if (!request.open) return null;

  return (
    <PublicProfileAccountDialog
      open={open}
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen);
        if (!nextOpen) clearResumeRequest();
      }}
      profileSlug="jw-stone"
      profileName={JW_STONE_PUBLIC_IDENTITY.brandName}
      tone="light"
      initialMode={request.mode}
    />
  );
}

export default JwStoneProfileAccountResume;
