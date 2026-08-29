import { describe, expect, it, vi } from "vitest";
import { users } from "@shared/schema";
import { writeProfileDomainPreferences } from "../profileDomainPreferenceWriter";

describe("profile-domain preference writer", () => {
  it("persists the complete transition through the user preference column", async () => {
    const where = vi.fn(async () => ({ rowCount: 1 }));
    const set = vi.fn(() => ({ where }));
    const update = vi.fn(() => ({ set }));
    const preferences = {
      theme: "dark",
      profileDomainStates: {
        "profile-a": { candidateDomain: "profile.example" },
      },
    };

    await writeProfileDomainPreferences({
      database: { update },
      userId: "owner-a",
      preferences,
    });

    expect(update).toHaveBeenCalledWith(users);
    expect(set).toHaveBeenCalledTimes(1);
    expect(set.mock.calls[0][0]).toMatchObject({ preferences });
    expect(set.mock.calls[0][0].updatedAt).toBeInstanceOf(Date);
    expect(where).toHaveBeenCalledTimes(1);
  });
});
