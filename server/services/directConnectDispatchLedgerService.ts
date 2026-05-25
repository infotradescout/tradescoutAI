import { randomUUID } from "crypto";
import { db } from "../db";
import { sql } from "drizzle-orm";
import type {
  CanonicalDirectConnectRequest,
  ContractorEligibilityResult,
} from "@shared/directConnectRoutingSpine";

export type ContactGateState =
  | "locked"
  | "contractor_requested"
  | "user_approved"
  | "released"
  | "denied"
  | "expired";

export type JobLifecycleStage =
  | "contact"
  | "estimate"
  | "acceptance"
  | "deposit"
  | "scheduling"
  | "in_progress"
  | "checkpoint"
  | "change_order"
  | "punch_list"
  | "invoicing"
  | "receipt"
  | "completed"
  | "closed";

export async function ensureDirectConnectDispatchLedgerTables() {
  await db.execute(sql`
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
      source_surface text NOT NULL,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    );
  `);
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS direct_connect_dispatch_candidates (
      id text PRIMARY KEY,
      request_id text NOT NULL REFERENCES direct_connect_dispatch_requests(id) ON DELETE CASCADE,
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
  `);
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS direct_connect_dispatch_events (
      event_id text PRIMARY KEY,
      request_id text NOT NULL REFERENCES direct_connect_dispatch_requests(id) ON DELETE CASCADE,
      actor_type text NOT NULL,
      actor_id text NULL,
      event_type text NOT NULL,
      metadata_json jsonb NOT NULL DEFAULT '{}'::jsonb,
      created_at timestamptz NOT NULL DEFAULT now()
    );
  `);
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS direct_connect_contractor_responses (
      id text PRIMARY KEY,
      request_id text NOT NULL REFERENCES direct_connect_dispatch_requests(id) ON DELETE CASCADE,
      contractor_id text NULL,
      responder_user_id text NULL,
      response_type text NOT NULL,
      message text NULL,
      availability text NULL,
      estimated_timing text NULL,
      contact_request_state text NOT NULL DEFAULT 'locked',
      created_at timestamptz NOT NULL DEFAULT now()
    );
  `);
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS direct_connect_lifecycle_notifications (
      id text PRIMARY KEY,
      request_id text NOT NULL REFERENCES direct_connect_dispatch_requests(id) ON DELETE CASCADE,
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
  `);
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS direct_connect_job_workspaces (
      id text PRIMARY KEY,
      request_id text NOT NULL REFERENCES direct_connect_dispatch_requests(id) ON DELETE CASCADE,
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
  `);
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS job_estimates (
      id text PRIMARY KEY,
      workspace_id text NOT NULL REFERENCES direct_connect_job_workspaces(id) ON DELETE CASCADE,
      request_id text NULL REFERENCES direct_connect_dispatch_requests(id) ON DELETE SET NULL,
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
  `);
  await db.execute(sql`
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
  `);
  await db.execute(sql`ALTER TABLE job_estimates ADD COLUMN IF NOT EXISTS request_id text NULL`);
  await db.execute(
    sql`ALTER TABLE job_estimates ADD COLUMN IF NOT EXISTS requester_user_id text NULL`
  );
  await db.execute(sql`ALTER TABLE job_estimates ADD COLUMN IF NOT EXISTS business_id text NULL`);
  await db.execute(sql`ALTER TABLE job_estimates ADD COLUMN IF NOT EXISTS contractor_id text NULL`);
  await db.execute(sql`ALTER TABLE job_estimates ADD COLUMN IF NOT EXISTS title text NULL`);
  await db.execute(sql`ALTER TABLE job_estimates ADD COLUMN IF NOT EXISTS scope_summary text NULL`);
  await db.execute(
    sql`ALTER TABLE job_estimates ADD COLUMN IF NOT EXISTS subtotal_materials numeric NULL`
  );
  await db.execute(
    sql`ALTER TABLE job_estimates ADD COLUMN IF NOT EXISTS subtotal_labor numeric NULL`
  );
  await db.execute(
    sql`ALTER TABLE job_estimates ADD COLUMN IF NOT EXISTS subtotal_other numeric NULL`
  );
  await db.execute(
    sql`ALTER TABLE job_estimates ADD COLUMN IF NOT EXISTS total_estimate numeric NULL`
  );
  await db.execute(sql`ALTER TABLE job_estimates ADD COLUMN IF NOT EXISTS terms text NULL`);
  await db.execute(
    sql`ALTER TABLE job_estimates ADD COLUMN IF NOT EXISTS expiration_date timestamptz NULL`
  );
  await db.execute(
    sql`ALTER TABLE job_estimates ADD COLUMN IF NOT EXISTS sent_at timestamptz NULL`
  );
  await db.execute(
    sql`ALTER TABLE job_estimates ADD COLUMN IF NOT EXISTS responded_at timestamptz NULL`
  );
  await db.execute(
    sql`ALTER TABLE job_estimate_line_items ADD COLUMN IF NOT EXISTS name text NULL`
  );
  await db.execute(
    sql`ALTER TABLE job_estimate_line_items ADD COLUMN IF NOT EXISTS description text NULL`
  );
  await db.execute(
    sql`ALTER TABLE job_estimate_line_items ADD COLUMN IF NOT EXISTS unit text NULL`
  );
  await db.execute(
    sql`ALTER TABLE job_estimate_line_items ADD COLUMN IF NOT EXISTS rate numeric NULL`
  );
  await db.execute(
    sql`ALTER TABLE job_estimate_line_items ADD COLUMN IF NOT EXISTS total_cost numeric NULL`
  );
  await db.execute(
    sql`ALTER TABLE job_estimate_line_items ADD COLUMN IF NOT EXISTS supplier text NULL`
  );
  await db.execute(sql`ALTER TABLE job_estimate_line_items ADD COLUMN IF NOT EXISTS sku text NULL`);
  await db.execute(
    sql`ALTER TABLE job_estimate_line_items ADD COLUMN IF NOT EXISTS notes text NULL`
  );
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS job_material_items (
      id text PRIMARY KEY,
      workspace_id text NOT NULL REFERENCES direct_connect_job_workspaces(id) ON DELETE CASCADE,
      label text NOT NULL,
      quantity numeric NULL,
      unit_cost numeric NULL,
      total_cost numeric NULL,
      created_at timestamptz NOT NULL DEFAULT now()
    );
  `);
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS job_labor_items (
      id text PRIMARY KEY,
      workspace_id text NOT NULL REFERENCES direct_connect_job_workspaces(id) ON DELETE CASCADE,
      label text NOT NULL,
      hours numeric NULL,
      hourly_rate numeric NULL,
      total_cost numeric NULL,
      created_at timestamptz NOT NULL DEFAULT now()
    );
  `);
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS job_acceptances (
      id text PRIMARY KEY,
      workspace_id text NOT NULL REFERENCES direct_connect_job_workspaces(id) ON DELETE CASCADE,
      estimate_id text NULL REFERENCES job_estimates(id) ON DELETE SET NULL,
      accepted_by text NOT NULL,
      accepted_at timestamptz NOT NULL DEFAULT now(),
      note text NULL
    );
  `);
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS job_payment_requests (
      id text PRIMARY KEY,
      workspace_id text NOT NULL REFERENCES direct_connect_job_workspaces(id) ON DELETE CASCADE,
      request_id text NULL REFERENCES direct_connect_dispatch_requests(id) ON DELETE SET NULL,
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
  `);
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS job_schedule_proposals (
      id text PRIMARY KEY,
      workspace_id text NOT NULL REFERENCES direct_connect_job_workspaces(id) ON DELETE CASCADE,
      request_id text NULL REFERENCES direct_connect_dispatch_requests(id) ON DELETE SET NULL,
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
  `);
  await db.execute(
    sql`ALTER TABLE job_payment_requests ADD COLUMN IF NOT EXISTS request_id text NULL`
  );
  await db.execute(
    sql`ALTER TABLE job_payment_requests ADD COLUMN IF NOT EXISTS estimate_id text NULL`
  );
  await db.execute(
    sql`ALTER TABLE job_payment_requests ADD COLUMN IF NOT EXISTS requester_user_id text NULL`
  );
  await db.execute(
    sql`ALTER TABLE job_payment_requests ADD COLUMN IF NOT EXISTS business_id text NULL`
  );
  await db.execute(
    sql`ALTER TABLE job_payment_requests ADD COLUMN IF NOT EXISTS contractor_id text NULL`
  );
  await db.execute(
    sql`ALTER TABLE job_payment_requests ADD COLUMN IF NOT EXISTS payment_type text NOT NULL DEFAULT 'other'`
  );
  await db.execute(
    sql`ALTER TABLE job_payment_requests ADD COLUMN IF NOT EXISTS description text NULL`
  );
  await db.execute(
    sql`ALTER TABLE job_payment_requests ADD COLUMN IF NOT EXISTS due_date timestamptz NULL`
  );
  await db.execute(
    sql`ALTER TABLE job_payment_requests ADD COLUMN IF NOT EXISTS created_by text NULL`
  );
  await db.execute(
    sql`ALTER TABLE job_payment_requests ADD COLUMN IF NOT EXISTS sent_at timestamptz NULL`
  );
  await db.execute(
    sql`ALTER TABLE job_payment_requests ADD COLUMN IF NOT EXISTS acknowledged_at timestamptz NULL`
  );
  await db.execute(
    sql`ALTER TABLE job_payment_requests ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now()`
  );
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS job_payment_records (
      id text PRIMARY KEY,
      workspace_id text NOT NULL REFERENCES direct_connect_job_workspaces(id) ON DELETE CASCADE,
      amount numeric NULL,
      currency text NULL,
      status text NOT NULL DEFAULT 'requested',
      note text NULL,
      created_at timestamptz NOT NULL DEFAULT now()
    );
  `);
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS job_checkpoints (
      id text PRIMARY KEY,
      workspace_id text NOT NULL REFERENCES direct_connect_job_workspaces(id) ON DELETE CASCADE,
      request_id text NULL REFERENCES direct_connect_dispatch_requests(id) ON DELETE SET NULL,
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
  `);
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS job_change_orders (
      id text PRIMARY KEY,
      workspace_id text NOT NULL REFERENCES direct_connect_job_workspaces(id) ON DELETE CASCADE,
      request_id text NULL REFERENCES direct_connect_dispatch_requests(id) ON DELETE SET NULL,
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
  `);
  await db.execute(sql`ALTER TABLE job_checkpoints ADD COLUMN IF NOT EXISTS request_id text NULL`);
  await db.execute(
    sql`ALTER TABLE job_checkpoints ADD COLUMN IF NOT EXISTS requester_user_id text NULL`
  );
  await db.execute(sql`ALTER TABLE job_checkpoints ADD COLUMN IF NOT EXISTS business_id text NULL`);
  await db.execute(
    sql`ALTER TABLE job_checkpoints ADD COLUMN IF NOT EXISTS contractor_id text NULL`
  );
  await db.execute(sql`ALTER TABLE job_checkpoints ADD COLUMN IF NOT EXISTS description text NULL`);
  await db.execute(
    sql`ALTER TABLE job_checkpoints ADD COLUMN IF NOT EXISTS due_date timestamptz NULL`
  );
  await db.execute(
    sql`ALTER TABLE job_checkpoints ADD COLUMN IF NOT EXISTS completed_at timestamptz NULL`
  );
  await db.execute(
    sql`ALTER TABLE job_checkpoints ADD COLUMN IF NOT EXISTS requester_responded_at timestamptz NULL`
  );
  await db.execute(sql`ALTER TABLE job_checkpoints ADD COLUMN IF NOT EXISTS created_by text NULL`);
  await db.execute(
    sql`ALTER TABLE job_change_orders ADD COLUMN IF NOT EXISTS request_id text NULL`
  );
  await db.execute(
    sql`ALTER TABLE job_change_orders ADD COLUMN IF NOT EXISTS requester_user_id text NULL`
  );
  await db.execute(
    sql`ALTER TABLE job_change_orders ADD COLUMN IF NOT EXISTS business_id text NULL`
  );
  await db.execute(
    sql`ALTER TABLE job_change_orders ADD COLUMN IF NOT EXISTS contractor_id text NULL`
  );
  await db.execute(sql`ALTER TABLE job_change_orders ADD COLUMN IF NOT EXISTS reason text NULL`);
  await db.execute(
    sql`ALTER TABLE job_change_orders ADD COLUMN IF NOT EXISTS scope_change_summary text NULL`
  );
  await db.execute(
    sql`ALTER TABLE job_change_orders ADD COLUMN IF NOT EXISTS material_delta numeric NULL`
  );
  await db.execute(
    sql`ALTER TABLE job_change_orders ADD COLUMN IF NOT EXISTS labor_delta numeric NULL`
  );
  await db.execute(
    sql`ALTER TABLE job_change_orders ADD COLUMN IF NOT EXISTS other_delta numeric NULL`
  );
  await db.execute(
    sql`ALTER TABLE job_change_orders ADD COLUMN IF NOT EXISTS total_delta numeric NULL`
  );
  await db.execute(
    sql`ALTER TABLE job_change_orders ADD COLUMN IF NOT EXISTS timeline_delta_days integer NULL`
  );
  await db.execute(
    sql`ALTER TABLE job_change_orders ADD COLUMN IF NOT EXISTS created_by text NULL`
  );
  await db.execute(
    sql`ALTER TABLE job_change_orders ADD COLUMN IF NOT EXISTS sent_at timestamptz NULL`
  );
  await db.execute(
    sql`ALTER TABLE job_change_orders ADD COLUMN IF NOT EXISTS responded_at timestamptz NULL`
  );
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS job_punch_list_items (
      id text PRIMARY KEY,
      workspace_id text NOT NULL REFERENCES direct_connect_job_workspaces(id) ON DELETE CASCADE,
      request_id text NULL REFERENCES direct_connect_dispatch_requests(id) ON DELETE SET NULL,
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
  `);
  await db.execute(
    sql`ALTER TABLE job_punch_list_items ADD COLUMN IF NOT EXISTS request_id text NULL`
  );
  await db.execute(
    sql`ALTER TABLE job_punch_list_items ADD COLUMN IF NOT EXISTS requester_user_id text NULL`
  );
  await db.execute(
    sql`ALTER TABLE job_punch_list_items ADD COLUMN IF NOT EXISTS business_id text NULL`
  );
  await db.execute(
    sql`ALTER TABLE job_punch_list_items ADD COLUMN IF NOT EXISTS contractor_id text NULL`
  );
  await db.execute(
    sql`ALTER TABLE job_punch_list_items ADD COLUMN IF NOT EXISTS description text NULL`
  );
  await db.execute(
    sql`ALTER TABLE job_punch_list_items ADD COLUMN IF NOT EXISTS created_by text NULL`
  );
  await db.execute(
    sql`ALTER TABLE job_punch_list_items ADD COLUMN IF NOT EXISTS assigned_to text NULL`
  );
  await db.execute(
    sql`ALTER TABLE job_punch_list_items ADD COLUMN IF NOT EXISTS due_date timestamptz NULL`
  );
  await db.execute(
    sql`ALTER TABLE job_punch_list_items ADD COLUMN IF NOT EXISTS resolved_at timestamptz NULL`
  );
  await db.execute(
    sql`ALTER TABLE job_punch_list_items ADD COLUMN IF NOT EXISTS requester_responded_at timestamptz NULL`
  );
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS job_completion_requests (
      id text PRIMARY KEY,
      workspace_id text NOT NULL REFERENCES direct_connect_job_workspaces(id) ON DELETE CASCADE,
      request_id text NULL REFERENCES direct_connect_dispatch_requests(id) ON DELETE SET NULL,
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
  `);
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS job_invoices (
      id text PRIMARY KEY,
      workspace_id text NOT NULL REFERENCES direct_connect_job_workspaces(id) ON DELETE CASCADE,
      request_id text NULL REFERENCES direct_connect_dispatch_requests(id) ON DELETE SET NULL,
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
  `);
  await db.execute(sql`
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
  `);
  await db.execute(sql`ALTER TABLE job_invoices ADD COLUMN IF NOT EXISTS request_id text NULL`);
  await db.execute(
    sql`ALTER TABLE job_invoices ADD COLUMN IF NOT EXISTS requester_user_id text NULL`
  );
  await db.execute(sql`ALTER TABLE job_invoices ADD COLUMN IF NOT EXISTS business_id text NULL`);
  await db.execute(sql`ALTER TABLE job_invoices ADD COLUMN IF NOT EXISTS contractor_id text NULL`);
  await db.execute(sql`ALTER TABLE job_invoices ADD COLUMN IF NOT EXISTS estimate_id text NULL`);
  await db.execute(sql`ALTER TABLE job_invoices ADD COLUMN IF NOT EXISTS title text NULL`);
  await db.execute(sql`ALTER TABLE job_invoices ADD COLUMN IF NOT EXISTS summary text NULL`);
  await db.execute(sql`ALTER TABLE job_invoices ADD COLUMN IF NOT EXISTS subtotal numeric NULL`);
  await db.execute(sql`ALTER TABLE job_invoices ADD COLUMN IF NOT EXISTS adjustments numeric NULL`);
  await db.execute(sql`ALTER TABLE job_invoices ADD COLUMN IF NOT EXISTS total_due numeric NULL`);
  await db.execute(
    sql`ALTER TABLE job_invoices ADD COLUMN IF NOT EXISTS due_date timestamptz NULL`
  );
  await db.execute(sql`ALTER TABLE job_invoices ADD COLUMN IF NOT EXISTS terms text NULL`);
  await db.execute(sql`ALTER TABLE job_invoices ADD COLUMN IF NOT EXISTS created_by text NULL`);
  await db.execute(sql`ALTER TABLE job_invoices ADD COLUMN IF NOT EXISTS sent_at timestamptz NULL`);
  await db.execute(
    sql`ALTER TABLE job_invoices ADD COLUMN IF NOT EXISTS responded_at timestamptz NULL`
  );
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS job_receipts (
      id text PRIMARY KEY,
      workspace_id text NOT NULL REFERENCES direct_connect_job_workspaces(id) ON DELETE CASCADE,
      request_id text NULL REFERENCES direct_connect_dispatch_requests(id) ON DELETE SET NULL,
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
  `);
  await db.execute(sql`ALTER TABLE job_receipts ADD COLUMN IF NOT EXISTS request_id text NULL`);
  await db.execute(sql`ALTER TABLE job_receipts ADD COLUMN IF NOT EXISTS invoice_id text NULL`);
  await db.execute(
    sql`ALTER TABLE job_receipts ADD COLUMN IF NOT EXISTS requester_user_id text NULL`
  );
  await db.execute(sql`ALTER TABLE job_receipts ADD COLUMN IF NOT EXISTS business_id text NULL`);
  await db.execute(sql`ALTER TABLE job_receipts ADD COLUMN IF NOT EXISTS contractor_id text NULL`);
  await db.execute(
    sql`ALTER TABLE job_receipts ADD COLUMN IF NOT EXISTS receipt_type text NOT NULL DEFAULT 'receipt'`
  );
  await db.execute(
    sql`ALTER TABLE job_receipts ADD COLUMN IF NOT EXISTS payment_method text NOT NULL DEFAULT 'outside_platform'`
  );
  await db.execute(sql`ALTER TABLE job_receipts ADD COLUMN IF NOT EXISTS paid_at timestamptz NULL`);
  await db.execute(sql`ALTER TABLE job_receipts ADD COLUMN IF NOT EXISTS notes text NULL`);
  await db.execute(sql`ALTER TABLE job_receipts ADD COLUMN IF NOT EXISTS created_by text NULL`);
  await db.execute(
    sql`ALTER TABLE job_receipts ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now()`
  );
}

