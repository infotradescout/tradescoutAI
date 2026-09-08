/**
 * Contract tests: DC lifecycle rail (6 stages), mark-pending-outcome/complete endpoints,
 * Scout → DC prefill handoff, and /api/providers/search universal search.
 */
import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";

const DC_SHELL = fs.readFileSync(
  path.resolve(__dirname, "../../client/src/pages/direct-connect/DirectConnectShell.tsx"),
  "utf8"
);

const DC_ROUTES = fs.readFileSync(path.resolve(__dirname, "../routes/direct-connect.ts"), "utf8");

const ROUTES_TS = fs.readFileSync(path.resolve(__dirname, "../routes.ts"), "utf8");
const PROVIDER_SEARCH_ROUTE_PATH = path.resolve(__dirname, "../routes/provider-search.ts");
const PROVIDER_SEARCH_ROUTE = fs.existsSync(PROVIDER_SEARCH_ROUTE_PATH)
  ? fs.readFileSync(PROVIDER_SEARCH_ROUTE_PATH, "utf8")
  : ROUTES_TS.slice(ROUTES_TS.indexOf('"/api/business-providers/search"'));

const SCOUT_ACTION_ROUTER = fs.readFileSync(
  path.resolve(__dirname, "../../client/src/scout/ScoutActionRouter.ts"),
  "utf8"
);

const DC_PROS = fs.readFileSync(
  path.resolve(__dirname, "../../client/src/pages/direct-connect/DirectConnectPros.tsx"),
  "utf8"
);

// ─── Lifecycle Rail ───────────────────────────────────────────────────────────

describe("DC lifecycle rail — 6 stages", () => {
  it("defines pending_outcome as a RequestWorkflowStage", () => {
    expect(DC_SHELL).toContain('"pending_outcome"');
  });

  it("maps status=pending_outcome to pending_outcome stage", () => {
    expect(DC_SHELL).toContain('if (status === "pending_outcome") return "pending_outcome"');
  });

  it("includes pending_outcome in the rail steps array", () => {
    expect(DC_SHELL).toContain('{ key: "pending_outcome", label: "Pending Outcome" }');
  });

  it("renders a 5-column grid for the 5 forward stages", () => {
    expect(DC_SHELL).toContain("grid-cols-5");
  });

  it("shows 'Request cancelled' label when stage is cancelled", () => {
    expect(DC_SHELL).toContain('"Request cancelled"');
  });

  it("getRequestStageLabel returns Pending outcome for pending_outcome", () => {
    const fnStart = DC_SHELL.indexOf("function getRequestStageLabel");
    const fnBody = DC_SHELL.slice(fnStart, fnStart + 800);
    expect(fnBody).toContain('"Pending outcome"');
  });

  it("getRequestStageSummary returns outcome confirmation message for pending_outcome", () => {
    const fnStart = DC_SHELL.indexOf("function getRequestStageSummary");
    const fnBody = DC_SHELL.slice(fnStart, fnStart + 1000);
    expect(fnBody).toContain("Confirm the outcome with your provider");
  });

  it("matchesRequestFilter includes pending_outcome in in_progress filter", () => {
    const fnStart = DC_SHELL.indexOf("function matchesRequestFilter");
    const fnBody = DC_SHELL.slice(fnStart, fnStart + 600);
    expect(fnBody).toContain('stage === "pending_outcome"');
  });
});

// ─── canMarkPendingOutcome / canMarkComplete flags ────────────────────────────

describe("DC lifecycle rail — action flags", () => {
  it("defines canMarkPendingOutcome for active_conversation stage", () => {
    expect(DC_SHELL).toContain('const canMarkPendingOutcome = stage === "active_conversation"');
  });

  it("defines canMarkComplete for pending_outcome or active_conversation", () => {
    expect(DC_SHELL).toMatch(
      /const canMarkComplete\s*=\s*stage === "pending_outcome" \|\|\s*stage === "active_conversation"/
    );
  });

  it("renders dc-mark-pending-outcome-btn testid", () => {
    expect(DC_SHELL).toContain('data-testid="dc-mark-pending-outcome-btn"');
  });

  it("renders dc-mark-complete-btn testid", () => {
    expect(DC_SHELL).toContain('data-testid="dc-mark-complete-btn"');
  });

  it("markPendingOutcomeMutation calls mark-pending-outcome endpoint", () => {
    expect(DC_SHELL).toContain("/mark-pending-outcome");
  });

  it("markCompleteMutation calls complete endpoint", () => {
    const mutStart = DC_SHELL.indexOf("markCompleteMutation = useMutation");
    const mutBody = DC_SHELL.slice(mutStart, mutStart + 400);
    expect(mutBody).toContain("/complete");
  });
});

// ─── Server endpoints ─────────────────────────────────────────────────────────

