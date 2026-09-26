import { useRef, useState } from "react";
import { z } from "zod";
import type { JwStoneCartReview } from "@shared/jwStoneCart";
import type { JwStoneCartHoldReceipt } from "@shared/jwStoneCartHolds";
import { JW_STONE_PURCHASE_PATH, JW_STONE_PURCHASE_TERMS, canonicalJwStonePurchase, jwStonePurchaseRequestSchema } from "@shared/jwStonePurchase";
import { JW_STONE_ORDERS_PAGE } from "@shared/jwStoneCheckout";
import { apiRequest } from "@/lib/queryClient";

const retrySchema=z.object({fingerprint:z.string().regex(/^[a-f0-9]{64}$/),operationId:z.string().uuid(),requestId:z.string().uuid().optional()});
const responseSchema=z.object({requestId:z.string().uuid(),role:z.literal("buyer"),intake:z.object({intent:z.literal("purchase")}),state:z.object({status:z.string()})});
export default function JwStonePurchaseStart({review,reserved,checking}:{review?:JwStoneCartReview;reserved?:{viewerId:string;receipt:JwStoneCartHoldReceipt};checking:boolean}) {
  const [open,setOpen]=useState(false),[consent,setConsent]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState(""),[saved,setSaved]=useState<string|null>(null);
  const terms=reserved?.receipt.status==="active"?{viewerId:reserved.viewerId,selection:{lines:reserved.receipt.lines.map(line=>({inventoryPublicId:line.inventoryPublicId,quantity:line.quantity})),fulfillment:reserved.receipt.fulfillment},expectedSubtotalCents:reserved.receipt.materialSubtotalCents}:
    review?.viewerId&&review.materialReady&&review.subtotalCents&&review.lines.every(line=>line.status==="ready")?{viewerId:review.viewerId,selection:{lines:review.lines.map(line=>({inventoryPublicId:line.inventoryPublicId,quantity:line.requestedQuantity})),fulfillment:review.fulfillment},expectedSubtotalCents:review.subtotalCents}:null;
  const inFlight=useRef(false),latest=useRef(terms);latest.current=terms;
  const ready=Boolean(terms);
  const send=async()=>{
    if(inFlight.current||!terms||checking||!consent)return;
    const snapshot=terms;inFlight.current=true;setBusy(true);setError("");
    try{
      const candidate=jwStonePurchaseRequestSchema.parse({operationId:crypto.randomUUID(),selection:snapshot.selection,expectedSubtotalCents:snapshot.expectedSubtotalCents,termsAcknowledged:true});
      const digest=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(JSON.stringify(canonicalJwStonePurchase(candidate))));
      const fingerprint=Array.from(new Uint8Array(digest),byte=>byte.toString(16).padStart(2,"0")).join("");
      const key="tradescout:jw-stone:purchase-action:v1:"+snapshot.viewerId;
      const raw=sessionStorage.getItem(key),previous=raw?retrySchema.parse(JSON.parse(raw)):null;
      if(previous&&previous.fingerprint!==fingerprint&&!previous.requestId)throw new Error("An earlier purchase request has an uncertain result. Restore that selection and retry it, or check Offers and Orders before starting a different request.");
      const operationId=previous?.fingerprint===fingerprint?previous.operationId:candidate.operationId;
      // Persist only an opaque action ID and digest, never material prices or payment details.
      sessionStorage.setItem(key,JSON.stringify({fingerprint,operationId,...(previous?.fingerprint===fingerprint&&previous.requestId?{requestId:previous.requestId}:{})}));
      const result=responseSchema.parse(await apiRequest(JW_STONE_PURCHASE_PATH,{method:"POST",data:{...candidate,operationId}}));
      if(latest.current?.viewerId!==snapshot.viewerId)return;
      sessionStorage.setItem(key,JSON.stringify({fingerprint,operationId,requestId:result.requestId}));
      setSaved(result.requestId);setConsent(false);
    }catch(cause){setError(cause instanceof Error?cause.message:"The purchase request could not be confirmed. Retry the same selection or check Offers and Orders.");}
    finally{inFlight.current=false;setBusy(false);}
  };
  return <section className="mt-4 border-t border-[var(--jw-border)] pt-3" aria-label={reserved?"Purchase your reserved slabs":"Purchase at listed material prices"} data-testid="jw-purchase-start">
    <button type="button" disabled={!ready||checking||busy} onClick={()=>{setOpen(value=>!value);setError("");}} aria-expanded={open} className="min-h-11 w-full bg-[var(--jw-accent)] px-3 text-sm font-semibold text-[var(--jw-on-accent)] disabled:opacity-50" data-testid="jw-purchase-open">{reserved?"Buy these reserved slabs":"Buy at listed prices"}</button>
    {!ready?<p className="mt-2 text-xs">Choose exact available slabs and check the cart total to continue. Make an Offer remains a separate option.</p>:null}
    {open?<div className="mt-3 space-y-3">
      <p className="text-sm">{JW_STONE_PURCHASE_TERMS}</p>
      <p className="text-sm font-semibold">Material total: {new Intl.NumberFormat("en-US",{style:"currency",currency:"USD"}).format((terms?.expectedSubtotalCents||0)/100)}</p>
      <p className="text-xs">Your selections stay in the cart. A matching active reservation stays protected and moves into the order only when you approve payment.</p>
      {saved?<p role="status" className="text-sm">Purchase request saved. <a className="underline" href={JW_STONE_ORDERS_PAGE+"?request="+encodeURIComponent(saved)}>Open purchase and final quote</a></p>:<>
        <label className="flex items-start gap-2 text-sm"><input type="checkbox" checked={consent} disabled={busy} onChange={event=>setConsent(event.target.checked)} className="mt-1 h-5 w-5 shrink-0" />Send my purchase request at these material prices; I will review the final total before paying.</label>
        <button type="button" disabled={!consent||busy||checking||!ready} onClick={()=>void send()} className="min-h-11 w-full border border-[var(--jw-accent)] px-3 text-sm font-semibold disabled:opacity-50" data-testid="jw-purchase-submit">{busy?"Saving purchase request…":"Request final checkout total"}</button>
      </>}
      {error?<p role="alert" className="break-words text-sm">{error}</p>:null}
      <a className="inline-block min-h-11 py-2 text-sm underline" href={JW_STONE_ORDERS_PAGE}>View offers and orders</a>
    </div>:null}
  </section>;
}
