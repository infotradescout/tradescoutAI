import type { HomeIdPropertyDetail, HomeIdRequestPacket } from "./homeidPersistence";
import { resolveReadyHomeIdPacketGraph } from "@shared/homeIdPacketAuthority";

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
  const authority = resolveReadyHomeIdPacketGraph({
    persistence: {
      propertyDetails: input.propertyDetails,
      requestPackets: [input.packet],
    },
    packetId: input.packet.id,
    claimedSelectedDetailIds: input.packet.selectedDetailIds,
  });
  if (!authority.ok) return null;

  const selectedPropertyDetails = authority.graph.selectedDetails
    .map((detail) => ({
      id: detail.id,
      category: detail.category,
      note: detail.note,
      status: detail.status,
      savedAt: detail.savedAt,
    }));

  return {
    homeId,
    homeType: input.homeType,
    creatorRole: input.creatorRole,
    requestType: authority.graph.packet.requestType,
    packetReadinessState: "ready_for_handoff",
    packetSavedAt: authority.graph.packet.savedAt,
    generatedAt: input.now || new Date().toISOString(),
    selectedPropertyDetails,
    nonBlockingContext: input.nonBlockingContext.map((item) => item.trim()).filter(Boolean),
  };
}
