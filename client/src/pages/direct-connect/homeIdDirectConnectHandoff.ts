export type HomeIdDirectConnectRequestType =
  | "service_request"
  | "business_request"
  | "customer_support"
  | "employment"
  | "buy_sell"
  | "other";

export type ResolvedHomeIdDirectConnectHandoff = {
  packetId: string;
  selectedDetailIds: string[];
  selectedDetailCount: number;
  requestType: HomeIdDirectConnectRequestType;
  title: string;
  description: string;
  readinessState?: "ready_for_handoff";
};

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function asList(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function cleanString(value: unknown, maxLength: number): string {
  return String(value || "")
    .normalize("NFC")
    .replace(/[\u0000-\u001F\u007F-\u009F]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);
}

function humanize(value: string): string {
  return value
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

function mapRequestType(value: string): HomeIdDirectConnectRequestType {
  if (value === "other") return "other";
  return "service_request";
}

/**
 * Resolves an authenticated HomeID persistence response into the small set of
 * fields Direct Connect is allowed to prefill and submit. Packet references are
 * accepted only when they exist in the owned persistence response.
 */
export function resolveHomeIdDirectConnectHandoff(
  persistence: unknown,
  requestedPacketId: string | undefined
): ResolvedHomeIdDirectConnectHandoff | null {
  const packetId = cleanString(requestedPacketId, 120);
  if (!packetId) return null;

  const root = asRecord(persistence);
  const packet = asList(root.requestPackets)
    .map(asRecord)
    .find((candidate) => cleanString(candidate.id, 120) === packetId);
  if (!packet) return null;

  const selectedDetailIds = Array.from(
    new Set(
      asList(packet.selectedDetailIds)
        .map((value) => cleanString(value, 120))
        .filter(Boolean)
    )
  ).slice(0, 50);
  const selectedIdSet = new Set(selectedDetailIds);
  const selectedDetails = asList(root.propertyDetails)
    .map(asRecord)
    .filter((detail) => selectedIdSet.has(cleanString(detail.id, 120)))
    .map((detail) => cleanString(detail.note, 500))
    .filter(Boolean);
  const packetRequestType = cleanString(packet.requestType, 80) || "service";
  const title = `${humanize(packetRequestType)} request`.slice(0, 160);
  const description = selectedDetails.length
    ? `HomeID details:\n${selectedDetails.map((detail) => `- ${detail}`).join("\n")}`.slice(
        0,
        5_000
      )
    : "";

  return {
    packetId,
    selectedDetailIds,
    selectedDetailCount: selectedDetails.length,
    requestType: mapRequestType(packetRequestType),
    title,
    description,
    ...(packet.status === "ready_for_handoff"
      ? { readinessState: "ready_for_handoff" as const }
      : {}),
  };
}
