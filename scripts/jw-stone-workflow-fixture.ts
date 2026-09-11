import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";

// No customer records or provider credentials may enter this fixture.
assert.equal(process.env.NODE_ENV, "test");
assert.equal(process.env.JW_WORKFLOW_FIXTURE, "true");
const databaseUrl = new URL(process.env.TEST_DATABASE_URL || "");
assert.equal(databaseUrl.hostname, "127.0.0.1");
assert.equal(databaseUrl.pathname, "/ts_jw_workflow_test");
const output = path.resolve(process.env.JW_WORKFLOW_PRIVATE_OUTPUT || "test-results/jw-workflow-private");
const keep = new Set(["PATH", "HOME", "TMPDIR", "NODE_ENV", "TEST_DATABASE_URL", "JW_WORKFLOW_FIXTURE"]);
for (const key of Object.keys(process.env)) if (!keep.has(key)) delete process.env[key];
const { default: dotenv } = await import("dotenv");
dotenv.config = dotenv.configDotenv = () => ({ parsed: {} });
process.env.DATABASE_URL = databaseUrl.href;
process.env.ALLOW_INSECURE_TEST_DATABASE = "true";
process.env.SESSION_SECRET = randomUUID() + randomUUID();
process.env.PORT = "5228";
process.env.PUBLIC_WEB_URL = "http://127.0.0.1:5228";
process.env.EMAIL_MODE = "account_creation_only";
process.env.DISABLE_FACEBOOK_AUTH = "true";

// The real source validator receives invented test rates, never the owner's workbook.
const { JW_STONE_PRICING_DRIVE_FILE_ID, JW_STONE_PRICING_DRIVE_FOLDER_ID, jwStonePriceKey } = await import("../shared/jwStoneMemberPricing");
const now = new Date().toISOString();
process.env.JW_STONE_PRICING_SOURCE = "approved_import";
process.env.JW_STONE_PRICING_APPROVED_IMPORT = JSON.stringify({
  schemaVersion: 1, fileId: JW_STONE_PRICING_DRIVE_FILE_ID, folderId: JW_STONE_PRICING_DRIVE_FOLDER_ID,
  sourceUpdatedAt: now, sourceRetrievedAt: now,
  prices: [{ stoneName: "Honey Onyx", stoneKey: jwStonePriceKey("Honey Onyx"), landedCostCents: 4040, slabPriceCents: 10101, bundlePriceCents: 9090, bundleMinSlabs: 2 }],
});
const { db, pool } = await import("../server/db");
assert.equal((await pool.query("SELECT current_database() AS name")).rows[0].name, "ts_jw_workflow_test");
const schema = await import("../shared/schema");
const { default: bcrypt } = await import("bcrypt");
const ownerId = "jw-fixture-owner-" + randomUUID();
await db.insert(schema.users).values({
  id: ownerId, email: ownerId + "@example.test", password: await bcrypt.hash(randomUUID(), 10),
  firstName: "Synthetic", lastName: "Supplier", role: "contractor", roles: ["contractor"], activeRole: "contractor",
  phone: "2025550147", stateCode: "FL", countyFips: "12001", addressVerified: true, emailVerified: true,
  verificationStatus: "approved", verifiedBadge: true, onboardingCompleted: true, profileVersion: 1, locationCommitted: true,
});
await db.insert(schema.states).values({ id: "FL", name: "Florida", code: "FL" }).onConflictDoNothing();
await db.insert(schema.counties).values({ id: "jw-fixture-alachua", name: "Alachua", fips: "12001", stateCode: "FL" }).onConflictDoNothing();
const [business] = await db.insert(schema.businesses).values({
  name: "Synthetic JW Supplier", slug: "jw-fixture-supplier", ownerUserId: ownerId,
  roleContext: "business_owner", type: "contractor", status: "active", claimStatus: "claimed", publicDiscoveryEnabled: true,
}).returning();
const [profile] = await db.insert(schema.profiles).values({
  ownerUserId: ownerId, businessId: business.id, roleContext: "contractor", slug: "jw-stone",
  displayName: "JW Stone Logistics", status: "published", publiclyReleased: true,
  headline: "Synthetic isolated supplier fixture; not public stock or pricing",
  contentBlocks: [],
}).returning();
const { default: express } = await import("express");
const { registerRoutes } = await import("../server/routes");
const app = express();
app.use(express.json()); app.use(express.urlencoded({ extended: false }));
const server = await registerRoutes(app);
const dist = path.resolve("dist/public");
await fs.access(path.join(dist, "index.html"));
app.use(express.static(dist));
app.get("*", (req, res, next) => req.path.startsWith("/api/") ? next() : res.sendFile(path.join(dist, "index.html")));
await new Promise<void>(resolve => server.listen(5228, "127.0.0.1", resolve));
await fs.mkdir(output, { recursive: true });
await fs.writeFile(path.join(output, "fixture.json"), JSON.stringify({ ownerId, businessId: business.id, profileId: profile.id, base: "http://127.0.0.1:5228" }), { mode: 0o600 });
console.log("JW_WORKFLOW_READY");
