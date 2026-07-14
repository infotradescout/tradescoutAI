import { pool } from "../db";
import { notificationService } from "../notification-service";

type BetaOversightInput = {
  requestId: string;
  requestTitle: string;
  businessName?: string | null;
};

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
      WHERE role::text = 'super_admin'
         OR active_role::text = 'super_admin'
         OR COALESCE(to_jsonb(roles), '[]'::jsonb) ? 'super_admin'`
  );

  const title = "Beta Direct Connect request";
  const target = String(businessName || "").trim();
  const message = target
    ? `${requestTitle} was submitted to ${target}.`
    : `${requestTitle} was submitted.`;

  const deliveries = result.rows.map(({ id }) =>
    notificationService.createNotification({
      userId: String(id),
      type: "direct_connect_beta_request",
      title,
      message,
      actionUrl: `/admin/direct-connect-requests?requestId=${encodeURIComponent(requestId)}`,
      actionText: "Review request",
      iconName: "briefcase",
      iconColor: "orange",
      deliveryMethods: ["in_app"],
    })
  );

  const settled = await Promise.allSettled(deliveries);
  const rejected = settled.filter((entry) => entry.status === "rejected");
  if (rejected.length > 0) {
    console.warn("[direct-connect] beta super-admin notification failures", {
      requestId,
      failed: rejected.length,
      attempted: deliveries.length,
    });
  }
}
