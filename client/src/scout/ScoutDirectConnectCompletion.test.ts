import { describe, expect, it, vi } from "vitest";
import fs from "node:fs";
import vm from "node:vm";
import ts from "typescript";
import { resolveScoutRequestCompletion, submitScoutRequest, SCOUT_REQUEST_UNCONFIRMED_MESSAGE } from "./scoutRequestCompletion";

function extractCallback(): string {
  const file = "client/src/scout/ScoutOS.tsx";
  const source = ts.createSourceFile(file, fs.readFileSync(file, "utf8"), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  let callback: ts.ArrowFunction | undefined;
  function visit(node: ts.Node) {
    if (ts.isJsxAttribute(node) && node.name.getText(source) === "onClick" && node.initializer &&
        ts.isJsxExpression(node.initializer) && node.initializer.expression &&
        ts.isArrowFunction(node.initializer.expression) &&
        node.initializer.expression.getText(source).includes('"/api/direct-connect/requests"')) {
      if (callback) throw new Error("Ambiguous request-save callback");
      callback = node.initializer.expression;
    }
    ts.forEachChild(node, visit);
  }
  visit(source);
  if (!callback) throw new Error("Real Scout request-save callback missing");
  return ts.transpileModule(`exports.run = ${callback.getText(source)};`, {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
  }).outputText;
}
const callbackSource = extractCallback();
const saved = { id: "request-123", status: "draft", countyFips: "12033" };

function harness(api = vi.fn().mockResolvedValue(saved)) {
  const dcCreateOperationRef: { current: null | { fingerprint: string; operationId: string; pending?: boolean } } = { current: null };
  const applyServerResponse = vi.fn();
  const recordActivity = vi.fn();
  const setError = vi.fn();
  const setDcBusy = vi.fn();
  const setDcDraft = vi.fn();
  const setDcConfirmOpen = vi.fn();
  const invalidateQueries = vi.fn().mockResolvedValue(undefined);
  const createClientOperationId = vi.fn().mockReturnValue("dc-scout-test-operation");
  const module = { exports: {} as { run: (event: { preventDefault: () => void }) => Promise<void> } };
  vm.runInNewContext(callbackSource, {
    module, exports: module.exports,
    require(name: string) {
      if (name === "./scoutRequestCompletion") return { resolveScoutRequestCompletion, submitScoutRequest };
      if (name === "@/lib/queryClient") return { queryClient: { invalidateQueries } };
      throw new Error(`Unexpected production callback dependency ${name}`);
    },
    dcDraft: { title: "Kitchen repair", description: "Repair existing cabinets", countyFips: "12033", stateCode: "FL", tradeId: "carpentry", budgetMin: 500, budgetMax: 900 },
    dcBusy: false, dcCreateOperationRef, apiRequest: api, applyServerResponse, recordActivity,
    setError, setDcBusy, setDcDraft, setDcConfirmOpen, createClientOperationId,
    formatUserFacingErrorMessage: (_error: unknown, fallback: string) => fallback,
    location: "/scout",
  });
  return { api, dcCreateOperationRef, applyServerResponse, recordActivity, setError, setDcBusy,
    setDcDraft, setDcConfirmOpen, invalidateQueries, createClientOperationId,
    run: () => module.exports.run({ preventDefault: vi.fn() }) };
}

describe("production Scout request-save callback", () => {
  it("confirms only the returned request and refreshes its work views", async () => {
    const h = harness(); await h.run(); await Promise.resolve();
    expect(h.api).toHaveBeenCalledTimes(1);
    expect(h.api.mock.calls[0][2]).toMatchObject({ autoRoute: false, operationId: "dc-scout-test-operation", countyFips: "12033", budgetMin: 500, budgetMax: 900 });
    expect(h.applyServerResponse).toHaveBeenCalledTimes(1);
    const [message, actions] = h.applyServerResponse.mock.calls[0];
    expect(message.content).toBe("Saved. Review your request before sharing.");
    expect(actions[0]).toMatchObject({ type: "NAVIGATE", label: "Open saved request", to: "/direct-connect/active?selected=request-123&filter=all&county=12033" });
    expect(message.clusters[0].primaryAction.to).toBe(actions[0].to);
    expect(h.recordActivity.mock.calls[0][0].meta.workRequestId).toBe("request-123");
    expect(h.invalidateQueries).toHaveBeenCalledWith({ queryKey: ["/api/scout/work"] });
    expect(h.invalidateQueries).toHaveBeenCalledWith({ queryKey: ["/api/direct-connect/requests"] });
    expect(h.dcCreateOperationRef.current).toBeNull();
    expect(h.setDcDraft).toHaveBeenCalledWith(null);
  });

  it.each([null, {}, { success: true }, { ...saved, success: false }, { ...saved, executed: false },
    { ...saved, id: "" }, { ...saved, status: "unknown" }])("never records or acknowledges an unconfirmed response: %j", async (response) => {
    const h = harness(vi.fn().mockResolvedValue(response)); await h.run();
    expect(h.applyServerResponse).not.toHaveBeenCalled();
    expect(h.recordActivity).not.toHaveBeenCalled();
    expect(h.invalidateQueries).not.toHaveBeenCalled();
    expect(h.setError).toHaveBeenCalledWith(SCOUT_REQUEST_UNCONFIRMED_MESSAGE);
    expect(h.setDcDraft).not.toHaveBeenCalled();
    expect(h.dcCreateOperationRef.current?.operationId).toBe("dc-scout-test-operation");
    expect(h.dcCreateOperationRef.current?.pending).toBe(false);
  });

  it("rejects a second click before React has rendered the busy state", async () => {
    let finish!: (value: unknown) => void;
    const h = harness(vi.fn().mockImplementation(() => new Promise((resolve) => { finish = resolve; })));
    const first = h.run();
    expect(h.dcCreateOperationRef.current?.pending).toBe(true);
    await h.run();
    expect(h.api).toHaveBeenCalledTimes(1);
    expect(h.applyServerResponse).not.toHaveBeenCalled();
    finish(saved); await first;
    expect(h.applyServerResponse).toHaveBeenCalledTimes(1);
    expect(h.recordActivity).toHaveBeenCalledTimes(1);
  });

  it("retains the same operation key on an explicitly retried uncertain request", async () => {
    const api = vi.fn().mockRejectedValueOnce(new Error("Connection interrupted")).mockResolvedValueOnce(saved);
    const h = harness(api); await h.run();
    expect(h.api).toHaveBeenCalledTimes(1);
    expect(h.applyServerResponse).not.toHaveBeenCalled();
    await h.run();
    expect(h.api).toHaveBeenCalledTimes(2);
    expect(h.api.mock.calls[0][2].operationId).toBe(h.api.mock.calls[1][2].operationId);
    expect(h.createClientOperationId).toHaveBeenCalledTimes(1);
    expect(h.applyServerResponse).toHaveBeenCalledTimes(1);
  });

  it("preserves verification guidance without claiming a request was created", async () => {
    const h = harness(vi.fn().mockResolvedValue({ verificationRequired: true, message: "Confirm your information first.", actions: [] }));
    await h.run();
    expect(h.applyServerResponse.mock.calls[0][0].content).toBe("Confirm your information first.");
    expect(h.recordActivity).not.toHaveBeenCalled();
    expect(h.invalidateQueries).not.toHaveBeenCalled();
    expect(h.dcCreateOperationRef.current?.pending).toBe(false);
  });

  it("does not erase a saved acknowledgement when a refresh fails", async () => {
    const h = harness(); h.invalidateQueries.mockRejectedValue(new Error("Refresh unavailable"));
    await h.run(); await Promise.resolve(); await Promise.resolve();
    expect(h.applyServerResponse).toHaveBeenCalledTimes(1);
    expect(h.setError).not.toHaveBeenCalled();
  });
});
