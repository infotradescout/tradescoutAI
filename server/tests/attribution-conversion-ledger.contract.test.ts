import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

function read(relativePath: string): string {
  return fs.readFileSync(path.resolve(process.cwd(), relativePath), "utf8");
}

describe("attribution conversion ledger contract", () => {
  it("keeps conversion ledger payout/payment values hard-false", () => {
    const source = read("server/utils/attributionConversionLedger.ts");

    expect(source).toContain("payoutEligible: false");
    expect(source).toContain("payoutCalculated: false");
    expect(source).toContain("paymentTriggered: false");
    expect(source).toContain("FORBIDDEN_PAYOUT_FIELDS");
  });

  it("limits supported conversion types to the approved P7 list", () => {
    const source = read("server/utils/attributionConversionLedger.ts");

    expect(source).toContain('"signup_completed"');
    expect(source).toContain('"claim_started"');
    expect(source).toContain('"request_created"');
    expect(source).toContain('"profile_contact_clicked"');
    expect(source).toContain('"booking_request_started"');
  });

  it("registers the conversion ledger route and does not import stripe logic", () => {
    const routes = read("server/routes.ts");
    const helperSource = read("server/utils/attributionConversionLedger.ts").toLowerCase();

    expect(routes).toContain('app.post("/api/affiliate/attribution/conversions"');
    expect(helperSource).not.toContain("stripe");
    expect(helperSource).not.toContain("paymentintent");
    expect(helperSource).not.toContain("affiliatepayouts");
  });
});
