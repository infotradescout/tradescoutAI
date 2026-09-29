import { and, desc, eq, gt, inArray, sql } from "drizzle-orm";
import {
  businessPresenceCustomerTasks as tasks,
  businessPresencePlans as plans,
  businessPresenceTaskRuntime as runtime,
  notificationPreferences,
  notifications,
} from "@shared/schema";
import { PresencePlanError } from "./presencePlanService";
import {
  allowsPresenceInAppReminder,
  lockLivePlan,
  nextPresenceReminderAt,
  recordTaskFailure,
} from "./presenceCustomerTasks";
import { getCurrentPresenceFactSummary } from "./presenceFactReview";

type Task = typeof tasks.$inferSelect;
type Plan = typeof plans.$inferSelect;
type FactSummary = Awaited<ReturnType<typeof getCurrentPresenceFactSummary>>;

const KIND = "confirm_facts";
const RUNTIME_ID = "confirm_facts";
const DAY = 24 * 60 * 60 * 1000;

function nextAt(firstWaitAt: Date, lastReminderAt: Date | null, reminderCount: number, now: Date) {
  const cadence = nextPresenceReminderAt(firstWaitAt, lastReminderAt, reminderCount);
  return cadence ? new Date(Math.max(cadence.getTime(), now.getTime() + DAY)) : null;
}

function currentTaskPlan(task: Task, plan: Plan): boolean {
  return (
    task.kind === KIND &&
    task.planId === plan.id &&
    task.ownerUserId === plan.ownerUserId &&
    task.businessId === plan.businessId &&
    task.profileId === plan.profileId &&
    task.evidenceDigest === plan.evidenceDigest &&
    task.planHash === plan.planHash &&
    task.revision === plan.revision
  );
}

function needsCustomerReview(summary: FactSummary | null): boolean {
  return Boolean(summary && summary.reviewableCount > 0 && summary.unresolvedCount > 0);
}

async function currentSummary(tx: any, plan: Plan, live: unknown): Promise<FactSummary | null> {
  if (!live) return null;
  try {
    return await getCurrentPresenceFactSummary(tx, plan);
  } catch (error) {
    if (
      error instanceof PresencePlanError &&
      ["PRESENCE_PLAN_STALE", "PRESENCE_OWNERSHIP_MISMATCH", "PRESENCE_IDENTITY_CONFLICT"].includes(
        error.code
      )
    )
      return null;
    throw error;
  }
}

async function archiveFactReminders(tx: any, taskIds: string[], now: Date): Promise<void> {
  if (!taskIds.length) return;
  await tx
    .update(notifications)
    .set({ isArchived: true, archivedAt: now, updatedAt: now })
    .where(
      and(
        inArray(
          notifications.groupId,
          taskIds.map((id) => `presence-facts:${id}`)
        ),
        eq(notifications.isArchived, false)
      )
    );
}

async function markFactReconciled(tx: any, plan: Plan): Promise<void> {
  if (
    plan.factTaskReconciledRevision === plan.revision &&
    plan.factTaskReconciledEpoch === plan.factReviewEpoch
  )
    return;
  await tx
    .update(plans)
    .set({
      factTaskReconciledRevision: plan.revision,
      factTaskReconciledEpoch: plan.factReviewEpoch,
    })
    .where(eq(plans.id, plan.id));
}

export function presenceFactReminderPayload(
  task: Pick<Task, "id" | "ownerUserId" | "planHash" | "reminderCount">
) {
  const cycle = task.reminderCount + 1;
  return {
    id: `presence-facts:${task.id}:${cycle}`,
    userId: task.ownerUserId,
    type: "reminder" as const,
    title: "Review your business details in TradeScout",
    message: "A review is waiting for you",
    actionUrl: "/presence/review?section=facts",
    actionText: "Review details",
    deliveryMethods: ["in_app"],
    groupId: `presence-facts:${task.id}`,
    metadata: {
      presenceTaskId: task.id,
      taskKind: KIND,
      planHash: task.planHash,
      reminderCycle: cycle,
    },
  };
}

