type Query = (sql: string) => Promise<{ rows: Array<{ count: unknown }> }>;
export type QueueCount = number | null;
export type AdminQueueCounts = {
  tradepartnerRsvpsPending: QueueCount;
  addressVerificationsPending: QueueCount;
  professionalVerificationsPending: QueueCount;
  contractorVerificationDocsPending: QueueCount;
};
export type AdminQueueSnapshot = { counts: AdminQueueCounts; observedAt: string };

async function count(query: Query, sql: string): Promise<QueueCount> {
  try {
    const result = await query(sql);
    const raw = result.rows?.[0]?.count;
    if (raw === null || raw === undefined || raw === "") return null;
    const value = Number(raw);
    return Number.isSafeInteger(value) && value >= 0 ? value : null;
  } catch {
    // Schema drift and unavailable storage are unknown work, never empty work.
    return null;
  }
}

export async function loadAdminQueueSnapshot(query: Query): Promise<AdminQueueSnapshot> {
  const [rsvps, addresses, realtors, carSales, documents] = await Promise.all([
    count(
      query,
      "select count(*)::int as count from tradepartner_rsvp_submissions where coalesce(attendance_status, 'pending') = 'pending'"
    ),
    count(
      query,
      "select count(*)::int as count from address_verifications where status::text in ('pending', 'submitted', 'under_review', 'in_review')"
    ),
    count(
      query,
      "select count(*)::int as count from realtor_profiles where coalesce(verification_status::text, 'pending') in ('pending', 'under_review', 'in_review')"
    ),
    count(
      query,
      "select count(*)::int as count from car_salesman_profiles where coalesce(verification_status::text, 'pending') in ('pending', 'under_review', 'in_review')"
    ),
    count(
      query,
      "select count(*)::int as count from verification_documents where status = 'pending' and type in ('license', 'insurance')"
    ),
  ]);
  return {
    observedAt: new Date().toISOString(),
    counts: {
      tradepartnerRsvpsPending: rsvps,
      addressVerificationsPending: addresses,
      professionalVerificationsPending:
        realtors === null || carSales === null ? null : realtors + carSales,
      contractorVerificationDocsPending: documents,
    },
  };
}

export function projectAdminQueueSnapshot(snapshot: AdminQueueSnapshot, role: string) {
  const canReviewProfessionals = role === "super_admin" || role === "ops_admin";
  const byTool: Record<string, QueueCount> = {
    "tradepartner-rsvps": snapshot.counts.tradepartnerRsvpsPending,
    verification: snapshot.counts.addressVerificationsPending,
    "commercial-directory": snapshot.counts.contractorVerificationDocsPending,
    ...(canReviewProfessionals
      ? {
          "professional-verification": snapshot.counts.professionalVerificationsPending,
        }
      : {}),
  };
  const values = Object.values(byTool);
  const countsAvailable = values.every((value) => value !== null);
  return {
    updatedAt: snapshot.observedAt,
    countsAvailable,
    partiallyAvailable: !countsAvailable && values.some((value) => value !== null),
    totalUnread: countsAvailable
      ? values.reduce<number>((sum, value) => sum + (value ?? 0), 0)
      : null,
    byTool,
    counts: {
      tradepartnerRsvpsPending: snapshot.counts.tradepartnerRsvpsPending,
      addressVerificationsPending: snapshot.counts.addressVerificationsPending,
      contractorVerificationDocsPending: snapshot.counts.contractorVerificationDocsPending,
      ...(canReviewProfessionals
        ? {
            professionalVerificationsPending: snapshot.counts.professionalVerificationsPending,
          }
        : {}),
    },
  };
}
