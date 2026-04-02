import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { and, eq, gte, sql } from "drizzle-orm";
import { counties, observationSources, observations, states } from "@shared/schema";

const RUN_ID = `obs-${Date.now()}`;
const TEST_STATE_ID = `${RUN_ID}-state`;
const TEST_STATE_CODE = "ZZ";
const TEST_COUNTY_FIPS = "99001";
const hasTestDb = Boolean(process.env.TEST_DATABASE_URL);
const describeWithDb = hasTestDb ? describe : describe.skip;
let db!: (typeof import("../db"))["db"];

describeWithDb("Canonical Observation Spine (Phase 0A)", () => {
  beforeAll(async () => {
    ({ db } = await import("../db"));

    await db.execute(sql`
      CREATE UNIQUE INDEX IF NOT EXISTS uq_observations_source_ref
      ON observations (source_type, source_ref)
    `);

    await db
      .insert(states)
      .values({
        id: TEST_STATE_ID,
        name: "Observation Test State",
        code: TEST_STATE_CODE,
      })
      .onConflictDoNothing({ target: states.code });

    await db
      .insert(counties)
      .values({
        id: `${RUN_ID}-county`,
        name: "Observation Test County",
        fips: TEST_COUNTY_FIPS,
        stateCode: TEST_STATE_CODE,
      })
      .onConflictDoNothing({ target: counties.fips });
  });

  afterAll(async () => {
    await db.delete(observationSources).where(eq(observationSources.countyFips, TEST_COUNTY_FIPS));
    await db.delete(observations).where(eq(observations.countyFips, TEST_COUNTY_FIPS));
    await db.delete(counties).where(eq(counties.fips, TEST_COUNTY_FIPS));
    await db.delete(states).where(eq(states.code, TEST_STATE_CODE));
  });

  test("inserts canonical observations", async () => {
    const sourceRef = `${RUN_ID}:insert:1`;
    await db.insert(observations).values({
      occurredAt: new Date(),
      countyFips: TEST_COUNTY_FIPS,
      stateCode: TEST_STATE_CODE,
      city: "Test City",
      subjectType: "property",
      subjectRef: "parcel-1",
      actionType: "inspected",
      sourceType: "inspection",
      sourceRef,
      attributesJson: { score: 98 },
      confidence: "official",
    });

    const rows = await db.select().from(observations).where(eq(observations.sourceRef, sourceRef));

    expect(rows).toHaveLength(1);
    expect(rows[0].countyFips).toBe(TEST_COUNTY_FIPS);
  });

  test("enforces dedupe by (source_type, source_ref)", async () => {
    const sourceRef = `${RUN_ID}:dedupe:1`;
    const payload = {
      occurredAt: new Date(),
      countyFips: TEST_COUNTY_FIPS,
      stateCode: TEST_STATE_CODE,
      city: "Test City",
      subjectType: "property" as const,
      subjectRef: "parcel-2",
      actionType: "permitted",
      sourceType: "permit" as const,
      sourceRef,
      attributesJson: { permitId: "P-123" },
      confidence: "official" as const,
    };

    await db.insert(observations).values(payload);
    await db
      .insert(observations)
      .values(payload)
      .onConflictDoNothing({
        target: [observations.sourceType, observations.sourceRef],
      });

    const countRows = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(observations)
      .where(and(eq(observations.sourceType, "permit"), eq(observations.sourceRef, sourceRef)));

    expect(Number(countRows[0]?.count ?? 0)).toBe(1);
  });

  test("queries by county + time window", async () => {
    const now = new Date();
    const oldDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const recentDate = new Date(now.getTime() - 15 * 60 * 1000);
    const cutoff = new Date(now.getTime() - 60 * 60 * 1000);

    await db.insert(observations).values([
      {
        occurredAt: oldDate,
        countyFips: TEST_COUNTY_FIPS,
        stateCode: TEST_STATE_CODE,
        subjectType: "area",
        actionType: "flooded",
        sourceType: "sensor",
        sourceRef: `${RUN_ID}:time:old`,
        attributesJson: { severity: "high" },
        confidence: "official",
      },
      {
        occurredAt: recentDate,
        countyFips: TEST_COUNTY_FIPS,
        stateCode: TEST_STATE_CODE,
        subjectType: "area",
        actionType: "flooded",
        sourceType: "sensor",
        sourceRef: `${RUN_ID}:time:new`,
        attributesJson: { severity: "low" },
        confidence: "official",
      },
    ]);

    const rows = await db
      .select()
      .from(observations)
      .where(
        and(eq(observations.countyFips, TEST_COUNTY_FIPS), gte(observations.occurredAt, cutoff))
      );

    const refs = rows.map((r) => r.sourceRef);
    expect(refs).toContain(`${RUN_ID}:time:new`);
    expect(refs).not.toContain(`${RUN_ID}:time:old`);
  });
});
