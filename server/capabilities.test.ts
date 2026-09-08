import { describe, expect, it } from "vitest";
import { resolveCapabilities } from "./capabilities";

describe("resolveCapabilities admin authority", () => {
  it.each(["hoa_admin", "assistant_admin", "organization_admin"])(
    "does not infer admin capability from %s",
    (role) => {
      expect(resolveCapabilities({ user: { role } } as any).admin).toBe("unavailable");
    }
  );

  it("honors canonical persisted admin tiers and flags", () => {
    expect(resolveCapabilities({ user: { role: "ops_admin" } } as any).admin).toBe("ok");
    expect(resolveCapabilities({ user: { roles: ["moderator"] } } as any).admin).toBe("ok");
    expect(resolveCapabilities({ user: { role: "homeowner", isAdmin: true } } as any).admin).toBe(
      "ok"
    );
  });
});
