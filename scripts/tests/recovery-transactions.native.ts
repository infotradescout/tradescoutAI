import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mkdir, writeFile, readFile, readdir, mkdtemp } from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import dotenv from "dotenv";
import { assertDisposableTestDatabaseUrl } from "../lib/test-db-safety.mjs";
import { eq } from "drizzle-orm";
assert.equal(process.env.NODE_ENV, "test");
assert.equal(process.env.ALLOW_INSECURE_TEST_DATABASE, "true");
const target = assertDisposableTestDatabaseUrl(process.env.TEST_DATABASE_URL);
assert.equal(target.loopback, true, "Native evidence requires a loopback disposable database");
const connection = process.env.TEST_DATABASE_URL!;
for (const key of Object.keys(process.env)) {
  if (
    !/^(path|systemroot|windir|comspec|pathext|temp|tmp|userprofile|appdata|localappdata|programfiles|programfiles\(x86\)|programdata|processor_architecture|number_of_processors)$/i.test(
      key
    )
  )
    delete process.env[key];
}
Object.assign(process.env, {
  NODE_ENV: "test",
  ALLOW_INSECURE_TEST_DATABASE: "true",
  TEST_DATABASE_URL: connection,
  DATABASE_URL: connection,
  TZ: "UTC",
  PRIVATE_UPLOAD_DIR: await mkdtemp(path.join(os.tmpdir(), "tradescout-native-evidence-")),
});
// Keep repository dotenv loading from importing a different target or providers.
dotenv.config = dotenv.configDotenv = () => ({ parsed: {} });
const { db, pool } = await import("../../server/db");
const { users, realtorProfiles, profiles, profileBookingRequests, addressVerifications } =
  await import("../../shared/schema");
const { createProfessionalApplicationPersistence } =
  await import("../../server/storage/repositories/professional-applications");
const { registerAddressVerificationRoutes } =
  await import("../../server/routes/address-verification");
