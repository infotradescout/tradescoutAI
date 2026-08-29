import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const source = fs.readFileSync(
  path.resolve(process.cwd(), "server/services/paymentEventAuthority.ts"),
  "utf8"
);

describe("persisted payment event authority contract", () => {
  it("serializes immutable event and subject ownership before dispatch", () => {
    expect(source).toContain("pg_advisory_xact_lock");
    expect(source).toContain("from payment_provider_events");
    expect(source).toContain("for update");
    expect(source).toContain("PaymentEventIdentityConflictError");
    expect(source).toContain("PaymentProviderObjectConflictError");
    expect(source).toContain("insert into payment_money_observations");
    expect(source).toContain("reducePaymentMoneyState");
    expect(source).toContain("dispatch_claim_expires_at");
  });

  it("does not persist full provider payloads or mutable contact fields", () => {
    expect(source).not.toContain("JSON.stringify(event)");
    expect(source).not.toMatch(/customer_email|receipt_email|phone_number/);
    expect(source).toContain("payload_sha256");
    expect(source).toContain("alias_keys");
    expect(source).toContain("lookup_keys");
  });
});
