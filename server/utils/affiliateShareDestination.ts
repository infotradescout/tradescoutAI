import type { Request } from "express";
import { resolveMappedProfileShareOrigin } from "./publicOrigin";

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
  destination: string
): string {
  if (!isSafeAffiliateShareDestination(destination)) return platformOrigin;

  const resolved = new URL(destination, platformOrigin);
  if (resolved.pathname !== "/") return platformOrigin;

  return resolveMappedProfileShareOrigin(req) || platformOrigin;
}
