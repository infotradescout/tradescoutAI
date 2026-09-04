import { createHash, randomBytes, randomUUID } from "crypto";
import { and, asc, desc, eq, inArray, ne, sql } from "drizzle-orm";
import {
  businessCounties,
  businesses,
  carSalesmanProfiles,
  profiles,
  realtorProfiles,
  users,
} from "../../shared/schema";
import {
  evaluateAdminBusinessImportRequest,
  evaluateLockedAdminBusinessImportTarget,
  executeImportedOwnerProjectionAtomically,
} from "./adminBusinessOwnerImportPolicy";
import {
  approvedProfessionalRolesFromProfiles,
  type CanonicalApprovedProfessionalRole,
  reconcileUserRolePatchWithApprovedProfessionalRoles,
} from "./professionalRoleAuthority";
import {
  auditPrivilegedAction,
  normalizeImmutableTargetId,
  resolvePrivilegedActor,
} from "../utils/privilegedActions";

function slugify(text: string): string {
  return String(text || "")
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

export async function createImportedOwnerProjectionAtomically(input: {
  email: string;
  phone: string;
  streetAddress: string;
  fullAddress: string;
  city: string;
  stateCode: string;
  zipCode: string;
  ownerFirstName: string;
  ownerLastName: string;
  businessName: string;
  category: string;
  services: string[];
  website: string;
  importExtras: Record<string, string>;
  countyIds: string[];
  countyFips: string;
  countyName: string;
  createPublicProfile: boolean;
  createEmailVerificationToken: boolean;
  database: { transaction<T>(callback: (tx: any) => Promise<T>): Promise<T> };
  actorId: string;
  confirmCreateUsers: string;
  importReason: string | null;
  sourceLabel: string;
}) {
  const db = input.database;
  const { actorId, confirmCreateUsers, importReason, sourceLabel } = input;
  return executeImportedOwnerProjectionAtomically({
    database: db,
    project: async (tx) => {
      // Serialize repeated chunks for the same identity before resolving
      // whether this is a new or existing account.
      await tx.execute(
        sql`select pg_advisory_xact_lock(hashtextextended(${`admin-owner-import:${input.email}`}, 0))`
      );

      const [existingRef] = await tx
        .select({ id: users.id })
        .from(users)
        .where(sql`lower(${users.email}) = ${input.email}`)
        .limit(1);

      let realtorApplication: any = null;
      let carSalesmanApplication: any = null;
      let approvedProfessionalRoles: CanonicalApprovedProfessionalRole[] = [];
      if (existingRef?.id) {
        [realtorApplication] = await tx
          .select({
            id: realtorProfiles.id,
            verificationStatus: realtorProfiles.verificationStatus,
            isActive: realtorProfiles.isActive,
          })
          .from(realtorProfiles)
          .where(eq(realtorProfiles.userId, String(existingRef.id)))
          .limit(1)
          .for("update");
        [carSalesmanApplication] = await tx
          .select({
            id: carSalesmanProfiles.id,
            verificationStatus: carSalesmanProfiles.verificationStatus,
            isActive: carSalesmanProfiles.isActive,
          })
          .from(carSalesmanProfiles)
          .where(eq(carSalesmanProfiles.userId, String(existingRef.id)))
          .limit(1)
          .for("update");
        approvedProfessionalRoles = approvedProfessionalRolesFromProfiles(
          realtorApplication,
          carSalesmanApplication
        );
      }

      const lockIds = Array.from(
        new Set([actorId, existingRef?.id ? String(existingRef.id) : ""].filter(Boolean))
      );
      const lockedUsers = await tx
        .select()
        .from(users)
        .where(inArray(users.id, lockIds))
        .orderBy(asc(users.id))
        .for("update");
      const lockedActor = lockedUsers.find((row) => String(row.id) === actorId);
      let userRecord = existingRef?.id
        ? lockedUsers.find((row) => String(row.id) === String(existingRef.id))
        : undefined;

      // Revalidate identity and application authority after the user
      // lock is acquired. The initial realtor -> car -> user lock order
      // protects existing application updates; these plain post-lock
      // reads also observe an application that committed while the user
      // lock was waiting, without reversing the global lock order.
      if (userRecord) {
        [realtorApplication] = await tx
          .select({
            id: realtorProfiles.id,
            verificationStatus: realtorProfiles.verificationStatus,
            isActive: realtorProfiles.isActive,
          })
          .from(realtorProfiles)
          .where(eq(realtorProfiles.userId, String(userRecord.id)))
          .limit(1);
        [carSalesmanApplication] = await tx
          .select({
            id: carSalesmanProfiles.id,
            verificationStatus: carSalesmanProfiles.verificationStatus,
            isActive: carSalesmanProfiles.isActive,
          })
          .from(carSalesmanProfiles)
          .where(eq(carSalesmanProfiles.userId, String(userRecord.id)))
          .limit(1);
        approvedProfessionalRoles = approvedProfessionalRolesFromProfiles(
          realtorApplication,
          carSalesmanApplication
        );
      }

      const lockedImportAuthority = evaluateAdminBusinessImportRequest({
        actor: lockedActor,
        createOwnerAccountsRequested: true,
        confirmation: confirmCreateUsers,
        reason: importReason,
      });
      if (lockedImportAuthority.outcome === "denied") throw lockedImportAuthority;

      const targetAuthority = evaluateLockedAdminBusinessImportTarget({
        inputEmail: input.email,
        lockedUser: userRecord,
        hasProfessionalApplication: Boolean(realtorApplication || carSalesmanApplication),
      });
      if (targetAuthority.outcome === "denied") throw targetAuthority;

      const userCreated = !userRecord;
      const now = new Date();
      if (!userRecord) {
        const [createdUser] = await tx
          .insert(users)
          .values({
            email: input.email,
            phone: input.phone || undefined,
            address: (input.streetAddress || input.fullAddress || "").trim() || undefined,
            city: input.city || undefined,
            stateCode: input.stateCode || undefined,
            zipCode: input.zipCode || undefined,
            firstName: input.ownerFirstName || input.businessName || undefined,
            lastName: input.ownerLastName || undefined,
            role: "business_owner" as any,
            roles: ["business_owner"],
            activeRole: "business_owner",
            onboardingCompleted: false,
            profileVersion: 0,
            provider: "local",
            preferences: {
              importProvenance: {
                kind: "admin_directory_owner_import",
                version: 1,
                source: sourceLabel,
                createdAt: now.toISOString(),
              },
            } as any,
          } as any)
          .returning();
        if (!createdUser) throw new Error("Failed to create imported owner account");
        userRecord = createdUser;
      }

      const userId = String(userRecord.id);
      const existingRoles = Array.isArray(userRecord.roles) ? userRecord.roles : [];
      const reconciledRoles = reconcileUserRolePatchWithApprovedProfessionalRoles({
        currentUser: userRecord,
        patch: { roles: [...existingRoles, "business_owner"] },
        approvedProfessionalRoles,
      });
      if (reconciledRoles.outcome !== "allowed") {
        throw {
          status: 409,
          code: "REAL_ACCOUNT_IMPORT_TARGET_PROTECTED",
          message: "Professional authority cannot be changed through bulk import.",
        };
      }

      const [existingBusiness] = await tx
        .select({ id: businesses.id, slug: businesses.slug })
        .from(businesses)
        .where(
          and(
            eq(businesses.ownerUserId, userId),
            sql`lower(${businesses.name}) = ${input.businessName.toLowerCase()}`
          )
        )
        .limit(1)
        .for("update");

      let businessId = existingBusiness?.id ? String(existingBusiness.id) : "";
      let businessCreated = false;
      if (!businessId) {
        const baseBusinessSlug = slugify(input.businessName) || randomUUID();
        let businessSlug = baseBusinessSlug;
        for (let attempt = 0; attempt < 50; attempt++) {
          const [slugMatch] = await tx
            .select({ id: businesses.id })
            .from(businesses)
            .where(eq(businesses.slug, businessSlug))
            .limit(1);
          if (!slugMatch) break;
          businessSlug = `${baseBusinessSlug}-${attempt + 2}`;
        }
        const [createdBusiness] = await tx
          .insert(businesses)
          .values({
            name: input.businessName,
            slug: businessSlug,
            type: "other" as any,
            ownerUserId: userId,
            roleContext: "business_owner" as any,
            claimStatus: "claimed",
            profileData: {
              category: input.category || undefined,
              services: input.services.length ? input.services : undefined,
              website: input.website || undefined,
              phone: input.phone || undefined,
              email: input.email,
              address: input.streetAddress || undefined,
              city: input.city || undefined,
              stateCode: input.stateCode || undefined,
              zipCode: input.zipCode || undefined,
              importExtras: Object.keys(input.importExtras).length ? input.importExtras : undefined,
            },
            sources: [sourceLabel],
            status: "draft" as any,
            createdAt: now,
            updatedAt: now,
          } as any)
          .returning();
        if (!createdBusiness) throw new Error("Failed to create imported owner business");
        businessId = String(createdBusiness.id);
        businessCreated = true;
        if (input.countyIds.length > 0) {
          await tx
            .insert(businessCounties)
            .values(input.countyIds.map((countyId) => ({ businessId, countyId })));
        }
      }

      const baseLegacySlug = slugify(input.businessName) || randomUUID();
      let legacyProfileSlug = baseLegacySlug;
      for (let attempt = 0; attempt < 50; attempt++) {
        const [slugOwner] = await tx
          .select({ id: users.id })
          .from(users)
          .where(and(eq(users.businessSlug, legacyProfileSlug), ne(users.id, userId)))
          .limit(1);
        if (!slugOwner) break;
        legacyProfileSlug = `${baseLegacySlug}-${attempt + 2}`;
      }

      const preferences: any =
        userRecord.preferences && typeof userRecord.preferences === "object"
          ? { ...userRecord.preferences }
          : {};
      const provisional: any =
        preferences.provisional && typeof preferences.provisional === "object"
          ? { ...preferences.provisional }
          : {};
      const existingDraft: any =
        provisional.profileDraft && typeof provisional.profileDraft === "object"
          ? provisional.profileDraft
          : {};
      provisional.profileDraft = {
        ...existingDraft,
        presenceType: "represent_business",
        stateCode: input.stateCode || null,
        countyFips: input.countyFips,
        countyName: input.countyName,
        city: input.city || null,
        businessName: input.businessName,
        services: input.services,
        website: input.website || null,
        visibility: "private",
        serviceAreas: input.countyFips ? [{ countyFips: input.countyFips }] : [],
        capturedAt: now.toISOString(),
      };
      preferences.provisional = provisional;

      let activeProfileId = userRecord.activeProfileId || null;
      let publicProfileSlug: string | null = null;
      let publicProfileCreated = false;
      if (input.createPublicProfile) {
        const [existingProfile] = await tx
          .select({ id: profiles.id, slug: profiles.slug })
          .from(profiles)
          .where(eq(profiles.ownerUserId, userId))
          .orderBy(desc(profiles.createdAt))
          .limit(1)
          .for("update");
        if (existingProfile) {
          publicProfileSlug = String(existingProfile.slug);
          activeProfileId = activeProfileId || existingProfile.id;
        } else {
          const basePublicSlug = slugify(input.businessName) || randomUUID();
          let publicSlug = basePublicSlug;
          for (let attempt = 0; attempt < 50; attempt++) {
            const [slugMatch] = await tx
              .select({ id: profiles.id })
              .from(profiles)
              .where(eq(profiles.slug, publicSlug))
              .limit(1);
            if (!slugMatch) break;
            publicSlug = `${basePublicSlug}-${attempt + 2}`;
          }
          const [createdProfile] = await tx
            .insert(profiles)
            .values({
              ownerUserId: userId,
              businessId,
              roleContext: "business_owner" as any,
              slug: publicSlug,
              displayName: input.businessName,
              headline: null,
              contentBlocks: [],
              ctaConfig: {},
              seoMeta: {},
              status: "published" as any,
              publiclyReleased: false,
              createdAt: now,
              updatedAt: now,
            } as any)
            .returning();
          if (!createdProfile) throw new Error("Failed to create imported public profile");
          activeProfileId = createdProfile.id;
          publicProfileSlug = String(createdProfile.slug);
          publicProfileCreated = true;
        }
      }

      const [updatedUser] = await tx
        .update(users)
        .set({
          ...reconciledRoles.patch,
          businessSlug: legacyProfileSlug,
          preferences,
          activeProfileId,
          updatedAt: now,
        } as any)
        .where(eq(users.id, userId))
        .returning();
      if (!updatedUser) throw new Error("Failed to project imported owner account");

      // Activation capability is part of the account projection. Any
      // token insert failure rolls back user, business, profile, and audit.
      const resetToken = randomBytes(32).toString("hex");
      const resetCode = String(Math.floor(100000 + Math.random() * 900000));
      const resetExpiresAt =
        Date.now() + (Number(process.env.PASSWORD_RESET_TOKEN_TTL_MINUTES) || 30) * 60 * 1000;
      await tx.execute(sql`
      with expired as (
        delete from public.auth_action_tokens where expires_at <= now()
      ), link_insert as (
        insert into public.auth_action_tokens (user_id, purpose, token_hash, expires_at)
        values (
          ${userId},
          'password_reset',
          ${createHash("sha256").update(resetToken).digest("hex")},
          ${new Date(resetExpiresAt)}
        )
        returning id
      )
      insert into public.auth_action_tokens (user_id, purpose, token_hash, expires_at)
      values (
        ${userId},
        'password_reset_code',
        ${createHash("sha256").update(resetCode).digest("hex")},
        ${new Date(resetExpiresAt)}
      )
      on conflict (user_id) where purpose = 'password_reset_code'
      do update set
        token_hash = excluded.token_hash,
        expires_at = excluded.expires_at,
        created_at = now()
    `);

      let emailVerificationToken: string | null = null;
      if (input.createEmailVerificationToken) {
        emailVerificationToken = randomBytes(32).toString("hex");
        const emailVerificationExpiresAt =
          Date.now() +
          (Number(process.env.EMAIL_VERIFICATION_TOKEN_TTL_MINUTES) || 60 * 24) * 60 * 1000;
        await tx.execute(sql`
        insert into public.auth_action_tokens (user_id, purpose, token_hash, expires_at)
        values (
          ${userId},
          'email_verification',
          ${createHash("sha256").update(emailVerificationToken).digest("hex")},
          ${new Date(emailVerificationExpiresAt)}
        )
      `);
      }

      const lockedActorContext = resolvePrivilegedActor(lockedActor);
      await auditPrivilegedAction({
        action: "admin_business_owner_account_import_target",
        route: "/api/admin/businesses/import",
        operationType: "create_or_attach_imported_business_owner_account",
        actorId: normalizeImmutableTargetId(actorId),
        actorRole: lockedActorContext.actorRole,
        actorRoles: lockedActorContext.actorRoles,
        targetType: "user",
        targetId: userId,
        resolutionSource: "locked_normalized_import_email",
        reason: importReason,
        outcome: "completed",
        details: {
          source: sourceLabel,
          userCreated,
          businessId,
          businessCreated,
          publicProfileCreated,
        },
        database: tx,
      });

      return {
        user: updatedUser,
        userCreated,
        userRoleUpdated: !userCreated && !existingRoles.includes("business_owner"),
        businessId,
        businessCreated,
        legacyProfileSlug,
        publicProfileSlug,
        publicProfileCreated,
        resetToken,
        resetExpiresAt,
        emailVerificationToken,
      };
    },
  });
}
