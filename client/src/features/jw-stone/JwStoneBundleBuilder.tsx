import { lazy, Suspense, useState } from "react";
import type { JwStoneCartReview } from "@shared/jwStoneCart";
import { JW_STONE_BUNDLE_SLABS, jwStoneBundleNeedsMaterialReview } from "@shared/jwStoneBundle";

const BundleStockPicker = lazy(() => import("./JwStoneBundleStockPicker").catch(() => ({
  default: function UnavailablePicker() {
    return <p role="alert" className="mt-3 text-sm">The slab picker could not be loaded. Your cart is saved. Refresh the page to retry, or browse the full collection below.</p>;
  },
})));
const PurchaseStart = lazy(() => import("./JwStonePurchaseStart").catch(() => ({
  default: function UnavailablePurchase() {
    return <p role="alert" className="mt-3 text-sm">Purchase controls could not be loaded. Your cart is saved. Refresh to retry; no payment has been taken.</p>;
  },
})));

export function JwStoneBundleBuilder({review,empty,checking,onBrowse}:{review?:JwStoneCartReview;empty:boolean;checking:boolean;onBrowse:()=>void}) {
  const [picking,setPicking]=useState(false);
  const bundle=review?.bundle;
  const needsMaterialReview=Boolean(review&&jwStoneBundleNeedsMaterialReview(review.lines));
  const count=bundle?.eligibleSlabs??0,remaining=bundle?.remainingSlabs??JW_STONE_BUNDLE_SLABS;
  const showProgress=(Boolean(bundle)||empty)&&!needsMaterialReview;
  const message=checking?"Checking bundle eligibility…":needsMaterialReview?"Confirm the material for each stock selection to check bundle pricing.":bundle?.unlocked?"Bundle pricing unlocked":bundle&&remaining===0?"Resolve unavailable selections to confirm bundle pricing.":bundle?"Add "+remaining+" more eligible "+(remaining===1?"slab":"slabs")+" to unlock bundle pricing.":empty?"Choose 7 eligible slabs to unlock bundle pricing.":"Choose exact stock to check your bundle.";
  const purchaseKey=review?JSON.stringify([review.viewerId,review.lines.map(line=>[line.inventoryPublicId,line.requestedQuantity]),review.subtotalCents,review.fulfillment]):"empty";
  return <section aria-labelledby="jw-bundle-title" data-testid="jw-bundle-builder" className="mb-4 border border-[var(--jw-accent)] bg-[var(--jw-bg)] p-4">
    <div className="flex items-center justify-between gap-3"><h2 id="jw-bundle-title" className="text-base font-semibold">Build a bundle</h2><span className="text-xs text-[var(--jw-muted)]">7 slabs = 1 bundle</span></div>
    <p role="status" aria-live="polite" className="mt-2 text-sm font-medium">{message}</p>
    {showProgress?<>
      <div role="progressbar" aria-label="Bundle progress" aria-valuemin={0} aria-valuemax={7} aria-valuenow={Math.min(count,7)} aria-valuetext={count+" eligible slabs; "+remaining+" more needed"} className="mt-3 grid grid-cols-7 gap-1">
        {Array.from({length:7},(_,index)=><span key={index} aria-hidden="true" className={index<count?"h-2 bg-[var(--jw-accent)]":"h-2 bg-[var(--jw-border)]"}/>)}
      </div>
      <p className="mt-2 text-xs text-[var(--jw-muted)]">{count} eligible {count===1?"slab":"slabs"} selected{bundle?.unlocked?" · Bundle rate applies to every eligible slab":" · 7 needed"}</p>
    </>:null}
    <p className="mt-3 text-xs leading-5 text-[var(--jw-muted)]">Mix eligible materials at each stone’s listed bundle rate. Lower quantity rates still apply. Special higher-minimum materials do not count toward this bundle.</p>
    <button type="button" onClick={()=>setPicking(current=>!current)} aria-expanded={picking} aria-controls="jw-bundle-stock-selection" data-testid="jw-bundle-open-picker" className="mt-3 min-h-11 w-full border border-[var(--jw-accent)] px-3 text-sm font-semibold">{picking?"Done choosing slabs":empty?"Choose slabs for your bundle":"Choose more slabs"}</button>
    {picking?<div id="jw-bundle-stock-selection"><Suspense fallback={<p role="status" className="mt-3 text-sm">Opening slab selector…</p>}><BundleStockPicker review={review} checking={checking}/></Suspense></div>:null}
    <button type="button" onClick={onBrowse} className="mt-2 min-h-11 w-full px-3 text-sm underline">Browse the full collection</button>
    {review?.materialReady?<Suspense fallback={<p role="status" className="mt-3 text-sm">Loading purchase controls…</p>}><PurchaseStart key={purchaseKey} review={review} checking={checking}/></Suspense>:null}
  </section>;
}
