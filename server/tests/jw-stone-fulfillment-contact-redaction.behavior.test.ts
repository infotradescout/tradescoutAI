import { describe, expect, it } from "vitest";
import {
  EMPTY_FULFILLMENT_DETAILS,
  fulfillmentDetailsSummary,
} from "../../client/src/features/jw-stone/fulfillmentDetails";
import { redactContactDetails } from "../utils/workRequestShare";

// Exercise the actual request redactor, not a mock or a copy of its regex.
// The customer-facing calendar day must survive without granting contact access.
describe("JW Stone fulfillment summary through contact redaction", () => {
  const dates = [
    ["2026-09-23", "September 23, 2026"],
    ["2028-02-29", "February 29, 2028"],
    ["2026-12-31", "December 31, 2026"],
  ] as const;

  for (const method of ["pickup", "delivery"] as const) {
    it.each(dates)(`retains the requested ${method} calendar day %s`, (requestedDate, expectedDate) => {
      const summary = fulfillmentDetailsSummary({ ...EMPTY_FULFILLMENT_DETAILS, requestedDate }, method).join("\n");
      expect(summary).toContain(`Requested ${method} date: ${expectedDate}`);
      expect(summary).toContain("preference only; JW Stone must confirm");
      expect(redactContactDetails(summary)).toBe(summary);
      expect(redactContactDetails(summary)).not.toContain("[hidden]");
    });
  }

  it("still removes actual phone numbers and email addresses from customer notes", () => {
    const summary = fulfillmentDetailsSummary({
      ...EMPTY_FULFILLMENT_DETAILS,
      requestedDate: "2026-09-23",
      notes: "Call +1 (202) 555-0147 or email customer@example.test before arrival.",
    }, "delivery").join("\n");
    const privateRequestDescription = redactContactDetails(summary);
    expect(privateRequestDescription).toContain("September 23, 2026");
    expect(privateRequestDescription).not.toContain("202) 555-0147");
    expect(privateRequestDescription).not.toContain("customer@example.test");
    expect(privateRequestDescription).toContain("Call [hidden] or email [hidden]");
  });

  it("does not globally exempt numeric date-like strings from the contact gate", () => {
    expect(redactContactDetails("Numeric input: 2026-09-23")).toBe("Numeric input: [hidden]");
    expect(redactContactDetails("Phone: 202-555-0147")).toBe("Phone: [hidden]");
  });

  it("does not turn unspecified delivery requirements into a rate or appointment", () => {
    const summary = redactContactDetails(fulfillmentDetailsSummary(EMPTY_FULFILLMENT_DETAILS, "delivery").join("\n"));
    expect(summary).toContain("Requested delivery timing: flexible");
    expect(summary).toContain("Not specified; please confirm requirements");
    expect(summary).not.toMatch(/\$|free shipping|guaranteed|delivery confirmed/i);
  });
});
