import crypto from "node:crypto";
import dotenv from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

const { Client } = pg;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.join(__dirname, "..");

dotenv.config({ path: path.join(repoRoot, ".env.local") });
dotenv.config({ path: path.join(repoRoot, ".env") });

const SOURCE = "google_places_new_textsearch";
const PLACES_ENDPOINT = "https://places.googleapis.com/v1/places:searchText";

function requiredEnv(name) {
  const value = String(process.env[name] || "").trim();
  if (!value) {
    throw new Error(`Missing ${name}`);
  }
  return value;
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function normalizeTerms(raw) {
  return String(raw || "")
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);
}

function normalizeCountyFips(seedCountyRaw) {
  const raw = String(seedCountyRaw || "").trim();
  if (/^\d{5}$/.test(raw)) return raw;
  return "";
}

function normalizeSlugBase(name) {
  const raw = String(name || "")
    .trim()
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 90);
  return raw || "business";
}

function makeSlug(base, placeId) {
  const suffix = crypto.createHash("sha1").update(String(placeId || "")).digest("hex").slice(0, 8);
  const merged = `${base}-${suffix}`;
  return merged.length > 120 ? merged.slice(0, 120) : merged;
}

async function fetchJsonWithRetry(url, init, opts) {
  const maxAttempts = Math.max(1, Number(opts?.maxAttempts ?? 6) || 6);
  const baseDelayMs = Math.max(250, Number(opts?.baseDelayMs ?? 750) || 750);

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const controller = new AbortController();
    const timeoutMs = Math.max(5_000, Number(opts?.timeoutMs ?? 20_000) || 20_000);
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(url, { ...init, signal: controller.signal });
      const text = await res.text();
      const json = text ? JSON.parse(text) : null;

      if (res.ok) return json;

      const status = res.status;
      const retryable = status === 429 || (status >= 500 && status <= 599);
      if (!retryable || attempt === maxAttempts) {
        const msg = json?.error?.message || json?.message || text || `HTTP ${status}`;
        throw new Error(`Places API error (${status}): ${msg}`);
      }

      const jitter = Math.floor(Math.random() * 250);
      const backoff = baseDelayMs * Math.pow(2, attempt - 1) + jitter;
      await sleep(backoff);
    } finally {
      clearTimeout(timer);
    }
  }

  throw new Error("unreachable");
}

async function ensureSeedRun(client, { seedRunId, locationText, countyFips, stateCode, terms }) {
  if (seedRunId) {
    const { rows } = await client.query(
      `select id from business_seed_runs where id = $1 limit 1`,
      [seedRunId]
    );
    if (rows?.[0]?.id) return String(rows[0].id);
  }

  const { rows } = await client.query(
    `
      insert into business_seed_runs (
        source, location_text, county_fips, state_code, terms, status
      ) values ($1,$2,$3,$4,$5,'running')
      returning id
    `,
    [SOURCE, locationText, countyFips || null, stateCode || null, JSON.stringify(terms)]
  );
  return String(rows[0].id);
}

async function logSeedRun(client, seedRunId, level, message) {
  try {
    await client.query(
      `insert into business_seed_run_logs (seed_run_id, level, message) values ($1,$2,$3)`,
      [seedRunId, level, String(message || "").slice(0, 20_000)]
    );
  } catch {
    // Best-effort logging: never fail the run on log insert.
  }
}

