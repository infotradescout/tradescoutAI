import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(path, "utf8");

describe("JW Stone private-offer schema and runtime contracts", () => {
  const migration = read("migrations/0114_jw_stone_private_offers.sql");
  const journal = read("migrations/meta/_journal.json");
  const schema = read("shared/schema/jwStoneExpress.ts");
  const shared = read("shared/jwStoneExpress.ts");
  const routes = read("server/routes/jw-stone-express.ts");
  const admin = read("server/routes/admin-jw-stone-offers.ts");
  const outbox = read("server/jw-stone-express/outbox.ts");
  const security = read("server/jw-stone-express/security.ts");
  const appRoutes = read("server/routes.ts");

  it("journals migration 0114 and creates every isolated JW-owned table", () => {
    expect(journal).toContain('"tag": "0114_jw_stone_private_offers"');
    for (const table of [
      "jw_stone_express_accounts",
      "jw_stone_express_sessions",
      "jw_stone_express_account_tokens",
      "jw_stone_containers",
      "jw_stone_offer_settings",
      "jw_stone_private_offers",
      "jw_stone_private_offer_versions",
      "jw_stone_offer_events",
      "jw_stone_idempotency_receipts",
      "jw_stone_email_outbox",
      "jw_stone_email_outbox_attempts",
    ]) {
      expect(migration).toContain(`CREATE TABLE "${table}"`);
      expect(schema).toContain(`"${table}"`);
    }
  });

  it("does not attach JW customer identity or offers to TradeScout users", () => {
    expect(migration).not.toMatch(/REFERENCES\s+"?users"?/i);
    expect(schema).not.toMatch(/references\(\(\)\s*=>\s*users\./i);
    expect(schema).not.toContain("userId:");
    expect(security).toContain("JW_STONE_EXPRESS_COOKIE_NAME_PRODUCTION");
    expect(security).toContain('sameSite: "lax"');
    expect(security).toContain("httpOnly: true");
    expect(security).toContain('secure: process.env.NODE_ENV === "production"');
  });

  it("keeps offer versions and events immutable with database-enforced current ownership", () => {
    expect(migration).toContain("jw_stone_private_offer_versions_immutable_guard");
    expect(migration).toContain("jw_stone_offer_events_immutable_guard");
    expect(migration).toContain("jw_stone_private_offers_current_version_guard");
    expect(migration).toContain("DEFERRABLE INITIALLY DEFERRED");
    expect(migration).toContain("jw_stone_private_offers_owner_check");
    expect(migration).toContain("jw_stone_express_accounts_active_identity_check");
    expect(schema).toContain("jw_stone_express_accounts_active_identity_check");
  });

  it("uses exact-cent validation without browser-incompatible Buffer access", () => {
    expect(shared).toContain("parseJwStoneUsdToCents");
    expect(shared).toContain("new TextEncoder().encode(value).byteLength");
    expect(shared).not.toContain("Buffer.byteLength");
    expect(shared).toContain("Use an HTTPS or safe root-relative image URL.");
  });

  it("registers separate public, requester, and restricted operator routes", () => {
    expect(appRoutes).toContain(
      'import { registerJwStoneExpressRoutes } from "./routes/jw-stone-express"'
    );
    expect(appRoutes).toContain("registerJwStoneExpressRoutes(app)");
    expect(routes).toContain('"/api/jw-stone/containers"');
    expect(routes).toContain('"/api/jw-stone/offer-targets/resolve"');
    expect(routes).toContain('"/api/jw-stone/express/register"');
    expect(routes).toContain('"/api/jw-stone/express/offers"');
    expect(routes).toContain("registerAdminJwStoneOfferRoutes(app)");
    expect(admin).toContain('const base = "/api/admin/jw-stone/offers"');
    expect(admin).toContain("lower(slug) = 'jw-stone'");
    expect(admin).toContain('role === "ops_admin" || role === "super_admin"');
  });

  it("keeps sealed offers private and enforces container order on the server", () => {
    expect(admin).toContain("v.state <> 'pending_verification'");
    expect(admin).toContain("maskJwStoneEmail");
    expect(admin).toContain("maskJwStonePhone");
    expect(admin).toContain("contact_revealed_after_review_decision");
    expect(admin).toContain("order by v.amount_cents desc, v.submitted_at asc, o.id asc");
    expect(admin).toContain("A higher-priority eligible offer must be resolved first.");
    expect(admin).not.toMatch(/outbid|competing offer|bid count/i);
  });

  it("claims durable notification work with the sealed retry schedule", () => {
    expect(outbox).toContain("for update skip locked");
    expect(outbox).toContain("JW_STONE_OUTBOX_RETRY_DELAYS_MS");
    expect(outbox).toContain("attempt_count = attempt_count + 1");
    expect(outbox).toContain("emailService.sendEmail");
    expect(outbox).toContain('name: "JW Stone"');
    expect(outbox).toContain("result.skipped");
    expect(outbox).toContain("workerTimer.unref?.()");
    expect(security).toContain('algorithm: "aes-256-gcm"');
  });
});
