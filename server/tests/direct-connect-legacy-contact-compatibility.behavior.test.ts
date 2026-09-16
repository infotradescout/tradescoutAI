import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import ts from "typescript";
import { describe, expect, it, vi } from "vitest";
import { serializeDirectConnectCardContactGatePayload } from "../utils/workRequestShare";
import { normalizeDirectConnectContactState } from "../../client/src/pages/direct-connect/requestCardPresentation";

const routeSource = fs.readFileSync(path.resolve("server/routes/direct-connect.ts"), "utf8");
const ast = ts.createSourceFile("direct-connect.ts", routeSource, ts.ScriptTarget.Latest, true);
const routePath = "/api/direct-connect/requests/:id/contact-gate";
let handlerSource = "";
function visit(node: ts.Node) {
  if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression) &&
      node.expression.name.text === "post" && node.arguments[0] &&
      ts.isStringLiteral(node.arguments[0]) && node.arguments[0].text === routePath) {
    const handler = node.arguments.at(-1);
    if (handler && ts.isArrowFunction(handler)) handlerSource = handler.getText(ast);
  }
  ts.forEachChild(node, visit);
}
visit(ast);
if (!handlerSource) throw new Error("Canonical contact-gate handler not found");
const compiled = ts.transpileModule(`module.exports = (${handlerSource});`, {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
}).outputText;

function fixture(overrides: { request?: any; dispatchOwner?: string; gate?: string } = {}) {
  const request = overrides.request === null ? null : {
    id: "request-1", createdByUserId: "requester-1", source: "direct_connect", status: "routed",
    ...overrides.request,
  };
  const execute = vi.fn()
    .mockResolvedValueOnce({ rows: [{ user_id: overrides.dispatchOwner || "requester-1" }] })
    .mockResolvedValueOnce({ rows: [{ contact_gate_state: overrides.gate || "locked" }] });
  const select = vi.fn(() => ({ from: () => ({ where: async () => request ? [request] : [] }) }));
  const setDispatchContactGateState = vi.fn();
  const appendDispatchEvent = vi.fn();
  const createOrGetJobWorkspaceAtContactRelease = vi.fn();
  const context: any = {
    module: { exports: {} }, console,
    db: { select, execute }, workRequests: { id: "id" }, eq: (...args: any[]) => args,
    sql: (parts: TemplateStringsArray, ...values: any[]) => ({ parts: [...parts], values }),
    serializeDirectConnectCardContactGatePayload,
    setDispatchContactGateState, appendDispatchEvent, createOrGetJobWorkspaceAtContactRelease,
  };
  vm.runInNewContext(compiled, context, { timeout: 1000 });
  const res: any = { setHeader: vi.fn(), status: vi.fn().mockReturnThis(), json: vi.fn() };
  const invoke = async (nextState = "released", userId = "requester-1") => {
    await context.module.exports({ params: { id: "request-1" }, user: { id: userId }, body: { nextState } }, res);
    return res.json.mock.calls.at(-1)?.[0];
  };
  const assertNoWrites = () => {
    expect(setDispatchContactGateState).not.toHaveBeenCalled();
    expect(appendDispatchEvent).not.toHaveBeenCalled();
    expect(createOrGetJobWorkspaceAtContactRelease).not.toHaveBeenCalled();
    for (const [query] of execute.mock.calls) expect(query.parts.join(" ")).toMatch(/^\s*SELECT\b/);
  };
  return { invoke, res, execute, select, assertNoWrites };
}

