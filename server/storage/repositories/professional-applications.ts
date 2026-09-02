/* eslint-disable @typescript-eslint/no-explicit-any -- The repository preserves the existing storage adapter's dynamic database contract. */
import {
  carSalesmanProfiles,
  events,
  realtorProfiles,
  userRoleEnum,
  users,
  type CarSalesmanProfile,
  type InsertCarSalesmanProfile,
  type InsertRealtorProfile,
  type RealtorProfile,
} from "@shared/schema";
import { and, eq } from "drizzle-orm";
import type {
  ProfessionalApplicationDecision,
  ProfessionalApplicationDecisionResult,
  ProfessionalApplicationSubmissionResult,
  ProfessionalRole,
} from "../contracts";

type ProfessionalProfileTable = typeof realtorProfiles | typeof carSalesmanProfiles;
type ProfessionalProfile = RealtorProfile | CarSalesmanProfile;
type ProfessionalProfileInsert = InsertRealtorProfile | InsertCarSalesmanProfile;

type ProfessionalApplicationConfig = {
  table: ProfessionalProfileTable;
  role: ProfessionalRole;
  userUniqueConstraint: string;
  submittedEventType: string;
  decisionEventType: string;
};

function isPostgresUniqueViolation(error: unknown): boolean {
  return String((error as any)?.code || "") === "23505";
}

const routingRoleValues = new Set<string>(userRoleEnum.enumValues);

function canonicalProfessionalRole(value: unknown): ProfessionalRole | undefined {
  if (typeof value !== "string") return undefined;
  const normalized = value
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_");
  if (normalized === "realtor") return "realtor";
  if (
    normalized === "car_dealer" ||
    normalized === "car_salesman" ||
    normalized === "vehicle_dealer"
  ) {
    return "car_dealer";
  }
  return undefined;
}

function normalizedRoleValue(value: unknown): string {
  if (typeof value !== "string") return "";
  const trimmed = value.trim();
  if (!trimmed) return "";
  return canonicalProfessionalRole(trimmed) || trimmed;
}

function normalizedRoleList(values: unknown[]): string[] {
  return Array.from(new Set(values.map(normalizedRoleValue).filter(Boolean)));
}

export function editableProfessionalProfileData(profileData: Record<string, unknown>) {
  const editable = { ...profileData };
  for (const serverOwnedField of [
    "id",
    "userId",
    "verificationStatus",
    "isActive",
    "reviewedBy",
    "reviewedAt",
    "reviewNotes",
    "createdAt",
    "updatedAt",
  ]) {
    delete editable[serverOwnedField];
  }
  return editable;
}

