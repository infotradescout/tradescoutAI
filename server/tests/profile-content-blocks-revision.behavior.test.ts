import express from "express";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  storage: {
    getBusinessPublicById: vi.fn(),
    getProfileById: vi.fn(),
    getProfileByIdForOwner: vi.fn(),
    updateProfileById: vi.fn(),
    updateProfileByIdWithContentBlocksRevision: vi.fn(),
    updateProfileForOwner: vi.fn(),
    updateProfileForOwnerWithContentBlocksRevision: vi.fn(),
  },
  validateProfileTargetAuthority: vi.fn(),
  notifyIndexNow: vi.fn(),
}));

vi.mock("../auth", () => ({
  isAuthenticated: (req: any, _res: any, next: () => void) => {
    req.user = {
      id: req.header("x-test-principal") || "owner-a",
      role: req.header("x-test-role") || "customer",
    };
    next();
  },
}));
vi.mock("../storage", () => ({ storage: mocks.storage }));
vi.mock("../services/profileTargetAuthority", () => ({
  validateProfileTargetAuthority: mocks.validateProfileTargetAuthority,
  durableProfessionalProfileApprovalSql: undefined,
}));
vi.mock("../services/indexNowService", () => ({ notifyIndexNow: mocks.notifyIndexNow }));

import { profilesRouter } from "../routes/profiles";

const existing = {
  id: "profile-a",
  ownerUserId: "owner-a",
  businessId: null,
  roleContext: "business_owner",
  slug: "profile-a",
  status: "draft",
  publiclyReleased: false,
  displayName: "Before",
  headline: null,
  contentBlocks: [{ type: "about", data: { text: "Private original" } }],
  contentBlocksRevision: 7,
  ctaConfig: {},
  seoMeta: {},
};
const proposedBlocks = [{ type: "about", data: { text: "Replacement" } }];

type IdentitySource = Pick<typeof existing, "ownerUserId" | "roleContext" | "slug" | "publiclyReleased"> & {
  businessId: string | null;
  status: string;
  seoMeta: unknown;
};

function expectedIdentity(row: IdentitySource = existing) {
  return {
    ownerUserId: row.ownerUserId,
    businessId: row.businessId,
    roleContext: row.roleContext,
    slug: row.slug,
    status: row.status,
    publiclyReleased: row.publiclyReleased,
    customDomain: String((row.seoMeta as any)?.customDomain || "").trim().toLowerCase(),
  };
}

function saveBody(body: Record<string, unknown>, row: IdentitySource = existing) {
  return { ...body, expectedProfileIdentity: expectedIdentity(row) };
}

const targetChanges: Array<[string, Record<string, unknown>]> = [
  ["business relink", { businessId: "business-b" }],
  ["role change", { roleContext: "contractor" }],
  ["slug change", { slug: "renamed" }],
  ["publication status", { status: "published" }],
  ["public release", { publiclyReleased: true }],
  ["domain change", { seoMeta: { customDomain: "new.example.test" } }],
];

function app() {
  const instance = express();
  instance.use(express.json());
  instance.use(profilesRouter);
  return instance;
}

