import { db } from "./db";
import { storage } from "./storage";
import { carSalesmanProfiles, realtorProfiles } from "../shared/schema";
import { eq } from "drizzle-orm";

export type ProviderEligibilityScope = "state" | "county";
export type ProviderEligibilityBasis = "state_license" | "county_license" | "verified_exception";

export type ComputedProviderEligibility = {
  jurisdictionType: ProviderEligibilityScope;
  eligibilityBasis: ProviderEligibilityBasis;
  stateCode: string | null;
  countyFips: string | null;
  source: "explicit" | "inferred_state_license";
  expiresAt: Date | null;
};

type ExplicitEligibilityLike = {
  jurisdictionType: string;
  eligibilityBasis: string;
  verificationStatus?: string | null;
  stateCode?: string | null;
  countyFips?: string | null;
  expiresAt?: Date | string | null;
  isActive?: boolean | null;
};

function normalizeExpiry(value: Date | string | null | undefined): Date | null {
  if (!value) return null;
  const expiry = value instanceof Date ? value : new Date(value);
  return Number.isNaN(expiry.getTime()) ? null : expiry;
}

export function buildComputedProviderEligibilities(args: {
  explicitEligibilities: ExplicitEligibilityLike[];
  inferredStateCodes?: string[];
  now?: Date;
}): ComputedProviderEligibility[] {
  const now = args.now ?? new Date();
  const out: ComputedProviderEligibility[] = [];
  const seen = new Set<string>();

  const pushEntry = (entry: ComputedProviderEligibility) => {
    const key = [
      entry.jurisdictionType,
      entry.eligibilityBasis,
      entry.stateCode || "",
      entry.countyFips || "",
      entry.source,
    ].join("|");
    if (seen.has(key)) return;
    seen.add(key);
    out.push(entry);
  };

  for (const raw of args.explicitEligibilities) {
    const verificationStatus = String(raw.verificationStatus || "approved")
      .trim()
      .toLowerCase();
    const jurisdictionType = String(raw.jurisdictionType || "")
      .trim()
      .toLowerCase();
    const eligibilityBasis = String(raw.eligibilityBasis || "")
      .trim()
      .toLowerCase();
    const stateCode = typeof raw.stateCode === "string" ? raw.stateCode.trim().toUpperCase() : "";
    const countyFips = typeof raw.countyFips === "string" ? raw.countyFips.trim() : "";
    const expiresAt = normalizeExpiry(raw.expiresAt);
    const active = raw.isActive !== false;

    if (!active || verificationStatus !== "approved") continue;
    if (expiresAt && expiresAt.getTime() < now.getTime()) continue;
    if (jurisdictionType !== "state" && jurisdictionType !== "county") continue;
    if (
      eligibilityBasis !== "state_license" &&
      eligibilityBasis !== "county_license" &&
      eligibilityBasis !== "verified_exception"
    ) {
      continue;
    }
    if (jurisdictionType === "state" && !/^[A-Z]{2}$/.test(stateCode)) continue;
    if (jurisdictionType === "county" && !/^\d{5}$/.test(countyFips)) continue;

    pushEntry({
      jurisdictionType,
      eligibilityBasis: eligibilityBasis as ProviderEligibilityBasis,
      stateCode: /^[A-Z]{2}$/.test(stateCode) ? stateCode : null,
      countyFips: /^\d{5}$/.test(countyFips) ? countyFips : null,
      source: "explicit",
      expiresAt,
    });
  }

  for (const rawStateCode of args.inferredStateCodes || []) {
    const stateCode = String(rawStateCode || "")
      .trim()
      .toUpperCase();
    if (!/^[A-Z]{2}$/.test(stateCode)) continue;
    pushEntry({
      jurisdictionType: "state",
      eligibilityBasis: "state_license",
      stateCode,
      countyFips: null,
      source: "inferred_state_license",
      expiresAt: null,
    });
  }

  return out;
}

export function getEligibilityDecisionForCounty(
  eligibilities: ComputedProviderEligibility[],
  county: { fips: string; stateCode: string }
): { eligible: boolean; matched: ComputedProviderEligibility[] } {
  const countyFips = String(county.fips || "").trim();
  const stateCode = String(county.stateCode || "")
    .trim()
    .toUpperCase();

  const matched = eligibilities.filter((entry) => {
    if (entry.jurisdictionType === "county") {
      return entry.countyFips === countyFips;
    }
    return entry.stateCode === stateCode;
  });

  return {
    eligible: matched.length > 0,
    matched,
  };
}

export async function getComputedProviderEligibilitiesForUser(
  userId: string
): Promise<ComputedProviderEligibility[]> {
  const explicitEligibilities = await storage.getProviderEligibilitiesForUser(userId);

  const [realtorProfile] = await db
    .select({
      licenseState: realtorProfiles.licenseState,
      verificationStatus: realtorProfiles.verificationStatus,
    })
    .from(realtorProfiles)
    .where(eq(realtorProfiles.userId, userId))
    .limit(1);

  const [carSalesProfile] = await db
    .select({
      licenseState: carSalesmanProfiles.licenseState,
      verificationStatus: carSalesmanProfiles.verificationStatus,
    })
    .from(carSalesmanProfiles)
    .where(eq(carSalesmanProfiles.userId, userId))
    .limit(1);

  const inferredStateCodes = [realtorProfile, carSalesProfile]
    .filter(
      (row) =>
        String(row?.verificationStatus || "")
          .trim()
          .toLowerCase() === "approved"
    )
    .map((row) =>
      String(row?.licenseState || "")
        .trim()
        .toUpperCase()
    )
    .filter((value) => /^[A-Z]{2}$/.test(value));

  return buildComputedProviderEligibilities({
    explicitEligibilities,
    inferredStateCodes,
  });
}
