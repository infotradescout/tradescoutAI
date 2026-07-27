export type WorkRequestAssignmentProviderKind = "business" | "contractor" | "responder" | "worker";

export function buildWorkRequestAssignmentProviderKey(
  kind: WorkRequestAssignmentProviderKind,
  providerId: unknown
): string {
  const normalizedProviderId = String(providerId || "").trim();
  if (!normalizedProviderId) {
    throw new Error(`Cannot build a ${kind} assignment key without a provider id.`);
  }
  return `${kind}:${normalizedProviderId}`;
}
