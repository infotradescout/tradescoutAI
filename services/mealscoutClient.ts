import axios from "axios";
import jwt from "jsonwebtoken";
import type { User } from "@shared/schema";

/**
 * Minimal MealScout client for TradeScout controllers.
 * Uses a single action endpoint with bearer token auth.
 */
export async function mealscoutAction(action: string, params: Record<string, any> = {}) {
  if (!process.env.MEALSCOUT_API_TOKEN) {
    throw new Error("MEALSCOUT_API_TOKEN is not configured");
  }

  const res = await axios.post(
    "https://mealscout.yourdomain.com/api/actions",
    { action, params },
    {
      headers: {
        Authorization: `Bearer ${process.env.MEALSCOUT_API_TOKEN}`,
      },
      timeout: 15_000,
    }
  );

  return res.data;
}

const MEALSCOUT_BASE_URL = process.env.MEALSCOUT_BASE_URL;

const MEALSCOUT_SSO_URL =
  process.env.MEALSCOUT_SSO_URL ||
  (MEALSCOUT_BASE_URL
    ? `${MEALSCOUT_BASE_URL.replace(/\/+$/, "")}/api/auth/tradescout/sso`
    : "https://mealscout.yourdomain.com/api/auth/tradescout/sso");

const TRADESCOUT_JWT_FALLBACK_SECRET = "dev-insecure-tradescout-jwt-secret";

export function createMealscoutSsoToken(user: User): string {
  const secret = process.env.TRADESCOUT_JWT_SECRET || process.env.MEALSCOUT_SHARED_SECRET;

  if (!secret) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("TRADESCOUT_JWT_SECRET or MEALSCOUT_SHARED_SECRET is not configured");
    }
    console.warn(
      "[MealScoutSSO] TRADESCOUT_JWT_SECRET/MEALSCOUT_SHARED_SECRET missing; using insecure dev-only fallback"
    );
  }

  const effectiveSecret = secret || TRADESCOUT_JWT_FALLBACK_SECRET;

  const rolesRaw: any[] = Array.isArray((user as any).roles)
    ? ((user as any).roles as any[])
    : (user as any).role
      ? [(user as any).role]
      : [];
  const roles = rolesRaw.filter((r) => typeof r === "string");

  // Brand/role firewall:
  // MealScout and TradeScout share identity (sub/email) but NOT role authority.
  // Only send MealScout-meaningful merchant roles across; never leak TradeScout roles.
  const MEALSCOUT_ROLE_ALLOWLIST = new Set<string>([
    "restaurant_owner",
    "food_truck_owner",
    "bar_owner",
  ]);
  const mealscoutRoles = roles.filter((r) => MEALSCOUT_ROLE_ALLOWLIST.has(r));

  const givenName = (user as any).firstName || (user as any).given_name;
  const familyName = (user as any).lastName || (user as any).family_name;

  const payload: jwt.JwtPayload = {
    sub: String((user as any).id || (user as any).claims?.sub || ""),
    email: (user as any).email,
    name: [givenName, familyName].filter(Boolean).join(" ") || undefined,
    given_name: givenName,
    family_name: familyName,
    roles: mealscoutRoles,
  };

  if (!payload.sub) {
    throw new Error("Cannot create MealScout SSO token without a user id");
  }

  return jwt.sign(payload, effectiveSecret, {
    algorithm: "HS256",
    expiresIn: "30m",
    issuer: "tradescout",
  });
}

/**
 * Establish a user-scoped SSO session with MealScout using a TradeScout-signed JWT.
 *
 * The JWT uses TRADESCOUT_JWT_SECRET and carries:
 * - sub: stable TradeScout user id
 * - email: user email
 * - name / given_name / family_name
 * - roles: array of role strings
 *
 * Returns any Set-Cookie headers from MealScout so the caller can forward them
 * to the browser.
 */
export async function ensureMealscoutSsoSession(user: User) {
  const token = createMealscoutSsoToken(user);

  const res = await axios.post(
    MEALSCOUT_SSO_URL,
    {},
    {
      headers: {
        Authorization: `Bearer ${token}`,
      },
      // We only need headers + status; MealScout controls response body shape.
      validateStatus: (status) => status >= 200 && status < 500,
    }
  );

  if (res.status >= 400) {
    throw new Error(`MealScout SSO failed with status ${res.status}`);
  }

  const setCookie = res.headers["set-cookie"] as string[] | undefined;

  return {
    ok: true,
    status: res.status,
    cookies: Array.isArray(setCookie) ? setCookie : setCookie ? [setCookie] : [],
  };
}
