export const TRADESCOUT_MANAGED_CONTACT = {
  label: "TradeScout managed contact",
  phone: "(850) 543-0748",
  tel: "+18505430748",
  email: "contact@thetradescout.com",
  description: "Calls and messages from this profile are handled through TradeScout.",
} as const;

export function createTradeScoutManagedContact<Heading extends string>(heading: Heading) {
  return {
    ...TRADESCOUT_MANAGED_CONTACT,
    heading,
  } as const;
}
