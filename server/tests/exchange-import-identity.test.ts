import { describe, expect, it } from "vitest";
import { restorePrivateExchangeImportIdentity } from "../exchangeImportIdentity";
import { toPublicExchangeListing } from "../publicExchangeListing";
import { redactContactDetails } from "../utils/workRequestShare";

const fingerprint = "a123456789012" + "b".repeat(51);
const original = {
  externalListingId: "00123456789012",
  exchangeBatchFingerprint: fingerprint,
  sellerNote: "Call 555-234-6789 or owner@example.invalid",
};
const redacted = Object.fromEntries(
  Object.entries(original).map(([key, value]) => [key, redactContactDetails(value)])
);

describe("private Exchange import identity", () => {
  it("retains numeric identity and SHA-256 bytes after real contact redaction", () => {
    expect(redacted.externalListingId).toBe("[hidden]");
    expect(redacted.exchangeBatchFingerprint).not.toBe(fingerprint);
    expect(restorePrivateExchangeImportIdentity(original, redacted)).toEqual({
      ...original,
      sellerNote: "Call [hidden] or [hidden]",
    });
  });

  it("does not restore contact text, invalid digests or unrelated specifications", () => {
    const unsafe = {
      externalListingId: "owner@example.invalid",
      exchangeBatchFingerprint: "Call 555-234-6789",
      sellerNote: "555-234-6789",
    };
    const sanitized = Object.fromEntries(
      Object.entries(unsafe).map(([key, value]) => [key, redactContactDetails(value)])
    );
    expect(restorePrivateExchangeImportIdentity(unsafe, sanitized)).toEqual(sanitized);
    expect(restorePrivateExchangeImportIdentity(original, null)).toBeNull();
    expect(restorePrivateExchangeImportIdentity([], [])).toEqual([]);
  });

  it("normalizes valid keys without changing the original or sanitized objects", () => {
    const input = { ...original, externalListingId: "  ITEM_009  " };
    const safe = { ...redacted };
    const restored = restorePrivateExchangeImportIdentity(input, safe) as Record<string, unknown>;
    expect(restored.externalListingId).toBe("item_009");
    expect(input.externalListingId).toBe("  ITEM_009  ");
    expect(safe).toEqual(redacted);
  });

  it("excludes import metadata from every public structured listing field", () => {
    const identity = restorePrivateExchangeImportIdentity(original, redacted);
    const listing = toPublicExchangeListing({
      id: "oak-workbench",
      sellerId: "seller-1",
      status: "active",
      title: "Oak workbench",
      specifications: { ...(identity as object), finish: "Natural oak", nested: identity },
      shippingQuote: identity,
      valueGuidance: identity,
    });
    const encoded = JSON.stringify(listing);
    expect(encoded).not.toContain("externalListingId");
    expect(encoded).not.toContain("exchangeBatchFingerprint");
    expect(encoded).not.toContain(original.externalListingId);
    expect(encoded).not.toContain(fingerprint);
    expect(encoded).not.toContain("555-234-6789");
    expect(encoded).toContain("Natural oak");
  });
});
