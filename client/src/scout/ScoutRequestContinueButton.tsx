import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { loadScoutRequestContinuation } from "./scoutRequestContinuation";
import type { ScoutRequestSelection } from "./scoutRequestSelection";

export function ScoutRequestContinueButton({ requestId, onPromptSelect, requestSelection }: {
  requestId: string;
  requestSelection: ScoutRequestSelection;
  onPromptSelect: (prompt: string) => void;
}) {
  const { user, isAuthenticated } = useAuth();
  const ownerId = isAuthenticated && typeof user?.id === "string" ? user.id : null;
  const ownerRef = useRef(ownerId);
  ownerRef.current = ownerId;
  const requestRef = useRef(requestId);
  requestRef.current = requestId;
  const inFlight = useRef<AbortController | null>(null);
  const mounted = useRef(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  useEffect(() => {
    mounted.current = true;
    setBusy(false);
    setError(false);
    return () => { mounted.current = false; inFlight.current?.abort(); inFlight.current = null; };
  }, [ownerId, requestId, requestSelection]);
  if (!ownerId) return null;

  return <div className="mt-1">
    <button type="button" disabled={busy} aria-busy={busy}
      className="inline-flex min-h-11 items-center rounded-lg px-2 py-2 text-sm font-semibold text-ts-orange underline-offset-4 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 disabled:opacity-60"
      onClick={async () => {
        if (inFlight.current && !inFlight.current.signal.aborted) return;
        const controller = new AbortController();
        inFlight.current = controller;
        setBusy(true);
        setError(false);
        const clearPending = () => {
          if (inFlight.current === controller) {
            inFlight.current = null;
            if (mounted.current) setBusy(false);
          }
        };
        controller.signal.addEventListener("abort", clearPending, { once: true });
        try {
          if (!requestSelection.select(controller)) return;
          const prompt = await loadScoutRequestContinuation(requestId, ownerId, { signal: controller.signal });
          if (requestSelection.isCurrent(controller) && !controller.signal.aborted && mounted.current && ownerRef.current === ownerId && requestRef.current === requestId) onPromptSelect(prompt);
        } catch {
          if (requestSelection.isCurrent(controller) && !controller.signal.aborted && mounted.current && ownerRef.current === ownerId && requestRef.current === requestId) setError(true);
        } finally {
          controller.signal.removeEventListener("abort", clearPending);
          requestSelection.finish(controller);
          clearPending();
        }
      }}>
      {busy ? "Loading request…" : "Continue with Scout"}
    </button>
    {error && <p role="alert" className="text-sm text-[color:var(--text-muted)]">This request could not be loaded. Refresh your work and try again; nothing was submitted.</p>}
  </div>;
}
