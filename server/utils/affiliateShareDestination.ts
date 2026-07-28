import type { Request } from "express";
import {
  isProfilePublicCategoryDestination,
  isProfilePublicItemDestination,
} from "@shared/profilePublicItemRoute";
import { storage } from "../storage";
import {
  resolveMappedProfileShareOrigin,
  resolveMappedProfileShareSlug,
} from "./publicOrigin";

const INTERNAL_DESTINATION_BASE = "https://internal.invalid";

export function isSafeAffiliateShareDestination(destination: string): boolean {
  if (
    !destination.startsWith("/") ||
    destination.startsWith("//") ||
    /[\r\n\\]/.test(destination)
  ) {
    return false;
  }

  try {
    return new URL(destination, INTERNAL_DESTINATION_BASE).origin === INTERNAL_DESTINATION_BASE;
  } catch {
    return false;
  }
}

export function resolveAffiliateShareDestinationOrigin(
  req: Pick<Request, "headers" | "protocol">,
  platformOrigin: string,
  destination: string,
  profileContentBlocks?: unknown
): string {
  if (!isSafeAffiliateShareDestination(destination)) return platformOrigin;

  const resolved = new URL(destination, platformOrigin);
  const isProfileDestination =
    resolved.pathname === "/" ||
    isProfilePublicItemDestination(
      `${resolved.pathname}${resolved.search}`,
      profileContentBlocks
    ) ||
    isProfilePublicCategoryDestination(
      `${resolved.pathname}${resolved.search}`,
      profileContentBlocks
    );
  if (!isProfileDestination) return platformOrigin;

  return resolveMappedProfileShareOrigin(req) || platformOrigin;
}

export async function resolveAffiliateOriginForRequest(
  req: Pick<Request, "headers" | "protocol">,
  platformOrigin: string,
  destination: string
): Promise<string> {
  const mappedProfileSlug = resolveMappedProfileShareSlug(req);
  const mappedProfile = mappedProfileSlug
    ? await storage.getProfileBySlugPublic(mappedProfileSlug)
    : undefined;
  return resolveAffiliateShareDestinationOrigin(
    req,
    platformOrigin,
    destination,
    mappedProfile?.contentBlocks
  );
}
