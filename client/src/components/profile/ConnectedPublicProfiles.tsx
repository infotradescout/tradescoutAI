import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { ecosystemPublicLinkKey, isMealScoutPublicRestaurantDestination,
  type EcosystemPublicLinkPointer } from "@shared/ecosystemPublicLink";

export default function ConnectedPublicProfiles({ profileSlug, references }: {
  profileSlug: string; references: EcosystemPublicLinkPointer[];
}) {
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const active = useRef<AbortController | null>(null);
  useEffect(() => () => { active.current?.abort(); }, [profileSlug, JSON.stringify(references)]);
  if (!references.length) return null;
  const open = async (pointer: EcosystemPublicLinkPointer) => {
    active.current?.abort();
    const controller = new AbortController(); active.current = controller;
    const timer = setTimeout(() => controller.abort(), 1500);
    setBusy(ecosystemPublicLinkKey(pointer)); setMessage("");
    const startedWall = Date.now(), startedMono = performance.now();
    try {
      const path = `/api/u/${encodeURIComponent(profileSlug)}/ecosystem-links/${pointer.app}/${pointer.tenantId}/${pointer.sourceId}`;
      // Mapped profile domains already serve the native public API. Keep this
      // credential-free check same-origin; platform navigation helpers are for links.
      const response = await fetch(path,
        { signal: controller.signal, cache: "no-store", credentials: "omit", redirect: "error" });
      if (!response.ok) throw new Error("unavailable");
      const result = await response.json();
      const ref = result?.reference;
      const now = Math.max(Date.now(), startedWall + performance.now() - startedMono);
      if (controller.signal.aborted || result.state !== "available" || ref?.reference !== ecosystemPublicLinkKey(pointer)
        || ref?.access !== "public_link_only" || !isMealScoutPublicRestaurantDestination(ref?.canonicalUrl, pointer.sourceId)
        || !Number.isFinite(Date.parse(ref.expiresAt)) || Date.parse(ref.expiresAt) <= now
        || Date.parse(ref.expiresAt) > now + 1000 || Date.now() < startedWall) throw new Error("unavailable");
      // One fresh navigation, no browser persistence, polling, account or grant.
      window.location.assign(ref.canonicalUrl);
    } catch {
      if (active.current === controller && !controller.signal.aborted) setMessage("This public link is unavailable right now. The profile remains available here.");
      else if (active.current === controller) setMessage("This public link could not be checked. Please try again.");
    } finally {
      clearTimeout(timer);
      if (active.current === controller) { setBusy(null); active.current = null; }
    }
  };
  return <div className="space-y-2 rounded-lg border border-current/15 p-3" data-testid="connected-public-profiles">
    <p className="text-sm font-medium">Connected public profiles</p>
    <p className="text-xs opacity-75">Open the original public profile. Approval is checked when you open it.</p>
    <div className="flex flex-wrap gap-2">{references.map((pointer, index) => <Button key={ecosystemPublicLinkKey(pointer)}
      type="button" variant="outline" size="sm" disabled={busy !== null} onClick={() => void open(pointer)}>
      {busy === ecosystemPublicLinkKey(pointer) ? "Checking link…" : `Open MealScout profile${references.length > 1 ? ` ${index + 1}` : ""}`}
    </Button>)}</div>
    {message ? <p role="status" className="text-sm">{message}</p> : null}
  </div>;
}
