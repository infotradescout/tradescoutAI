import { Router, type Request, type Response } from "express";
import { pool } from "../db/pg";
import { isAuthenticated } from "../auth";

const router = Router();

router.use(isAuthenticated);

type NotificationCounts = {
  tradepartnerRsvpsPending: number;
  addressVerificationsPending: number;
  professionalVerificationsPending: number;
  contractorVerificationDocsPending: number;
};

function getPgErrorCode(error: unknown): string {
  const code =
    typeof error === "object" && error && "code" in error
      ? String((error as { code?: string }).code)
      : "";
  return code;
}

function isIgnorableSchemaError(error: unknown): boolean {
  const code = getPgErrorCode(error);
  return (
    code === "42P01" || // undefined_table
    code === "42703" || // undefined_column
    code === "42883" || // undefined_function
    code === "42P18" // indeterminate_datatype
  );
}

async function safeCount(query: string, params: unknown[] = []): Promise<number> {
  const result = await pool.query(query, params);
  return Number(result.rows?.[0]?.count || 0);
}

async function safeCountWithFallback(
  queries: Array<{ query: string; params?: unknown[] }>
): Promise<number> {
  let lastError: unknown = null;

  for (const candidate of queries) {
    try {
      return await safeCount(candidate.query, candidate.params || []);
    } catch (error) {
      if (!isIgnorableSchemaError(error)) throw error;
      lastError = error;
    }
  }

  if (lastError) {
    console.warn("[admin-tool-notifications] using zero fallback after schema drift:", lastError);
  }

  return 0;
}

async function loadNotificationCounts(): Promise<NotificationCounts> {
  const [
    tradepartnerRsvpsPending,
    addressVerificationsPending,
    realtorVerificationsPending,
    carSalesVerificationsPending,
    contractorVerificationDocsPending,
  ] = await Promise.all([
    safeCountWithFallback([
      {
        query: `
        select count(*)::int as count
        from tradepartner_rsvp_submissions
        where coalesce(attendance_status, 'pending') = 'pending'
      `,
      },
      {
        query: `
        select count(*)::int as count
        from tradepartner_rsvp_submissions
      `,
      },
    ]),
    safeCountWithFallback([
      {
        query: `
        select count(*)::int as count
        from address_verifications
        where status::text in ('pending', 'submitted', 'under_review', 'in_review')
      `,
      },
      {
        query: `
        select count(*)::int as count
        from address_verifications
        where status = 'pending'
      `,
      },
      {
        query: `
        select count(*)::int as count
        from address_verifications
      `,
      },
    ]),
    safeCountWithFallback([
      {
        query: `
        select count(*)::int as count
        from realtor_profiles
        where coalesce(verification_status::text, 'pending') in ('pending', 'under_review', 'in_review')
      `,
      },
      {
        query: `
        select count(*)::int as count
        from realtor_profiles
      `,
      },
    ]),
    safeCountWithFallback([
      {
        query: `
        select count(*)::int as count
        from car_salesman_profiles
        where coalesce(verification_status::text, 'pending') in ('pending', 'under_review', 'in_review')
      `,
      },
      {
        query: `
        select count(*)::int as count
        from car_salesman_profiles
      `,
      },
    ]),
    safeCountWithFallback([
      {
        query: `
        select count(*)::int as count
        from verification_documents
        where status = 'pending'
          and type in ('license', 'insurance')
      `,
      },
      {
        query: `
        select count(*)::int as count
        from verification_documents
        where status = 'pending'
      `,
      },
      {
        query: `
        select count(*)::int as count
        from verification_documents
      `,
      },
    ]),
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
    const req = _req as any;
    const role = String(req?.user?.activeRole || req?.user?.role || "")
      .trim()
      .toLowerCase();
    const roles = Array.isArray(req?.user?.roles)
      ? req.user.roles
          .map((value: unknown) =>
            String(value || "")
              .trim()
              .toLowerCase()
          )
          .filter(Boolean)
      : [];
    const isAdminLike =
      req?.user?.isAdmin === true ||
      role === "super_admin" ||
      role === "ops_admin" ||
      role === "moderator" ||
      roles.some((value: string) =>
        ["super_admin", "ops_admin", "moderator", "staff", "support_agent"].includes(value)
      );

    if (!isAdminLike) {
      return res.status(403).json({ message: "Admin access required" });
    }

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
    // Never hard-fail admin navigation dots; degrade to zero counts.
    return res.json({
      degraded: true,
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
