import { describe, expect, it, vi } from "vitest";
import fs from "node:fs";
import vm from "node:vm";
import ts from "typescript";
import { getScoutExecutionTelemetry } from "../scout/scoutExecutionTelemetry";

const executionId = "receipt-operation-123456";
const completed = { executed: true, executionId, replayed: false };

function sourceCallback(file: string, matches: (node: ts.Node) => ts.Node | undefined): string {
  const source = ts.createSourceFile(file, fs.readFileSync(file, "utf8"), ts.ScriptTarget.Latest, true,
    file.endsWith("tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
  let callback: ts.Node | undefined;
  function visit(node: ts.Node) {
    callback ||= matches(node);
    if (!callback) ts.forEachChild(node, visit);
  }
  visit(source);
  if (!callback) throw new Error(`Production callback not found in ${file}`);
  return ts.transpileModule(`exports.callback = ${callback.getText(source)};`, {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
  }).outputText;
}

const endpointSource = sourceCallback("server/routes/scout.ts", (node) => {
  if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression) &&
      node.expression.expression.getText() === "router" && node.expression.name.text === "post" &&
      ts.isStringLiteral(node.arguments[0]) && node.arguments[0].text === "/execute-action") {
    return node.arguments[1];
  }
});
const watchdogSource = sourceCallback("client/src/scout/ScoutOS.tsx", (node) => {
  if (ts.isVariableDeclaration(node) && node.name.getText() === "loadWatchdogResult" &&
      node.initializer && ts.isCallExpression(node.initializer)) return node.initializer.arguments[0];
});

async function callEndpoint(result: unknown, failTelemetry = false) {
  const logEvent = failTelemetry ? vi.fn().mockRejectedValue(new Error("Telemetry unavailable")) : vi.fn();
  const module = { exports: {} as { callback?: (req: unknown, res: unknown) => Promise<unknown> } };
  vm.runInNewContext(endpointSource, {
    module, exports: module.exports,
    require(name: string) {
      if (name === "../scout/scoutExecutionTelemetry") return { getScoutExecutionTelemetry };
      throw new Error(`Unexpected endpoint dependency: ${name}`);
    },
    console: { error: vi.fn() },
    storage: { logEvent },
    resolveOutcomeActionTelemetry: () => ({ ownerModule: "profile", target: "/profile-settings",
      confidenceBand: "high", payloadCompleteness: "complete" }),
    buildUnifiedRouterContext: () => ({}),
    UnifiedScoutRouter: { validateAction: () => ({ valid: true }) },
    runScoutAction: async () => result,
  });
  const response = { status: vi.fn(), json: vi.fn() };
  response.status.mockReturnValue(response);
  await module.exports.callback?.({ user: { id: "synthetic-owner" }, requestId: "synthetic-request",
    body: { action: { type: "SAVE_PROFILE", payload: { executionId, profilePatch: { firstName: "Jane" } } } },
  }, response);
  return { logEvent, response };
}

