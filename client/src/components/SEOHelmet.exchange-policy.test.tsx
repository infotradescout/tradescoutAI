import { describe, expect, it, vi } from "vitest";
vi.mock("wouter", () => ({ useLocation: () => ["/exchange", vi.fn()], useSearch: () => "" }));
import { publicExchangeDirectoryCanonical } from "./SEOHelmet";
import { EXCHANGE_CATEGORY_TO_MARKETPLACE_NAME } from "@shared/exchangeListingRules";

describe("Public Exchange directory indexability policy", () => {
  it.each(["", ...Object.keys(EXCHANGE_CATEGORY_TO_MARKETPLACE_NAME)])("canonical public category %s is not a paid-user or login-only directory", category => {
    const path = category ? `/exchange/${category}` : "/exchange";
    expect(publicExchangeDirectoryCanonical(path, "", "www.thetradescout.com")).toBe(`https://www.thetradescout.com${path}`);
    expect(publicExchangeDirectoryCanonical(path, "?page=3&utm_source=test", "www.thetradescout.com")).toBe(`https://www.thetradescout.com${path}?page=3`);
  });
  it.each(["/exchange/seller-dashboard", "/exchange/rental-equipment", "/exchange/tools/item-id", "/admin", "/messages", "/u/private-profile"])("does not override protected or separately owned metadata %s", path => {
    expect(publicExchangeDirectoryCanonical(path, "", "www.thetradescout.com")).toBeNull();
  });
  it.each(["?tab=mine", "?item=private-id", "?promo=private-id", "?companyPromo=private-id", "?page=0", "?page=one", "?page=1&page=2"])("does not promote action/invalid state %s", search => {
    expect(publicExchangeDirectoryCanonical("/exchange", search, "www.thetradescout.com")).toBeNull();
  });
  it("does not change a custom business domain's visibility", () => {
    expect(publicExchangeDirectoryCanonical("/exchange", "", "supplier.example")).toBeNull();
  });
});
