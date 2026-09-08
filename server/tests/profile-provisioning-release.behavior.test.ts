import { afterEach, describe, expect, it, vi } from "vitest";
import { businesses, profiles, users } from "@shared/schema";
import { profileReleaseSeedFields } from "@shared/profileVisibility";

const state = vi.hoisted(() => ({ tx: null as any }));
vi.mock("../db", () => ({
  db: { transaction: async (work: (tx: any) => Promise<void>) => work(state.tx) },
}));
vi.mock("../services/stoneCoreProvisioning", () => ({
  ensureStoneCoreTables: vi.fn(async () => {}),
  provisionRedGranitiStoneCore: vi.fn(async () => {}),
}));

import { provisionRedGranitiProfile } from "../services/redGranitiProfileProvisioning";

type Profile = { id?: string; status?: string; publiclyReleased?: unknown };

function setupRedGraniti(existing: Profile | null, current: Profile | null = existing) {
  const admin = {
    id: "admin-owner",
    role: "super_admin",
    roles: ["super_admin"],
    verificationStatus: "approved",
    preferences: { publicProfileIds: ["unrelated-profile", "red-profile"] },
  };
  const storedProfile = existing
    ? { ...existing, ownerUserId: admin.id, businessId: "red-business" }
    : null;
  const reads = [
    [{ id: "jw-business", ownerUserId: "jw-owner", status: "active" }],
    [{ id: "jw-profile", ownerUserId: "jw-owner", status: "published" }],
    [{ id: "jw-owner", verifiedBadge: true }],
    existing ? [{ id: "red-business", ownerUserId: admin.id, status: "active" }] : [],
    storedProfile ? [storedProfile] : [],
    [admin],
    [],
  ];
  const writes: Array<{ table: unknown; values: Record<string, any> }> = [];
  const mutation = (table: unknown, values: Record<string, any>) => {
    writes.push({ table, values });
    const result = {
      where: () => result,
      returning: async () => [
        table === profiles
          ? { id: "red-profile", ...current, ...values }
          : { id: table === businesses ? "red-business" : admin.id, ...values },
      ],
    };
    return result;
  };
  state.tx = {
    select: () => {
      const result = {
        from: () => result,
        where: () => result,
        limit: async () => {
          const rows = reads.shift();
          if (!rows) throw new Error("Unexpected provisioner read");
          return rows;
        },
      };
      return result;
    },
    update: (table: unknown) => ({ set: (values: Record<string, any>) => mutation(table, values) }),
    insert: (table: unknown) => ({
      values: (values: Record<string, any>) => mutation(table, values),
    }),
  };
  vi.stubEnv("NODE_ENV", "production");
  vi.stubEnv("MASTER_ADMIN_EMAIL", "");
  return { writes, reads };
}

afterEach(() => vi.unstubAllEnvs());

describe("profile provisioning release authority", () => {
  it.each([true, false])(
    "records only the authorized new seed release (%s)",
    (releaseNewProfile) => {
      expect(profileReleaseSeedFields({ existingProfile: null, releaseNewProfile })).toEqual({
        status: "published",
        publiclyReleased: releaseNewProfile,
      });
    }
  );

  it.each([
    { status: "published", publiclyReleased: true },
    { status: "published", publiclyReleased: false },
    { status: "draft", publiclyReleased: false },
    { status: "published" },
  ])("preserves an existing release decision without copying stale authority", (profile) => {
    expect({
      ...profile,
      ...profileReleaseSeedFields({ existingProfile: profile, releaseNewProfile: true }),
    }).toEqual(profile);
  });

  it("writes a new Red Graniti profile release after existing steward checks", async () => {
    const { writes, reads } = setupRedGraniti(null);
    await provisionRedGranitiProfile();
    expect(reads).toHaveLength(0);
    expect(writes.find((write) => write.table === profiles)?.values).toMatchObject({
      ownerUserId: "admin-owner",
      status: "published",
      publiclyReleased: true,
    });
    expect(
      writes.find((write) => write.table === users)?.values.preferences.publicProfileIds
    ).toEqual(["unrelated-profile", "red-profile"]);
  });

  it.each([
    { status: "published", publiclyReleased: true },
    { status: "published", publiclyReleased: false },
    { status: "draft", publiclyReleased: false },
    { status: "published" },
  ])("does not overwrite an existing Red Graniti release or draft", async (profile) => {
    const { writes, reads } = setupRedGraniti(profile);
    await provisionRedGranitiProfile();
    expect(reads).toHaveLength(0);
    const values = writes.find((write) => write.table === profiles)?.values;
    expect(values).not.toHaveProperty("status");
    expect(values).not.toHaveProperty("publiclyReleased");
    const preferenceWrites = writes.filter((write) => write.table === users);
    expect(preferenceWrites).toHaveLength(profile.publiclyReleased === true ? 1 : 0);
  });

  it("does not regrant release when revocation commits after the provisioning read", async () => {
    const { writes } = setupRedGraniti(
      { status: "published", publiclyReleased: true },
      { status: "draft", publiclyReleased: false }
    );
    await provisionRedGranitiProfile();
    const values = writes.find((write) => write.table === profiles)?.values;
    expect(values).not.toHaveProperty("status");
    expect(values).not.toHaveProperty("publiclyReleased");
    expect(writes.filter((write) => write.table === users)).toHaveLength(0);
  });
});