async function resolveOrCreateCountyId(client, { countyFips, countyName, stateCode }) {
  if (!countyFips || !/^\d{5}$/.test(countyFips)) {
    throw new Error(
      "SEED_COUNTY must be a 5-digit county FIPS (e.g., 12033). For now, seeding is county-containered."
    );
  }
  if (!/^[A-Z]{2}$/.test(stateCode || "")) {
    throw new Error("SEED_STATE must be a 2-letter state code (e.g., FL).");
  }

  const existing = await client.query(
    `select id from counties where fips = $1 and state_code = $2 limit 1`,
    [countyFips, stateCode]
  );
  if (existing.rows?.[0]?.id) return String(existing.rows[0].id);

  // Ensure state exists (counties.state_code references states.code).
  await client.query(
    `
      insert into states (id, name, code)
      values (gen_random_uuid()::text, $1, $2)
      on conflict (code) do nothing
    `,
    [stateCode, stateCode]
  );

  const safeName = String(countyName || `County ${countyFips}`).slice(0, 120);
  const inserted = await client.query(
    `
      insert into counties (id, name, fips, state_code, population)
      values (gen_random_uuid()::text, $1, $2, $3, null)
      returning id
    `,
    [safeName, countyFips, stateCode]
  );
  return String(inserted.rows[0].id);
}

async function upsertUnclaimedBusinessFromPlace(client, { place, countyId, seedRunId }) {
  const placeId = String(place?.placeId || "").trim();
  if (!placeId) return { status: "skipped", reason: "missing_place_id" };

  const displayName = place?.displayName?.text;
  const name = String(displayName || "").trim();
  if (!name) return { status: "skipped", reason: "missing_name" };

  const existingRef = await client.query(
    `
      select business_id as "businessId"
      from business_external_refs
      where source = $1 and external_id = $2
      limit 1
    `,
    [SOURCE, placeId]
  );
  if (existingRef.rows?.[0]?.businessId) {
    return { status: "duplicate", businessId: String(existingRef.rows[0].businessId) };
  }

  const category = Array.isArray(place?.types) && place.types.length ? String(place.types[0]) : null;
  const phone = place?.nationalPhoneNumber ? String(place.nationalPhoneNumber) : null;
  const website = place?.websiteUri ? String(place.websiteUri) : null;
  const formattedAddress = place?.formattedAddress ? String(place.formattedAddress) : null;

  const slugBase = normalizeSlugBase(name);
  const slug = makeSlug(slugBase, placeId);

  const profileData = {
    ...(category ? { category } : {}),
    ...(website ? { website } : {}),
    ...(phone ? { phone } : {}),
    // Keep the address as importExtras to avoid exposing it publicly until claimed/verified.
    importExtras: {
      seed_run_id: seedRunId,
      places_formatted_address: formattedAddress || "",
      places_place_id: placeId,
      places_types: Array.isArray(place?.types) ? place.types.slice(0, 10) : [],
    },
    contactPreference: "message",
  };

  const insertBusiness = await client.query(
    `
      insert into businesses (
        id, name, slug, type, owner_user_id, role_context, profile_data, claim_status, sources, status
      ) values (
        gen_random_uuid()::text,
        $1,
        $2,
        'contractor',
        null,
        'contractor',
        $3::jsonb,
        'unclaimed',
        $4::jsonb,
        'active'
      )
      returning id
    `,
    [name, slug, JSON.stringify(profileData), JSON.stringify([SOURCE])]
  );
  const businessId = String(insertBusiness.rows[0].id);

  await client.query(
    `
      insert into business_external_refs (id, business_id, source, external_id)
      values (gen_random_uuid()::text, $1, $2, $3)
      on conflict (source, external_id) do nothing
    `,
    [businessId, SOURCE, placeId]
  );

  await client.query(
    `
      insert into business_counties (id, business_id, county_id)
      values (gen_random_uuid()::text, $1, $2)
      on conflict (business_id, county_id) do nothing
    `,
    [businessId, countyId]
  );

  return { status: "inserted", businessId };
}

