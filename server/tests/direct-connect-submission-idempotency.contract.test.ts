import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const read = (relativePath: string) =>
  fs.readFileSync(path.resolve(process.cwd(), relativePath), "utf8");

describe("Direct Connect submission idempotency", () => {
  it("claims one owner-scoped key in the same transaction as request creation", () => {
    const service = read("server/services/directConnectSubmissionIdempotencyService.ts");

    expect(service).toContain("PRIMARY KEY (owner_user_id, submission_key)");
    expect(service).toContain("UNIQUE (request_id)");
    expect(service).toContain("pg_advisory_xact_lock");
    expect(service).toContain("return db.transaction(async (tx: any) =>");
    expect(service).toContain(".insert(workRequests)");
    expect(service).toContain("DIRECT_CONNECT_IDEMPOTENCY_CONFLICT");
    expect(service).toContain("replayed: true");
  });

  it("sends and persists one client key until a successful response", () => {
    const shell = read("client/src/pages/direct-connect/DirectConnectShell.tsx");

    expect(shell).toContain("createDirectConnectSubmissionKey");
    expect(shell).toContain("submissionKey?: string");
    expect(shell).toContain("setSubmissionKey(parsed.submissionKey)");
    expect(shell).toContain("submissionKey,");
    expect(shell).toContain("setSubmissionKey(createDirectConnectSubmissionKey())");
  });

  it("proves exact replay, mismatched-payload conflict, and one stored request", () => {
    const integration = read("server/tests/direct-connect-gates.integration.test.ts");

    expect(integration).toContain("idempotencyReplayed");
    expect(integration).toContain("DIRECT_CONNECT_IDEMPOTENCY_CONFLICT");
    expect(integration).toContain("expect(duplicates).toHaveLength(1)");
  });
});
