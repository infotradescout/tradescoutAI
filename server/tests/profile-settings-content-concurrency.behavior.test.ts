import express from "express";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  storage: {
    getUser: vi.fn(), getProfileById: vi.fn(), getProfileByIdForOwner: vi.fn(),
    updateProfileById: vi.fn(), updateProfileForOwner: vi.fn(),
    updateProfileByIdWithContentBlocksRevision: vi.fn(), updateProfileForOwnerWithContentBlocksRevision: vi.fn(),
  },
  notifyIndexNow: vi.fn(),
}));
vi.mock("../auth", () => ({
  isAuthenticated: (req: any, _res: any, next: () => void) => {
    req.user = { id: "synthetic-owner", role: req.header("x-test-role") || "customer" };
    next();
  },
}));
vi.mock("../storage", () => ({ storage: mocks.storage }));
vi.mock("../services/indexNowService", () => ({ notifyIndexNow: mocks.notifyIndexNow }));

import { profilesRouter } from "../routes/profiles";
import { profileTargetIdentityFromRow } from "../profileTargetIdentity";

const about = { type: "about", data: { text: "Owner approved imported description" } };
const profile = {
  id: "synthetic-profile", ownerUserId: "synthetic-owner", businessId: null,
  roleContext: "business_owner", slug: "synthetic-profile", status: "draft", publiclyReleased: false,
  displayName: "Synthetic business", contentBlocksRevision: 7, seoMeta: {}, ctaConfig: {},
  contentBlocks: [{ type: "hero", data: { title: "Synthetic business" } }, about],
} as any;
const cases = [
  { path: "profile-booking", body: { enabled: true }, blockType: "profileBooking" },
  { path: "profile-sections", body: { about: true }, blockType: "profileSections" },
];

function app() {
  const instance = express();
  instance.use(express.json());
  instance.use(profilesRouter);
  return instance;
}

describe("profile settings use the loaded content revision", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.storage.getUser.mockResolvedValue({ id: profile.ownerUserId, preferences: {} });
    mocks.storage.getProfileById.mockResolvedValue(profile);
    mocks.storage.getProfileByIdForOwner.mockResolvedValue(profile);
  });

  for (const setting of cases) {
    for (const role of ["customer", "head_admin"]) {
      it(`${role} ${setting.path} preserves About and binds to the loaded target`, async () => {
        const writer = role === "customer"
          ? mocks.storage.updateProfileForOwnerWithContentBlocksRevision
          : mocks.storage.updateProfileByIdWithContentBlocksRevision;
        writer.mockImplementation(async (...args) => {
          const updates = args[role === "customer" ? 2 : 1];
          return { ...profile, ...updates, contentBlocksRevision: 8 };
        });
        const response = await request(app()).patch(`/api/profiles/${profile.id}/${setting.path}`)
          .set("x-test-role", role).send(setting.body);
        expect(response.status).toBe(200);
        const args = writer.mock.calls[0];
        const offset = role === "customer" ? 1 : 0;
        expect(args[offset]).toBe(profile.id);
        expect(args[offset + 1].contentBlocks).toContainEqual(about);
        expect(args[offset + 1].contentBlocks.filter((block: any) => block.type === setting.blockType)).toHaveLength(1);
        expect(args[offset + 2]).toBe(7);
        expect(args[offset + 3]).toEqual(profileTargetIdentityFromRow(profile));
        expect(mocks.storage.updateProfileForOwner).not.toHaveBeenCalled();
        expect(mocks.storage.updateProfileById).not.toHaveBeenCalled();
      });

      it(`${role} ${setting.path} reports a concurrent About publication without overwriting it`, async () => {
        const loadedBeforeAbout = { ...profile, contentBlocks: profile.contentBlocks.filter((block: any) => block.type !== "about") };
        mocks.storage.getProfileById.mockResolvedValue(loadedBeforeAbout);
        mocks.storage.getProfileByIdForOwner.mockResolvedValue(loadedBeforeAbout);
        const writer = role === "customer"
          ? mocks.storage.updateProfileForOwnerWithContentBlocksRevision
          : mocks.storage.updateProfileByIdWithContentBlocksRevision;
        writer.mockResolvedValue(undefined);
        const response = await request(app()).patch(`/api/profiles/${profile.id}/${setting.path}`)
          .set("x-test-role", role).send(setting.body);
        expect(response.status).toBe(409);
        expect(response.body.code).toBe("PROFILE_CONTENT_BLOCKS_STALE");
        expect(mocks.notifyIndexNow).not.toHaveBeenCalled();
        expect(mocks.storage.updateProfileForOwner).not.toHaveBeenCalled();
        expect(mocks.storage.updateProfileById).not.toHaveBeenCalled();
      });
    }
  }
});
