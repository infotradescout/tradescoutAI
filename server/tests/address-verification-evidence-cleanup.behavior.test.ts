import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { existsSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import os from "node:os";
import path from "node:path";
import vm from "node:vm";
import ts from "typescript";
import { describe, it } from "vitest";

// Execute the actual registered handlers and local evidence storage. Database, upload lookup,
// and R2 transport are controlled boundaries; this is not native PostgreSQL/R2 integration proof.
const repoRoot = path.resolve(__dirname, "../..");
const nativeRequire = createRequire(path.join(repoRoot, "package.json"));
const owner = "user-a";
const sourceKey = "private/user-a/upload.pdf";
const oldKey = "private/address-evidence/user-a/11111111-1111-4111-8111-111111111111";

type Scenario = {
  method?: "POST" | "PUT";
  writeFailure?: boolean;
  commitResponseLost?: boolean;
  referenceAfterLock?: boolean;
  cleanupFailure?: "transaction" | "lock" | "read" | "delete";
  cleanupAccountMissing?: boolean;
  r2?: boolean;
};

async function harness(scenario: Scenario = {}) {
  const root = await mkdtemp(path.join(os.tmpdir(), "address-evidence-cleanup-"));
  const sourcePath = path.join(root, "original.pdf");
  const oldPath = path.join(root, "address-evidence", owner, oldKey.split("/").at(-1)!);
  await mkdir(path.dirname(oldPath), { recursive: true });
  await writeFile(sourcePath, "%PDF-1.7\noriginal user upload");
  await writeFile(oldPath, "%PDF-1.7\nprevious evidence");
  const failure = new Error("submission outcome unavailable");
  const events: string[] = [];
  const warnings: unknown[][] = [];
  const references = new Set<string>(scenario.method === "PUT" ? [oldKey] : []);
  const users = { id: "users.id" };
  const addressVerifications = {
    id: "addressVerifications.id",
    userId: "addressVerifications.userId",
    documentUrl: "addressVerifications.documentUrl",
    createdAt: "addressVerifications.createdAt",
  };
  const account = { id: owner, createdAt: new Date("2026-01-01T00:00:00Z"), addressVerified: false };
  const previous = { id: "verification-a", userId: owner, status: "rejected", documentUrl: oldKey };
  const state = { key: "", calls: 0, locked: false, cleanupOptions: undefined as unknown };
  const r2Commands: Array<{ kind: string; input: any; options?: any }> = [];
  const cleanupError = () => new Error("private storage diagnostic must not reach cleanup logs");

  function transaction(phase: "submission" | "cleanup") {
    return {
      async execute(statement: { text: string }) {
        events.push(statement.text);
      },
      select() {
        let table: unknown;
        let condition: { left: unknown; right: unknown };
        const query: any = {
          from(value: unknown) { table = value; return query; },
          where(value: typeof condition) { condition = value; return query; },
          orderBy() { return query; },
          limit() { return query; },
          async for(mode: string) {
            assert.equal(mode, "update");
            if (phase === "submission") {
              return table === users ? [account] : scenario.method === "PUT" ? [previous] : [];
            }
            assert.equal(table, users);
            assert.deepEqual(condition, { left: users.id, right: owner });
            events.push("cleanup-account-lock");
            if (scenario.cleanupFailure === "lock") throw cleanupError();
            if (scenario.cleanupAccountMissing) return [];
            if (scenario.referenceAfterLock) references.add(state.key);
            state.locked = true;
            return [account];
          },
          then(resolve: (value: unknown) => unknown, reject: (error: unknown) => unknown) {
            return Promise.resolve().then(() => {
              assert.equal(phase, "cleanup");
              assert.equal(state.locked, true, "reference check must follow the account lock");
              assert.equal(table, addressVerifications);
              assert.deepEqual(condition, { left: addressVerifications.documentUrl, right: state.key });
              events.push("cleanup-reference-read");
              if (scenario.cleanupFailure === "read") throw cleanupError();
              return references.has(state.key) ? [{ id: "committed-verification" }] : [];
            }).then(resolve, reject);
          },
        };
        return query;
      },
      insert() { return mutation(); },
      update() { return mutation(); },
    };
  }

  function mutation() {
    const query: any = {
      values(value: { documentUrl: string }) { state.key = value.documentUrl; return query; },
      set(value: { documentUrl: string }) { state.key = value.documentUrl; return query; },
      where() { return query; },
      async returning() {
        events.push("submission-write");
        if (scenario.writeFailure) throw failure;
        return [{ id: "verification-a", status: "submitted" }];
      },
    };
    return query;
  }

  const db = {
    async transaction(callback: (tx: any) => Promise<unknown>, options?: unknown) {
      state.calls++;
      if (state.calls === 1) {
        try {
          const result = await callback(transaction("submission"));
          if (state.key) references.add(state.key);
          if (scenario.commitResponseLost) throw failure;
          events.push("submission-committed");
          return result;
        } catch (error) {
          events.push("submission-rejected");
          throw error;
        }
      }
      state.cleanupOptions = options;
      events.push("cleanup-start");
      if (scenario.cleanupFailure === "transaction") throw cleanupError();
      return callback(transaction("cleanup"));
    },
  };
  class GetObjectCommand { kind = "get"; constructor(public input: any) {} }
  class PutObjectCommand { kind = "put"; constructor(public input: any) {} }
  class DeleteObjectCommand { kind = "delete"; constructor(public input: any) {} }
  const mocks: Record<string, any> = {
    "drizzle-orm": {
      eq: (left: unknown, right: unknown) => ({ left, right }),
      desc: (value: unknown) => value,
      and: (...values: unknown[]) => values,
      sql: (strings: TemplateStringsArray) => ({ text: strings.join("") }),
    },
    "../db": { db },
    "../auth": { isAuthenticated() {}, isAdmin() {} },
    "../storage": { storage: {} },
    "@shared/schema": {
      users, addressVerifications,
      addressVerificationSubmissionSchema: { safeParse: (data: unknown) => ({ success: true, data }) },
      addressVerificationReviewSchema: {},
    },
    "./businessVerificationWorkflow": { isOwnedPrivateObjectKey: (key: string, id: string) => key === sourceKey && id === owner },
    "../services/businessVerificationWorkflow": { isOwnedPrivateObjectKey: (key: string, id: string) => key === sourceKey && id === owner },
    "../localStorage": { LocalStorageService: class { async getPrivateFilePathFromObjectKey() { return sourcePath; } }, R2StorageService: class {} },
    "../runtimePaths": { runtimePaths: { privateUploads: root } },
    "@aws-sdk/client-s3": { GetObjectCommand, PutObjectCommand, DeleteObjectCommand },
    "../r2Client": {
      requireR2Configuration: () => ({ bucketName: "isolated-test-bucket" }),
      createR2Client: () => ({ async send(command: any, options?: any) {
        r2Commands.push({ kind: command.kind, input: command.input, options });
        if (command.kind === "get") return { Body: (async function* () { yield Buffer.from("%PDF-1.7\nfixture"); })() };
        if (command.kind === "delete" && scenario.cleanupFailure === "delete") throw cleanupError();
        return {};
      } }),
    },
  };
  if (scenario.cleanupFailure === "delete" && !scenario.r2) {
    mocks["node:fs/promises"] = { ...nativeRequire("node:fs/promises"), unlink: async () => { throw cleanupError(); } };
  }
  const cache = new Map<string, { exports: any }>();
  function load(relativePath: string): any {
    const filename = path.resolve(repoRoot, relativePath);
    if (cache.has(filename)) return cache.get(filename)!.exports;
    const module = { exports: {} as any };
    cache.set(filename, module);
    const compiled = ts.transpileModule(readFileSync(filename, "utf8"), {
      fileName: filename,
      compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, esModuleInterop: true },
    });
    vm.runInNewContext(compiled.outputText, {
      module, exports: module.exports, Buffer, AbortSignal,
      console: { error() {}, warn: (...args: unknown[]) => warnings.push(args) },
      process: { env: scenario.r2 ? { R2_BUCKET_NAME: "isolated-test-bucket", R2_ACCESS_KEY_ID: "test-only" } : {} },
      require: (id: string) => {
        if (Object.hasOwn(mocks, id)) return mocks[id];
        if (id.startsWith(".")) return load(path.resolve(path.dirname(filename), `${id}.ts`));
        return nativeRequire(id);
      },
    }, { filename });
    return module.exports;
  }
  const registered = new Map<string, (...args: any[]) => Promise<void>>();
  const app: any = {};
  for (const method of ["post", "put", "get"]) {
    app[method] = (url: string, ...handlers: any[]) => registered.set(`${method.toUpperCase()} ${url}`, handlers.at(-1));
  }
  load("server/routes/address-verification.ts").registerAddressVerificationRoutes(app);
  return {
    state, failure, events, warnings, r2Commands, sourcePath, oldPath,
    copyExists: () => existsSync(path.join(root, "address-evidence", owner, state.key.split("/").at(-1) || "none")),
    evidence: () => load("server/services/addressVerificationEvidence.ts"),
    lifecycle: () => load("server/services/addressVerificationEvidenceTransaction.ts"),
    async invoke() {
      const method = scenario.method || "POST";
      const url = method === "PUT" ? "/api/address-verification/:id" : "/api/address-verification";
      const response: any = { statusCode: 200, body: undefined, status(code: number) { this.statusCode = code; return this; }, json(body: unknown) { this.body = body; return this; } };
      await registered.get(`${method} ${url}`)!({ user: { id: owner }, params: { id: "verification-a" }, body: { documentUrl: sourceKey, documentType: "application/pdf", verificationMethod: "document" } }, response);
      return response;
    },
    close: () => rm(root, { recursive: true, force: true }),
  };
}