type LifecycleStatus =
  | "request_submitted"
  | "request_shared"
  | "request_route_ready"
  | "request_route_blocked"
  | "business_responded"
  | "contact_requested"
  | "contact_approved"
  | "contact_denied"
  | "contact_released"
  | "request_closed";

type LifecycleRecipient = {
  recipientType: "requester" | "contractor";
  recipientId: string;
};

function normalizeLifecycleEvent(eventType: string): LifecycleStatus | null {
  switch (eventType) {
    case "request_finalized":
      return "request_submitted";
    case "request_shared":
      return "request_shared";
    case "request_route_ready":
      return "request_route_ready";
    case "request_route_blocked":
      return "request_route_blocked";
    case "contractor_responded":
      return "business_responded";
    case "contact_requested":
      return "contact_requested";
    case "contact_approved":
      return "contact_approved";
    case "contact_denied":
      return "contact_denied";
    case "contact_released":
      return "contact_released";
    case "request_closed":
      return "request_closed";
    case "job_workspace_created":
      return "contact_released";
    case "estimate_started":
    case "estimate_line_item_added":
    case "estimate_sent":
    case "estimate_accepted":
    case "estimate_change_requested":
    case "estimate_declined":
    case "estimate_voided":
    case "deposit_requested":
    case "deposit_acknowledged":
    case "deposit_paid_outside_platform":
    case "deposit_waived":
    case "payment_request_canceled":
    case "schedule_proposed":
    case "schedule_accepted":
    case "schedule_change_requested":
    case "schedule_declined":
    case "job_scheduled":
    case "deposit_recorded":
    case "work_started":
    case "checkpoint_created":
    case "checkpoint_updated":
    case "checkpoint_completed":
    case "checkpoint_approved":
    case "checkpoint_issue_reported":
    case "change_order_created":
    case "change_order_sent":
    case "change_order_approved":
    case "change_order_declined":
    case "change_order_change_requested":
    case "change_order_voided":
    case "punch_list_started":
    case "punch_item_created":
    case "punch_item_acknowledged":
    case "punch_item_started":
    case "punch_item_resolved":
    case "punch_item_approved":
    case "punch_item_rejected":
    case "punch_item_waived":
    case "completion_requested":
    case "completion_confirmed":
    case "completion_rejected":
    case "punch_item_completed":
    case "invoice_sent":
    case "invoice_started":
    case "invoice_line_item_added":
    case "invoice_acknowledged":
    case "invoice_disputed":
    case "invoice_marked_paid_outside_platform":
    case "invoice_voided":
    case "receipt_uploaded":
    case "payment_recorded":
    case "receipt_disputed":
    case "receipt_voided":
    case "job_completed":
    case "job_closed":
      return null;
    default:
      return null;
  }
}