/** A post-commit nudge; the bounded scheduler also repairs missed calls. */
export async function reconcilePresenceFactTask(planId: string, now = new Date()): Promise<void> {
  const { db } = await import("../db");
  const [candidate] = await db.select().from(plans).where(eq(plans.id, planId)).limit(1);
  if (!candidate) return;
  await db.transaction(async (tx: any) => {
    const locked = await lockLivePlan(tx, candidate);
    const plan = locked.plan;
    if (!plan) return;
    const summary = locked.ownershipValid ? await currentSummary(tx, plan, locked.live) : null;
    const pending = needsCustomerReview(summary);

    // Retire older plan/profile/owner versions, including capped task rows.
    const priorVersions = await tx
      .select({ id: tasks.id })
      .from(tasks)
      .where(
        and(
          eq(tasks.planId, plan.id),
          eq(tasks.kind, KIND),
          inArray(tasks.status, ["waiting_customer", "retrying", "terminal_attention"]),
          sql`(${tasks.ownerUserId} <> ${plan.ownerUserId}
        OR ${tasks.businessId} <> ${plan.businessId}
        OR ${tasks.profileId} <> ${plan.profileId}
        OR ${tasks.planHash} <> ${plan.planHash}
        OR ${tasks.evidenceDigest} <> ${plan.evidenceDigest}
        OR ${tasks.revision} <> ${plan.revision})`
        )
      )
      .for("update");
    if (priorVersions.length) {
      const ids = priorVersions.map((task: { id: string }) => task.id);
      await tx
        .update(tasks)
        .set({
          status: locked.ownershipValid ? "stale" : "suppressed",
          nextReminderAt: null,
          retryAt: null,
          updatedAt: now,
        })
        .where(inArray(tasks.id, ids));
      await archiveFactReminders(tx, ids, now);
    }

    const familyWhere = and(
      eq(tasks.ownerUserId, plan.ownerUserId),
      eq(tasks.businessId, plan.businessId),
      eq(tasks.profileId, plan.profileId),
      eq(tasks.kind, KIND)
    );
    const [latest] = await tx
      .select()
      .from(tasks)
      .where(familyWhere)
      .orderBy(desc(tasks.createdAt), desc(tasks.id))
      .limit(1)
      .for("update");
    const [same] = await tx
      .select()
      .from(tasks)
      .where(
        and(
          familyWhere,
          eq(tasks.planId, plan.id),
          eq(tasks.planHash, plan.planHash),
          eq(tasks.revision, plan.revision),
          eq(tasks.evidenceDigest, plan.evidenceDigest)
        )
      )
      .limit(1)
      .for("update");

    if (!pending) {
      if (same) {
        await tx
          .update(tasks)
          .set({
            status: summary ? "resolved" : locked.ownershipValid ? "stale" : "suppressed",
            nextReminderAt: null,
            retryAt: null,
            updatedAt: now,
          })
          .where(eq(tasks.id, same.id));
        await archiveFactReminders(tx, [same.id], now);
      }
      await markFactReconciled(tx, plan);
      return;
    }

    if (same) {
      if (["resolved", "stale", "suppressed"].includes(same.status)) {
        await tx
          .update(tasks)
          .set({
            status: "waiting_customer",
            nextReminderAt: nextAt(same.firstWaitAt, same.lastReminderAt, same.reminderCount, now),
            retryAt: null,
            updatedAt: now,
          })
          .where(eq(tasks.id, same.id));
      }
      await markFactReconciled(tx, plan);
      return;
    }

    const firstWaitAt = latest?.firstWaitAt ?? now;
    const reminderCount = latest?.reminderCount ?? 0;
    const lastReminderAt = latest?.lastReminderAt ?? null;
    await tx
      .insert(tasks)
      .values({
        ownerUserId: plan.ownerUserId,
        businessId: plan.businessId,
        profileId: plan.profileId,
        planId: plan.id,
        planHash: plan.planHash,
        evidenceDigest: plan.evidenceDigest,
        revision: plan.revision,
        kind: KIND,
        status: "waiting_customer",
        firstWaitAt,
        reminderCount,
        lastReminderAt,
        nextReminderAt: nextAt(firstWaitAt, lastReminderAt, reminderCount, now),
      })
      .onConflictDoNothing({
        target: [
          tasks.ownerUserId,
          tasks.businessId,
          tasks.profileId,
          tasks.planHash,
          tasks.revision,
          tasks.kind,
        ],
      });
    await markFactReconciled(tx, plan);
  });
}

