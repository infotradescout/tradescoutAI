import type { Express, Request, Response } from "express";
import { and, eq, sql } from "drizzle-orm";
import { db } from "../db";
import { isAuthenticated } from "../auth";
import { storage } from "../storage";
import { emailService } from "../services/emailService";
import { emailVerificationService } from "../services/emailVerificationService";
import { passwordResetService } from "../services/passwordResetService";
import { writeClaimEvent } from "../services/claimEventService";
import { ClaimSource, ClaimType } from "../services/claimEventSchema";
import { businesses, counties } from "@shared/schema";

function normalizeClaimEmail(value: unknown): string {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

function normalizeClaimPhone(value: unknown): string {
  const digits = typeof value === "string" ? value.replace(/\D/g, "") : "";
  if (digits.length > 10) return digits.slice(-10);
  return digits;
}

function normalizeClaimWebsiteDomain(value: unknown): string {
  if (typeof value !== "string") return "";
  let raw = value.trim().toLowerCase();
  if (!raw) return "";

  try {
    if (!raw.includes("://")) raw = `https://${raw}`;
    return new URL(raw).hostname
      .replace(/^www\./, "")
      .replace(/\.$/, "")
      .trim();
  } catch {
    return "";
  }
}

function getClaimEmailDomain(email: string): string {
  const at = email.lastIndexOf("@");
  return at >= 0
    ? email
        .slice(at + 1)
        .trim()
        .toLowerCase()
    : "";
}

function normalizeClaimCountyName(value: unknown): string {
  return typeof value === "string"
    ? value
        .trim()
        .toLowerCase()
        .replace(/\s+(county|parish|borough|census area|municipality|district)$/i, "")
        .replace(/[^a-z0-9]+/g, " ")
        .trim()
    : "";
}

function cleanString(value: unknown, max = 500): string {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

const getGeneralSetting = async <T>(key: string, fallback: T): Promise<T> => {
  try {
    const settings = await storage.getSiteSettings("general");
    const match = settings.find(
      (setting: any) => setting.key === key && setting.isActive !== false
    );
    return (
      match && typeof (match as any).value !== "undefined" ? (match as any).value : fallback
    ) as T;
  } catch {
    return fallback;
  }
};

function getPublicBaseUrlFromRequest(req: Request): string {
  const configured = process.env.PUBLIC_WEB_URL || process.env.APP_BASE_URL || process.env.APP_URL;
  if (configured) return configured;
  const host = req.get("host") || "localhost:5000";
  const protocol = req.get("x-forwarded-proto") || req.protocol || "http";
  return `${protocol}://${host}`;
}

function parseGooglePlace(body: any) {
  const rawGooglePlace =
    body.googlePlace && typeof body.googlePlace === "object" ? body.googlePlace : {};
  return {
    businessName: cleanString(rawGooglePlace.businessName ?? rawGooglePlace.name ?? body.name, 160),
    placeId: cleanString(rawGooglePlace.placeId ?? rawGooglePlace.place_id, 256),
    address: cleanString(rawGooglePlace.address ?? rawGooglePlace.formatted_address, 500),
    city: cleanString(rawGooglePlace.city, 120),
    stateCode: cleanString(rawGooglePlace.stateCode, 2).toUpperCase(),
    countyName: cleanString(rawGooglePlace.countyName, 160),
    phone: cleanString(rawGooglePlace.phone ?? rawGooglePlace.formatted_phone_number, 80),
    website: cleanString(rawGooglePlace.website, 500),
    lat:
      typeof rawGooglePlace.lat === "number" && Number.isFinite(rawGooglePlace.lat)
        ? rawGooglePlace.lat
        : null,
    lng:
      typeof rawGooglePlace.lng === "number" && Number.isFinite(rawGooglePlace.lng)
        ? rawGooglePlace.lng
        : null,
  };
}

async function resolveClaimCounty(args: {
  requestedCountyFips: string;
  stateCode: string;
  googleCountyName?: string;
}) {
  let countyRows: Array<{ id: string; fips: string; stateCode: string; name: string }> = [];

  if (/^\d{5}$/.test(args.requestedCountyFips)) {
    countyRows = await db
      .select({
        id: counties.id,
        fips: counties.fips,
        stateCode: counties.stateCode,
        name: counties.name,
      })
      .from(counties)
      .where(
        and(eq(counties.fips, args.requestedCountyFips), eq(counties.stateCode, args.stateCode))
      )
      .limit(1);
  }

  if (!countyRows[0] && args.googleCountyName) {
    const normalizedPlaceCounty = normalizeClaimCountyName(args.googleCountyName);
    if (normalizedPlaceCounty) {
      const stateCountyRows = await db
        .select({
          id: counties.id,
          fips: counties.fips,
          stateCode: counties.stateCode,
          name: counties.name,
        })
        .from(counties)
        .where(eq(counties.stateCode, args.stateCode));

      const matchedCounty = stateCountyRows.find((row) => {
        const normalizedRowCounty = normalizeClaimCountyName(row.name);
        return (
          normalizedRowCounty === normalizedPlaceCounty ||
          normalizedRowCounty.includes(normalizedPlaceCounty)
        );
      });
      countyRows = matchedCounty ? [matchedCounty] : [];
    }
  }

  return countyRows[0] || null;
}

export function registerBusinessClaimRoutes(app: Express) {
  app.get("/api/business-claim/search", async (req: Request, res: Response) => {
    try {
      const q = typeof req.query.q === "string" ? req.query.q.trim() : "";
      const countyFips =
        typeof req.query.countyFips === "string" ? req.query.countyFips.trim() : "";
      const stateCode =
        typeof req.query.stateCode === "string" ? req.query.stateCode.trim().toUpperCase() : "";
      const placeId = cleanString(req.query.placeId, 256);
      const phone = normalizeClaimPhone(req.query.phone);
      const websiteDomain = normalizeClaimWebsiteDomain(req.query.website);
      const limitRaw = typeof req.query.limit === "string" ? parseInt(req.query.limit, 10) : 10;
      const limit = Number.isFinite(limitRaw) ? Math.max(1, Math.min(25, limitRaw)) : 10;
      const hasMapsSignals = Boolean(placeId || phone || websiteDomain);

      if (q.length < 2 && !hasMapsSignals) return res.json({ items: [] });

      const likeQ = `%${q.toLowerCase()}%`;
      const websiteLike = `%${websiteDomain}%`;
      const rowsResult = (await db.execute(sql`
        select
          b.id,
          b.name,
          b.slug,
          b.type,
          b.status,
          b.claim_status as "claimStatus",
          b.sources,
          coalesce(
            json_agg(distinct jsonb_build_object(
              'fips', co.fips,
              'stateCode', co.state_code,
              'name', co.name
            )) filter (where co.fips is not null),
            '[]'::json
          ) as counties
        from businesses b
        left join business_counties bc on bc.business_id = b.id
        left join counties co on co.id = bc.county_id
        where b.status <> 'suspended'
          and b.owner_user_id is null
          and b.claim_status = 'unclaimed'
          and (
            ${q.length >= 2 ? sql`lower(b.name) like ${likeQ} or lower(b.slug) like ${likeQ}` : sql`false`}
            or ${
              placeId
                ? sql`
                  coalesce(b.profile_data -> 'importExtras' ->> 'google_place_id', '') = ${placeId}
                  or coalesce(b.profile_data -> 'importExtras' ->> 'place_id', '') = ${placeId}
                  or coalesce(b.profile_data -> 'importExtras' ->> 'external_id', '') = ${placeId}
                `
                : sql`false`
            }
            or ${
              phone
                ? sql`
                  regexp_replace(coalesce(b.profile_data->>'phone',''), '\\D','','g') = ${phone}
                  or regexp_replace(coalesce(b.profile_data -> 'importExtras' ->> 'google_place_phone',''), '\\D','','g') = ${phone}
                `
                : sql`false`
            }
            or ${
              websiteDomain
                ? sql`
                  lower(coalesce(b.profile_data->>'website','')) like ${websiteLike}
                  or lower(coalesce(b.profile_data -> 'importExtras' ->> 'google_place_website','')) like ${websiteLike}
                `
                : sql`false`
            }
          )
          ${countyFips ? sql`and co.fips = ${countyFips}` : sql``}
          ${stateCode ? sql`and co.state_code = ${stateCode}` : sql``}
        group by b.id, b.name, b.slug, b.type, b.status
        order by b.name asc
        limit ${limit}
      `)) as any;

      res.json({ items: Array.isArray(rowsResult?.rows) ? rowsResult.rows : [] });
    } catch (error: any) {
      console.error("Error searching claimable businesses:", error);
      res.status(500).json({ message: "Failed to search businesses" });
    }
  });

  app.get("/api/business-claim/resolve", async (req: Request, res: Response) => {
    try {
      const slug = typeof req.query.slug === "string" ? req.query.slug.trim() : "";
      const businessId =
        typeof req.query.businessId === "string" ? req.query.businessId.trim() : "";
      if (!slug && !businessId) {
        return res.status(400).json({ message: "slug or businessId is required" });
      }

      const rowsResult = (await db.execute(sql`
        select
          b.id,
          b.name,
          b.slug,
          b.type,
          b.status,
          b.claim_status as "claimStatus",
          b.sources,
          coalesce(
            json_agg(distinct jsonb_build_object(
              'fips', co.fips,
              'stateCode', co.state_code,
              'name', co.name
            )) filter (where co.fips is not null),
            '[]'::json
          ) as counties
        from businesses b
        left join business_counties bc on bc.business_id = b.id
        left join counties co on co.id = bc.county_id
        where ${businessId ? sql`b.id = ${businessId}` : sql`b.slug = ${slug}`}
          and b.status <> 'suspended'
          and b.owner_user_id is null
          and b.claim_status = 'unclaimed'
        group by b.id, b.name, b.slug, b.type, b.status
        limit 1
      `)) as any;

      const row = Array.isArray(rowsResult?.rows) ? rowsResult.rows[0] : null;
      if (!row) return res.status(404).json({ message: "Business not found" });
      return res.json({ business: row });
    } catch (error: any) {
      console.error("Error resolving claim business slug:", error);
      return res.status(500).json({ message: "Failed to resolve business" });
    }
  });

  app.post("/api/business-claim/find-or-create", async (req: Request, res: Response) => {
    try {
      const body = (req.body ?? {}) as any;
      const googlePlace = parseGooglePlace(body);
      const name = cleanString(body.name, 160) || googlePlace.businessName;
      const stateCode = (cleanString(body.stateCode, 2) || googlePlace.stateCode).toUpperCase();
      const requestedCountyFips = cleanString(body.countyFips, 5);
      const email = normalizeClaimEmail(body.email);
      const rawPhone = cleanString(body.phone, 80) || googlePlace.phone;
      const rawWebsite = cleanString(body.website, 500) || googlePlace.website;
      const phone = normalizeClaimPhone(rawPhone);
      const websiteDomain = normalizeClaimWebsiteDomain(rawWebsite);
      const category = cleanString(body.category, 120);
      const type = cleanString(body.type, 40) || "contractor";
      const roleContext = cleanString(body.roleContext, 64) || "contractor";

      if (name.length < 2) return res.status(400).json({ message: "name is required" });
      if (!/^[A-Z]{2}$/.test(stateCode)) {
        return res.status(400).json({ message: "stateCode is required (2-letter code)" });
      }

      const county = await resolveClaimCounty({
        requestedCountyFips,
        stateCode,
        googleCountyName: googlePlace.countyName,
      });
      if (!county) {
        return res.status(400).json({
          message:
            "countyFips is required (5-digit FIPS) unless the Google Maps listing includes a county",
        });
      }

      const existingResult = (await db.execute(sql`
        select
          b.id,
          b.name,
          b.slug,
          b.type,
          b.status,
          b.claim_status as "claimStatus",
          b.sources,
          coalesce(
            json_agg(distinct jsonb_build_object(
              'fips', co.fips,
              'stateCode', co.state_code,
              'name', co.name
            )) filter (where co.fips is not null),
            '[]'::json
          ) as counties
        from businesses b
        left join business_counties bc on bc.business_id = b.id
        left join counties co on co.id = bc.county_id
        where b.status <> 'suspended'
          and b.owner_user_id is null
          and b.claim_status = 'unclaimed'
          and (
            ${email ? sql`lower(coalesce(b.profile_data->>'email','')) = ${email}` : sql`false`}
            or ${phone ? sql`regexp_replace(coalesce(b.profile_data->>'phone',''), '\\D','','g') = ${phone}` : sql`false`}
            or ${websiteDomain ? sql`lower(coalesce(b.profile_data->>'website','')) like ${`%${websiteDomain}%`}` : sql`false`}
            or ${
              googlePlace.placeId
                ? sql`
              coalesce(b.profile_data -> 'importExtras' ->> 'google_place_id', '') = ${googlePlace.placeId}
              or coalesce(b.profile_data -> 'importExtras' ->> 'place_id', '') = ${googlePlace.placeId}
              or coalesce(b.profile_data -> 'importExtras' ->> 'external_id', '') = ${googlePlace.placeId}
            `
                : sql`false`
            }
            or (lower(b.name) = ${name.toLowerCase()} and co.fips = ${county.fips} and co.state_code = ${stateCode})
          )
        group by b.id, b.name, b.slug, b.type, b.status
        order by b.name asc
        limit 1
      `)) as any;

      const existing = Array.isArray(existingResult?.rows) ? existingResult.rows[0] : null;
      if (existing) return res.json({ created: false, business: existing });

      const importExtras: Record<string, string> = {
        ...(googlePlace.placeId ? { google_place_id: googlePlace.placeId } : {}),
        ...(googlePlace.businessName ? { google_place_name: googlePlace.businessName } : {}),
        ...(googlePlace.address ? { google_place_address: googlePlace.address } : {}),
        ...(googlePlace.city ? { google_place_city: googlePlace.city } : {}),
        ...(googlePlace.stateCode ? { google_place_state_code: googlePlace.stateCode } : {}),
        ...(googlePlace.countyName ? { google_place_county_name: googlePlace.countyName } : {}),
        ...(googlePlace.phone ? { google_place_phone: googlePlace.phone } : {}),
        ...(googlePlace.website ? { google_place_website: googlePlace.website } : {}),
        ...(googlePlace.lat !== null ? { google_place_lat: String(googlePlace.lat) } : {}),
        ...(googlePlace.lng !== null ? { google_place_lng: String(googlePlace.lng) } : {}),
        ...(googlePlace.placeId ? { google_place_source: "places_autocomplete" } : {}),
      };

      const created = await storage.createUnclaimedBusiness({
        name,
        slug: name,
        type: (["contractor", "community", "vendor", "other"].includes(type)
          ? type
          : "contractor") as any,
        roleContext,
        status: "active" as any,
        profileData: {
          ...(category ? { category } : {}),
          ...(email ? { email } : {}),
          ...(phone ? { phone } : {}),
          ...(rawWebsite ? { website: rawWebsite } : {}),
          ...(googlePlace.address ? { address: googlePlace.address } : {}),
          ...(googlePlace.city ? { city: googlePlace.city } : {}),
          ...(stateCode ? { stateCode } : {}),
          ...(Object.keys(importExtras).length > 0 ? { importExtras } : {}),
          contactPreference: "message",
        } as any,
        sources: googlePlace.placeId ? ["lazy_seed", "google_maps_places"] : ["lazy_seed"],
        countyIds: [county.id],
      } as any);

      return res.status(201).json({
        created: true,
        business: {
          id: created.id,
          name: created.name,
          slug: created.slug,
          type: created.type,
          status: created.status,
          claimStatus: created.claimStatus,
          counties: [{ fips: county.fips, stateCode: county.stateCode, name: county.name }],
        },
      });
    } catch (error: any) {
      console.error("Error creating claimable business:", error);
      return res.status(500).json({ message: "Failed to create business shell" });
    }
  });

  app.post("/api/business-claim/claim", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const userId = (req.user as any)?.id || (req.user as any)?.claims?.sub;
      if (!userId) return res.status(401).json({ message: "Not authenticated" });

      const businessId = cleanString((req.body as any)?.businessId, 128);
      if (!businessId) return res.status(400).json({ message: "businessId is required" });

      const user = await storage.getUser(String(userId));
      if (!user) return res.status(404).json({ message: "User not found" });

      const rows = await db
        .select({
          id: businesses.id,
          slug: businesses.slug,
          ownerUserId: businesses.ownerUserId,
          claimStatus: businesses.claimStatus,
          status: businesses.status,
          profileData: businesses.profileData,
        })
        .from(businesses)
        .where(eq(businesses.id, businessId))
        .limit(1);

      const biz = rows[0] as any;
      if (!biz || biz.status === "suspended") {
        return res.status(404).json({ message: "Business not found" });
      }
      if (biz.ownerUserId || biz.claimStatus !== "unclaimed") {
        return res.status(409).json({ message: "Business already claimed" });
      }

      const signupEmail = normalizeClaimEmail((user as any).email);
      const signupPhone = normalizeClaimPhone((user as any).phone);
      const signupEmailDomain = getClaimEmailDomain(signupEmail);
      const bizEmail = normalizeClaimEmail(biz.profileData?.email);
      const bizPhone = normalizeClaimPhone(biz.profileData?.phone);
      const bizWebsiteDomain = normalizeClaimWebsiteDomain(biz.profileData?.website);

      const emailIsVerified = (user as any).emailVerified === true;
      const phoneVerification = signupPhone
        ? await storage.getAddressVerificationByUserId(String(userId))
        : undefined;
      const phoneIsVerified =
        Boolean(phoneVerification?.phoneVerifiedAt) &&
        normalizeClaimPhone(phoneVerification?.phoneNumber) === signupPhone;
      const verifiedByEmail = emailIsVerified && Boolean(bizEmail) && bizEmail === signupEmail;
      const verifiedByPhone =
        phoneIsVerified && Boolean(bizPhone) && bizPhone.length >= 10 && bizPhone === signupPhone;
      const verifiedByWebsite =
        emailIsVerified &&
        Boolean(bizWebsiteDomain) &&
        Boolean(signupEmailDomain) &&
        bizWebsiteDomain === signupEmailDomain;

      if (!verifiedByEmail && !verifiedByPhone && !verifiedByWebsite) {
        return res.status(403).json({
          message:
            "Claim requires a verified email, verified phone, or verified email domain that matches the business on file.",
          code: "CLAIM_NOT_VERIFIED",
        });
      }

      const claimed = await storage.claimUnclaimedBusinessForUser(biz.id, String(userId));
      const canonicalProfile = (claimed as any).canonicalProfile;
      if (!canonicalProfile?.id || !canonicalProfile?.slug) {
        throw new Error("Claim did not attach a canonical profile");
      }
      const profileSlug = String(canonicalProfile.slug);
      return res.json({
        status: "claimed",
        businessId: claimed.id,
        slug: claimed.slug,
        profileId: canonicalProfile.id,
        profileSlug,
        profileEditPath: `/u/${encodeURIComponent(profileSlug)}/edit`,
      });
    } catch (error: any) {
      console.error("Error claiming business:", error);
      if (
        [
          "Business is not claimable",
          "Business has multiple linked canonical profiles",
          "Linked canonical profile belongs to another account",
        ].includes(String(error?.message || ""))
      ) {
        return res.status(409).json({
          message: "This business claim changed or needs account support. Refresh and try again.",
          code: "CLAIM_CONFLICT",
        });
      }
      return res.status(500).json({ message: "Failed to claim business" });
    }
  });

  app.post("/api/business-claim/request", async (req: Request, res: Response) => {
    try {
      const normalizedSlug = cleanString((req.body as any)?.slug, 160);
      const normalizedEmail = normalizeClaimEmail((req.body as any)?.email);

      if (!normalizedSlug || !normalizedEmail) {
        return res.status(400).json({ message: "slug and email are required" });
      }

      const user = await storage.getUserByEmail(normalizedEmail);
      const generic = {
        message: "If that email matches the business on file, a claim link has been sent.",
      };

      if (!user || !user.businessSlug || String(user.businessSlug) !== String(normalizedSlug)) {
        return res.json(generic);
      }

      const emailVerificationRequired = await getGeneralSetting<boolean>(
        "email_verification_required",
        true
      );
      const { token, expiresAt } = await passwordResetService.createToken(user.id);
      const resetBase =
        process.env.PASSWORD_RESET_URL ||
        process.env.APP_BASE_URL ||
        getPublicBaseUrlFromRequest(req);
      const resetLink = `${resetBase.replace(/\/$/, "")}/reset-password?token=${token}`;

      let verifyLink: string | null = null;
      if (emailVerificationRequired && user.emailVerified !== true) {
        const verify = await emailVerificationService.createToken(user.id);
        const verifyBase = getPublicBaseUrlFromRequest(req);
        verifyLink = `${verifyBase.replace(/\/$/, "")}/verify-email?token=${verify.token}&next=${encodeURIComponent("/pre-scout-setup")}`;
      }

      if (emailService.isConfigured()) {
        await emailService.sendEmail({
          to: user.email,
          subject: "Claim your business on TradeScout",
          html: `<p>Use this link to set your password and claim your business account.</p>
<p><a href="${resetLink}">Claim my business</a>. This link expires in ${Math.round((expiresAt - Date.now()) / 60000)} minutes.</p>
${verifyLink ? `<p><a href="${verifyLink}">Verify my email</a> (required)</p>` : ""}`,
          text: `Claim your business: ${resetLink}`,
          purpose: "claim_business",
        });
      } else {
        console.warn(`[business-claim] Email not configured; token generated for ${user.email}`);
      }

      try {
        const countyFips = String((user as any).countyFips || "");
        const countyName = String((user as any).countyName || "");
        if (/^[0-9]{5}$/.test(countyFips) && countyName) {
          await writeClaimEvent({
            userId: user.id,
            claimType: ClaimType.REPRESENTS_BUSINESS,
            countyFips,
            countyName,
            source: ClaimSource.DIRECT_CLAIM,
            claimTimestamp: new Date(),
            metadata: { slug: normalizedSlug },
          });
        }
      } catch (e) {
        console.warn("[business-claim] claim write failed", e);
      }

      return res.json(generic);
    } catch (error: any) {
      console.error("Error requesting business claim:", error);
      return res.status(500).json({ message: "Failed to request claim" });
    }
  });
}