function messageForLifecycleStatus(
  status: LifecycleStatus,
  recipientType: "requester" | "contractor"
): string {
  if (recipientType === "requester") {
    switch (status) {
      case "request_submitted":
      case "request_shared":
        return "Request shared";
      case "request_route_ready":
        return "Waiting for local businesses";
      case "request_route_blocked":
        return "Request needs review before routing";
      case "business_responded":
        return "A local business responded";
      case "contact_requested":
        return "They are asking to contact you";
      case "contact_approved":
        return "Contact approved";
      case "contact_denied":
        return "Contact declined";
      case "contact_released":
        return "Contact released";
      case "request_closed":
        return "Request closed";
      default:
        return "Request updated";
    }
  }

  switch (status) {
    case "business_responded":
      return "Response sent";
    case "contact_requested":
      return "Waiting for requester approval";
    case "contact_approved":
      return "Contact approved";
    case "contact_denied":
      return "Contact declined";
    case "contact_released":
      return "Contact released";
    case "request_closed":
      return "Request closed";
    default:
      return "Request updated";
  }
}

async function resolveLifecycleRecipients(requestId: string, eventType: string) {
  const dispatchRows = await db.execute(sql`
    SELECT user_id
    FROM direct_connect_dispatch_requests
    WHERE id = ${requestId}
    LIMIT 1
  `);
  const ownerUserId = String(((dispatchRows.rows || []) as any[])[0]?.user_id || "").trim();

  const recipients = new Map<string, LifecycleRecipient>();
  if (ownerUserId) {
    recipients.set(`requester:${ownerUserId}`, {
      recipientType: "requester",
      recipientId: ownerUserId,
    });
  }

  if (
    [
      "contractor_responded",
      "contact_requested",
      "contact_approved",
      "contact_denied",
      "contact_released",
      "request_closed",
      "deposit_requested",
      "deposit_acknowledged",
      "deposit_paid_outside_platform",
      "deposit_waived",
      "payment_request_canceled",
      "schedule_proposed",
      "schedule_accepted",
      "schedule_change_requested",
      "schedule_declined",
      "job_scheduled",
      "work_started",
      "checkpoint_created",
      "checkpoint_updated",
      "checkpoint_completed",
      "checkpoint_approved",
      "checkpoint_issue_reported",
      "change_order_created",
      "change_order_sent",
      "change_order_approved",
      "change_order_declined",
      "change_order_change_requested",
      "change_order_voided",
      "punch_list_started",
      "punch_item_created",
      "punch_item_acknowledged",
      "punch_item_started",
      "punch_item_resolved",
      "punch_item_approved",
      "punch_item_rejected",
      "punch_item_waived",
      "completion_requested",
      "completion_confirmed",
      "completion_rejected",
      "invoice_started",
      "invoice_line_item_added",
      "invoice_sent",
      "invoice_acknowledged",
      "invoice_disputed",
      "invoice_marked_paid_outside_platform",
      "invoice_voided",
      "receipt_uploaded",
      "payment_recorded",
      "receipt_disputed",
      "receipt_voided",
      "job_completed",
    ].includes(eventType)
  ) {
    const contractorRows = await db.execute(sql`
      SELECT DISTINCT responder_user_id
      FROM direct_connect_dispatch_candidates
      WHERE request_id = ${requestId}
        AND responder_user_id IS NOT NULL
    `);
    for (const row of (contractorRows.rows || []) as any[]) {
      const recipientId = String(row?.responder_user_id || "").trim();
      if (!recipientId) continue;
      recipients.set(`contractor:${recipientId}`, {
        recipientType: "contractor",
        recipientId,
      });
    }
  }

  return Array.from(recipients.values());
}

