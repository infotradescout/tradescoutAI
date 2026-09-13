import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";

assert.equal(process.env.NODE_ENV, "test");
assert.equal(process.env.EXCHANGE_BATCH_NATIVE_FIXTURE, "true");
const databaseUrl = new URL(process.env.TEST_DATABASE_URL || "");
assert.equal(databaseUrl.hostname, "127.0.0.1");
assert.equal(databaseUrl.pathname, "/ts_exchange_batch_test");
const output = path.resolve(process.env.EXCHANGE_BATCH_PRIVATE_OUTPUT || "");
assert(output && output !== process.cwd());
const port = 5241;
const base = `http://127.0.0.1:${port}`;
const keep = new Set([
  "PATH",
  "HOME",
  "TMPDIR",
  "NODE_ENV",
  "TEST_DATABASE_URL",
  "EXCHANGE_BATCH_NATIVE_FIXTURE",
]);
for (const key of Object.keys(process.env)) if (!keep.has(key)) delete process.env[key];
const { default: dotenv } = await import("dotenv");
dotenv.config = dotenv.configDotenv = () => ({ parsed: {} });
Object.assign(process.env, {
  DATABASE_URL: databaseUrl.href,
  ALLOW_INSECURE_TEST_DATABASE: "true",
  SESSION_SECRET: randomUUID() + randomUUID(),
  PORT: String(port),
  PUBLIC_WEB_URL: base,
  EMAIL_MODE: "account_creation_only",
  DISABLE_FACEBOOK_AUTH: "true",
  SCHEDULER_ENABLED: "false",
  DISABLE_CRAWLER: "true",
  UPLOAD_DIR: path.join(output, "uploads"),
  PRIVATE_UPLOAD_DIR: path.join(output, "private-uploads"),
  SCOUT_CACHE_DIR: path.join(output, "scout-cache"),
});
const { db, pool } = await import("../server/db");
assert.equal(
  (await pool.query("SELECT current_database() AS name")).rows[0].name,
  "ts_exchange_batch_test"
);
const schema = await import("../shared/schema");
const { default: bcrypt } = await import("bcrypt");
await db
  .insert(schema.states)
  .values({ id: "FL", name: "Florida", code: "FL" })
  .onConflictDoNothing();
await db
  .insert(schema.counties)
  .values({ id: "batch-fixture-escambia", name: "Escambia", fips: "12033", stateCode: "FL" })
  .onConflictDoNothing();
const accounts: Record<string, { id: string; email: string; password: string }> = {};
for (const name of ["desktop", "touch", "unverified"]) {
  const id = `batch-fixture-${name}-${randomUUID()}`;
  const password = `Disposable-${randomUUID()}`;
  const email = `${id}@example.test`;
  await db.insert(schema.users).values({
    id,
    email,
    password: await bcrypt.hash(password, 10),
    firstName: "Batch",
    lastName: "Seller",
    role: "homeowner",
    roles: ["homeowner"],
    activeRole: "homeowner",
    state: "FL",
    stateCode: "FL",
    county: "Escambia",
    countyFips: "12033",
    addressVerified: name !== "unverified",
    emailVerified: true,
    verificationStatus: name === "unverified" ? "pending" : "approved",
    onboardingCompleted: true,
    profileVersion: 1,
    locationCommitted: true,
  });
  if (name !== "unverified")
    await db.insert(schema.buyerVerifications).values({
      userId: id,
      status: "approved",
      addressVerified: true,
      identityVerified: true,
      isOver18: true,
      isOver21: true,
    } as any);
  accounts[name] = { id, email, password };
}
const { storage } = await import("../server/storage");
for (const name of ["Tools & Hardware", "Furniture & Home Goods"]) {
  const found = (await storage.getMarketplaceCategories()).find(
    (category: any) => category.name === name
  );
  if (!found)
    await db.insert(schema.marketplaceCategories).values({
      name,
      description: "Disposable browser fixture category",
      iconName: "tools",
    } as any);
}
const { runSchemaPreflight } = await import("../server/schemaPreflight");
await runSchemaPreflight();
const { default: express } = await import("express");
const { registerRoutes } = await import("../server/routes");
const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
const server = await registerRoutes(app);
app.use("/uploads", express.static(path.join(output, "uploads")));
app.use(express.static(path.resolve("dist/public")));
app.get("*", (req, res, next) =>
  req.path.startsWith("/api/") ? next() : res.sendFile(path.resolve("dist/public/index.html"))
);
await new Promise<void>((resolve) => server.listen(port, "127.0.0.1", resolve));
await fs.mkdir(output, { recursive: true });
await fs.writeFile(path.join(output, "fixture.json"), JSON.stringify({ base, accounts }), {
  mode: 0o600,
});
console.log("EXCHANGE_BATCH_NATIVE_READY");
