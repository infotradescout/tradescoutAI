import fs from "node:fs";
import ts from "typescript";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  addressVerificationReviewSchema,
  addressVerificationSubmissionSchema,
} from "../../shared/schema";
import { isOwnedPrivateObjectKey } from "../services/businessVerificationWorkflow";
import { isAddressVerificationEvidenceKey } from "../services/addressVerificationEvidence";

// Execute the registered handlers with a controlled database/storage boundary.
// These assertions do not prove PostgreSQL locking or live object delivery.
const source = ts.createSourceFile(
  "routes.ts",
  fs.readFileSync("server/routes.ts", "utf8"),
  ts.ScriptTarget.Latest,
  true
);
const registrations = new Map<string, { handler: string; middleware: string[] }>();
function visit(node: ts.Node) {
  if (
    ts.isCallExpression(node) &&
    /^app\.(get|post|put)$/.test(node.expression.getText(source)) &&
    ts.isStringLiteral(node.arguments[0]) &&
    /\/api\/(admin\/)?address-verification/.test(node.arguments[0].text)
  ) {
    registrations.set(`${node.expression.getText(source).slice(4)} ${node.arguments[0].text}`, {
      handler: node.arguments.at(-1)!.getText(source),
      middleware: node.arguments.slice(1, -1).map((item) => item.getText(source)),
    });
  }
  ts.forEachChild(node, visit);
}
visit(source);
const uploadKey = "private/member-1/123e4567-e89b-12d3-a456-426614174000";
const evidenceKey = "private/address-evidence/member-1/123e4567-e89b-12d3-a456-426614174001";
const payload = {
  fullAddress: "123 Main Street",
  city: "Hammond",
  state: "la",
  zipCode: "70401",
  verificationMethod: "utility_bill",
  documentUrl: uploadKey,
  documentType: "application/pdf",
};
const createdAt = new Date("2026-08-25T12:00:00.000Z");
const updatedAt = new Date("2026-09-01T12:00:00.000Z");
const member = { id: "member-1", addressVerified: false, createdAt, updatedAt };
const record = {
  ...payload,
  documentUrl: evidenceKey,
  id: "verification-1",
  userId: member.id,
  state: "LA",
  status: "submitted",
  createdAt,
  updatedAt,
  deadline: new Date("2026-09-08T12:00:00.000Z"),
};
const table = (name: string) =>
  new Proxy(
    { name },
    { get: (target, key) => (key === "name" ? target.name : `${name}.${String(key)}`) }
  );
const users = table("users");
const addressVerifications = table("verifications");
const eq = (column: string, value: unknown) => (row: any) => row[column.split(".")[1]] === value;
const and =
  (...predicates: any[]) =>
  (row: any) =>
    predicates.every((predicate) => predicate(row));

