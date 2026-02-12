import { afterEach, describe, expect, it, vi } from "vitest";
import jwt from "jsonwebtoken";
import { createMealscoutSsoToken } from "../../services/mealscoutClient";

const ORIGINAL_ENV = { ...process.env };

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
  vi.restoreAllMocks();
});

describe("createMealscoutSsoToken", () => {
  it("only includes MealScout allowlisted roles in JWT payload", () => {
    process.env.TRADESCOUT_JWT_SECRET = "test-secret";

    const token = createMealscoutSsoToken({
      id: "user-1",
      email: "user@example.com",
      roles: ["restaurant_owner", "homeowner", "admin", "food_truck_owner", "bar_owner"],
    } as any);

    const decoded = jwt.verify(token, "test-secret") as jwt.JwtPayload;
    expect(decoded.sub).toBe("user-1");
    expect(decoded.email).toBe("user@example.com");
    expect(decoded.roles).toEqual(["restaurant_owner", "food_truck_owner", "bar_owner"]);
  });

  it("supports legacy single role field and drops non-allowlisted role", () => {
    process.env.TRADESCOUT_JWT_SECRET = "test-secret";

    const token = createMealscoutSsoToken({
      id: "user-2",
      email: "legacy@example.com",
      role: "homeowner",
    } as any);

    const decoded = jwt.verify(token, "test-secret") as jwt.JwtPayload;
    expect(decoded.roles).toEqual([]);
  });

  it("throws in production when shared secret is missing", () => {
    process.env.NODE_ENV = "production";
    delete process.env.TRADESCOUT_JWT_SECRET;
    delete process.env.MEALSCOUT_SHARED_SECRET;

    expect(() =>
      createMealscoutSsoToken({
        id: "user-3",
        email: "prod@example.com",
        roles: ["restaurant_owner"],
      } as any)
    ).toThrow("TRADESCOUT_JWT_SECRET or MEALSCOUT_SHARED_SECRET is not configured");
  });

  it("uses dev fallback secret outside production when missing shared secret", () => {
    process.env.NODE_ENV = "test";
    delete process.env.TRADESCOUT_JWT_SECRET;
    delete process.env.MEALSCOUT_SHARED_SECRET;
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    const token = createMealscoutSsoToken({
      id: "user-4",
      email: "dev@example.com",
      roles: ["restaurant_owner", "admin"],
    } as any);

    const decoded = jwt.verify(token, "dev-insecure-tradescout-jwt-secret") as jwt.JwtPayload;
    expect(decoded.roles).toEqual(["restaurant_owner"]);
    expect(warnSpy).toHaveBeenCalledTimes(1);
  });
});
