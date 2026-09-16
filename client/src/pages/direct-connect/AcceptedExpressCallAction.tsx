import { useEffect, useState } from "react";
import { Phone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";

type AcceptedExpressCallActionProps = {
  assignmentId: string;
  assignmentStatus: string;
  contactPreference?: "platform_message" | "call" | null;
  submissionContactAvailable?: boolean;
};

type ContactResult = {
  key: string;
  phase: "loading" | "ready" | "error";
  phone?: string;
  name?: string;
};

export function toExpressCallHref(phone: string): string | null {
  const trimmed = String(phone || "").trim();
  const digits = trimmed.replace(/\D/g, "");
  if (digits.length < 7 || digits.length > 15) return null;
  return `tel:${trimmed.startsWith("+") ? "+" : ""}${digits}`;
}

export default function AcceptedExpressCallAction({
  assignmentId,
  assignmentStatus,
  contactPreference,
  submissionContactAvailable = false,
}: AcceptedExpressCallActionProps) {
  const { user } = useAuth();
  const accountId = typeof user?.id === "string" ? user.id : "";
  const submissionContact =
    submissionContactAvailable && ["invited", "suggested", "accepted"].includes(assignmentStatus);
  const eligible = Boolean(
    accountId && assignmentId &&
    (submissionContact || (assignmentStatus === "accepted" && contactPreference === "call"))
  );
  const key = JSON.stringify([
    accountId, assignmentId, assignmentStatus, contactPreference, submissionContactAvailable,
  ]);
  const [requestedKey, setRequestedKey] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [result, setResult] = useState<ContactResult | null>(null);
  const shouldLoad = eligible && (submissionContact || requestedKey === key);

  useEffect(() => {
    if (!shouldLoad) return;
    let active = true;
    const controller = new AbortController();
    setResult({ key, phase: "loading" });
    const timeout = setTimeout(() => {
      if (!active) return;
      controller.abort();
      setResult({ key, phase: "error" });
    }, 10_000);

    async function loadContact() {
      try {
        const response = await fetch(
          `/api/direct-connect/assignments/${encodeURIComponent(assignmentId)}/contact`,
          {
            method: "GET",
            credentials: "include",
            cache: "no-store",
            signal: controller.signal,
            headers: { Accept: "application/json" },
          }
        );
        const payload = await response.json();
        if (!active || controller.signal.aborted) return;
        const phone = typeof payload?.requesterContact?.phone === "string"
          ? payload.requesterContact.phone.trim() : "";
        const name = typeof payload?.requesterContact?.name === "string"
          ? payload.requesterContact.name.trim() : "";
        const allowed = payload?.assignmentId === assignmentId && (submissionContact
          ? payload?.contactGateState === "submission_consented" && Boolean(name)
          : payload?.contactGateState === "accepted" && payload?.contactPreference === "call");
        if (!response.ok || !allowed || !toExpressCallHref(phone)) {
          throw new Error("Requester contact is unavailable for this assignment.");
        }
        setResult({ key, phase: "ready", phone, name: submissionContact ? name : undefined });
      } catch {
        if (active && !controller.signal.aborted) setResult({ key, phase: "error" });
      } finally {
        clearTimeout(timeout);
      }
    }
    void loadContact();
    return () => {
      active = false;
      clearTimeout(timeout);
      controller.abort();
    };
  }, [assignmentId, key, shouldLoad, submissionContact, attempt]);

  if (!eligible) return null;
  // Scope at render time too: effects run after rendering, so clearing state in
  // an effect alone can briefly show the previous account or assignment's contact.
  const current = shouldLoad && result?.key === key ? result : null;
  const callHref = current?.phase === "ready" && current.phone
    ? toExpressCallHref(current.phone) : null;
  if (callHref) {
    if (submissionContact) return (
      <div className="rounded-lg border border-white/15 px-3 py-2 text-sm" data-testid="request-sender-contact">
        <p className="font-medium">{current?.name}</p>
        <a href={callHref} className="inline-flex min-h-[44px] items-center text-ts-orange underline">
          {current?.phone}
        </a>
      </div>
    );
    return (
      <Button asChild size="sm" className="h-8 min-h-[44px] px-2 text-xs sm:min-h-8">
        <a href={callHref} data-testid="accepted-express-call-link">
          <Phone className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" />
          Call {current?.phone}
        </a>
      </Button>
    );
  }

  const loading = shouldLoad && (!current || current.phase === "loading");
  return (
    <span className="inline-flex flex-col items-start gap-1">
      {loading ? (
        <span role="status" aria-live="polite" className="text-xs">Loading requester contact…</span>
      ) : (
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="h-8 min-h-[44px] px-2 text-xs sm:min-h-8"
          onClick={() => { setRequestedKey(key); setAttempt((value) => value + 1); }}
        >
          <Phone className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" />
          {current?.phase === "error" ? "Retry contact" : "Show call number"}
        </Button>
      )}
      {current?.phase === "error" ? (
        <span role="alert" className="max-w-64 text-[11px] text-rose-200">
          Requester contact could not be loaded. Retry or refresh this assignment.
        </span>
      ) : null}
    </span>
  );
}
