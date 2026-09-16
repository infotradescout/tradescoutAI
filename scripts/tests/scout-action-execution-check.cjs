/**
 * Isolated behavioral tests of the real production router and registries.
 * Run: node --test scripts/tests/scout-action-execution-check.cjs
 * Requires the project's TypeScript dependency. HTTP, browser, and write adapters
 * are mocked; this is not database, browser, typecheck, or release-gate evidence.
 */
const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const ts = require("typescript");

const root = process.env.SCOUT_TEST_ROOT || path.resolve(__dirname, "../..");
const compiled = new Map();
function compile(relative) {
  if (!compiled.has(relative)) {
    const result = ts.transpileModule(fs.readFileSync(path.join(root, relative), "utf8"), {
      fileName: relative,
      compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
      reportDiagnostics: true,
    });
    const errors = (result.diagnostics || []).filter((d) => d.category === ts.DiagnosticCategory.Error);
    assert.equal(errors.length, 0, `TypeScript syntax errors in ${relative}`);
    compiled.set(relative, result.outputText);
  }
  return compiled.get(relative);
}
const response = (body = { success: true, executed: true }, status = 200) => ({
  ok: status >= 200 && status < 300, status, json: async () => body,
});
const save = () => ({ type: "SAVE_PROFILE", payload: { profilePatch: { firstName: "Jane" } } });
const feedback = () => ({
  type: "CALL_TOOL", payload: { name: "ads.feedback", adId: "ad_1", rating: "helpful" },
});
const broadcast = () => ({
  type: "SEND_ADMIN_BROADCAST", payload: { title: "Update", message: "Test message" },
});
function harness(options = {}) {
  const calls = [];
  const asyncAdapter = (name) => async (...args) => {
    calls.push([name, ...args]);
    if (options.failAdapter === name) throw new Error(`${name} failed`);
    return { url: "https://example.invalid/checkout" };
  };
  const adapters = {
    "../agent/tools/communityPayments": {
      createCommunityVaultDonationCheckoutSession: asyncAdapter("donation"),
      createPlatformSupportCheckoutSession: asyncAdapter("support"),
    },
    "../agent/tools/connections": { followUser: asyncAdapter("follow"), unfollowUser: asyncAdapter("unfollow") },
    "../agent/tools/adminBroadcast": { sendAdminBroadcast: asyncAdapter("broadcast") },
    "@/lib/floatingNotes": { openFloatingNote: asyncAdapter("note") },
  };
  const loaded = new Map();
  const fetch = async (url, init) => {
    calls.push(["fetch", url, init]);
    return options.fetch ? options.fetch(url, init, calls) : response();
  };
  const window = {
    localStorage: { getItem: () => options.feedbackDisabled ? "0" : null },
    location: { origin: "https://example.invalid", href: "" },
    open: (...args) => { calls.push(["open", ...args]); },
  };
  function load(relative) {
    if (loaded.has(relative)) return loaded.get(relative);
    const module = { exports: {} };
    const context = {
      module, exports: module.exports, fetch, window, URLSearchParams,
      console: { warn() {}, error() {} },
      require: (name) => {
        if (adapters[name]) return adapters[name];
        if (name === "@shared/scoutSupportedTools") return load("shared/scoutSupportedTools.ts");
        if (name === "./scoutCommandRegistry") return load("client/src/scout/scoutCommandRegistry.ts");
        throw new Error(`Unexpected dependency: ${name}`);
      },
    };
    vm.runInNewContext(compile(relative), context, { filename: relative });
    loaded.set(relative, module.exports);
    return module.exports;
  }
  const helpers = {
    navigate: (to) => calls.push(["navigate", to]),
    openAppDrawer: () => calls.push(["appDrawer"]),
    openToolsDrawer: () => calls.push(["toolsDrawer"]),
    prefillInput: (text) => calls.push(["prefill", text]),
    askScout: async (prompt) => {
      calls.push(["ask", prompt]);
      if (options.askScout) await options.askScout(prompt);
    },
    confirmAction: async (action) => {
      calls.push(["confirm", action.type]);
      return options.confirm ? options.confirm(action) : options.approved !== false;
    },
    isAuthenticated: options.authenticated !== false,
    userRole: options.role || "admin",
  };
  if (options.noAskHandler) delete helpers.askScout;
  const router = load("client/src/scout/ScoutActionRouter.ts");
  return {
    calls, helpers,
    execute: (actions) => router.executeScoutActions(actions, helpers),
    of: (name) => calls.filter((call) => call[0] === name),
    requests: (url) => calls.filter((call) => call[0] === "fetch" && (!url || call[1] === url)),
  };
}

