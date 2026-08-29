export type HomeIdPacketDetailStatus = "known" | "needs_review";

export type HomeIdPacketPropertyDetail = {
  id: string;
  category: string;
  note: string;
  status: HomeIdPacketDetailStatus;
  createdAt: string;
  savedAt: string;
};

export type HomeIdPacketStatus = "draft" | "needs_info" | "ready_for_handoff";

export type HomeIdPacket = {
  id: string;
  requestType: string;
  selectedDetailIds: string[];
  missingHelpfulInfo: string[];
  missingHelpfulInfoCount: number;
  status: HomeIdPacketStatus;
  createdAt: string;
  savedAt: string;
};

export type HomeIdPersistenceGraph = {
  propertyDetails: HomeIdPacketPropertyDetail[];
  requestPackets: HomeIdPacket[];
};

export type ReadyHomeIdPacketGraph = {
  packet: HomeIdPacket & { status: "ready_for_handoff" };
  selectedDetails: HomeIdPacketPropertyDetail[];
};

export type HomeIdPacketAuthorityFailure =
  | "invalid_persistence_graph"
  | "packet_not_found"
  | "packet_not_ready"
  | "packet_has_missing_information"
  | "claimed_detail_set_invalid"
  | "claimed_detail_set_mismatch";

type HomeIdPacketAuthorityResult =
  | { ok: true; graph: ReadyHomeIdPacketGraph }
  | { ok: false; reason: HomeIdPacketAuthorityFailure };

function objectRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function requiredText(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  return normalized ? normalized : null;
}

function stringList(value: unknown, options?: { nonEmpty?: boolean; unique?: boolean }) {
  if (!Array.isArray(value)) return null;
  const normalized: string[] = [];
  for (const item of value) {
    const text = requiredText(item);
    if (!text) return null;
    normalized.push(text);
  }
  if (options?.nonEmpty && normalized.length === 0) return null;
  if (options?.unique && new Set(normalized).size !== normalized.length) return null;
  return normalized;
}

export function parseHomeIdPacketPropertyDetail(
  value: unknown
): HomeIdPacketPropertyDetail | null {
  const raw = objectRecord(value);
  if (!raw) return null;
  const id = requiredText(raw.id);
  const category = requiredText(raw.category);
  const note = requiredText(raw.note);
  const createdAt = requiredText(raw.createdAt);
  const savedAt = requiredText(raw.savedAt);
  const status = raw.status;
  if (
    !id ||
    !category ||
    !note ||
    !createdAt ||
    !savedAt ||
    (status !== "known" && status !== "needs_review")
  ) {
    return null;
  }
  return { id, category, note, status, createdAt, savedAt };
}

export function parseHomeIdPacket(value: unknown): HomeIdPacket | null {
  const raw = objectRecord(value);
  if (!raw) return null;
  const id = requiredText(raw.id);
  const requestType = requiredText(raw.requestType);
  const selectedDetailIds = stringList(raw.selectedDetailIds, { nonEmpty: true, unique: true });
  const missingHelpfulInfo = stringList(raw.missingHelpfulInfo);
  const createdAt = requiredText(raw.createdAt);
  const savedAt = requiredText(raw.savedAt);
  const status = raw.status;
  const missingHelpfulInfoCount = raw.missingHelpfulInfoCount;
  if (
    !id ||
    !requestType ||
    !selectedDetailIds ||
    !missingHelpfulInfo ||
    !createdAt ||
    !savedAt ||
    !Number.isInteger(missingHelpfulInfoCount) ||
    Number(missingHelpfulInfoCount) < 0 ||
    Number(missingHelpfulInfoCount) !== missingHelpfulInfo.length ||
    (status !== "draft" && status !== "needs_info" && status !== "ready_for_handoff")
  ) {
    return null;
  }
  return {
    id,
    requestType,
    selectedDetailIds,
    missingHelpfulInfo,
    missingHelpfulInfoCount: Number(missingHelpfulInfoCount),
    status,
    createdAt,
    savedAt,
  };
}

export function parseHomeIdPersistenceGraph(value: unknown): HomeIdPersistenceGraph | null {
  const raw = objectRecord(value);
  if (!raw || !Array.isArray(raw.propertyDetails) || !Array.isArray(raw.requestPackets)) {
    return null;
  }

  const propertyDetails = raw.propertyDetails.map(parseHomeIdPacketPropertyDetail);
  const requestPackets = raw.requestPackets.map(parseHomeIdPacket);
  if (propertyDetails.some((detail) => !detail) || requestPackets.some((packet) => !packet)) {
    return null;
  }

  const completeDetails = propertyDetails as HomeIdPacketPropertyDetail[];
  const completePackets = requestPackets as HomeIdPacket[];
  const detailIds = completeDetails.map((detail) => detail.id);
  const packetIds = completePackets.map((packet) => packet.id);
  if (new Set(detailIds).size !== detailIds.length || new Set(packetIds).size !== packetIds.length) {
    return null;
  }

  const availableDetailIds = new Set(detailIds);
  if (
    completePackets.some((packet) =>
      packet.selectedDetailIds.some((detailId) => !availableDetailIds.has(detailId))
    )
  ) {
    return null;
  }

  return { propertyDetails: completeDetails, requestPackets: completePackets };
}

export function resolveReadyHomeIdPacketGraph(input: {
  persistence: unknown;
  packetId: unknown;
  claimedSelectedDetailIds?: unknown;
}): HomeIdPacketAuthorityResult {
  const persistence = parseHomeIdPersistenceGraph(input.persistence);
  if (!persistence) return { ok: false, reason: "invalid_persistence_graph" };

  const packetId = requiredText(input.packetId);
  const packet = packetId
    ? persistence.requestPackets.find((candidate) => candidate.id === packetId)
    : null;
  if (!packet) return { ok: false, reason: "packet_not_found" };
  if (packet.status !== "ready_for_handoff") {
    return { ok: false, reason: "packet_not_ready" };
  }
  if (packet.missingHelpfulInfoCount !== 0 || packet.missingHelpfulInfo.length !== 0) {
    return { ok: false, reason: "packet_has_missing_information" };
  }

  if (input.claimedSelectedDetailIds !== undefined) {
    const claimed = stringList(input.claimedSelectedDetailIds, { nonEmpty: true, unique: true });
    if (!claimed) return { ok: false, reason: "claimed_detail_set_invalid" };
    const canonical = new Set(packet.selectedDetailIds);
    if (claimed.length !== canonical.size || claimed.some((id) => !canonical.has(id))) {
      return { ok: false, reason: "claimed_detail_set_mismatch" };
    }
  }

  const detailsById = new Map(
    persistence.propertyDetails.map((detail) => [detail.id, detail] as const)
  );
  const selectedDetails = packet.selectedDetailIds.map((id) => detailsById.get(id));
  if (selectedDetails.some((detail) => !detail)) {
    return { ok: false, reason: "invalid_persistence_graph" };
  }

  return {
    ok: true,
    graph: {
      packet: packet as HomeIdPacket & { status: "ready_for_handoff" },
      selectedDetails: selectedDetails as HomeIdPacketPropertyDetail[],
    },
  };
}
