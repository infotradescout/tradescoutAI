import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const read = (relativePath: string) =>
  fs.readFileSync(path.resolve(process.cwd(), relativePath), "utf-8");

describe("Direct Connect accepted-provider contact release authority", () => {
  it("commits the provider response and locked-to-requested gate transition with acceptance", () => {
    const routes = read("server/routes/direct-connect.ts");
    const ledger = read("server/services/directConnectDispatchLedgerService.ts");

    const acceptanceStart = routes.indexOf('"/api/direct-connect/assignments/:id/respond"');
    const acceptanceEnd = routes.indexOf(
      '"/api/direct-connect/requests/:id/express-interest"',
      acceptanceStart
    );
    const acceptance = routes.slice(acceptanceStart, acceptanceEnd);

    expect(acceptance).toContain("db.transaction(async (tx) =>");
    expect(acceptance).toContain("await recordContractorResponse(");
    expect(acceptance).toContain("ledgerResponseType");
    expect(acceptance).toContain("tx\n          );");
    expect(ledger).toContain("WITH parent AS (");
    expect(ledger).toContain("inserted_response AS (");
    expect(ledger).toContain("inserted_candidate AS (");
    expect(ledger).toContain("advanced_gate AS (");
    expect(ledger).toContain("AND contact_gate_state = 'locked'");
  });

  it("releases once under a request lock and binds the workspace to the responding provider", () => {
    const ledger = read("server/services/directConnectDispatchLedgerService.ts");

    expect(ledger).toContain("pg_advisory_xact_lock");
    expect(ledger).toContain("FOR UPDATE OF d");
    expect(ledger).toContain('currentState === "user_approved"');
    expect(ledger).toContain('currentState !== "released"');
    expect(ledger).toContain("CONTACT_RELEASE_REQUIRES_ACCEPTED_PROVIDER");
    expect(ledger).toContain("has_accepted_assignment DESC");
    expect(ledger).toContain("provider_user_id");
    expect(ledger).toContain("contractor_response_id");
    expect(ledger).toContain("createdNow: false");
    expect(ledger).toContain("createdNow: true");
  });

  it("returns requester contact only to the exact released eligible responder", () => {
    const routes = read("server/routes/direct-connect.ts");
    const ledger = read("server/services/directConnectDispatchLedgerService.ts");
    const messages = read("client/src/components/messages/MessagesPanel.tsx");

    expect(ledger).toContain("getReleasedRequesterContactForProvider");
    expect(ledger).toContain("dispatch.contact_gate_state = 'released'");
    expect(ledger).toContain("response.id = workspace.contractor_response_id");
    expect(ledger).toContain("candidate.eligibility_state = 'eligible'");
    expect(routes).toContain("homeownerContact: releasedContact");
    expect(routes).toContain("releasedContact,");
    expect(messages).toContain('data-testid="direct-connect-released-contact"');
    expect(messages).toContain("Contact stays private until the homeowner explicitly approves");
    expect(messages).toContain("Contact released by homeowner");
  });
});
