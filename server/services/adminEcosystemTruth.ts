import { pool } from "../db";
import type {
  AdminEcosystemTruthReport,
  CommercialTermIndexItem,
  DecisionProvenanceItem,
  EcosystemTruthOwner,
  OutcomeSourceCoverage,
  OutcomeTimelineItem,
} from "@shared/adminEcosystemTruth";

type Row = Record<string, unknown>;

function numberValue(row: Row, key: string): number {
  const value = Number(row[key] ?? 0);
  return Number.isFinite(value) ? value : 0;
}

function textValue(row: Row, key: string): string | null {
  const value = row[key];
  if (value === null || value === undefined || value === "") return null;
  if (value instanceof Date) return value.toISOString();
  return String(value);
}

function titleCase(value: string | null): string {
  return String(value || "unknown")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

async function buildOwner(
  input: Omit<EcosystemTruthOwner, "state" | "summary" | "counts" | "findings">,
  run: () => Promise<Pick<EcosystemTruthOwner, "state" | "summary" | "counts" | "findings">>
): Promise<EcosystemTruthOwner> {
  try {
    return { ...input, ...(await run()) };
  } catch {
    return {
      ...input,
      state: "unavailable",
      summary: "The current source could not be read.",
      counts: {},
      findings: ["No fallback value was invented. The existing owner remains unchanged."],
    };
  }
}

async function readRows(query: string): Promise<{ rows: Row[]; available: boolean }> {
  try {
    const result = await pool.query(query);
    return { rows: result.rows as Row[], available: true };
  } catch {
    return { rows: [], available: false };
  }
}

async function buildOwners(): Promise<EcosystemTruthOwner[]> {
  const adminOwner: EcosystemTruthOwner = {
    id: "admin_os",
    label: "Admin OS",
    owns: "Administrative navigation, permissions, operating workspaces, and production proof",
    authority: "Existing Admin OS shell and tool registry",
    workspacePath: "/admin/production-acceptance",
    state: "confirmed",
    summary: "The existing Admin OS remains the only administrative shell.",
    counts: { operatingShells: 1 },
    findings: ["Ecosystem Truth extends the current shell; it does not create a second command center."],
  };

  const identityOwner = buildOwner(
    {
      id: "identity",
      label: "Identity and profile access",
      owns: "TradeScout identities, profiles, businesses, and profile-scoped accounts",
      authority: "Identity and profile-account records",
      workspacePath: "/admin/users",
    },
    async () => {
      const { rows } = await pool.query(`
        SELECT
          (SELECT COUNT(*)::int FROM users) AS users_total,
          (SELECT COUNT(*)::int FROM profiles) AS profiles_total,
          (SELECT COUNT(*)::int FROM businesses) AS businesses_total,
          (SELECT COUNT(*)::int FROM profile_accounts) AS profile_accounts_total,
          (SELECT COUNT(*)::int
             FROM profile_accounts account
             LEFT JOIN users owner ON owner.id = account.owner_user_id
            WHERE owner.id IS NULL) AS orphan_account_owners,
          (SELECT COUNT(*)::int
             FROM profile_accounts account
             LEFT JOIN profiles target ON target.id = account.target_profile_id
            WHERE target.id IS NULL) AS orphan_account_targets
      `);
      const row = rows[0] || {};
      const orphanOwners = numberValue(row, "orphan_account_owners");
      const orphanTargets = numberValue(row, "orphan_account_targets");
      const attention = orphanOwners + orphanTargets > 0;
      return {
        state: attention ? "attention" : "confirmed",
        summary: attention
          ? "Identity sources are readable, but some profile-account links need repair."
          : "One TradeScout identity and profile-scoped access remain the current authority.",
        counts: {
          users: numberValue(row, "users_total"),
          profiles: numberValue(row, "profiles_total"),
          businesses: numberValue(row, "businesses_total"),
          profileAccounts: numberValue(row, "profile_accounts_total"),
          orphanAccountOwners: orphanOwners,
          orphanAccountTargets: orphanTargets,
        },
        findings: [
          attention
            ? `${orphanOwners} owner link(s) and ${orphanTargets} target link(s) need repair.`
            : "No orphan profile-account owner or target links were found.",
          "This view does not create another identity or account system.",
        ],
      };
    }
  );

  const requestsOwner = buildOwner(
    {
      id: "requests",
      label: "Requests and Direct Connect",
      owns: "Request intake, contact gating, routing, provider response, and job progression",
      authority: "Work Requests and Direct Connect lifecycle records",
      workspacePath: "/admin/direct-connect-requests",
    },
    async () => {
      const { rows } = await pool.query(`
        SELECT
          (SELECT COUNT(*)::int FROM work_requests) AS work_requests_total,
          (SELECT COUNT(*)::int FROM work_request_events) AS work_request_events_total,
          (SELECT COUNT(*)::int FROM direct_connect_dispatch_requests) AS dispatch_requests_total,
          (SELECT COUNT(*)::int FROM direct_connect_job_workspaces) AS job_workspaces_total,
          (SELECT COUNT(*)::int
             FROM work_request_events event
             LEFT JOIN work_requests request ON request.id = event.work_request_id
            WHERE request.id IS NULL) AS orphan_work_events,
          (SELECT COUNT(*)::int
             FROM direct_connect_job_workspaces workspace
             LEFT JOIN direct_connect_dispatch_requests request ON request.id = workspace.request_id
            WHERE request.id IS NULL) AS orphan_job_workspaces
      `);
      const row = rows[0] || {};
      const orphanWorkEvents = numberValue(row, "orphan_work_events");
      const orphanJobWorkspaces = numberValue(row, "orphan_job_workspaces");
      const attention = orphanWorkEvents + orphanJobWorkspaces > 0;
      return {
        state: attention ? "attention" : "confirmed",
        summary: attention
          ? "Request sources are readable, but lifecycle links need repair."
          : "Direct Connect remains the request-to-completion operating authority.",
        counts: {
          workRequests: numberValue(row, "work_requests_total"),
          workRequestEvents: numberValue(row, "work_request_events_total"),
          dispatchRequests: numberValue(row, "dispatch_requests_total"),
          jobWorkspaces: numberValue(row, "job_workspaces_total"),
          orphanWorkEvents,
          orphanJobWorkspaces,
        },
        findings: [
          attention
            ? `${orphanWorkEvents} work-request event(s) and ${orphanJobWorkspaces} job workspace(s) lack their expected parent.`
            : "The checked request and job lifecycle records retain their expected parent links.",
          "No request routing, contact gate, or recipient is changed by this report.",
        ],
      };
    }
  );

  const partnerOwner = buildOwner(
    {
      id: "partner_operations",
      label: "Partner Operations",
      owns: "Partner intake, profile readiness, relationship state, and operating blockers",
      authority: "Managed Partner Operations",
      workspacePath: "/admin/tradepartners",
    },
    async () => {
      const { rows } = await pool.query(`
        SELECT
          (SELECT COUNT(*)::int FROM managed_partner_intakes WHERE archived_at IS NULL) AS active_intakes,
          (SELECT COUNT(*)::int FROM managed_partner_intakes WHERE archived_at IS NULL AND stage = 'blocked') AS blocked_intakes,
          (SELECT COUNT(*)::int FROM managed_partner_intakes WHERE archived_at IS NULL AND stage = 'live') AS live_intakes,
          (SELECT COUNT(*)::int FROM professional_partnerships) AS partnerships_total,
          (SELECT COUNT(*)::int FROM professional_partnerships WHERE status = 'active') AS active_partnerships
      `);
      const row = rows[0] || {};
      const blocked = numberValue(row, "blocked_intakes");
      return {
        state: blocked > 0 ? "attention" : "confirmed",
        summary:
          blocked > 0
            ? "Partner Operations has visible intake blockers."
            : "Partner intake and relationship sources are readable.",
        counts: {
          activeIntakes: numberValue(row, "active_intakes"),
          blockedIntakes: blocked,
          liveIntakes: numberValue(row, "live_intakes"),
          partnerships: numberValue(row, "partnerships_total"),
          activePartnerships: numberValue(row, "active_partnerships"),
        },
        findings: [
          blocked > 0
            ? `${blocked} partner intake(s) remain blocked.`
            : "No managed partner intake is marked blocked.",
          "Partner identity remains separate from catalog, purchasing, and inventory state.",
        ],
      };
    }
  );

  const procurementOwner = buildOwner(
    {
      id: "procurement",
      label: "Procurement",
      owns: "Orders, quotes, purchasing, fulfillment events, delivery proof, and payment authorization",
      authority: "Procurement workspaces and order lifecycle",
      workspacePath: "/admin/procurement",
    },
    async () => {
      const { rows } = await pool.query(`
        SELECT
          (SELECT COUNT(*)::int FROM procurement_workspaces) AS workspaces_total,
          (SELECT COUNT(*)::int FROM procurement_orders) AS orders_total,
          (SELECT COUNT(*)::int FROM procurement_orders WHERE status NOT IN ('completed', 'cancelled')) AS open_orders,
          (SELECT COUNT(*)::int FROM procurement_fulfillment_events) AS fulfillment_events,
          (SELECT COUNT(*)::int
             FROM procurement_fulfillment_events event
             LEFT JOIN procurement_orders purchase ON purchase.id = event.order_id
            WHERE purchase.id IS NULL) AS orphan_events
      `);
      const row = rows[0] || {};
      const orphanEvents = numberValue(row, "orphan_events");
      return {
        state: orphanEvents > 0 ? "attention" : "confirmed",
        summary:
          orphanEvents > 0
            ? "Procurement is readable, but fulfillment links need repair."
            : "Procurement remains the authority for purchasing and fulfillment.",
        counts: {
          workspaces: numberValue(row, "workspaces_total"),
          orders: numberValue(row, "orders_total"),
          openOrders: numberValue(row, "open_orders"),
          fulfillmentEvents: numberValue(row, "fulfillment_events"),
          orphanEvents,
        },
        findings: [
          orphanEvents > 0
            ? `${orphanEvents} fulfillment event(s) lack their expected order.`
            : "The checked fulfillment events retain their expected order links.",
          "Transaction prices remain order evidence, not universal contract terms.",
        ],
      };
    }
  );

  const stoneOwner = buildOwner(
    {
      id: "stone_core",
      label: "Stone Core",
      owns: "Stone materials, asset passports, inventory positions, distribution rights, and publications",
      authority: "Stone Core",
      workspacePath: "/admin/tradepartners",
    },
    async () => {
      const { rows } = await pool.query(`
        SELECT
          (SELECT COUNT(*)::int FROM stone_materials) AS materials_total,
          (SELECT COUNT(*)::int FROM stone_asset_passports) AS asset_passports_total,
          (SELECT COUNT(*)::int FROM stone_inventory_positions) AS inventory_positions_total,
          (SELECT COUNT(*)::int FROM stone_distribution_rights) AS distribution_rights_total,
          (SELECT COUNT(*)::int FROM stone_publications) AS publications_total,
          (SELECT COUNT(*)::int FROM stone_publications WHERE inventory_claim <> 'none') AS inventory_claims,
          (SELECT COUNT(*)::int FROM stone_publications publication
            WHERE publication.inventory_claim <> 'none'
              AND NOT EXISTS (
                SELECT 1
                  FROM stone_asset_passports passport
                  JOIN stone_inventory_positions position
                    ON position.asset_passport_id = passport.id
                 WHERE passport.material_id = publication.material_id
              )) AS unsupported_inventory_claims
      `);
      const row = rows[0] || {};
      const unsupportedClaims = numberValue(row, "unsupported_inventory_claims");
      return {
        state: unsupportedClaims > 0 ? "attention" : "confirmed",
        summary:
          unsupportedClaims > 0
            ? "Stone Core has public inventory claims without a supporting inventory position."
            : "Stone Core remains the only stone material and physical-inventory authority.",
        counts: {
          materials: numberValue(row, "materials_total"),
          assetPassports: numberValue(row, "asset_passports_total"),
          inventoryPositions: numberValue(row, "inventory_positions_total"),
          distributionRights: numberValue(row, "distribution_rights_total"),
          publications: numberValue(row, "publications_total"),
          inventoryClaims: numberValue(row, "inventory_claims"),
          unsupportedInventoryClaims: unsupportedClaims,
        },
        findings: [
          unsupportedClaims > 0
            ? `${unsupportedClaims} publication inventory claim(s) need supporting physical inventory evidence.`
            : "No checked publication makes an unsupported inventory claim.",
          "Catalog imagery and material records are not treated as live physical inventory.",
        ],
      };
    }
  );

  const revenueOwner = buildOwner(
    {
      id: "revenue_attribution",
      label: "Revenue, attribution, and outcomes",
      owns: "Domain transaction evidence, attribution conversions, payouts, and reported outcomes",
      authority: "Existing domain ledgers; no single replacement ledger",
      workspacePath: "/admin/finance",
    },
    async () => {
      const { rows } = await pool.query(`
        SELECT
          (SELECT COUNT(*)::int FROM affiliate_attribution_conversions) AS attribution_conversions,
          (SELECT COUNT(*)::int FROM affiliate_attribution_conversions WHERE target_id IS NULL) AS unlinked_conversions,
          (SELECT COUNT(*)::int FROM marketplace_transactions) AS marketplace_transactions,
          (SELECT COUNT(*)::int FROM wallet_transactions) AS wallet_transactions,
          (SELECT COUNT(*)::int FROM wallet_transactions
            WHERE reference_type IS NULL OR reference_id IS NULL) AS unlinked_wallet_transactions,
          (SELECT COUNT(*)::int FROM trade_deal_earnings) AS trade_deal_earnings,
          (SELECT COUNT(*)::int FROM scout_outcome_events) AS outcome_events
      `);
      const row = rows[0] || {};
      const unlinkedConversions = numberValue(row, "unlinked_conversions");
      const unlinkedWallet = numberValue(row, "unlinked_wallet_transactions");
      const attention = unlinkedConversions + unlinkedWallet > 0;
      return {
        state: attention ? "attention" : "confirmed",
        summary: attention
          ? "Revenue and attribution sources are readable, but some evidence lacks a cross-domain reference."
          : "Existing domain ledgers remain readable and retain their checked references.",
        counts: {
          attributionConversions: numberValue(row, "attribution_conversions"),
          unlinkedConversions,
          marketplaceTransactions: numberValue(row, "marketplace_transactions"),
          walletTransactions: numberValue(row, "wallet_transactions"),
          unlinkedWalletTransactions: unlinkedWallet,
          tradeDealEarnings: numberValue(row, "trade_deal_earnings"),
          outcomeEvents: numberValue(row, "outcome_events"),
        },
        findings: [
          attention
            ? `${unlinkedConversions} attribution conversion(s) and ${unlinkedWallet} wallet transaction(s) lack a usable cross-domain reference.`
            : "The checked attribution and wallet records contain their expected references.",
          "Attribution proves a source connection; it does not create commission or payout entitlement.",
        ],
      };
    }
  );

  return [
    adminOwner,
    ...(await Promise.all([
      identityOwner,
      requestsOwner,
      partnerOwner,
      procurementOwner,
      stoneOwner,
      revenueOwner,
    ])),
  ];
}

async function buildDecisionProvenance(): Promise<
  AdminEcosystemTruthReport["decisionProvenance"]
> {
  const [mission, tools] = await Promise.all([
    readRows(`
      SELECT
        id::text AS id,
        recommended_fix_source_type::text AS domain,
        action::text AS decision,
        recommended_fix_source_id AS source_reference,
        created_at
      FROM mission_control_decisions
      ORDER BY created_at DESC
      LIMIT 25
    `),
    readRows(`
      SELECT
        decision.id::text AS id,
        proposal.title,
        decision.decision::text AS decision,
        proposal.fingerprint AS source_reference,
        decision.created_at
      FROM tool_proposal_decisions decision
      INNER JOIN tool_proposals proposal ON proposal.id = decision.proposal_id
      ORDER BY decision.created_at DESC
      LIMIT 25
    `),
  ]);

  const missionItems: DecisionProvenanceItem[] = mission.rows.map((row) => ({
    id: `mission-${textValue(row, "id")}`,
    source: "Mission Control",
    title: "Daily operating decision",
    domain: titleCase(textValue(row, "domain")),
    decision: titleCase(textValue(row, "decision")),
    sourceReference: textValue(row, "source_reference") || "Not recorded",
    decidedAt: textValue(row, "created_at"),
    authority: "operational_only",
  }));
  const toolItems: DecisionProvenanceItem[] = tools.rows.map((row) => ({
    id: `tool-${textValue(row, "id")}`,
    source: "Tool Discovery",
    title: textValue(row, "title") || "Untitled tool proposal",
    domain: "Tool proposal",
    decision: titleCase(textValue(row, "decision")),
    sourceReference: textValue(row, "source_reference") || "Not recorded",
    decidedAt: textValue(row, "created_at"),
    authority: "operational_only",
  }));
  const items = [...missionItems, ...toolItems]
    .sort((left, right) => Date.parse(right.decidedAt || "") - Date.parse(left.decidedAt || ""))
    .slice(0, 40);
  const anyAvailable = mission.available || tools.available;

  return {
    state: anyAvailable ? "attention" : "unavailable",
    sources: [
      {
        id: "repository_governance",
        label: "TradeScout repository governance",
        scope: "Platform laws, brand boundaries, and protected behavior",
        authority: "governing_source",
        workspacePath: null,
      },
      {
        id: "admin_audit",
        label: "Admin audit history",
        scope: "Sensitive administrative actions",
        authority: "audit_evidence",
        workspacePath: "/admin/audit-log",
      },
      {
        id: "mission_control",
        label: "Mission Control",
        scope: "Daily operating choices",
        authority: "operational_only",
        workspacePath: "/admin/mission-control",
      },
      {
        id: "tool_discovery",
        label: "Tool Discovery",
        scope: "Tool proposal review decisions",
        authority: "operational_only",
        workspacePath: "/admin/tool-discovery",
      },
    ],
    items,
    missingGovernanceFields: [
      "Approval evidence",
      "Effective date",
      "Affected brands and surfaces",
      "Superseded decision",
      "Lock status and rationale",
    ],
    findings: [
      "Current operating decisions are visible, but they are not a durable product and business decision authority.",
      "The first safe step is provenance and conflict visibility; governing sources are not copied into a competing truth store.",
      ...(!mission.available ? ["Mission Control decisions could not be read."] : []),
      ...(!tools.available ? ["Tool proposal decisions could not be read."] : []),
    ],
  };
}

async function buildCommercialTerms(): Promise<AdminEcosystemTruthReport["commercialTerms"]> {
  const [partnerships, tradeDeals, stoneRights, conflictResult] = await Promise.all([
    readRows(`
      SELECT
        id,
        partnership_type,
        status,
        commission_rate::text AS recorded_rate,
        NULLIF(BTRIM(referral_terms), '') IS NOT NULL AS has_referral_terms,
        approved_at,
        updated_at
      FROM professional_partnerships
      ORDER BY updated_at DESC NULLS LAST, created_at DESC
      LIMIT 40
    `),
    readRows(`
      SELECT
        id,
        name,
        partner_name,
        is_active,
        default_commission_rate::text AS recorded_rate,
        updated_at
      FROM trade_deals
      ORDER BY updated_at DESC NULLS LAST, created_at DESC
      LIMIT 40
    `),
    readRows(`
      SELECT
        id::text AS id,
        right_type,
        scope,
        relationship_status,
        evidence_type,
        effective_at,
        expires_at,
        updated_at
      FROM stone_distribution_rights
      ORDER BY updated_at DESC NULLS LAST, created_at DESC
      LIMIT 40
    `),
    readRows(`
      SELECT COUNT(*)::int AS conflict_count
      FROM (
        SELECT initiator_id, partner_id, partnership_type
        FROM professional_partnerships
        WHERE status = 'active'
        GROUP BY initiator_id, partner_id, partnership_type
        HAVING COUNT(*) > 1 AND COUNT(DISTINCT commission_rate) > 1
      ) conflicts
    `),
  ]);

  const partnershipItems: CommercialTermIndexItem[] = partnerships.rows.map((row) => {
    const hasTerms = row.has_referral_terms === true;
    const approvedAt = textValue(row, "approved_at");
    const recordedRate = textValue(row, "recorded_rate");
    const findings = [
      !hasTerms ? "No written referral terms are attached to this record." : null,
      !approvedAt ? "No approval timestamp is recorded." : null,
      "The recorded rate is operational data and is not treated as signed agreement proof.",
    ].filter((value): value is string => Boolean(value));
    return {
      id: `partnership-${textValue(row, "id")}`,
      domain: "Professional partnership",
      title: `${titleCase(textValue(row, "partnership_type"))} partnership`,
      lifecycleStatus: titleCase(textValue(row, "status")),
      recordedTerm: recordedRate ? `${recordedRate}% recorded rate` : "No rate recorded",
      evidenceState: hasTerms && approvedAt ? "partial" : "missing",
      effectiveAt: approvedAt,
      expiresAt: null,
      source: "Professional Partnerships",
      findings,
    };
  });

  const tradeDealItems: CommercialTermIndexItem[] = tradeDeals.rows.map((row) => {
    const recordedRate = textValue(row, "recorded_rate");
    const name = textValue(row, "name") || "Unnamed TradeDeal";
    const partner = textValue(row, "partner_name");
    return {
      id: `trade-deal-${textValue(row, "id")}`,
      domain: "TradeDeal",
      title: partner ? `${name} · ${partner}` : name,
      lifecycleStatus: row.is_active === true ? "Active" : "Inactive",
      recordedTerm: recordedRate ? `${recordedRate} recorded commission rate` : "No rate recorded",
      evidenceState: "missing",
      effectiveAt: null,
      expiresAt: null,
      source: "TradeDeals",
      findings: [
        "The product record does not contain signed agreement evidence or an effective term version.",
      ],
    };
  });

  const stoneRightItems: CommercialTermIndexItem[] = stoneRights.rows.map((row) => {
    const evidenceType = textValue(row, "evidence_type");
    return {
      id: `stone-right-${textValue(row, "id")}`,
      domain: "Stone distribution right",
      title: `${titleCase(textValue(row, "right_type"))} · ${titleCase(textValue(row, "scope"))}`,
      lifecycleStatus: titleCase(textValue(row, "relationship_status")),
      recordedTerm: evidenceType ? `Evidence type: ${titleCase(evidenceType)}` : "No evidence type recorded",
      evidenceState: evidenceType ? "source_linked" : "missing",
      effectiveAt: textValue(row, "effective_at"),
      expiresAt: textValue(row, "expires_at"),
      source: "Stone Core distribution rights",
      findings: ["Stone Core remains the authority for this distribution right."],
    };
  });

  const items = [...partnershipItems, ...tradeDealItems, ...stoneRightItems];
  const needsEvidence = items.filter((item) => item.evidenceState !== "source_linked").length;
  const conflicts = conflictResult.available
    ? numberValue(conflictResult.rows[0] || {}, "conflict_count")
    : 0;
  const availableSources = [partnerships, tradeDeals, stoneRights].filter(
    (result) => result.available
  ).length;

  return {
    mode: "index_only",
    state:
      availableSources === 0
        ? "unavailable"
        : needsEvidence > 0 || conflicts > 0 || availableSources < 3
          ? "attention"
          : "confirmed",
    recordsReviewed: items.length,
    needsEvidence,
    conflicts,
    items,
    findings: [
      "This is a conflict and evidence index. It does not replace agreements, orders, payouts, or accounting records.",
      "A recorded percentage is never presented as a signed term unless supporting evidence exists.",
      ...(conflicts > 0
        ? [`${conflicts} active partnership group(s) contain conflicting recorded commission rates.`]
        : []),
      ...(!partnerships.available ? ["Professional partnership terms could not be read."] : []),
      ...(!tradeDeals.available ? ["TradeDeal terms could not be read."] : []),
      ...(!stoneRights.available ? ["Stone distribution rights could not be read."] : []),
    ],
  };
}

type OutcomeSourceDefinition = {
  id: string;
  label: string;
  authority: string;
  workspacePath: string;
  countQuery: string;
  timelineQuery: string;
};

async function readOutcomeSource(definition: OutcomeSourceDefinition): Promise<{
  coverage: OutcomeSourceCoverage;
  timeline: OutcomeTimelineItem[];
}> {
  const countResult = await readRows(definition.countQuery);
  const timelineResult = countResult.available
    ? await readRows(definition.timelineQuery)
    : { rows: [], available: false };
  if (!countResult.available || !timelineResult.available) {
    return {
      coverage: {
        id: definition.id,
        label: definition.label,
        authority: definition.authority,
        workspacePath: definition.workspacePath,
        state: "unavailable",
        recordCount: 0,
        linkedCount: 0,
        unlinkedCount: 0,
        latestAt: null,
        finding: "The source could not be read. No zero value was invented.",
      },
      timeline: [],
    };
  }

  const row = countResult.rows[0] || {};
  const recordCount = numberValue(row, "record_count");
  const linkedCount = numberValue(row, "linked_count");
  const unlinkedCount = Math.max(0, recordCount - linkedCount);
  const timeline: OutcomeTimelineItem[] = timelineResult.rows.map((item) => {
    const linked = item.is_linked === true;
    return {
      id: `${definition.id}-${textValue(item, "id")}`,
      sourceId: definition.id,
      source: definition.label,
      eventType: titleCase(textValue(item, "event_type")),
      linkType: textValue(item, "link_type"),
      linkId: textValue(item, "link_id"),
      occurredAt: textValue(item, "occurred_at"),
      state: linked ? "linked" : "unlinked",
    };
  });

  return {
    coverage: {
      id: definition.id,
      label: definition.label,
      authority: definition.authority,
      workspacePath: definition.workspacePath,
      state: unlinkedCount > 0 ? "attention" : "confirmed",
      recordCount,
      linkedCount,
      unlinkedCount,
      latestAt: textValue(row, "latest_at"),
      finding:
        recordCount === 0
          ? "The source is reachable and contains no records."
          : unlinkedCount > 0
            ? `${unlinkedCount} record(s) lack the source's expected parent or cross-domain reference.`
            : "All checked records retain the source's expected link.",
    },
    timeline,
  };
}

async function buildOutcomeCoverage(): Promise<AdminEcosystemTruthReport["outcomeCoverage"]> {
  const definitions: OutcomeSourceDefinition[] = [
    {
      id: "work_request_events",
      label: "Work Request events",
      authority: "Work Requests",
      workspacePath: "/admin/direct-connect-requests",
      countQuery: `
        SELECT
          COUNT(*)::int AS record_count,
          COUNT(request.id)::int AS linked_count,
          MAX(event.created_at) AS latest_at
        FROM work_request_events event
        LEFT JOIN work_requests request ON request.id = event.work_request_id
      `,
      timelineQuery: `
        SELECT
          event.id,
          event.type::text AS event_type,
          'work request' AS link_type,
          event.work_request_id AS link_id,
          event.created_at AS occurred_at,
          request.id IS NOT NULL AS is_linked
        FROM work_request_events event
        LEFT JOIN work_requests request ON request.id = event.work_request_id
        ORDER BY event.created_at DESC
        LIMIT 12
      `,
    },
    {
      id: "direct_connect_events",
      label: "Direct Connect events",
      authority: "Direct Connect dispatch lifecycle",
      workspacePath: "/admin/direct-connect-requests",
      countQuery: `
        SELECT
          COUNT(*)::int AS record_count,
          COUNT(request.id)::int AS linked_count,
          MAX(event.created_at) AS latest_at
        FROM direct_connect_dispatch_events event
        LEFT JOIN direct_connect_dispatch_requests request ON request.id = event.request_id
      `,
      timelineQuery: `
        SELECT
          event.event_id AS id,
          event.event_type,
          'Direct Connect request' AS link_type,
          event.request_id AS link_id,
          event.created_at AS occurred_at,
          request.id IS NOT NULL AS is_linked
        FROM direct_connect_dispatch_events event
        LEFT JOIN direct_connect_dispatch_requests request ON request.id = event.request_id
        ORDER BY event.created_at DESC
        LIMIT 12
      `,
    },
    {
      id: "procurement_events",
      label: "Procurement fulfillment events",
      authority: "Procurement",
      workspacePath: "/admin/procurement",
      countQuery: `
        SELECT
          COUNT(*)::int AS record_count,
          COUNT(purchase.id)::int AS linked_count,
          MAX(event.created_at) AS latest_at
        FROM procurement_fulfillment_events event
        LEFT JOIN procurement_orders purchase ON purchase.id = event.order_id
      `,
      timelineQuery: `
        SELECT
          event.id,
          event.status AS event_type,
          'procurement order' AS link_type,
          event.order_id AS link_id,
          event.created_at AS occurred_at,
          purchase.id IS NOT NULL AS is_linked
        FROM procurement_fulfillment_events event
        LEFT JOIN procurement_orders purchase ON purchase.id = event.order_id
        ORDER BY event.created_at DESC
        LIMIT 12
      `,
    },
    {
      id: "attribution_conversions",
      label: "Attribution conversions",
      authority: "Attribution conversion ledger",
      workspacePath: "/admin/discovery-observatory",
      countQuery: `
        SELECT
          COUNT(*)::int AS record_count,
          COUNT(*) FILTER (WHERE target_id IS NOT NULL)::int AS linked_count,
          MAX(occurred_at) AS latest_at
        FROM affiliate_attribution_conversions
      `,
      timelineQuery: `
        SELECT
          conversion_event_id AS id,
          conversion_type AS event_type,
          COALESCE(NULLIF(target_path, ''), 'conversion target') AS link_type,
          target_id AS link_id,
          occurred_at,
          target_id IS NOT NULL AS is_linked
        FROM affiliate_attribution_conversions
        ORDER BY occurred_at DESC
        LIMIT 12
      `,
    },
    {
      id: "marketplace_transactions",
      label: "Marketplace transactions",
      authority: "Marketplace transaction lifecycle",
      workspacePath: "/admin/listings",
      countQuery: `
        SELECT
          COUNT(*)::int AS record_count,
          COUNT(listing_id)::int AS linked_count,
          MAX(updated_at) AS latest_at
        FROM marketplace_transactions
      `,
      timelineQuery: `
        SELECT
          id,
          status::text AS event_type,
          'marketplace listing' AS link_type,
          listing_id AS link_id,
          COALESCE(updated_at, created_at) AS occurred_at,
          listing_id IS NOT NULL AS is_linked
        FROM marketplace_transactions
        ORDER BY COALESCE(updated_at, created_at) DESC
        LIMIT 12
      `,
    },
    {
      id: "wallet_transactions",
      label: "Wallet transaction evidence",
      authority: "Wallet ledger",
      workspacePath: "/admin/finance",
      countQuery: `
        SELECT
          COUNT(*)::int AS record_count,
          COUNT(*) FILTER (WHERE reference_type IS NOT NULL AND reference_id IS NOT NULL)::int AS linked_count,
          MAX(created_at) AS latest_at
        FROM wallet_transactions
      `,
      timelineQuery: `
        SELECT
          id,
          transaction_type::text AS event_type,
          reference_type AS link_type,
          reference_id AS link_id,
          created_at AS occurred_at,
          reference_type IS NOT NULL AND reference_id IS NOT NULL AS is_linked
        FROM wallet_transactions
        ORDER BY created_at DESC
        LIMIT 12
      `,
    },
    {
      id: "scout_outcomes",
      label: "Reported outcomes",
      authority: "Outcome feedback records",
      workspacePath: "/admin/discovery-observatory",
      countQuery: `
        SELECT
          COUNT(*)::int AS record_count,
          COUNT(*) FILTER (WHERE context_id IS NOT NULL)::int AS linked_count,
          MAX(created_at) AS latest_at
        FROM scout_outcome_events
      `,
      timelineQuery: `
        SELECT
          id::text AS id,
          action::text AS event_type,
          context_type::text AS link_type,
          context_id AS link_id,
          created_at AS occurred_at,
          context_id IS NOT NULL AS is_linked
        FROM scout_outcome_events
        ORDER BY created_at DESC
        LIMIT 12
      `,
    },
    {
      id: "trade_deal_earnings",
      label: "TradeDeal earnings",
      authority: "TradeDeal earnings ledger",
      workspacePath: "/admin/finance",
      countQuery: `
        SELECT
          COUNT(*)::int AS record_count,
          COUNT(deal.id)::int AS linked_count,
          MAX(earning.created_at) AS latest_at
        FROM trade_deal_earnings earning
        LEFT JOIN trade_deals deal ON deal.id = earning.trade_deal_id
      `,
      timelineQuery: `
        SELECT
          earning.id,
          COALESCE(earning.source_type, 'earning') AS event_type,
          'TradeDeal' AS link_type,
          earning.trade_deal_id AS link_id,
          earning.created_at AS occurred_at,
          deal.id IS NOT NULL AS is_linked
        FROM trade_deal_earnings earning
        LEFT JOIN trade_deals deal ON deal.id = earning.trade_deal_id
        ORDER BY earning.created_at DESC
        LIMIT 12
      `,
    },
  ];

  const results: Array<Awaited<ReturnType<typeof readOutcomeSource>>> = [];
  for (let index = 0; index < definitions.length; index += 4) {
    const batch = definitions.slice(index, index + 4);
    results.push(...(await Promise.all(batch.map(readOutcomeSource))));
  }
  const sources = results.map((result) => result.coverage);
  const timeline = results
    .flatMap((result) => result.timeline)
    .sort((left, right) => Date.parse(right.occurredAt || "") - Date.parse(left.occurredAt || ""))
    .slice(0, 60);
  const unavailable = sources.filter((source) => source.state === "unavailable").length;
  const unlinked = sources.reduce((sum, source) => sum + source.unlinkedCount, 0);

  return {
    mode: "projection_only",
    state:
      unavailable === sources.length
        ? "unavailable"
        : unavailable > 0 || unlinked > 0
          ? "attention"
          : "confirmed",
    sources,
    timeline,
    findings: [
      "The timeline reads existing domain evidence and never writes or backfills an event.",
      "A shared reference can connect records; it does not change which system owns the original event.",
      ...(unavailable > 0 ? [`${unavailable} outcome source(s) could not be read.`] : []),
      ...(unlinked > 0 ? [`${unlinked} record(s) need a usable parent or cross-domain reference.`] : []),
    ],
  };
}

export async function runAdminEcosystemTruthReport(): Promise<AdminEcosystemTruthReport> {
  await pool.query("SELECT 1");
  const owners = await buildOwners();
  const [decisionProvenance, commercialTerms, outcomeCoverage] = await Promise.all([
    buildDecisionProvenance(),
    buildCommercialTerms(),
    buildOutcomeCoverage(),
  ]);
  const confirmedOwners = owners.filter((owner) => owner.state === "confirmed").length;
  const ownersNeedingAttention = owners.length - confirmedOwners;
  const unlinkedOutcomeEvents = outcomeCoverage.sources.reduce(
    (sum, source) => sum + source.unlinkedCount,
    0
  );

  return {
    generatedAt: new Date().toISOString(),
    revision:
      process.env.RENDER_GIT_COMMIT ||
      process.env.GIT_COMMIT_SHA ||
      process.env.BUILD_REVISION ||
      null,
    mode: "read_only",
    summary: {
      confirmedOwners,
      ownersNeedingAttention,
      decisionRecords: decisionProvenance.items.length,
      commercialRecordsNeedingEvidence: commercialTerms.needsEvidence,
      commercialConflicts: commercialTerms.conflicts,
      unlinkedOutcomeEvents,
    },
    owners,
    decisionProvenance,
    commercialTerms,
    outcomeCoverage,
    protections: [
      "Public pages, copy, calls to action, and ranking behavior remain unchanged.",
      "Identity, profile accounts, and Direct Connect remain their current authorities.",
      "Stone Core remains the only stone material and physical-inventory authority.",
      "Recorded rates are not promoted into signed commercial terms.",
      "No historical event is manufactured or silently backfilled.",
      "This report exposes no customer contact details, credentials, or full payment information.",
    ],
  };
}
