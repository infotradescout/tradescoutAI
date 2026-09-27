import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { PublicProfileAccountDialog } from "./JwStoneAccountDialog";
import type { JwStonePricingAccess } from "@shared/jwStoneMemberPricing";
import { JW_STONE_BRAND_STYLE } from "./brand";

export default function JwStoneShoppingAccess({ access, onClose, onAccountChange }: {
  access: JwStonePricingAccess | null; onClose: () => void; onAccountChange: () => void;
}) {
  if (access === "internal") return <Dialog open onOpenChange={open => { if (!open) onClose(); }}>
    <DialogContent style={JW_STONE_BRAND_STYLE}>
      <DialogTitle>TradeScout stone tools</DialogTitle>
      <DialogDescription>Bundle Builder and Make an Offer are TradeScout services linked to JW Stone inventory and pricing. This internal JW Stone account has pricing access, not customer purchasing authority.</DialogDescription>
      <button type="button" className="min-h-11 px-4 underline" onClick={onClose}>Return to the storefront</button>
    </DialogContent>
  </Dialog>;
  return <PublicProfileAccountDialog open onOpenChange={open => { if (!open) onClose(); }}
    onAccountChange={onAccountChange} profileSlug="jw-stone" profileName="JW Stone" tone="light" initialMode="create" />;
}
