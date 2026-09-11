import express from "express";
import request from "supertest";
import { beforeAll, afterAll, beforeEach, describe, expect, it } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { sql } from "drizzle-orm";
import { PgDialect } from "drizzle-orm/pg-core";
import { registerDirectConnectJobLifecycleRoutes } from "../routes/direct-connect/job-lifecycle";

// Focused arithmetic integration: actual registered Express route and PostgreSQL
// SQL semantics. Authentication/schema validation are injected test fixtures;
// their authority behavior is covered by the separate native customer journey.
const postgres = new PGlite();
const dialect = new PgDialect();
let counter = 0;
const app = express();
app.use(express.json());
const db = {
  execute: async (statement: any) => {
    const query = dialect.sqlToQuery(statement);
    return postgres.query(query.sql, query.params);
  },
  select: () => ({ from: () => ({ where: () => ({ limit: async () => [] }) }) }),
};
registerDirectConnectJobLifecycleRoutes(app, {
  db, sql,
  isAuthenticated: (req: any, _res: any, next: any) => { req.user = { id: "fixture-supplier" }; next(); },
  storage: { getContractorByUserId: async () => null },
  workers: { id: sql.raw("id"), userId: sql.raw("user_id") },
  eq: () => sql`true`,
  createId: () => "item-" + ++counter,
  toNumber: (value: unknown) => Number(value || 0),
  normalizeEstimateStatus: (value: unknown) => String(value),
  estimateLineItemSchema: { safeParse: (value: unknown) => ({ success: true, data: value }) },
  appendDispatchEvent: async () => {},
} as any);

beforeAll(async () => {
  await postgres.exec(`
    CREATE TABLE job_estimates (
      id text PRIMARY KEY, workspace_id text, request_id text, status text,
      subtotal_materials numeric NOT NULL DEFAULT 0,
      subtotal_labor numeric NOT NULL DEFAULT 0,
      subtotal_other numeric NOT NULL DEFAULT 0,
      total_estimate numeric NOT NULL DEFAULT 0, updated_at timestamptz
    );
    CREATE TABLE direct_connect_dispatch_candidates (
      request_id text, eligibility_state text, contractor_id text,
      responder_user_id text, worker_id text
    );
    CREATE TABLE job_estimate_line_items (
      id text PRIMARY KEY, estimate_id text REFERENCES job_estimates(id),
      line_type text, name text, description text, quantity numeric,
      unit text, rate numeric, unit_price numeric, total_cost numeric,
      supplier text, sku text, notes text, created_at timestamptz
    );
  `);
});
afterAll(async () => postgres.close());
beforeEach(async () => {
  await postgres.exec("TRUNCATE job_estimate_line_items, job_estimates, direct_connect_dispatch_candidates;");
  await postgres.query("INSERT INTO job_estimates(id,workspace_id,request_id,status) VALUES ('estimate','workspace','request','draft')");
  await postgres.query("INSERT INTO direct_connect_dispatch_candidates(request_id,eligibility_state,responder_user_id) VALUES ('request','eligible','fixture-supplier')");
});

async function add(lineType: string, amount: number, quantity = 1) {
  const response = await request(app)
    .post("/api/direct-connect/jobs/workspace/estimates/estimate/line-items")
    .send({ lineType, name: "Fixture " + lineType, quantity, unit: "each", unitCost: amount });
  expect(response.status, JSON.stringify(response.body)).toBe(201);
  return response.body.totals;
}

describe("Estimate subtotals from actual line-item inserts", () => {
  it("adds 100 and 200 once rather than compounding previous other charges", async () => {
    expect((await add("other", 100)).totalEstimate).toBe(100);
    expect((await add("other", 200)).totalEstimate).toBe(300);
    expect((await add("material", 150, 2)).totalEstimate).toBe(600);
    expect((await add("labor", 50, 2)).totalEstimate).toBe(700);
    const row: any = (await postgres.query("SELECT * FROM job_estimates WHERE id='estimate'")).rows[0];
    expect(Number(row.subtotal_materials)).toBe(300);
    expect(Number(row.subtotal_labor)).toBe(100);
    expect(Number(row.subtotal_other)).toBe(300);
    expect(Number(row.total_estimate)).toBe(700);
  });
  it("preserves a fixed starting allowance instead of dropping or repeatedly adding it", async () => {
    await postgres.query("UPDATE job_estimates SET subtotal_other=25,total_estimate=25 WHERE id='estimate'");
    expect((await add("travel", 10)).totalEstimate).toBe(35);
    expect((await add("material", 20)).totalEstimate).toBe(55);
    expect((await add("disposal", 5)).totalEstimate).toBe(60);
  });
  it("retains cent rounding for mixed lines", async () => {
    expect((await add("equipment", 10.125, 2)).totalEstimate).toBe(20.25);
    expect((await add("labor", 1.25, 2)).totalEstimate).toBe(22.75);
    expect((await add("permits", 0.25)).totalEstimate).toBe(23);
  });
  it("continues rejecting edits to sent estimates without inserting a line", async () => {
    await postgres.query("UPDATE job_estimates SET status='sent' WHERE id='estimate'");
    const response = await request(app).post("/api/direct-connect/jobs/workspace/estimates/estimate/line-items")
      .send({ lineType: "other", name: "Fixture", quantity: 1, unit: "each", unitCost: 100 });
    expect(response.status).toBe(409);
    expect((await postgres.query("SELECT * FROM job_estimate_line_items")).rows).toHaveLength(0);
  });
});
