/**
 * Run: node --test scripts/tests/scout-server-execution-check.cjs
 * Executes the actual guard and error mapping modules. Only the executor,
 * diagnostic sink, and timer are synthetic. No server, database or live writes.
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
    assert.equal(errors.length, 0, `Syntax diagnostics in ${relative}`);
    compiled.set(relative, result.outputText);
  }
  return compiled.get(relative);
}
function harness() {
  const logs = [];
  let timers = 0;
  const modules = new Map();
  function load(relative) {
    if (modules.has(relative)) return modules.get(relative);
    const module = { exports: {} };
    vm.runInNewContext(compile(relative), {
      module, exports: module.exports, Error,
      console: Object.fromEntries(["log", "info", "warn", "error"].map((level) => [
        level, (...args) => logs.push([level, ...args]),
      ])),
      setTimeout(callback) { timers++; queueMicrotask(callback); return 0; },
      require(name) {
        assert.equal(name, "./scoutErrorMapping", "Unexpected production dependency");
        return load("server/utils/scoutErrorMapping.ts");
      },
    }, { filename: relative });
    modules.set(relative, module.exports);
    return module.exports;
  }
  return {
    ...load("server/utils/scoutActionGuard.ts"), logs,
    timerCount: () => timers,
  };
}
const context = {
  userId: "synthetic-user", sessionId: "synthetic-session", requestId: "synthetic-request",
  userProfile: { businessName: "Synthetic Builder", location: "Synthetic County", roles: ["contractor"] },
};
const save = { type: "SAVE_PROFILE", payload: { profilePatch: { firstName: "Test" } } };
const normalized = (value) => JSON.parse(JSON.stringify(value));

for (const text of ["timeout", "econnrefused", "database query failed", "payment service unavailable", "invalid input"]) {
  test(`failed save (${text}) cannot become success or automatic recovery`, async () => {
    const h = harness();
    let attempts = 0;
    const result = await h.runScoutAction(save, context, async () => { attempts++; throw new Error(text); });
    assert.equal(result.ok, false);
    assert.equal(attempts, 1);
    assert.equal(h.timerCount(), 0);
    assert.equal(result.nextAction, undefined);
    assert.equal(result.error.suggestedAction, undefined);
    assert.deepEqual(normalized(result.error.context), {
      action: "SAVE_PROFILE", executionState: "unconfirmed", attempts: 1,
    });
    assert.match(result.error.userMessage, /could not confirm/);
  });
}
for (const type of ["SAVE_PROFILE", "SEND_INVOICE", "SEND_MESSAGE", "CREATE_CLIENT", "CREATE_HOA", "UNKNOWN_WRITE", "SEARCH_CONTRACTORS"]) {
  test(`${type} is attempted once, even when a second attempt would succeed`, async () => {
    const h = harness();
    let writes = 0;
    const result = await h.runScoutAction({ type }, context, async () => {
      writes++;
      if (writes === 1) throw new Error("timeout after commit");
      return { saved: true };
    });
    assert.equal(writes, 1);
    assert.equal(result.ok, false);
    assert.equal(h.timerCount(), 0);
  });
}
for (const [name, value] of [["null", null], ["undefined", undefined], ["false", false], ["zero", 0], ["empty string", ""]]) {
  test(`throw ${name} remains failure`, async () => {
    const h = harness();
    let attempts = 0;
    const result = await h.runScoutAction(save, context, async () => { attempts++; throw value; });
    assert.equal(result.ok, false);
    assert.equal(attempts, 1);
  });
}
for (const value of [Object.create(null), { toString() { throw new Error("cannot stringify"); } }]) {
  test("unprintable executor rejection is a safe failed outcome", async () => {
    const h = harness();
    const result = await h.runScoutAction(save, context, async () => { throw value; });
    assert.equal(result.ok, false);
    assert.equal(result.error.type, "SYSTEM_ERROR");
  });
}
for (const value of [{ ok: false }, { success: false }, { ok: true, success: false }]) {
  test(`negative acknowledgement ${JSON.stringify(value)} is not nested inside success`, async () => {
    const h = harness();
    const result = await h.runScoutAction(save, context, async () => value);
    assert.equal(result.ok, false);
    assert.equal(result.data, undefined);
    assert.equal(result.error.type, "INVALID_STATE");
  });
}
for (const [name, error] of [["exception", new Error("database token=PRIVATE_SENTINEL")], ["plain rejection", "token=PRIVATE_SENTINEL"]]) {
  test(`${name} diagnostics and submitted profile do not reach the result or logs`, async () => {
    const h = harness();
    const result = await h.runScoutAction(
      { type: "SAVE_PROFILE", payload: { secret: "PRIVATE_SENTINEL" } },
      { ...context, userProfile: { ...context.userProfile, businessName: "PRIVATE_SENTINEL" } },
      async () => { throw error; }
    );
    assert.equal(result.ok, false);
    assert.equal(JSON.stringify(result).includes("PRIVATE_SENTINEL"), false);
    assert.equal(JSON.stringify(h.logs).includes("PRIVATE_SENTINEL"), false);
  });
}
test("negative acknowledgement diagnostics are not exposed", async () => {
  const h = harness();
  const result = await h.runScoutAction(save, context, async () => ({ ok: false, error: "PRIVATE_SENTINEL" }));
  assert.equal(result.ok, false);
  assert.equal(JSON.stringify(result).includes("PRIVATE_SENTINEL"), false);
});
for (const type of ["SAVE_PROFILE", "SEND_INVOICE", "CREATE_CLIENT", "SEND_MESSAGE", "CREATE_HOA"]) {
  test(`guest ${type} is blocked before the executor`, async () => {
    const h = harness();
    let calls = 0;
    const result = await h.runScoutAction({ type }, {}, async () => { calls++; });
    assert.equal(result.ok, false);
    assert.equal(result.error.suggestedAction, "PROMPT_AUTH");
    assert.equal(calls, 0);
  });
}
for (const type of ["SEARCH_CONTRACTORS", "FIND_COMMUNITY", "GET_RECOMMENDATIONS"]) {
  test(`${type} preserves the location prerequisite`, async () => {
    const h = harness();
    let calls = 0;
    const result = await h.runScoutAction({ type }, { userId: context.userId }, async () => { calls++; });
    assert.equal(result.ok, false);
    assert.equal(result.error.suggestedAction, "PROMPT_LOCATION");
    assert.equal(calls, 0);
  });
}
for (const type of ["SEND_INVOICE", "CREATE_ESTIMATE"]) {
  test(`${type} preserves the business prerequisite`, async () => {
    const h = harness();
    let calls = 0;
    const result = await h.runScoutAction({ type }, { userId: context.userId }, async () => { calls++; });
    assert.equal(result.ok, false);
    assert.equal(result.error.suggestedAction, "PROMPT_BUSINESS_NAME");
    assert.equal(calls, 0);
  });
}
for (const action of [null, undefined, {}, { type: "  " }, { type: 42 }]) {
  test(`malformed action ${JSON.stringify(action)} cannot reach the executor`, async () => {
    const h = harness();
    let calls = 0;
    const result = await h.runScoutAction(action, context, async () => { calls++; });
    assert.equal(result.ok, false);
    assert.equal(result.error.type, "INVALID_STATE");
    assert.equal(calls, 0);
  });
}
for (const data of [{ updatedFields: ["firstName"], userId: "synthetic-user" }, [], null, undefined]) {
  test(`successful executor preserves its data (${JSON.stringify(data)})`, async () => {
    const h = harness();
    let calls = 0;
    const result = await h.runScoutAction(save, context, async (action) => { calls++; assert.equal(action, save); return data; });
    assert.equal(result.ok, true);
    assert.equal(result.data, data);
    assert.equal(calls, 1);
    assert.equal(h.timerCount(), 0);
  });
}
test("successful data with a diagnostic property is not treated as a failure flag", async () => {
  const h = harness();
  const data = { errorCount: 0, status: "saved" };
  const result = await h.runScoutAction(save, context, async () => data);
  assert.equal(result.ok, true);
  assert.equal(result.data, data);
});
test("safeExecute does not turn a timeout into Done or a runnable retry", async () => {
  const h = harness();
  const result = await h.safeExecute(save, context, async () => { throw new Error("timeout"); });
  assert.equal(result.success, false);
  assert.match(result.message, /could not confirm/);
  assert.equal(result.nextAction, undefined);
  assert.equal(result.data, undefined);
});
test("safeExecute preserves success data", async () => {
  const h = harness();
  const data = { saved: true };
  const result = await h.safeExecute(save, context, async () => data);
  assert.equal(result.success, true);
  assert.equal(result.message, "Done.");
  assert.equal(result.data, data);
});
test("safeExecute preserves pre-execution sign-in guidance", async () => {
  const h = harness();
  const result = await h.safeExecute(save, {}, async () => { assert.fail("must not execute"); });
  assert.equal(result.success, false);
  assert.equal(result.nextAction, "PROMPT_AUTH");
});
test("separate deliberate requests still execute separately; this is not durable deduplication", async () => {
  const h = harness();
  let calls = 0;
  const executor = async () => ({ saved: ++calls });
  await h.runScoutAction(save, context, executor);
  await h.runScoutAction(save, context, executor);
  assert.equal(calls, 2);
});