function collisionMatches(
  existing: typeof notifications.$inferSelect,
  payload: ReturnType<typeof presenceFactReminderPayload>
): boolean {
  return (
    existing.userId === payload.userId &&
    existing.type === "reminder" &&
    existing.actionUrl === payload.actionUrl &&
    existing.groupId === payload.groupId &&
    existing.metadata?.presenceTaskId === payload.metadata.presenceTaskId &&
    existing.metadata?.taskKind === payload.metadata.taskKind &&
    existing.metadata?.planHash === payload.metadata.planHash &&
    existing.metadata?.reminderCycle === payload.metadata.reminderCycle &&
    JSON.stringify(existing.deliveryMethods) === JSON.stringify(["in_app"])
  );
}

/** Server scheduler only; no customer route sends reminders. */
export async function processDuePresenceFactTask(
  taskId: string,
  now = new Date(),
  authority?: { isImpersonating?: boolean }
): Promise<"sent" | "skipped"> {
  if (authority?.isImpersonating) throw new Error("Impersonation cannot run Presence tasks");
  const { db } = await import("../db");
  const [candidate] = await db
    .select()
    .from(tasks)
    .where(and(eq(tasks.id, taskId), eq(tasks.kind, KIND)))
    .limit(1);
  if (!candidate) return "skipped";
  const [planCandidate] = await db
    .select()
    .from(plans)
    .where(eq(plans.id, candidate.planId))
    .limit(1);
  if (!planCandidate) return "skipped";
  try {
    return await db.transaction(async (tx: any): Promise<"sent" | "skipped"> => {
      const locked = await lockLivePlan(tx, planCandidate);
      const plan = locked.plan;
      if (!plan) return "skipped";
      const [task] = await tx
        .select()
        .from(tasks)
        .where(eq(tasks.id, taskId))
        .limit(1)
        .for("update", { skipLocked: true });
      if (!task || task.kind !== KIND || !["waiting_customer", "retrying"].includes(task.status))
        return "skipped";
      const summary = locked.ownershipValid ? await currentSummary(tx, plan, locked.live) : null;
      if (!locked.ownershipValid || !currentTaskPlan(task, plan) || !needsCustomerReview(summary)) {
        await tx
          .update(tasks)
          .set({
            status: !locked.ownershipValid
              ? "suppressed"
              : summary && !needsCustomerReview(summary)
                ? "resolved"
                : "stale",
            nextReminderAt: null,
            retryAt: null,
            updatedAt: now,
          })
          .where(eq(tasks.id, taskId));
        await archiveFactReminders(tx, [taskId], now);
        return "skipped";
      }
      const due = task.status === "retrying" ? task.retryAt : task.nextReminderAt;
      if (!due || due > now || task.reminderCount >= 3) return "skipped";
      const [preference] = await tx
        .select()
        .from(notificationPreferences)
        .where(eq(notificationPreferences.userId, task.ownerUserId))
        .limit(1)
        .for("share");
      if (!allowsPresenceInAppReminder(preference ?? null)) {
        await tx
          .update(tasks)
          .set({
            status: "waiting_customer",
            retryAt: null,
            nextReminderAt: new Date(now.getTime() + 7 * DAY),
            updatedAt: now,
          })
          .where(eq(tasks.id, taskId));
        return "skipped";
      }
      const payload = presenceFactReminderPayload(task);
      const [inserted] = await tx
        .insert(notifications)
        .values({
          ...payload,
          sentAt: now,
          deliveredAt: now,
        })
        .onConflictDoNothing({ target: notifications.id })
        .returning();
      if (!inserted) {
        const [existing] = await tx
          .select()
          .from(notifications)
          .where(eq(notifications.id, payload.id))
          .limit(1)
          .for("update");
        if (!existing || !collisionMatches(existing, payload)) {
          throw Object.assign(new Error("Presence fact notification identity conflict"), {
            code: "PRESENCE_FACT_NOTIFICATION_IDENTITY_CONFLICT",
          });
        }
      }
      const reminderCount = task.reminderCount + 1;
      await tx
        .update(tasks)
        .set({
          status: "waiting_customer",
          reminderCount,
          lastReminderAt: now,
          nextReminderAt: nextPresenceReminderAt(task.firstWaitAt, now, reminderCount),
          failureCount: 0,
          retryAt: null,
          lastErrorCode: null,
          updatedAt: now,
        })
        .where(eq(tasks.id, taskId));
      return inserted ? "sent" : "skipped";
    });
  } catch (error) {
    try {
      await recordTaskFailure(taskId, error, now);
    } catch (recordError) {
      console.error("[presence.fact-task] retry record failed", recordError);
      throw error;
    }
    return "skipped";
  }
}

