import { describe, expect, it, beforeEach } from "vitest";
import { scoutcoinService } from "../services/scoutcoinService";

describe("ScoutCoin architecture guards", () => {
  beforeEach(() => {
    scoutcoinService.resetForTests();
  });

  it("cannot buy when disabled", () => {
    scoutcoinService.setKycStatus("u1", "verified");
    scoutcoinService.setPriceConfig({
      providerConfigured: true,
      enabled: true,
      sourceType: "mock",
    });
    expect(() => scoutcoinService.buy("u1", 10)).toThrow("scoutcoin is disabled");
  });

  it("cannot transact without KYC", () => {
    scoutcoinService.setTokenStatus("testnet");
    scoutcoinService.setPriceConfig({
      providerConfigured: true,
      enabled: true,
      sourceType: "mock",
    });
    expect(() => scoutcoinService.buy("u1", 10)).toThrow("kyc required before buy");
    scoutcoinService.setKycStatus("u1", "verified");
    scoutcoinService.buy("u1", 10);
    scoutcoinService.setKycStatus("u1", "unverified");
    expect(() => scoutcoinService.send("u1", "u2", 1)).toThrow("kyc required before send");
  });

  it("frozen wallet cannot transact", () => {
    scoutcoinService.setTokenStatus("testnet");
    scoutcoinService.setPriceConfig({
      providerConfigured: true,
      enabled: true,
      sourceType: "mock",
    });
    scoutcoinService.setKycStatus("u1", "verified");
    scoutcoinService.freezeWallet("u1", true, "admin_1", "risk hold");
    expect(() => scoutcoinService.buy("u1", 5)).toThrow("wallet is frozen");
  });

  it("every movement is audited", () => {
    scoutcoinService.setTokenStatus("testnet");
    scoutcoinService.setPriceConfig({
      providerConfigured: true,
      enabled: true,
      sourceType: "mock",
    });
    scoutcoinService.setKycStatus("sender", "verified");
    scoutcoinService.setKycStatus("receiver", "verified");

    scoutcoinService.buy("sender", 20);
    scoutcoinService.send("sender", "receiver", 4);
    scoutcoinService.redeem("sender", 2, "trade_scout_perk");
    scoutcoinService.refund("sender", 1, "manual correction");

    const audit = scoutcoinService.getAuditLog(200);
    const movementEvents = audit.filter((entry) => entry.eventType === "scoutcoin_ledger_movement");
    expect(movementEvents.length).toBeGreaterThanOrEqual(5);
  });
});
