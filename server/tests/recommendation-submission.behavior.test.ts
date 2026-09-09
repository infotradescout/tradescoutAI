import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import express from "express";
import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { getTableConfig } from "drizzle-orm/pg-core";
import { eq } from "drizzle-orm";
import { contractors, contractorLeaderboardStats, recommendations, users } from "@shared/schema";
import { recommendationSubmissionSchema } from "@shared/recommendationSubmission";
import { createRecommendationRepository } from "../storage/repositories/recommendations";

const fixture = vi.hoisted(() => ({
  client: null as {
    exec: (query: string) => Promise<unknown>;
    close: () => Promise<unknown>;
  } | null,
  repository: null as ReturnType<typeof createRecommendationRepository> | null,
}));

vi.mock("../db", async () => {
  const connectionString = process.env.RECOMMENDATION_TEST_DATABASE_URL;
  if (connectionString) {
    const url = new URL(connectionString);
    if (
      !["localhost", "127.0.0.1"].includes(url.hostname) ||
      !url.pathname.startsWith("/test_recommendations_")
    ) {
      throw new Error(
        "Native recommendation proof requires its dedicated local disposable test database."
      );
    }
    const { Pool } = await import("pg");
    const { drizzle } = await import("drizzle-orm/node-postgres");
    const pool = new Pool({ connectionString, max: 8 });
    fixture.client = { exec: (query) => pool.query(query), close: () => pool.end() };
    return { db: drizzle(pool), pool };
  }
  const { PGlite } = await import("@electric-sql/pglite");
  const { drizzle } = await import("drizzle-orm/pglite");
  fixture.client = new PGlite();
  return {
    db: drizzle(fixture.client),
    pool: {
      query: (query: string, params?: unknown[]) => (fixture.client as any).query(query, params),
    },
  };
});
vi.mock("../storage", async () => {
  const { db } = await import("../db");
  const { users } = await import("@shared/schema");
  const { eq } = await import("drizzle-orm");
  return {
    storage: {
      createRecommendation: (input: any) => fixture.repository!.create(input),
      getMyContractorRecommendation: (contractorId: string, userId: string) =>
        fixture.repository!.mine(contractorId, userId),
      getContractorRecommendations: (contractorId: string, options: any) =>
        fixture.repository!.listPublic(contractorId, options),
      moderateContractorRecommendation: (
        id: string,
        action: "approve" | "reject",
        userId: string
      ) => fixture.repository!.moderate(id, action, userId),
      getUser: async (id: string) => (await db.select().from(users).where(eq(users.id, id)))[0],
    },
  };
});
vi.mock("../auth", () => ({
  isAuthenticated: (req: any, res: any, next: () => void) =>
    req.user?.id ? next() : res.status(401).json({ message: "Authentication required" }),
  requireRole: (allowed: string[]) => (req: any, res: any, next: () => void) =>
    allowed.includes(req.user?.role) ? next() : res.sendStatus(403),
}));

import { db, pool } from "../db";
import { verifyRequiredProductionSchema } from "../../scripts/check-required-production-schema.mjs";
import { registerRecommendationRoutes } from "../routes/recommendations";
import { registerContractorLeaderboardRoutes } from "../routes/contractor-leaderboards";
import { SocialAndLeaderboardStorageRepository } from "../storage/repositories/social-and-leaderboards";

const app = express();
app.use(express.json());
// Test-only proxy setting supplies distinct synthetic IPs to the real limiter.
app.set("trust proxy", true);
app.use((req, _res, next) => {
  const id = req.get("x-fixture-user");
  if (id)
    req.user = {
      id,
      claims: { sub: "unbound-session-subject" },
      role: id === "admin" ? "super_admin" : "homeowner",
      email: "stale-session@example.invalid",
      emailVerified: true,
      firstName: "Untrusted session name",
      onboardingCompleted: false,
    } as any;
  next();
});
registerRecommendationRoutes(app);
const leaderboardStorage = new SocialAndLeaderboardStorageRepository();
registerContractorLeaderboardRoutes(app, leaderboardStorage);

