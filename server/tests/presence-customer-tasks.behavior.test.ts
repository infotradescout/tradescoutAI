import assert from "node:assert/strict";
import test from "node:test";
import {
  allowsPresenceInAppReminder,
  nextPresenceReminderAt,
  presenceReminderPayload,
  runPresenceCustomerTaskTick,
} from "../services/presenceCustomerTasks";
import { presenceFactReminderPayload } from "../services/presenceFactCustomerTasks";

test("Presence reminder cadence starts after 24 hours, waits seven days, and caps at three", () => {
  const firstWait = new Date("2026-09-01T12:00:00.000Z");
  assert.equal(
    nextPresenceReminderAt(firstWait, null, 0)?.toISOString(),
    "2026-09-02T12:00:00.000Z"
  );
  const firstSent = new Date("2026-09-05T12:00:00.000Z");
  assert.equal(
    nextPresenceReminderAt(firstWait, firstSent, 1)?.toISOString(),
    "2026-09-12T12:00:00.000Z"
  );
  assert.equal(
    nextPresenceReminderAt(firstWait, firstSent, 2)?.toISOString(),
    "2026-09-12T12:00:00.000Z"
  );
  assert.equal(nextPresenceReminderAt(firstWait, firstSent, 3), null);
});

test("Presence reminder respects both global and reminder in-app opt-out", () => {
  assert.equal(allowsPresenceInAppReminder(null), true);
  assert.equal(
    allowsPresenceInAppReminder({ enableNotifications: false, typePreferences: {} }),
    false
  );
  assert.equal(
    allowsPresenceInAppReminder({
      enableNotifications: true,
      typePreferences: { reminder: { enabled: false, delivery_methods: ["in_app"] } },
    }),
    false
  );
  assert.equal(
    allowsPresenceInAppReminder({
      enableNotifications: true,
      typePreferences: { reminder: { enabled: true, delivery_methods: ["email"] } },
    }),
    false
  );
});

test("Presence reminder is generic, same-origin, in-app only, and bound to task cycle", () => {
  const task = {
    id: "task-synthetic",
    ownerUserId: "user-synthetic",
    planHash: "a".repeat(64),
    reminderCount: 1,
  };
  const payload = presenceReminderPayload(task);
  assert.equal(payload.id, "presence-site-path:task-synthetic:2");
  assert.equal(payload.userId, "user-synthetic");
  assert.equal(payload.type, "reminder");
  assert.equal(payload.actionUrl, "/presence/review");
  assert.deepEqual(payload.deliveryMethods, ["in_app"]);
  assert.deepEqual(Object.keys(payload.metadata).sort(), [
    "planHash",
    "presenceTaskId",
    "reminderCycle",
  ]);
  const publicText = `${payload.title} ${payload.message} ${payload.actionText}`;
  assert.equal(/approve|authoriz|publish|complete|business-synthetic/i.test(publicText), false);
});

test("An impersonated scheduler tick is rejected before database access", async () => {
  await assert.rejects(
    runPresenceCustomerTaskTick(new Date("2026-09-29T12:00:00.000Z"), { isImpersonating: true }),
    /Impersonation cannot run Presence tasks/
  );
});

test("Fact-review reminders have an independent cycle and claim-free in-app destination", () => {
  const fact = presenceFactReminderPayload({
    id: "fact-task-synthetic",
    ownerUserId: "user-synthetic",
    planHash: "b".repeat(64),
    reminderCount: 0,
  });
  const site = presenceReminderPayload({
    id: "site-task-synthetic",
    ownerUserId: "user-synthetic",
    planHash: "b".repeat(64),
    reminderCount: 2,
  });
  assert.equal(fact.id, "presence-facts:fact-task-synthetic:1");
  assert.equal(fact.groupId, "presence-facts:fact-task-synthetic");
  assert.equal(fact.metadata.reminderCycle, 1);
  assert.equal(site.metadata.reminderCycle, 3);
  assert.equal(fact.type, "reminder");
  assert.equal(fact.actionUrl, "/presence/review?section=facts");
  assert.deepEqual(fact.deliveryMethods, ["in_app"]);
  assert.equal(
    /approv|reject|verif|publish|complete|synthetic/i.test(
      `${fact.title} ${fact.message} ${fact.actionText}`
    ),
    false
  );
});
