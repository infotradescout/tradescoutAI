import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import ts from "typescript";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { executeScoutActions } from "./ScoutActionRouter";
import { formatUserFacingErrorMessage } from "../lib/userFacingError";
import type { ScoutAction } from "./state";

// Compile the actual component callback, not a duplicate of its Saved/error logic.
// React rendering and HTTP are controlled here; native/browser proof is separate.
const sourcePath = path.resolve("client/src/scout/ScoutOS.tsx");
const source = ts.createSourceFile(sourcePath, fs.readFileSync(sourcePath, "utf8"), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
let callback: ts.ArrowFunction | undefined;
function visit(node: ts.Node) {
  if (ts.isVariableDeclaration(node) && node.name.getText(source) === "handleClusterAction") {
    const initializer = node.initializer;
    if (initializer && ts.isCallExpression(initializer) && ts.isArrowFunction(initializer.arguments[0])) {
      callback = initializer.arguments[0];
    }
  }
  ts.forEachChild(node, visit);
}
visit(source);
if (!callback) throw new Error("The real ScoutOS action callback must be covered by this suite");
const compiled = ts.transpileModule(`exports.handle = (${callback.getText(source)});`, {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
}).outputText;

function fixture({ approved = true, authenticated = true }: { approved?: boolean; authenticated?: boolean } = {}) {
  const saved = vi.fn();
  const error = vi.fn();
  const status = vi.fn();
  const navigate = vi.fn();
  const confirm = vi.fn().mockReturnValue(approved);
  const scope = {
    exports: {} as { handle: (action: ScoutAction) => Promise<void> },
    executeScoutActions,
    formatUserFacingErrorMessage,
    persistScoutLearningSignalLocally: () => null,
    recordActivity: vi.fn(),
    persistScoutResume: vi.fn(),
    location: "/scout",
    user: authenticated ? { id: "synthetic-user", role: "business_owner" } : null,
    isAuthenticated: authenticated,
    maybeOpenWorkAreaForRoute: () => false,
    renderStartRef: { current: null },
    setStatus: status,
    setToolsOpen: vi.fn(),
    setPrefillKey: vi.fn(),
    handleSend: vi.fn(),
    navigate,
    applyServerResponse: saved,
    setError: error,
    window: { confirm, localStorage: { setItem: vi.fn() } },
  };
  vm.runInNewContext(compiled, scope, { filename: sourcePath + ":actual-action-handler" });
  return { handle: scope.exports.handle, saved, error, status, navigate, confirm };
}
const action = (): ScoutAction => ({ type: "SAVE_PROFILE", label: "Save profile update", payload: { profilePatch: { firstName: "Jordan" } } });
const response = (body: unknown, status = 200) => ({ ok: status >= 200 && status < 300, status, json: async () => body });

beforeEach(() => {
  vi.stubEnv("DEV", false);
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response({ success: true, authorized: true, executed: true })));
});
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); vi.restoreAllMocks(); });

