# Durable notification email delivery

`NotificationService` owns the inbox record and its email job. `emailService`
remains the only email provider adapter. No contact, assignment, exposure, or
provider selection route gains email eligibility from this change.

## Queue contract

The existing `notification_jobs` table stores jobs with
`job_type = notification_email_v1` and a deterministic primary key
`notification-email:<notification id>`. Creation commits the notification and
its email intent together. Bulk creation uses the same transaction. Job data
contains only a notification ID and the intended user ID, not a copied email
body or address. Repeated dispatch of that notification cannot create a second
email job. Different notification IDs remain different producer intents.

The existing scheduler drains up to 20 jobs on startup and each minute, only
when `SCHEDULER_ENABLED=true` and the configured scheduler leadership rule
allows background work. Claims use PostgreSQL `FOR UPDATE SKIP LOCKED` and an
atomic status update. A single process also prevents overlapping email passes.
The worker re-reads the current recipient, notification, expiration, archive,
schedule and preferences immediately before submission.

Producer delivery methods are the maximum allowed set; preferences only narrow
it. In-app-only staff oversight stays in app. Preference mutations bind to the
authenticated user rather than accepting a submitted owner ID. Direct Connect
email is a neutral signed-in inbox pointer and omits request titles, messages,
contact details and reply-to addresses. HTML is escaped and action links are
restricted to the configured application origin. These contact and ownership
invariants are **enforced** by service behavior and the focused tests.

## Delivery evidence and recovery

| Job status | Meaning and next action |
| --- | --- |
| `pending` | Persisted intent waiting for its schedule and an enabled worker. |
| `running` | Claimed attempt. The provider may not yet have responded. |
| `retry` | Known rate-limit rejection or missing provider configuration; next attempt is scheduled with exponential backoff and jitter. At most five attempts occur. |
| `completed` | Provider accepted the message. Its ID is recorded when returned. This does not establish mailbox delivery. |
| `cancelled` | Recipient, notification, preferences or current email mode no longer permits sending. |
| `failed` | Provider explicitly rejected the request, or five safe attempts were exhausted. |
| `unknown` | Submission outcome is uncertain, or a running lease exceeded ten minutes. Reconcile provider evidence before deciding whether to send again. |

Every completed attempt with a surviving notification writes an email entry to
`notification_delivery_log`. The entry stores a masked recipient, provider,
external message ID where available, status and bounded error code. Acceptance
sets `sent_at`; `delivered_at` remains null. No delivery webhook or inbox proof
is implied. A failure committing the receipt after acceptance leaves an
uncertain lease, not a retryable send.

The durable adapter makes one provider attempt. HTTP 429 is a known rejection
eligible for retry. Other explicit 4xx rejections (except timeout 408) fail.
Timeouts, network failures and 5xx responses are conservatively uncertain.
The worker never automatically resends `unknown` jobs. Existing non-outbox
email callers retain their current retry behavior. Brevo acceptance with a
malformed optional receipt body is retained as accepted without a message ID.

Read-only operational inspection can use:

```sql
SELECT status, count(*)
FROM notification_jobs
WHERE job_type = 'notification_email_v1'
GROUP BY status;

SELECT id, status, retry_count, next_retry_at, started_at, error_log
FROM notification_jobs
WHERE job_type = 'notification_email_v1'
  AND status IN ('retry', 'failed', 'unknown')
ORDER BY updated_at DESC;
```

No automatic manual-replay endpoint is introduced. Do not reset an `unknown`
job to pending without reconciling provider records: the first message may
already have been accepted. The lack of a provider ID is not proof of failure.

## Rollout and limits

This change adds no schema migration: it reuses the modeled `notifications`,
`notification_preferences`, `notification_jobs`, and
`notification_delivery_log` tables. Legacy migration files do not prove that
schema-pushed deployments have their current shape. Before release, verify
these tables against `shared/schema/notifications.ts` and verify the complete
release contract. The synthetic PostgreSQL tests exercise the queue queries,
defaults, required columns and primary keys; they do not attest production
schema, multi-process lock contention or external provider delivery.

An operational cutover still requires an enabled scheduler, the intended
shared provider/from configuration, and an email mode that permits notification
mail. `EMAIL_MODE=account_creation_only` continues to suppress this generic
notification purpose. Current Direct Connect routes request in-app/push only;
staff oversight and assisted assignment remain in-app only. Existing Express
Direct Connect provider-specific sends are a separate producer path and are
not silently enrolled or replayed here. Existing unsent historical notifications
are not bulk backfilled; newly created email intents and normal scheduled
dispatch use the queue.

Old application versions do not consume this job type. Rolling back this code
preserves pending jobs but pauses their worker. Do not run old and new versions
that actively dispatch the same scheduled notifications during cutover: the
older inline sender does not participate in the durable claim. Queue draining,
provider receipt reconciliation, and a controlled authorized external delivery
check remain operational release evidence, not conclusions from local tests.
