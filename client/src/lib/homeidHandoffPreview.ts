import type { HomeIdPropertyDetail, HomeIdRequestPacket } from "./homeidPersistence";

export type HomeIdHandoffPreview = {
  homeId: string;
  homeType: string;
  creatorRole: string;
  requestType: string;
  packetReadinessState: "ready_for_handoff";
  packetSavedAt: string;
  generatedAt: string;
  selectedPropertyDetails: Array<{
    id: string;
    category: string;
    note: string;
    status: HomeIdPropertyDetail["status"];
    savedAt: string;
  }>;
  nonBlockingContext: string[];
};

type BuildHomeIdHandoffPreviewInput = {
  homeId: string | null;
  homeType: string;
  creatorRole: string;
  packet: HomeIdRequestPacket;
  propertyDetails: HomeIdPropertyDetail[];
  nonBlockingContext: string[];
  now?: string;
};

export function buildHomeIdHandoffPreview(
  input: BuildHomeIdHandoffPreviewInput
): HomeIdHandoffPreview | null {
  const homeId = String(input.homeId || "").trim();
  if (!homeId) return null;
  if (input.packet.status !== "ready_for_handoff") return null;

  const selectedIds = new Set(input.packet.selectedDetailIds);
  const selectedPropertyDetails = input.propertyDetails
    .filter((detail) => selectedIds.has(detail.id))
    .map((detail) => ({
      id: detail.id,
      category: detail.category,
      note: detail.note,
      status: detail.status,
      savedAt: detail.savedAt,
    }));

  if (selectedPropertyDetails.length === 0) return null;

  return {
    homeId,
    homeType: input.homeType,
    creatorRole: input.creatorRole,
    requestType: input.packet.requestType,
    packetReadinessState: "ready_for_handoff",
    packetSavedAt: input.packet.savedAt,
    generatedAt: input.now || new Date().toISOString(),
    selectedPropertyDetails,
    nonBlockingContext: input.nonBlockingContext.map((item) => item.trim()).filter(Boolean),
  };
}