export async function getLifecycleStatusForRecipient(args: {
  requestId: string;
  recipientType: "requester" | "contractor";
  recipientId: string;
}) {
  const rows = await db.execute(sql`
    SELECT lifecycle_status, message_text, created_at
    FROM direct_connect_lifecycle_notifications
    WHERE request_id = ${args.requestId}
      AND recipient_type = ${args.recipientType}
      AND recipient_id = ${args.recipientId}
    ORDER BY created_at DESC
    LIMIT 1
  `);
  const latest = ((rows.rows || []) as any[])[0] || null;
  if (!latest) return null;
  return {
    lifecycleStatus: String(latest.lifecycle_status || ""),
    latestStatus: String(latest.message_text || ""),
    latestStatusAt: latest.created_at || null,
  };
}

export async function getUnreadLifecycleStatusCount(args: {
  requestId: string;
  recipientType: "requester" | "contractor";
  recipientId: string;
}) {
  const rows = await db.execute(sql`
    SELECT COUNT(*)::int AS count
    FROM direct_connect_lifecycle_notifications
    WHERE request_id = ${args.requestId}
      AND recipient_type = ${args.recipientType}
      AND recipient_id = ${args.recipientId}
      AND is_read = false
  `);
  return Number(((rows.rows || []) as any[])[0]?.count || 0);
}

