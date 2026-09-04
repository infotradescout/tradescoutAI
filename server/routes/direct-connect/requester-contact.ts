import { and, eq, inArray } from "drizzle-orm";
import { db } from "../../db";
import { users, workRequestEvents, workRequests } from "@shared/schema";

export type DirectConnectRequesterContact = {
  name: string;
  phone: string;
};

function parseMetadata(value: unknown): Record<string, any> | null {
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : null;
    } catch {
      return null;
    }
  }
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, any>)
    : null;
}

export function normalizeDirectConnectRequesterContact(
  row: any
): DirectConnectRequesterContact | null {
  const firstName = String(row?.firstName ?? row?.first_name ?? "").trim();
  const lastName = String(row?.lastName ?? row?.last_name ?? "").trim();
  const fallbackName = String(row?.name ?? row?.displayName ?? row?.display_name ?? "").trim();
  const name = [firstName, lastName].filter(Boolean).join(" ") || fallbackName;
  const phone = String(row?.phone ?? "").trim();
  if (name.length < 2 || phone.replace(/\D+/g, "").length < 10) return null;
  return { name, phone };
}

export async function loadDirectConnectContactReleasedRequestIds(
  requestIds: string[]
): Promise<Set<string>> {
  const releasedIds = new Set<string>();
  if (!requestIds.length) return releasedIds;
  try {
    const createdEvents = await db
      .select({ workRequestId: workRequestEvents.workRequestId, metadata: workRequestEvents.metadata })
      .from(workRequestEvents)
      .where(
        and(
          inArray(workRequestEvents.workRequestId, requestIds),
          eq(workRequestEvents.type, "created" as any)
        )
      );
    for (const event of createdEvents as any[]) {
      const metadata = parseMetadata(event.metadata);
      const requestId = String(event.workRequestId || "").trim();
      if (
        requestId &&
        metadata?.contactConsent === "request_submission" &&
        (metadata?.contactGateState === "released" || metadata?.contactReleaseState === "released")
      ) {
        releasedIds.add(requestId);
      }
    }
  } catch (error) {
    console.warn("[direct-connect] requester contact release metadata unavailable", error);
  }
  return releasedIds;
}

export async function loadDirectConnectRequesterContactByRequest(
  requestRows: any[],
  releasedRequestIds: Set<string>
): Promise<Map<string, DirectConnectRequesterContact>> {
  const contacts = new Map<string, DirectConnectRequesterContact>();
  if (!requestRows.length || !releasedRequestIds.size) return contacts;
  const requesterIds = Array.from(
    new Set(
      requestRows
        .filter((row: any) => releasedRequestIds.has(String(row?.id || "")))
        .map((row: any) => String(row?.createdByUserId ?? row?.created_by_user_id ?? "").trim())
        .filter(Boolean)
    )
  );
  if (!requesterIds.length) return contacts;
  try {
    const requesterRows = await db
      .select({
        id: users.id,
        firstName: users.firstName,
        lastName: users.lastName,
        phone: users.phone,
      })
      .from(users)
      .where(inArray(users.id, requesterIds));
    const contactByUserId = new Map<string, DirectConnectRequesterContact>();
    for (const row of requesterRows as any[]) {
      const contact = normalizeDirectConnectRequesterContact(row);
      if (contact && row.id) contactByUserId.set(String(row.id), contact);
    }
    for (const requestRow of requestRows as any[]) {
      const requestId = String(requestRow?.id || "").trim();
      const requesterId = String(
        requestRow?.createdByUserId ?? requestRow?.created_by_user_id ?? ""
      ).trim();
      const contact = contactByUserId.get(requesterId);
      if (requestId && releasedRequestIds.has(requestId) && contact) {
        contacts.set(requestId, contact);
      }
    }
  } catch (error) {
    console.warn("[direct-connect] requester contact lookup unavailable", error);
  }
  return contacts;
}

export async function loadDirectConnectRequesterContactByRequestIds(
  requestIds: string[],
  releasedRequestIds: Set<string>
): Promise<Map<string, DirectConnectRequesterContact>> {
  if (!requestIds.length || !releasedRequestIds.size) {
    return new Map<string, DirectConnectRequesterContact>();
  }
  try {
    const requestRows = await db
      .select({ id: workRequests.id, createdByUserId: workRequests.createdByUserId })
      .from(workRequests)
      .where(inArray(workRequests.id, requestIds));
    return loadDirectConnectRequesterContactByRequest(requestRows, releasedRequestIds);
  } catch (error) {
    console.warn("[direct-connect] requester work request lookup unavailable", error);
    return new Map<string, DirectConnectRequesterContact>();
  }
}