const quote = (name: string) => `"${name.replaceAll('"', '""')}"`;
const path = "/api/contractors/business/recommendations";
const content = (overrides: Record<string, unknown> = {}) => ({
  submissionId: randomUUID(),
  recommendationType: "positive",
  comment: "Careful, clean work at our home.",
  ...overrides,
});
const submit = (payload = content(), userId = "author", target = path) =>
  request(app)
    .post(target)
    .set("x-fixture-user", userId)
    .set("x-forwarded-for", "192.0.2.10")
    .send(payload);
const moderate = (id: string, action = "approve", userId = "admin") =>
  request(app)
    .patch(`/api/admin/recommendations/${id}/moderate`)
    .set("x-fixture-user", userId)
    .send({ action });

beforeAll(async () => {
  // Real SQL, transactions and advisory-lock calls on an in-memory PostgreSQL
  // projection. PGlite serializes connections; this is not multi-process proof.
  const types: Record<string, string> = {
    boolean: "boolean",
    number: "double precision",
    json: "jsonb",
    date: "timestamp",
    array: "text[]",
  };
  for (const table of [users, contractors, recommendations, contractorLeaderboardStats]) {
    const config = getTableConfig(table);
    const columns = config.columns.map((column) => {
      const suffix =
        column.name === "id"
          ? " PRIMARY KEY DEFAULT gen_random_uuid()"
          : ["created_at", "updated_at"].includes(column.name)
            ? " DEFAULT now()"
            : "";
      const type = column.columnType === "PgNumeric" ? "numeric" : types[column.dataType] || "text";
      return `${quote(column.name)} ${type}${suffix}`;
    });
    await fixture.client!.exec(
      `CREATE TABLE IF NOT EXISTS ${quote(config.name)} (${columns.join(", ")})`
    );
  }
  await fixture.client!.exec(
    readFileSync("migrations/0138_recommendation_publication_projection.sql", "utf8")
  );
  fixture.repository = createRecommendationRepository(db);
}, 30_000);

beforeEach(async () => {
  await fixture.client!.exec(
    "TRUNCATE users, contractors, recommendations, contractor_leaderboard_stats"
  );
  await db.insert(users).values([
    {
      id: "author",
      email: "Author@Example.invalid",
      emailVerified: false,
      firstName: "Actual",
      lastName: "Author",
      onboardingCompleted: false,
    },
    {
      id: "verified",
      email: "verified@example.invalid",
      emailVerified: true,
      firstName: "Verified",
    },
    { id: "owner", email: "owner@example.invalid", emailVerified: true },
    { id: "admin", email: "admin@example.invalid", emailVerified: true },
  ]);
  await db.insert(contractors).values({
    id: "business",
    userId: "owner",
    companyName: "Synthetic county business",
    isActive: true,
    totalRecommendations: 0,
    positiveRecommendations: 0,
    negativeRecommendations: 0,
  });
});

afterAll(async () => {
  await fixture.client?.close();
});

describe("recommendation content validation", () => {
  it("accepts content without contact fields or default quality claims", () => {
    const parsed = recommendationSubmissionSchema.parse(
      content({ projectType: " ", projectValue: "", workQuality: "", timeliness: null })
    );
    expect(parsed).toMatchObject({ recommendationType: "positive" });
    expect(parsed.projectType).toBeUndefined();
    expect(parsed.projectValue).toBeUndefined();
    expect(parsed.workQuality).toBeUndefined();
    expect(parsed.timeliness).toBeUndefined();
    expect(recommendationSubmissionSchema.parse(content({ projectValue: 12 })).projectValue).toBe(
      "12.00"
    );
  });

  it.each([
    { comment: " " },
    { comment: "x".repeat(4001) },
    { recommendationType: "maybe" },
    { submissionId: "arbitrary-id" },
    { projectValue: "-1" },
    { workQuality: "perfect" },
    { customerEmail: "forged@example.invalid" },
    { userId: "another-user" },
    { isPublic: true },
  ])("rejects invalid content or caller-owned authority: %j", (override) => {
    expect(recommendationSubmissionSchema.safeParse(content(override)).success).toBe(false);
  });
});

