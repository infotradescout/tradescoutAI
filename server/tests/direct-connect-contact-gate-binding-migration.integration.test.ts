import fs from "node:fs";
import path from "node:path";
import pg, { type Client as PgClient } from "pg";
import { describe, expect, it, vi } from "vitest";

const { Client } = pg;

const describeWithDb = process.env.TEST_DATABASE_URL ? describe : describe.skip;
const TEST_TIMEOUT_MS = 120_000;

vi.setConfig({ testTimeout: TEST_TIMEOUT_MS });

type AssignmentFixture = {
  id: string;
  requestId: string;
  contractorId: string;
  responderUserId: string;
  providerKey: string | null;
  status: "suggested" | "invited" | "accepted";
  createdAt: Date;
};

type ResponseFixture = {
  id: string;
  requestId: string;
  contractorId: string;
  responderUserId: string;
  assignmentId: string | null;
  providerKey: string | null;
  contactRequestState: "locked" | "contractor_requested";
  createdAt: Date;
};

const legacyDirectConnectSchemaSql = `
  CREATE TABLE IF NOT EXISTS direct_connect_dispatch_requests (
    id text PRIMARY KEY,
    user_id text NULL,
    anonymous_session_id text NULL,
    intent text NOT NULL,
    request_type text NOT NULL,
    category text NOT NULL,
    county text NULL,
    city_area text NULL,
    urgency text NULL,
    description text NOT NULL,
    answers_json jsonb NOT NULL DEFAULT '{}'::jsonb,
    completeness_state text NOT NULL,
    routing_readiness_state text NOT NULL,
    visibility_state text NOT NULL,
    contact_gate_state text NOT NULL DEFAULT 'locked',
    contact_gate_assignment_id text NULL,
    contact_gate_provider_key text NULL,
    source_surface text NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
  );

  CREATE TABLE IF NOT EXISTS direct_connect_contractor_responses (
    id text PRIMARY KEY,
    request_id text NOT NULL
      REFERENCES direct_connect_dispatch_requests(id) ON DELETE CASCADE,
    contractor_id text NULL,
    responder_user_id text NULL,
    assignment_id text NULL,
    provider_key text NULL,
    response_type text NOT NULL,
    message text NULL,
    availability text NULL,
    estimated_timing text NULL,
    contact_request_state text NOT NULL DEFAULT 'locked',
    created_at timestamptz NOT NULL DEFAULT now()
  );
`;

async function insertUser(client: PgClient, id: string) {
  await client.query(
    `
      INSERT INTO users (id, email, first_name, last_name)
      VALUES ($1, $2, 'Migration', 'Fixture')
    `,
    [id, `${id}@example.com`]
  );
}

async function insertContractor(client: PgClient, id: string, userId: string) {
  await client.query(
    `
      INSERT INTO contractors (id, user_id, company_name, slug)
      VALUES ($1, $2, $3, $4)
    `,
    [id, userId, `Fixture ${id}`, id]
  );
}

async function insertRequestWithLockedGate(
  client: PgClient,
  id: string,
  requesterUserId: string,
  createdAt: Date
) {
  await client.query(
    `
      INSERT INTO work_requests (
        id,
        created_by_user_id,
        title,
        description,
        category,
        source,
        status,
        visibility,
        created_at,
        updated_at
      )
      VALUES (
        $1,
        $2,
        'Direct Connect migration fixture',
        'Verify exact authority binding repair.',
        'project',
        'direct_connect',
        'in_progress',
        'private',
        $3,
        $3
      )
    `,
    [id, requesterUserId, createdAt]
  );

  await client.query(
    `
      INSERT INTO direct_connect_dispatch_requests (
        id,
        user_id,
        intent,
        request_type,
        category,
        description,
        completeness_state,
        routing_readiness_state,
        visibility_state,
        contact_gate_state,
        source_surface,
        created_at,
        updated_at
      )
      VALUES (
        $1,
        $2,
        'Direct Connect migration fixture',
        'project',
        'project',
        'Verify exact authority binding repair.',
        'complete',
        'ready',
        'private',
        'locked',
        'migration_fixture',
        $3,
        $3
      )
    `,
    [id, requesterUserId, createdAt]
  );
}

