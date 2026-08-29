import { sql } from "drizzle-orm";
import { jsonb, pgTable, timestamp, varchar } from "drizzle-orm/pg-core";

/**
 * Canonical database contract for append-only work-request event types.
 *
 * Keep this list in lockstep with the active work_request_events check
 * constraint. Runtime writers must import the table from shared/schema rather
 * than widening the database vocabulary with unchecked string casts.
 */
export const WORK_REQUEST_EVENT_TYPES = [
  "created",
  "updated",
  "sent_to_board",
  "routed",
  "status_changed",
  "exposure_mode_changed",
  "provider_suggested",
  "provider_invited",
  "provider_self_selected",
  "provider_accepted",
  "provider_declined",
  "provider_completed",
  "completed",
  "cancelled",
  "asset_linked",
  "homeid_draft_created",
  "homeid_draft_reviewed",
  "homeid_draft_submitted",
] as const;

export type WorkRequestEventType = (typeof WORK_REQUEST_EVENT_TYPES)[number];

export const workRequestEvents = pgTable("work_request_events", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  workRequestId: varchar("work_request_id").notNull(),
  type: varchar("type", { enum: WORK_REQUEST_EVENT_TYPES }).notNull(),
  actorUserId: varchar("actor_user_id"),
  fromStatus: varchar("from_status"),
  toStatus: varchar("to_status"),
  metadata: jsonb("metadata").$type<Record<string, any>>(),
  createdAt: timestamp("created_at").defaultNow(),
});
