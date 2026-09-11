/** Disposable native-PostgreSQL proof: actual Express routes, password auth and cookies.
 * Run with NODE_ENV=test, TEST_DATABASE_URL naming ts_operator_test, and
 * OPERATOR_HTTP_PROOF=true. No provider credentials or production targets are retained.
 */
import assert from "node:assert/strict";
import { access, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";

assert.equal(process.env.NODE_ENV, "test");
assert.equal(process.env.OPERATOR_HTTP_PROOF, "true");
const target = new URL(process.env.TEST_DATABASE_URL || "");
assert.equal(target.hostname, "127.0.0.1");
assert.equal(target.pathname, "/ts_operator_test");
const preserve = new Set([
  "PATH",
  "Path",
  "SystemRoot",
  "SYSTEMROOT",
  "WINDIR",
  "TEMP",
  "TMP",
  "COMSPEC",
  "USERPROFILE",
  "APPDATA",
  "LOCALAPPDATA",
  "PROGRAMFILES",
  "PROGRAMFILES(X86)",
  "NODE_ENV",
  "TEST_DATABASE_URL",
  "OPERATOR_HTTP_PROOF",
  "OPERATOR_PROOF_OUTPUT",
  "OPERATOR_PROOF_BUILT_CLIENT",
]);
for (const key of Object.keys(process.env)) if (!preserve.has(key)) delete process.env[key];
// Do not allow a repository .env file to reintroduce provider or production credentials.
const { default: dotenv } = await import("dotenv");
dotenv.config = dotenv.configDotenv = () => ({ parsed: {} });
process.env.SESSION_SECRET = "synthetic-operator-proof-session-only";
process.env.EMAIL_MODE = "account_creation_only";
process.env.DISABLE_FACEBOOK_AUTH = "true";
process.env.DIRECT_CONNECT_BETA_ADMIN_NOTIFICATIONS = "false";
process.env.PORT = "5218";
process.env.PUBLIC_WEB_URL = "http://127.0.0.1:5218";
const output = path.resolve(
  process.env.OPERATOR_PROOF_OUTPUT || "test-results/operator-http-proof"
);
await mkdir(output, { recursive: true });
const { db, pool } = await import("../server/db");
assert.equal(
  (await pool.query("SELECT current_database() AS name")).rows[0].name,
  "ts_operator_test"
);
const schema = await import("../shared/schema");
const { default: bcrypt } = await import("bcrypt");
const runId = randomUUID().slice(0, 8);
const password = `SyntheticOnly-${runId}!`;
const identities = Object.fromEntries(
  ["requester", "operator", "provider", "unrelated", "ordinary-admin"].map((kind) => [
    kind,
    {
      id: `operator-proof-${runId}-${kind}`,
      email: `operator-proof-${runId}-${kind}@example.test`,
      role:
        kind === "operator"
          ? "ops_admin"
          : kind === "provider"
            ? "contractor"
            : kind === "ordinary-admin"
              ? "admin"
              : "homeowner",
    },
  ])
);
const passwordHash = await bcrypt.hash(password, 10);
for (const [kind, account] of Object.entries(identities)) {
  await db.insert(schema.users).values({
    ...account,
    password: passwordHash,
    firstName: `Synthetic ${kind}`,
    lastName: "Fixture",
    phone: "2025550147",
    roles: [account.role],
    activeRole: account.role,
    stateCode: "FL",
    countyFips: "12001",
    addressVerified: true,
    emailVerified: true,
    verificationStatus: "approved",
    verifiedBadge: true,
    onboardingCompleted: true,
    profileVersion: 1,
    locationCommitted: true,
  });
}
await db
  .insert(schema.states)
  .values({ id: "FL", name: "Florida", code: "FL" })
  .onConflictDoNothing();
await db
  .insert(schema.counties)
  .values({ id: "operator-proof-alachua", name: "Alachua", fips: "12001", stateCode: "FL" })
  .onConflictDoNothing();
const county = (await pool.query("SELECT id FROM counties WHERE fips = '12001'")).rows[0];
const providerId = `operator-proof-${runId}-contractor-profile`;
const [business] = await db
  .insert(schema.businesses)
  .values({
    name: "Synthetic County Installer",
    slug: `operator-proof-${runId}`,
    ownerUserId: identities.provider.id,
    roleContext: "business_owner",
    type: "contractor",
    status: "active",
    claimStatus: "claimed",
    publicDiscoveryEnabled: true,
  })
  .returning();
await db.insert(schema.contractors).values({
  id: providerId,
  userId: identities.provider.id,
  businessId: business.id,
  companyName: "Synthetic County Installer",
  slug: `operator-proof-${runId}`,
  verifiedLicensed: true,
  verifiedInsured: true,
});
await db
  .insert(schema.contractorCounties)
  .values({ contractorId: providerId, countyId: county.id });
await db.insert(schema.profiles).values({
  ownerUserId: identities.provider.id,
  businessId: business.id,
  roleContext: "contractor",
  slug: `operator-proof-${runId}`,
  displayName: "Synthetic County Installer",
  status: "published",
  publiclyReleased: true,
  headline: "Synthetic local route fixture",
});

const { default: express } = await import("express");
const { registerRoutes } = await import("../server/routes");
const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
const server = await registerRoutes(app);
if (process.env.OPERATOR_PROOF_BUILT_CLIENT === "true") {
  const distPath = path.resolve("dist/public");
  await access(path.join(distPath, "index.html"));
  app.use(express.static(distPath));
  app.get("*", (req, res, next) => {
    if (req.path.startsWith("/api/")) return next();
    res.sendFile(path.join(distPath, "index.html"));
  });
} else {
  const { setupVite } = await import("../server/vite");
  await setupVite(app, server);
}
await new Promise<void>((resolve) => server.listen(5218, "127.0.0.1", resolve));
const privateState = { runId, password, identities, providerId, baseUrl: "http://127.0.0.1:5218" };
await writeFile(path.join(output, "fixture.private.json"), JSON.stringify(privateState, null, 2));
console.log(`OPERATOR_HTTP_READY ${runId} http://127.0.0.1:5218`);
