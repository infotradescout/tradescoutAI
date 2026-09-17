import { describe, expect, it } from "vitest";
import { resolveScoutRequestCompletion, SCOUT_REQUEST_UNCONFIRMED_MESSAGE } from "./scoutRequestCompletion";
import { validateAction } from "./actionValidation";

const saved = { id: "request-123", status: "draft", countyFips: "12033" };

describe("Scout Direct Connect save receipt", () => {
  it.each([null, undefined, false, true, [], "saved", {}, { success: true },
    { authorized: true, executed: false }, { id: "request-123" }, { id: "", status: "draft" },
    { id: "../wrong", status: "draft" }, { ...saved, status: "queued" },
    { ...saved, success: false }, { ...saved, ok: false }, { ...saved, executed: false },
    { ...saved, verificationRequired: true }, { ...saved, id: "x".repeat(161) },
  ])("does not acknowledge an unconfirmed request: %j", (value) => {
    expect(() => resolveScoutRequestCompletion(value)).toThrow(SCOUT_REQUEST_UNCONFIRMED_MESSAGE);
  });

  it("links to the specific saved request in its county without sharing it", () => {
    const receipt = resolveScoutRequestCompletion(saved);
    expect(receipt.requestId).toBe("request-123");
    const destination = new URL(receipt.to, "https://example.invalid");
    expect(destination.pathname).toBe("/direct-connect/active");
    expect(Object.fromEntries(destination.searchParams)).toEqual({ selected: "request-123", filter: "all", county: "12033" });
    expect(receipt.acknowledgement).toBe("Saved. Review your request before sharing.");
    expect(validateAction({ type: "NAVIGATE", label: "Open saved request", to: receipt.to })?.to).toBe(receipt.to);
  });

  it.each(["open", "routed", "in_progress", "pending_outcome", "completed", "cancelled"])(
    "does not call an existing %s request an unshared draft", (status) => {
      const receipt = resolveScoutRequestCompletion({ ...saved, status });
      expect(receipt.acknowledgement).toBe("Your request is saved. Open it to review the current status.");
      expect(receipt.summary).not.toContain("before choosing to share");
    }
  );

  it("preserves county context when the receipt omits it", () => {
    expect(new URL(resolveScoutRequestCompletion({ id: "request-123", status: "draft" }, "12001").to,
      "https://example.invalid").searchParams.get("county")).toBe("12001");
  });

  it("never interpolates untrusted URL or contact information into an action", () => {
    const receipt = resolveScoutRequestCompletion({ ...saved, countyFips: "x&contact=private",
      to: "https://outside.invalid", phone: "private", internalNotes: "private" }, "12001");
    expect(receipt.to).not.toMatch(/outside|private|contact|county/);
    expect(Object.keys(receipt).sort()).toEqual(["acknowledgement", "replayed", "requestId", "status", "summary", "to"]);
  });
});
