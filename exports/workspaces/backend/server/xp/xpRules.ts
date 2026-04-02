import { EventTypes, type EventType } from "./eventTypes";

export type XpDecision =
  | { grant: 0; reason: string }
  | { grant: number; reason: string };

export type XpContext = {
  dayKeyUtc: string; // normalized “day” in UTC, e.g. "2025-12-27"
};

export type XpRule = {
  base: (eventData: any) => number;
  capKey: (eventData: any) => string;
  applyCap: (baseXp: number, dailyCount: number, eventData: any) => number;
  isAllowed?: (eventData: any) => Promise<boolean> | boolean;
};

function clampInt(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.floor(n));
}

function dayKeyUtc(d: Date): string {
  const yyyy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(d.getUTCDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

export function getDayKeyUtc(date: Date): string {
  return dayKeyUtc(date);
}

function isTruthyId(v: any): boolean {
  return typeof v === "string" && v.length >= 6;
}

export const xpRules: Record<string, XpRule> = {
  [EventTypes.COMMUNITY_VIEWED_SCOPE]: {
    base: () => 2,
    capKey: () => "community.viewed_scope",
    applyCap: (baseXp, dailyCount) => (dailyCount < 10 ? baseXp : 0),
  },

  [EventTypes.POST_CREATED]: {
    base: () => 10,
    capKey: () => "post.created",
    applyCap: (_base, dailyCount) => {
      if (dailyCount < 5) return 10;
      if (dailyCount < 10) return 2;
      return 0;
    },
  },

  [EventTypes.COMMENT_CREATED]: {
    base: () => 5,
    capKey: () => "comment.created",
    applyCap: (_base, dailyCount) => {
      if (dailyCount < 20) return 5;
      if (dailyCount < 50) return 1;
      return 0;
    },
  },

  [EventTypes.CONNECTION_CREATED]: {
    base: () => 10,
    capKey: () => "connection.created",
    applyCap: (_base, dailyCount) => (dailyCount < 5 ? 10 : 0),
  },

  [EventTypes.CONNECTION_CONFIRMED]: {
    base: () => 50,
    capKey: () => "connection.confirmed",
    applyCap: (_base, dailyCount) => (dailyCount < 3 ? 50 : 0),
  },

  [EventTypes.POST_SAVED]: {
    base: () => 15,
    capKey: (d) => {
      const postId = d?.postId ?? "unknown";
      return `post.saved:post:${postId}`;
    },
    applyCap: (_base, dailyCount) => (dailyCount < 10 ? 15 : 0),
  },

  [EventTypes.REACTION_MARKED_HELPFUL]: {
    base: () => 25,
    capKey: () => "reaction.marked_helpful",
    applyCap: (_base, dailyCount) => (dailyCount < 10 ? 25 : 0),
  },

  [EventTypes.USER_THANKED]: {
    base: () => 25,
    capKey: () => "user.thanked",
    applyCap: (_base, dailyCount) => (dailyCount < 10 ? 25 : 0),
  },

  [EventTypes.USER_PROFILE_VIEWED]: {
    base: () => 2,
    capKey: () => "user.profile_viewed",
    applyCap: (_base, dailyCount) => (dailyCount < 25 ? 2 : 0),
  },

  [EventTypes.FINANCE_DOCUMENT_CREATED]: {
    base: (d) => {
      const t = String(d?.documentType ?? "").toLowerCase();
      if (t === "invoice") return 40;
      if (t === "expense" || t === "estimate" || t === "credit") return 25;
      return 25;
    },
    capKey: () => "finance.document_created",
    applyCap: (base, dailyCount) => (dailyCount < 5 ? base : 0),
  },

  [EventTypes.JOB_COMPLETED]: {
    base: () => 75,
    capKey: () => "job.completed",
    applyCap: (_base, dailyCount) => (dailyCount < 3 ? 75 : 0),
  },

  [EventTypes.NOTE_CREATED]: {
    base: () => 10,
    capKey: () => "note.created",
    applyCap: (_base, dailyCount) => (dailyCount < 10 ? 10 : 0),
  },

  [EventTypes.ITEM_SAVED]: {
    base: () => 5,
    capKey: () => "item.saved",
    applyCap: (_base, dailyCount) => (dailyCount < 20 ? 5 : 0),
  },

  [EventTypes.TASK_CREATED]: {
    base: () => 10,
    capKey: () => "task.created",
    applyCap: (_base, dailyCount) => (dailyCount < 15 ? 10 : 0),
  },

  [EventTypes.USER_IDENTITY_VERIFIED]: {
    base: () => 500,
    capKey: () => "user.identity_verified",
    applyCap: (base, dailyCount) => (dailyCount < 1 ? base : 0),
  },

  [EventTypes.USER_MODERATION_ROLE_ASSIGNED]: {
    base: () => 500,
    capKey: () => "user.moderation_role_assigned",
    applyCap: (base, dailyCount) => (dailyCount < 1 ? base : 0),
  },

  [EventTypes.MODERATION_ACTION_TAKEN]: {
    base: () => 15,
    capKey: () => "moderation.action_taken",
    applyCap: (_base, dailyCount) => (dailyCount < 20 ? 15 : 0),
  },

  [EventTypes.USER_SESSION_STARTED]: {
    base: () => 1,
    capKey: () => "user.session_started",
    applyCap: (_base, dailyCount) => (dailyCount < 1 ? 1 : 0),
  },

  [EventTypes.BETA_FEATURE_USED]: {
    base: () => 20,
    capKey: (d) => `beta_feature.used:${String(d?.featureKey ?? "unknown")}`,
    applyCap: (_base, dailyCount) => (dailyCount < 1 ? 20 : 0),
  },

  [EventTypes.ACTIVITY_NIGHT_TIME]: {
    base: () => 0,
    capKey: () => "activity.night_time",
    applyCap: () => 0,
  },

  [EventTypes.CONTENT_VIEWED]: {
    base: () => 0,
    capKey: () => "content.viewed",
    applyCap: () => 0,
  },
};

export function computeBaseXp(eventType: EventType | string, eventData: any): number {
  const rule = xpRules[eventType];
  if (!rule) return 0;
  return clampInt(rule.base(eventData));
}
