import { useEffect, useRef, useState } from "react";
import { Bookmark, Copy, Mail, MessageCircle, Trash2 } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/hooks/useAuth";
import ExpressDirectConnectPanel from "@/pages/profile-sites/ExpressDirectConnectPanel";
import { JW_STONE_BRAND_STYLE, jw } from "./brand";
import { useJwStoneWishlist } from "./useJwStoneWishlist";
import { JwStoneSavedLotsSection } from "./JwStoneSavedLotsSection";
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
  const text = value.trim();
  return text.length >= 3 && text.length <= 320 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(text);
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
  const { notice, savedLots } = useJwStoneWishlist();
  const { user, isAuthenticated } = useAuth();
  const [lotRequest, setLotRequest] = useState<string | null>(null);
  const [confirmClear, setConfirmClear] = useState(false);
  const [copied, setCopied] = useState<"idle" | "copied" | "manual">("idle");
  const [email, setEmail] = useState(knownEmail?.trim() || "");
  const [emailStatus, setEmailStatus] = useState<EmailStatus>("idle");
  const [emailError, setEmailError] = useState<string | null>(null);
  const pending = useRef<AbortController | null>(null);
  const honeypot = useRef<HTMLInputElement>(null);
  const signature = items.map((item) => item.id).join("|");
  const total = items.length + savedLots.length;
  const copyText = [
    "JW Stone saved selections — reference only, not a reservation",
    ...items.map((stone) => `Catalog: ${stone.displayName || stone.publicLabel}`),
    ...savedLots.map((lot) => `Inventory lot: ${lot.stoneName} — ${lot.id}`),
  ].join("\n");
  useEffect(() => {
    setEmail(knownEmail?.trim() || "");
  }, [knownEmail]);
  useEffect(() => {
    pending.current?.abort();
    pending.current = null;
    setConfirmClear(false);
    setEmailStatus("idle");
    setEmailError(null);
    return () => {
      pending.current?.abort();
      pending.current = null;
    };
  }, [open, knownEmail, signature]);
  useEffect(() => {
    setCopied("idle");
    setConfirmClear(false);
  }, [copyText, open]);
  useEffect(() => {
    if (open) setLotRequest(null);
  }, [open]);
  const canEmail = restored && items.length > 0 && isValidEmail(email) && emailStatus !== "sending";
  async function sendSavedList() {
    if (!canEmail || pending.current) return;
    const controller = new AbortController();
    pending.current = controller;
    setEmailStatus("sending");
    setEmailError(null);
    try {
      const payload = await apiRequest("/api/jw-stone/saved-stones/email", {
        method: "POST",
        timeoutMs: 20000,
        signal: controller.signal,
        body: {
          email: email.trim(),
          stones: items.map((stone) => ({
            name: stone.displayName || stone.publicLabel,
            shareSlug: stone.shareSlug,
          })),
          website: honeypot.current?.value || "",
        },
      });
      if (controller.signal.aborted) return;
      if (payload?.sent !== true)
        throw new Error(
          payload?.message ||
            "Email delivery could not be confirmed. Check your inbox before retrying."
        );
      setEmailStatus("sent");
    } catch (error) {
      if (controller.signal.aborted) return;
      setEmailStatus("error");
      setEmailError(
        error instanceof Error
          ? error.message
          : "Email delivery could not be confirmed. Check your inbox before retrying."
      );
    } finally {
      if (pending.current === controller) pending.current = null;
    }
  }
  async function copyList() {
    try {
      if (!navigator.clipboard?.writeText) throw new Error("Clipboard unavailable");
      await navigator.clipboard.writeText(copyText);
      setCopied("copied");
    } catch {
      setCopied("manual");
    }
  }
  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent
          side="right"
          style={JW_STONE_BRAND_STYLE}
          className={`flex h-full w-full flex-col border p-0 sm:max-w-xl ${jw.border} ${jw.page}`}
        >
          <SheetHeader className={`shrink-0 border-b px-5 py-5 text-left sm:px-6 ${jw.border}`}>
            <SheetTitle className="font-editorial text-2xl font-normal text-[var(--jw-ink)] sm:text-3xl">
              Saved stones
            </SheetTitle>
            <SheetDescription className={`max-w-md text-sm leading-5 ${jw.muted}`}>
              Your catalog stones and exact inventory lots, kept in this browser. Saving does not
              notify JW Stone or reserve stock.
            </SheetDescription>
            {restored && !persisted ? (
              <p role="status" className={`text-sm ${jw.muted}`}>
                Some browser saves could not be updated. Unsaved changes last for this visit only.
              </p>
            ) : null}
            {notice ? (
              <p role="status" className="text-sm text-[var(--jw-ink)]">
                {notice}
              </p>
            ) : null}
          </SheetHeader>
          <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5 sm:px-6">
            {!restored ? (
              <p role="status" className={jw.muted}>
                Loading saved stones…
              </p>
            ) : (
              <>
                <JwStoneSavedLotsSection
                  open={open}
                  lots={savedLots}
                  onRemove={onRemove}
                  onCartOpen={() => onOpenChange(false)}
                  onAsk={(message) => {
                    onOpenChange(false);
                    setLotRequest(message);
                  }}
                />
                {items.length ? (
                  <section>
                    <h3 className="mb-4 font-editorial text-2xl text-[var(--jw-ink)]">
                      Saved catalog stones ({items.length})
                    </h3>
                    <ul className="space-y-4" aria-label={`${items.length} saved catalog stones`}>
                      {items.map((stone) => (
                        <li
                          key={stone.id}
                          className={`grid grid-cols-[4rem_minmax(0,1fr)_auto] gap-3 border-b pb-4 sm:grid-cols-[6rem_minmax(0,1fr)_auto] ${jw.border}`}
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
                            className="min-w-0 self-center text-left"
                          >
                            <span className="block break-words font-editorial text-xl leading-tight text-[var(--jw-ink)] sm:text-2xl">
                              {stone.publicLabel}
                            </span>
                            <span
                              className={`mt-1 block text-xs uppercase tracking-wider ${jw.muted}`}
                            >
                              {[stone.materialLabel, stone.finishes.join(" / ")]
                                .filter(Boolean)
                                .join(" · ")}
                            </span>
                          </button>
                          <button
                            type="button"
                            onClick={() => onRemove(stone.id)}
                            className={`inline-flex h-11 w-11 items-center justify-center self-center border ${jw.border}`}
                            aria-label={`Remove ${stone.publicLabel} from saved stones`}
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </li>
                      ))}
                    </ul>
                  </section>
                ) : null}
                {!total ? (
                  <div className="flex min-h-52 flex-col items-center justify-center text-center">
                    <Bookmark className={`h-8 w-8 ${jw.muted}`} />
                    <h3 className="mt-5 font-editorial text-3xl text-[var(--jw-ink)]">
                      Nothing saved yet
                    </h3>
                    <p className={`mt-3 max-w-sm text-sm leading-6 ${jw.muted}`}>
                      Save an inventory lot from New Arrivals or bookmark a named catalog stone.
                    </p>
                    <button
                      type="button"
                      onClick={() => onOpenChange(false)}
                      className={`mt-5 min-h-11 px-5 text-sm ${jw.ghostOnLight}`}
                    >
                      Continue exploring
                    </button>
                  </div>
                ) : null}
              </>
            )}
          </div>
          {restored && total > 0 ? (
            <div
              className={`max-h-[50dvh] shrink-0 overflow-y-auto border-t px-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] pt-4 sm:px-6 ${jw.border} ${jw.surface}`}
            >
              <button
                type="button"
                onClick={() => void copyList()}
                className={`inline-flex min-h-11 w-full items-center justify-center gap-2 px-4 text-sm ${jw.ghostOnLight}`}
              >
                <Copy className="h-4 w-4" />
                Copy all {total} saved selections
              </button>
              {copied === "copied" ? (
                <p role="status" className="mt-2 text-sm">
                  Copied, including exact inventory lot references.
                </p>
              ) : copied === "manual" ? (
                <label className="mt-2 block text-sm">
                  Automatic copy is unavailable. Select and copy this list:
                  <textarea
                    aria-label="Saved selections to copy"
                    readOnly
                    value={copyText}
                    onFocus={(event) => event.currentTarget.select()}
                    className={`mt-2 min-h-28 w-full p-2 ${jw.field}`}
                  />
                </label>
              ) : null}
              {items.length > 0 ? (
                <>
                  <label
                    htmlFor="jw-saved-stones-email"
                    className={`mt-4 block text-sm ${jw.muted}`}
                  >
                    Email my saved catalog stones
                  </label>
                  <input
                    id="jw-saved-stones-email"
                    type="email"
                    autoComplete="email"
                    inputMode="email"
                    value={email}
                    disabled={emailStatus === "sending"}
                    onChange={(event) => {
                      setEmail(event.target.value);
                      setEmailStatus("idle");
                      setEmailError(null);
                    }}
                    placeholder="you@example.com"
                    className={`mt-2 min-h-11 w-full px-3 text-base ${jw.field}`}
                    aria-invalid={emailStatus === "error" && !isValidEmail(email)}
                    aria-describedby="jw-saved-stones-email-help"
                  />
                  <input
                    ref={honeypot}
                    type="text"
                    name="website"
                    tabIndex={-1}
                    autoComplete="off"
                    aria-hidden="true"
                    className="hidden"
                    defaultValue=""
                  />
                  <p
                    id="jw-saved-stones-email-help"
                    className={`mt-1 text-xs leading-5 ${jw.muted}`}
                  >
                    Sends {items.length} catalog {items.length === 1 ? "stone" : "stones"} to the
                    address above. Inventory lots are not included in this email; use Copy all to
                    keep their exact references.
                  </p>
                  {emailStatus === "sent" ? (
                    <p className="mt-2 text-sm text-[var(--jw-ink)]" role="status">
                      Sent. Check your inbox for the catalog list.
                    </p>
                  ) : null}
                  {emailError ? (
                    <p className="mt-2 text-sm text-red-700" role="alert">
                      {emailError}
                    </p>
                  ) : null}
                  <button
                    type="button"
                    onClick={() => void sendSavedList()}
                    disabled={!canEmail}
                    className={`mt-2 inline-flex min-h-12 w-full items-center justify-center gap-2 px-5 ${jw.ghostOnLight} disabled:opacity-50`}
                  >
                    <Mail className="h-5 w-5" />
                    {emailStatus === "sending" ? "Sending…" : "Email my saved catalog stones"}
                  </button>
                  <button
                    type="button"
                    onClick={() => onAsk(items)}
                    className={`mt-3 inline-flex min-h-12 w-full items-center justify-center gap-2 px-5 ${jw.accentCta}`}
                  >
                    <MessageCircle className="h-5 w-5" />
                    Ask about {items.length} saved catalog {items.length === 1 ? "stone" : "stones"}
                  </button>
                </>
              ) : null}
              <button
                type="button"
                onClick={() => {
                  if (confirmClear) {
                    onClear();
                    setConfirmClear(false);
                  } else setConfirmClear(true);
                }}
                className={`mt-2 min-h-11 w-full text-sm font-semibold ${jw.muted}`}
              >
                {confirmClear
                  ? "Confirm clear all saved stones and lots"
                  : "Clear all saved stones and lots"}
              </button>
            </div>
          ) : null}
        </SheetContent>
      </Sheet>
      {lotRequest !== null ? (
        <div style={JW_STONE_BRAND_STYLE}>
          <ExpressDirectConnectPanel
            key={String(user?.id || "visitor")}
            open={true}
            onClose={() => setLotRequest(null)}
            profileSlug="jw-stone"
            businessName="JW Stone"
            hasViewerSession={isAuthenticated || Boolean(user?.id)}
            allowCall={false}
            stayInProfile={true}
            requestMode="materials"
            initialView="request"
            initialRequestType="request_material"
            initialMessage={lotRequest}
          />
        </div>
      ) : null}
    </>
  );
}
