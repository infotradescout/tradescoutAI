import fs from "node:fs";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";
import { isProfileExplicitlyPublic } from "../../shared/profileVisibility";
import { derivePublishedProfileExposure } from "../services/ownerConfirmedDirectProfile";
import {
  buildExactProfileVisibilityPreferences,
  mutateExactProfileVisibilityAtomically,
  PROFILE_VISIBILITY_ATOMIC_PREFERENCES_SQL,
  PROFILE_VISIBILITY_BUSINESS_OWNER_LOCK_SQL,
  PROFILE_VISIBILITY_OWNER_LOCK_SQL,
  PROFILE_VISIBILITY_RELEASE_SQL,
  PROFILE_VISIBILITY_TARGET_LOCK_SQL,
  resolveOwnedProfileVisibilityTarget,
  resolveTargetProfileVerificationPolicy,
  type ProfileVisibilityTransactionPool,
} from "../services/profileVisibilityMutation";

describe("exact profile visibility mutation", () => {
  it("wires the editor and publish response to the exact Profile id", () => {
    const editor = fs.readFileSync(
      path.resolve(process.cwd(), "client/src/pages/ProfileSiteEditor.tsx"),
      "utf8"
    );
    const routes = fs.readFileSync(path.resolve(process.cwd(), "server/routes.ts"), "utf8");
    const profileRoutes = fs.readFileSync(
      path.resolve(process.cwd(), "server/routes/profiles.ts"),
      "utf8"
    );
    const visibilityMutation = editor.slice(
      editor.indexOf("const setVisibility"),
      editor.indexOf("const updateProfileSection")
    );

    expect(visibilityMutation.match(/profileId: profile\.id/g)).toHaveLength(2);
    const routeMutation = routes.slice(
      routes.indexOf('"/api/users/profile-visibility"'),
      routes.indexOf("// Update profile site sections")
    );
    expect(routeMutation).toContain("mutateExactProfileVisibilityAtomically({");
    expect(routeMutation).not.toContain("storage.updateUser(userId");
    expect(visibilityMutation).toContain("status: finalPayload.profileStatus");
    expect(profileRoutes).toContain("mutateExactProfileVisibilityAtomically({");
    expect(profileRoutes).not.toContain("isProfileExplicitlyPublic({");
    expect(routeMutation).not.toContain("proceedUnverified: true");
    expect(routeMutation).toContain(
      "Your profile remains private until you choose to continue without verification."
    );
    expect(routeMutation).not.toContain("Your profile will still be visible");
  });

  it("locks owner and exact target and mutates the current JSONB value atomically", () => {
    expect(PROFILE_VISIBILITY_OWNER_LOCK_SQL).toContain("FROM users");
    expect(PROFILE_VISIBILITY_OWNER_LOCK_SQL).toContain("FOR UPDATE");
    expect(PROFILE_VISIBILITY_TARGET_LOCK_SQL).toContain("AND owner_user_id = $2");
    expect(PROFILE_VISIBILITY_TARGET_LOCK_SQL).toContain("FOR UPDATE");
    expect(PROFILE_VISIBILITY_RELEASE_SQL).toContain("publicly_released = $3::boolean");
    expect(PROFILE_VISIBILITY_ATOMIC_PREFERENCES_SQL).toContain("owner_preferences.value");
    expect(PROFILE_VISIBILITY_ATOMIC_PREFERENCES_SQL).toContain("jsonb_array_elements_text");
    expect(PROFILE_VISIBILITY_ATOMIC_PREFERENCES_SQL).toContain(
      "jsonb_build_object('publicProfileIds'"
    );
    expect(PROFILE_VISIBILITY_ATOMIC_PREFERENCES_SQL).toContain(
      "jsonb_build_object('profileVisibility'"
    );
  });

  it("derives publication verification from the target Profile, not the account role", () => {
    expect(
      resolveTargetProfileVerificationPolicy({
        id: "personal-profile",
        roleContext: "homeowner",
        contentBlocks: [],
      })
    ).toMatchObject({
      presenceType: "personal",
      isBusinessTarget: false,
      isContractorTarget: false,
    });
    expect(
      resolveTargetProfileVerificationPolicy({
        id: "contractor-profile",
        roleContext: "contractor",
        contentBlocks: [],
      })
    ).toMatchObject({
      presenceType: "represent_business",
      isBusinessTarget: true,
      isContractorTarget: true,
    });
    expect(
      resolveTargetProfileVerificationPolicy({
        id: "business-presence",
        roleContext: "homeowner",
        contentBlocks: [{ type: "businessDraft", data: {} }],
      })
    ).toMatchObject({
      presenceType: "represent_business",
      isBusinessTarget: true,
    });
    expect(
      resolveTargetProfileVerificationPolicy({
        id: "realtor-profile",
        roleContext: "realtor",
        contentBlocks: [],
      })
    ).toMatchObject({
      presenceType: "represent_business",
      isBusinessTarget: true,
    });
    expect(
      resolveTargetProfileVerificationPolicy({
        id: "vehicle-business-profile",
        roleContext: "car_dealer",
        contentBlocks: [],
      })
    ).toMatchObject({
      presenceType: "represent_business",
      isBusinessTarget: true,
    });
  });

  it("fails closed for an empty Profile before writing its release authority", async () => {
    const client = {
      query: vi.fn(async (text: string) => {
        const normalized = text.trim();
        if (normalized === "BEGIN" || normalized === "ROLLBACK") return { rows: [] };
        if (text === PROFILE_VISIBILITY_OWNER_LOCK_SQL) {
          return {
            rows: [
              {
                id: "owner-1",
                preferences: {},
                role: "homeowner",
                roles: ["homeowner"],
                verified_badge: false,
                verification_status: "pending",
              },
            ],
          };
        }
        if (text === PROFILE_VISIBILITY_TARGET_LOCK_SQL) {
          return {
            rows: [
              {
                id: "profile-1",
                slug: "empty-profile",
                status: "draft",
                role_context: "homeowner",
                business_id: null,
                headline: null,
                content_blocks: [],
              },
            ],
          };
        }
        throw new Error(`Unexpected SQL: ${normalized}`);
      }),
      release: vi.fn(),
    };

    await expect(
      mutateExactProfileVisibilityAtomically(
        {
          ownerUserId: "owner-1",
          requestedProfileId: "profile-1",
          allowLegacyActiveProfileFallback: false,
          profileVisibility: "public",
        },
        { connect: vi.fn().mockResolvedValue(client) }
      )
    ).resolves.toMatchObject({
      ok: false,
      status: 428,
      code: "PROFILE_EXPOSURE_REQUIREMENTS_UNMET",
    });
    expect(client.query).not.toHaveBeenCalledWith(
      PROFILE_VISIBILITY_RELEASE_SQL,
      expect.anything()
    );
  });

  it("keeps a contractor Profile private on the first soft-gate response", async () => {
    const client = {
      query: vi.fn(async (text: string) => {
        const normalized = text.trim();
        if (normalized === "BEGIN" || normalized === "ROLLBACK") return { rows: [] };
        if (text === PROFILE_VISIBILITY_OWNER_LOCK_SQL) {
          return {
            rows: [
              {
                id: "owner-1",
                preferences: {},
                role: "contractor",
                roles: ["contractor"],
                verified_badge: true,
                verification_status: "pending",
                provider: "local",
              },
            ],
          };
        }
        if (text === PROFILE_VISIBILITY_TARGET_LOCK_SQL) {
          return {
            rows: [
              {
                id: "profile-1",
                slug: "contractor-profile",
                status: "draft",
                role_context: "contractor",
                business_id: "business-1",
                headline: "Licensed local contractor",
                content_blocks: [],
              },
            ],
          };
        }
        if (text === PROFILE_VISIBILITY_BUSINESS_OWNER_LOCK_SQL) {
          return {
            rows: [
              {
                owner_user_id: "owner-1",
                status: "active",
                public_discovery_enabled: true,
                sources: [],
                claim_status: "claimed",
              },
            ],
          };
        }
        throw new Error(`Unexpected SQL: ${normalized}`);
      }),
      release: vi.fn(),
    };

    await expect(
      mutateExactProfileVisibilityAtomically(
        {
          ownerUserId: "owner-1",
          requestedProfileId: "profile-1",
          allowLegacyActiveProfileFallback: false,
          profileVisibility: "public",
        },
        { connect: vi.fn().mockResolvedValue(client) }
      )
    ).resolves.toMatchObject({
      ok: false,
      status: 200,
      code: "CONTRACTOR_VERIFICATION_SUGGESTED",
    });
    expect(client.query).not.toHaveBeenCalledWith(
      PROFILE_VISIBILITY_RELEASE_SQL,
      expect.anything()
    );
  });

  it("rolls back status publication when the exact release write fails", async () => {
    const persisted = {
      status: "draft",
      preferences: {
        publicProfileIds: ["released-sibling"],
        servicesDescription: "preserve me",
      },
    };
    let working = structuredClone(persisted);
    const commands: string[] = [];
    const client = {
      query: vi.fn(async (text: string) => {
        const normalized = text.trim();
        commands.push(normalized);
        if (normalized === "BEGIN") {
          working = structuredClone(persisted);
          return { rows: [] };
        }
        if (text === PROFILE_VISIBILITY_OWNER_LOCK_SQL) {
          return {
            rows: [
              {
                id: "owner-1",
                active_profile_id: "profile-1",
                preferences: working.preferences,
                verified_badge: true,
                verification_status: "approved",
                address_verified: true,
              },
            ],
          };
        }
        if (text === PROFILE_VISIBILITY_TARGET_LOCK_SQL) {
          return {
            rows: [
              {
                id: "profile-1",
                slug: "profile-one",
                status: working.status,
                role_context: "homeowner",
                business_id: null,
                content_blocks: [],
              },
            ],
          };
        }
        if (normalized.startsWith("UPDATE profiles")) {
          working.status = "published";
          return { rows: [{ status: "published" }] };
        }
        if (text === PROFILE_VISIBILITY_ATOMIC_PREFERENCES_SQL) {
          throw new Error("preference update failed");
        }
        if (normalized === "ROLLBACK") {
          working = structuredClone(persisted);
          return { rows: [] };
        }
        if (normalized === "COMMIT") {
          Object.assign(persisted, structuredClone(working));
          return { rows: [] };
        }
        throw new Error(`Unexpected SQL: ${normalized}`);
      }),
      release: vi.fn(),
    };
    const transactionPool: ProfileVisibilityTransactionPool = {
      connect: vi.fn().mockResolvedValue(client),
    };

    await expect(
      mutateExactProfileVisibilityAtomically(
        {
          ownerUserId: "owner-1",
          requestedProfileId: "profile-1",
          allowLegacyActiveProfileFallback: false,
          profileVisibility: "public",
          proceedUnverified: true,
        },
        transactionPool
      )
    ).rejects.toThrow("preference update failed");

    expect(commands).toContain("ROLLBACK");
    expect(commands).not.toContain("COMMIT");
    expect(persisted).toEqual({
      status: "draft",
      preferences: {
        publicProfileIds: ["released-sibling"],
        servicesDescription: "preserve me",
      },
    });
    expect(client.release).toHaveBeenCalledOnce();
  });

  it("does not treat status or the legacy account flag as exact public release", () => {
    expect(
      isProfileExplicitlyPublic({
        profileId: "selected-profile",
        preferences: { profileVisibility: "public", publicProfileIds: ["sibling-profile"] },
      })
    ).toBe(false);
    expect(
      derivePublishedProfileExposure({
        profileId: "selected-profile",
        profilePubliclyReleased: false,
        profileSlug: "selected",
        profileStatus: "published",
        profileRoleContext: "homeowner",
        profileHeadline: "Ready to help",
        profileOwnerUserId: "owner-1",
        ownerPreferences: {
          profileVisibility: "public",
          publicProfileIds: ["selected-profile"],
        },
      })
    ).toMatchObject({ mode: "private" });
    expect(
      derivePublishedProfileExposure({
        profileId: "selected-profile",
        profilePubliclyReleased: true,
        profileSlug: "selected",
        profileStatus: "published",
        profileRoleContext: "homeowner",
        profileHeadline: "Ready to help",
        profileOwnerUserId: "owner-1",
        ownerPreferences: { profileVisibility: "private", publicProfileIds: [] },
      })
    ).toEqual({ mode: "public", reason: "public" });
  });

  it("adds only the selected public Profile and preserves released siblings", () => {
    expect(
      buildExactProfileVisibilityPreferences({
        preferences: {
          profileVisibility: "private",
          publicProfileIds: ["sibling-profile"],
          servicesDescription: "Existing preference",
        },
        profileId: "selected-profile",
        profileVisibility: "public",
      })
    ).toEqual({
      profileVisibility: "private",
      publicProfileIds: ["sibling-profile", "selected-profile"],
      servicesDescription: "Existing preference",
    });
  });

  it("removes only the selected Profile and preserves released siblings", () => {
    expect(
      buildExactProfileVisibilityPreferences({
        preferences: {
          profileVisibility: "public",
          publicProfileIds: ["selected-profile", "sibling-profile"],
        },
        profileId: "selected-profile",
        profileVisibility: "private",
      })
    ).toEqual({
      profileVisibility: "public",
      publicProfileIds: ["sibling-profile"],
    });
  });

  it("rejects a selected Profile that is not owned by the authenticated account", async () => {
    const getProfileByIdForOwner = vi.fn().mockResolvedValue(undefined);

    await expect(
      resolveOwnedProfileVisibilityTarget({
        storage: { getProfileByIdForOwner },
        ownerUserId: "authenticated-owner",
        requestedProfileId: "other-owners-profile",
        activeProfileId: "owned-active-profile",
        allowLegacyActiveProfileFallback: false,
      })
    ).resolves.toEqual({
      ok: false,
      status: 404,
      message: "Profile not found",
    });
    expect(getProfileByIdForOwner).toHaveBeenCalledWith(
      "authenticated-owner",
      "other-owners-profile"
    );
  });

  it("allows an older caller to target only its already-owned active Profile", async () => {
    const profile = { id: "owned-active-profile", slug: "owned", status: "draft" };
    const getProfileByIdForOwner = vi.fn().mockResolvedValue(profile);

    await expect(
      resolveOwnedProfileVisibilityTarget({
        storage: { getProfileByIdForOwner },
        ownerUserId: "authenticated-owner",
        activeProfileId: profile.id,
        allowLegacyActiveProfileFallback: true,
      })
    ).resolves.toEqual({
      ok: true,
      profile,
      profileId: profile.id,
      usedLegacyActiveProfileFallback: true,
    });
  });
});
