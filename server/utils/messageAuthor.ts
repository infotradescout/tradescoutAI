/** Participant endpoints may accept presentation metadata, never a claimed staff identity. */
export function participantMessageMetadata(
  metadata: unknown,
  userId: string,
  kind: "homeowner" | "contractor"
) {
  return {
    ...(metadata && typeof metadata === "object" && !Array.isArray(metadata) ? metadata : {}),
    author: { kind, userId },
  };
}