const { NotificationService } = await import("../../server/notification-service");
const identity = (
  await pool.query("select current_database() name,current_setting('TimeZone') timezone")
).rows[0];
assert.equal(identity.name, target.database);
assert.equal(
  identity.timezone,
  "UTC",
  "Configure the disposable database timezone UTC before native timestamp proof"
);
const results: any[] = [];
async function probe(name: string, fn: () => Promise<void>) {
  try {
    await fn();
    results.push({ name, passed: true });
  } catch (error: any) {
    results.push({
      name,
      passed: false,
      error: error.message,
      cause: error.cause?.message,
      code: error.code,
      causeCode: error.cause?.code,
    });
  }
}
async function user() {
  const id = `native-${randomUUID()}`;
  await db.insert(users).values({
    id,
    email: `${id}@tradescout.test`,
    role: "homeowner",
    roles: ["homeowner"],
    addressVerified: false,
  });
  return id;
}
const repository = createProfessionalApplicationPersistence(db);
await probe(
  "actual in-app notification delivery records success and respects disabled preferences",
  async () => {
    const id = await user();
    const service = new NotificationService();
    const delivered = await service.createNotification({
      userId: id,
      type: "new_message",
      title: "Native in-app fixture",
      message: "Local delivery proof",
      deliveryMethods: ["in_app"],
    });
    const delivery = await pool.query(
      "select delivery_method,status,delivered_at is not null as recorded from notification_delivery_log where notification_id=$1",
      [delivered.id]
    );
    assert.deepEqual(delivery.rows, [
      { delivery_method: "in_app", status: "delivered", recorded: true },
    ]);
    assert.equal(
      (
        await pool.query("select sent_at is not null as sent from notifications where id=$1", [
          delivered.id,
        ])
      ).rows[0].sent,
      true
    );
    await pool.query(
      "insert into notification_preferences(user_id,enable_notifications) values($1,false)",
      [id]
    );
    const disabled = await service.createNotification({
      userId: id,
      type: "new_message",
      title: "Disabled fixture",
      message: "Respect preference",
      deliveryMethods: ["in_app"],
    });
    assert.equal(
      (
        await pool.query(
          "select count(*)::int n from notification_delivery_log where notification_id=$1",
          [disabled.id]
        )
      ).rows[0].n,
      0
    );
    assert.equal(
      (await pool.query("select sent_at from notifications where id=$1", [disabled.id])).rows[0]
        .sent_at,
      null
    );
  }
);
function application(userId: string) {
  return {
    userId,
    licenseNumber: "NATIVE-TEST",
    brokerageName: "Local evidence fixture",
    licenseState: "LA",
  };
}
await probe(
  "professional concurrent duplicate submission returns one created and one duplicate",
  async () => {
    const id = await user();
    const attempts = await Promise.allSettled([
      repository.submitRealtorApplication(application(id)),
      repository.submitRealtorApplication(application(id)),
    ]);
    const rejected = attempts.find((x) => x.status === "rejected");
    if (rejected?.status === "rejected") throw rejected.reason;
    assert.deepEqual(attempts.map((x: any) => x.value.outcome).sort(), ["created", "duplicate"]);
    assert.equal(
      (await db.select().from(realtorProfiles).where(eq(realtorProfiles.userId, id))).length,
      1
    );
  }
);
await probe(
  "professional concurrent decisions hold row locks and preserve one durable decision",
  async () => {
    const id = await user(),
      admin = await user();
    const submitted = await repository.submitRealtorApplication(application(id));
    const decision = {
      profileId: submitted.profile.id,
      reviewedBy: admin,
      reviewedAt: new Date(),
      reviewNotes: "Native local evidence",
    };
    const outcomes = await Promise.all([
      repository.decideRealtorApplication({ ...decision, approved: true }),
      repository.decideRealtorApplication({ ...decision, approved: false }),
    ]);
    assert.deepEqual(outcomes.map((x) => x.outcome).sort(), ["already_decided", "decided"]);
    const [profile] = await db.select().from(realtorProfiles).where(eq(realtorProfiles.userId, id));
    const [account] = await db.select().from(users).where(eq(users.id, id));
    assert.equal(account.roles.includes("realtor"), profile.verificationStatus === "approved");
    const count = await pool.query(
      "select count(*)::int n from events where user_id=$1 and event_type='realtor_verification_decision'",
      [id]
    );
    assert.equal(count.rows[0].n, 1);
  }
);
await probe("professional audit failure rolls back its application insert", async () => {
  const id = await user();
  await pool.query(
    `create or replace function integration_evidence_reject_event() returns trigger language plpgsql as $$ begin if NEW.user_id='${id}' then raise exception 'native audit fault'; end if; return NEW; end; $$; create trigger integration_evidence_reject_event before insert on events for each row execute function integration_evidence_reject_event()`
  );
  try {
    await assert.rejects(repository.submitRealtorApplication(application(id)));
    assert.equal(
      (await db.select().from(realtorProfiles).where(eq(realtorProfiles.userId, id))).length,
      0
    );
  } finally {
    await pool.query(
      "drop trigger integration_evidence_reject_event on events; drop function integration_evidence_reject_event()"
    );
  }
});
await probe(
  "booking lineage rejects wrong owner, reparenting and deleting referenced Profile",
  async () => {
    const owner = await user(),
      requester = await user(),
      other = await user();
    const [profile] = await db
      .insert(profiles)
      .values({
        ownerUserId: owner,
        roleContext: "contractor",
        slug: `native-${randomUUID()}`,
        displayName: "Native lineage",
        status: "published",
        publiclyReleased: true,
      })
      .returning();
    await assert.rejects(
      db.insert(profileBookingRequests).values({
        profileId: profile.id,
        lineageKind: "exact_profile",
        ownerUserId: other,
        requesterUserId: requester,
      }),
      (e: any) => e.cause?.code === "23514"
    );
    const [booking] = await db
      .insert(profileBookingRequests)
      .values({
        profileId: profile.id,
        lineageKind: "exact_profile",
        ownerUserId: owner,
        requesterUserId: requester,
      })
      .returning();
    await assert.rejects(
      db
        .update(profileBookingRequests)
        .set({ requesterUserId: other })
        .where(eq(profileBookingRequests.id, booking.id)),
      (e: any) => e.cause?.code === "23514"
    );
    await assert.rejects(
      db.delete(profiles).where(eq(profiles.id, profile.id)),
      (e: any) =>
        ["23001", "23503"].includes(e.cause?.code) &&
        e.cause?.constraint === "profile_booking_requests_profile_id_fk"
    );
    await db
      .update(profileBookingRequests)
      .set({ status: "accepted" })
      .where(eq(profileBookingRequests.id, booking.id));
    assert.equal(
      (
        await db
          .select()
          .from(profileBookingRequests)
          .where(eq(profileBookingRequests.id, booking.id))
      )[0].status,
      "accepted"
    );
  }
);
const handlers = new Map<string, any>();
const app: any = {};
for (const method of ["post", "put", "get"])
  app[method] = (url: string, ...fns: any[]) => handlers.set(`${method} ${url}`, fns.at(-1));
