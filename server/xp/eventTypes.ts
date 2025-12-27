export const EventTypes = {
  // Community discovery
  COMMUNITY_VIEWED_SCOPE: "community.viewed_scope",
  CONTENT_VIEWED: "content.viewed",

  // Posting & conversation
  POST_CREATED: "post.created",
  COMMENT_CREATED: "comment.created",

  // Social proof / help
  POST_SAVED: "post.saved",
  REACTION_MARKED_HELPFUL: "reaction.marked_helpful",
  USER_THANKED: "user.thanked",

  // Connections
  CONNECTION_CREATED: "connection.created",
  CONNECTION_CONFIRMED: "connection.confirmed",

  // Finances & tools
  FINANCE_DOCUMENT_CREATED: "finance.document_created",
  NOTE_CREATED: "note.created",
  ITEM_SAVED: "item.saved",
  TASK_CREATED: "task.created",
  JOB_COMPLETED: "job.completed",

  // Identity / trust / moderation
  USER_IDENTITY_VERIFIED: "user.identity_verified",
  USER_MODERATION_ROLE_ASSIGNED: "user.moderation_role_assigned",
  MODERATION_ACTION_TAKEN: "moderation.action_taken",

  // Meta
  USER_SESSION_STARTED: "user.session_started",
  USER_PROFILE_VIEWED: "user.profile_viewed",
  BETA_FEATURE_USED: "beta_feature.used",
  ACTIVITY_NIGHT_TIME: "activity.night_time",

  // Internal
  XP_APPLIED: "xp.applied",
  BADGE_AWARDED: "badge.awarded",
} as const;

export type EventType = (typeof EventTypes)[keyof typeof EventTypes];

// Base event row as stored by the existing events table.
export type LoggedEvent = {
  id: string;
  eventType: EventType | string;
  createdAt: Date;
  data: any;
};
