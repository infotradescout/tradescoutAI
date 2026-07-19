import { pool } from "../db";
import { notificationService } from "../notification-service";

type BetaOversightInput = {
  requestId: string;
  requestTitle: string;
  businessName?: string | null;
};

const ADMIN_NOTIFICATION_CONCURRENCY = 8;

/**
 * Beta-only operational visibility for Direct Connect.
 *
 * This creates an in-app notification for every super admin. It deliberately
 * does not send email/push and does not create a work-request assignment.
 * Failures are swallowed by callers so a notification outage never turns a
 * committed customer request into an apparent submission failure.
 */
export async function notifySuperAdminsOfDirectConnectRequest({
  requestId,
  requestTitle,
  businessName,
}: BetaOversightInput): Promise<void> {
  if (String(process.env.DIRECT_CONNECT_BETA_ADMIN_NOTIFICATIONS || "true") === "false") {
    return;
  }

  const result = await pool.query<{ id: string }>(
    `SELECT id
       FROM users
      WHERE (
        role::text = 'super_admin'
        OR active_role::text = 'super_admin'
        OR COALESCE(to_jsonb(roles), '[]'::jsonb) ? 'super_admin'
      )
        AND is_active IS TRUE
        AND LOWER(COALESCE(email, '')) NOT LIKE '%@tradescout.test'
      ORDER BY id`
  );

  const title = "Beta Direct Connect request";
  const target = String(businessName || "").trim();
  const message = target
    ? `${requestTitle} was submitted to ${target}.`
    : `${requestTitle} was submitted.`;

  let failed = 0;
  for (let offset = 0; offset < result.rows.length; offset += ADMIN_NOTIFICATION_CONCURRENCY) {
    const batch = result.rows.slice(offset, offset + ADMIN_NOTIFICATION_CONCURRENCY);
    const settled = await Promise.allSettled(
      batch.map(({ id }) =>
        notificationService.createNotification({
          userId: String(id),
          type: "new_project_request",
          title,
          message,
          actionUrl: `/admin/direct-connect-requests?requestId=${encodeURIComponent(requestId)}`,
          actionText: "Review request",
          iconName: "briefcase",
          iconColor: "orange",
          deliveryMethods: ["in_app"],
        })
      )
    );
    failed += settled.filter((entry) => entry.status === "rejected").length;
  }

  if (failed > 0) {
    console.warn("[direct-connect] beta super-admin notification failures", {
      requestId,
      failed,
      attempted: result.rows.length,
    });
  }
}
