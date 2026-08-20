import { randomUUID } from "node:crypto";
import { pool } from "../db";

export type ProductionAcceptanceStatus =
  | "working"
  | "genuinely_empty"
  | "unavailable"
  | "blocked";

export type ProductionAcceptanceLane = {
  id: string;
  label: string;
  status: ProductionAcceptanceStatus;
  workspacePath: string;
  summary: string;
  counts: Record<string, number | string | null>;
  findings: string[];
};

export type ProductionAcceptanceReport = {
  generatedAt: string;
  revision: string | null;
  database: {
    reachable: boolean;
    checkedAt: string;
  };
  controlledWriteCanary: {
    status: "passed" | "failed";
    detail: string;
  };
  summary: Record<ProductionAcceptanceStatus, number>;
  lanes: ProductionAcceptanceLane[];
};

function numberValue(row: Record<string, unknown>, key: string): number {
  const value = Number(row[key] ?? 0);
  return Number.isFinite(value) ? value : 0;
}

function textValue(row: Record<string, unknown>, key: string): string | null {
  const value = row[key];
  if (value === null || value === undefined || value === "") return null;
  return String(value);
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

async function buildLane(
  input: Omit<ProductionAcceptanceLane, "status" | "summary" | "counts" | "findings">,
  run: () => Promise<Omit<ProductionAcceptanceLane, "id" | "label" | "workspacePath">>
): Promise<ProductionAcceptanceLane> {
  try {
    return { ...input, ...(await run()) };
  } catch (error) {
    return {
      ...input,
      status: "unavailable",
      summary: "The production source could not be read.",
      counts: {},
      findings: [errorMessage(error)],
    };
  }
}

async function runControlledWriteCanary(): Promise<
  ProductionAcceptanceReport["controlledWriteCanary"]
> {
  const client = await pool.connect();
  const id = randomUUID();

  try {
    await client.query("BEGIN");
    await client.query(`
      CREATE TEMP TABLE admin_production_acceptance_canary (
        id uuid PRIMARY KEY,
        created_at timestamptz NOT NULL DEFAULT now()
      ) ON COMMIT DROP
    `);
    await client.query(
      "INSERT INTO admin_production_acceptance_canary (id) VALUES ($1::uuid)",
      [id]
    );
    const result = await client.query(
      "SELECT COUNT(*)::int AS count FROM admin_production_acceptance_canary WHERE id = $1::uuid",
      [id]
    );
    await client.query("ROLLBACK");

    if (Number(result.rows?.[0]?.count || 0) !== 1) {
      throw new Error("The temporary record could not be read back before rollback.");
    }

    return {
      status: "passed",
      detail:
        "A temporary transaction record was inserted, read back, and rolled back. No production business record was retained.",
    };
  } catch (error) {
    try {
      await client.query("ROLLBACK");
    } catch {
      // The original canary failure remains authoritative.
    }
    return {
      status: "failed",
      detail: errorMessage(error),
    };
  } finally {
    client.release();
  }
}

async function requestsLane(): Promise<ProductionAcceptanceLane> {
  const input = {
    id: "requests",
    label: "Requests",
    workspacePath: "/admin/direct-connect-requests",
  };

  return buildLane(input, async () => {
    const { rows } = await pool.query(`
      SELECT
        (SELECT COUNT(*)::int FROM work_requests) AS work_requests_total,
        (SELECT COUNT(*)::int FROM work_requests WHERE created_at >= now() - interval '30 days') AS work_requests_30d,
        (SELECT COUNT(*)::int FROM work_requests WHERE status = 'open') AS work_requests_open,
        (SELECT COUNT(*)::int FROM work_requests WHERE status = 'routed') AS work_requests_routed,
        (SELECT COUNT(*)::int
           FROM work_request_assignments a
           LEFT JOIN work_requests r ON r.id = a.work_request_id
          WHERE r.id IS NULL) AS orphan_assignments,
        (SELECT COUNT(*)::int
           FROM work_request_events e
           LEFT JOIN work_requests r ON r.id = e.work_request_id
          WHERE r.id IS NULL) AS orphan_events,
        (SELECT COUNT(*)::int FROM direct_connect_dispatch_requests) AS dispatch_requests_total,
        (SELECT COUNT(*)::int
           FROM direct_connect_dispatch_requests
          WHERE routing_readiness_state = 'route_ready') AS route_ready,
        (SELECT COUNT(*)::int
           FROM direct_connect_dispatch_requests
          WHERE contact_gate_state = 'locked') AS contact_locked,
        (SELECT COUNT(*)::int FROM direct_connect_contractor_responses) AS responses_total,
        (SELECT COUNT(*)::int
           FROM direct_connect_contractor_responses
          WHERE contact_request_state = 'contractor_requested') AS contact_requests,
        (SELECT COUNT(*)::int FROM direct_connect_job_workspaces) AS job_workspaces
    `);
    const row = rows[0] || {};
    const total = numberValue(row, "work_requests_total");
    const dispatchTotal = numberValue(row, "dispatch_requests_total");
    const orphanAssignments = numberValue(row, "orphan_assignments");
    const orphanEvents = numberValue(row, "orphan_events");
    const blocked = orphanAssignments > 0 || orphanEvents > 0;

    return {
      status: blocked
        ? "blocked"
        : total === 0 && dispatchTotal === 0
          ? "genuinely_empty"
          : "working",
      summary: blocked
        ? "Request records exist, but orphan lifecycle records prevent clean acceptance."
        : total === 0 && dispatchTotal === 0
          ? "The request sources are reachable and contain no requests."
          : "Request storage, routing evidence, responses, and contact-gate state are readable.",
      counts: {
        workRequests: total,
        workRequests30d: numberValue(row, "work_requests_30d"),
        open: numberValue(row, "work_requests_open"),
        routed: numberValue(row, "work_requests_routed"),
        dispatchRequests: dispatchTotal,
        routeReady: numberValue(row, "route_ready"),
        contactLocked: numberValue(row, "contact_locked"),
        responses: numberValue(row, "responses_total"),
        contactRequests: numberValue(row, "contact_requests"),
        jobWorkspaces: numberValue(row, "job_workspaces"),
        orphanAssignments,
        orphanEvents,
      },
      findings: [
        `${numberValue(row, "contact_requests")} provider contact request(s) are waiting inside the existing contact gate.`,
        blocked
          ? `${orphanAssignments} orphan assignment(s) and ${orphanEvents} orphan event(s) require repair.`
          : "No orphan assignment or request-event records were found.",
      ],
    };
  });
}

async function partnerOperationsLane(): Promise<ProductionAcceptanceLane> {
  const input = {
    id: "partner_operations",
    label: "Partner Operations",
    workspacePath: "/admin/tradepartners",
  };

  return buildLane(input, async () => {
    const { rows } = await pool.query(`
      SELECT
        (SELECT COUNT(*)::int FROM managed_partner_intakes WHERE archived_at IS NULL) AS active_intakes,
        (SELECT COUNT(*)::int FROM managed_partner_intakes WHERE archived_at IS NULL AND stage = 'blocked') AS blocked_intakes,
        (SELECT COUNT(*)::int FROM managed_partner_intakes WHERE archived_at IS NULL AND stage = 'live') AS live_intakes,
        (SELECT COUNT(*)::int FROM professional_partnerships) AS partnerships_total,
        (SELECT COUNT(*)::int FROM professional_partnerships WHERE status = 'active') AS partnerships_active,
        (SELECT COUNT(*)::int FROM tradepartner_campaigns) AS campaigns_total,
        (SELECT COUNT(*)::int FROM tradepartner_campaigns WHERE is_active = true) AS campaigns_active,
        (SELECT COUNT(*)::int
           FROM businesses b
           JOIN profiles p ON p.business_id = b.id
          WHERE (
            COALESCE(b.profile_data->'importExtras'->>'profile_control', '') ILIKE '%tradescout%'
            OR COALESCE(b.profile_data->'importExtras'->>'contact_management', '') ILIKE '%tradescout%'
          )) AS managed_profiles,
        (SELECT COUNT(*)::int
           FROM businesses b
           JOIN profiles p ON p.business_id = b.id
          WHERE (
            COALESCE(b.profile_data->'importExtras'->>'profile_control', '') ILIKE '%tradescout%'
            OR COALESCE(b.profile_data->'importExtras'->>'contact_management', '') ILIKE '%tradescout%'
          )
            AND p.owner_user_id IS DISTINCT FROM b.owner_user_id) AS ownership_mismatches
    `);
    const row = rows[0] || {};
    const activeIntakes = numberValue(row, "active_intakes");
    const managedProfiles = numberValue(row, "managed_profiles");
    const ownershipMismatches = numberValue(row, "ownership_mismatches");
    const hasData = activeIntakes + managedProfiles + numberValue(row, "partnerships_total") > 0;

    return {
      status: ownershipMismatches > 0
        ? "blocked"
        : hasData
          ? "working"
          : "genuinely_empty",
      summary: ownershipMismatches > 0
        ? "Managed profile ownership is inconsistent."
        : hasData
          ? "Managed partner intake, profile stewardship, partnership, and campaign sources are readable."
          : "Partner sources are reachable and contain no operating records.",
      counts: {
        activeIntakes,
        blockedIntakes: numberValue(row, "blocked_intakes"),
        liveIntakes: numberValue(row, "live_intakes"),
        partnerships: numberValue(row, "partnerships_total"),
        activePartnerships: numberValue(row, "partnerships_active"),
        campaigns: numberValue(row, "campaigns_total"),
        activeCampaigns: numberValue(row, "campaigns_active"),
        managedProfiles,
        ownershipMismatches,
      },
      findings: [
        `${numberValue(row, "blocked_intakes")} intake(s) have a named blocker and remain visible for action.`,
        ownershipMismatches > 0
          ? `${ownershipMismatches} managed profile ownership mismatch(es) require repair.`
          : "No managed profile ownership mismatch was found.",
      ],
    };
  });
}

async function countyCoverageLane(): Promise<ProductionAcceptanceLane> {
  const input = {
    id: "county_coverage",
    label: "County Coverage",
    workspacePath: "/admin/geo/counties",
  };

  return buildLane(input, async () => {
    const { rows } = await pool.query(`
      WITH entity_counts AS (
        SELECT
          county_fips,
          COUNT(*) FILTER (WHERE status = 'active' AND entity_type::text = 'territory_manager')::int AS tm_count,
          COUNT(*) FILTER (
            WHERE status = 'active' AND entity_type::text IN ('affiliate', 'partner')
          )::int AS partner_count
        FROM county_entities
        GROUP BY county_fips
      )
      SELECT
        (SELECT COUNT(*)::int FROM counties) AS counties_total,
        (SELECT COUNT(*)::int FROM entity_counts WHERE tm_count > 0 AND partner_count > 0) AS full_coverage,
        (SELECT COUNT(*)::int FROM entity_counts WHERE (tm_count > 0) <> (partner_count > 0)) AS partial_coverage,
        (SELECT COUNT(*)::int FROM county_entities WHERE status = 'active') AS active_entities,
        (SELECT COUNT(*)::int FROM county_notes) AS notes_total,
        (SELECT COUNT(*)::int FROM users WHERE county_fips ~ '^\\d{5}$') AS users_with_county,
        (SELECT COUNT(DISTINCT county_fips)::int FROM county_metrics WHERE metric_key = 'users_total') AS user_metric_counties,
        (SELECT COUNT(*)::int
           FROM affiliate_accounts a
           JOIN users u ON u.id = a.affiliate_id
          WHERE u.county_fips ~ '^\\d{5}$') AS affiliates_with_county,
        (SELECT COUNT(DISTINCT county_fips)::int FROM county_metrics WHERE metric_key = 'affiliates_count') AS affiliate_metric_counties,
        (SELECT COUNT(*)::int FROM trade_deals) AS trade_deals_total,
        (SELECT COUNT(DISTINCT county_fips)::int
           FROM county_metrics
          WHERE metric_key IN ('tradedeals_active', 'tradedeals_claimed_30d')) AS trade_deal_metric_counties,
        (SELECT COUNT(*)::int FROM county_metrics) AS metric_rows,
        (SELECT MAX(updated_at) FROM county_metrics) AS latest_metric_at
    `);
    const row = rows[0] || {};
    const counties = numberValue(row, "counties_total");
    const usersWithCounty = numberValue(row, "users_with_county");
    const userMetricCounties = numberValue(row, "user_metric_counties");
    const affiliatesWithCounty = numberValue(row, "affiliates_with_county");
    const affiliateMetricCounties = numberValue(row, "affiliate_metric_counties");
    const tradeDeals = numberValue(row, "trade_deals_total");
    const tradeDealMetricCounties = numberValue(row, "trade_deal_metric_counties");
    const missingUserMetrics = usersWithCounty > 0 && userMetricCounties === 0;
    const missingAffiliateMetrics = affiliatesWithCounty > 0 && affiliateMetricCounties === 0;
    const missingTradeDealMetrics = tradeDeals > 0 && tradeDealMetricCounties === 0;
    const blocked =
      counties < 3000 || missingUserMetrics || missingAffiliateMetrics || missingTradeDealMetrics;
    const fullCoverage = numberValue(row, "full_coverage");
    const partialCoverage = numberValue(row, "partial_coverage");

    return {
      status: blocked ? "blocked" : counties === 0 ? "genuinely_empty" : "working",
      summary: blocked
        ? "The county source is readable, but one or more required coverage inputs are incomplete."
        : "County identity, assignments, notes, and precomputed metric sources are readable.",
      counts: {
        counties,
        fullCoverage,
        partialCoverage,
        unassigned: Math.max(0, counties - fullCoverage - partialCoverage),
        activeEntities: numberValue(row, "active_entities"),
        notes: numberValue(row, "notes_total"),
        usersWithCounty,
        userMetricCounties,
        affiliatesWithCounty,
        affiliateMetricCounties,
        tradeDeals,
        tradeDealMetricCounties,
        metricRows: numberValue(row, "metric_rows"),
        latestMetricAt: textValue(row, "latest_metric_at"),
      },
      findings: [
        counties < 3000
          ? `Only ${counties} county records are stored; national coverage requires the full county set.`
          : `${counties} county records are stored.`,
        missingUserMetrics
          ? "Users have county assignments, but users_total metrics are missing."
          : "User county metrics are available or no user county source exists.",
        missingAffiliateMetrics
          ? "Affiliate accounts resolve to counties, but affiliates_count metrics are missing."
          : "Affiliate county metrics are available or no affiliate county source exists.",
        missingTradeDealMetrics
          ? "TradeDeals exist, but no county-attributed TradeDeals metric is available."
          : "TradeDeals metrics are available or no county-attributable TradeDeals exist.",
      ],
    };
  });
}

async function commercialWorkLane(): Promise<ProductionAcceptanceLane> {
  const input = {
    id: "commercial_work",
    label: "Commercial Work",
    workspacePath: "/admin/commercial-directory",
  };

  return buildLane(input, async () => {
    const { rows } = await pool.query(`
      SELECT
        (SELECT COUNT(*)::int FROM commercial_projects) AS projects_total,
        (SELECT COUNT(*)::int FROM commercial_projects WHERE status = 'open') AS projects_open,
        (SELECT COUNT(*)::int FROM commercial_projects WHERE status = 'awarded') AS projects_awarded,
        (SELECT COUNT(*)::int FROM commercial_project_bids) AS bids_total,
        (SELECT COUNT(*)::int FROM commercial_project_documents) AS documents_total,
        (SELECT COUNT(*)::int
           FROM commercial_project_bids b
           LEFT JOIN commercial_projects p ON p.id = b.project_id
          WHERE p.id IS NULL) AS orphan_bids,
        (SELECT COUNT(*)::int
           FROM commercial_project_documents d
           LEFT JOIN commercial_projects p ON p.id = d.project_id
          WHERE p.id IS NULL) AS orphan_documents,
        (SELECT MAX(updated_at) FROM commercial_projects) AS latest_project_update
    `);
    const row = rows[0] || {};
    const projects = numberValue(row, "projects_total");
    const orphanBids = numberValue(row, "orphan_bids");
    const orphanDocuments = numberValue(row, "orphan_documents");
    const blocked = orphanBids > 0 || orphanDocuments > 0;

    return {
      status: blocked ? "blocked" : projects === 0 ? "genuinely_empty" : "working",
      summary: blocked
        ? "Commercial records contain orphan project evidence."
        : projects === 0
          ? "Commercial sources are reachable and no project has been created."
          : "Commercial projects, bids, and documents are readable.",
      counts: {
        projects,
        open: numberValue(row, "projects_open"),
        awarded: numberValue(row, "projects_awarded"),
        bids: numberValue(row, "bids_total"),
        documents: numberValue(row, "documents_total"),
        orphanBids,
        orphanDocuments,
        latestProjectUpdate: textValue(row, "latest_project_update"),
      },
      findings: [
        projects === 0
          ? "This lane is genuinely empty; the source did not fail."
          : "Commercial project records are present.",
      ],
    };
  });
}

async function procurementLane(): Promise<ProductionAcceptanceLane> {
  const input = {
    id: "procurement",
    label: "Procurement",
    workspacePath: "/admin/procurement",
  };

  return buildLane(input, async () => {
    const { rows } = await pool.query(`
      SELECT
        (SELECT COUNT(*)::int FROM procurement_orders) AS orders_total,
        (SELECT COUNT(*)::int FROM procurement_orders WHERE status IN ('submitted', 'needs_review', 'quote_pending')) AS needs_review,
        (SELECT COUNT(*)::int FROM procurement_orders WHERE status = 'completed') AS completed,
        (SELECT COUNT(*)::int FROM procurement_workspaces) AS workspaces_total,
        (SELECT COUNT(*)::int FROM procurement_workspaces WHERE status = 'active') AS workspaces_active,
        (SELECT COUNT(*)::int FROM procurement_quotes) AS quotes_total,
        (SELECT COUNT(*)::int FROM procurement_supplier_quotes) AS supplier_quotes_total,
        (SELECT COUNT(*)::int FROM procurement_delivery_proofs) AS proofs_total,
        (SELECT COUNT(*)::int
           FROM procurement_order_items i
           LEFT JOIN procurement_orders o ON o.id = i.order_id
          WHERE o.id IS NULL) AS orphan_items,
        (SELECT COUNT(*)::int
           FROM procurement_quotes q
           LEFT JOIN procurement_orders o ON o.id = q.order_id
          WHERE o.id IS NULL) AS orphan_quotes,
        (SELECT COUNT(*)::int
           FROM procurement_delivery_proofs p
           LEFT JOIN procurement_orders o ON o.id = p.order_id
          WHERE o.id IS NULL) AS orphan_proofs,
        (SELECT MAX(updated_at) FROM procurement_orders) AS latest_order_update
    `);
    const row = rows[0] || {};
    const orders = numberValue(row, "orders_total");
    const workspaces = numberValue(row, "workspaces_total");
    const orphanItems = numberValue(row, "orphan_items");
    const orphanQuotes = numberValue(row, "orphan_quotes");
    const orphanProofs = numberValue(row, "orphan_proofs");
    const blocked =
      orphanItems > 0 || orphanQuotes > 0 || orphanProofs > 0 || (orders > 0 && workspaces === 0);

    return {
      status: blocked ? "blocked" : orders === 0 ? "genuinely_empty" : "working",
      summary: blocked
        ? "Procurement records exist, but a required workspace or related record is missing."
        : orders === 0
          ? "Procurement sources are reachable and contain no orders."
          : "Orders, workspaces, quotes, and fulfillment proof are readable.",
      counts: {
        orders,
        needsReview: numberValue(row, "needs_review"),
        completed: numberValue(row, "completed"),
        workspaces,
        activeWorkspaces: numberValue(row, "workspaces_active"),
        quotes: numberValue(row, "quotes_total"),
        supplierQuotes: numberValue(row, "supplier_quotes_total"),
        proofs: numberValue(row, "proofs_total"),
        orphanItems,
        orphanQuotes,
        orphanProofs,
        latestOrderUpdate: textValue(row, "latest_order_update"),
      },
      findings: [
        `${numberValue(row, "needs_review")} order(s) currently require review.`,
        blocked
          ? "At least one procurement relationship requires repair."
          : "No orphan item, quote, or proof record was found.",
      ],
    };
  });
}

async function salesPipelineLane(): Promise<ProductionAcceptanceLane> {
  const input = {
    id: "sales_pipeline",
    label: "Sales Pipeline",
    workspacePath: "/admin/crm",
  };

  return buildLane(input, async () => {
    const { rows } = await pool.query(`
      SELECT
        (SELECT COUNT(*)::int FROM crm_contacts) AS contacts_total,
        (SELECT COUNT(*)::int FROM crm_deals) AS deals_total,
        (SELECT COUNT(*)::int FROM crm_deals WHERE stage::text NOT IN ('closed_won', 'closed_lost')) AS open_deals,
        (SELECT COALESCE(SUM(value), 0)::numeric FROM crm_deals WHERE stage::text NOT IN ('closed_won', 'closed_lost')) AS open_value,
        (SELECT COUNT(*)::int FROM crm_activities) AS activities_total,
        (SELECT COUNT(*)::int FROM crm_activities WHERE created_at >= now() - interval '7 days') AS activities_7d,
        (SELECT COUNT(*)::int
           FROM crm_deals d
           LEFT JOIN crm_contacts c ON c.id = d.contact_id
          WHERE d.contact_id IS NOT NULL AND c.id IS NULL) AS orphan_deals,
        (SELECT COUNT(*)::int
           FROM crm_activities a
           LEFT JOIN crm_contacts c ON c.id = a.contact_id
          WHERE a.contact_id IS NOT NULL AND c.id IS NULL) AS orphan_contact_activities,
        (SELECT COUNT(*)::int
           FROM crm_activities a
           LEFT JOIN crm_deals d ON d.id = a.deal_id
          WHERE a.deal_id IS NOT NULL AND d.id IS NULL) AS orphan_deal_activities,
        (SELECT MAX(created_at) FROM crm_activities) AS latest_activity_at
    `);
    const row = rows[0] || {};
    const contacts = numberValue(row, "contacts_total");
    const deals = numberValue(row, "deals_total");
    const activities = numberValue(row, "activities_total");
    const orphanDeals = numberValue(row, "orphan_deals");
    const orphanContactActivities = numberValue(row, "orphan_contact_activities");
    const orphanDealActivities = numberValue(row, "orphan_deal_activities");
    const blocked = orphanDeals + orphanContactActivities + orphanDealActivities > 0;
    const empty = contacts + deals + activities === 0;

    return {
      status: blocked ? "blocked" : empty ? "genuinely_empty" : "working",
      summary: blocked
        ? "CRM records contain orphan relationship links."
        : empty
          ? "CRM sources are reachable and contain no sales records."
          : "Contacts, opportunities, and activity history are readable.",
      counts: {
        contacts,
        deals,
        openDeals: numberValue(row, "open_deals"),
        openValue: Number(row.open_value || 0),
        activities,
        activities7d: numberValue(row, "activities_7d"),
        orphanDeals,
        orphanContactActivities,
        orphanDealActivities,
        latestActivityAt: textValue(row, "latest_activity_at"),
      },
      findings: [
        blocked
          ? "At least one CRM relationship points to a missing record."
          : "No orphan deal or activity relationship was found.",
      ],
    };
  });
}

async function systemStatusLane(): Promise<ProductionAcceptanceLane> {
  const input = {
    id: "system_status",
    label: "System Status",
    workspacePath: "/admin/live-stream",
  };

  return buildLane(input, async () => {
    const { rows } = await pool.query(`
      SELECT
        (SELECT COUNT(*)::int FROM admin_live_stream_snapshots) AS snapshots_total,
        (SELECT MAX(computed_at) FROM admin_live_stream_snapshots) AS latest_snapshot_at,
        (SELECT COUNT(*)::int FROM admin_live_stream_snapshot_history) AS history_total,
        (SELECT COUNT(*)::int FROM crawler_request_events WHERE observed_at >= now() - interval '24 hours') AS crawler_24h,
        (SELECT COUNT(*)::int FROM crawler_request_events WHERE observed_at >= now() - interval '24 hours' AND status_code >= 500) AS crawler_5xx_24h,
        (SELECT MAX(observed_at) FROM crawler_request_events) AS latest_crawler_at,
        (SELECT COUNT(*)::int FROM bot_observation_events WHERE observed_at >= now() - interval '24 hours') AS bot_24h,
        (SELECT COUNT(*)::int FROM bot_observation_events WHERE observed_at >= now() - interval '24 hours' AND status_code >= 500) AS bot_5xx_24h,
        (SELECT MAX(observed_at) FROM bot_observation_events) AS latest_bot_at,
        (SELECT EXTRACT(EPOCH FROM (now() - MAX(computed_at))) FROM admin_live_stream_snapshots) AS snapshot_age_seconds,
        (SELECT EXTRACT(EPOCH FROM (now() - MAX(observed_at))) FROM crawler_request_events) AS crawler_age_seconds
    `);
    const row = rows[0] || {};
    const snapshots = numberValue(row, "snapshots_total");
    const snapshotAge = Number(row.snapshot_age_seconds ?? Number.POSITIVE_INFINITY);
    const crawlerAge = Number(row.crawler_age_seconds ?? Number.POSITIVE_INFINITY);
    const blocked =
      snapshots === 0 ||
      !Number.isFinite(snapshotAge) ||
      snapshotAge > 2 * 60 * 60 ||
      !Number.isFinite(crawlerAge) ||
      crawlerAge > 30 * 60;

    return {
      status: blocked ? "blocked" : "working",
      summary: blocked
        ? "System evidence is missing or stale beyond the acceptance window."
        : "Snapshots, crawler telemetry, and bot observations are current.",
      counts: {
        snapshots,
        latestSnapshotAt: textValue(row, "latest_snapshot_at"),
        history: numberValue(row, "history_total"),
        crawler24h: numberValue(row, "crawler_24h"),
        crawler5xx24h: numberValue(row, "crawler_5xx_24h"),
        latestCrawlerAt: textValue(row, "latest_crawler_at"),
        bot24h: numberValue(row, "bot_24h"),
        bot5xx24h: numberValue(row, "bot_5xx_24h"),
        latestBotAt: textValue(row, "latest_bot_at"),
        snapshotAgeSeconds: Number.isFinite(snapshotAge) ? Math.round(snapshotAge) : null,
        crawlerAgeSeconds: Number.isFinite(crawlerAge) ? Math.round(crawlerAge) : null,
      },
      findings: [
        `${numberValue(row, "crawler_5xx_24h")} crawler 5xx response(s) and ${numberValue(row, "bot_5xx_24h")} bot-observation 5xx response(s) were recorded in the last 24 hours.`,
      ],
    };
  });
}

async function financeLane(): Promise<ProductionAcceptanceLane> {
  const input = {
    id: "finance",
    label: "Finance",
    workspacePath: "/admin/finance",
  };

  return buildLane(input, async () => {
    const { rows } = await pool.query(`
      SELECT
        (SELECT COUNT(*)::int FROM wallet_transactions) AS transactions_total,
        (SELECT COUNT(*)::int FROM wallet_accounts) AS wallet_accounts_total,
        (SELECT COUNT(*)::int FROM vault_ledger_entries) AS vault_entries_total,
        (SELECT COUNT(*)::int FROM platform_support_ledger_entries) AS support_entries_total,
        (SELECT COALESCE(SUM(amount), 0)::numeric FROM wallet_transactions WHERE direction = 'credit') AS credits_total,
        (SELECT COALESCE(SUM(amount), 0)::numeric FROM wallet_transactions WHERE direction = 'debit') AS debits_total,
        (SELECT MAX(created_at) FROM wallet_transactions) AS latest_transaction_at,
        (SELECT COUNT(*)::int
           FROM wallet_transactions t
           LEFT JOIN users u ON u.id = t.user_id
          WHERE u.id IS NULL) AS orphan_transactions
    `);
    const row = rows[0] || {};
    const transactions = numberValue(row, "transactions_total");
    const accounts = numberValue(row, "wallet_accounts_total");
    const vaultEntries = numberValue(row, "vault_entries_total");
    const supportEntries = numberValue(row, "support_entries_total");
    const orphanTransactions = numberValue(row, "orphan_transactions");
    const empty = transactions + accounts + vaultEntries + supportEntries === 0;

    return {
      status: orphanTransactions > 0
        ? "blocked"
        : empty
          ? "genuinely_empty"
          : "working",
      summary: orphanTransactions > 0
        ? "A wallet transaction points to a missing user account."
        : empty
          ? "Finance sources are reachable and contain no wallet or ledger movement."
          : "Wallet and ledger evidence are readable without presenting movement as bank balance or revenue.",
      counts: {
        transactions,
        walletAccounts: accounts,
        vaultEntries,
        supportEntries,
        credits: Number(row.credits_total || 0),
        debits: Number(row.debits_total || 0),
        orphanTransactions,
        latestTransactionAt: textValue(row, "latest_transaction_at"),
      },
      findings: [
        empty
          ? "This lane is genuinely empty; no finance source failed."
          : "Finance movement exists and remains read-only in the acceptance report.",
      ],
    };
  });
}

export async function runProductionAcceptanceReport(): Promise<ProductionAcceptanceReport> {
  const checkedAt = new Date().toISOString();
  await pool.query("SELECT 1");

  const [controlledWriteCanary, ...lanes] = await Promise.all([
    runControlledWriteCanary(),
    requestsLane(),
    partnerOperationsLane(),
    countyCoverageLane(),
    commercialWorkLane(),
    procurementLane(),
    salesPipelineLane(),
    systemStatusLane(),
    financeLane(),
  ]);

  const summary: Record<ProductionAcceptanceStatus, number> = {
    working: 0,
    genuinely_empty: 0,
    unavailable: 0,
    blocked: 0,
  };
  for (const lane of lanes as ProductionAcceptanceLane[]) {
    summary[lane.status] += 1;
  }

  return {
    generatedAt: new Date().toISOString(),
    revision:
      process.env.RENDER_GIT_COMMIT ||
      process.env.GIT_COMMIT_SHA ||
      process.env.BUILD_REVISION ||
      null,
    database: {
      reachable: true,
      checkedAt,
    },
    controlledWriteCanary,
    summary,
    lanes: lanes as ProductionAcceptanceLane[],
  };
}
