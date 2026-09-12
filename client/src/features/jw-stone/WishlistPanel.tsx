import { useEffect, useRef, useState } from "react";
import { Bookmark, Mail, MessageCircle, Trash2 } from "lucide-react";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { apiRequest } from "@/lib/queryClient";
import { JW_STONE_BRAND_STYLE, jw } from "./brand";
import { useJwStoneWishlist } from "./useJwStoneWishlist";
import type { JwStoneCatalogItem } from "./types";
type WishlistPanelProps = {
  open: boolean; items: readonly JwStoneCatalogItem[]; restored: boolean; persisted: boolean;
  knownEmail?: string | null; onOpenChange: (open: boolean) => void; onRemove: (id: string) => void;
  onClear: () => void; onOpenStone: (stone: JwStoneCatalogItem) => void; onAsk: (stones: readonly JwStoneCatalogItem[]) => void;
};
type EmailStatus = "idle" | "sending" | "sent" | "error";
function isValidEmail(value: string): boolean { const text = value.trim(); return text.length >= 3 && text.length <= 320 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(text); }
export function WishlistPanel({ open, items, restored, persisted, knownEmail = null, onOpenChange, onRemove, onClear, onOpenStone, onAsk }: WishlistPanelProps) {
  const { notice } = useJwStoneWishlist();
  const [confirmClear, setConfirmClear] = useState(false);
  const [email, setEmail] = useState(knownEmail?.trim() || "");
  const [emailStatus, setEmailStatus] = useState<EmailStatus>("idle");
  const [emailError, setEmailError] = useState<string | null>(null);
  const pending = useRef<AbortController | null>(null);
  const honeypot = useRef<HTMLInputElement>(null);
  const signature = items.map(item => item.id).join("|");
  useEffect(() => { setEmail(knownEmail?.trim() || ""); }, [knownEmail]);
  useEffect(() => {
    pending.current?.abort(); pending.current = null;
    setConfirmClear(false); setEmailStatus("idle"); setEmailError(null);
    return () => { pending.current?.abort(); pending.current = null; };
  }, [open, knownEmail, signature]);
  const canEmail = restored && items.length > 0 && isValidEmail(email) && emailStatus !== "sending";
  async function sendSavedList() {
    if (!canEmail || pending.current) return;
    const controller = new AbortController(); pending.current = controller;
    setEmailStatus("sending"); setEmailError(null);
    try {
      // apiRequest honors the configured API origin, credentials and timeout.
      const payload = await apiRequest("/api/jw-stone/saved-stones/email", { method: "POST", timeoutMs: 20000, signal: controller.signal, body: { email: email.trim(), stones: items.map(stone => ({ name: stone.displayName || stone.publicLabel, shareSlug: stone.shareSlug })), website: honeypot.current?.value || "" } });
      if (controller.signal.aborted) return;
      if (payload?.sent !== true) throw new Error(payload?.message || "Email delivery could not be confirmed. Check your inbox before retrying.");
      setEmailStatus("sent");
    } catch (error) {
      if (controller.signal.aborted) return;
      setEmailStatus("error"); setEmailError(error instanceof Error ? error.message : "Email delivery could not be confirmed. Check your inbox before retrying.");
    } finally { if (pending.current === controller) pending.current = null; }
  }
  return <Sheet open={open} onOpenChange={onOpenChange}>
    <SheetContent side="right" style={JW_STONE_BRAND_STYLE} className={`flex h-full w-full flex-col border p-0 sm:max-w-xl ${jw.border} ${jw.page}`}>
      <SheetHeader className={`shrink-0 border-b px-5 py-5 text-left sm:px-6 ${jw.border}`}>
        <SheetTitle className="font-editorial text-2xl font-normal text-[var(--jw-ink)] sm:text-3xl">Saved stones</SheetTitle>
        <SheetDescription className={`max-w-md text-sm leading-5 ${jw.muted}`}>Your bookmarked catalog stones, kept in this browser. Email yourself a copy for reference on another device. Saving does not notify JW Stone or reserve stock.</SheetDescription>
        {restored && !persisted ? <p role="status" className={`text-sm ${jw.muted}`}>Browser storage is unavailable, so these changes last for the current visit only.</p> : null}
        {notice ? <p role="status" className="text-sm text-[var(--jw-ink)]">{notice}</p> : null}
      </SheetHeader>
      <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5 sm:px-6">
        {!restored ? <p role="status" className={jw.muted}>Loading saved stones…</p> : items.length ? <ul className="space-y-4" aria-label={`${items.length} saved stones`}>{items.map(stone => <li key={stone.id} className={`grid grid-cols-[4rem_minmax(0,1fr)_auto] gap-3 border-b pb-4 sm:grid-cols-[6rem_minmax(0,1fr)_auto] ${jw.border}`}>
          <button type="button" onClick={() => onOpenStone(stone)} className="aspect-square bg-[var(--jw-surface)]" aria-label={`Open ${stone.publicLabel}`}><img src={stone.images[0]} alt="" className="h-full w-full object-contain" loading="lazy" /></button>
          <button type="button" onClick={() => onOpenStone(stone)} className="min-w-0 self-center text-left"><span className="block break-words font-editorial text-xl leading-tight text-[var(--jw-ink)] sm:text-2xl">{stone.publicLabel}</span><span className={`mt-1 block text-xs uppercase tracking-wider ${jw.muted}`}>{[stone.materialLabel, stone.finishes.join(" / ")].filter(Boolean).join(" · ")}</span></button>
          <button type="button" onClick={() => onRemove(stone.id)} className={`inline-flex h-11 w-11 items-center justify-center self-center border ${jw.border}`} aria-label={`Remove ${stone.publicLabel} from saved stones`}><Trash2 className="h-4 w-4" /></button>
        </li>)}</ul> : <div className="flex min-h-52 flex-col items-center justify-center text-center"><Bookmark className={`h-8 w-8 ${jw.muted}`} /><h3 className="mt-5 font-editorial text-3xl text-[var(--jw-ink)]">Nothing saved yet</h3><p className={`mt-3 max-w-sm text-sm leading-6 ${jw.muted}`}>Bookmark a named stone from the collection to see it here.</p><button type="button" onClick={() => onOpenChange(false)} className={`mt-5 min-h-11 px-5 text-sm ${jw.ghostOnLight}`}>Continue exploring</button></div>}
      </div>
      {restored && items.length ? <div className={`max-h-[50dvh] shrink-0 overflow-y-auto border-t px-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] pt-4 sm:px-6 ${jw.border} ${jw.surface}`}>
        <label htmlFor="jw-saved-stones-email" className={`block text-sm ${jw.muted}`}>Email my saved stones</label>
        <input id="jw-saved-stones-email" type="email" autoComplete="email" inputMode="email" value={email} disabled={emailStatus === "sending"} onChange={event => { setEmail(event.target.value); setEmailStatus("idle"); setEmailError(null); }} placeholder="you@example.com" className={`mt-2 min-h-11 w-full px-3 text-base ${jw.field}`} aria-invalid={emailStatus === "error" && !isValidEmail(email)} aria-describedby="jw-saved-stones-email-help" />
        <input ref={honeypot} type="text" name="website" tabIndex={-1} autoComplete="off" aria-hidden="true" className="hidden" defaultValue="" />
        <p id="jw-saved-stones-email-help" className={`mt-1 text-xs leading-5 ${jw.muted}`}>Sends to the address above. Your browser-saved list stays in place.</p>
        {emailStatus === "sent" ? <p className="mt-2 text-sm text-[var(--jw-ink)]" role="status">Sent. Check your inbox for the list.</p> : null}
        {emailError ? <p className="mt-2 text-sm text-red-700" role="alert">{emailError}</p> : null}
        <button type="button" onClick={() => void sendSavedList()} disabled={!canEmail} className={`mt-2 inline-flex min-h-12 w-full items-center justify-center gap-2 px-5 ${jw.ghostOnLight} disabled:opacity-50`}><Mail className="h-5 w-5" />{emailStatus === "sending" ? "Sending…" : "Email my saved stones"}</button>
        <button type="button" onClick={() => onAsk(items)} className={`mt-3 inline-flex min-h-12 w-full items-center justify-center gap-2 px-5 ${jw.accentCta}`}><MessageCircle className="h-5 w-5" />Ask about {items.length === 1 ? "this stone" : `these ${items.length} stones`}</button>
        <button type="button" onClick={() => { if (confirmClear) { onClear(); setConfirmClear(false); } else setConfirmClear(true); }} className={`mt-2 min-h-11 w-full text-sm font-semibold ${jw.muted}`}>{confirmClear ? "Confirm clear saved stones" : "Clear saved stones"}</button>
      </div> : null}
    </SheetContent>
  </Sheet>;
}
