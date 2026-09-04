import { describe, expect, it, vi } from "vitest";
import { validateProfileTargetAuthority } from "../services/profileTargetAuthority";

function store(overrides: Record<string, unknown> = {}) {
  return {
    getBusinessByIdForOwner: vi.fn().mockResolvedValue({ id: "business-1" }),
    getRealtorProfileByUserId: vi
      .fn()
      .mockResolvedValue({ verificationStatus: "approved", isActive: true }),
    getCarSalesmanProfileByUserId: vi
      .fn()
      .mockResolvedValue({ verificationStatus: "approved", isActive: true }),
    ...overrides,
  } as any;
}

describe("Profile target authority", () => {
  it("rejects a linked business not owned by the Profile owner", async () => {
    await expect(
      validateProfileTargetAuthority({
        storage: store({ getBusinessByIdForOwner: vi.fn().mockResolvedValue(undefined) }),
        ownerUserId: "owner-1",
        businessId: "other-business",
        roleContext: "homeowner",
      })
    ).resolves.toMatchObject({
      ok: false,
      status: 404,
      code: "PROFILE_BUSINESS_OWNERSHIP_REQUIRED",
    });
  });

  it.each([
    ["realtor", "getRealtorProfileByUserId"],
    ["car_dealer", "getCarSalesmanProfileByUserId"],
  ])("requires a durable active approval for %s", async (roleContext, method) => {
    await expect(
      validateProfileTargetAuthority({
        storage: store({
          [method]: vi.fn().mockResolvedValue({
            verificationStatus: "approved",
            isActive: false,
          }),
        }),
        ownerUserId: "owner-1",
        roleContext,
      })
    ).resolves.toMatchObject({
      ok: false,
      status: 403,
      code: "PROFESSIONAL_APPROVAL_REQUIRED",
    });
  });
});
