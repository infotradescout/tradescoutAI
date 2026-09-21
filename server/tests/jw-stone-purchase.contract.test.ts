import { describe, expect, it } from "vitest";
import { canonicalJwStonePurchase, jwStonePurchaseRequestSchema, jwStonePurchaseIntakeSchema } from "@shared/jwStonePurchase";
import { jwStoneSaleCommandSchema } from "@shared/jwStoneCheckout";
const uuid="cdbf742c-e8cb-4b31-bd3b-4e37b99ae1a4";
const a="stone_"+"a".repeat(32),b="stone_"+"b".repeat(32);
const request=()=>({operationId:uuid,selection:{lines:[{inventoryPublicId:b,quantity:4},{inventoryPublicId:a,quantity:3}]},expectedSubtotalCents:122500,termsAcknowledged:true as const});

describe("JW Stone purchase intent",()=>{
  it("accepts checked material prices without requiring an offered amount or payment method",()=>{
    const parsed=jwStonePurchaseRequestSchema.parse(request());
    expect(parsed).not.toHaveProperty("offeredTotalCents");expect(parsed).not.toHaveProperty("method");
  });
  it.each([{termsAcknowledged:false},{termsAcknowledged:undefined},{expectedSubtotalCents:0},{expectedSubtotalCents:0.5},{operationId:"not-a-uuid"},{offeredTotalCents:1},{taxCents:0},{paymentAllowed:true},{method:"card"}])("rejects missing consent or buyer-supplied authority: %j",change=>{
    expect(()=>jwStonePurchaseRequestSchema.parse({...request(),...change})).toThrow();
  });
  it("uses the same retry fingerprint input for reordered and combined duplicate stock",()=>{
    const first=jwStonePurchaseRequestSchema.parse(request());
    const second=jwStonePurchaseRequestSchema.parse({...request(),operationId:"65b784c9-37c4-48ce-b01d-ef1a41e3ab43",selection:{lines:[{inventoryPublicId:a,quantity:1},{inventoryPublicId:b,quantity:4},{inventoryPublicId:a,quantity:2}],fulfillment:{method:"pickup"}}});
    expect(canonicalJwStonePurchase(first)).toEqual(canonicalJwStonePurchase(second));
  });
  it("changed total and delivery choice are different purchase terms",()=>{
    const first=jwStonePurchaseRequestSchema.parse(request());
    expect(canonicalJwStonePurchase(first)).not.toEqual(canonicalJwStonePurchase({...first,expectedSubtotalCents:122501}));
    expect(canonicalJwStonePurchase(first)).not.toEqual(canonicalJwStonePurchase({...first,selection:{...first.selection,fulfillment:{method:"delivery",postalCode:"32501"}}}));
  });
  it("purchase confirmation is a separate seller decision and still needs all final amounts",()=>{
    const command={operationId:uuid,expectedRevision:0,action:"quote",decision:"confirm_purchase",materialCents:122500,taxCents:0,deliveryCents:0,expiresAt:"2026-09-30T12:00:00.000Z",notes:"Explicit seller final amounts"};
    expect(jwStoneSaleCommandSchema.parse(command).action).toBe("quote");
    expect(()=>jwStoneSaleCommandSchema.parse({...command,taxCents:undefined})).toThrow();
  });
  it("purchase intake does not retain an extra offered-total field",()=>{
    const parsed=jwStonePurchaseIntakeSchema.parse({intent:"purchase",pricingSource:"listed_prices",reservationId:null,scope:"stone",currency:"USD",status:"pending_review",paymentAllowed:false,inventoryReserved:false,listedSubtotalCents:10000,offeredTotalCents:1,fulfillment:{method:"pickup"},bundleApplied:false,lines:[{inventoryPublicId:a,materialName:"Synthetic",quantity:1,dimensions:{length:120,height:60,unit:"in"},unitRateCents:200,lineTotalCents:10000,pricingTier:"slab"}]});
    expect(parsed).not.toHaveProperty("offeredTotalCents");
  });
});
