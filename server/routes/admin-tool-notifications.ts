import { Router, type Request, type Response } from "express";
import { pool } from "../db/pg";
import { isAuthenticated, isAdmin } from "../auth";

const router = Router();

router.use(isAuthenticated, isAdmin);

type NotificationCounts = {
  tradepartnerRsvpsPending: number;
  addressVerificationsPending: number;
  professionalVerificationsPending: number;
  contractorVerificationDocsPending: number;
};

function isMissingTableError(error: unknown): boolean {
  const code =
    typeof error === "object" && error && "code" in error
      ? String((error as { code?: string }).code)
      : "";
  return code === "42P01";
}

async function safeCount(query: string, params: unknown[] = []): Promise<number> {
  try {
    const result = await pool.query(query, params);
    return Number(result.rows?.[0]?.count || 0);
  } catch (error) {
    if (isMissingTableError(error)) return 0;
    throw error;
  }
}

async function loadNotificationCounts(): Promise<NotificationCounts> {
  const [
    tradepartnerRsvpsPending,
    addressVerificationsPending,
    realtorVerificationsPending,
    carSalesVerificationsPending,
    contractorVerificationDocsPending,
  ] = await Promise.all([
    safeCount(
      `
        select count(*)::int as count
        from tradepartner_rsvp_submissions
        where coalesce(attendance_status, 'pending') = 'pending'
      `
    ),
    safeCount(
      `
        select count(*)::int as count
        from address_verifications
        where status in ('pending', 'under_review')
      `
    ),
    safeCount(
      `
        select count(*)::int as count
        from realtor_profiles
        where coalesce(verification_status, 'pending') in ('pending', 'under_review', 'in_review')
      `
    ),
    safeCount(
      `
        select count(*)::int as count
        from car_salesman_profiles
        where coalesce(verification_status, 'pending') in ('pending', 'under_review', 'in_review')
      `
    ),
    safeCount(
      `
        select count(*)::int as count
        from verification_documents
        where status = 'pending'
          and type in ('license', 'insurance')
      `
    ),
  ]);

  return {
    tradepartnerRsvpsPending,
    addressVerificationsPending,
    professionalVerificationsPending: realtorVerificationsPending + carSalesVerificationsPending,
    contractorVerificationDocsPending,
  };
}

router.get("/", async (_req: Request, res: Response) => {
  try {
    const counts = await loadNotificationCounts();

    const byTool: Record<string, number> = {
      "tradepartner-rsvps": counts.tradepartnerRsvpsPending,
      verification: counts.addressVerificationsPending,
      "professional-verification":
        counts.professionalVerificationsPending + counts.contractorVerificationDocsPending,
      "contractor-settings": counts.contractorVerificationDocsPending,
    };

    const totalUnread = Object.values(byTool).reduce((sum, value) => sum + Number(value || 0), 0);

    return res.json({
      updatedAt: new Date().toISOString(),
      totalUnread,
      byTool,
      counts,
    });
  } catch (error) {
    console.error("[admin-tool-notifications] failed:", error);
    return res.status(500).json({
      message: "Failed to load admin tool notifications",
      totalUnread: 0,
      byTool: {},
      counts: {
        tradepartnerRsvpsPending: 0,
        addressVerificationsPending: 0,
        professionalVerificationsPending: 0,
        contractorVerificationDocsPending: 0,
      },
      updatedAt: new Date().toISOString(),
    });
  }
});

export default router;