async function withHarness(scenario: Scenario, run: (h: Awaited<ReturnType<typeof harness>>) => Promise<void>) {
  const h = await harness(scenario);
  try { await run(h); } finally { await h.close(); }
}

describe("address evidence lifecycle through registered submission routes", () => {
  for (const method of ["POST", "PUT"] as const) {
    it(`${method}: removes only the new copy after a rolled-back write`, () => withHarness({ method, writeFailure: true }, async (h) => {
      const response = await h.invoke();
      assert.equal(response.statusCode, 400);
      assert.ok(h.state.key);
      assert.equal(h.copyExists(), false);
      assert.equal(existsSync(h.sourcePath), true);
      assert.equal(existsSync(h.oldPath), true);
      assert.equal(JSON.stringify(h.state.cleanupOptions), JSON.stringify({ isolationLevel: "read committed" }));
      assert.ok(h.events.indexOf("cleanup-start") > h.events.indexOf("submission-rejected"));
      assert.ok(h.events.includes("SET LOCAL lock_timeout = '2s'"));
      assert.ok(h.events.includes("SET LOCAL statement_timeout = '5s'"));
    }));
    it(`${method}: keeps committed evidence without starting cleanup`, () => withHarness({ method }, async (h) => {
      const response = await h.invoke();
      assert.equal(response.statusCode, method === "POST" ? 201 : 200);
      assert.equal(h.copyExists(), true);
      assert.equal(h.state.calls, 1);
      assert.equal(existsSync(h.oldPath), true);
    }));
    it(`${method}: keeps evidence when the commit succeeded but its response was lost`, () => withHarness({ method, commitResponseLost: true }, async (h) => {
      assert.equal((await h.invoke()).statusCode, 400);
      assert.equal(h.copyExists(), true);
      assert.ok(h.events.includes("cleanup-reference-read"));
    }));
    it(`${method}: observes references committed while the cleanup lock waited`, () => withHarness({ method, writeFailure: true, referenceAfterLock: true }, async (h) => {
      await h.invoke();
      assert.equal(h.copyExists(), true);
      assert.equal(JSON.stringify(h.state.cleanupOptions), JSON.stringify({ isolationLevel: "read committed" }));
    }));
    for (const cleanupFailure of ["transaction", "lock", "read", "delete"] as const) {
      it(`${method}: retains evidence when cleanup ${cleanupFailure} fails`, () => withHarness({ method, writeFailure: true, cleanupFailure }, async (h) => {
        assert.equal((await h.invoke()).statusCode, 400);
        assert.equal(h.copyExists(), true);
        assert.deepEqual(h.warnings, [["Address verification evidence cleanup deferred"]]);
      }));
    }
    it(`${method}: retains evidence when the account lock cannot establish ownership`, () => withHarness({ method, writeFailure: true, cleanupAccountMissing: true }, async (h) => {
      await h.invoke();
      assert.equal(h.copyExists(), true);
      assert.equal(h.events.includes("cleanup-reference-read"), false);
    }));
  }

  it("preserves the exact original error when cleanup also fails", () => withHarness({ cleanupFailure: "transaction" }, async (h) => {
    const original = new Error("original rejection");
    await assert.rejects(h.lifecycle().withAddressEvidenceTransaction(owner, async (_tx: unknown, snapshot: any) => {
      await snapshot(sourceKey, "application/pdf");
      throw original;
    }), (error: unknown) => error === original);
    assert.deepEqual(h.warnings, [["Address verification evidence cleanup deferred"]]);
  }));

  it("does not clean up a source read that failed before creating evidence", () => withHarness({}, async (h) => {
    await writeFile(h.sourcePath, "not a document");
    assert.equal((await h.invoke()).statusCode, 400);
    assert.equal(h.state.calls, 1);
    assert.equal(existsSync(h.sourcePath), true);
  }));

  it("local disposal is idempotent and cannot target a member upload or another owner", () => withHarness({}, async (h) => {
    const evidence = h.evidence();
    await assert.rejects(evidence.discardAddressVerificationEvidence(sourceKey, owner));
    await assert.rejects(evidence.discardAddressVerificationEvidence(oldKey, "user-b"));
    await assert.rejects(evidence.discardAddressVerificationEvidence("private/address-evidence/user-a/../original.pdf", owner));
    assert.equal(existsSync(h.sourcePath), true);
    assert.equal(existsSync(h.oldPath), true);
    await evidence.discardAddressVerificationEvidence(oldKey, owner);
    await evidence.discardAddressVerificationEvidence(oldKey, owner);
    assert.equal(existsSync(h.oldPath), false);
    assert.match(await readFile(h.sourcePath, "utf8"), /^%PDF-/);
  }));

  it("R2 rollback deletes only the generated copy with a bounded abort signal", () => withHarness({ r2: true, writeFailure: true }, async (h) => {
    assert.equal((await h.invoke()).statusCode, 400);
    const deletions = h.r2Commands.filter((command) => command.kind === "delete");
    assert.equal(deletions.length, 1);
    assert.equal(deletions[0].input.Key, h.state.key);
    assert.notEqual(deletions[0].input.Key, sourceKey);
    assert.equal(deletions[0].input.Bucket, "isolated-test-bucket");
    assert.ok(deletions[0].options.abortSignal instanceof AbortSignal);
  }));

  it("R2 preserves referenced evidence after a lost commit response", () => withHarness({ r2: true, commitResponseLost: true }, async (h) => {
    await h.invoke();
    assert.equal(h.r2Commands.some((command) => command.kind === "delete"), false);
  }));

  it("R2 deletion failures do not replace the submission response or expose private diagnostics", () => withHarness({ r2: true, writeFailure: true, cleanupFailure: "delete" }, async (h) => {
    assert.equal((await h.invoke()).statusCode, 400);
    assert.deepEqual(h.warnings, [["Address verification evidence cleanup deferred"]]);
  }));
});