export async function getJobWorkspaceByRequestId(requestId: string) {
  const rows = await db.execute(sql`
    SELECT
      id,
      request_id,
      requester_user_id,
      business_id,
      contractor_id,
      contractor_response_id,
      source,
      category,
      county,
      city_area,
      status,
      active_stage,
      created_at,
      updated_at
    FROM direct_connect_job_workspaces
    WHERE request_id = ${requestId}
    ORDER BY created_at DESC
    LIMIT 1
  `);
  return ((rows.rows || []) as any[])[0] || null;
}

export async function createOrGetJobWorkspaceAtContactRelease(args: {
  requestId: string;
  requesterUserId: string;
  businessId?: string | null;
  contractorId?: string | null;
  contractorResponseId?: string | null;
  category?: string | null;
  county?: string | null;
  cityArea?: string | null;
}) {
  const existing = await getJobWorkspaceByRequestId(args.requestId);
  if (existing) return existing;

  const id = randomUUID();
  await db.execute(sql`
    INSERT INTO direct_connect_job_workspaces (
      id, request_id, requester_user_id, business_id, contractor_id, contractor_response_id,
      source, category, county, city_area, status, active_stage, created_at, updated_at
    )
    VALUES (
      ${id},
      ${args.requestId},
      ${args.requesterUserId},
      ${args.businessId ?? null},
      ${args.contractorId ?? null},
      ${args.contractorResponseId ?? null},
      'direct_connect',
      ${args.category ?? null},
      ${args.county ?? null},
      ${args.cityArea ?? null},
      'contact_started',
      'contact',
      now(),
      now()
    )
  `);

  return await getJobWorkspaceByRequestId(args.requestId);
}