describe("action-first recommendation saving", () => {
  it("rejects a stale tab's expected account before saving or returning another account's work", async () => {
    const stale = await submit().set("X-Expected-Account-Id", "verified");
    expect(stale.status).toBe(409);
    expect(stale.body.code).toBe("ACCOUNT_CHANGED");
    expect(await db.select().from(recommendations)).toHaveLength(0);
    const read = await request(app)
      .get(`${path}/mine`)
      .set("x-fixture-user", "author")
      .set("X-Expected-Account-Id", "verified");
    expect(read.status).toBe(409);
    expect(read.body.recommendation).toBeUndefined();
    expect((await submit().set("X-Expected-Account-Id", "author")).status).toBe(200);
  });

  it("requires sign-in for server persistence and has no anonymous write lane", async () => {
    expect((await request(app).post(path).send(content())).status).toBe(401);
    expect(await db.select().from(recommendations)).toHaveLength(0);
  });

  it("saves incomplete, unverified accounts privately from persisted identity", async () => {
    const result = await submit();
    expect(result.status).toBe(200);
    expect(result.body).toMatchObject({
      success: true,
      missingVerification: ["email"],
      recommendation: { moderationStatus: "pending", isVerified: false, isPublic: false },
    });
    const [row] = await db.select().from(recommendations);
    expect(row).toMatchObject({
      userId: "author",
      customerName: "Actual Author",
      customerEmail: "author@example.invalid",
      isVerified: false,
      verificationMethod: null,
      verifiedAt: null,
      moderationStatus: "pending",
      isPublic: false,
    });
    expect(row.workQuality).toBeNull();
    expect(row.wouldHireAgain).toBeNull();
    expect((await db.select().from(contractors))[0].totalRecommendations).toBe(0);
    expect((await request(app).get(path)).body).toEqual([]);
  });

  it.each([
    "userId",
    "customerName",
    "customerEmail",
    "isPublic",
    "isVerified",
    "moderationStatus",
    "verifiedAt",
    "moderatedBy",
  ])("rejects forged %s on both submission routes", async (field) => {
    expect((await submit(content({ [field]: "forged" }))).status).toBe(400);
    expect(
      (
        await submit(
          content({ contractorId: "business", [field]: "forged" }),
          "author",
          "/api/recommendations"
        )
      ).status
    ).toBe(400);
    expect(await db.select().from(recommendations)).toHaveLength(0);
  });

  it("uses one idempotent handler for both routes without publishing or incrementing totals", async () => {
    const payload = content({ projectValue: "100.00", workQuality: "good", wouldHireAgain: false });
    const first = await submit(payload);
    const second = await submit(
      { ...payload, contractorId: "business" },
      "author",
      "/api/recommendations"
    );
    expect([first.status, second.status]).toEqual([200, 200]);
    expect(first.body.recommendation.id).toBe(payload.submissionId);
    expect(second.body.recommendation.id).toBe(payload.submissionId);
    expect(await db.select().from(recommendations)).toHaveLength(1);
    expect((await db.select().from(contractors))[0].totalRecommendations).toBe(0);
    expect(
      (await submit({ ...payload, comment: "Changed content for the same submission." })).status
    ).toBe(409);
    const collision = await submit(payload, "verified");
    expect(collision.status).toBe(409);
    expect(collision.body.recommendation).toBeUndefined();
    expect((await db.select().from(recommendations))[0].comment).toBe(payload.comment);
  });

  it("rejects missing businesses and self-recommendations", async () => {
    expect(
      (await submit(content(), "author", "/api/contractors/missing/recommendations")).status
    ).toBe(404);
    expect((await submit(content(), "owner")).status).toBe(403);
    expect(await db.select().from(recommendations)).toHaveLength(0);
  });

  it("enforces the 30-day account and normalized email windows", async () => {
    expect((await submit()).status).toBe(200);
    expect((await submit()).body.code).toBe("DUPLICATE_RECOMMENDATION");
    await db
      .insert(users)
      .values({ id: "case-duplicate", email: "AUTHOR@example.invalid", emailVerified: false });
    expect((await submit(content(), "case-duplicate")).body.code).toBe("DUPLICATE_RECOMMENDATION");
    expect(await db.select().from(recommendations)).toHaveLength(1);
  });

  it("admits at most five simultaneous saves from an IP and safely retries accepted IDs", async () => {
    const payloads = Array.from({ length: 6 }, () => content());
    await db.insert(users).values(
      payloads.map((_, index) => ({
        id: `visitor-${index}`,
        email: `visitor-${index}@example.invalid`,
        emailVerified: false,
      }))
    );
    const results = await Promise.all(
      payloads.map((payload, index) => submit(payload, `visitor-${index}`))
    );
    expect(results.filter((result) => result.status === 200)).toHaveLength(5);
    expect(results.filter((result) => result.status === 429)).toHaveLength(1);
    expect(await db.select().from(recommendations)).toHaveLength(5);
    const accepted = results.findIndex((result) => result.status === 200);
    expect((await submit(payloads[accepted], `visitor-${accepted}`)).status).toBe(200);
  });

  it("resumes only the author's own saved work and refreshes email evidence without publishing", async () => {
    const saved = await submit();
    expect(
      (await request(app).get(`${path}/mine`).set("x-fixture-user", "verified")).body.recommendation
    ).toBeNull();
    expect(
      (await request(app).get(`${path}/mine`).set("x-fixture-user", "author")).body
        .missingVerification
    ).toEqual(["email"]);
    await db.update(users).set({ emailVerified: true }).where(eq(users.id, "author"));
    const resumed = await request(app).get(`${path}/mine`).set("x-fixture-user", "author");
    expect(resumed.body).toMatchObject({
      missingVerification: [],
      recommendation: {
        id: saved.body.recommendation.id,
        isVerified: true,
        isPublic: false,
        moderationStatus: "pending",
      },
    });
    expect((await request(app).get(path)).body).toEqual([]);
    expect((await db.select().from(contractors))[0].totalRecommendations).toBe(0);
  });
});

