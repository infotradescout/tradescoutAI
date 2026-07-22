export const PROFILE_BOOKING_BLOCK_TYPE = "profileBooking" as const;

export type ProfileBookingContentBlock = {
  type?: string;
  data?: Record<string, unknown> | null;
};

/**
 * Read the booking configuration owned by one canonical Profile.
 *
 * `undefined` means the Profile has never saved its own settings and callers
 * may use the legacy account-level preference as a compatibility fallback.
 * An empty object is an explicit Profile configuration (bookings disabled).
 */
export function readProfileBookingConfigBlock(
  contentBlocks: unknown
): Record<string, unknown> | undefined {
  if (!Array.isArray(contentBlocks)) return undefined;

  const block = contentBlocks.find(
    (entry) =>
      entry &&
      typeof entry === "object" &&
      (entry as ProfileBookingContentBlock).type === PROFILE_BOOKING_BLOCK_TYPE
  ) as ProfileBookingContentBlock | undefined;

  if (!block) return undefined;
  return block.data && typeof block.data === "object" && !Array.isArray(block.data)
    ? block.data
    : {};
}

/** Persist exactly one non-visual booking configuration block per Profile. */
export function upsertProfileBookingConfigBlock(
  contentBlocks: unknown,
  profileBooking: Record<string, unknown>
): ProfileBookingContentBlock[] {
  const blocks = Array.isArray(contentBlocks)
    ? (contentBlocks.filter((entry): entry is ProfileBookingContentBlock =>
        Boolean(entry && typeof entry === "object")
      ) as ProfileBookingContentBlock[])
    : [];

  const next = blocks.filter((block) => block.type !== PROFILE_BOOKING_BLOCK_TYPE);
  next.push({
    type: PROFILE_BOOKING_BLOCK_TYPE,
    data: { ...profileBooking },
  });
  return next;
}
