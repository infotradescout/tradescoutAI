import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { sql } from "drizzle-orm";
import { PgDialect } from "drizzle-orm/pg-core";
import {
  buildExposureAuthorityMap,
  exposureAuthoritySqlPredicate,
} from "../services/exposureAuthority";
const mocks = vi.hoisted(() => ({ users: vi.fn(), verification: vi.fn() }));
vi.mock("../storage", () => ({
  storage: { getUsersByIds: mocks.users, getUserVerificationSummary: mocks.verification },
}));
const database = new PGlite();
const cases = [
  { id: "address", emailVerified: true, addressVerified: true },
  { id: "identity", emailVerified: true, verificationStatus: "approved" },
  { id: "verified", emailVerified: true, verificationStatus: "VERIFIED" },
  { id: "case", emailVerified: true, verificationStatus: "ApPrOvEd" },
  { id: "space", emailVerified: true, verificationStatus: " approved " },
  { id: "no-email", emailVerified: false, addressVerified: true, verificationStatus: "approved" },
  { id: "null-email", emailVerified: null, addressVerified: true },
  { id: "null-gates", emailVerified: true },
  {
    id: "suspended-address",
    emailVerified: true,
    addressVerified: true,
    verificationStatus: "suspended",
  },
  { id: "suspended-only", emailVerified: true, verificationStatus: "suspended" },
  { id: "license", emailVerified: true },
  { id: "insurance", emailVerified: true },
  { id: "ein", emailVerified: true },
  { id: "expired", emailVerified: true },
  { id: "revoked", emailVerified: true },
  { id: "wrong-kind", emailVerified: true },
  { id: "case-business", emailVerified: true },
];
const business = [
  { id: "license", type: "license", status: "approved", expires: null },
  { id: "insurance", type: "insurance", status: "approved", expires: "2099-01-01" },
  { id: "ein", type: "ein", status: "approved", expires: null },
  { id: "expired", type: "license", status: "approved", expires: "2000-01-01" },
  { id: "revoked", type: "license", status: "revoked", expires: null },
  { id: "wrong-kind", type: "other", status: "approved", expires: null },
  { id: "case-business", type: "license", status: "APPROVED", expires: null },
];
beforeAll(async () => {
  await database.exec(`CREATE TABLE users(id text primary key, email_verified boolean, address_verified boolean, verification_status text);
    CREATE TABLE business_verifications(provider_user_id text, verification_type text, status text, expires_at timestamptz);`);
  for (const row of cases)
    await database.query("INSERT INTO users VALUES($1,$2,$3,$4)", [
      row.id,
      row.emailVerified,
      row.addressVerified ?? null,
      row.verificationStatus ?? null,
    ]);
  for (const row of business)
    await database.query("INSERT INTO business_verifications VALUES($1,$2,$3,$4)", [
      row.id,
      row.type,
      row.status,
      row.expires,
    ]);
  mocks.users.mockImplementation(async (ids: string[]) =>
    cases.filter((row) => ids.includes(row.id))
  );
  mocks.verification.mockImplementation(async (ids: string[]) =>
    Object.fromEntries(
      ids.map((id) => {
        const approved = business.filter(
          (row) =>
            row.id === id &&
            row.status === "approved" &&
            (!row.expires || new Date(row.expires).getTime() > Date.now())
        );
        return [
          id,
          {
            hasLicense: approved.some((row) => row.type === "license"),
            hasInsurance: approved.some((row) => row.type === "insurance"),
            hasEin: approved.some((row) => row.type === "ein"),
          },
        ];
      })
    )
  );
});
afterAll(() => database.close());
describe("sale exposure query/runtime parity in disposable PostgreSQL", () => {
  it("matches every real boolean, identity, moderation and business-verification branch before paging", async () => {
    const ids = [...cases.map((row) => row.id), "missing"];
    const runtime = await buildExposureAuthorityMap(ids);
    const predicate = new PgDialect().sqlToQuery(exposureAuthoritySqlPredicate(sql`candidate.id`));
    const rows = await database.query<{ id: string; allowed: boolean }>(
      `SELECT candidate.id, ${predicate.sql} AS allowed FROM unnest($1::text[]) AS candidate(id) ORDER BY candidate.id COLLATE "C"`,
      [ids]
    );
    expect(Object.fromEntries(rows.rows.map((row) => [row.id, row.allowed]))).toEqual(runtime);
    expect(runtime["no-email"]).toBe(false);
    // Preserve the current native rule; this repair does not redefine moderation.
    expect(runtime["suspended-address"]).toBe(true);
    expect(runtime["suspended-only"]).toBe(false);
  });
});