async function insertAssignment(client: PgClient, fixture: AssignmentFixture) {
  await client.query(
    `
      INSERT INTO work_request_assignments (
        id,
        work_request_id,
        provider_key,
        contractor_id,
        responder_user_id,
        status,
        created_at,
        updated_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $7)
    `,
    [
      fixture.id,
      fixture.requestId,
      fixture.providerKey,
      fixture.contractorId,
      fixture.responderUserId,
      fixture.status,
      fixture.createdAt,
    ]
  );
}

async function insertConversation(
  client: PgClient,
  id: string,
  requesterUserId: string,
  contractorId: string,
  createdAt: Date
) {
  await client.query(
    `
      INSERT INTO conversations (
        id,
        homeowner_id,
        contractor_id,
        status,
        created_at,
        updated_at
      )
      VALUES ($1, $2, $3, 'active', $4, $4)
    `,
    [id, requesterUserId, contractorId, createdAt]
  );
}

async function insertAcceptedEvent(
  client: PgClient,
  id: string,
  requestId: string,
  providerUserId: string,
  metadata: Record<string, unknown>,
  createdAt: Date
) {
  await client.query(
    `
      INSERT INTO work_request_events (
        id,
        work_request_id,
        type,
        actor_user_id,
        metadata,
        created_at
      )
      VALUES ($1, $2, 'provider_accepted', $3, $4::jsonb, $5)
    `,
    [id, requestId, providerUserId, JSON.stringify(metadata), createdAt]
  );
}

async function insertResponse(client: PgClient, fixture: ResponseFixture) {
  await client.query(
    `
      INSERT INTO direct_connect_contractor_responses (
        id,
        request_id,
        contractor_id,
        responder_user_id,
        assignment_id,
        provider_key,
        response_type,
        contact_request_state,
        created_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, 'interested', $7, $8)
    `,
    [
      fixture.id,
      fixture.requestId,
      fixture.contractorId,
      fixture.responderUserId,
      fixture.assignmentId,
      fixture.providerKey,
      fixture.contactRequestState,
      fixture.createdAt,
    ]
  );
}

async function loadOne(client: PgClient, sql: string, values: unknown[]) {
  const result = await client.query(sql, values);
  expect(result.rows).toHaveLength(1);
  return result.rows[0] as Record<string, any>;
}

async function loadMigrationSnapshot(client: PgClient, requestIds: string[]) {
  const assignments = await client.query(
    `
      SELECT id, work_request_id, provider_key, status
      FROM work_request_assignments
      WHERE work_request_id = ANY($1::text[])
      ORDER BY id
    `,
    [requestIds]
  );
  const responses = await client.query(
    `
      SELECT id, request_id, assignment_id, provider_key, contact_request_state
      FROM direct_connect_contractor_responses
      WHERE request_id = ANY($1::text[])
      ORDER BY id
    `,
    [requestIds]
  );
  const events = await client.query(
    `
      SELECT id, work_request_id, metadata
      FROM work_request_events
      WHERE work_request_id = ANY($1::text[])
      ORDER BY id
    `,
    [requestIds]
  );
  const gates = await client.query(
    `
      SELECT
        id,
        contact_gate_state,
        contact_gate_assignment_id,
        contact_gate_provider_key,
        updated_at
      FROM direct_connect_dispatch_requests
      WHERE id = ANY($1::text[])
      ORDER BY id
    `,
    [requestIds]
  );
  const quarantine = await client.query(
    `
      SELECT
        id,
        request_id,
        assignment_id,
        reason,
        details_json,
        created_at,
        resolved_at
      FROM direct_connect_binding_repair_quarantine
      WHERE request_id = ANY($1::text[])
      ORDER BY id
    `,
    [requestIds]
  );

  return {
    assignments: assignments.rows,
    responses: responses.rows,
    events: events.rows,
    gates: gates.rows,
    quarantine: quarantine.rows,
  };
}

