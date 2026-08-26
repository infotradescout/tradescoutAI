import { describe, expect, it, vi } from "vitest";
import {
  activateCommunityBuilder,
  CommunityBuilderActivationError,
} from "./communityBuilderActivation";

describe("Community Builder dashboard activation", () => {
  it("posts an explicit empty JSON payload to the profile activation endpoint", async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({ id: "builder-1" }),
    } as unknown as Response);

    await expect(activateCommunityBuilder(fetchImpl as typeof fetch)).resolves.toEqual({
      id: "builder-1",
    });
    expect(fetchImpl).toHaveBeenCalledWith("/api/community-builder/profile", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{}",
    });
  });

  it("preserves the server's actionable county failure", async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: false,
      json: vi.fn().mockResolvedValue({
        error: "A verified county is required to activate Community Builder.",
        code: "COMMUNITY_BUILDER_COUNTY_REQUIRED",
        action: "Open Profile Settings and choose your county, then try again.",
      }),
    } as unknown as Response);

    const error = await activateCommunityBuilder(fetchImpl as typeof fetch).catch(
      (caught) => caught
    );

    expect(error).toBeInstanceOf(CommunityBuilderActivationError);
    expect(error).toMatchObject({
      message: "A verified county is required to activate Community Builder.",
      code: "COMMUNITY_BUILDER_COUNTY_REQUIRED",
      action: "Open Profile Settings and choose your county, then try again.",
    });
  });
});
