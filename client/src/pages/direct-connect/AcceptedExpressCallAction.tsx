import { useState } from "react";
import { Phone } from "lucide-react";
import { Button } from "@/components/ui/button";

type AcceptedExpressCallActionProps = {
  assignmentId: string;
  assignmentStatus: string;
  contactPreference?: "platform_message" | "call" | null;
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
}: AcceptedExpressCallActionProps) {
  const [releasedPhone, setReleasedPhone] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (assignmentStatus !== "accepted" || contactPreference !== "call") return null;

  const callHref = releasedPhone ? toExpressCallHref(releasedPhone) : null;

  const loadCallNumber = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch(
        `/api/direct-connect/assignments/${encodeURIComponent(assignmentId)}/contact`,
        {
          method: "GET",
          credentials: "include",
          headers: { Accept: "application/json" },
        }
      );
      const payload = await response.json().catch(() => null);
      const phone = String(payload?.requesterContact?.phone || "").trim();
      if (
        !response.ok ||
        payload?.contactGateState !== "accepted" ||
        payload?.contactPreference !== "call" ||
        !toExpressCallHref(phone)
      ) {
        throw new Error("Call contact is not available for this assignment.");
      }
      setReleasedPhone(phone);
    } catch {
      setReleasedPhone(null);
      setError("The call number is still protected. Refresh the assignment and try again.");
    } finally {
      setIsLoading(false);
    }
  };

  if (callHref) {
    return (
      <Button asChild size="sm" className="h-8 min-h-[44px] px-2 text-xs sm:min-h-8">
        <a href={callHref} data-testid="accepted-express-call-link">
          <Phone className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" />
          Call {releasedPhone}
        </a>
      </Button>
    );
  }

  return (
    <span className="inline-flex flex-col items-start gap-1">
      <Button
        type="button"
        size="sm"
        variant="outline"
        className="h-8 min-h-[44px] px-2 text-xs sm:min-h-8"
        disabled={isLoading}
        onClick={loadCallNumber}
      >
        <Phone className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" />
        {isLoading ? "Checking call access…" : "Show call number"}
      </Button>
      {error ? (
        <span role="alert" className="max-w-64 text-[11px] text-rose-200">
          {error}
        </span>
      ) : null}
    </span>
  );
}
