// Test-only process: requires an explicitly owned loopback database and private fixture config.
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { randomUUID, createHash } from "node:crypto";
import { spawn, spawnSync } from "node:child_process";

assert.equal(process.env.NODE_ENV, "test");
assert.equal(process.env.EXCHANGE_STONE_NATIVE_FIXTURE, "true");
const output = path.resolve(process.env.EXCHANGE_STONE_NATIVE_PRIVATE || "");
assert(output !== process.cwd());
const config = JSON.parse(await fs.readFile(path.join(output, "configuration.json"), "utf8"));
assert.equal(config.token, process.env.EXCHANGE_STONE_NATIVE_TOKEN);
const url = new URL(config.databaseUrl);
assert.equal(url.hostname, "127.0.0.1");
assert.equal(url.pathname, "/ts_exchange_stone_test");
assert.equal(url.searchParams.get("sslmode"), "disable");
assert.equal([...url.searchParams.keys()].length, 1);
const port = Number(process.env.EXCHANGE_STONE_NATIVE_PORT);
assert([5241, 5242].includes(port));
const setup = process.env.EXCHANGE_STONE_NATIVE_SETUP === "true";
const keep = new Set(["PATH", "HOME", "TMPDIR", "TZ"]);
for (const key of Object.keys(process.env)) if (!keep.has(key)) delete process.env[key];
const { default: dotenv } = await import("dotenv");
dotenv.config = dotenv.configDotenv = () => ({ parsed: {} });
const base = `http://127.0.0.1:${port}`;
Object.assign(process.env, {
  NODE_ENV: "test", DATABASE_URL: url.href, TEST_DATABASE_URL: url.href,
  ALLOW_INSECURE_TEST_DATABASE: "true", SESSION_SECRET: config.sessionSecret,
  STONE_METRICS_SECRET: config.metricsSecret, PORT: String(port), PUBLIC_WEB_URL: base,
  EMAIL_MODE: "account_creation_only", DISABLE_FACEBOOK_AUTH: "true",
  SCHEDULER_ENABLED: "false", DISABLE_CRAWLER: "true",
  UPLOAD_DIR: path.join(output, "uploads"), PRIVATE_UPLOAD_DIR: path.join(output, "private-uploads"),
  SCOUT_CACHE_DIR: path.join(output, "scout-cache"),
});
const { db, pool } = await import("../server/db");
assert.equal((await pool.query("SELECT current_database() AS name")).rows[0].name, "ts_exchange_stone_test");

