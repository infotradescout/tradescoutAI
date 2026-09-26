import { useQuery } from "@tanstack/react-query";
import { JW_STONE_CART_HOLD_PATH, jwStoneCartHoldReceiptSchema } from "@shared/jwStoneCartHolds";
import { parseJwStoneCartHoldRecovery } from "@shared/jwStoneCartHoldRecovery";
import { apiRequest } from "@/lib/queryClient";
import { JW_STONE_BRAND_STYLE } from "./brand";
import JwStonePurchaseStart from "./JwStonePurchaseStart";

/** Share the existing owned-status observer. Priced purchase controls independently
 * require the member-only receipt; revoked owners still retain the separate release UI.
 */
export default function JwStoneReservedPurchase({viewerId}:{viewerId:string}) {
  const owned=useQuery({
    queryKey:["jw-stone","owned-hold-status",viewerId],
    queryFn:async({signal})=>{
      const requestStartedAt=performance.now();
      return {...parseJwStoneCartHoldRecovery(await apiRequest(JW_STONE_CART_HOLD_PATH+"/active",{signal}),viewerId),requestStartedAt};
    },
    enabled:Boolean(viewerId),retry:false,staleTime:0,gcTime:0,refetchOnWindowFocus:"always",refetchInterval:30000,
  });
  const hold=owned.data?.viewerId===viewerId&&owned.data.hold?.status==="active"?owned.data.hold:null;
  const receipt=useQuery({
    queryKey:["jw-stone","reserved-purchase-receipt",viewerId,hold?.reservationId],
    queryFn:async({signal})=>{
      const value=jwStoneCartHoldReceiptSchema.parse(await apiRequest(JW_STONE_CART_HOLD_PATH+"/"+hold!.reservationId,{signal}));
      if(value.reservationId!==hold!.reservationId)throw new Error("The reservation changed. Refresh before purchasing.");
      return value;
    },
    enabled:Boolean(hold),retry:false,staleTime:0,gcTime:0,refetchOnWindowFocus:"always",refetchInterval:hold?30000:false,
  });
  if(!hold)return null;
  if(receipt.isError){
    const status=(receipt.error as {status?:number})?.status;
    if(status===401||status===403)return null;
    return <div className="mx-auto max-w-[1600px] px-4 py-3 sm:px-9" role="status"><p>Purchase pricing could not be confirmed. Your existing reservation can still be managed above.</p><button type="button" className="min-h-11 px-3 underline" onClick={()=>void receipt.refetch()}>Retry reserved purchase pricing</button></div>;
  }
  if(!receipt.data||receipt.data.status!=="active")return null;
  return <div style={JW_STONE_BRAND_STYLE} data-testid="jw-reserved-purchase" className="mx-auto max-w-[1600px] px-4 pb-4 text-[var(--jw-ink)] sm:px-9">
    <JwStonePurchaseStart key={viewerId+":"+receipt.data.reservationId} reserved={{viewerId,receipt:receipt.data}} checking={owned.isFetching||receipt.isFetching}/>
  </div>;
}
