-- Bind contact consent and release to the exact accepted assignment/provider.
-- Historical response rows are backfilled only when one accepted event is an
-- unambiguous match; every ambiguous row remains unbound and fails closed.

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

CREATE TABLE IF NOT EXISTS direct_connect_dispatch_candidates (
  id text PRIMARY KEY,
  request_id text NOT NULL
    REFERENCES direct_connect_dispatch_requests(id) ON DELETE CASCADE,
  business_id text NULL,
  contractor_id text NULL,
  responder_user_id text NULL,
  worker_id text NULL,
  eligibility_state text NOT NULL,
  eligibility_reasons jsonb NOT NULL DEFAULT '[]'::jsonb,
  ineligibility_reasons jsonb NOT NULL DEFAULT '[]'::jsonb,
  territory_matched boolean NOT NULL DEFAULT false,
  category_matched boolean NOT NULL DEFAULT false,
  verification_state text NOT NULL DEFAULT 'unknown',
  profile_readiness text NOT NULL DEFAULT 'unknown',
  contact_eligibility boolean NOT NULL DEFAULT false,
  trust_state text NOT NULL DEFAULT 'unknown',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_dc_contractor_responses_assignment_binding
  ON direct_connect_contractor_responses(
    request_id,
    assignment_id,
    provider_key,
    created_at DESC
  )
  WHERE assignment_id IS NOT NULL AND provider_key IS NOT NULL;

CREATE TABLE IF NOT EXISTS direct_connect_binding_repair_quarantine (
  id text PRIMARY KEY,
  request_id text NOT NULL,
  assignment_id text NULL,
  reason text NOT NULL,
  details_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz NULL
);

DO $$
BEGIN
  IF to_regclass('public.direct_connect_dispatch_requests') IS NOT NULL THEN
    ALTER TABLE direct_connect_dispatch_requests
      ADD COLUMN IF NOT EXISTS contact_gate_assignment_id text,
      ADD COLUMN IF NOT EXISTS contact_gate_provider_key text;
  END IF;

  IF to_regclass('public.work_requests') IS NOT NULL THEN
    INSERT INTO direct_connect_dispatch_requests (
      id,
      user_id,
      anonymous_session_id,
      intent,
      request_type,
      category,
      county,
      city_area,
      urgency,
      description,
      answers_json,
      completeness_state,
      routing_readiness_state,
      visibility_state,
      contact_gate_state,
      source_surface,
      created_at,
      updated_at
    )
    SELECT
      request.id,
      request.created_by_user_id,
      null,
      COALESCE(NULLIF(request.title, ''), 'Direct Connect request'),
      COALESCE(NULLIF(request.category, ''), 'project'),
      COALESCE(NULLIF(request.category, ''), 'general'),
      request.county_fips,
      null,
      null,
      request.description,
      '{}'::jsonb,
      'complete',
      'ready',
      'private',
      'locked',
      'migration_0114',
      COALESCE(request.created_at, now()),
      COALESCE(request.updated_at, request.created_at, now())
    FROM work_requests request
    WHERE request.source = 'direct_connect'
    ON CONFLICT (id) DO NOTHING;
  END IF;

  IF to_regclass('public.work_request_assignments') IS NOT NULL THEN
    LOCK TABLE work_request_assignments IN SHARE ROW EXCLUSIVE MODE;

    WITH contractor_provider_candidates AS (
      SELECT
        assignment.id AS assignment_id,
        assignment.work_request_id,
        'contractor:' || assignment.contractor_id AS provider_key,
        COUNT(*) OVER (
          PARTITION BY assignment.work_request_id, assignment.contractor_id
        ) AS null_assignment_count
      FROM work_request_assignments assignment
      WHERE assignment.provider_key IS NULL
        AND assignment.contractor_id IS NOT NULL
    )
    UPDATE work_request_assignments assignment
    SET provider_key = candidate.provider_key
    FROM contractor_provider_candidates candidate
    WHERE assignment.id = candidate.assignment_id
      AND candidate.null_assignment_count = 1
      AND assignment.provider_key IS NULL
      AND NOT EXISTS (
        SELECT 1
        FROM work_request_assignments existing
        WHERE existing.work_request_id = candidate.work_request_id
          AND existing.provider_key = candidate.provider_key
      );

    WITH worker_provider_candidates AS (
      SELECT
        assignment.id AS assignment_id,
        assignment.work_request_id,
        'worker:' || assignment.worker_id AS provider_key,
        COUNT(*) OVER (
          PARTITION BY assignment.work_request_id, assignment.worker_id
        ) AS null_assignment_count
      FROM work_request_assignments assignment
      WHERE assignment.provider_key IS NULL
        AND assignment.contractor_id IS NULL
        AND assignment.worker_id IS NOT NULL
    )
    UPDATE work_request_assignments assignment
    SET provider_key = candidate.provider_key
    FROM worker_provider_candidates candidate
    WHERE assignment.id = candidate.assignment_id
      AND candidate.null_assignment_count = 1
      AND assignment.provider_key IS NULL
      AND NOT EXISTS (
        SELECT 1
        FROM work_request_assignments existing
        WHERE existing.work_request_id = candidate.work_request_id
          AND existing.provider_key = candidate.provider_key
      );
  END IF;

  IF to_regclass('public.work_request_assignments') IS NOT NULL
    AND to_regclass('public.direct_connect_dispatch_candidates') IS NOT NULL
    AND to_regclass('public.businesses') IS NOT NULL THEN
    WITH responder_assignments AS (
      SELECT
        assignment.id AS assignment_id,
        assignment.work_request_id,
        assignment.responder_user_id
      FROM work_request_assignments assignment
      WHERE assignment.provider_key IS NULL
        AND assignment.contractor_id IS NULL
        AND assignment.worker_id IS NULL
        AND assignment.responder_user_id IS NOT NULL
    ),
    dispatch_provider_candidates AS (
      SELECT DISTINCT
        assignment.assignment_id,
        assignment.work_request_id,
        CASE
          WHEN candidate.business_id IS NOT NULL
            THEN 'business:' || candidate.business_id
          ELSE 'responder:' || assignment.responder_user_id
        END AS provider_key
      FROM responder_assignments assignment
      INNER JOIN direct_connect_dispatch_candidates candidate
        ON candidate.request_id = assignment.work_request_id
        AND candidate.responder_user_id = assignment.responder_user_id
        AND candidate.eligibility_state = 'eligible'
    ),
    responder_fallback_provider_candidates AS (
      SELECT
        assignment.assignment_id,
        assignment.work_request_id,
        'responder:' || assignment.responder_user_id AS provider_key
      FROM responder_assignments assignment
      WHERE NOT EXISTS (
        SELECT 1
        FROM dispatch_provider_candidates candidate
        WHERE candidate.assignment_id = assignment.assignment_id
      )
    ),
    responder_provider_candidates AS (
      SELECT * FROM dispatch_provider_candidates
      UNION
      SELECT * FROM responder_fallback_provider_candidates
    ),
    responder_provider_candidate_counts AS (
      SELECT
        candidate.*,
        COUNT(*) OVER (
          PARTITION BY candidate.assignment_id
        ) AS assignment_provider_count,
        COUNT(*) OVER (
          PARTITION BY candidate.work_request_id, candidate.provider_key
        ) AS provider_assignment_count
      FROM responder_provider_candidates candidate
    ),
    unambiguous_responder_providers AS (
      SELECT
        assignment_id,
        work_request_id,
        provider_key
      FROM responder_provider_candidate_counts
      WHERE assignment_provider_count = 1
        AND provider_assignment_count = 1
    )
    UPDATE work_request_assignments assignment
    SET provider_key = candidate.provider_key
    FROM unambiguous_responder_providers candidate
    WHERE assignment.id = candidate.assignment_id
      AND assignment.provider_key IS NULL
      AND NOT EXISTS (
        SELECT 1
        FROM work_request_assignments existing
        WHERE existing.work_request_id = candidate.work_request_id
          AND existing.provider_key = candidate.provider_key
      );
  END IF;

  IF to_regclass('public.direct_connect_contractor_responses') IS NOT NULL
    AND to_regclass('public.work_request_assignments') IS NOT NULL
    AND to_regclass('public.contractors') IS NOT NULL
    AND to_regclass('public.workers') IS NOT NULL
    AND to_regclass('public.businesses') IS NOT NULL THEN
    WITH exact_nonaccepted_response_candidates AS (
      SELECT
        response.id AS response_id,
        assignment.id AS assignment_id,
        assignment.provider_key
      FROM direct_connect_contractor_responses response
      INNER JOIN work_request_assignments assignment
        ON assignment.work_request_id = response.request_id
        AND assignment.status IN ('suggested', 'invited')
        AND assignment.provider_key IS NOT NULL
        AND assignment.created_at <= response.created_at
      LEFT JOIN contractors contractor
        ON contractor.id = assignment.contractor_id
      LEFT JOIN workers worker
        ON worker.id = assignment.worker_id
      LEFT JOIN businesses business
        ON assignment.provider_key = 'business:' || business.id
      WHERE NULLIF(BTRIM(response.assignment_id), '') IS NULL
        AND NULLIF(BTRIM(response.provider_key), '') IS NULL
        AND response.response_type IN ('interested', 'need_more_info')
        AND response.contractor_id IS NOT DISTINCT FROM assignment.contractor_id
        AND (
          (
            assignment.contractor_id IS NOT NULL
            AND assignment.provider_key = 'contractor:' || assignment.contractor_id
            AND response.responder_user_id = contractor.user_id
            AND (
              assignment.responder_user_id IS NULL
              OR assignment.responder_user_id = contractor.user_id
            )
          )
          OR (
            assignment.worker_id IS NOT NULL
            AND assignment.provider_key = 'worker:' || assignment.worker_id
            AND response.responder_user_id = worker.user_id
            AND assignment.responder_user_id = worker.user_id
          )
          OR (
            assignment.contractor_id IS NULL
            AND assignment.worker_id IS NULL
            AND response.responder_user_id = assignment.responder_user_id
            AND (
              assignment.provider_key = 'responder:' || assignment.responder_user_id
              OR (
                business.id IS NOT NULL
                AND assignment.provider_key = 'business:' || business.id
                AND business.owner_user_id = assignment.responder_user_id
              )
            )
          )
        )
    ),
    counted_nonaccepted_response_candidates AS (
      SELECT
        candidate.*,
        COUNT(*) OVER (
          PARTITION BY candidate.response_id
        ) AS candidate_count
      FROM exact_nonaccepted_response_candidates candidate
    )
    UPDATE direct_connect_contractor_responses response
    SET
      assignment_id = candidate.assignment_id,
      provider_key = candidate.provider_key
    FROM counted_nonaccepted_response_candidates candidate
    WHERE response.id = candidate.response_id
      AND candidate.candidate_count = 1;
  END IF;

  IF to_regclass('public.direct_connect_contractor_responses') IS NOT NULL
    AND to_regclass('public.work_request_events') IS NOT NULL
    AND to_regclass('public.work_request_assignments') IS NOT NULL
    AND to_regclass('public.work_requests') IS NOT NULL
    AND to_regclass('public.conversations') IS NOT NULL
    AND to_regclass('public.contractors') IS NOT NULL
    AND to_regclass('public.workers') IS NOT NULL
    AND to_regclass('public.businesses') IS NOT NULL THEN
    DROP TABLE IF EXISTS pg_temp.direct_connect_exact_binding_repair_stage;

    CREATE TEMP TABLE direct_connect_exact_binding_repair_stage
    ON COMMIT DROP
    AS
    WITH accepted_event_windows AS (
      SELECT
        event.id AS event_id,
        event.work_request_id AS request_id,
        event.actor_user_id,
        event.metadata,
        event.created_at AS accepted_at,
        LEAD(event.created_at) OVER (
          PARTITION BY event.work_request_id, event.actor_user_id
          ORDER BY event.created_at, event.id
        ) AS next_accepted_at,
        COUNT(*) OVER (
          PARTITION BY event.work_request_id
        ) AS request_event_count,
        COUNT(*) OVER (
          PARTITION BY event.work_request_id, event.actor_user_id, event.created_at
        ) AS same_timestamp_event_count
      FROM work_request_events event
      WHERE event.type::text = 'provider_accepted'
    ),
    active_assignments AS (
      SELECT
        assignment.id AS assignment_id,
        assignment.work_request_id AS request_id,
        assignment.provider_key,
        assignment.contractor_id,
        assignment.responder_user_id,
        assignment.worker_id,
        assignment.response_summary,
        assignment.created_at AS assignment_created_at,
        request.created_by_user_id AS requester_user_id,
        identity.provider_user_id,
        identity.provider_user_count,
        CASE
          WHEN assignment.contractor_id IS NOT NULL
            THEN assignment.provider_key = 'contractor:' || assignment.contractor_id
              AND assignment.worker_id IS NULL
          WHEN assignment.worker_id IS NOT NULL
            THEN assignment.provider_key = 'worker:' || assignment.worker_id
              AND assignment.contractor_id IS NULL
          WHEN assignment.responder_user_id IS NOT NULL
            THEN (
              assignment.provider_key = 'responder:' || assignment.responder_user_id
              OR (
                business.id IS NOT NULL
                AND assignment.provider_key = 'business:' || business.id
                AND business.owner_user_id = assignment.responder_user_id
              )
            )
          ELSE false
        END AS provider_key_valid
      FROM work_request_assignments assignment
      INNER JOIN work_requests request
        ON request.id = assignment.work_request_id
        AND request.source = 'direct_connect'
      LEFT JOIN contractors contractor
        ON contractor.id = assignment.contractor_id
      LEFT JOIN workers worker
        ON worker.id = assignment.worker_id
      LEFT JOIN businesses business
        ON assignment.provider_key = 'business:' || business.id
      CROSS JOIN LATERAL (
        SELECT
          MIN(candidate.user_id) AS provider_user_id,
          COUNT(DISTINCT candidate.user_id) AS provider_user_count
        FROM (
          VALUES
            (NULLIF(BTRIM(contractor.user_id), '')),
            (NULLIF(BTRIM(worker.user_id), '')),
            (NULLIF(BTRIM(business.owner_user_id), '')),
            (NULLIF(BTRIM(assignment.responder_user_id), ''))
        ) AS candidate(user_id)
        WHERE candidate.user_id IS NOT NULL
      ) identity
      WHERE assignment.status IN ('accepted', 'completed')
        AND assignment.provider_key IS NOT NULL
    ),
    counted_assignments AS (
      SELECT
        assignment.*,
        COUNT(*) OVER (
          PARTITION BY assignment.request_id
        ) AS active_assignment_count
      FROM active_assignments assignment
    ),
    raw_event_assignment_candidates AS (
      SELECT
        event.event_id,
        event.request_id,
        event.actor_user_id,
        event.metadata,
        event.accepted_at,
        event.next_accepted_at,
        event.request_event_count,
        event.same_timestamp_event_count,
        assignment.assignment_id,
        assignment.provider_key,
        assignment.contractor_id,
        assignment.provider_user_id,
        assignment.response_summary,
        assignment.active_assignment_count
      FROM accepted_event_windows event
      INNER JOIN counted_assignments assignment
        ON assignment.request_id = event.request_id
      INNER JOIN conversations conversation
        ON conversation.id = event.metadata->>'conversationId'
        AND conversation.homeowner_id = assignment.requester_user_id
        AND conversation.contractor_id =
          COALESCE(assignment.contractor_id, assignment.provider_user_id)
        AND conversation.status = 'active'
      WHERE event.request_event_count = 1
        AND event.same_timestamp_event_count = 1
        AND assignment.active_assignment_count = 1
        AND assignment.provider_user_count = 1
        AND assignment.provider_key_valid
        AND event.actor_user_id = assignment.provider_user_id
        AND assignment.assignment_created_at <= event.accepted_at
        AND NULLIF(BTRIM(event.metadata->>'assignmentId'), '') IS NULL
        AND NULLIF(BTRIM(event.metadata->>'providerKey'), '') IS NULL
        AND (
          NULLIF(BTRIM(event.metadata->>'contractorId'), '') IS NULL
          OR event.metadata->>'contractorId' = assignment.contractor_id
        )
        AND (
          NULLIF(BTRIM(event.metadata->>'responderUserId'), '') IS NULL
          OR event.metadata->>'responderUserId' = assignment.provider_user_id
        )
        AND (
          NULLIF(BTRIM(event.metadata->>'workerId'), '') IS NULL
          OR event.metadata->>'workerId' = assignment.worker_id
        )
    ),
    counted_event_assignment_candidates AS (
      SELECT
        candidate.*,
        COUNT(*) OVER (
          PARTITION BY candidate.event_id
        ) AS event_assignment_count,
        COUNT(*) OVER (
          PARTITION BY candidate.assignment_id
        ) AS assignment_event_count
      FROM raw_event_assignment_candidates candidate
    )
    SELECT
      candidate.*,
      eligible_response.response_count AS eligible_response_count,
      eligible_response.response_id AS eligible_response_id,
      unsafe_response.response_count AS unsafe_response_count
    FROM counted_event_assignment_candidates candidate
    CROSS JOIN LATERAL (
      SELECT
        COUNT(*) AS response_count,
        MIN(response.id) AS response_id
      FROM direct_connect_contractor_responses response
      WHERE response.request_id = candidate.request_id
        AND response.responder_user_id = candidate.provider_user_id
        AND response.contractor_id IS NOT DISTINCT FROM candidate.contractor_id
        AND response.response_type IN ('interested', 'need_more_info')
        AND response.contact_request_state IN (
          'contractor_requested',
          'user_approved',
          'released'
        )
        AND (
          (
            NULLIF(BTRIM(response.assignment_id), '') IS NULL
            AND NULLIF(BTRIM(response.provider_key), '') IS NULL
          )
          OR (
            response.assignment_id = candidate.assignment_id
            AND response.provider_key = candidate.provider_key
          )
        )
        AND response.created_at >= candidate.accepted_at
        AND (
          candidate.next_accepted_at IS NULL
          OR response.created_at < candidate.next_accepted_at
        )
    ) eligible_response
    CROSS JOIN LATERAL (
      SELECT COUNT(*) AS response_count
      FROM direct_connect_contractor_responses response
      WHERE response.request_id = candidate.request_id
        AND response.responder_user_id = candidate.provider_user_id
        AND response.contractor_id IS NOT DISTINCT FROM candidate.contractor_id
        AND response.response_type IN ('interested', 'need_more_info')
        AND (
          response.contact_request_state IN (
            'contractor_requested',
            'user_approved',
            'released'
          )
          AND (
            (
              NULLIF(BTRIM(response.assignment_id), '') IS NULL
              AND NULLIF(BTRIM(response.provider_key), '') IS NULL
            )
            OR (
              response.assignment_id = candidate.assignment_id
              AND response.provider_key = candidate.provider_key
            )
          )
          AND response.created_at >= candidate.accepted_at
          AND (
            candidate.next_accepted_at IS NULL
            OR response.created_at < candidate.next_accepted_at
          )
        ) IS NOT TRUE
    ) unsafe_response
    WHERE candidate.event_assignment_count = 1
      AND candidate.assignment_event_count = 1;

    UPDATE direct_connect_contractor_responses response
    SET
      assignment_id = stage.assignment_id,
      provider_key = stage.provider_key
    FROM direct_connect_exact_binding_repair_stage stage
    WHERE response.id = stage.eligible_response_id
      AND stage.eligible_response_count = 1
      AND stage.unsafe_response_count = 0;

    INSERT INTO direct_connect_contractor_responses (
      id,
      request_id,
      contractor_id,
      responder_user_id,
      assignment_id,
      provider_key,
      response_type,
      message,
      availability,
      estimated_timing,
      contact_request_state,
      created_at
    )
    SELECT
      'recovered:' || stage.assignment_id,
      stage.request_id,
      stage.contractor_id,
      stage.provider_user_id,
      stage.assignment_id,
      stage.provider_key,
      'interested',
      COALESCE(
        stage.metadata->'responseSummary'->>'scopeNote',
        stage.response_summary->>'scopeNote'
      ),
      COALESCE(
        stage.metadata->'responseSummary'->>'availabilityWindow',
        stage.response_summary->>'availabilityWindow'
      ),
      COALESCE(
        stage.metadata->'responseSummary'->>'availabilityWindow',
        stage.response_summary->>'availabilityWindow'
      ),
      'contractor_requested',
      stage.accepted_at
    FROM direct_connect_exact_binding_repair_stage stage
    WHERE stage.eligible_response_count = 0
      AND stage.unsafe_response_count = 0
    ON CONFLICT (id) DO NOTHING;

    UPDATE work_request_events event
    SET metadata =
      jsonb_set(
        jsonb_set(
          jsonb_set(
            COALESCE(event.metadata, '{}'::jsonb),
            '{assignmentId}',
            to_jsonb(stage.assignment_id),
            true
          ),
          '{providerKey}',
          to_jsonb(stage.provider_key),
          true
        ),
        '{authorityBindingVersion}',
        '2'::jsonb,
        true
      )
    FROM direct_connect_exact_binding_repair_stage stage
    WHERE event.id = stage.event_id
      AND stage.eligible_response_count IN (0, 1)
      AND stage.unsafe_response_count = 0
      AND EXISTS (
        SELECT 1
        FROM direct_connect_contractor_responses response
        WHERE response.id = COALESCE(
            stage.eligible_response_id,
            'recovered:' || stage.assignment_id
          )
          AND response.request_id = stage.request_id
          AND response.assignment_id = stage.assignment_id
          AND response.provider_key = stage.provider_key
      );
  END IF;

  IF to_regclass('public.direct_connect_dispatch_requests') IS NOT NULL
    AND to_regclass('public.direct_connect_contractor_responses') IS NOT NULL
    AND to_regclass('public.work_request_assignments') IS NOT NULL
    AND to_regclass('public.work_request_events') IS NOT NULL
    AND to_regclass('public.work_requests') IS NOT NULL
    AND to_regclass('public.conversations') IS NOT NULL
    AND to_regclass('public.contractors') IS NOT NULL
    AND to_regclass('public.workers') IS NOT NULL
    AND to_regclass('public.businesses') IS NOT NULL THEN
    WITH exact_request_binding_chains AS (
      SELECT
        response.request_id,
        response.id AS response_id,
        event.id AS event_id,
        response.assignment_id,
        response.provider_key
      FROM direct_connect_contractor_responses response
      INNER JOIN work_request_assignments assignment
        ON assignment.id = response.assignment_id
        AND assignment.work_request_id = response.request_id
        AND assignment.provider_key = response.provider_key
      INNER JOIN work_requests request
        ON request.id = response.request_id
        AND request.source = 'direct_connect'
      LEFT JOIN contractors contractor
        ON contractor.id = assignment.contractor_id
      LEFT JOIN workers worker
        ON worker.id = assignment.worker_id
      LEFT JOIN businesses business
        ON assignment.provider_key = 'business:' || business.id
      CROSS JOIN LATERAL (
        SELECT
          MIN(candidate.user_id) AS provider_user_id,
          COUNT(DISTINCT candidate.user_id) AS provider_user_count
        FROM (
          VALUES
            (NULLIF(BTRIM(contractor.user_id), '')),
            (NULLIF(BTRIM(worker.user_id), '')),
            (NULLIF(BTRIM(business.owner_user_id), '')),
            (NULLIF(BTRIM(assignment.responder_user_id), ''))
        ) AS candidate(user_id)
        WHERE candidate.user_id IS NOT NULL
      ) identity
      INNER JOIN work_request_events event
        ON event.work_request_id = response.request_id
        AND event.type::text = 'provider_accepted'
        AND event.actor_user_id = identity.provider_user_id
        AND event.metadata->>'assignmentId' = assignment.id
        AND event.metadata->>'providerKey' = assignment.provider_key
        AND response.created_at >= event.created_at
      INNER JOIN conversations conversation
        ON conversation.id = event.metadata->>'conversationId'
        AND conversation.homeowner_id = request.created_by_user_id
        AND conversation.contractor_id =
          COALESCE(assignment.contractor_id, identity.provider_user_id)
        AND conversation.status = 'active'
      WHERE response.assignment_id IS NOT NULL
        AND response.provider_key IS NOT NULL
        AND response.response_type IN ('interested', 'need_more_info')
        AND response.contact_request_state IN (
          'contractor_requested',
          'user_approved',
          'released'
        )
        AND response.responder_user_id = identity.provider_user_id
        AND response.contractor_id IS NOT DISTINCT FROM assignment.contractor_id
        AND assignment.status IN ('accepted', 'completed')
        AND identity.provider_user_count = 1
        AND (
          SELECT COUNT(*)
          FROM work_request_events accepted_event
          WHERE accepted_event.work_request_id = response.request_id
            AND accepted_event.type::text = 'provider_accepted'
        ) = 1
        AND (
          SELECT COUNT(*)
          FROM work_request_assignments active_assignment
          WHERE active_assignment.work_request_id = response.request_id
            AND active_assignment.status IN ('accepted', 'completed')
        ) = 1
        AND (
          (
            assignment.contractor_id IS NOT NULL
            AND assignment.worker_id IS NULL
            AND assignment.provider_key = 'contractor:' || assignment.contractor_id
          )
          OR (
            assignment.worker_id IS NOT NULL
            AND assignment.contractor_id IS NULL
            AND assignment.provider_key = 'worker:' || assignment.worker_id
          )
          OR (
            assignment.contractor_id IS NULL
            AND assignment.worker_id IS NULL
            AND assignment.responder_user_id IS NOT NULL
            AND (
              assignment.provider_key = 'responder:' || assignment.responder_user_id
              OR (
                business.id IS NOT NULL
                AND assignment.provider_key = 'business:' || business.id
                AND business.owner_user_id = assignment.responder_user_id
              )
            )
          )
        )
    ),
    unambiguous_request_bindings AS (
      SELECT
        chain.request_id,
        MIN(chain.assignment_id) AS assignment_id,
        MIN(chain.provider_key) AS provider_key
      FROM exact_request_binding_chains chain
      GROUP BY chain.request_id
      HAVING COUNT(*) = 1
        AND COUNT(DISTINCT (chain.assignment_id, chain.provider_key)) = 1
    )
    UPDATE direct_connect_dispatch_requests request
    SET
      contact_gate_assignment_id = binding.assignment_id,
      contact_gate_provider_key = binding.provider_key,
      contact_gate_state = CASE
        WHEN request.contact_gate_state = 'locked' THEN 'contractor_requested'
        ELSE request.contact_gate_state
      END,
      updated_at = now()
    FROM unambiguous_request_bindings binding
    WHERE request.id = binding.request_id
      AND request.contact_gate_state = 'locked'
      AND (
        (request.contact_gate_assignment_id IS NULL AND request.contact_gate_provider_key IS NULL)
        OR (
          request.contact_gate_assignment_id = binding.assignment_id
          AND request.contact_gate_provider_key = binding.provider_key
        )
      );
  END IF;

  IF to_regclass('public.direct_connect_binding_repair_quarantine') IS NOT NULL
    AND to_regclass('public.work_requests') IS NOT NULL
    AND to_regclass('public.work_request_assignments') IS NOT NULL
    AND to_regclass('public.work_request_events') IS NOT NULL
    AND to_regclass('public.direct_connect_contractor_responses') IS NOT NULL
    AND to_regclass('public.direct_connect_dispatch_requests') IS NOT NULL
    AND to_regclass('public.conversations') IS NOT NULL
    AND to_regclass('public.contractors') IS NOT NULL
    AND to_regclass('public.workers') IS NOT NULL
    AND to_regclass('public.businesses') IS NOT NULL THEN
    UPDATE direct_connect_binding_repair_quarantine
    SET resolved_at = now()
    WHERE resolved_at IS NULL;

    WITH binding_authority AS (
      SELECT
        assignment.id AS assignment_id,
        assignment.work_request_id AS request_id,
        assignment.provider_key,
        assignment.contractor_id,
        assignment.responder_user_id,
        assignment.worker_id,
        assignment.created_at AS assignment_created_at,
        request.created_by_user_id AS requester_user_id,
        identity.provider_user_id,
        identity.provider_user_count,
        CASE
          WHEN assignment.contractor_id IS NOT NULL
            THEN assignment.provider_key = 'contractor:' || assignment.contractor_id
              AND assignment.worker_id IS NULL
              AND (
                assignment.responder_user_id IS NULL
                OR assignment.responder_user_id = contractor.user_id
              )
          WHEN assignment.worker_id IS NOT NULL
            THEN assignment.provider_key = 'worker:' || assignment.worker_id
              AND assignment.contractor_id IS NULL
              AND assignment.responder_user_id = worker.user_id
          WHEN assignment.responder_user_id IS NOT NULL
            THEN (
              assignment.provider_key = 'responder:' || assignment.responder_user_id
              OR (
                business.id IS NOT NULL
                AND assignment.provider_key = 'business:' || business.id
                AND business.owner_user_id = assignment.responder_user_id
              )
            )
          ELSE false
        END AS provider_key_valid,
        (
          SELECT COUNT(*)
          FROM work_request_events event
          WHERE event.work_request_id = assignment.work_request_id
            AND event.type::text = 'provider_accepted'
        ) AS accepted_event_count,
        (
          SELECT COUNT(*)
          FROM work_request_events event
          INNER JOIN conversations conversation
            ON conversation.id = event.metadata->>'conversationId'
            AND conversation.homeowner_id = request.created_by_user_id
            AND conversation.contractor_id =
              COALESCE(assignment.contractor_id, identity.provider_user_id)
            AND conversation.status = 'active'
          INNER JOIN direct_connect_contractor_responses response
            ON response.request_id = event.work_request_id
            AND response.assignment_id = assignment.id
            AND response.provider_key = assignment.provider_key
            AND response.responder_user_id = identity.provider_user_id
            AND response.contractor_id IS NOT DISTINCT FROM assignment.contractor_id
            AND response.response_type IN ('interested', 'need_more_info')
            AND response.contact_request_state IN (
              'contractor_requested',
              'user_approved',
              'released'
            )
            AND response.created_at >= event.created_at
          WHERE event.work_request_id = assignment.work_request_id
            AND event.type::text = 'provider_accepted'
            AND event.actor_user_id = identity.provider_user_id
            AND event.metadata->>'assignmentId' = assignment.id
            AND event.metadata->>'providerKey' = assignment.provider_key
            AND assignment.created_at <= event.created_at
        ) AS exact_acceptance_chain_count,
        EXISTS (
          SELECT 1
          FROM direct_connect_dispatch_requests gate
          WHERE gate.id = assignment.work_request_id
            AND gate.contact_gate_state <> 'locked'
            AND gate.contact_gate_assignment_id = assignment.id
            AND gate.contact_gate_provider_key = assignment.provider_key
        ) AS has_exact_contact_gate,
        (
          SELECT COUNT(*)
          FROM work_request_assignments active_assignment
          WHERE active_assignment.work_request_id = assignment.work_request_id
            AND active_assignment.status IN ('accepted', 'completed')
        ) = 1 AS has_single_active_assignment
      FROM work_request_assignments assignment
      INNER JOIN work_requests request
        ON request.id = assignment.work_request_id
        AND request.source = 'direct_connect'
      LEFT JOIN contractors contractor
        ON contractor.id = assignment.contractor_id
      LEFT JOIN workers worker
        ON worker.id = assignment.worker_id
      LEFT JOIN businesses business
        ON assignment.provider_key = 'business:' || business.id
      CROSS JOIN LATERAL (
        SELECT
          MIN(candidate.user_id) AS provider_user_id,
          COUNT(DISTINCT candidate.user_id) AS provider_user_count
        FROM (
          VALUES
            (NULLIF(BTRIM(contractor.user_id), '')),
            (NULLIF(BTRIM(worker.user_id), '')),
            (NULLIF(BTRIM(business.owner_user_id), '')),
            (NULLIF(BTRIM(assignment.responder_user_id), ''))
        ) AS candidate(user_id)
        WHERE candidate.user_id IS NOT NULL
      ) identity
      WHERE assignment.status IN ('accepted', 'completed')
    ),
    binding_readiness AS (
      SELECT
        authority.*,
        (
          NULLIF(BTRIM(authority.provider_key), '') IS NOT NULL
          AND authority.provider_key_valid
          AND authority.provider_user_count = 1
        ) AS has_provider_key,
        authority.exact_acceptance_chain_count = 1 AS has_accepted_conversation_event,
        authority.accepted_event_count = 1 AS has_single_accepted_conversation_event,
        authority.exact_acceptance_chain_count = 1 AS has_single_bound_response,
        authority.exact_acceptance_chain_count = 1 AS has_exact_acceptance_chain,
        authority.exact_acceptance_chain_count = 1 AS has_bound_response
      FROM binding_authority authority
    )
    INSERT INTO direct_connect_binding_repair_quarantine (
      id,
      request_id,
      assignment_id,
      reason,
      details_json,
      created_at,
      resolved_at
    )
    SELECT
      'exact-binding:' || readiness.assignment_id,
      readiness.request_id,
      readiness.assignment_id,
      'exact_binding_incomplete',
      jsonb_build_object(
        'hasProviderKey', readiness.has_provider_key,
        'hasAcceptedConversationEvent', readiness.has_accepted_conversation_event,
        'hasSingleAcceptedConversationEvent',
          readiness.has_single_accepted_conversation_event,
        'hasSingleBoundResponse', readiness.has_single_bound_response,
        'hasExactAcceptanceChain', readiness.has_exact_acceptance_chain,
        'hasBoundResponse', readiness.has_bound_response,
        'hasExactContactGate', readiness.has_exact_contact_gate,
        'providerUserCount', readiness.provider_user_count,
        'acceptedEventCount', readiness.accepted_event_count,
        'exactAcceptanceChainCount', readiness.exact_acceptance_chain_count,
        'hasSingleActiveAssignment', readiness.has_single_active_assignment
      ),
      now(),
      null
    FROM binding_readiness readiness
    WHERE NOT (
      readiness.has_provider_key
      AND readiness.has_accepted_conversation_event
      AND readiness.has_single_accepted_conversation_event
      AND readiness.has_single_bound_response
      AND readiness.has_exact_acceptance_chain
      AND readiness.has_bound_response
      AND readiness.has_exact_contact_gate
      AND readiness.has_single_active_assignment
    )
    ON CONFLICT (id) DO UPDATE SET
      reason = EXCLUDED.reason,
      details_json = EXCLUDED.details_json,
      resolved_at = null;

    IF to_regclass('public.direct_connect_dispatch_candidates') IS NOT NULL THEN
      WITH responder_provider_candidates AS (
      SELECT
        assignment.id AS assignment_id,
        COUNT(DISTINCT (
          CASE
            WHEN candidate.business_id IS NOT NULL
              THEN 'business:' || candidate.business_id
            ELSE 'responder:' || assignment.responder_user_id
          END
        )) AS provider_candidate_count,
        MIN(
          CASE
            WHEN candidate.business_id IS NOT NULL
              THEN 'business:' || candidate.business_id
            ELSE 'responder:' || assignment.responder_user_id
          END
        ) AS derived_provider_key
      FROM work_request_assignments assignment
      LEFT JOIN direct_connect_dispatch_candidates candidate
        ON candidate.request_id = assignment.work_request_id
        AND candidate.responder_user_id = assignment.responder_user_id
        AND candidate.eligibility_state = 'eligible'
      WHERE assignment.provider_key IS NULL
        AND assignment.contractor_id IS NULL
        AND assignment.worker_id IS NULL
        AND assignment.responder_user_id IS NOT NULL
      GROUP BY assignment.id
    ),
    null_provider_candidates AS (
      SELECT
        assignment.id AS assignment_id,
        assignment.work_request_id AS request_id,
        assignment.status,
        CASE
          WHEN assignment.contractor_id IS NOT NULL
            THEN 'contractor:' || assignment.contractor_id
          WHEN assignment.worker_id IS NOT NULL
            THEN 'worker:' || assignment.worker_id
          ELSE responder.derived_provider_key
        END AS derived_provider_key,
        CASE
          WHEN assignment.contractor_id IS NOT NULL OR assignment.worker_id IS NOT NULL
            THEN 1
          ELSE COALESCE(responder.provider_candidate_count, 0)
        END AS provider_candidate_count
      FROM work_request_assignments assignment
      INNER JOIN work_requests request
        ON request.id = assignment.work_request_id
        AND request.source = 'direct_connect'
      LEFT JOIN responder_provider_candidates responder
        ON responder.assignment_id = assignment.id
      WHERE assignment.provider_key IS NULL
    ),
    counted_null_provider_candidates AS (
      SELECT
        candidate.*,
        CASE
          WHEN candidate.derived_provider_key IS NULL THEN 0
          ELSE COUNT(*) OVER (
            PARTITION BY candidate.request_id, candidate.derived_provider_key
          )
        END AS null_candidate_count,
        CASE
          WHEN candidate.derived_provider_key IS NULL THEN 0
          ELSE (
            SELECT COUNT(*)
            FROM work_request_assignments existing
            WHERE existing.work_request_id = candidate.request_id
              AND existing.provider_key = candidate.derived_provider_key
          )
        END AS existing_bound_count
      FROM null_provider_candidates candidate
    )
    INSERT INTO direct_connect_binding_repair_quarantine (
      id,
      request_id,
      assignment_id,
      reason,
      details_json,
      created_at,
      resolved_at
    )
    SELECT
      'provider-key:' || candidate.assignment_id,
      candidate.request_id,
      candidate.assignment_id,
      'provider_key_binding_ambiguous',
      jsonb_build_object(
        'status', candidate.status,
        'derivedProviderKey', candidate.derived_provider_key,
        'providerCandidateCount', candidate.provider_candidate_count,
        'nullCandidateCount', candidate.null_candidate_count,
        'existingBoundCount', candidate.existing_bound_count
      ),
      now(),
      null
    FROM counted_null_provider_candidates candidate
    WHERE candidate.provider_candidate_count <> 1
      OR candidate.derived_provider_key IS NULL
      OR candidate.null_candidate_count <> 1
      OR candidate.existing_bound_count <> 0
      ON CONFLICT (id) DO UPDATE SET
        reason = EXCLUDED.reason,
        details_json = EXCLUDED.details_json,
        resolved_at = null;
    END IF;
  END IF;
END
$$;

CREATE OR REPLACE FUNCTION enforce_direct_connect_assignment_provider_key()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  is_direct_connect boolean;
  business_provider_id text;
BEGIN
  SELECT request.source = 'direct_connect'
  INTO is_direct_connect
  FROM work_requests request
  WHERE request.id = NEW.work_request_id;

  IF NOT COALESCE(is_direct_connect, false)
    OR NEW.status NOT IN ('suggested', 'invited', 'accepted', 'completed') THEN
    RETURN NEW;
  END IF;

  IF NULLIF(BTRIM(NEW.provider_key), '') IS NULL THEN
    RAISE EXCEPTION 'DIRECT_CONNECT_ASSIGNMENT_PROVIDER_KEY_REQUIRED';
  END IF;

  IF NEW.contractor_id IS NOT NULL THEN
    IF NEW.worker_id IS NOT NULL
      OR NEW.provider_key <> 'contractor:' || NEW.contractor_id THEN
      RAISE EXCEPTION 'DIRECT_CONNECT_ASSIGNMENT_PROVIDER_KEY_MISMATCH';
    END IF;
    IF NEW.responder_user_id IS NOT NULL
      AND NOT EXISTS (
        SELECT 1
        FROM contractors contractor
        WHERE contractor.id = NEW.contractor_id
          AND contractor.user_id = NEW.responder_user_id
      ) THEN
      RAISE EXCEPTION 'DIRECT_CONNECT_ASSIGNMENT_PROVIDER_IDENTITY_MISMATCH';
    END IF;
    RETURN NEW;
  END IF;

  IF NEW.worker_id IS NOT NULL THEN
    IF NEW.provider_key <> 'worker:' || NEW.worker_id
      OR NOT EXISTS (
        SELECT 1
        FROM workers worker
        WHERE worker.id = NEW.worker_id
          AND worker.user_id = NEW.responder_user_id
      ) THEN
      RAISE EXCEPTION 'DIRECT_CONNECT_ASSIGNMENT_PROVIDER_KEY_MISMATCH';
    END IF;
    RETURN NEW;
  END IF;

  IF NEW.responder_user_id IS NULL THEN
    RAISE EXCEPTION 'DIRECT_CONNECT_ASSIGNMENT_PROVIDER_IDENTITY_REQUIRED';
  END IF;

  IF NEW.provider_key = 'responder:' || NEW.responder_user_id THEN
    RETURN NEW;
  END IF;

  IF NEW.provider_key LIKE 'business:%' THEN
    business_provider_id := SUBSTRING(NEW.provider_key FROM LENGTH('business:') + 1);
    IF EXISTS (
      SELECT 1
      FROM businesses business
      WHERE business.id = business_provider_id
        AND business.owner_user_id = NEW.responder_user_id
    ) THEN
      RETURN NEW;
    END IF;
  END IF;

  RAISE EXCEPTION 'DIRECT_CONNECT_ASSIGNMENT_PROVIDER_KEY_MISMATCH';
END
$$;

DROP TRIGGER IF EXISTS enforce_direct_connect_assignment_provider_key
  ON work_request_assignments;

CREATE TRIGGER enforce_direct_connect_assignment_provider_key
BEFORE INSERT OR UPDATE OF
  work_request_id,
  provider_key,
  contractor_id,
  responder_user_id,
  worker_id,
  status
ON work_request_assignments
FOR EACH ROW
EXECUTE FUNCTION enforce_direct_connect_assignment_provider_key();

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'dc_response_binding_pair_check'
      AND conrelid = 'public.direct_connect_contractor_responses'::regclass
  ) THEN
    ALTER TABLE direct_connect_contractor_responses
      ADD CONSTRAINT dc_response_binding_pair_check
      CHECK (
        (
          NULLIF(BTRIM(assignment_id), '') IS NULL
          AND NULLIF(BTRIM(provider_key), '') IS NULL
        )
        OR (
          NULLIF(BTRIM(assignment_id), '') IS NOT NULL
          AND NULLIF(BTRIM(provider_key), '') IS NOT NULL
        )
      )
      NOT VALID;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'dc_actionable_response_exact_binding_check'
      AND conrelid = 'public.direct_connect_contractor_responses'::regclass
  ) THEN
    ALTER TABLE direct_connect_contractor_responses
      ADD CONSTRAINT dc_actionable_response_exact_binding_check
      CHECK (
        response_type NOT IN ('interested', 'need_more_info')
        OR contact_request_state NOT IN (
          'contractor_requested',
          'user_approved',
          'released'
        )
        OR (
          NULLIF(BTRIM(assignment_id), '') IS NOT NULL
          AND NULLIF(BTRIM(provider_key), '') IS NOT NULL
        )
      )
      NOT VALID;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'dc_contact_gate_binding_pair_check'
      AND conrelid = 'public.direct_connect_dispatch_requests'::regclass
  ) THEN
    ALTER TABLE direct_connect_dispatch_requests
      ADD CONSTRAINT dc_contact_gate_binding_pair_check
      CHECK (
        (
          NULLIF(BTRIM(contact_gate_assignment_id), '') IS NULL
          AND NULLIF(BTRIM(contact_gate_provider_key), '') IS NULL
        )
        OR (
          NULLIF(BTRIM(contact_gate_assignment_id), '') IS NOT NULL
          AND NULLIF(BTRIM(contact_gate_provider_key), '') IS NOT NULL
        )
      )
      NOT VALID;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'dc_advanced_contact_gate_exact_binding_check'
      AND conrelid = 'public.direct_connect_dispatch_requests'::regclass
  ) THEN
    ALTER TABLE direct_connect_dispatch_requests
      ADD CONSTRAINT dc_advanced_contact_gate_exact_binding_check
      CHECK (
        contact_gate_state = 'locked'
        OR (
          NULLIF(BTRIM(contact_gate_assignment_id), '') IS NOT NULL
          AND NULLIF(BTRIM(contact_gate_provider_key), '') IS NOT NULL
        )
      )
      NOT VALID;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'dc_provider_accepted_exact_binding_check'
      AND conrelid = 'public.work_request_events'::regclass
  ) THEN
    ALTER TABLE work_request_events
      ADD CONSTRAINT dc_provider_accepted_exact_binding_check
      CHECK (
        type::text <> 'provider_accepted'
        OR (
          actor_user_id IS NOT NULL
          AND NULLIF(BTRIM(metadata->>'conversationId'), '') IS NOT NULL
          AND NULLIF(BTRIM(metadata->>'assignmentId'), '') IS NOT NULL
          AND NULLIF(BTRIM(metadata->>'providerKey'), '') IS NOT NULL
        )
      )
      NOT VALID;
  END IF;
END
$$;
