import type { VerifiedOrigin } from "./types";

/**
 * Explicit source-owned extension point for verified country data.
 * Keep empty until JW supplies a country and its verification source.
 */
export const JW_STONE_VERIFIED_ORIGIN_BY_SLUG: Readonly<Record<string, VerifiedOrigin>> =
  Object.freeze({});