registerAddressVerificationRoutes(app);
async function invoke(key: string, req: any) {
  const output: any = { status: 200 };
  const res = {
    status(code: number) {
      output.status = code;
      return this;
    },
    json(body: any) {
      output.body = body;
      return this;
    },
  };
  await handlers.get(key)(req, res);
  return output;
}
await probe(
  "address concurrent submissions and review use native locks with immutable local evidence",
  async () => {
    const id = await user(),
      admin = await user(),
      uploadId = randomUUID();
    const uploadRoot = process.env.PRIVATE_UPLOAD_DIR!;
    await mkdir(path.join(uploadRoot, id), { recursive: true });
    await writeFile(path.join(uploadRoot, id, uploadId), "%PDF-1.7\nnative original document");
    const body = {
      fullAddress: "123 Native Fixture Street",
      city: "Hammond",
      state: "LA",
      zipCode: "70401",
      verificationMethod: "utility_bill",
      documentType: "application/pdf",
      documentUrl: `private/${id}/${uploadId}`,
    };
    const submissions = await Promise.all([
      invoke("post /api/address-verification", { user: { id }, body }),
      invoke("post /api/address-verification", { user: { id }, body }),
    ]);
    assert.deepEqual(submissions.map((x) => x.status).sort(), [201, 409]);
    const rows = await db
      .select()
      .from(addressVerifications)
      .where(eq(addressVerifications.userId, id));
    assert.equal(rows.length, 1);
    const verification = rows[0];
    assert.match(verification.documentUrl, new RegExp(`^private/address-evidence/${id}/`));
    const evidenceFile = path.join(
      uploadRoot,
      "address-evidence",
      id,
      verification.documentUrl.split("/").at(-1)
    );
    await writeFile(path.join(uploadRoot, id, uploadId), "%PDF-1.7\nchanged source document");
    assert.equal(await readFile(evidenceFile, "utf8"), "%PDF-1.7\nnative original document");
    assert.equal((await readdir(path.dirname(evidenceFile))).length, 1);
    const reviewBody = {
      status: "approved",
      adminNotes: "Native evidence checked",
      expectedUpdatedAt: verification.updatedAt.toISOString(),
    };
    const reviews = await Promise.all([
      invoke("put /api/admin/address-verifications/:id", {
        user: { id: admin },
        params: { id: verification.id },
        body: reviewBody,
      }),
      invoke("put /api/admin/address-verifications/:id", {
        user: { id: admin },
        params: { id: verification.id },
        body: reviewBody,
      }),
    ]);
    assert.deepEqual(reviews.map((x) => x.status).sort(), [200, 409]);
    assert.equal((await db.select().from(users).where(eq(users.id, id)))[0].addressVerified, true);
  }
);
console.log(
  JSON.stringify(
    {
      target: new URL(process.env.TEST_DATABASE_URL!).pathname,
      scope:
        "real repositories and registered handlers with PostgreSQL and local filesystem; handler middleware/auth and remote storage excluded",
      results,
    },
    null,
    2
  )
);
await pool.end();
process.exitCode = results.some((x) => !x.passed) ? 1 : 0;
