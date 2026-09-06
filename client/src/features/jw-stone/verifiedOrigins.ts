import type { VerifiedOrigin } from "./types";
import { JW_STONE_ONYX_ORIGINS } from "@shared/onyxOrigins";

/**
 * Explicit source-owned extension point for verified country data.
 * The owner confirmed Iranian origin for the named onyx offering on 2026-09-06.
 */
export const JW_STONE_VERIFIED_ORIGIN_BY_SLUG: Readonly<Record<string, VerifiedOrigin>> =
  JW_STONE_ONYX_ORIGINS;