export function getAllowedLifecycleActions(args: {
  stage: JobLifecycleStage;
  role: "requester" | "contractor";
}) {
  if (args.role === "contractor") {
    switch (args.stage) {
      case "contact":
        return ["create_estimate", "request_more_details", "mark_not_moving_forward"];
      case "estimate":
        return ["add_material_item", "add_labor_item", "send_estimate", "revise_estimate"];
      case "acceptance":
        return [
          "start_work",
          "request_deposit",
          "create_payment_request",
          "propose_schedule",
          "create_checkpoint",
          "create_change_order",
          "mark_not_moving_forward",
        ];
      case "deposit":
      case "scheduling":
      case "in_progress":
      case "checkpoint":
      case "change_order":
      case "punch_list":
        return [
          "update_checkpoint",
          "complete_checkpoint",
          "create_change_order",
          "create_punch_item",
          "acknowledge_punch_item",
          "resolve_punch_item",
          "request_completion",
          "add_punch_list_item",
          "mark_ready_for_punchout",
        ];
      case "invoicing":
      case "receipt":
      case "completed":
        return [
          "create_invoice",
          "send_invoice",
          "send_final_invoice",
          "upload_receipt",
          "record_payment_outside_platform",
          "mark_complete",
        ];
      case "closed":
      default:
        return [];
    }
  }

  switch (args.stage) {
    case "contact":
      return ["view_job_workspace", "message_or_contact_business", "close_request"];
    case "estimate":
      return ["review_estimate", "accept_estimate", "request_estimate_changes", "decline_estimate"];
    case "acceptance":
    case "deposit":
    case "scheduling":
      return [
        "view_accepted_estimate",
        "review_payment_request",
        "acknowledge_payment_request",
        "mark_paid_outside_platform",
        "review_schedule",
        "accept_schedule",
        "request_schedule_change",
        "decline_schedule",
      ];
    case "in_progress":
    case "checkpoint":
    case "change_order":
    case "punch_list":
      return [
        "review_checkpoint",
        "approve_checkpoint",
        "report_checkpoint_issue",
        "review_change_order",
        "approve_change_order",
        "decline_change_order",
        "request_change_order_changes",
        "create_punch_item",
        "approve_punch_item",
        "reject_punch_item",
        "waive_punch_item",
        "review_completion_request",
        "confirm_completion",
        "reject_completion",
        "add_punch_list_item",
      ];
    case "invoicing":
    case "receipt":
    case "completed":
      return [
        "view_invoice",
        "acknowledge_invoice",
        "dispute_invoice",
        "mark_paid_outside_platform",
        "view_receipt",
        "dispute_receipt",
      ];
    case "closed":
    default:
      return [];
  }
}