for (const explicit of [false, true]) {
  test(`cancel profile save before any server request (approval flag=${explicit})`, async () => {
    const h = harness({ approved: false });
    const action = save();
    if (explicit) action.payload.requiresApproval = true;
    await assert.rejects(h.execute([action]), { name: "ScoutActionExecutionInterruptedError", outcome: "cancelled" });
    assert.equal(h.of("confirm").length, 1);
    assert.equal(h.requests().length, 0);
  });
}
test("approved profile save is authenticated and confirms before the guard", async () => {
  const h = harness();
  await h.execute([save()]);
  assert.deepEqual(h.calls.map((c) => c[0]), ["confirm", "fetch"]);
  assert.equal(JSON.parse(h.requests()[0][2].body).action.type, "SAVE_PROFILE");
});
test("guest profile save routes to sign-in without approval or write requests", async () => {
  const h = harness({ authenticated: false });
  await assert.rejects(h.execute([save()]), { name: "ScoutActionExecutionInterruptedError", outcome: "auth_required" });
  assert.equal(h.requests().length, 0);
  assert.equal(h.of("confirm").length, 0);
  assert.match(h.of("navigate")[0][1], /mode=signin/);
});
test("pending approval cannot start a profile save", async () => {
  let approve;
  const h = harness({ confirm: () => new Promise((resolve) => { approve = resolve; }) });
  const pending = h.execute([save()]);
  await Promise.resolve();
  assert.equal(h.requests().length, 0);
  approve(true);
  await pending;
  assert.equal(h.requests().length, 1);
});
for (const action of [feedback(), { type: "EXTERNAL_LINK", to: "https://example.invalid" }]) {
  test(`explicit approval is respected for ${action.type}`, async () => {
    const h = harness({ approved: false });
    await assert.rejects(h.execute([{ ...action, payload: { ...action.payload, requiresApproval: true } }]), { outcome: "cancelled" });
    assert.equal(h.of("confirm").length, 1);
    assert.equal(h.requests().length, 0);
    assert.equal(h.of("open").length, 0);
  });
}
for (const [name, fetch] of [
  ["network error", async () => { throw new Error("offline"); }],
  ["HTTP 500", async () => response({}, 500)],
  ["empty acknowledgement", async () => response({})],
  ["null acknowledgement", async () => response(null)],
  ["false acknowledgement", async () => response({ success: false })],
  ["non-boolean acknowledgement", async () => response({ success: "true" })],
  ["invalid JSON", async () => ({ ok: true, status: 200, json: async () => { throw new Error("JSON"); } })],
]) {
  test(`profile save does not appear successful after ${name}`, async () => {
    const h = harness({ fetch });
    await assert.rejects(h.execute([save()]), /confirm|blocked/);
    assert.equal(h.of("navigate").length, 0);
  });
}
for (const status of ["offline", "500"]) {
  test(`ordinary navigation remains usable when guard is ${status}`, async () => {
    const h = harness({ fetch: async () => {
      if (status === "offline") throw new Error("offline");
      return response({}, 500);
    } });
    await h.execute([{ type: "NAVIGATE", to: "/homes" }]);
    assert.equal(h.of("confirm").length, 0);
    assert.equal(h.of("navigate")[0][1], "/homes");
  });
}
for (const action of [
  { type: "ASK_SCOUT", payload: { prompt: "Find materials" } },
  { type: "ASK_SCOUT", prompt: "Find materials" },
  { type: "ASK_SCOUT", prompt: "  ", payload: { prompt: "Find materials" } },
]) {
  test(`ASK_SCOUT dispatches prompt ${JSON.stringify(action)}`, async () => {
    const h = harness();
    await h.execute([action]);
    assert.equal(h.of("ask")[0]?.[1], "Find materials");
  });
}
test("missing ASK_SCOUT handler is a visible failure", async () => {
  const h = harness({ noAskHandler: true });
  await assert.rejects(h.execute([{ type: "ASK_SCOUT", prompt: "Help" }]), /follow-up/);
});
test("empty ASK_SCOUT prompt is a visible failure", async () => {
  const h = harness();
  await assert.rejects(h.execute([{ type: "ASK_SCOUT", payload: { prompt: " " } }]), /follow-up/);
});
test("ASK_SCOUT awaits and surfaces an asynchronous handler failure", async () => {
  const h = harness({ askScout: async () => { throw new Error("follow-up failed"); } });
  await assert.rejects(h.execute([{ type: "ASK_SCOUT", prompt: "Help" }]), /follow-up failed/);
});
for (const [type, adapter] of [["FOLLOW_USER", "follow"], ["UNFOLLOW_USER", "unfollow"], ["SEND_ADMIN_BROADCAST", "broadcast"]]) {
  const action = type === "SEND_ADMIN_BROADCAST" ? broadcast() : { type, payload: { userId: "user_1" } };
  test(`${type} cancellation produces no guard request or write`, async () => {
    const h = harness({ approved: false });
    await assert.rejects(h.execute([action]), { outcome: "cancelled" });
    assert.equal(h.requests().length, 0);
    assert.equal(h.of(adapter).length, 0);
  });
  test(`${type} failure is propagated without success navigation`, async () => {
    const h = harness({ failAdapter: adapter });
    await assert.rejects(h.execute([action]), new RegExp(`${adapter} failed`));
    assert.equal(h.of("navigate").length, 0);
  });
}
for (const type of ["FOLLOW_USER", "UNFOLLOW_USER"]) {
  test(`${type} success preserves the connections handoff`, async () => {
    const h = harness();
    await h.execute([{ type, payload: { userId: "user_1" } }]);
    assert.equal(h.of("navigate")[0][1], "/connections?tab=social");
  });
}
test("feedback waits for its HTTP response and reports HTTP failure", async () => {
  let finish;
  const h = harness({ fetch: async (url) => url === "/api/ads/feedback"
    ? new Promise((resolve) => { finish = resolve; }) : response() });
  let settled = false;
  const pending = h.execute([feedback()]).finally(() => { settled = true; });
  for (let i = 0; i < 10 && !finish; i++) await Promise.resolve();
  assert.equal(typeof finish, "function");
  assert.equal(settled, false);
  finish(response({}, 503));
  await assert.rejects(pending, /feedback/);
});
test("feedback network failure is surfaced", async () => {
  const h = harness({ fetch: async (url) => {
    if (url === "/api/ads/feedback") throw new Error("feedback offline");
    return response();
  } });
  await assert.rejects(h.execute([feedback()]), /feedback offline/);
});
test("disabled feedback is not reported as success", async () => {
  const h = harness({ feedbackDisabled: true });
  await assert.rejects(h.execute([feedback()]), /unavailable/);
  assert.equal(h.requests("/api/ads/feedback").length, 0);
});
test("invalid feedback is not silently discarded", async () => {
  const h = harness();
  await assert.rejects(h.execute([{ type: "CALL_TOOL", payload: { name: "ads.feedback" } }]), /feedback option/);
});
test("feedback cannot bypass a failed guard", async () => {
  const h = harness({ fetch: async () => response({}, 500) });
  await assert.rejects(h.execute([feedback()]), /confirm/);
  assert.equal(h.requests("/api/ads/feedback").length, 0);
});
for (const [type, route] of [["START_PLATFORM_SUPPORT", "/"], ["START_COMMUNITY_VAULT_DONATION", "/community"]]) {
  test(`${type} stays navigation-only without a payment label`, async () => {
    const h = harness();
    await h.execute([{ type, payload: { amount: 25, profileId: "profile_1" } }]);
    assert.equal(h.of("navigate")[0]?.[1], route);
    assert.equal(h.requests().length, 0);
    assert.equal(h.of("support").length + h.of("donation").length, 0);
  });
}
test("unsupported tool fails before confirmation or server execution", async () => {
  const h = harness();
  await assert.rejects(h.execute([{ type: "CALL_TOOL", payload: { name: "messages.send" } }]), /can't do that yet/);
  assert.equal(h.of("confirm").length, 0);
  assert.equal(h.requests().length, 0);
});
test("server-provided follow-up cannot bypass admin role checks", async () => {
  const h = harness({ role: "homeowner", fetch: async () => response({ success: true, nextAction: broadcast() }) });
  await assert.rejects(h.execute([{ type: "NAVIGATE", to: "/homes" }]), /current account/);
  assert.equal(h.of("broadcast").length, 0);
});
test("server-provided follow-up save runs only after its own confirmation and guard", async () => {
  let count = 0;
  const h = harness({ fetch: async () => response(++count === 1 ? { success: true, nextAction: save() } : { success: true, executed: true }) });
  await h.execute([{ type: "NAVIGATE", to: "/profile-settings" }]);
  assert.deepEqual(h.calls.map((c) => c[0]), ["fetch", "navigate", "confirm", "fetch"]);
  assert.equal(JSON.parse(h.requests()[1][2].body).action.type, "SAVE_PROFILE");
});
test("cancelled follow-up cannot call its execution guard", async () => {
  const h = harness({ approved: false, fetch: async () => response({ success: true, nextAction: save() }) });
  await assert.rejects(h.execute([{ type: "NAVIGATE", to: "/profile-settings" }]), { outcome: "cancelled" });
  assert.equal(h.requests().length, 1);
});
test("follow-up guard denial prevents its local write", async () => {
  let count = 0;
  const h = harness({ fetch: async () => ++count === 1
    ? response({ success: true, nextAction: { type: "FOLLOW_USER", payload: { userId: "user_1" } } })
    : response({ success: false, message: "Not permitted" }, 403) });
  await assert.rejects(h.execute([{ type: "NAVIGATE", to: "/homes" }]), /Not permitted/);
  assert.equal(h.of("follow").length, 0);
});
test("follow-up chaining is bounded to one returned action", async () => {
  const h = harness({ fetch: async () => response({ success: true, nextAction: { type: "NAVIGATE", to: "/homes" } }) });
  await h.execute([{ type: "NAVIGATE", to: "/community" }]);
  assert.equal(h.requests().length, 2);
  assert.equal(h.of("navigate").length, 2);
});
for (const [target, route, prefill, key, value] of [
  ["direct_connect_request", "/direct-connect", { jobType: "roofing", scope: "Fix leak", budgetMin: 500 }, "description", "Fix leak"],
  ["exchange_listing", "/exchange", { title: "Saw", price: 180 }, "title", "Saw"],
  ["community_post", "/community", { title: "Local question", body: "Advice needed" }, "prefill", "Local question\n\nAdvice needed"],
]) {
  test(`${target} still hands its draft to the existing workspace`, async () => {
    const h = harness();
    await h.execute([{ type: "PREFILL_INPUT", payload: { target, route, prefill } }]);
    const [base, query] = h.of("navigate")[0][1].split("?");
    assert.equal(base, route);
    assert.equal(new URLSearchParams(query).get(key), value);
    assert.equal(h.of("confirm").length, 0);
  });
}
test("NOOP and empty action lists produce no calls", async () => {
  const h = harness();
  await h.execute(undefined);
  await h.execute([]);
  await h.execute([{ type: "NOOP" }]);
  assert.equal(h.calls.length, 0);
});
