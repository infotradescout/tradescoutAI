export type HomeIdComposerHandoffIntent =
  | "link_existing"
  | "update_from_request"
  | "skip_for_now";

export type HomeIdComposerHandoff = Readonly<{
  homeId: string;
  homePacketId: string | null;
  homeContextIntent: HomeIdComposerHandoffIntent;
}>;

export type ResolvedHomeIdComposerHandoff = Readonly<{
  homeId: string;
  homePacketId: string | null;
  homeContextIntent: HomeIdComposerHandoffIntent;
  homePacketSelectedDetailIds: string[];
  homePacketReadinessState: "ready_for_handoff" | null;
  suggestedTitle: string;
  suggestedDescription: string;
}>;

const HANDOFF_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9_-]{0,119}$/;

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function boundedId(value: unknown): string {
  const normalized = String(value || "").trim();
  return HANDOFF_ID_PATTERN.test(normalized) ? normalized : "";
}

function label(value: unknown): string {
  const normalized = String(value || "service")
    .trim()
    .replace(/[_-]+/g, " ");
  return normalized.replace(/\b\w/g, (character) => character.toUpperCase());
}

export function parseHomeIdComposerHandoff(pathOrUrl: string): HomeIdComposerHandoff | null {
  let params: URLSearchParams;
  try {
    params = new URL(String(pathOrUrl || "/"), "https://local.invalid").searchParams;
  } catch {
    return null;
  }

  const homeId = boundedId(params.get("homeId"));
  if (!homeId) return null;
  const homePacketId = boundedId(params.get("homePacketId")) || null;
  const requestedIntent = String(params.get("homeContextIntent") || "").trim();
  const homeContextIntent: HomeIdComposerHandoffIntent =
    requestedIntent === "link_existing" || requestedIntent === "skip_for_now"
      ? requestedIntent
      : "update_from_request";

  return { homeId, homePacketId, homeContextIntent };
}

export function resolveHomeIdComposerHandoff(
  handoff: HomeIdComposerHandoff,
  persistenceResponse: unknown
): ResolvedHomeIdComposerHandoff | null {
  if (!handoff.homePacketId) {
    return {
      ...handoff,
      homePacketSelectedDetailIds: [],
      homePacketReadinessState: null,
      suggestedTitle: "",
      suggestedDescription: "",
    };
  }

  const response = record(persistenceResponse);
  const persistence = record(response.persistence || response);
  const packets = Array.isArray(persistence.requestPackets)
    ? persistence.requestPackets.map(record)
    : [];
  const packet = packets.find((candidate) => boundedId(candidate.id) === handoff.homePacketId);
  if (!packet) return null;

  const packetDetailIds = Array.isArray(packet.selectedDetailIds)
    ? packet.selectedDetailIds.map(boundedId).filter(Boolean).slice(0, 50)
    : [];
  const allowedIds = new Set(packetDetailIds);
  const details = Array.isArray(persistence.propertyDetails)
    ? persistence.propertyDetails
        .map(record)
        .filter((detail) => allowedIds.has(boundedId(detail.id)))
    : [];
  const selectedDetailIds = details.map((detail) => boundedId(detail.id));
  const requestType = String(packet.requestType || "service").trim();
  const suggestedDescription = details
    .map((detail) => {
      const note = String(detail.note || "").trim();
      if (!note) return "";
      return `${label(detail.category)}: ${note}`;
    })
    .filter(Boolean)
    .join("\n")
    .slice(0, 4000);

  return {
    ...handoff,
    homePacketSelectedDetailIds: selectedDetailIds,
    homePacketReadinessState:
      packet.status === "ready_for_handoff" ? "ready_for_handoff" : null,
    suggestedTitle: `${label(requestType)} for my home`.slice(0, 180),
    suggestedDescription,
  };
}