describeWithDb("migration 0114 exact Direct Connect authority repair", () => {
  it(
    "repairs only unambiguous historical chains, fails closed on ambiguity, and reruns idempotently",
    async () => {
      const client = new Client({ connectionString: process.env.TEST_DATABASE_URL });
      let transactionStarted = false;

      await client.connect();

      try {
        await client.query("BEGIN");
        transactionStarted = true;
        await client.query("SET LOCAL search_path TO public");
        await client.query(
          "SELECT pg_advisory_xact_lock(hashtext('migration_0114_exact_binding_fixture'))"
        );
        await client.query(legacyDirectConnectSchemaSql);
        await client.query(`
          DROP TRIGGER IF EXISTS enforce_direct_connect_assignment_provider_key
            ON work_request_assignments;

          ALTER TABLE direct_connect_contractor_responses
            DROP CONSTRAINT IF EXISTS dc_response_binding_pair_check,
            DROP CONSTRAINT IF EXISTS dc_actionable_response_exact_binding_check;

          ALTER TABLE direct_connect_dispatch_requests
            DROP CONSTRAINT IF EXISTS dc_contact_gate_binding_pair_check,
            DROP CONSTRAINT IF EXISTS dc_advanced_contact_gate_exact_binding_check;

          ALTER TABLE work_request_events
            DROP CONSTRAINT IF EXISTS dc_provider_accepted_exact_binding_check;
        `);

        const runId = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
        const id = (suffix: string) => `dc0114-${runId}-${suffix}`;
        const at = (seconds: number) => new Date(Date.UTC(2026, 6, 20, 12, 0, seconds));

        const safe = {
          request: id("safe-request"),
          requester: id("safe-requester"),
          provider: id("safe-provider"),
          contractor: id("safe-contractor"),
          assignment: id("safe-assignment"),
          conversation: id("safe-conversation"),
          event: id("safe-event"),
          response: id("safe-response"),
        };
        const duplicate = {
          request: id("duplicate-request"),
          requester: id("duplicate-requester"),
          provider: id("duplicate-provider"),
          contractor: id("duplicate-contractor"),
          assignmentA: id("duplicate-assignment-a"),
          assignmentB: id("duplicate-assignment-b"),
        };
        const repeated = {
          request: id("repeated-request"),
          requester: id("repeated-requester"),
          provider: id("repeated-provider"),
          contractor: id("repeated-contractor"),
          assignment: id("repeated-assignment"),
          conversation: id("repeated-conversation"),
          eventA: id("repeated-event-a"),
          eventB: id("repeated-event-b"),
          response: id("repeated-response"),
        };
        const partial = {
          request: id("partial-request"),
          requester: id("partial-requester"),
          provider: id("partial-provider"),
          contractor: id("partial-contractor"),
          assignment: id("partial-assignment"),
          conversation: id("partial-conversation"),
          event: id("partial-event"),
          response: id("partial-response"),
        };
        const later = {
          request: id("later-request"),
          requester: id("later-requester"),
          provider: id("later-provider"),
          contractor: id("later-contractor"),
          assignment: id("later-assignment"),
          response: id("later-response"),
        };
        const multi = {
          request: id("multi-request"),
          requester: id("multi-requester"),
          providerA: id("multi-provider-a"),
          providerB: id("multi-provider-b"),
          contractorA: id("multi-contractor-a"),
          contractorB: id("multi-contractor-b"),
          assignmentA: id("multi-assignment-a"),
          assignmentB: id("multi-assignment-b"),
          conversationA: id("multi-conversation-a"),
          eventA: id("multi-event-a"),
          responseA: id("multi-response-a"),
        };

        const users = [
          safe.requester,
          safe.provider,
          duplicate.requester,
          duplicate.provider,
          repeated.requester,
          repeated.provider,
          partial.requester,
          partial.provider,
          later.requester,
          later.provider,
          multi.requester,
          multi.providerA,
          multi.providerB,
        ];
        for (const userId of users) {
          await insertUser(client, userId);
        }

        const contractors: Array<[string, string]> = [
          [safe.contractor, safe.provider],
          [duplicate.contractor, duplicate.provider],
          [repeated.contractor, repeated.provider],
          [partial.contractor, partial.provider],
          [later.contractor, later.provider],
          [multi.contractorA, multi.providerA],
          [multi.contractorB, multi.providerB],
        ];
        for (const [contractorId, userId] of contractors) {
          await insertContractor(client, contractorId, userId);
        }

        const requestOwners: Array<[string, string]> = [
          [safe.request, safe.requester],
          [duplicate.request, duplicate.requester],
          [repeated.request, repeated.requester],
          [partial.request, partial.requester],
          [later.request, later.requester],
          [multi.request, multi.requester],
        ];
        for (const [requestId, requesterUserId] of requestOwners) {
          await insertRequestWithLockedGate(client, requestId, requesterUserId, at(0));
        }

        await insertAssignment(client, {
          id: safe.assignment,
          requestId: safe.request,
          contractorId: safe.contractor,
          responderUserId: safe.provider,
          providerKey: null,
          status: "accepted",
          createdAt: at(10),
        });
        await insertConversation(
          client,
          safe.conversation,
          safe.requester,
          safe.contractor,
          at(15)
        );
        await insertAcceptedEvent(
          client,
          safe.event,
          safe.request,
          safe.provider,
          {
            conversationId: safe.conversation,
            contractorId: safe.contractor,
          },
          at(20)
        );
        await insertResponse(client, {
          id: safe.response,
          requestId: safe.request,
          contractorId: safe.contractor,
          responderUserId: safe.provider,
          assignmentId: null,
          providerKey: null,
          contactRequestState: "contractor_requested",
          createdAt: at(30),
        });

        for (const assignmentId of [duplicate.assignmentA, duplicate.assignmentB]) {
          await insertAssignment(client, {
            id: assignmentId,
            requestId: duplicate.request,
            contractorId: duplicate.contractor,
            responderUserId: duplicate.provider,
            providerKey: null,
            status: "suggested",
            createdAt: at(10),
          });
        }

        await insertAssignment(client, {
          id: repeated.assignment,
          requestId: repeated.request,
          contractorId: repeated.contractor,
          responderUserId: repeated.provider,
          providerKey: `contractor:${repeated.contractor}`,
          status: "accepted",
          createdAt: at(10),
        });
        await insertConversation(
          client,
          repeated.conversation,
          repeated.requester,
          repeated.contractor,
          at(15)
        );
        await insertAcceptedEvent(
          client,
          repeated.eventA,
          repeated.request,
          repeated.provider,
          {
            conversationId: repeated.conversation,
            contractorId: repeated.contractor,
          },
          at(20)
        );
        // A malformed duplicate must still make the request ambiguous.
        await insertAcceptedEvent(
          client,
          repeated.eventB,
          repeated.request,
          repeated.provider,
          {},
          at(25)
        );
        await insertResponse(client, {
          id: repeated.response,
          requestId: repeated.request,
          contractorId: repeated.contractor,
          responderUserId: repeated.provider,
          assignmentId: null,
          providerKey: null,
          contactRequestState: "contractor_requested",
          createdAt: at(30),
        });

        await insertAssignment(client, {
          id: partial.assignment,
          requestId: partial.request,
          contractorId: partial.contractor,
          responderUserId: partial.provider,
          providerKey: `contractor:${partial.contractor}`,
          status: "accepted",
          createdAt: at(10),
        });
        await insertConversation(
          client,
          partial.conversation,
          partial.requester,
          partial.contractor,
          at(15)
        );
        await insertAcceptedEvent(
          client,
          partial.event,
          partial.request,
          partial.provider,
          {
            conversationId: partial.conversation,
            contractorId: partial.contractor,
          },
          at(20)
        );
        await insertResponse(client, {
          id: partial.response,
          requestId: partial.request,
          contractorId: partial.contractor,
          responderUserId: partial.provider,
          assignmentId: partial.assignment,
          providerKey: null,
          contactRequestState: "contractor_requested",
          createdAt: at(30),
        });

        await insertResponse(client, {
          id: later.response,
          requestId: later.request,
          contractorId: later.contractor,
          responderUserId: later.provider,
          assignmentId: null,
          providerKey: null,
          contactRequestState: "locked",
          createdAt: at(20),
        });
        await insertAssignment(client, {
          id: later.assignment,
          requestId: later.request,
          contractorId: later.contractor,
          responderUserId: later.provider,
          providerKey: `contractor:${later.contractor}`,
          status: "invited",
          createdAt: at(30),
        });

        await insertAssignment(client, {
          id: multi.assignmentA,
          requestId: multi.request,
          contractorId: multi.contractorA,
          responderUserId: multi.providerA,
          providerKey: `contractor:${multi.contractorA}`,
          status: "accepted",
          createdAt: at(10),
        });
        await insertAssignment(client, {
          id: multi.assignmentB,
          requestId: multi.request,
          contractorId: multi.contractorB,
          responderUserId: multi.providerB,
          providerKey: `contractor:${multi.contractorB}`,
          status: "accepted",
          createdAt: at(10),
        });
        await insertConversation(
          client,
          multi.conversationA,
          multi.requester,
          multi.contractorA,
          at(15)
        );
        await insertAcceptedEvent(
          client,
          multi.eventA,
          multi.request,
          multi.providerA,
          {
            conversationId: multi.conversationA,
            contractorId: multi.contractorA,
            assignmentId: multi.assignmentA,
            providerKey: `contractor:${multi.contractorA}`,
            authorityBindingVersion: 2,
          },
          at(20)
        );
        await insertResponse(client, {
          id: multi.responseA,
          requestId: multi.request,
          contractorId: multi.contractorA,
          responderUserId: multi.providerA,
          assignmentId: multi.assignmentA,
          providerKey: `contractor:${multi.contractorA}`,
          contactRequestState: "contractor_requested",
          createdAt: at(30),
        });

        const migrationSql = fs.readFileSync(
          path.resolve(process.cwd(), "migrations/0114_direct_connect_contact_gate_binding.sql"),
          "utf8"
        );
        await client.query(migrationSql);

        const safeAssignment = await loadOne(
          client,
          `
            SELECT provider_key
            FROM work_request_assignments
            WHERE id = $1
          `,
          [safe.assignment]
        );
        expect(safeAssignment.provider_key).toBe(`contractor:${safe.contractor}`);

        const safeResponse = await loadOne(
          client,
          `
            SELECT assignment_id, provider_key
            FROM direct_connect_contractor_responses
            WHERE id = $1
          `,
          [safe.response]
        );
        expect(safeResponse).toMatchObject({
          assignment_id: safe.assignment,
          provider_key: `contractor:${safe.contractor}`,
        });

        const safeEvent = await loadOne(
          client,
          `
            SELECT metadata
            FROM work_request_events
            WHERE id = $1
          `,
          [safe.event]
        );
        expect(safeEvent.metadata).toMatchObject({
          conversationId: safe.conversation,
          assignmentId: safe.assignment,
          providerKey: `contractor:${safe.contractor}`,
          authorityBindingVersion: 2,
        });

        const safeGate = await loadOne(
          client,
          `
            SELECT
              contact_gate_state,
              contact_gate_assignment_id,
              contact_gate_provider_key
            FROM direct_connect_dispatch_requests
            WHERE id = $1
          `,
          [safe.request]
        );
        expect(safeGate).toMatchObject({
          contact_gate_state: "contractor_requested",
          contact_gate_assignment_id: safe.assignment,
          contact_gate_provider_key: `contractor:${safe.contractor}`,
        });
        const safeQuarantine = await loadOne(
          client,
          `
            SELECT COUNT(*)::int AS count
            FROM direct_connect_binding_repair_quarantine
            WHERE request_id = $1
              AND resolved_at IS NULL
          `,
          [safe.request]
        );
        expect(safeQuarantine.count).toBe(0);

        const duplicateAssignments = await client.query(
          `
            SELECT id, provider_key
            FROM work_request_assignments
            WHERE work_request_id = $1
            ORDER BY id
          `,
          [duplicate.request]
        );
        expect(duplicateAssignments.rows).toEqual([
          { id: duplicate.assignmentA, provider_key: null },
          { id: duplicate.assignmentB, provider_key: null },
        ]);
        const duplicateQuarantine = await client.query(
          `
            SELECT assignment_id, details_json
            FROM direct_connect_binding_repair_quarantine
            WHERE request_id = $1
              AND reason = 'provider_key_binding_ambiguous'
              AND resolved_at IS NULL
            ORDER BY assignment_id
          `,
          [duplicate.request]
        );
        expect(duplicateQuarantine.rows).toHaveLength(2);
        expect(
          duplicateQuarantine.rows.every((row) => row.details_json?.nullCandidateCount === 2)
        ).toBe(true);

        const repeatedResponse = await loadOne(
          client,
          `
            SELECT assignment_id, provider_key
            FROM direct_connect_contractor_responses
            WHERE id = $1
          `,
          [repeated.response]
        );
        expect(repeatedResponse).toMatchObject({
          assignment_id: null,
          provider_key: null,
        });
        const repeatedEvents = await client.query(
          `
            SELECT metadata
            FROM work_request_events
            WHERE work_request_id = $1
            ORDER BY id
          `,
          [repeated.request]
        );
        expect(repeatedEvents.rows).toHaveLength(2);
        for (const event of repeatedEvents.rows) {
          expect(event.metadata).not.toHaveProperty("assignmentId");
          expect(event.metadata).not.toHaveProperty("providerKey");
        }
        const repeatedGate = await loadOne(
          client,
          `
            SELECT
              contact_gate_state,
              contact_gate_assignment_id,
              contact_gate_provider_key
            FROM direct_connect_dispatch_requests
            WHERE id = $1
          `,
          [repeated.request]
        );
        expect(repeatedGate).toMatchObject({
          contact_gate_state: "locked",
          contact_gate_assignment_id: null,
          contact_gate_provider_key: null,
        });
        const repeatedQuarantine = await loadOne(
          client,
          `
            SELECT details_json
            FROM direct_connect_binding_repair_quarantine
            WHERE id = $1
              AND resolved_at IS NULL
          `,
          [`exact-binding:${repeated.assignment}`]
        );
        expect(repeatedQuarantine.details_json).toMatchObject({
          acceptedEventCount: 2,
          hasSingleAcceptedConversationEvent: false,
        });

        const partialResponse = await loadOne(
          client,
          `
            SELECT assignment_id, provider_key
            FROM direct_connect_contractor_responses
            WHERE id = $1
          `,
          [partial.response]
        );
        expect(partialResponse).toMatchObject({
          assignment_id: partial.assignment,
          provider_key: null,
        });
        const synthesizedPartialResponse = await loadOne(
          client,
          `
            SELECT COUNT(*)::int AS count
            FROM direct_connect_contractor_responses
            WHERE id = $1
          `,
          [`recovered:${partial.assignment}`]
        );
        expect(synthesizedPartialResponse.count).toBe(0);
        const partialEvent = await loadOne(
          client,
          `
            SELECT metadata
            FROM work_request_events
            WHERE id = $1
          `,
          [partial.event]
        );
        expect(partialEvent.metadata).not.toHaveProperty("assignmentId");
        expect(partialEvent.metadata).not.toHaveProperty("providerKey");
        const partialGate = await loadOne(
          client,
          `
            SELECT contact_gate_state
            FROM direct_connect_dispatch_requests
            WHERE id = $1
          `,
          [partial.request]
        );
        expect(partialGate.contact_gate_state).toBe("locked");
        const partialQuarantine = await loadOne(
          client,
          `
            SELECT details_json
            FROM direct_connect_binding_repair_quarantine
            WHERE id = $1
              AND resolved_at IS NULL
          `,
          [`exact-binding:${partial.assignment}`]
        );
        expect(partialQuarantine.details_json).toMatchObject({
          hasExactAcceptanceChain: false,
          hasExactContactGate: false,
        });

        const laterResponse = await loadOne(
          client,
          `
            SELECT assignment_id, provider_key
            FROM direct_connect_contractor_responses
            WHERE id = $1
          `,
          [later.response]
        );
        expect(laterResponse).toMatchObject({
          assignment_id: null,
          provider_key: null,
        });

        const multiGate = await loadOne(
          client,
          `
            SELECT
              contact_gate_state,
              contact_gate_assignment_id,
              contact_gate_provider_key
            FROM direct_connect_dispatch_requests
            WHERE id = $1
          `,
          [multi.request]
        );
        expect(multiGate).toMatchObject({
          contact_gate_state: "locked",
          contact_gate_assignment_id: null,
          contact_gate_provider_key: null,
        });
        const multiQuarantine = await client.query(
          `
            SELECT assignment_id, details_json
            FROM direct_connect_binding_repair_quarantine
            WHERE request_id = $1
              AND reason = 'exact_binding_incomplete'
              AND resolved_at IS NULL
            ORDER BY assignment_id
          `,
          [multi.request]
        );
        expect(multiQuarantine.rows).toHaveLength(2);
        expect(
          multiQuarantine.rows.every((row) => row.details_json?.hasSingleActiveAssignment === false)
        ).toBe(true);

        const requestIds = requestOwners.map(([requestId]) => requestId);
        const firstMigrationSnapshot = await loadMigrationSnapshot(client, requestIds);
        await client.query(migrationSql);
        const secondMigrationSnapshot = await loadMigrationSnapshot(client, requestIds);
        expect(secondMigrationSnapshot).toEqual(firstMigrationSnapshot);
      } finally {
        if (transactionStarted) {
          await client.query("ROLLBACK").catch(() => {});
        }
        await client.end();
      }
    },
    TEST_TIMEOUT_MS
  );
});
