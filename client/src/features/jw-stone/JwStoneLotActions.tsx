import { useState } from "react";
import { Bookmark, MessageCircle } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import ExpressDirectConnectPanel from "@/pages/profile-sites/ExpressDirectConnectPanel";
import type { PublicStoneInventoryItem } from "@shared/stoneInventory";
import { useJwStoneSavedLots } from "./useJwStoneSavedLots";
import { jwStoneLotInquiry } from "./jwStoneSavedLotsStore";
import { jw } from "./brand";

export function JwStoneSaveLotButton({ item }: { item: PublicStoneInventoryItem }) {
  const saved = useJwStoneSavedLots();
  const selected = saved.isSaved(item.id);
  return <button type="button" disabled={!saved.restored} aria-pressed={selected} onClick={() => saved.toggle(item)} className={`mt-3 inline-flex min-h-11 w-full items-center justify-center gap-2 px-4 text-sm ${jw.ghostOnLight}`}>
    <Bookmark className="h-4 w-4" fill={selected ? "currentColor" : "none"} />
    {selected ? "Saved inventory lot" : "Save this inventory lot"}
  </button>;
}
/** Do not resolve a physical arrival back to a catalog name: retain the exact ID. */
export function JwStoneLotActions({ item }: { item: PublicStoneInventoryItem }) {
  const [asking, setAsking] = useState(false);
  const { user, isAuthenticated } = useAuth();
  return <>
    <JwStoneSaveLotButton item={item} />
    <button type="button" onClick={() => setAsking(true)} className={`mt-3 inline-flex min-h-11 w-full items-center justify-center gap-2 px-4 text-sm ${jw.accentCta}`}>
      <MessageCircle className="h-4 w-4" />Ask about this arrival
    </button>
    {asking ? <ExpressDirectConnectPanel open={true} onClose={() => setAsking(false)} profileSlug="jw-stone" businessName="JW Stone" hasViewerSession={isAuthenticated || Boolean(user?.id)} allowCall={false} stayInProfile={true} requestMode="materials" initialView="request" initialRequestType="request_material" initialMessage={jwStoneLotInquiry(item)} /> : null}
  </>;
}