export function createProfessionalApplicationPersistence(database: any) {
  async function findByUserId(
    queryable: any,
    table: ProfessionalProfileTable,
    userId: string
  ): Promise<ProfessionalProfile | undefined> {
    const [profile] = await queryable
      .select()
      .from(table)
      .where(eq((table as any).userId, userId))
      .limit(1);
    return profile as ProfessionalProfile | undefined;
  }

  async function submit<TProfile extends ProfessionalProfile>(
    config: ProfessionalApplicationConfig,
    profile: ProfessionalProfileInsert
  ): Promise<ProfessionalApplicationSubmissionResult<TProfile>> {
    try {
      const created = await database.transaction(async (tx: any) => {
        const [newProfile] = await tx
          .insert(config.table)
          .values({
            ...profile,
            verificationStatus: "pending",
            isActive: false,
            reviewedBy: null,
            reviewedAt: null,
            reviewNotes: null,
          })
          .returning();

        await tx.insert(events).values({
          eventType: config.submittedEventType,
          userId: profile.userId,
          data: {
            profileId: newProfile.id,
            userId: profile.userId,
          },
        });

        return newProfile as TProfile;
      });

      return { outcome: "created", profile: created };
    } catch (error) {
      const violatedConstraint = String((error as any)?.constraint || "");
      if (
        isPostgresUniqueViolation(error) &&
        (!violatedConstraint || violatedConstraint === config.userUniqueConstraint)
      ) {
        const existing = await findByUserId(database, config.table, profile.userId);
        if (existing) {
          return { outcome: "duplicate", profile: existing as TProfile };
        }
      }
      throw error;
    }
  }

  async function decide<TProfile extends ProfessionalProfile>(
    config: ProfessionalApplicationConfig,
    decision: ProfessionalApplicationDecision
  ): Promise<ProfessionalApplicationDecisionResult<TProfile>> {
    return database.transaction(async (tx: any) => {
      // Resolve the target user without taking a target-specific lock first. All
      // professional authority writers must acquire locks in the same order:
      // realtor profile, car-salesman profile, then the denormalized user row.
      // This avoids cross-application deadlocks and lets the decision rebuild the
      // user projection from both durable application rows.
      const [candidateProfile] = await tx
        .select()
        .from(config.table)
        .where(eq((config.table as any).id, decision.profileId))
        .limit(1);

      if (!candidateProfile) return { outcome: "not_found" };

      const [lockedRealtorProfile] = await tx
        .select()
        .from(realtorProfiles)
        .where(eq(realtorProfiles.userId, candidateProfile.userId))
        .limit(1)
        .for("update");
      const [lockedCarSalesmanProfile] = await tx
        .select()
        .from(carSalesmanProfiles)
        .where(eq(carSalesmanProfiles.userId, candidateProfile.userId))
        .limit(1)
        .for("update");

      const profile =
        config.table === realtorProfiles ? lockedRealtorProfile : lockedCarSalesmanProfile;
      if (!profile || profile.id !== decision.profileId) return { outcome: "not_found" };
      if (profile.verificationStatus !== "pending") {
        return { outcome: "already_decided", profile: profile as TProfile };
      }

      const [currentUser] = await tx
        .select({ role: users.role, roles: users.roles, activeRole: users.activeRole })
        .from(users)
        .where(eq(users.id, profile.userId))
        .limit(1)
        .for("update");
      if (!currentUser) {
        throw new Error("Professional application user not found");
      }

      const existingRoles = Array.isArray(currentUser.roles) ? currentUser.roles : [];
      const currentPrimary = normalizedRoleValue(currentUser.role) || "homeowner";
      const currentActive = normalizedRoleValue(currentUser.activeRole) || currentPrimary;
      const approvedProfessionalRoles = new Set<ProfessionalRole>();
      const targetWillBeApproved = decision.approved;
      const realtorWillBeApproved =
        config.table === realtorProfiles
          ? targetWillBeApproved
          : lockedRealtorProfile?.verificationStatus === "approved" &&
            lockedRealtorProfile?.isActive === true;
      const carSalesmanWillBeApproved =
        config.table === carSalesmanProfiles
          ? targetWillBeApproved
          : lockedCarSalesmanProfile?.verificationStatus === "approved" &&
            lockedCarSalesmanProfile?.isActive === true;
      if (realtorWillBeApproved) approvedProfessionalRoles.add("realtor");
      if (carSalesmanWillBeApproved) approvedProfessionalRoles.add("car_dealer");

      const roleIsDurablyAuthorized = (role: string): boolean => {
        const professionalRole = canonicalProfessionalRole(role);
        return !professionalRole || approvedProfessionalRoles.has(professionalRole);
      };
      const retainedRoles = normalizedRoleList(existingRoles).filter(roleIsDurablyAuthorized);
      const authoritativeRoles = normalizedRoleList([
        ...retainedRoles,
        ...approvedProfessionalRoles,
      ]);
      const fallbackRole =
        authoritativeRoles.find((role) => routingRoleValues.has(role)) || "homeowner";
      const nextPrimary = roleIsDurablyAuthorized(currentPrimary) ? currentPrimary : fallbackRole;
      const nextActive = roleIsDurablyAuthorized(currentActive) ? currentActive : nextPrimary;
      const userUpdates: Record<string, unknown> = {
        roles: normalizedRoleList([...authoritativeRoles, nextPrimary, nextActive]),
        role: nextPrimary,
        activeRole: nextActive,
        updatedAt: decision.reviewedAt,
      };

      const [updatedProfile] = await tx
        .update(config.table)
        .set({
          verificationStatus: decision.approved ? "approved" : "rejected",
          isActive: decision.approved,
          reviewedBy: decision.reviewedBy,
          reviewedAt: decision.reviewedAt,
          reviewNotes: decision.reviewNotes,
          updatedAt: decision.reviewedAt,
        })
        .where(
          and(
            eq((config.table as any).id, decision.profileId),
            eq((config.table as any).verificationStatus, "pending")
          )
        )
        .returning();
      if (!updatedProfile) {
        throw new Error("Professional application transition lost its pending row lock");
      }

      await tx.update(users).set(userUpdates).where(eq(users.id, profile.userId));

      await tx.insert(events).values({
        eventType: config.decisionEventType,
        userId: profile.userId,
        data: {
          profileId: profile.id,
          adminId: decision.reviewedBy,
          userId: profile.userId,
          approved: decision.approved,
          notes: decision.reviewNotes,
          reviewedAt: decision.reviewedAt.toISOString(),
        },
      });

      return { outcome: "decided", profile: updatedProfile as TProfile };
    });
  }

  const realtorConfig: ProfessionalApplicationConfig = {
    table: realtorProfiles,
    role: "realtor",
    userUniqueConstraint: "uq_realtor_profiles_user_id",
    submittedEventType: "realtor_application_submitted",
    decisionEventType: "realtor_verification_decision",
  };
  const carSalesmanConfig: ProfessionalApplicationConfig = {
    table: carSalesmanProfiles,
    role: "car_dealer",
    userUniqueConstraint: "uq_car_salesman_profiles_user_id",
    submittedEventType: "car_salesman_application_submitted",
    decisionEventType: "car_salesman_verification_decision",
  };

  return {
    submitRealtorApplication: (profile: InsertRealtorProfile) =>
      submit<RealtorProfile>(realtorConfig, profile),
    submitCarSalesmanApplication: (profile: InsertCarSalesmanProfile) =>
      submit<CarSalesmanProfile>(carSalesmanConfig, profile),
    decideRealtorApplication: (decision: ProfessionalApplicationDecision) =>
      decide<RealtorProfile>(realtorConfig, decision),
    decideCarSalesmanApplication: (decision: ProfessionalApplicationDecision) =>
      decide<CarSalesmanProfile>(carSalesmanConfig, decision),
  };
}
