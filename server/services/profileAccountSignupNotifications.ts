import type { PoolClient } from "pg";

// Runs on the membership transaction's connection: no provider call or second
// transaction can expose an uncommitted signup or lose its notification intent.
// Only the canonical business/profile owners and its verified configured
// notification contact are recipients. Customers are not staff recipients.
export const PROFILE_ACCOUNT_SIGNUP_NOTIFICATION_SQL = `
WITH signup AS (
  SELECT pa.id, pa.owner_user_id, pa.created_at, pa.verification_status,
         p.slug, p.owner_user_id AS profile_owner_id,
         b.owner_user_id AS business_owner_id,
         b.profile_data ->> 'notificationEmail' AS notification_email,
         u.first_name, u.last_name, u.email, u.phone,
         up.display_name AS business_name
  FROM profile_accounts pa
  JOIN profiles p ON p.id = pa.target_profile_id
  JOIN users u ON u.id = pa.owner_user_id
  LEFT JOIN businesses b ON b.id = p.business_id
  LEFT JOIN user_profiles up ON up.id = pa.business_profile_id
  WHERE pa.id::text = $1 AND p.slug = 'jw-stone' AND pa.status = 'active'
), recipients AS (
  SELECT DISTINCT r.id AS recipient_id, s.*
  FROM signup s
  JOIN users r ON r.id = s.profile_owner_id OR r.id = s.business_owner_id
    OR (r.email_verified = true
        AND lower(trim(r.email)) = lower(trim(s.notification_email)))
), added AS (
  INSERT INTO notifications (
    id, user_id, type, priority, title, message, action_url, action_text,
    icon_name, delivery_methods, metadata, sent_at
  )
  SELECT 'profile-account-signup:' || id::text || ':' || recipient_id,
         recipient_id, 'new_application', 'high', 'New JW Stone account signup',
         concat_ws(E'\\n',
           'Business: ' || COALESCE(NULLIF(business_name, ''), 'Not provided'),
           'Name: ' || concat_ws(' ', first_name, last_name),
           'Email: ' || email,
           'Phone: ' || COALESCE(NULLIF(phone, ''), 'Not provided'),
           'Signed up: ' || to_char(created_at AT TIME ZONE 'America/Chicago',
                                   'YYYY-MM-DD HH24:MI:SS') || ' Central',
           'Business verification: ' || verification_status::text),
         '/notifications', 'View signup notification', 'user-plus',
         '["in_app","email"]'::jsonb,
         jsonb_build_object('source', 'profile_account_signup',
                            'profileAccountId', id::text, 'profileSlug', slug,
                            'signupUserId', owner_user_id, 'signupCreatedAt', created_at),
         NOW()
  FROM recipients
  ON CONFLICT (id) DO NOTHING
  RETURNING id, user_id
), jobs AS (
  INSERT INTO notification_jobs (
    id, job_type, scheduled_for, target_user_ids, notification_type,
    template_data, status, max_retries, retry_count, target_count
  )
  SELECT 'notification-email:' || id, 'notification_email_v1', NOW(),
         jsonb_build_array(user_id), 'new_application',
         jsonb_build_object('notificationId', id), 'pending', 5, 0, 1
  FROM added
  ON CONFLICT (id) DO NOTHING
  RETURNING id
), receipts AS (
  INSERT INTO notification_delivery_log (
    id, notification_id, user_id, delivery_method, status, delivered_at
  )
  SELECT 'in-app:' || id, id, user_id, 'in_app', 'delivered', NOW()
  FROM added
  ON CONFLICT (id) DO NOTHING
  RETURNING id
)
SELECT (SELECT count(*) FROM signup)::int AS matched,
       (SELECT count(*) FROM recipients)::int AS recipients,
       (SELECT count(*) FROM added)::int AS notifications,
       (SELECT count(*) FROM jobs)::int AS email_jobs,
       (SELECT count(*) FROM receipts)::int AS in_app_receipts,
       ARRAY(SELECT id FROM jobs ORDER BY id) AS email_job_ids
`;

export async function queueProfileAccountSignupNotifications(
  client: Pick<PoolClient, "query">,
  profileAccountId: string
): Promise<string[]> {
  if (!profileAccountId.trim()) throw new Error("Profile account identity is required");
  const result = await client.query(PROFILE_ACCOUNT_SIGNUP_NOTIFICATION_SQL, [profileAccountId]);
  const row = result.rows[0];
  if (!row) throw new Error("Signup notification transaction returned no receipt");
  if (Number(row.matched) > 0 && Number(row.recipients) === 0) {
    throw new Error("JW Stone signup notification recipient is unavailable");
  }
  if (Number(row.notifications) !== Number(row.email_jobs) ||
      Number(row.notifications) !== Number(row.in_app_receipts)) {
    throw new Error("Signup notification channel intents are incomplete");
  }
  if (!Array.isArray(row.email_job_ids) ||
      row.email_job_ids.length !== Number(row.email_jobs) ||
      !row.email_job_ids.every((id: unknown) => typeof id === "string")) {
    throw new Error("Signup email job identities are incomplete");
  }
  return row.email_job_ids;
}