describe("ScoutOS completion truth through its real action handler", () => {
  it("cancel displays a cancellation, makes no request, and never appends Saved", async () => {
    const ui = fixture({ approved: false });
    await ui.handle(action());
    expect(fetch).not.toHaveBeenCalled();
    expect(ui.saved).not.toHaveBeenCalled();
    expect(ui.error).toHaveBeenCalledWith("Cancelled. This action was not submitted.");
    expect(ui.status).toHaveBeenLastCalledWith("idle");
  });

  it("a guest sign-in handoff is not mistaken for a saved profile", async () => {
    const ui = fixture({ authenticated: false });
    await ui.handle(action());
    expect(fetch).not.toHaveBeenCalled();
    expect(ui.confirm).not.toHaveBeenCalled();
    expect(ui.navigate).toHaveBeenCalledWith("/pre-scout-setup?mode=signin&next=%2Fscout");
    expect(ui.saved).not.toHaveBeenCalled();
    expect(ui.error).toHaveBeenCalledWith("Sign in to complete this action.");
  });

  it("confirmed execution appends exactly one existing Saved acknowledgement", async () => {
    const ui = fixture();
    await ui.handle(action());
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(ui.confirm).toHaveBeenCalledTimes(1);
    expect(ui.saved).toHaveBeenCalledTimes(1);
    expect(ui.saved).toHaveBeenCalledWith(expect.objectContaining({ role: "assistant", content: "Saved. Your profile has been updated." }), []);
    expect(ui.error).not.toHaveBeenCalled();
  });

  for (const executed of [undefined, false, null, "true", 1]) {
    it(`authorization without a boolean execution receipt is not completion (${String(executed)})`, async () => {
      vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response({ success: true, authorized: true, executed })));
      const ui = fixture();
      await ui.handle(action());
      expect(ui.saved).not.toHaveBeenCalled();
      expect(ui.error).toHaveBeenCalledWith("Scout could not confirm that your profile was saved. Check your profile before trying again.");
      expect(fetch).toHaveBeenCalledTimes(1);
    });
  }

  it("payment wording in a profile label cannot bypass the actual save", async () => {
    const ui = fixture();
    await ui.handle({ ...action(), label: "Save payment preferences" });
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(ui.saved).toHaveBeenCalledTimes(1);
    expect(ui.navigate).not.toHaveBeenCalled();
  });

  it("does not acknowledge completion while the backend response is pending", async () => {
    let finish!: (value: ReturnType<typeof response>) => void;
    vi.stubGlobal("fetch", vi.fn(() => new Promise(resolve => { finish = resolve; })));
    const ui = fixture();
    const pending = ui.handle(action());
    await vi.waitFor(() => expect(fetch).toHaveBeenCalledTimes(1));
    expect(ui.saved).not.toHaveBeenCalled();
    expect(ui.status).toHaveBeenLastCalledWith("executing_action");
    finish(response({ success: true, executed: true }));
    await pending;
    expect(ui.saved).toHaveBeenCalledTimes(1);
  });

  for (const status of [400, 401, 403, 500, 503]) {
    it(`HTTP ${status} cannot trigger Saved or an automatic retry`, async () => {
      vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response({ success: false }, status)));
      const ui = fixture();
      await ui.handle(action());
      expect(ui.saved).not.toHaveBeenCalled();
      expect(ui.error).toHaveBeenCalledTimes(1);
      expect(fetch).toHaveBeenCalledTimes(1);
    });
  }

  it("a lost acknowledgement after a write displays uncertainty, not success or unchanged", async () => {
    let writtenName = "Original";
    vi.stubGlobal("fetch", vi.fn(async () => {
      writtenName = "Jordan";
      throw new Error("synthetic acknowledgement lost after commit");
    }));
    const ui = fixture();
    await ui.handle(action());
    expect(writtenName).toBe("Jordan");
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(ui.saved).not.toHaveBeenCalled();
    expect(ui.error).toHaveBeenCalledWith("Scout could not confirm this action. Check its current status before trying again.");
  });

  it("a cancelled follow-up does not pretend the earlier action was undone", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response({ success: true, executed: true, nextAction: { type: "FOLLOW_USER", payload: { userId: "synthetic-target" } } })));
    const ui = fixture();
    ui.confirm.mockReturnValueOnce(true).mockReturnValueOnce(false);
    await ui.handle(action());
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(ui.error).toHaveBeenCalledWith("Cancelled. This action was not submitted. The earlier action may already be complete; check its status.");
    expect(ui.saved).not.toHaveBeenCalled();
  });

  it("production formatting rejects extra executor details appended to trusted copy", () => {
    expect(formatUserFacingErrorMessage(new Error("Cancelled. This action was not submitted. private payload=secret"), "Safe fallback")).toBe("Safe fallback");
    expect(formatUserFacingErrorMessage(new Error("Scout could not confirm this action. Check its current status before trying again. SQL details"), "Safe fallback")).toBe("Safe fallback");
  });
});
