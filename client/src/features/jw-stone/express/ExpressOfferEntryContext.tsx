import { createContext, useContext, useMemo, type ReactNode } from "react";
import type { JwStoneCatalogItem } from "../types";

type ExpressOfferEntryValue = Readonly<{
  canMakeOffer: (stone: JwStoneCatalogItem) => boolean;
  makeOffer: (stone: JwStoneCatalogItem) => void;
}>;

const ExpressOfferEntryContext = createContext<ExpressOfferEntryValue | null>(null);

export function ExpressOfferEntryProvider({
  children,
  canMakeOffer,
  makeOffer,
}: ExpressOfferEntryValue & Readonly<{ children: ReactNode }>) {
  const value = useMemo(() => ({ canMakeOffer, makeOffer }), [canMakeOffer, makeOffer]);
  return (
    <ExpressOfferEntryContext.Provider value={value}>{children}</ExpressOfferEntryContext.Provider>
  );
}

export function useExpressOfferEntry(): ExpressOfferEntryValue | null {
  return useContext(ExpressOfferEntryContext);
}
