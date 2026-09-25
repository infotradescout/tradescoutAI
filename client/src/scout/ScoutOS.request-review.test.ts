// @vitest-environment jsdom

import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import ts from "typescript";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  readStagedDirectConnectEntryContext,
  stageDirectConnectEntryContext,
} from "@/pages/direct-connect/stagedDirectConnectEntryContext";
import { resolveQuickActionIntent } from "./localIntents";

// Exercise the actual ScoutThread quick-action callback without rendering ScoutOS.
const sourcePath = path.resolve("client/src/scout/ScoutOS.tsx");
const source = ts.createSourceFile(
  sourcePath,
  fs.readFileSync(sourcePath, "utf8"),
  ts.ScriptTarget.Latest,
  true,
  ts.ScriptKind.TSX
);
let callback: ts.ArrowFunction | undefined;
function visit(node: ts.Node): void {
  if (
    ts.isJsxAttribute(node) &&
    node.name.text === "onQuickAction" &&
    node.initializer &&
    ts.isJsxExpression(node.initializer) &&
    node.initializer.expression &&
    ts.isArrowFunction(node.initializer.expression)
  ) {
    callback = node.initializer.expression;
  }
  ts.forEachChild(node, visit);
}
visit(source);
if (!callback) throw new Error("ScoutThread quick-action callback was not found");
const compiled = ts.transpileModule(`exports.handle = (${callback.getText(source)});`, {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
}).outputText;

function fixture(content: string | null, user: Record<string, string> | null) {
  const navigate = vi.fn();
  const apiRequest = vi.fn();
  const scope = {
    exports: {} as { handle: (label: string) => void },
    setHasGuestInteracted: vi.fn(),
    resolveQuickActionIntent,
    state: { messages: content === null ? [] : [{ role: "user", content }] },
    user,
    navigate,
    apiRequest,
    stageDirectConnectEntryContext,
    SCOUT_REQUEST_REVIEW_TARGET: "/direct-connect/post?source=scout",
  };
  vm.runInNewContext(compiled, scope, { filename: `${sourcePath}:onQuickAction` });
  return { handle: scope.exports.handle, navigate, apiRequest };
}

describe("Scout request review handoff", () => {
  beforeEach(() => {
    window.sessionStorage.clear();
    vi.restoreAllMocks();
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("opens the existing composer with private county context and sends nothing", () => {
    const ui = fixture("Repair a leaking roof this week", {
      id: "synthetic-requester",
      countyFips: "04013",
      stateCode: "AZ",
    });

    ui.handle("Start a Direct Connect request for this");

    expect(ui.navigate).toHaveBeenCalledTimes(1);
    const destination = String(ui.navigate.mock.calls[0][0]);
    const url = new URL(destination, window.location.origin);
    expect(url.pathname).toBe("/direct-connect/post");
    expect(url.searchParams.get("staged")).toMatch(/^[a-f0-9]{64}$/);
    expect(destination).not.toContain("Repair");
    expect(destination).not.toContain("04013");
    expect(readStagedDirectConnectEntryContext(destination)).toEqual({
      countyFips: "04013",
      stateCode: "AZ",
      source: "scout",
      title: "Repair a leaking roof this week",
      description: "Repair a leaking roof this week",
    });
    expect(ui.apiRequest).not.toHaveBeenCalled();
    expect(fetch).not.toHaveBeenCalled();
  });

  it("lets a guest review the draft before the composer asks them to sign in", () => {
    const ui = fixture("Need plumbing help", null);

    ui.handle("Start a Direct Connect request for this");

    const destination = String(ui.navigate.mock.calls[0][0]);
    expect(readStagedDirectConnectEntryContext(destination)).toEqual({
      source: "scout",
      title: "Need plumbing help",
      description: "Need plumbing help",
    });
    expect(ui.apiRequest).not.toHaveBeenCalled();
    expect(fetch).not.toHaveBeenCalled();
  });

  it("falls back to an empty review form if browser storage refuses private details", () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("Storage unavailable");
    });
    const ui = fixture("Private roof details", null);

    ui.handle("Start a Direct Connect request for this");

    const destination = String(ui.navigate.mock.calls[0][0]);
    expect(destination).toBe("/direct-connect/post?source=scout");
    expect(readStagedDirectConnectEntryContext(destination)).toBeNull();
    expect(ui.apiRequest).not.toHaveBeenCalled();
    expect(fetch).not.toHaveBeenCalled();
  });
});