describe("Scout execution telemetry", () => {
  it("counts a positively executed operation as a new submission", () => {
    expect(getScoutExecutionTelemetry(completed)).toEqual({ eventName: "scout_outcome_action_submitted", executionId });
  });
  it("separates a completed receipt replay from a new submission", () => {
    expect(getScoutExecutionTelemetry({ ...completed, replayed: true }))
      .toEqual({ eventName: "scout_outcome_action_replayed", executionId });
  });
  it("preserves valid execution telemetry for old unkeyed clients", () => {
    expect(getScoutExecutionTelemetry({ executed: true })).toEqual({ eventName: "scout_outcome_action_submitted" });
  });
  it.each([null, undefined, false, "Saved", [], {}, { authorized: true },
    { executed: false }, { executed: "true" }, { ...completed, success: false },
    { ...completed, ok: false }, { executed: true, replayed: true }])(
    "does not convert non-completion into a new submission: %j", (value) => {
      expect(getScoutExecutionTelemetry(value)).toBeNull();
    }
  );
  it("projects only an event name and safe operation identity", () => {
    expect(getScoutExecutionTelemetry({ ...completed, profilePatch: { firstName: "Private" }, error: "Private" }))
      .toEqual({ eventName: "scout_outcome_action_submitted", executionId });
  });
  it("the actual endpoint records one new submission for executed data", async () => {
    const { logEvent } = await callEndpoint({ ok: true, data: completed });
    expect(logEvent.mock.calls.map(([name]) => name)).toEqual([
      "scout_outcome_action_clicked", "scout_outcome_action_submitted",
    ]);
    expect(logEvent.mock.calls[1][1].executionId).toBe(executionId);
  });
  it("the actual endpoint never recounts a replay as a submission", async () => {
    const { logEvent, response } = await callEndpoint({ ok: true, data: { ...completed, replayed: true } });
    expect(logEvent.mock.calls.map(([name]) => name)).toEqual([
      "scout_outcome_action_clicked", "scout_outcome_action_replayed",
    ]);
    expect(response.json.mock.calls[0][0].data.replayed).toBe(true);
  });
  it("the actual endpoint emits no submission telemetry for authorization alone", async () => {
    const { logEvent } = await callEndpoint({ ok: true, data: { authorized: true, executed: false } });
    expect(logEvent.mock.calls.map(([name]) => name)).toEqual(["scout_outcome_action_clicked"]);
  });
  it("the actual endpoint emits no completion event for an uncertain write", async () => {
    const { logEvent, response } = await callEndpoint({ ok: false,
      error: { type: "SYSTEM_ERROR", userMessage: "Scout could not confirm this action." } });
    expect(logEvent.mock.calls.map(([name]) => name)).toEqual(["scout_outcome_action_clicked"]);
    expect(response.status).toHaveBeenCalledWith(400);
  });
  it("telemetry failure cannot turn a completed write into a failed action", async () => {
    const { response } = await callEndpoint({ ok: true, data: completed }, true);
    expect(response.json.mock.calls[0][0].executed).toBe(true);
  });
});

describe("actual Scout watchdog snapshot callback", () => {
  async function eventsFor(messages: Array<{ role: string; timestamp: string; content?: string }>) {
    const fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) });
    const module = { exports: {} as { callback?: () => Promise<unknown> } };
    vm.runInNewContext(watchdogSource, {
      module, exports: module.exports, fetch, console: { error: vi.fn() },
      showEvolutionSurfaces: true, setWatchdogResult: vi.fn(), user: { id: "synthetic-owner" },
      sessionRole: null, activeObjective: null, state: { messages },
    });
    await module.exports.callback?.();
    expect(fetch).toHaveBeenCalledTimes(1);
    return JSON.parse(fetch.mock.calls[0][1].body).snapshot.events;
  }
  it("never infers execution from an answer, saved wording, cancellation or uncertainty", async () => {
    const events = await eventsFor([
      { role: "user", timestamp: "2026-09-16T12:00:00Z" },
      ...["Here are options.", "Saved. Your profile has been updated.", "Cancelled.", "Scout could not confirm."]
        .map((content) => ({ role: "assistant", content, timestamp: "2026-09-16T12:01:00Z" })),
    ]);
    expect(events).toEqual([{ type: "message_sent", occurredAt: "2026-09-16T12:00:00Z" }]);
  });
  it("retains only the most recent eight actual user-message signals", async () => {
    const messages = Array.from({ length: 12 }, (_, index) => ({ role: "user", timestamp: String(index) }));
    const events = await eventsFor([...messages, { role: "assistant", timestamp: "later" }]);
    expect(events.map((event: { occurredAt: string }) => event.occurredAt)).toEqual(messages.slice(-8).map((message) => message.timestamp));
    expect(events.every((event: { type: string }) => event.type === "message_sent")).toBe(true);
  });
});