describe("Direct Connect legacy contact compatibility", () => {
  it.each(["locked", "contractor_requested", "user_approved", "request_shared", "released"])(
    "treats approval and release calls from %s as read-only compatibility responses", async (gate) => {
      for (const next of ["user_approved", "released"]) {
        const f = fixture({ gate });
        const body = await f.invoke(next);
        expect(f.res.status).toHaveBeenCalledWith(200);
        expect(f.res.setHeader).toHaveBeenCalledWith("Cache-Control", "private, no-store");
        expect(body).toMatchObject({ requestId: "request-1", code: "CONTACT_APPROVAL_NOT_REQUIRED",
          contactApprovalRequired: false });
        expect(body).not.toHaveProperty("releasedContact");
        expect(body).not.toHaveProperty("requesterContact");
        f.assertNoWrites();
      }
    }
  );

  it.each(["denied", "closed", "expired", "blocked", "unknown_state"])(
    "does not bypass a stored %s restriction", async (gate) => {
      const f = fixture({ gate });
      expect(await f.invoke()).toMatchObject({ code: "REQUEST_CONTACT_UNAVAILABLE" });
      expect(f.res.status).toHaveBeenCalledWith(409);
      f.assertNoWrites();
    }
  );

  it.each(["draft", "cancelled", "unknown"])("does not act on a %s request", async (status) => {
    const f = fixture({ request: { status } });
    await f.invoke();
    expect(f.res.status).toHaveBeenCalledWith(409);
    f.assertNoWrites();
  });

  it.each(["open", "routed", "in_progress", "pending_outcome", "completed"])(
    "needs no new approval write for legitimate request status %s", async (status) => {
      const f = fixture({ request: { status } });
      await f.invoke("user_approved");
      expect(f.res.status).toHaveBeenCalledWith(200);
      f.assertNoWrites();
    }
  );

  it("requires sign-in before reading requests", async () => {
    const f = fixture(); await f.invoke("released", "");
    expect(f.res.status).toHaveBeenCalledWith(401);
    expect(f.select).not.toHaveBeenCalled(); f.assertNoWrites();
  });

  it("rejects another user and mismatched dispatch ownership", async () => {
    for (const dispatchOwner of ["requester-1", "other-user"]) {
      const f = fixture({ dispatchOwner });
      await f.invoke("released", "other-user");
      expect(f.res.status).toHaveBeenCalledWith(403);
      f.assertNoWrites();
    }
  });

  it("does not turn an unrelated work request into Direct Connect contact authority", async () => {
    const f = fixture({ request: { source: "community" } }); await f.invoke();
    expect(f.res.status).toHaveBeenCalledWith(400); f.assertNoWrites();
  });

  it("preserves not-found and invalid-input responses", async () => {
    const absent = fixture({ request: null }); await absent.invoke();
    expect(absent.res.status).toHaveBeenCalledWith(404); absent.assertNoWrites();
    for (const next of ["", "bogus"]) {
      const f = fixture(); await f.invoke(next);
      expect(f.res.status).toHaveBeenCalledWith(400); f.assertNoWrites();
    }
  });

  it("does not require a compatibility replay to grant or deliver anything", async () => {
    for (let attempt = 0; attempt < 3; attempt++) {
      const f = fixture(); await f.invoke(); f.assertNoWrites();
    }
  });

  it("disables requester and legacy homeowner approval action metadata", () => {
    const names = new Set(["allowedRequesterActions", "allowedHomeownerActions"]);
    const found: string[] = [];
    function inspect(node: ts.Node) {
      if (ts.isPropertyAssignment(node) && names.has(node.name.getText(ast))) {
        const body = vm.runInNewContext(`JSON.stringify(${node.initializer.getText(ast)})`, {}, { timeout: 1000 });
        expect(JSON.parse(body)).toEqual({ canApproveContact: false, canDenyContact: false, canReleaseContact: false });
        found.push(node.name.getText(ast));
      }
      ts.forEachChild(node, inspect);
    }
    inspect(ast);
    expect(found.sort()).toEqual([...names].sort());
  });

  it.each(["contractor_requested", "user_approved", "locked", "request_shared"])(
    "does not revive approval buttons from an older cached %s card", (contactGateState) => {
      const source = fs.readFileSync(path.resolve("client/src/pages/direct-connect/DirectConnectShell.tsx"), "utf8");
      const marker = "const contactGateState = normalizeDirectConnectContactState(r.contactGateState);";
      const start = source.indexOf(marker);
      const end = source.indexOf("const contactPanelState =", start);
      expect(start).toBeGreaterThan(-1); expect(end).toBeGreaterThan(start);
      const result = vm.runInNewContext(source.slice(start, end) +
        "JSON.stringify({canApproveContact,canDenyContact,canReleaseContact})", {
          r: Object.freeze({ contactGateState }), normalizeDirectConnectContactState,
        }, { timeout: 1000 });
      expect(JSON.parse(result)).toEqual({ canApproveContact: false, canDenyContact: false, canReleaseContact: false });
    }
  );
});
