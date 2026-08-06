import { describe, expect, it } from "vitest";
import { isValidDirectConnectRequestPhone } from "@shared/directConnectPhone";
import { hasDirectConnectPhone, normalizeDirectConnectPhone } from "../services/directConnectPhone";

describe("Direct Connect gated phone authority", () => {
  it("normalizes a valid US number only after the Direct Connect call decision", () => {
    expect(normalizeDirectConnectPhone("(985) 555-0123")).toEqual({
      display: "(985) 555-0123",
      tel: "tel:+19855550123",
    });
    expect(hasDirectConnectPhone("985-555-0123")).toBe(true);
    expect(isValidDirectConnectRequestPhone("985-555-0123")).toBe(true);
  });

  it.each(["", "   ", "555-0123", "1234567890123456", null, undefined])(
    "rejects a non-callable routing value: %s",
    (value) => {
      expect(normalizeDirectConnectPhone(value)).toBeNull();
      expect(hasDirectConnectPhone(value)).toBe(false);
      expect(isValidDirectConnectRequestPhone(value)).toBe(false);
    }
  );
});
