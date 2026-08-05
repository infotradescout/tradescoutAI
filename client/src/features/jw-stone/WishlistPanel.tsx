import { useEffect, useState } from "react";
import { Bookmark, Mail, MessageCircle, Trash2 } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { JW_STONE_BRAND_STYLE, jw } from "./brand";
import type { JwStoneCatalogItem } from "./types";

type WishlistPanelProps = {
  open: boolean;
  items: readonly JwStoneCatalogItem[];
  restored: boolean;
  persisted: boolean;
  knownEmail?: string | null;
  onOpenChange: (open: boolean) => void;
  onRemove: (id: string) => void;
  onClear: () => void;
  onOpenStone: (stone: JwStoneCatalogItem) => void;
  onAsk: (stones: readonly JwStoneCatalogItem[]) => void;
};

type EmailStatus = "idle" | "sending" | "sent" | "error";

function isValidEmail(value: string): boolean {
  const trimmed = value.trim();
  return trimmed.length >= 3 && trimmed.length <= 320 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed);
}

export function WishlistPanel({
  open,
  items,
  restored,
  persisted,
  knownEmail = null,
  onOpenChange,
  onRemove,
  onClear,
  onOpenStone,
  onAsk,
}: WishlistPanelProps) {
  const [confirmClear, setConfirmClear] = useState(false);
  const [email, setEmail] = useState(knownEmail?.trim() || "");
  const [emailStatus, setEmailStatus] = useState<EmailStatus>("idle");
  const [emailError, setEmailError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      setConfirmClear(false);
      setEmailStatus("idle");
      setEmailError(null);
      return;
    }
    if (knownEmail?.trim()) {
      setEmail(knownEmail.trim());
    }
  }, [open, knownEmail]);

  const canEmail = items.length > 0 && isValidEmail(email) && emailStatus !== "sending";

  const sendSavedList = async () => {
    if (!canEmail) {
      if (!isValidEmail(email)) {
        setEmailError("Enter an email address to receive your list.");
        setEmailStatus("error");
      }
      return;
    }

    setEmailStatus("sending");
    setEmailError(null);

    try {
      const response = await fetch("/api/jw-stone/saved-stones/email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          email: email.trim(),
          stones: items.map((stone) => ({
            name: stone.displayName || stone.publicLabel,
            shareSlug: stone.shareSlug,
          })),
          website: "",
        }),
      });
      const payload = (await response.json().catch(() => null)) as {
        message?: string;
        sent?: boolean;
      } | null;
      if (!response.ok || !payload?.sent) {
        throw new Error(payload?.message || "Email could not be sent.");
      }
      setEmailStatus("sent");
    } catch (error) {
      setEmailStatus("error");
      setEmailError(
        error instanceof Error ? error.message : "Email could not be sent. Try again shortly."
      );
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        style={JW_STONE_BRAND_STYLE}
        className={`flex h-full w-full flex-col border p-0 sm:max-w-xl ${jw.border} ${jw.page}`}
      >
        <SheetHeader className={`border-b px-5 py-5 text-left sm:px-6 ${jw.border}`}>
          <SheetTitle className="font-editorial text-2xl font-normal text-[var(--jw-ink)] sm:text-3xl">
            Saved stones
          </SheetTitle>
          <SheetDescription className={`max-w-md text-sm leading-5 ${jw.muted}`}>
            Kept in this browser for quick return. Email yourself a copy so the list survives cache
            clears — JW Stone is only contacted when you ask about a stone.
          </SheetDescription>
          {restored && !persisted ? (
            <p className={`text-sm ${jw.muted}`}>
              Browser storage is unavailable, so this selection lasts for the current visit only.
            </p>
          ) : null}
        </SheetHeader>

        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-6 sm:px-8">
          {items.length ? (
            <ul className="space-y-4" aria-label={`${items.length} saved stones`}>
              {items.map((stone) => (
                <li
                  key={stone.id}
                  className={`grid grid-cols-[6rem_1fr_auto] gap-4 border-b pb-4 ${jw.border}`}
                >
                  <button
                    type="button"
                    onClick={() => onOpenStone(stone)}
                    className="aspect-square bg-[var(--jw-surface)]"
                    aria-label={`Open ${stone.publicLabel}`}
                  >
                    <img
                      src={stone.images[0]}
                      alt=""
                      className="h-full w-full object-contain"
                      loading="lazy"
                    />
                  </button>
                  <button
                    type="button"
                    onClick={() => onOpenStone(stone)}
                    className="self-center text-left"
                  >
                    <span className="block font-editorial text-2xl leading-tight text-[var(--jw-ink)]">
                      {stone.publicLabel}
                    </span>
                    <span className={`mt-1 block text-xs uppercase tracking-wider ${jw.muted}`}>
                      {[stone.materialLabel, stone.finishes.join(" / ")]
                        .filter(Boolean)
                        .join(" · ")}
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => onRemove(stone.id)}
                    className={`inline-flex h-11 w-11 items-center justify-center self-center border ${jw.border} hover:border-[var(--jw-ink)] hover:bg-[var(--jw-bg)]`}
                    aria-label={`Remove ${stone.publicLabel} from saved stones`}
                  >
                    <Trash2 className="h-4 w-4" aria-hidden="true" />
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <div className="flex h-full min-h-80 flex-col items-center justify-center text-center">
              <Bookmark className={`h-8 w-8 ${jw.muted}`} aria-hidden="true" />
              <h3 className="mt-5 font-editorial text-3xl text-[var(--jw-ink)]">
                Your selection is open
              </h3>
              <p className={`mt-3 max-w-sm text-sm leading-6 ${jw.muted}`}>
                Save any named stone from the collection. It will appear here when you return in
                this browser. Once saved, you can email yourself a durable copy.
              </p>
              <button
                type="button"
                onClick={() => onOpenChange(false)}
                className={`mt-7 min-h-11 px-5 text-sm ${jw.ghostOnLight}`}
              >
                Continue exploring
              </button>
            </div>
          )}
        </div>

        {items.length ? (
          <div className={`border-t px-6 py-5 sm:px-8 ${jw.border} ${jw.surface}`}>
            <div className="space-y-2">
              <label htmlFor="jw-saved-stones-email" className={`block text-sm ${jw.muted}`}>
                Email my saved stones
              </label>
              <input
                id="jw-saved-stones-email"
                type="email"
                autoComplete="email"
                inputMode="email"
                value={email}
                onChange={(event) => {
                  setEmail(event.target.value);
                  if (emailStatus !== "idle") {
                    setEmailStatus("idle");
                    setEmailError(null);
                  }
                }}
                placeholder="you@example.com"
                className={`min-h-11 w-full px-3 text-sm ${jw.field}`}
                aria-invalid={emailStatus === "error" && !isValidEmail(email)}
                aria-describedby="jw-saved-stones-email-help"
              />
              {/* Honeypot — leave empty */}
              <input
                type="text"
                name="website"
                tabIndex={-1}
                autoComplete="off"
                aria-hidden="true"
                className="hidden"
                defaultValue=""
              />
              <p id="jw-saved-stones-email-help" className={`text-xs leading-5 ${jw.muted}`}>
                Sends only to you. Browser save stays in place; email is the backup.
              </p>
              {emailStatus === "sent" ? (
                <p className="text-sm text-[var(--jw-ink)]" role="status">
                  Sent. Check your inbox for the list.
                </p>
              ) : null}
              {emailError ? (
                <p className="text-sm text-red-700" role="alert">
                  {emailError}
                </p>
              ) : null}
              <button
                type="button"
                onClick={() => void sendSavedList()}
                disabled={!canEmail}
                className={`inline-flex min-h-12 w-full items-center justify-center gap-2 px-5 ${jw.ghostOnLight} disabled:cursor-not-allowed disabled:opacity-50`}
              >
                <Mail className="h-5 w-5" aria-hidden="true" />
                {emailStatus === "sending" ? "Sending…" : "Email my saved stones"}
              </button>
            </div>

            <button
              type="button"
              onClick={() => onAsk(items)}
              className={`mt-3 inline-flex min-h-12 w-full items-center justify-center gap-2 px-5 ${jw.accentCta}`}
            >
              <MessageCircle className="h-5 w-5" aria-hidden="true" />
              Ask about {items.length === 1 ? "this stone" : `these ${items.length} stones`}
            </button>
            <button
              type="button"
              onClick={() => {
                if (confirmClear) {
                  onClear();
                  setConfirmClear(false);
                } else {
                  setConfirmClear(true);
                }
              }}
              className={`mt-2 min-h-11 w-full text-sm font-semibold ${jw.muted} hover:text-[var(--jw-ink)]`}
            >
              {confirmClear ? "Confirm clear saved stones" : "Clear saved stones"}
            </button>
          </div>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}
