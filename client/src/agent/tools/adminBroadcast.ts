export type AdminBroadcastSegment = "all" | "homeowners" | "contractors" | "pros" | "admins";

export type AdminBroadcastDeliveryMethod = "in_app" | "email" | "push" | "sms";

export interface AdminBroadcastTargetFilters {
  stateCodes?: string[];
  countyNames?: string[];
  onlyWithMarketingEmails?: boolean;
}

export interface AdminBroadcastArgs {
  segment: AdminBroadcastSegment;
  title: string;
  message: string;
  deliveryMethods?: AdminBroadcastDeliveryMethod[];
  campaignType?: string;
  tags?: string[];
  targetFilters?: AdminBroadcastTargetFilters;
}

export interface AdminBroadcastResult {
  success: boolean;
  segment: string;
  targetCount: number;
  notifications?: { id: string; userId: string }[];
}

export async function sendAdminBroadcast(args: AdminBroadcastArgs): Promise<AdminBroadcastResult> {
  const payload: AdminBroadcastArgs = {
    ...args,
    segment: args.segment ?? "all",
  };

  const res = await fetch("/api/admin/notifications/broadcast", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const body = await res.json().catch(() => null);
    const message = body?.message || body?.error || `Failed to send admin broadcast (${res.status})`;
    throw new Error(message);
  }

  const json = (await res.json()) as AdminBroadcastResult;
  return json;
}