function harness(initial: any[] = [], verified = false) {
  let data: Record<string, any[]> = {
    users: [{ ...member, addressVerified: verified }],
    verifications: structuredClone(initial),
  };
  const events: string[] = [];
  let failUserWrite = false;
  function query(operation = "select", initialTable?: any) {
    let target = initialTable?.name;
    let condition = (_row: any) => true;
    let values: any;
    let order: string | undefined;
    let limit = Infinity;
    const builder: any = {
      from(t: any) {
        target = t.name;
        return builder;
      },
      where(predicate: any) {
        condition = predicate;
        return builder;
      },
      orderBy(column: string) {
        order = column.split(".")[1];
        return builder;
      },
      limit(value: number) {
        limit = value;
        return builder;
      },
      for(mode: string) {
        events.push(`lock:${target}:${mode}`);
        return builder;
      },
      values(value: any) {
        values = value;
        return builder;
      },
      set(value: any) {
        values = value;
        return builder;
      },
      returning() {
        return builder;
      },
      then(resolve: any, reject: any) {
        return Promise.resolve()
          .then(() => {
            if (operation === "insert") {
              events.push(`write:${target}`);
              const row = {
                id: "new-verification",
                createdAt: new Date(),
                updatedAt: new Date(),
                ...values,
              };
              data[target].push(row);
              return [structuredClone(row)];
            }
            let rows = data[target].filter(condition);
            if (order)
              rows = [...rows].sort(
                (a, b) => new Date(b[order!]).getTime() - new Date(a[order!]).getTime()
              );
            rows = rows.slice(0, limit);
            if (operation === "update") {
              events.push(`write:${target}`);
              if (target === "users" && failUserWrite)
                throw new Error("Injected account write failure");
              for (const row of rows) Object.assign(row, values);
            }
            return structuredClone(rows);
          })
          .then(resolve, reject);
      },
    };
    return builder;
  }
  const db: any = {
    select: () => query(),
    insert: (t: any) => query("insert", t),
    update: (t: any) => query("update", t),
    transaction: vi.fn(async (callback: any) => {
      const before = structuredClone(data);
      try {
        return await callback(db);
      } catch (error) {
        data = before;
        events.push("rollback");
        throw error;
      }
    }),
  };
  const storage = {
    getUser: vi.fn(async (id) => structuredClone(data.users.find((item) => item.id === id))),
    getAddressVerificationByUserId: vi.fn(async (id) =>
      structuredClone(
        data.verifications
          .filter((item) => item.userId === id)
          .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())[0]
      )
    ),
    sendAddressVerificationPostcard: vi.fn(),
    verifyAddressWithPostcard: vi.fn(),
  };
  const snapshot = vi.fn(async () => evidenceKey);
  const assertEvidence = vi.fn(async () => undefined);
  const download = vi.fn(async () => ({ filePath: "/controlled/private/evidence.pdf" }));
  async function call(route: string, body: any = payload, options: any = {}) {
    const registration = registrations.get(route);
    if (!registration) throw new Error(`Missing route ${route}`);
    const compiled = ts.transpileModule(`const handler = ${registration.handler};`, {
      compilerOptions: { target: ts.ScriptTarget.ES2022 },
    }).outputText;
    const dependencies = {
      db,
      storage,
      users,
      addressVerifications,
      eq,
      and,
      desc: (field: string) => field,
      addressVerificationReviewSchema,
      addressVerificationSubmissionSchema,
      isOwnedPrivateObjectKey,
      isAddressVerificationEvidenceKey,
      snapshotAddressVerificationEvidence: snapshot,
      assertAddressVerificationEvidence: assertEvidence,
      getAddressVerificationEvidenceDownload: download,
    };
    const handler = new Function(...Object.keys(dependencies), `${compiled}; return handler;`)(
      ...Object.values(dependencies)
    );
    const response: any = {
      statusCode: 200,
      body: undefined,
      status(value: number) {
        this.statusCode = value;
        return this;
      },
      json(value: unknown) {
        this.body = value;
        return this;
      },
      setHeader: vi.fn(),
      download: vi.fn(),
      redirect: vi.fn(),
    };
    await handler({ user: member, params: { id: record.id }, body, ...options }, response);
    return response;
  }
  return {
    call,
    db,
    storage,
    snapshot,
    assertEvidence,
    download,
    events,
    data: () => data,
    failUserWrite: () => {
      failUserWrite = true;
    },
  };
}