describe("owner whole-array profile save revision", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.storage.getProfileByIdForOwner.mockResolvedValue(existing);
    mocks.validateProfileTargetAuthority.mockResolvedValue({ ok: true });
  });

  it("projects the private template from the authorized profile and its business", async () => {
    mocks.storage.getProfileByIdForOwner.mockResolvedValue({ ...existing, businessId: "business-a" });
    mocks.storage.getBusinessPublicById.mockResolvedValue({ tradePartner: true });

    const response = await request(app()).get("/api/profiles/profile-a");

    expect(response.status).toBe(200);
    expect(response.body.siteTemplate).toBe("wholesaler");
    expect(response.body.contentBlocksRevision).toBe(7);
    expect(mocks.storage.getBusinessPublicById).toHaveBeenCalledWith("business-a");
  });

  it("resolves the successful PUT template before CAS so no later lookup can hide a committed save", async () => {
    const linked = { ...existing, businessId: "business-a" };
    mocks.storage.getProfileByIdForOwner.mockResolvedValue(linked);
    mocks.storage.getBusinessPublicById.mockResolvedValue({ tradePartner: true });
    mocks.storage.updateProfileForOwnerWithContentBlocksRevision.mockImplementation(async () => {
      expect(mocks.storage.getBusinessPublicById).toHaveBeenCalledTimes(1);
      return { ...linked, contentBlocks: proposedBlocks, contentBlocksRevision: 8 };
    });

    const response = await request(app())
      .put("/api/profiles/profile-a")
      .send(saveBody({ contentBlocks: proposedBlocks, expectedContentBlocksRevision: 7 }, linked));

    expect(response.status).toBe(200);
    expect(response.body.siteTemplate).toBe("wholesaler");
    expect(mocks.storage.getBusinessPublicById).toHaveBeenCalledTimes(1);
  });

  it("keeps missing and foreign profiles indistinguishable before checking the revision", async () => {
    mocks.storage.getProfileByIdForOwner.mockResolvedValue(undefined);

    const missing = await request(app())
      .put("/api/profiles/missing")
      .send({ contentBlocks: proposedBlocks });
    const foreign = await request(app())
      .put("/api/profiles/foreign")
      .send({ contentBlocks: proposedBlocks, expectedContentBlocksRevision: 7 });

    expect(missing.status).toBe(404);
    expect(foreign.status).toBe(404);
    expect(missing.body).toEqual(foreign.body);
    expect(mocks.storage.updateProfileForOwnerWithContentBlocksRevision).not.toHaveBeenCalled();
    expect(mocks.notifyIndexNow).not.toHaveBeenCalled();
  });

  it("requires the loaded content revision for an owned whole-array save", async () => {
    const response = await request(app())
      .put("/api/profiles/profile-a")
      .send({ contentBlocks: proposedBlocks });

    expect(response.status).toBe(428);
    expect(response.body.code).toBe("PROFILE_CONTENT_BLOCKS_REVISION_REQUIRED");
    expect(mocks.storage.updateProfileForOwnerWithContentBlocksRevision).not.toHaveBeenCalled();
    expect(mocks.notifyIndexNow).not.toHaveBeenCalled();
  });

  it("requires every client-loaded target identity field after ownership is established", async () => {
    const missing = await request(app())
      .put("/api/profiles/profile-a")
      .send({ contentBlocks: proposedBlocks, expectedContentBlocksRevision: 7 });
    expect(missing.status).toBe(428);
    expect(missing.body.code).toBe("PROFILE_TARGET_IDENTITY_REQUIRED");

    for (const key of Object.keys(expectedIdentity())) {
      const incomplete: Record<string, unknown> = { ...expectedIdentity() };
      delete incomplete[key];
      const response = await request(app())
        .put("/api/profiles/profile-a")
        .send({ contentBlocks: proposedBlocks, expectedContentBlocksRevision: 7, expectedProfileIdentity: incomplete });
      expect(response.status).toBe(428);
      expect(response.body.code).toBe("PROFILE_TARGET_IDENTITY_REQUIRED");
    }
    expect(mocks.storage.updateProfileForOwnerWithContentBlocksRevision).not.toHaveBeenCalled();
    expect(mocks.notifyIndexNow).not.toHaveBeenCalled();
  });

  it("does not accept owner or visibility fields as generic profile updates", async () => {
    for (const attempted of [
      { ownerUserId: "owner-b" },
      { status: "published" },
      { publiclyReleased: true },
    ]) {
      const response = await request(app())
        .put("/api/profiles/profile-a")
        .send(saveBody({ ...attempted, expectedContentBlocksRevision: 7 }));
      expect(response.status).toBe(400);
      expect(response.body.code).toBe("PROFILE_TARGET_FIELD_READ_ONLY");
    }
    expect(mocks.storage.updateProfileForOwnerWithContentBlocksRevision).not.toHaveBeenCalled();
  });

  it.each(targetChanges)("rejects a %s that happened before the server read", async (_label, change) => {
    mocks.storage.getProfileByIdForOwner.mockResolvedValue({ ...existing, ...change });
    const response = await request(app())
      .put("/api/profiles/profile-a")
      .send(saveBody({ contentBlocks: proposedBlocks, expectedContentBlocksRevision: 7 }));
    expect(response.status).toBe(409);
    expect(response.body.code).toBe("PROFILE_TARGET_CHANGED");
    expect(mocks.storage.updateProfileForOwnerWithContentBlocksRevision).not.toHaveBeenCalled();
    expect(mocks.notifyIndexNow).not.toHaveBeenCalled();
  });

  it("classifies a target change after the pre-read separately from a revision conflict", async () => {
    mocks.storage.getProfileByIdForOwner
      .mockResolvedValueOnce(existing)
      .mockResolvedValueOnce({ ...existing, businessId: "business-b" });
    mocks.storage.updateProfileForOwnerWithContentBlocksRevision.mockResolvedValue(undefined);
    const response = await request(app())
      .put("/api/profiles/profile-a")
      .send(saveBody({ contentBlocks: proposedBlocks, expectedContentBlocksRevision: 7 }));
    expect(response.status).toBe(409);
    expect(response.body.code).toBe("PROFILE_TARGET_CHANGED");
    expect(response.body.currentContentBlocksRevision).toBe(7);
    expect(mocks.notifyIndexNow).not.toHaveBeenCalled();
  });

  it("normalizes the loaded and persisted custom domain before comparing identity", async () => {
    const withDomain = { ...existing, seoMeta: { customDomain: "  EXAMPLE.TEST  " } };
    mocks.storage.getProfileByIdForOwner.mockResolvedValue(withDomain);
    mocks.storage.updateProfileForOwnerWithContentBlocksRevision.mockResolvedValue(withDomain);
    const response = await request(app())
      .put("/api/profiles/profile-a")
      .send(saveBody({ expectedContentBlocksRevision: 7 }, withDomain));
    expect(response.status).toBe(200);
    expect(mocks.storage.updateProfileForOwnerWithContentBlocksRevision).toHaveBeenCalledWith(
      "owner-a", "profile-a", expect.any(Object), 7,
      { ...expectedIdentity(withDomain), customDomain: "example.test" }, undefined
    );
  });

  it("returns only the authorized current revision after a failed atomic update", async () => {
    mocks.storage.getProfileByIdForOwner
      .mockResolvedValueOnce(existing)
      .mockResolvedValueOnce({ ...existing, contentBlocksRevision: 8 });
    mocks.storage.updateProfileForOwnerWithContentBlocksRevision.mockResolvedValue(undefined);

    const response = await request(app())
      .put("/api/profiles/profile-a")
      .send(saveBody({ contentBlocks: proposedBlocks, expectedContentBlocksRevision: 7 }));

    expect(response.status).toBe(409);
    expect(response.body).toMatchObject({
      code: "PROFILE_CONTENT_BLOCKS_STALE",
      currentContentBlocksRevision: 8,
    });
    expect(JSON.stringify(response.body)).not.toContain("Private original");
    expect(mocks.storage.updateProfileForOwnerWithContentBlocksRevision).toHaveBeenCalledWith(
      "owner-a",
      "profile-a",
      expect.objectContaining({ contentBlocks: proposedBlocks }),
      7,
      expectedIdentity(),
      undefined
    );
    expect(mocks.notifyIndexNow).not.toHaveBeenCalled();
  });

  it("rechecks ownership after a failed atomic update", async () => {
    mocks.storage.getProfileByIdForOwner
      .mockResolvedValueOnce(existing)
      .mockResolvedValueOnce(undefined);
    mocks.storage.updateProfileForOwnerWithContentBlocksRevision.mockResolvedValue(undefined);

    const response = await request(app())
      .put("/api/profiles/profile-a")
      .send(saveBody({ contentBlocks: proposedBlocks, expectedContentBlocksRevision: 7 }));

    expect(response.status).toBe(404);
    expect(response.body).toEqual({ message: "Profile not found" });
    expect(mocks.notifyIndexNow).not.toHaveBeenCalled();
  });

  it("publishes the IndexNow event only after a successful owner update", async () => {
    mocks.storage.updateProfileForOwnerWithContentBlocksRevision.mockResolvedValue({
      ...existing,
      contentBlocks: proposedBlocks,
      contentBlocksRevision: 8,
    });

    const response = await request(app())
      .put("/api/profiles/profile-a")
      .send(saveBody({ contentBlocks: proposedBlocks, expectedContentBlocksRevision: 7 }));

    expect(response.status).toBe(200);
    expect(response.body.contentBlocksRevision).toBe(8);
    expect(response.body.siteTemplate).toBe("default");
    expect(mocks.storage.updateProfileForOwner).not.toHaveBeenCalled();
    expect(mocks.storage.updateProfileForOwnerWithContentBlocksRevision).toHaveBeenCalledWith(
      "owner-a",
      "profile-a",
      expect.not.objectContaining({ contentBlocksRevision: expect.anything() }),
      7,
      expectedIdentity(),
      undefined
    );
    const updates = mocks.storage.updateProfileForOwnerWithContentBlocksRevision.mock.calls[0][2];
    for (const field of ["expectedProfileIdentity", "ownerUserId", "status", "publiclyReleased", "customDomain"]) {
      expect(updates).not.toHaveProperty(field);
    }
    expect(mocks.notifyIndexNow).toHaveBeenCalledTimes(1);
  });

  it("requires a revision even when the owner or staff changes only metadata", async () => {
    mocks.storage.getProfileById.mockResolvedValue(existing);

    const owner = await request(app())
      .put("/api/profiles/profile-a")
      .send({ displayName: "Owner edit" });
    const staff = await request(app())
      .put("/api/profiles/profile-a")
      .set("x-test-role", "head_admin")
      .send({ displayName: "Staff edit" });

    expect(owner.status).toBe(428);
    expect(staff.status).toBe(428);
    expect(owner.body.code).toBe("PROFILE_CONTENT_BLOCKS_REVISION_REQUIRED");
    expect(staff.body.code).toBe("PROFILE_CONTENT_BLOCKS_REVISION_REQUIRED");
    expect(mocks.storage.updateProfileForOwner).not.toHaveBeenCalled();
    expect(mocks.storage.updateProfileById).not.toHaveBeenCalled();
    expect(mocks.storage.updateProfileForOwnerWithContentBlocksRevision).not.toHaveBeenCalled();
    expect(mocks.storage.updateProfileByIdWithContentBlocksRevision).not.toHaveBeenCalled();
    expect(mocks.notifyIndexNow).not.toHaveBeenCalled();
  });

  it("preserves omitted metadata fields in an owner content-only request", async () => {
    const newerMetadata = {
      ...existing,
      displayName: "Concurrent metadata",
      headline: "New headline",
      ctaConfig: { primary: { label: "Call", kind: "call", value: "555-0100" } },
      seoMeta: { title: "New title" },
    };
    mocks.storage.getProfileByIdForOwner.mockResolvedValue(newerMetadata);
    mocks.storage.updateProfileForOwnerWithContentBlocksRevision.mockResolvedValue({
      ...newerMetadata,
      contentBlocks: proposedBlocks,
      contentBlocksRevision: 8,
    });

    const response = await request(app())
      .put("/api/profiles/profile-a")
      .send(saveBody({ contentBlocks: proposedBlocks, expectedContentBlocksRevision: 7 }));

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      displayName: "Concurrent metadata",
      headline: "New headline",
      seoMeta: { title: "New title" },
    });
    const payload = mocks.storage.updateProfileForOwnerWithContentBlocksRevision.mock.calls[0][2];
    for (const field of ["displayName", "headline", "ctaConfig", "seoMeta", "roleContext"]) {
      expect(payload).not.toHaveProperty(field);
    }
  });

  it("allows an explicit authorized relink while comparing against the loaded old identity", async () => {
    mocks.storage.updateProfileForOwnerWithContentBlocksRevision.mockResolvedValue({
      ...existing,
      businessId: "business-b",
      roleContext: "contractor",
    });
    const response = await request(app())
      .put("/api/profiles/profile-a")
      .send(saveBody({
        businessId: "business-b",
        roleContext: "contractor",
        expectedContentBlocksRevision: 7,
      }));
    expect(response.status).toBe(200);
    expect(mocks.storage.updateProfileForOwnerWithContentBlocksRevision).toHaveBeenCalledWith(
      "owner-a", "profile-a",
      expect.objectContaining({ businessId: "business-b", roleContext: "contractor" }),
      7,
      expectedIdentity(),
      undefined
    );
  });

  it("passes sparse SEO and CTA changes to the atomic patch path without a route-side merge", async () => {
    mocks.storage.updateProfileForOwnerWithContentBlocksRevision.mockResolvedValue({
      ...existing,
      seoMeta: { title: "Changed", description: "Kept", customDomain: "example.test" },
      ctaConfig: { secondary: { label: "Email", kind: "email", value: "test@example.test" } },
    });
    const response = await request(app())
      .put("/api/profiles/profile-a")
      .send(saveBody({
        expectedContentBlocksRevision: 7,
        seoMetaPatch: { title: "Changed" },
        ctaConfigPatch: { primary: null },
      }));

    expect(response.status).toBe(200);
    expect(mocks.storage.updateProfileForOwnerWithContentBlocksRevision).toHaveBeenCalledWith(
      "owner-a", "profile-a",
      expect.not.objectContaining({ seoMeta: expect.anything(), ctaConfig: expect.anything() }),
      7,
      expectedIdentity(),
      { seoMetaPatch: { title: "Changed" }, ctaConfigPatch: { primary: null } }
    );
  });

  it("rejects mixing full metadata replacement with a patch for the same column", async () => {
    const response = await request(app())
      .put("/api/profiles/profile-a")
      .send(saveBody({
        expectedContentBlocksRevision: 7,
        seoMeta: { title: "Full" },
        seoMetaPatch: { description: "Patch" },
      }));
    expect(response.status).toBe(400);
    expect(response.body.code).toBe("PROFILE_METADATA_PATCH_CONFLICT");
    expect(mocks.storage.updateProfileForOwnerWithContentBlocksRevision).not.toHaveBeenCalled();
    expect(mocks.notifyIndexNow).not.toHaveBeenCalled();
  });

  it("returns staff 404 before a revision error for a missing profile", async () => {
    mocks.storage.getProfileById.mockResolvedValue(undefined);
    const response = await request(app())
      .put("/api/profiles/missing")
      .set("x-test-role", "head_admin")
      .send({ contentBlocks: proposedBlocks });

    expect(response.status).toBe(404);
    expect(response.body).toEqual({ message: "Profile not found" });
    expect(mocks.storage.updateProfileByIdWithContentBlocksRevision).not.toHaveBeenCalled();
    expect(mocks.notifyIndexNow).not.toHaveBeenCalled();
  });

  it("requires staff to send every client-loaded identity field", async () => {
    mocks.storage.getProfileById.mockResolvedValue(existing);
    const response = await request(app())
      .put("/api/profiles/profile-a")
      .set("x-test-role", "head_admin")
      .send({ contentBlocks: proposedBlocks, expectedContentBlocksRevision: 7 });
    expect(response.status).toBe(428);
    expect(response.body.code).toBe("PROFILE_TARGET_IDENTITY_REQUIRED");
    expect(mocks.storage.updateProfileByIdWithContentBlocksRevision).not.toHaveBeenCalled();
  });

  it("gives staff a current revision after a stale CAS without an IndexNow event", async () => {
    mocks.storage.getProfileById
      .mockResolvedValueOnce(existing)
      .mockResolvedValueOnce({ ...existing, contentBlocksRevision: 8 });
    mocks.storage.updateProfileByIdWithContentBlocksRevision.mockResolvedValue(undefined);

    const response = await request(app())
      .put("/api/profiles/profile-a")
      .set("x-test-role", "head_admin")
      .send(saveBody({ contentBlocks: proposedBlocks, expectedContentBlocksRevision: 7 }));

    expect(response.status).toBe(409);
    expect(response.body).toMatchObject({
      code: "PROFILE_CONTENT_BLOCKS_STALE",
      currentContentBlocksRevision: 8,
    });
    expect(JSON.stringify(response.body)).not.toContain("Private original");
    expect(mocks.storage.updateProfileByIdWithContentBlocksRevision).toHaveBeenCalledWith(
      "profile-a",
      expect.objectContaining({ contentBlocks: proposedBlocks }),
      7,
      expectedIdentity(),
      undefined
    );
    expect(mocks.notifyIndexNow).not.toHaveBeenCalled();
  });

  it("rejects a concurrent staff target owner change with no IndexNow event", async () => {
    mocks.storage.getProfileById
      .mockResolvedValueOnce(existing)
      .mockResolvedValueOnce({ ...existing, ownerUserId: "owner-b" });
    mocks.storage.updateProfileByIdWithContentBlocksRevision.mockResolvedValue(undefined);
    const response = await request(app())
      .put("/api/profiles/profile-a")
      .set("x-test-role", "head_admin")
      .send(saveBody({ contentBlocks: proposedBlocks, expectedContentBlocksRevision: 7 }));
    expect(response.status).toBe(409);
    expect(response.body.code).toBe("PROFILE_TARGET_CHANGED");
    expect(mocks.storage.updateProfileByIdWithContentBlocksRevision).toHaveBeenCalledWith(
      "profile-a", expect.objectContaining({ contentBlocks: proposedBlocks }),
      7, expectedIdentity(), undefined
    );
    expect(mocks.notifyIndexNow).not.toHaveBeenCalled();
  });

  it("applies an authorized staff whole-array edit through CAS", async () => {
    mocks.storage.getProfileById.mockResolvedValue(existing);
    mocks.storage.updateProfileByIdWithContentBlocksRevision.mockResolvedValue({
      ...existing,
      contentBlocks: proposedBlocks,
      contentBlocksRevision: 8,
    });

    const response = await request(app())
      .put("/api/profiles/profile-a")
      .set("x-test-role", "head_admin")
      .send(saveBody({ contentBlocks: proposedBlocks, expectedContentBlocksRevision: 7 }));

    expect(response.status).toBe(200);
    expect(response.body.contentBlocksRevision).toBe(8);
    expect(mocks.storage.updateProfileById).not.toHaveBeenCalled();
    expect(mocks.storage.updateProfileByIdWithContentBlocksRevision).toHaveBeenCalledWith(
      "profile-a",
      expect.objectContaining({ contentBlocks: proposedBlocks }),
      7,
      expectedIdentity(),
      undefined
    );
    expect(mocks.notifyIndexNow).toHaveBeenCalledTimes(1);
  });
});
