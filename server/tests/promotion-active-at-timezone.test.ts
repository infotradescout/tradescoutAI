import { PgDialect } from "drizzle-orm/pg-core";
import { beforeEach, describe, expect, it, vi } from "vitest";

const capture = vi.hoisted(() => ({
  predicate: null as unknown,
  sort: null as unknown,
  limit: null as number | null,
}));

vi.mock("../db", () => ({
  db: {
    select: () => ({
      from: () => ({
        where: (predicate: unknown) => {
          capture.predicate = predicate;
          return {
            orderBy: (sort: unknown) => {
              capture.sort = sort;
              return {
                limit: (limit: number) => {
                  capture.limit = limit;
                  return Promise.resolve([]);
                },
              };
            },
          };
        },
      }),
    }),
  },
  pool: {},
}));

import { storage } from "../storage";

describe("promotion activeAt timestamp binding", () => {
  beforeEach(() => {
    capture.predicate = null;
    capture.sort = null;
    capture.limit = null;
  });

  it("binds the same UTC instant across process timezones while preserving discovery filters", async () => {
    const priorTimezone = process.env.TZ;
    const queryByTimezone: Array<{ sql: string; params: unknown[] }> = [];

    try {
      for (const timezone of ["UTC", "America/Chicago"]) {
        process.env.TZ = timezone;
        await storage.listPromotions({
          status: "active",
          tier: "paid_campaign",
          type: "trade_deal",
          exclusive: true,
          placementScout: true,
          countyFips: "04013",
          includeGlobalWhenCounty: true,
          activeAt: new Date("2026-10-01T01:42:00.000Z"),
          limit: 25,
        });

        const dialect = new PgDialect();
        const compiled = dialect.sqlToQuery(
          capture.predicate as Parameters<typeof dialect.sqlToQuery>[0]
        );
        queryByTimezone.push({ sql: compiled.sql, params: compiled.params });
        expect(
          dialect.sqlToQuery(capture.sort as Parameters<typeof dialect.sqlToQuery>[0]).sql
        ).toContain("created_at");
        expect(capture.limit).toBe(25);
      }
    } finally {
      if (priorTimezone === undefined) delete process.env.TZ;
      else process.env.TZ = priorTimezone;
    }

    expect(queryByTimezone[0]).toEqual(queryByTimezone[1]);
    expect(queryByTimezone[0].sql).toContain('"promotions"."starts_at"');
    expect(queryByTimezone[0].sql).toContain('"promotions"."ends_at"');
    expect(queryByTimezone[0].sql).toContain('"promotions"."placement_scout"');
    expect(queryByTimezone[0].sql).toContain('"promotions"."county_fips"');
    expect(
      queryByTimezone[0].params.filter((value) => value === "2026-10-01T01:42:00.000Z")
    ).toHaveLength(2);
  });
});
