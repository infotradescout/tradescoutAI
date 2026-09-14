import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { PgDialect } from "drizzle-orm/pg-core";
import { persistAcceptedExpressDispatch } from "../routes/direct-connect/express-dispatch-handoff";

const database = new PGlite();
const dialect = new PgDialect();
const input = {
  request: { id: "request", source: "direct_connect", title: "Material request", description: "Synthetic supply request", category: "business_request" },
  requesterUserId: "customer", providerUserId: "supplier", businessId: "business",
  sourceDecisionCardId: "card", requestType: "request_material",
};
const execute = (connection: any) => ({ execute: async (statement: any) => {
  const query = dialect.sqlToQuery(statement);
  return connection.query(query.sql, query.params);
} });
const persist = (args = input) => database.transaction(tx => persistAcceptedExpressDispatch(execute(tx), args));
beforeAll(async () => {
  await database.exec(`
    CREATE TABLE direct_connect_dispatch_requests (
      id text PRIMARY KEY,user_id text,intent text NOT NULL,request_type text NOT NULL,
      category text NOT NULL,county text,city_area text,urgency text,description text NOT NULL,
      answers_json jsonb NOT NULL,completeness_state text NOT NULL,routing_readiness_state text NOT NULL,
      visibility_state text NOT NULL,contact_gate_state text NOT NULL,source_surface text NOT NULL,
      created_at timestamptz,updated_at timestamptz
    );
    CREATE TABLE direct_connect_dispatch_candidates (
      id text PRIMARY KEY,request_id text NOT NULL REFERENCES direct_connect_dispatch_requests(id),
      business_id text,responder_user_id text,eligibility_state text NOT NULL,
      eligibility_reasons jsonb,ineligibility_reasons jsonb,territory_matched boolean,
      category_matched boolean,verification_state text,profile_readiness text,
      contact_eligibility boolean,trust_state text,created_at timestamptz
    );
    CREATE TABLE acceptance_fixture (id text PRIMARY KEY,status text NOT NULL);
  `);
});
afterAll(async () => { await database.close(); });
beforeEach(async () => { await database.exec("TRUNCATE direct_connect_dispatch_candidates,direct_connect_dispatch_requests,acceptance_fixture;"); });

describe("Accepted Express dispatch linkage", () => {
  it("creates one requester-owned private parent and the exact chosen supplier", async () => {
    await persist();
    const parents = (await database.query("SELECT * FROM direct_connect_dispatch_requests")).rows as any[];
    const candidates = (await database.query("SELECT * FROM direct_connect_dispatch_candidates")).rows as any[];
    expect(parents).toHaveLength(1); expect(candidates).toHaveLength(1);
    expect(parents[0]).toMatchObject({ id: "request", user_id: "customer", contact_gate_state: "locked", visibility_state: "review_ready", county: null, routing_readiness_state: "needs_location" });
    expect(candidates[0]).toMatchObject({ request_id: "request", business_id: "business", responder_user_id: "supplier", eligibility_state: "eligible", territory_matched: null, category_matched: null, contact_eligibility: null, verification_state: "unknown", trust_state: "unknown" });
    expect(parents[0].answers_json.expressAuthority).toEqual({ sourceDecisionCardId: "card", providerUserId: "supplier", businessId: "business" });
  });
  it("retains a supplied county without inferring another jurisdiction", async () => {
    await persist({ ...input, request: { ...input.request, countyFips: "12001" } } as any);
    const row: any = (await database.query("SELECT county,routing_readiness_state FROM direct_connect_dispatch_requests")).rows[0];
    expect(row).toEqual({ county: "12001", routing_readiness_state: "route_ready" });
  });
  it("replaying the same linkage does not duplicate candidates or reset released contact", async () => {
    await persist();
    await database.exec("UPDATE direct_connect_dispatch_requests SET contact_gate_state='released'");
    await persist();
    expect((await database.query("SELECT * FROM direct_connect_dispatch_candidates")).rows).toHaveLength(1);
    expect((await database.query("SELECT contact_gate_state FROM direct_connect_dispatch_requests")).rows[0]).toEqual({ contact_gate_state: "released" });
  });
  it.each(["user_id", "source_surface"])("refuses an existing parent with conflicting %s", async column => {
    await persist(); await database.exec(`UPDATE direct_connect_dispatch_requests SET ${column}='different'`);
    await expect(persist()).rejects.toMatchObject({ code: "23502" });
    const row: any = (await database.query(`SELECT ${column} FROM direct_connect_dispatch_requests`)).rows[0];
    expect(row[column]).toBe("different");
  });
  it.each(["sourceDecisionCardId", "providerUserId", "businessId"])("refuses a parent scoped to a different %s", async property => {
    await persist();
    await database.query("UPDATE direct_connect_dispatch_requests SET answers_json=jsonb_set(answers_json,ARRAY['expressAuthority',$1],to_jsonb('different'::text))", [property]);
    await expect(persist()).rejects.toMatchObject({ code: "23502" });
  });
  it.each(["responder_user_id", "business_id", "eligibility_state"])("does not overwrite a conflicting candidate's %s", async column => {
    await persist(); await database.exec(`UPDATE direct_connect_dispatch_candidates SET ${column}='different'`);
    await expect(persist()).rejects.toMatchObject({ code: "23502" });
    const row: any = (await database.query(`SELECT ${column} FROM direct_connect_dispatch_candidates`)).rows[0];
    expect(row[column]).toBe("different");
  });
  it("rolls acceptance back with the parent insert when the candidate insert fails", async () => {
    await database.exec("INSERT INTO acceptance_fixture VALUES ('request','invited'); ALTER TABLE direct_connect_dispatch_candidates ADD CONSTRAINT fail_fixture CHECK (business_id <> 'business');");
    try {
      await expect(database.transaction(async tx => {
        await tx.exec("UPDATE acceptance_fixture SET status='accepted' WHERE id='request'");
        await persistAcceptedExpressDispatch(execute(tx), input);
      })).rejects.toMatchObject({ code: "23514" });
      expect((await database.query("SELECT status FROM acceptance_fixture")).rows[0]).toEqual({ status: "invited" });
      expect((await database.query("SELECT * FROM direct_connect_dispatch_requests")).rows).toHaveLength(0);
      expect((await database.query("SELECT * FROM direct_connect_dispatch_candidates")).rows).toHaveLength(0);
    } finally { await database.exec("ALTER TABLE direct_connect_dispatch_candidates DROP CONSTRAINT fail_fixture"); }
  });
  it.each(["requesterUserId", "providerUserId", "businessId", "sourceDecisionCardId"])("rejects missing %s before persistence", async property => {
    await expect(persist({ ...input, [property]: "" })).rejects.toThrow("incomplete dispatch identity");
    expect((await database.query("SELECT * FROM direct_connect_dispatch_requests")).rows).toHaveLength(0);
  });
  it("does not allow self-requests or unrelated sources", async () => {
    await expect(persist({ ...input, providerUserId: input.requesterUserId })).rejects.toThrow();
    await expect(persist({ ...input, request: { ...input.request, source: "other" } })).rejects.toThrow();
    expect((await database.query("SELECT * FROM direct_connect_dispatch_requests")).rows).toHaveLength(0);
  });
});