async function main() {
  const databaseUrl = requiredEnv("DATABASE_URL");
  const apiKey = requiredEnv("GOOGLE_PLACES_API_KEY");
  const seedLocation = requiredEnv("SEED_LOCATION");
  const seedTerms = normalizeTerms(requiredEnv("SEED_TERMS"));
  const seedCountyRaw = requiredEnv("SEED_COUNTY");
  const seedCountyFips = normalizeCountyFips(seedCountyRaw);
  const seedCountyName = !seedCountyFips ? seedCountyRaw : "";
  const seedState = requiredEnv("SEED_STATE").toUpperCase();
  const delayMs = Math.max(0, Number(process.env.SEED_DELAY_MS ?? "1500") || 1500);
  const seedRunIdEnv = String(process.env.SEED_RUN_ID || "").trim();

  const client = new Client({ connectionString: databaseUrl });
  await client.connect();

  let seedRunId = "";
  const totals = { inserted: 0, duplicates: 0, errors: 0, skipped: 0 };
  try {
    seedRunId = await ensureSeedRun(client, {
      seedRunId: seedRunIdEnv || null,
      locationText: seedLocation,
      countyFips: seedCountyFips || null,
      stateCode: seedState,
      terms: seedTerms,
    });

    await logSeedRun(client, seedRunId, "info", `Starting seed: ${seedTerms.length} term(s)`);

    const countyId = await resolveOrCreateCountyId(client, {
      countyFips: seedCountyFips,
      countyName: seedCountyName,
      stateCode: seedState,
    });

    for (const term of seedTerms) {
      const textQuery = `${term} in ${seedLocation}`;
      await logSeedRun(client, seedRunId, "info", `Text Search: ${textQuery}`);

      let pageToken = "";
      let page = 0;
      while (true) {
        if (page > 0) {
          await sleep(delayMs);
        }

        const url = new URL(PLACES_ENDPOINT);
        if (pageToken) {
          url.searchParams.set("pageToken", pageToken);
        }

        const body = {
          textQuery,
          pageSize: 20,
        };

        const json = await fetchJsonWithRetry(url.toString(), {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Goog-Api-Key": apiKey,
            // Places API (New) requires FieldMask to control payload/cost.
            "X-Goog-FieldMask":
              "places.placeId,places.displayName,places.formattedAddress,places.location,places.types,places.nationalPhoneNumber,places.websiteUri,nextPageToken",
          },
          body: JSON.stringify(body),
        });

        const places = Array.isArray(json?.places) ? json.places : [];
        for (const place of places) {
          try {
            const result = await upsertUnclaimedBusinessFromPlace(client, {
              place,
              countyId,
              seedRunId,
            });
            if (result.status === "inserted") totals.inserted += 1;
            else if (result.status === "duplicate") totals.duplicates += 1;
            else totals.skipped += 1;
          } catch (e) {
            totals.errors += 1;
            await logSeedRun(
              client,
              seedRunId,
              "error",
              `Insert failed: ${e instanceof Error ? e.message : String(e)}`
            );
          }
        }

        page += 1;
        pageToken = String(json?.nextPageToken || "").trim();
        if (!pageToken) break;

        // Backoff: nextPageToken may take a short delay before becoming valid.
        await sleep(delayMs);
      }
    }

    await client.query(
      `
        update business_seed_runs
        set status = 'succeeded',
            inserted_count = $2,
            duplicate_count = $3,
            error_count = $4,
            finished_at = now(),
            updated_at = now()
        where id = $1
      `,
      [seedRunId, totals.inserted, totals.duplicates, totals.errors]
    );

    await logSeedRun(
      client,
      seedRunId,
      "info",
      `Completed: inserted=${totals.inserted} duplicates=${totals.duplicates} errors=${totals.errors} skipped=${totals.skipped}`
    );

    console.log(
      JSON.stringify(
        {
          seedRunId,
          totals,
        },
        null,
        2
      )
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (seedRunId) {
      await logSeedRun(client, seedRunId, "error", message);
      await client.query(
        `
          update business_seed_runs
          set status = 'failed',
              inserted_count = $2,
              duplicate_count = $3,
              error_count = $4,
              error_message = $5,
              finished_at = now(),
              updated_at = now()
          where id = $1
        `,
        [seedRunId, totals.inserted, totals.duplicates, totals.errors + 1, message]
      );
    }
    console.error(message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

main();