export async function persistFinalizedDispatchRequest(args: {
  canonical: CanonicalDirectConnectRequest;
  userId?: string | null;
  anonymousSessionId?: string | null;
}) {
  const now = new Date().toISOString();
  await db.execute(sql`
    INSERT INTO direct_connect_dispatch_requests (
      id, user_id, anonymous_session_id, intent, request_type, category, county, city_area, urgency, description,
      answers_json, completeness_state, routing_readiness_state, visibility_state, contact_gate_state, source_surface, created_at, updated_at
    )
    VALUES (
      ${args.canonical.requestId},
      ${args.userId ?? null},
      ${args.anonymousSessionId ?? null},
      ${args.canonical.intent},
      ${args.canonical.requestType},
      ${args.canonical.category},
      ${args.canonical.county},
      ${args.canonical.cityArea},
      ${args.canonical.urgency},
      ${args.canonical.description},
      ${JSON.stringify(args.canonical.answers)}::jsonb,
      ${args.canonical.completenessState},
      ${args.canonical.routingReadiness},
      ${args.canonical.visibilityState},
      ${args.canonical.contactGateState},
      ${args.canonical.sourceSurface},
      ${args.canonical.createdAt || now}::timestamptz,
      ${now}::timestamptz
    )
    ON CONFLICT (id)
    DO UPDATE SET
      user_id = EXCLUDED.user_id,
      anonymous_session_id = EXCLUDED.anonymous_session_id,
      intent = EXCLUDED.intent,
      request_type = EXCLUDED.request_type,
      category = EXCLUDED.category,
      county = EXCLUDED.county,
      city_area = EXCLUDED.city_area,
      urgency = EXCLUDED.urgency,
      description = EXCLUDED.description,
      answers_json = EXCLUDED.answers_json,
      completeness_state = EXCLUDED.completeness_state,
      routing_readiness_state = EXCLUDED.routing_readiness_state,
      visibility_state = EXCLUDED.visibility_state,
      contact_gate_state = EXCLUDED.contact_gate_state,
      source_surface = EXCLUDED.source_surface,
      updated_at = ${now}::timestamptz
  `);
}