/** Prioritize decision-epoch mismatches, then audit every plan by keyset. */
export async function sweepPresenceFactPlans(
  now: Date
): Promise<{ scanned: number; failed: number }> {
  const { db } = await import("../db");
  const [state] = await db.select().from(runtime).where(eq(runtime.id, RUNTIME_ID)).limit(1);
  if (!state) throw new Error("Presence fact task runtime migration missing");
  const pending = sql<boolean>`(${plans.factTaskReconciledRevision} IS DISTINCT FROM ${plans.revision}
    OR ${plans.factTaskReconciledEpoch} IS DISTINCT FROM ${plans.factReviewEpoch})`;
  const audited = sql<boolean>`(${plans.factTaskReconciledRevision} IS NOT DISTINCT FROM ${plans.revision}
    AND ${plans.factTaskReconciledEpoch} IS NOT DISTINCT FROM ${plans.factReviewEpoch})`;
  let priorityPage = await db
    .select({ id: plans.id })
    .from(plans)
    .where(and(pending, state.pendingCursor ? gt(plans.id, state.pendingCursor) : undefined))
    .orderBy(plans.id)
    .limit(200);
  if (!priorityPage.length && state.pendingCursor) {
    priorityPage = await db
      .select({ id: plans.id })
      .from(plans)
      .where(pending)
      .orderBy(plans.id)
      .limit(200);
  }
  let auditPage = await db
    .select({ id: plans.id })
    .from(plans)
    .where(and(audited, state.sweepCursor ? gt(plans.id, state.sweepCursor) : undefined))
    .orderBy(plans.id)
    .limit(1000);
  if (!auditPage.length && state.sweepCursor) {
    auditPage = await db
      .select({ id: plans.id })
      .from(plans)
      .where(audited)
      .orderBy(plans.id)
      .limit(1000);
  }
  let failed = 0;
  const ids = [...new Set([...priorityPage, ...auditPage].map((plan) => plan.id))];
  for (const id of ids) {
    try {
      await reconcilePresenceFactTask(id, now);
    } catch (error) {
      failed++;
      console.error("[presence.fact-task] sweep plan failed", { planId: id, error });
    }
  }
  await db
    .update(runtime)
    .set({
      pendingCursor: priorityPage.at(-1)?.id ?? null,
      sweepCursor: auditPage.at(-1)?.id ?? null,
    })
    .where(eq(runtime.id, RUNTIME_ID));
  return { scanned: ids.length, failed };
}