describe("verification and moderation publication boundary", () => {
  it("serializes simultaneous moderation and invalidates a disabled author's public totals", async () => {
    await db.update(users).set({ emailVerified: true }).where(eq(users.id, "author"));
    const [positive, negative] = await Promise.all([
      submit(content(), "author"),
      submit(content({ recommendationType: "negative" }), "verified"),
    ]);
    expect([positive.status, negative.status]).toEqual([200, 200]);
    const decisions = await Promise.all([
      moderate(positive.body.recommendation.id),
      moderate(negative.body.recommendation.id),
    ]);
    expect(decisions.map((result) => result.status)).toEqual([200, 200]);
    expect((await db.select().from(contractors))[0]).toMatchObject({
      positiveRecommendations: 1,
      negativeRecommendations: 1,
      totalRecommendations: 2,
      recommendationScore: "0",
    });
    expect((await request(app).get("/api/leaderboard/lifetime")).body[0]).toMatchObject({
      lifetimeRecommendations: 2,
      lifetimeScore: 0,
    });
    await fixture.client!.exec(
      "ALTER TABLE users ADD COLUMN IF NOT EXISTS is_active boolean DEFAULT true"
    );
    try {
      await fixture.client!.exec("UPDATE users SET is_active=false WHERE id='verified'");
      expect((await db.select().from(contractors))[0]).toMatchObject({
        positiveRecommendations: 1,
        negativeRecommendations: 0,
        totalRecommendations: 1,
      });
      expect((await request(app).get(path)).body).toHaveLength(1);
      expect((await request(app).get("/api/leaderboard/lifetime")).body[0]).toMatchObject({
        lifetimeRecommendations: 1,
      });
      expect((await moderate(negative.body.recommendation.id)).body.code).toBe(
        "EMAIL_VERIFICATION_REQUIRED"
      );
    } finally {
      await fixture.client!.exec("ALTER TABLE users DROP COLUMN is_active");
    }
  });

  it("verifies installed projection function bodies and fails closed on disabled or replaced guards", async () => {
    const projectionReady = async () => {
      let value: boolean | undefined;
      try {
        await verifyRequiredProductionSchema({
          query: async (query: string, parameters?: unknown[]) => {
            const result = await pool.query(query, parameters);
            if ("recommendation_publication_projection" in (result.rows[0] || {}))
              value = result.rows[0].recommendation_publication_projection;
            return result;
          },
        });
      } catch {
        // This fixture deliberately contains only the recommendation subsystem.
        // The full verifier also reports the unrelated tables absent here.
      }
      expect(typeof value).toBe("boolean");
      return value;
    };
    expect(await projectionReady()).toBe(true);
    try {
      await fixture.client!.exec(
        "ALTER TABLE recommendations DISABLE TRIGGER recommendation_publication_projection"
      );
      expect(await projectionReady()).toBe(false);
    } finally {
      await fixture.client!.exec(
        "ALTER TABLE recommendations ENABLE TRIGGER recommendation_publication_projection"
      );
    }
    try {
      await fixture.client!.exec(
        "CREATE OR REPLACE FUNCTION sync_recommendation_publication_projection() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RETURN NULL; END; $$;"
      );
      expect(await projectionReady()).toBe(false);
    } finally {
      await fixture.client!.exec(
        readFileSync("migrations/0138_recommendation_publication_projection.sql", "utf8")
      );
    }
    expect(await projectionReady()).toBe(true);
  });

  it("keeps public leaderboard endpoints and the legacy stats writer tied to publishable rows", async () => {
    const saved = await submit();
    await leaderboardStorage.updateContractorLeaderboardStats("business", 5);
    expect((await request(app).get("/api/leaderboard/monthly")).body).toEqual([]);
    expect((await request(app).get("/api/leaderboard/lifetime")).body).toEqual([]);
    await db.update(users).set({ emailVerified: true }).where(eq(users.id, "author"));
    expect((await moderate(saved.body.recommendation.id)).status).toBe(200);
    expect((await request(app).get("/api/leaderboard/monthly")).body[0]).toMatchObject({
      contractorId: "business",
      monthlyRecommendations: 1,
    });
    expect((await request(app).get("/api/leaderboard/lifetime")).body[0]).toMatchObject({
      contractorId: "business",
      lifetimeRecommendations: 1,
    });
    await db.update(users).set({ emailVerified: false }).where(eq(users.id, "author"));
    expect((await request(app).get("/api/leaderboard/monthly")).body).toEqual([]);
    expect((await request(app).get("/api/leaderboard/lifetime")).body).toEqual([]);
    expect((await request(app).get("/api/leaderboard/contractor/business")).body).toMatchObject({
      monthly: null,
      lifetime: null,
    });
  });

  it("backfills incorrect legacy cached counts from current verified publication evidence", async () => {
    await submit();
    await db
      .update(contractors)
      .set({ totalRecommendations: 42, positiveRecommendations: 42 })
      .where(eq(contractors.id, "business"));
    await db
      .insert(contractorLeaderboardStats)
      .values({ contractorId: "business", month: 1, year: 2020, lifetimeTotalRecommendations: 42 });
    await fixture.client!.exec(
      readFileSync("migrations/0138_recommendation_publication_projection.sql", "utf8")
    );
    expect((await db.select().from(contractors))[0].totalRecommendations).toBe(0);
    expect(await db.select().from(contractorLeaderboardStats)).toEqual([]);
  });

  it("blocks approval from stale stored evidence and permits rejection before email confirmation", async () => {
    const saved = await submit();
    const id = saved.body.recommendation.id;
    await db
      .update(recommendations)
      .set({ isVerified: true, verificationMethod: "admin" })
      .where(eq(recommendations.id, id));
    expect((await moderate(id)).body.code).toBe("EMAIL_VERIFICATION_REQUIRED");
    expect((await db.select().from(recommendations))[0].isPublic).toBe(false);
    expect((await moderate(id, "reject")).status).toBe(200);
    expect((await db.select().from(recommendations))[0].moderationStatus).toBe("rejected");
  });

  it("publishes only after confirmation plus moderation and recomputes totals on repeated decisions", async () => {
    const saved = await submit();
    const id = saved.body.recommendation.id;
    await db.update(users).set({ emailVerified: true }).where(eq(users.id, "author"));
    expect(await fixture.repository!.verifyPendingForUser("author")).toBe(true);
    expect((await request(app).get(path)).body).toEqual([]);
    expect((await moderate(id)).status).toBe(200);
    expect((await moderate(id)).status).toBe(200);
    const [published] = (await request(app).get(path)).body;
    expect(published).toMatchObject({ id, customerName: "Actual Author", isVerified: true });
    for (const privateField of [
      "userId",
      "customerEmail",
      "customerPhone",
      "ipAddress",
      "userAgent",
      "projectValue",
      "moderatedBy",
      "moderationStatus",
      "verificationMethod",
    ]) {
      expect(published).not.toHaveProperty(privateField);
    }
    expect((await db.select().from(contractors))[0]).toMatchObject({
      totalRecommendations: 1,
      positiveRecommendations: 1,
      negativeRecommendations: 0,
    });
    const [leaderboard] = await db.select().from(contractorLeaderboardStats);
    expect(leaderboard).toMatchObject({
      monthlyTotalRecommendations: 1,
      lifetimeTotalRecommendations: 1,
    });
    expect((await moderate(id, "reject")).status).toBe(200);
    expect((await request(app).get(path)).body).toEqual([]);
    expect((await db.select().from(contractors))[0].totalRecommendations).toBe(0);
    expect(await db.select().from(contractorLeaderboardStats)).toHaveLength(0);
  });

  it("withholds public rows and recalculated totals after confirmation is revoked or the account email changes", async () => {
    const saved = await submit(content(), "verified");
    expect((await moderate(saved.body.recommendation.id)).status).toBe(200);
    await db.update(users).set({ emailVerified: false }).where(eq(users.id, "verified"));
    expect((await request(app).get(path)).body).toEqual([]);
    const ownStatus = await request(app).get(`${path}/mine`).set("x-fixture-user", "verified");
    expect(ownStatus.body).toMatchObject({
      missingVerification: ["email"],
      recommendation: { isPublic: false, isVerified: false },
    });
    expect(ownStatus.body.message).not.toBe("Your recommendation is published.");
    expect((await db.select().from(contractors))[0].totalRecommendations).toBe(0);
    expect(await db.select().from(contractorLeaderboardStats)).toHaveLength(0);
    await db
      .update(users)
      .set({ emailVerified: true, email: "changed@example.invalid" })
      .where(eq(users.id, "verified"));
    expect((await request(app).get(path)).body).toEqual([]);
  });

  it("excludes private, pending and unverified rows even with other publication flags present", async () => {
    const saved = await submit(content(), "verified");
    const id = saved.body.recommendation.id;
    for (const flags of [
      { isPublic: false, moderationStatus: "approved", isVerified: true },
      { isPublic: true, moderationStatus: "pending", isVerified: true },
      { isPublic: true, moderationStatus: "approved", isVerified: false },
    ]) {
      await db.update(recommendations).set(flags).where(eq(recommendations.id, id));
      expect((await request(app).get(path)).body).toEqual([]);
      expect((await db.select().from(contractors))[0].totalRecommendations).toBe(0);
    }
  });

  it("protects moderation authority and reports the specific missing check to moderators", async () => {
    const saved = await submit();
    expect((await moderate(saved.body.recommendation.id, "approve", "author")).status).toBe(403);
    expect(
      (await request(app).get("/api/admin/recommendations/pending").set("x-fixture-user", "author"))
        .status
    ).toBe(403);
    const pending = await request(app)
      .get("/api/admin/recommendations/pending")
      .set("x-fixture-user", "admin");
    expect(pending.status).toBe(200);
    expect(pending.body[0]).toMatchObject({
      id: saved.body.recommendation.id,
      missingVerification: ["email"],
    });
    expect((await request(app).get(`${path}?limit=1000000`)).status).toBe(400);
  });
});