describe("address verification submission and review", () => {
  beforeEach(() => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });
  it("registers every member route behind authentication and every admin route behind both guards", () => {
    expect(registrations.size).toBe(8);
    for (const [route, registration] of registrations) {
      expect(registration.middleware).toEqual(
        route.includes("/admin/") ? ["isAuthenticated", "isAdmin"] : ["isAuthenticated"]
      );
    }
  });
  it("accepts the form payload and stores a server-owned evidence copy, deadline, and submitted state", async () => {
    const h = harness();
    const res = await h.call("post /api/address-verification");
    expect(res.statusCode).toBe(201);
    expect(h.snapshot).toHaveBeenCalledWith(uploadKey, member.id, "application/pdf");
    expect(h.data().verifications[0]).toMatchObject({
      userId: member.id,
      state: "LA",
      status: "submitted",
      documentUrl: evidenceKey,
      deadline: new Date("2026-09-08T12:00:00.000Z"),
    });
    expect(h.data().users[0].addressVerified).toBe(false);
    expect(res.body).toEqual({ id: "new-verification", status: "submitted" });
    expect(h.events.slice(0, 2)).toEqual(["lock:users:update", "lock:verifications:update"]);
  });
  it.each([
    "userId",
    "status",
    "deadline",
    "reviewedBy",
    "approvedAt",
    "addressValidated",
    "postcardCode",
    "phoneVerificationCode",
  ])("rejects member control of %s on create and update", async (field) => {
    for (const route of ["post /api/address-verification", "put /api/address-verification/:id"]) {
      const h = harness([record]);
      const res = await h.call(route, { ...payload, [field]: "attacker-value" });
      expect(res.statusCode).toBe(400);
      expect(h.db.transaction).not.toHaveBeenCalled();
    }
  });
  it.each([
    "https://public.test/file.pdf",
    uploadKey.replace("member-1", "member-2"),
    "private/member-1/../../secret",
  ])("rejects a document outside the upload owner's boundary: %s", async (documentUrl) => {
    const h = harness();
    expect(
      (await h.call("post /api/address-verification", { ...payload, documentUrl })).statusCode
    ).toBe(400);
    expect(h.snapshot).not.toHaveBeenCalled();
  });
  it("rejects missing or unreadable uploaded bytes without creating a submission", async () => {
    const h = harness();
    h.snapshot.mockRejectedValue(new Error("Document not found"));
    expect((await h.call("post /api/address-verification")).statusCode).toBe(400);
    expect(h.data().verifications).toEqual([]);
  });
  it("does not create duplicates or replace an approved address", async () => {
    const existing = harness([record]);
    expect((await existing.call("post /api/address-verification")).statusCode).toBe(409);
    const approved = harness([{ ...record, status: "approved" }], true);
    expect((await approved.call("put /api/address-verification/:id")).statusCode).toBe(409);
    expect(approved.snapshot).not.toHaveBeenCalled();
  });
  it("resubmits only the owner's current record and clears stale review/code fields", async () => {
    const h = harness([
      {
        ...record,
        status: "rejected",
        postcardCode: "123456",
        adminNotes: "Internal",
        rejectionReason: "Old reason",
      },
    ]);
    expect(
      (await h.call("put /api/address-verification/:id", payload, { params: { id: "other" } }))
        .statusCode
    ).toBe(403);
    expect((await h.call("put /api/address-verification/:id")).statusCode).toBe(200);
    expect(h.data().verifications[0]).toMatchObject({
      userId: member.id,
      deadline: record.deadline,
      status: "submitted",
      documentUrl: evidenceKey,
      postcardCode: null,
      rejectionReason: null,
      adminNotes: null,
    });
  });
  it.each(["postcard", "phone_verification"])(
    "reports %s unavailable without a storage mutation",
    async (verificationMethod) => {
      const h = harness();
      expect(
        (await h.call("post /api/address-verification", { ...payload, verificationMethod }))
          .statusCode
      ).toBe(503);
      expect(
        (await h.call("put /api/address-verification/:id", { ...payload, verificationMethod }))
          .statusCode
      ).toBe(503);
      expect(h.db.transaction).not.toHaveBeenCalled();
    }
  );
  it("cannot issue or redeem the legacy simulated postcard codes", async () => {
    const h = harness([{ ...record, postcardCode: "123456" }]);
    for (const route of [
      "post /api/address-verification/postcard/request",
      "post /api/address-verification/postcard/verify",
    ]) {
      const res = await h.call(route, { code: "123456" });
      expect(res.statusCode).toBe(503);
      expect(res.body.code).toBe("ADDRESS_VERIFICATION_METHOD_UNAVAILABLE");
    }
    expect(h.storage.sendAddressVerificationPostcard).not.toHaveBeenCalled();
    expect(h.storage.verifyAddressWithPostcard).not.toHaveBeenCalled();
  });
  it("returns only the member's status fields without codes, private keys, or internal notes", async () => {
    const h = harness([
      {
        ...record,
        postcardCode: "123456",
        phoneVerificationCode: "654321",
        adminNotes: "Internal",
        rejectionReason: "Please show your name",
      },
    ]);
    const res = await h.call("get /api/address-verification/status");
    expect(res.body.verification).toMatchObject({
      id: record.id,
      hasDocument: true,
      rejectionReason: "Please show your name",
    });
    for (const key of [
      "postcardCode",
      "phoneVerificationCode",
      "adminNotes",
      "documentUrl",
      "userId",
    ])
      expect(res.body.verification).not.toHaveProperty(key);
    expect(res.setHeader).toHaveBeenCalledWith("Cache-Control", "private, no-store");
  });
  const approval = { status: "approved", expectedUpdatedAt: updatedAt.toISOString() };
  it("approves only the current saved evidence and changes the account in the same transaction", async () => {
    const h = harness([record]);
    const res = await h.call("put /api/admin/address-verifications/:id", approval, {
      user: { id: "admin-1" },
    });
    expect(res.statusCode).toBe(200);
    expect(h.assertEvidence).toHaveBeenCalledWith(evidenceKey, member.id, "application/pdf");
    expect(h.data().users[0].addressVerified).toBe(true);
    expect(h.data().verifications[0]).toMatchObject({ status: "approved", reviewedBy: "admin-1" });
    expect(h.events).toEqual([
      "lock:users:update",
      "lock:verifications:update",
      "write:verifications",
      "write:users",
    ]);
  });
  it("rolls back the approval when the account write fails", async () => {
    const h = harness([record]);
    h.failUserWrite();
    expect((await h.call("put /api/admin/address-verifications/:id", approval)).statusCode).toBe(
      400
    );
    expect(h.data().verifications[0].status).toBe("submitted");
    expect(h.data().users[0].addressVerified).toBe(false);
    expect(h.events).toContain("rollback");
  });
  it("rejects stale reviews and missing saved evidence without approving", async () => {
    const h = harness([record]);
    expect(
      (
        await h.call("put /api/admin/address-verifications/:id", {
          ...approval,
          expectedUpdatedAt: createdAt.toISOString(),
        })
      ).statusCode
    ).toBe(409);
    expect(h.assertEvidence).not.toHaveBeenCalled();
    h.assertEvidence.mockRejectedValue(new Error("Missing evidence"));
    expect((await h.call("put /api/admin/address-verifications/:id", approval)).statusCode).toBe(
      400
    );
    expect(h.data().users[0].addressVerified).toBe(false);
  });
  it.each([null, uploadKey])(
    "cannot approve absent or mutable legacy evidence",
    async (documentUrl) => {
      const h = harness([{ ...record, documentUrl }]);
      expect((await h.call("put /api/admin/address-verifications/:id", approval)).statusCode).toBe(
        409
      );
      expect(h.data().users[0].addressVerified).toBe(false);
    }
  );
  it.each(["approved", "rejected"])(
    "cannot %s a superseded legacy row or change its account flag",
    async (status) => {
      const h = harness(
        [
          { ...record, status: "approved" },
          {
            ...record,
            id: "newer",
            status: "approved",
            createdAt: new Date("2026-09-05T00:00:00Z"),
          },
        ],
        true
      );
      expect(
        (
          await h.call("put /api/admin/address-verifications/:id", {
            ...approval,
            status,
            rejectionReason: "Old proof",
          })
        ).statusCode
      ).toBe(409);
      expect(h.data().users[0].addressVerified).toBe(true);
      expect(h.events.some((event) => event.startsWith("write:"))).toBe(false);
    }
  );
  it("requires a public rejection reason and preserves an unrelated manual address flag", async () => {
    const h = harness([record], true);
    expect(
      (
        await h.call("put /api/admin/address-verifications/:id", {
          ...approval,
          status: "rejected",
        })
      ).statusCode
    ).toBe(400);
    expect(
      (
        await h.call("put /api/admin/address-verifications/:id", {
          ...approval,
          status: "rejected",
          rejectionReason: "Show your current address",
          adminNotes: "Private review detail",
        })
      ).statusCode
    ).toBe(200);
    expect(h.data().users[0].addressVerified).toBe(true);
    expect(h.data().verifications[0].rejectionReason).toBe("Show your current address");
  });
  it("downloads only saved evidence through the admin endpoint with attachment and no cache", async () => {
    const h = harness([record]);
    const res = await h.call("get /api/admin/address-verifications/:id/document");
    expect(h.download).toHaveBeenCalledWith(
      evidenceKey,
      member.id,
      "application/pdf",
      "address-verification-document.pdf"
    );
    expect(res.download).toHaveBeenCalledWith(
      "/controlled/private/evidence.pdf",
      "address-verification-document.pdf"
    );
    expect(res.setHeader).toHaveBeenCalledWith("Cache-Control", "private, no-store");
    const foreign = harness([
      { ...record, documentUrl: evidenceKey.replace("member-1", "member-2") },
    ]);
    expect(
      (await foreign.call("get /api/admin/address-verifications/:id/document")).statusCode
    ).toBe(404);
    expect(foreign.download).not.toHaveBeenCalled();
  });
});
