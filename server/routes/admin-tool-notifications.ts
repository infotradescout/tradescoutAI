import { Router, type Request, type Response } from "express";
import { pool } from "../db/pg";
import { isAuthenticated } from "../auth";
import { presenceCustomerTaskHealth } from "../services/presenceCustomerTasks";

const router = Router();

router.use(isAuthenticated);

type NotificationCounts = {
  tradepartnerRsvpsPending: number;
  addressVerificationsPending: number;
  professionalVerificationsPending: number;
  contractorVerificationDocsPending: number;
};

const NOTIFICATION_COUNTS_CACHE_TTL_MS = 30_000;
let notificationCountsCache: { counts: NotificationCounts; expiresAt: number } | null = null;
let notificationCountsInFlight: Promise<NotificationCounts> | null = null;
type PresenceTaskHealth = Awaited<ReturnType<typeof presenceCustomerTaskHealth>>;
const PRESENCE_HEALTH_CACHE_TTL_MS = 30_000;
let presenceHealthCache: { health: PresenceTaskHealth; expiresAt: number } | null = null;
let presenceHealthInFlight: Promise<PresenceTaskHealth> | null = null;

function normalizeAdminRole(value: unknown): string {
  const role = String(value ?? "")
    .trim()
    .toLowerCase();
  return role === "owner" || role === "head_admin" ? "super_admin" : role;
}

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

async function getNotificationCountsCached(): Promise<NotificationCounts> {
  const now = Date.now();
  if (notificationCountsCache && notificationCountsCache.expiresAt > now) {
    return notificationCountsCache.counts;
  }

  if (notificationCountsInFlight) {
    return notificationCountsInFlight;
  }

  notificationCountsInFlight = loadNotificationCounts()
    .then((counts) => {
      notificationCountsCache = {
        counts,
        expiresAt: Date.now() + NOTIFICATION_COUNTS_CACHE_TTL_MS,
      };
      return counts;
    })
    .finally(() => {
      notificationCountsInFlight = null;
    });

  return notificationCountsInFlight;
}

async function getPresenceTaskHealthCached(): Promise<PresenceTaskHealth> {
  if (presenceHealthCache && presenceHealthCache.expiresAt > Date.now()) {
    return presenceHealthCache.health;
  }
  if (presenceHealthInFlight) return presenceHealthInFlight;

  presenceHealthInFlight = presenceCustomerTaskHealth()
    .then((health) => {
      presenceHealthCache = {
        health,
        expiresAt: Date.now() + PRESENCE_HEALTH_CACHE_TTL_MS,
      };
      return health;
    })
    .finally(() => {
      presenceHealthInFlight = null;
    });
  return presenceHealthInFlight;
}

router.get("/", async (_req: Request, res: Response) => {
  try {
    const req = _req as any;
    const role = normalizeAdminRole(req?.user?.role);
    const activeRole = normalizeAdminRole(req?.user?.activeRole);
    const roles = Array.isArray(req?.user?.roles)
      ? req.user.roles.map((value: unknown) => normalizeAdminRole(value)).filter(Boolean)
      : [];
    const adminRoles = ["super_admin", "ops_admin", "moderator"];
    const isAdminLike =
      req?.user?.isAdmin === true ||
      req?.user?.isSuperAdmin === true ||
      adminRoles.includes(role) ||
      adminRoles.includes(activeRole) ||
      roles.some((value: string) => [...adminRoles, "staff", "support_agent"].includes(value));

    if (!isAdminLike) {
      return res.status(403).json({ message: "Admin access required" });
    }

    const counts = await getNotificationCountsCached();
    let presenceTaskHealth: PresenceTaskHealth | null = null;
    let presenceTaskHealthAvailable = true;
    try {
      presenceTaskHealth = await getPresenceTaskHealthCached();
    } catch (error) {
      presenceTaskHealthAvailable = false;
      console.error("[admin-tool-notifications] presence task health unavailable:", error);
    }

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
      degraded: !presenceTaskHealthAvailable,
      countsAvailable: true,
      totalUnread,
      byTool,
      counts,
      presenceTaskHealth: presenceTaskHealthAvailable
        ? { available: true, ...presenceTaskHealth }
        : { available: false },
    });
  } catch (error) {
    console.error("[admin-tool-notifications] failed:", error);
    // Never hard-fail admin navigation dots; degrade to zero counts.
    return res.json({
      degraded: true,
      message: "Failed to load admin tool notifications",
      countsAvailable: false,
      totalUnread: 0,
      byTool: {},
      presenceTaskHealth: { available: false },
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
