import type { Request } from "express";

/**
 * User roles that determine available actions
 */
export type UserRole =
  | "homeowner"
  | "contractor"
  | "helper"
  | "realtor"
  | "hoaAdmin"
  | "groupModerator"
  | "countyAdmin"
  | "stateAdmin"
  | "superAdmin"
  | "affiliate"
  | "worker"
  | "dealer";

/**
 * Assistant user with location and role context
 */
export interface AssistantUser {
  id: string;
  role: UserRole;
  stateCode?: string | null;
  countyCode?: string | null;
  county?: string;
  state?: string;
}

/**
 * All approved action types for assistant
 */
export type AssistantActionType =
  // Marketplace
  | "GET_MARKETPLACE_LISTINGS"
  | "CREATE_MARKETPLACE_LISTING"
  | "UPDATE_MARKETPLACE_LISTING"
  | "DELETE_MARKETPLACE_LISTING"
  // Contractors
  | "GET_CONTRACTORS_BY_COUNTY"
  | "GET_CONTRACTOR_DETAILS"
  | "UPDATE_CONTRACTOR_PROFILE"
  // Projects
  | "GET_USER_PROJECTS"
  | "CREATE_PROJECT"
  | "UPDATE_PROJECT_STATUS"
  // HOA
  | "GET_HOA_OVERVIEW"
  | "CREATE_HOA_VOTE"
  | "CAST_HOA_VOTE"
  // Groups
  | "GET_GROUPS_BY_COUNTY"
  | "JOIN_GROUP"
  | "CREATE_GROUP_POST"
  // Messaging
  | "GET_USER_CONVERSATIONS"
  | "SEND_MESSAGE"
  // Admin / cache
  | "TRIGGER_CACHE_REFRESH"
  | "UPDATE_MANUAL_OVERRIDE";

/**
 * Action request from assistant
 */
export interface AssistantAction {
  type: AssistantActionType;
  params: Record<string, unknown>;
}

/**
 * Result returned from action execution
 */
export interface AssistantResult {
  replyText: string;
  data?: Record<string, unknown> | null;
}

/**
 * Error thrown when user lacks permission
 */
export class PermissionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PermissionError";
  }
}

/**
 * Error thrown when resource not found
 */
export class NotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "NotFoundError";
  }
}

/**
 * Error thrown when input validation fails
 */
export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ValidationError";
  }
}