describe("DC server — mark-pending-outcome endpoint", () => {
  it("registers the mark-pending-outcome route", () => {
    expect(DC_ROUTES).toContain('"/api/direct-connect/requests/:id/mark-pending-outcome"');
  });

  it("only allows in_progress requests to be marked pending_outcome", () => {
    const routeStart = DC_ROUTES.indexOf('"/api/direct-connect/requests/:id/mark-pending-outcome"');
    const routeBody = DC_ROUTES.slice(routeStart, routeStart + 2500);
    expect(routeBody).toContain('"in_progress"');
    expect(routeBody).toContain('"pending_outcome"');
  });

  it("records a status_changed event with reason mark_pending_outcome", () => {
    const routeStart = DC_ROUTES.indexOf('"/api/direct-connect/requests/:id/mark-pending-outcome"');
    const routeBody = DC_ROUTES.slice(routeStart, routeStart + 2500);
    expect(routeBody).toContain("mark_pending_outcome");
  });

  it("returns status pending_outcome on success", () => {
    const routeStart = DC_ROUTES.indexOf('"/api/direct-connect/requests/:id/mark-pending-outcome"');
    const routeBody = DC_ROUTES.slice(routeStart, routeStart + 2500);
    expect(routeBody).toContain("pending_outcome");
    expect(routeBody).toContain("status(200)");
  });
});

describe("DC server — complete endpoint", () => {
  it("registers the complete route", () => {
    expect(DC_ROUTES).toContain('"/api/direct-connect/requests/:id/complete"');
  });

  it("allows both in_progress and pending_outcome to be completed", () => {
    const routeStart = DC_ROUTES.indexOf('"/api/direct-connect/requests/:id/complete"');
    const routeBody = DC_ROUTES.slice(routeStart, routeStart + 2500);
    expect(routeBody).toContain('"in_progress"');
    expect(routeBody).toContain('"pending_outcome"');
    expect(routeBody).toContain('"completed"');
  });

  it("records a status_changed event with reason mark_complete", () => {
    const routeStart = DC_ROUTES.indexOf('"/api/direct-connect/requests/:id/complete"');
    const routeBody = DC_ROUTES.slice(routeStart, routeStart + 2500);
    expect(routeBody).toContain("mark_complete");
  });

  it("returns status completed on success", () => {
    const routeStart = DC_ROUTES.indexOf('"/api/direct-connect/requests/:id/complete"');
    // Window extended to 5000 chars to accommodate the completion notification block added in Apr 2026
    const routeBody = DC_ROUTES.slice(routeStart, routeStart + 5000);
    expect(routeBody).toContain('"completed"');
    expect(routeBody).toContain("status(200)");
  });
});

// ─── Scout → DC prefill handoff ──────────────────────────────────────────────

describe("Scout → DC prefill handoff", () => {
  it("buildStructuredPrefillRoute routes to /direct-connect for DC requests", () => {
    const fnStart = SCOUT_ACTION_ROUTER.indexOf("buildStructuredPrefillRoute");
    const fnBody = SCOUT_ACTION_ROUTER.slice(fnStart, fnStart + 3500);
    expect(fnBody).toContain("/direct-connect");
  });

  it("does not route DC requests to /direct-connect/post", () => {
    const fnStart = SCOUT_ACTION_ROUTER.indexOf("buildStructuredPrefillRoute");
    const fnBody = SCOUT_ACTION_ROUTER.slice(fnStart, fnStart + 3500);
    expect(fnBody).not.toContain("/direct-connect/post");
  });

  it("appends source=scout param to the DC prefill URL", () => {
    const fnStart = SCOUT_ACTION_ROUTER.indexOf("buildStructuredPrefillRoute");
    const fnBody = SCOUT_ACTION_ROUTER.slice(fnStart, fnStart + 3500);
    expect(fnBody).toContain("source");
    expect(fnBody).toContain("scout");
  });

  it("appends title param from prefill.jobType", () => {
    const fnStart = SCOUT_ACTION_ROUTER.indexOf("buildStructuredPrefillRoute");
    const fnBody = SCOUT_ACTION_ROUTER.slice(fnStart, fnStart + 3500);
    expect(fnBody).toContain("title");
    expect(fnBody).toContain("jobType");
  });

  it("appends description param from prefill.scope", () => {
    const fnStart = SCOUT_ACTION_ROUTER.indexOf("buildStructuredPrefillRoute");
    const fnBody = SCOUT_ACTION_ROUTER.slice(fnStart, fnStart + 3500);
    expect(fnBody).toContain("description");
    expect(fnBody).toContain("scope");
  });
});

// ─── /api/business-providers/search ───────────────────────────────────────────

describe("/api/business-providers/search universal endpoint", () => {
  it("registers the generic business provider route while keeping legacy providers alias", () => {
    expect(ROUTES_TS).toContain('"/api/business-providers/search"');
    expect(ROUTES_TS).toContain('"/api/providers/search"');
  });

  it("queries contractors table", () => {
    expect(PROVIDER_SEARCH_ROUTE).toContain("contractors");
  });

  it("queries businesses via getProvidersByCountyAndCategory", () => {
    expect(PROVIDER_SEARCH_ROUTE).toContain("getProvidersByCountyAndCategory");
  });

  it("deduplicates results with a seen Set", () => {
    expect(PROVIDER_SEARCH_ROUTE).toContain("seen");
    expect(PROVIDER_SEARCH_ROUTE).toContain("new Set");
  });

  it("annotates each result with providerType", () => {
    expect(PROVIDER_SEARCH_ROUTE).toContain("providerType");
  });

  it("DirectConnectPros uses /api/business-providers/search", () => {
    expect(DC_PROS).toContain('"/api/business-providers/search"');
    expect(DC_PROS).not.toContain('"/api/contractors/search"');
  });

  it("DirectConnectShell dispatch sheet uses /api/business-providers/search", () => {
    expect(DC_SHELL).toContain('"/api/business-providers/search"');
    expect(DC_SHELL).not.toContain('"/api/contractors/search"');
  });
});