export async function appendDispatchEvent(args: {
  requestId: string;
  actorType: "requester" | "contractor" | "system" | "staff";
  actorId?: string | null;
  eventType:
    | "request_finalized"
    | "request_route_ready"
    | "request_route_blocked"
    | "candidate_eligible"
    | "candidate_ineligible"
    | "request_shared"
    | "contact_requested"
    | "contact_released"
    | "contractor_responded"
    | "contractor_viewed_request"
    | "homeowner_viewed_request"
    | "homeowner_viewed_response"
    | "requester_viewed_request"
    | "requester_viewed_response"
    | "requester_ownership_upgraded"
    | "contact_approved"
    | "contact_denied"
    | "request_closed"
    | "job_workspace_created"
    | "estimate_started"
    | "estimate_line_item_added"
    | "estimate_sent"
    | "estimate_accepted"
    | "estimate_change_requested"
    | "estimate_declined"
    | "estimate_voided"
    | "deposit_requested"
    | "deposit_acknowledged"
    | "deposit_paid_outside_platform"
    | "deposit_waived"
    | "payment_request_canceled"
    | "schedule_accepted"
    | "schedule_change_requested"
    | "schedule_declined"
    | "job_scheduled"
    | "deposit_recorded"
    | "schedule_proposed"
    | "work_started"
    | "checkpoint_created"
    | "checkpoint_updated"
    | "checkpoint_completed"
    | "checkpoint_approved"
    | "checkpoint_issue_reported"
    | "change_order_created"
    | "change_order_sent"
    | "change_order_approved"
    | "change_order_declined"
    | "change_order_change_requested"
    | "change_order_voided"
    | "punch_list_started"
    | "punch_item_created"
    | "punch_item_acknowledged"
    | "punch_item_started"
    | "punch_item_resolved"
    | "punch_item_approved"
    | "punch_item_rejected"
    | "punch_item_waived"
    | "completion_requested"
    | "completion_confirmed"
    | "completion_rejected"
    | "punch_item_completed"
    | "invoice_started"
    | "invoice_line_item_added"
    | "invoice_sent"
    | "invoice_acknowledged"
    | "invoice_disputed"
    | "invoice_marked_paid_outside_platform"
    | "invoice_voided"
    | "receipt_uploaded"
    | "payment_recorded"
    | "receipt_disputed"
    | "receipt_voided"
    | "job_completed"
    | "job_closed";
  metadata?: Record<string, unknown>;
}) {
  const lifecycle = normalizeLifecycleEvent(args.eventType);
  await db.execute(sql`
    INSERT INTO direct_connect_dispatch_events (
      event_id, request_id, actor_type, actor_id, event_type, metadata_json, created_at
    )
    VALUES (
      ${randomUUID()},
      ${args.requestId},
      ${args.actorType},
      ${args.actorId ?? null},
      ${args.eventType},
      ${JSON.stringify(args.metadata || {})}::jsonb,
      now()
    )
  `);
  if (!lifecycle) return;

  const recipients = await resolveLifecycleRecipients(args.requestId, args.eventType);
  for (const recipient of recipients) {
    const messageText = messageForLifecycleStatus(lifecycle, recipient.recipientType);
    await db.execute(sql`
      INSERT INTO direct_connect_lifecycle_notifications (
        id, request_id, actor_type, actor_id, recipient_type, recipient_id, event_type,
        lifecycle_status, message_key, message_text, is_read, created_at
      )
      VALUES (
        ${randomUUID()},
        ${args.requestId},
        ${args.actorType},
        ${args.actorId ?? null},
        ${recipient.recipientType},
        ${recipient.recipientId},
        ${args.eventType},
        ${lifecycle},
        ${`direct_connect.lifecycle.${lifecycle}`},
        ${messageText},
        false,
        now()
      )
    `);
  }
}

export async function snapshotDispatchCandidate(args: {
  requestId: string;
  businessId?: string | null;
  contractorId?: string | null;
  responderUserId?: string | null;
  workerId?: string | null;
  eligibility: ContractorEligibilityResult;
  eligibilityReasons?: string[];
  ineligibilityReasons?: string[];
  territoryMatched: boolean;
  categoryMatched: boolean;
  verificationState: string;
  profileReadiness: string;
  contactEligibility: boolean;
  trustState: string;
}) {
  await db.execute(sql`
    INSERT INTO direct_connect_dispatch_candidates (
      id, request_id, business_id, contractor_id, responder_user_id, worker_id,
      eligibility_state, eligibility_reasons, ineligibility_reasons,
      territory_matched, category_matched, verification_state, profile_readiness, contact_eligibility, trust_state, created_at
    )
    VALUES (
      ${randomUUID()},
      ${args.requestId},
      ${args.businessId ?? null},
      ${args.contractorId ?? null},
      ${args.responderUserId ?? null},
      ${args.workerId ?? null},
      ${args.eligibility.status},
      ${JSON.stringify(args.eligibilityReasons || [])}::jsonb,
      ${JSON.stringify(args.ineligibilityReasons || [])}::jsonb,
      ${args.territoryMatched},
      ${args.categoryMatched},
      ${args.verificationState},
      ${args.profileReadiness},
      ${args.contactEligibility},
      ${args.trustState},
      now()
    )
  `);
}

export async function setDispatchContactGateState(args: {
  requestId: string;
  nextState: ContactGateState;
}) {
  if (args.nextState === "released") {
    const result = await db.execute(sql`
      UPDATE direct_connect_dispatch_requests
      SET contact_gate_state = 'released', updated_at = now()
      WHERE id = ${args.requestId}
        AND contact_gate_state = 'user_approved'
    `);
    const updated = Number((result as any)?.rowCount || 0);
    if (updated < 1) {
      throw new Error("CONTACT_RELEASE_REQUIRES_APPROVAL");
    }
    return;
  }
  await db.execute(sql`
    UPDATE direct_connect_dispatch_requests
    SET contact_gate_state = ${args.nextState}, updated_at = now()
    WHERE id = ${args.requestId}
  `);
}

export async function recordContractorResponse(args: {
  requestId: string;
  contractorId?: string | null;
  responderUserId?: string | null;
  responseType: "interested" | "need_more_info" | "not_a_fit" | "unavailable";
  message?: string | null;
  availability?: string | null;
  estimatedTiming?: string | null;
  contactRequestState: ContactGateState;
}) {
  await db.execute(sql`
    INSERT INTO direct_connect_contractor_responses (
      id, request_id, contractor_id, responder_user_id, response_type, message, availability, estimated_timing, contact_request_state, created_at
    )
    VALUES (
      ${randomUUID()},
      ${args.requestId},
      ${args.contractorId ?? null},
      ${args.responderUserId ?? null},
      ${args.responseType},
      ${args.message ?? null},
      ${args.availability ?? null},
      ${args.estimatedTiming ?? null},
      ${args.contactRequestState},
      now()
    )
  `);
}