if (setup) {
  const schema = await import("../shared/schema");
  const { default: bcrypt } = await import("bcrypt");
  for (const [state, name, county, fips] of [["TX", "Texas", "Dallas", "48113"], ["FL", "Florida", "Escambia", "12033"]]) {
    await db.insert(schema.states).values({ id: state, name, code: state }).onConflictDoNothing();
    await db.insert(schema.counties).values({ id: `stone-test-${fips}`, name: county, fips, stateCode: state }).onConflictDoNothing();
  }
  const accounts: Record<string, any> = {};
  for (const kind of ["seller", "desktop", "touch", "parallel", "excluded"]) {
    const id = `stone-native-${kind}-${randomUUID()}`;
    const password = `Disposable-${randomUUID()}`;
    const florida = kind === "seller" || kind === "excluded";
    const email = `${id}@example.test`;
    await db.insert(schema.users).values({ id, email, password: await bcrypt.hash(password, 10),
      firstName: kind === "seller" ? "TradeScout" : "Native", lastName: kind,
      role: "homeowner", roles: ["homeowner"], activeRole: "homeowner",
      state: florida ? "FL" : "TX", stateCode: florida ? "FL" : "TX",
      city: florida ? "Pensacola" : "Dallas", county: florida ? "Escambia" : "Dallas",
      countyFips: florida ? "12033" : "48113", addressVerified: true, emailVerified: true,
      verificationStatus: "approved", onboardingCompleted: true, profileVersion: 1, locationCommitted: true });
    accounts[kind] = { id, email, password };
  }
  const sellerId = accounts.seller.id, profileId = randomUUID(), categoryId = randomUUID();
  await db.insert(schema.marketplaceCategories).values({ id: categoryId, name: "Building Materials & Surfaces", description: "Disposable stone test category", iconName: "Layers", isActive: true });
  await db.insert(schema.profiles).values({ id: profileId, ownerUserId: sellerId, roleContext: "homeowner", slug: "stone-native-tradescout", displayName: "TradeScout", status: "published" });
  await pool.query("INSERT INTO site_settings(category,key,value,is_active) VALUES('general','exchange_stone_retail_seller_user_id',$1::jsonb,true)", [JSON.stringify(sellerId)]);
  const { default: sharp } = await import("sharp");
  const bytes = await sharp({ create: { width: 400, height: 300, channels: 3, background: "#dadada" } }).webp({ lossless: true }).toBuffer();
  const digest = createHash("sha256").update(bytes).digest("hex");
  const source = JSON.parse(await fs.readFile("scripts/data/exchange-stone-homeowner-approval-20260921.json", "utf8"));
  const examples = [
    { id: "tradescout-stone-matrix-basalt", name: "Matrix Basalt", material: "basalt", referenceSizesInches: "126x78, 127x77.5" },
    { id: "tradescout-stone-calacatta-fumo", name: "Calacatta Fumo", material: "engineered quartz", referenceSizesInches: "137.5x79" },
    { id: "tradescout-stone-alabama-white", name: "Alabama White", material: "marble", referenceSizesInches: "123x70, 117x73, 118x72, 125.5x70, 126x71, 120x75, 121x69, 121x73, 115x57, 100x65.5, 101x65, 98x65, 118.5x71, 120x62, 120x68, 122x67, 127x74" },
  ];
  const mediaRoot = path.join(output, "synthetic-media");
  const timestamp = new Date(Date.now() - 1000).toISOString();
  const items: any[] = [], approvals: any[] = [];
  for (const example of examples) {
    const media = { status: "reviewed", sha256: digest, sourceSha256: digest, file: `${example.id}/${digest}.webp`, reviewedBy: "synthetic-native-fixture", reviewedAt: timestamp };
    await fs.mkdir(path.join(mediaRoot, example.id), { recursive: true });
    await fs.writeFile(path.join(mediaRoot, media.file), bytes);
    items.push({ ...example, media });
    const approved = source.prices.find((entry: any) => entry.id === example.id);
    assert(approved);
    approvals.push({ ...approved, status: "approved", unit: "sqft", approvedBy: "synthetic-native-fixture", approvedAt: timestamp });
  }
  const catalogPath = path.join(output, "catalog.json"), approvalPath = path.join(output, "approvals.json");
  await fs.writeFile(catalogPath, JSON.stringify({ version: 1, items }));
  await fs.writeFile(approvalPath, JSON.stringify(approvals));
  const args = ["dist/release/import-exchange-stone.mjs", `--catalog=${catalogPath}`, `--approvals=${approvalPath}`, `--media-root=${mediaRoot}`, "--expected-host=127.0.0.1", "--expected-database=ts_exchange_stone_test", `--seller-user-id=${sellerId}`, `--profile-id=${profileId}`];
  const parse = (text: string) => { const start = text.indexOf("{\n"); assert(start >= 0, text.slice(-600)); return JSON.parse(text.slice(start)); };
  const dry = spawnSync(process.execPath, args, { encoding: "utf8", env: process.env, timeout: 60000 });
  assert.equal(dry.status, 0, `Compiled importer dry run failed: ${dry.stderr}`);
  const plan = parse(dry.stdout);
  assert.equal(plan.eligible, 3);
  assert.equal(Number((await pool.query("SELECT count(*) AS n FROM marketplace_listings WHERE seller_id=$1", [sellerId])).rows[0].n), 0);
  const applyArgs = [...args, "--apply", `--expected-plan=${plan.planHash}`];
  const apply = () => new Promise<{ status: number | null; stdout: string; stderr: string }>((resolve, reject) => {
    const child = spawn(process.execPath, applyArgs, { env: process.env, stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "", stderr = "";
    child.stdout.on("data", data => { stdout += data; }); child.stderr.on("data", data => { stderr += data; });
    const timer = setTimeout(() => child.kill("SIGKILL"), 60000);
    child.once("error", reject); child.once("exit", status => { clearTimeout(timer); resolve({ status, stdout, stderr }); });
  });
  const first = await Promise.all([apply(), apply(), apply()]);
  assert(first.some(result => result.status === 0), "No native import process succeeded");
  // Serializable contenders may require a retry. The identical approved plan must then reconcile.
  const replay = await apply(); assert.equal(replay.status, 0, replay.stderr);
  assert.equal(parse(replay.stdout).inserted, 0); assert.equal(parse(replay.stdout).unchanged, 3);
  assert.equal(Number((await pool.query("SELECT count(*) AS n FROM marketplace_listings WHERE seller_id=$1", [sellerId])).rows[0].n), 3);
  assert.equal(Number((await pool.query("SELECT count(*) AS n FROM public_media_objects WHERE object_key LIKE 'public-media/images/exchange/stone/%'")).rows[0].n), 3);
  const { readExchangeStoneCatalog, readExchangeStonePhoto } = await import("../server/services/exchangeStoneCatalogReader");
  const read = await readExchangeStoneCatalog(); assert.equal(read.items.length, 3);
  // Complete but deliberately nonfunctional R2 configuration must not switch retail reads away from the importer's database.
  Object.assign(process.env, { R2_ACCOUNT_ID: "test-only-no-network", R2_ACCESS_KEY_ID: "test", R2_SECRET_ACCESS_KEY: "test", R2_BUCKET_NAME: "test" });
  for (const item of items) assert((await readExchangeStonePhoto(item.id, digest))?.equals(bytes));
  for (const key of ["R2_ACCOUNT_ID", "R2_ACCESS_KEY_ID", "R2_SECRET_ACCESS_KEY", "R2_BUCKET_NAME"]) delete process.env[key];
  assert.equal(await readExchangeStonePhoto(items[0].id, "0".repeat(64)), null);
  const info = { base, accounts, ids: items.map(item => item.id), digest, importer: { dryRunEligible: plan.eligible, firstProcessExitCodes: first.map(result => result.status), replay: parse(replay.stdout), rows: 3, photos: 3, mediaProviderIsolation: true } };
  await fs.writeFile(path.join(output, "fixture.json"), JSON.stringify(info), { mode: 0o600 });
  console.log("STONE_NATIVE_IMPORT_PASSED");
}

const { default: express } = await import("express");
const { registerRoutes } = await import("../server/routes");
const app = express();
app.use(express.json()); app.use(express.urlencoded({ extended: false }));
const server = await registerRoutes(app);
app.use(express.static(path.resolve("dist/public")));
app.get("*", (req, res, next) => req.path.startsWith("/api/") ? next() : res.sendFile(path.resolve("dist/public/index.html")));
await new Promise<void>(resolve => server.listen(port, "127.0.0.1", resolve));
process.send?.({ ready: true, base });
console.log("STONE_NATIVE_APPLICATION_READY " + base);
