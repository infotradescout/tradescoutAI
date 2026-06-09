import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

const shellPath = path.resolve(
  process.cwd(),
  "client/src/pages/direct-connect/DirectConnectShell.tsx"
);
const routesPath = path.resolve(process.cwd(), "server/routes/direct-connect.ts");
const analyticsPath = path.resolve(process.cwd(), "server/routes/analytics-routes.ts");

const shellSource = fs.readFileSync(shellPath, "utf8");
const routesSource = fs.readFileSync(routesPath, "utf8");
const analyticsSource = fs.readFileSync(analyticsPath, "utf8");

describe("direct connect submission funnel contract harness", () => {
  it("keeps request review reachable without requiring Home Record selection", () => {
    expect(shellSource).toContain("const [homeContextIntent, setHomeContextIntent] = useState<");
    expect(shellSource).toContain('>("skip_for_now")');
    expect(shellSource).toContain("handleSkipAndAutoRoute");
    expect(shellSource).toContain("createMutation.mutate({");
    expect(shellSource).toContain("autoRoute: true");
    expect(shellSource).toContain(
      "Review request details first. No one is contacted until you submit."
    );
  });

  it("emits review-opened event from the review path", () => {
    expect(shellSource).toContain('type: "direct_connect_request_review_opened"');
    expect(shellSource).toContain("const openRequestReadyState = () => {");
    expect(shellSource).toContain("if (!reviewCardReady || createMutation.isPending) return;");
  });

  it("emits request-submitted event from successful submit path", () => {
    expect(shellSource).toContain('type: "direct_connect_request_submitted"');
    expect(shellSource).toContain("onSuccess: (data, variables) => {");
  });

  it("emits contractor-visibility event when assignments/routing are created", () => {
    expect(routesSource).toContain(
      'await storage.logEvent("direct_connect_request_visible_to_contractors"'
    );
    expect(routesSource).toContain('type: "direct_connect_request_visible_to_contractors"');
  });

  it("emits contractor-action-started when contractor starts assignment action", () => {
    expect(routesSource).toContain(
      'await storage.logEvent("direct_connect_contractor_action_started"'
    );
    expect(routesSource).toContain('type: "direct_connect_contractor_action_started"');
  });

  it("keeps KPI allowlist coverage for all submission funnel events", () => {
    expect(analyticsSource).toContain('"direct_connect_request_review_opened"');
    expect(analyticsSource).toContain('"direct_connect_request_submitted"');
    expect(analyticsSource).toContain('"direct_connect_request_visible_to_contractors"');
    expect(analyticsSource).toContain('"direct_connect_contractor_action_started"');
  });

  it("preserves contact gate doctrine in request review and share states", () => {
    expect(shellSource).toContain(
      'contactGateState: showDispatchSheet ? "request_shared" : "review_required"'
    );
  });

  it("preserves anonymous/auth draft through sign-in return without making HomeID blocking", () => {
    expect(shellSource).toContain(
      'const DIRECT_CONNECT_DRAFT_DRAFT_KEY = "ts_direct_connect_draft_v1"'
    );
    expect(shellSource).toContain("window.sessionStorage.setItem(DIRECT_CONNECT_DRAFT_DRAFT_KEY");
    expect(shellSource).toContain("window.localStorage.setItem(DIRECT_CONNECT_DRAFT_DRAFT_KEY");
    expect(shellSource).toContain("hydrateDirectConnectDraft");
    expect(shellSource).toContain("navigate(`/pre-scout-setup?mode=signin&next=${next}`)");
    expect(shellSource).toContain("Your request draft is ready. Sign in to review and send it.");
    expect(shellSource).toContain(
      "Direct Connect starts the job. HomeID remembers useful property history."
    );
    expect(shellSource).toContain("Skip for now");
  });
});
