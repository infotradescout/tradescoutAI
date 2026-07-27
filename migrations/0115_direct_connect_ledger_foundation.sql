-- Make the Direct Connect dispatch, notification, and job lifecycle ledgers
-- canonical migration-owned schema. Runtime route registration must never be
-- responsible for creating these tables.

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

CREATE TABLE IF NOT EXISTS direct_connect_dispatch_events (
  event_id text PRIMARY KEY,
  request_id text NOT NULL
    REFERENCES direct_connect_dispatch_requests(id) ON DELETE CASCADE,
  actor_type text NOT NULL,
  actor_id text NULL,
  event_type text NOT NULL,
  metadata_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
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

CREATE INDEX IF NOT EXISTS idx_dc_contractor_responses_assignment_binding
  ON direct_connect_contractor_responses(
    request_id,
    assignment_id,
    provider_key,
    created_at DESC
  )
  WHERE assignment_id IS NOT NULL AND provider_key IS NOT NULL;

CREATE TABLE IF NOT EXISTS direct_connect_lifecycle_notifications (
  id text PRIMARY KEY,
  request_id text NOT NULL
    REFERENCES direct_connect_dispatch_requests(id) ON DELETE CASCADE,
  actor_type text NOT NULL,
  actor_id text NULL,
  recipient_type text NOT NULL,
  recipient_id text NOT NULL,
  event_type text NOT NULL,
  lifecycle_status text NOT NULL,
  message_key text NOT NULL,
  message_text text NOT NULL,
  is_read boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS direct_connect_job_workspaces (
  id text PRIMARY KEY,
  request_id text NOT NULL
    REFERENCES direct_connect_dispatch_requests(id) ON DELETE CASCADE,
  requester_user_id text NOT NULL,
  business_id text NULL,
  contractor_id text NULL,
  contractor_response_id text NULL,
  source text NOT NULL DEFAULT 'direct_connect',
  category text NULL,
  county text NULL,
  city_area text NULL,
  status text NOT NULL DEFAULT 'contact_started',
  active_stage text NOT NULL DEFAULT 'contact',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS direct_connect_notifications (
  id text PRIMARY KEY,
  request_id text NOT NULL
    REFERENCES direct_connect_dispatch_requests(id) ON DELETE CASCADE,
  job_workspace_id text NULL
    REFERENCES direct_connect_job_workspaces(id) ON DELETE SET NULL,
  event_id text NULL
    REFERENCES direct_connect_dispatch_events(event_id) ON DELETE SET NULL,
  recipient_user_id text NULL,
  recipient_business_id text NULL,
  recipient_role text NOT NULL,
  actor_type text NOT NULL,
  actor_id text NULL,
  notification_type text NOT NULL,
  title text NOT NULL,
  message text NOT NULL,
  action_url text NULL,
  action_key text NULL,
  status text NOT NULL DEFAULT 'unread',
  priority text NOT NULL DEFAULT 'normal',
  metadata_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  read_at timestamptz NULL,
  archived_at timestamptz NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS direct_connect_notifications_idempotency_idx
  ON direct_connect_notifications (
    COALESCE(event_id, ''),
    recipient_role,
    COALESCE(recipient_user_id, ''),
    COALESCE(recipient_business_id, ''),
    notification_type
  );

CREATE TABLE IF NOT EXISTS job_estimates (
  id text PRIMARY KEY,
  workspace_id text NOT NULL
    REFERENCES direct_connect_job_workspaces(id) ON DELETE CASCADE,
  request_id text NULL
    REFERENCES direct_connect_dispatch_requests(id) ON DELETE SET NULL,
  requester_user_id text NULL,
  business_id text NULL,
  contractor_id text NULL,
  title text NULL,
  scope_summary text NULL,
  status text NOT NULL DEFAULT 'draft',
  subtotal_materials numeric NULL,
  subtotal_labor numeric NULL,
  subtotal_other numeric NULL,
  total_estimate numeric NULL,
  terms text NULL,
  expiration_date timestamptz NULL,
  created_by text NULL,
  sent_at timestamptz NULL,
  responded_at timestamptz NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS job_estimate_line_items (
  id text PRIMARY KEY,
  estimate_id text NOT NULL REFERENCES job_estimates(id) ON DELETE CASCADE,
  line_type text NOT NULL,
  name text NOT NULL,
  description text NULL,
  quantity numeric NULL,
  unit text NULL,
  rate numeric NULL,
  unit_price numeric NULL,
  total_cost numeric NULL,
  supplier text NULL,
  sku text NULL,
  notes text NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS job_material_items (
  id text PRIMARY KEY,
  workspace_id text NOT NULL
    REFERENCES direct_connect_job_workspaces(id) ON DELETE CASCADE,
  label text NOT NULL,
  quantity numeric NULL,
  unit_cost numeric NULL,
  total_cost numeric NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS job_labor_items (
  id text PRIMARY KEY,
  workspace_id text NOT NULL
    REFERENCES direct_connect_job_workspaces(id) ON DELETE CASCADE,
  label text NOT NULL,
  hours numeric NULL,
  hourly_rate numeric NULL,
  total_cost numeric NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS job_acceptances (
  id text PRIMARY KEY,
  workspace_id text NOT NULL
    REFERENCES direct_connect_job_workspaces(id) ON DELETE CASCADE,
  estimate_id text NULL REFERENCES job_estimates(id) ON DELETE SET NULL,
  accepted_by text NOT NULL,
  accepted_at timestamptz NOT NULL DEFAULT now(),
  note text NULL
);

CREATE TABLE IF NOT EXISTS job_payment_requests (
  id text PRIMARY KEY,
  workspace_id text NOT NULL
    REFERENCES direct_connect_job_workspaces(id) ON DELETE CASCADE,
  request_id text NULL
    REFERENCES direct_connect_dispatch_requests(id) ON DELETE SET NULL,
  estimate_id text NULL REFERENCES job_estimates(id) ON DELETE SET NULL,
  requester_user_id text NULL,
  business_id text NULL,
  contractor_id text NULL,
  payment_type text NOT NULL DEFAULT 'other',
  amount numeric NULL,
  currency text NULL,
  description text NULL,
  due_date timestamptz NULL,
  status text NOT NULL DEFAULT 'draft',
  note text NULL,
  created_by text NULL,
  sent_at timestamptz NULL,
  acknowledged_at timestamptz NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS job_schedule_proposals (
  id text PRIMARY KEY,
  workspace_id text NOT NULL
    REFERENCES direct_connect_job_workspaces(id) ON DELETE CASCADE,
  request_id text NULL
    REFERENCES direct_connect_dispatch_requests(id) ON DELETE SET NULL,
  estimate_id text NULL REFERENCES job_estimates(id) ON DELETE SET NULL,
  requester_user_id text NULL,
  business_id text NULL,
  contractor_id text NULL,
  proposed_start timestamptz NOT NULL,
  proposed_end timestamptz NULL,
  time_window text NULL,
  notes text NULL,
  status text NOT NULL DEFAULT 'proposed',
  created_by text NULL,
  responded_at timestamptz NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS job_payment_records (
  id text PRIMARY KEY,
  workspace_id text NOT NULL
    REFERENCES direct_connect_job_workspaces(id) ON DELETE CASCADE,
  amount numeric NULL,
  currency text NULL,
  status text NOT NULL DEFAULT 'requested',
  note text NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS job_checkpoints (
  id text PRIMARY KEY,
  workspace_id text NOT NULL
    REFERENCES direct_connect_job_workspaces(id) ON DELETE CASCADE,
  request_id text NULL
    REFERENCES direct_connect_dispatch_requests(id) ON DELETE SET NULL,
  requester_user_id text NULL,
  business_id text NULL,
  contractor_id text NULL,
  title text NOT NULL,
  description text NULL,
  status text NOT NULL DEFAULT 'planned',
  due_date timestamptz NULL,
  completed_at timestamptz NULL,
  requester_responded_at timestamptz NULL,
  created_by text NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS job_change_orders (
  id text PRIMARY KEY,
  workspace_id text NOT NULL
    REFERENCES direct_connect_job_workspaces(id) ON DELETE CASCADE,
  request_id text NULL
    REFERENCES direct_connect_dispatch_requests(id) ON DELETE SET NULL,
  requester_user_id text NULL,
  business_id text NULL,
  contractor_id text NULL,
  title text NOT NULL,
  reason text NULL,
  scope_change_summary text NULL,
  material_delta numeric NULL,
  labor_delta numeric NULL,
  other_delta numeric NULL,
  total_delta numeric NULL,
  timeline_delta_days integer NULL,
  status text NOT NULL DEFAULT 'draft',
  created_by text NULL,
  sent_at timestamptz NULL,
  responded_at timestamptz NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS job_punch_list_items (
  id text PRIMARY KEY,
  workspace_id text NOT NULL
    REFERENCES direct_connect_job_workspaces(id) ON DELETE CASCADE,
  request_id text NULL
    REFERENCES direct_connect_dispatch_requests(id) ON DELETE SET NULL,
  requester_user_id text NULL,
  business_id text NULL,
  contractor_id text NULL,
  title text NOT NULL,
  description text NULL,
  status text NOT NULL DEFAULT 'open',
  created_by text NULL,
  assigned_to text NULL,
  due_date timestamptz NULL,
  resolved_at timestamptz NULL,
  requester_responded_at timestamptz NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS job_completion_requests (
  id text PRIMARY KEY,
  workspace_id text NOT NULL
    REFERENCES direct_connect_job_workspaces(id) ON DELETE CASCADE,
  request_id text NULL
    REFERENCES direct_connect_dispatch_requests(id) ON DELETE SET NULL,
  requester_user_id text NULL,
  business_id text NULL,
  contractor_id text NULL,
  status text NOT NULL DEFAULT 'requested',
  business_notes text NULL,
  requester_notes text NULL,
  requested_at timestamptz NOT NULL DEFAULT now(),
  responded_at timestamptz NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS job_invoices (
  id text PRIMARY KEY,
  workspace_id text NOT NULL
    REFERENCES direct_connect_job_workspaces(id) ON DELETE CASCADE,
  request_id text NULL
    REFERENCES direct_connect_dispatch_requests(id) ON DELETE SET NULL,
  requester_user_id text NULL,
  business_id text NULL,
  contractor_id text NULL,
  estimate_id text NULL REFERENCES job_estimates(id) ON DELETE SET NULL,
  title text NULL,
  summary text NULL,
  status text NOT NULL DEFAULT 'draft',
  subtotal numeric NULL,
  adjustments numeric NULL,
  total_due numeric NULL,
  due_date timestamptz NULL,
  terms text NULL,
  created_by text NULL,
  sent_at timestamptz NULL,
  responded_at timestamptz NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS job_invoice_line_items (
  id text PRIMARY KEY,
  invoice_id text NOT NULL REFERENCES job_invoices(id) ON DELETE CASCADE,
  line_type text NOT NULL,
  name text NOT NULL,
  description text NULL,
  quantity numeric NULL,
  unit text NULL,
  unit_amount numeric NULL,
  total_amount numeric NULL,
  source_estimate_line_item_id text NULL,
  source_change_order_id text NULL,
  notes text NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS job_receipts (
  id text PRIMARY KEY,
  workspace_id text NOT NULL
    REFERENCES direct_connect_job_workspaces(id) ON DELETE CASCADE,
  request_id text NULL
    REFERENCES direct_connect_dispatch_requests(id) ON DELETE SET NULL,
  invoice_id text NULL REFERENCES job_invoices(id) ON DELETE SET NULL,
  requester_user_id text NULL,
  business_id text NULL,
  contractor_id text NULL,
  receipt_type text NOT NULL DEFAULT 'receipt',
  payment_method text NOT NULL DEFAULT 'outside_platform',
  amount numeric NULL,
  status text NOT NULL DEFAULT 'recorded',
  paid_at timestamptz NULL,
  notes text NULL,
  created_by text NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- This view is the live deployment invariant for exact Direct Connect
-- authority. Unlike the one-time repair quarantine, it is evaluated against
-- current rows every time the production schema guard runs.
CREATE OR REPLACE VIEW direct_connect_exact_binding_violations AS
WITH assignment_authority AS (
  SELECT
    assignment.id AS assignment_id,
    assignment.work_request_id AS request_id,
    assignment.status AS assignment_status,
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
    COUNT(*) OVER (
      PARTITION BY assignment.work_request_id, assignment.provider_key
    ) AS provider_key_assignment_count,
    COUNT(*) FILTER (
      WHERE assignment.status IN ('accepted', 'completed')
    ) OVER (
      PARTITION BY assignment.work_request_id
    ) AS active_assignment_count
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
),
active_chain_stats AS (
  SELECT
    assignment.*,
    (
      SELECT COUNT(*)
      FROM work_request_events event
      WHERE event.work_request_id = assignment.request_id
        AND event.type::text = 'provider_accepted'
    ) AS accepted_event_count,
    (
      SELECT COUNT(*)
      FROM work_request_events event
      INNER JOIN conversations conversation
        ON conversation.id = event.metadata->>'conversationId'
        AND conversation.homeowner_id = assignment.requester_user_id
        AND conversation.contractor_id =
          COALESCE(assignment.contractor_id, assignment.provider_user_id)
        AND conversation.status = 'active'
      INNER JOIN direct_connect_contractor_responses response
        ON response.request_id = assignment.request_id
        AND response.assignment_id = assignment.assignment_id
        AND response.provider_key = assignment.provider_key
        AND response.responder_user_id = assignment.provider_user_id
        AND response.contractor_id IS NOT DISTINCT FROM assignment.contractor_id
        AND response.response_type IN ('interested', 'need_more_info')
        AND response.contact_request_state IN (
          'contractor_requested',
          'user_approved',
          'released'
        )
        AND response.created_at >= event.created_at
      WHERE event.work_request_id = assignment.request_id
        AND event.type::text = 'provider_accepted'
        AND event.actor_user_id = assignment.provider_user_id
        AND event.metadata->>'assignmentId' = assignment.assignment_id
        AND event.metadata->>'providerKey' = assignment.provider_key
        AND assignment.assignment_created_at <= event.created_at
    ) AS exact_chain_count
  FROM assignment_authority assignment
  WHERE assignment.assignment_status IN ('accepted', 'completed')
),
actionable_response_authority AS (
  SELECT
    response.id AS response_id,
    response.request_id,
    response.assignment_id AS response_assignment_id,
    response.provider_key AS response_provider_key,
    response.responder_user_id AS response_user_id,
    response.contractor_id AS response_contractor_id,
    assignment.assignment_id,
    assignment.assignment_status,
    assignment.provider_key,
    assignment.contractor_id,
    assignment.requester_user_id,
    assignment.provider_user_id,
    assignment.provider_user_count,
    assignment.provider_key_valid,
    (
      SELECT COUNT(*)
      FROM work_request_events event
      INNER JOIN conversations conversation
        ON conversation.id = event.metadata->>'conversationId'
        AND conversation.homeowner_id = assignment.requester_user_id
        AND conversation.contractor_id =
          COALESCE(assignment.contractor_id, assignment.provider_user_id)
        AND conversation.status = 'active'
      WHERE event.work_request_id = response.request_id
        AND event.type::text = 'provider_accepted'
        AND event.actor_user_id = assignment.provider_user_id
        AND event.metadata->>'assignmentId' = assignment.assignment_id
        AND event.metadata->>'providerKey' = assignment.provider_key
        AND response.created_at >= event.created_at
    ) AS response_event_chain_count
  FROM direct_connect_contractor_responses response
  LEFT JOIN assignment_authority assignment
    ON assignment.assignment_id = response.assignment_id
    AND assignment.request_id = response.request_id
    AND assignment.provider_key = response.provider_key
  WHERE response.response_type IN ('interested', 'need_more_info')
    AND response.contact_request_state IN (
      'contractor_requested',
      'user_approved',
      'released'
    )
),
gate_authority AS (
  SELECT
    gate.id AS request_id,
    gate.contact_gate_state,
    gate.contact_gate_assignment_id,
    gate.contact_gate_provider_key,
    assignment.assignment_id,
    assignment.assignment_status,
    assignment.provider_key,
    assignment.contractor_id,
    assignment.requester_user_id,
    assignment.provider_user_id,
    assignment.provider_user_count,
    assignment.provider_key_valid,
    (
      SELECT COUNT(*)
      FROM direct_connect_contractor_responses response
      WHERE response.request_id = gate.id
        AND response.assignment_id = assignment.assignment_id
        AND response.provider_key = assignment.provider_key
        AND response.responder_user_id = assignment.provider_user_id
        AND response.contractor_id IS NOT DISTINCT FROM assignment.contractor_id
        AND response.response_type IN ('interested', 'need_more_info')
        AND response.contact_request_state IN (
          'contractor_requested',
          'user_approved',
          'released'
        )
    ) AS exact_response_count
  FROM direct_connect_dispatch_requests gate
  LEFT JOIN assignment_authority assignment
    ON assignment.request_id = gate.id
    AND assignment.assignment_id = gate.contact_gate_assignment_id
    AND assignment.provider_key = gate.contact_gate_provider_key
),
released_workspace_authority AS (
  SELECT
    gate.*,
    (
      SELECT COUNT(*)
      FROM direct_connect_job_workspaces workspace
      INNER JOIN direct_connect_contractor_responses response
        ON response.id = workspace.contractor_response_id
        AND response.request_id = gate.request_id
        AND response.assignment_id = gate.assignment_id
        AND response.provider_key = gate.provider_key
        AND response.responder_user_id = gate.provider_user_id
        AND response.contractor_id IS NOT DISTINCT FROM gate.contractor_id
      WHERE workspace.request_id = gate.request_id
        AND workspace.requester_user_id = gate.requester_user_id
        AND workspace.contractor_id IS NOT DISTINCT FROM gate.contractor_id
        AND workspace.business_id IS NOT DISTINCT FROM (
          CASE
            WHEN gate.provider_key LIKE 'business:%'
              THEN SUBSTRING(gate.provider_key FROM LENGTH('business:') + 1)
            ELSE NULL
          END
        )
    ) AS exact_workspace_count
  FROM gate_authority gate
  WHERE gate.contact_gate_state = 'released'
)
SELECT
  'assignment-provider:' || assignment.assignment_id AS violation_id,
  assignment.request_id,
  assignment.assignment_id,
  'assignment_provider_binding'::text AS violation_type,
  jsonb_build_object(
    'status', assignment.assignment_status,
    'providerKey', assignment.provider_key,
    'providerKeyValid', assignment.provider_key_valid,
    'providerUserCount', assignment.provider_user_count,
    'providerKeyAssignmentCount', assignment.provider_key_assignment_count
  ) AS details_json
FROM assignment_authority assignment
WHERE assignment.assignment_status IN ('suggested', 'invited', 'accepted', 'completed')
  AND (
    NULLIF(BTRIM(assignment.provider_key), '') IS NULL
    OR NOT assignment.provider_key_valid
    OR assignment.provider_user_count <> 1
    OR assignment.provider_key_assignment_count <> 1
  )

UNION ALL

SELECT
  'active-chain:' || chain.assignment_id,
  chain.request_id,
  chain.assignment_id,
  'accepted_authority_chain'::text,
  jsonb_build_object(
    'activeAssignmentCount', chain.active_assignment_count,
    'acceptedEventCount', chain.accepted_event_count,
    'exactChainCount', chain.exact_chain_count
  )
FROM active_chain_stats chain
WHERE chain.active_assignment_count <> 1
  OR chain.accepted_event_count <> 1
  OR chain.exact_chain_count <> 1

UNION ALL

SELECT
  'response:' || response.response_id,
  response.request_id,
  response.response_assignment_id,
  'actionable_response_binding'::text,
  jsonb_build_object(
    'responseAssignmentId', response.response_assignment_id,
    'responseProviderKey', response.response_provider_key,
    'assignmentStatus', response.assignment_status,
    'providerUserCount', response.provider_user_count,
    'responseEventChainCount', response.response_event_chain_count
  )
FROM actionable_response_authority response
WHERE response.assignment_id IS NULL
  OR response.assignment_status NOT IN ('suggested', 'invited', 'accepted', 'completed')
  OR NOT response.provider_key_valid
  OR response.provider_user_count <> 1
  OR response.response_user_id <> response.provider_user_id
  OR response.response_contractor_id IS DISTINCT FROM response.contractor_id
  OR (
    response.assignment_status IN ('accepted', 'completed')
    AND response.response_event_chain_count <> 1
  )

UNION ALL

SELECT
  'accepted-gate:' || chain.assignment_id,
  chain.request_id,
  chain.assignment_id,
  'accepted_contact_gate_binding'::text,
  jsonb_build_object(
    'contactGateState', gate.contact_gate_state,
    'contactGateAssignmentId', gate.contact_gate_assignment_id,
    'contactGateProviderKey', gate.contact_gate_provider_key
  )
FROM active_chain_stats chain
LEFT JOIN direct_connect_dispatch_requests gate
  ON gate.id = chain.request_id
WHERE gate.id IS NULL
  OR gate.contact_gate_state = 'locked'
  OR gate.contact_gate_assignment_id IS DISTINCT FROM chain.assignment_id
  OR gate.contact_gate_provider_key IS DISTINCT FROM chain.provider_key

UNION ALL

SELECT
  'gate:' || gate.request_id,
  gate.request_id,
  gate.contact_gate_assignment_id,
  'advanced_contact_gate_binding'::text,
  jsonb_build_object(
    'contactGateState', gate.contact_gate_state,
    'contactGateAssignmentId', gate.contact_gate_assignment_id,
    'contactGateProviderKey', gate.contact_gate_provider_key,
    'assignmentStatus', gate.assignment_status,
    'exactResponseCount', gate.exact_response_count
  )
FROM gate_authority gate
WHERE gate.contact_gate_state <> 'locked'
  AND (
    gate.assignment_id IS NULL
    OR gate.assignment_status NOT IN ('accepted', 'completed')
    OR NOT gate.provider_key_valid
    OR gate.provider_user_count <> 1
    OR gate.exact_response_count <> 1
  )

UNION ALL

SELECT
  'released-workspace:' || gate.request_id,
  gate.request_id,
  gate.assignment_id,
  'released_workspace_binding'::text,
  jsonb_build_object(
    'exactWorkspaceCount', gate.exact_workspace_count
  )
FROM released_workspace_authority gate
WHERE gate.exact_workspace_count <> 1;

-- Repair tables previously created by best-effort runtime bootstrap code. New
-- installations already have these columns from the CREATE statements above.
ALTER TABLE direct_connect_dispatch_requests
  ADD COLUMN IF NOT EXISTS contact_gate_assignment_id text NULL,
  ADD COLUMN IF NOT EXISTS contact_gate_provider_key text NULL;

ALTER TABLE direct_connect_contractor_responses
  ADD COLUMN IF NOT EXISTS assignment_id text NULL,
  ADD COLUMN IF NOT EXISTS provider_key text NULL;

ALTER TABLE job_estimates
  ADD COLUMN IF NOT EXISTS request_id text NULL,
  ADD COLUMN IF NOT EXISTS requester_user_id text NULL,
  ADD COLUMN IF NOT EXISTS business_id text NULL,
  ADD COLUMN IF NOT EXISTS contractor_id text NULL,
  ADD COLUMN IF NOT EXISTS title text NULL,
  ADD COLUMN IF NOT EXISTS scope_summary text NULL,
  ADD COLUMN IF NOT EXISTS subtotal_materials numeric NULL,
  ADD COLUMN IF NOT EXISTS subtotal_labor numeric NULL,
  ADD COLUMN IF NOT EXISTS subtotal_other numeric NULL,
  ADD COLUMN IF NOT EXISTS total_estimate numeric NULL,
  ADD COLUMN IF NOT EXISTS terms text NULL,
  ADD COLUMN IF NOT EXISTS expiration_date timestamptz NULL,
  ADD COLUMN IF NOT EXISTS sent_at timestamptz NULL,
  ADD COLUMN IF NOT EXISTS responded_at timestamptz NULL;

ALTER TABLE job_estimate_line_items
  ADD COLUMN IF NOT EXISTS name text NULL,
  ADD COLUMN IF NOT EXISTS description text NULL,
  ADD COLUMN IF NOT EXISTS unit text NULL,
  ADD COLUMN IF NOT EXISTS rate numeric NULL,
  ADD COLUMN IF NOT EXISTS total_cost numeric NULL,
  ADD COLUMN IF NOT EXISTS supplier text NULL,
  ADD COLUMN IF NOT EXISTS sku text NULL,
  ADD COLUMN IF NOT EXISTS notes text NULL;

ALTER TABLE job_payment_requests
  ADD COLUMN IF NOT EXISTS request_id text NULL,
  ADD COLUMN IF NOT EXISTS estimate_id text NULL,
  ADD COLUMN IF NOT EXISTS requester_user_id text NULL,
  ADD COLUMN IF NOT EXISTS business_id text NULL,
  ADD COLUMN IF NOT EXISTS contractor_id text NULL,
  ADD COLUMN IF NOT EXISTS payment_type text NOT NULL DEFAULT 'other',
  ADD COLUMN IF NOT EXISTS description text NULL,
  ADD COLUMN IF NOT EXISTS due_date timestamptz NULL,
  ADD COLUMN IF NOT EXISTS created_by text NULL,
  ADD COLUMN IF NOT EXISTS sent_at timestamptz NULL,
  ADD COLUMN IF NOT EXISTS acknowledged_at timestamptz NULL,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

ALTER TABLE job_checkpoints
  ADD COLUMN IF NOT EXISTS request_id text NULL,
  ADD COLUMN IF NOT EXISTS requester_user_id text NULL,
  ADD COLUMN IF NOT EXISTS business_id text NULL,
  ADD COLUMN IF NOT EXISTS contractor_id text NULL,
  ADD COLUMN IF NOT EXISTS description text NULL,
  ADD COLUMN IF NOT EXISTS due_date timestamptz NULL,
  ADD COLUMN IF NOT EXISTS completed_at timestamptz NULL,
  ADD COLUMN IF NOT EXISTS requester_responded_at timestamptz NULL,
  ADD COLUMN IF NOT EXISTS created_by text NULL;

ALTER TABLE job_change_orders
  ADD COLUMN IF NOT EXISTS request_id text NULL,
  ADD COLUMN IF NOT EXISTS requester_user_id text NULL,
  ADD COLUMN IF NOT EXISTS business_id text NULL,
  ADD COLUMN IF NOT EXISTS contractor_id text NULL,
  ADD COLUMN IF NOT EXISTS reason text NULL,
  ADD COLUMN IF NOT EXISTS scope_change_summary text NULL,
  ADD COLUMN IF NOT EXISTS material_delta numeric NULL,
  ADD COLUMN IF NOT EXISTS labor_delta numeric NULL,
  ADD COLUMN IF NOT EXISTS other_delta numeric NULL,
  ADD COLUMN IF NOT EXISTS total_delta numeric NULL,
  ADD COLUMN IF NOT EXISTS timeline_delta_days integer NULL,
  ADD COLUMN IF NOT EXISTS created_by text NULL,
  ADD COLUMN IF NOT EXISTS sent_at timestamptz NULL,
  ADD COLUMN IF NOT EXISTS responded_at timestamptz NULL;

ALTER TABLE job_punch_list_items
  ADD COLUMN IF NOT EXISTS request_id text NULL,
  ADD COLUMN IF NOT EXISTS requester_user_id text NULL,
  ADD COLUMN IF NOT EXISTS business_id text NULL,
  ADD COLUMN IF NOT EXISTS contractor_id text NULL,
  ADD COLUMN IF NOT EXISTS description text NULL,
  ADD COLUMN IF NOT EXISTS created_by text NULL,
  ADD COLUMN IF NOT EXISTS assigned_to text NULL,
  ADD COLUMN IF NOT EXISTS due_date timestamptz NULL,
  ADD COLUMN IF NOT EXISTS resolved_at timestamptz NULL,
  ADD COLUMN IF NOT EXISTS requester_responded_at timestamptz NULL;

ALTER TABLE job_invoices
  ADD COLUMN IF NOT EXISTS request_id text NULL,
  ADD COLUMN IF NOT EXISTS requester_user_id text NULL,
  ADD COLUMN IF NOT EXISTS business_id text NULL,
  ADD COLUMN IF NOT EXISTS contractor_id text NULL,
  ADD COLUMN IF NOT EXISTS estimate_id text NULL,
  ADD COLUMN IF NOT EXISTS title text NULL,
  ADD COLUMN IF NOT EXISTS summary text NULL,
  ADD COLUMN IF NOT EXISTS subtotal numeric NULL,
  ADD COLUMN IF NOT EXISTS adjustments numeric NULL,
  ADD COLUMN IF NOT EXISTS total_due numeric NULL,
  ADD COLUMN IF NOT EXISTS due_date timestamptz NULL,
  ADD COLUMN IF NOT EXISTS terms text NULL,
  ADD COLUMN IF NOT EXISTS created_by text NULL,
  ADD COLUMN IF NOT EXISTS sent_at timestamptz NULL,
  ADD COLUMN IF NOT EXISTS responded_at timestamptz NULL;

ALTER TABLE job_receipts
  ADD COLUMN IF NOT EXISTS request_id text NULL,
  ADD COLUMN IF NOT EXISTS invoice_id text NULL,
  ADD COLUMN IF NOT EXISTS requester_user_id text NULL,
  ADD COLUMN IF NOT EXISTS business_id text NULL,
  ADD COLUMN IF NOT EXISTS contractor_id text NULL,
  ADD COLUMN IF NOT EXISTS receipt_type text NOT NULL DEFAULT 'receipt',
  ADD COLUMN IF NOT EXISTS payment_method text NOT NULL DEFAULT 'outside_platform',
  ADD COLUMN IF NOT EXISTS paid_at timestamptz NULL,
  ADD COLUMN IF NOT EXISTS notes text NULL,
  ADD COLUMN IF NOT EXISTS created_by text NULL,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();
