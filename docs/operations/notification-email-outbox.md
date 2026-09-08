# Durable notification email delivery

`NotificationService` owns the inbox record and its email job. `emailService`
remains the only email provider adapter. Normal assigned-provider request
notifications may enroll email only for verified recipients with explicit
New Requests Email consent and current canonical provider eligibility.

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
schedule and preferences immediately before submission. A validation lease is
separate from a provider submission lease: transient validation failures are
safe to retry, while uncertain provider submissions are not.

## Normal Direct Connect invitations

The three normal producers (automatic routing, requester owner-direct selected
providers, and normal newly created targeted providers) use the specialized
assigned-provider notification operation. It binds the request, assignment,
persisted provider event and recipient to a deterministic notification ID.
Eligibility requires a routed Direct Connect request, exactly one current
suggested/invited assignment and matching normal requester-authored event,
plus the current contractor or business owner. Staff-authored/admin-directed,
worker-only, ambiguous, stale or unbound contexts cannot enroll email.

Enrollment requires a verified address and explicit global notification/email
flags plus the enabled `new_project_request` email preference. Missing or
malformed preferences fail closed. The normal inbox/push intent is retained
when email context or eligibility lookups fail. If explicit consent was read
successfully before a transient eligibility error, the record marks that
evaluation deferred; replaying the same event after recovery can add its one
email job without another inbox/push alert. Later opt-ins do not backfill these
already bound notifications, and replay never resets an existing terminal/unknown job. No
background historical recovery batch is introduced. A failure before the
event binding or initial consent is established retains the inbox alert but
does not establish a recoverable email intent. If the context lookup itself
fails, that fallback inbox record is unbound; a later successful normal producer
replay can create a distinct bound notification under then-current consent.

At drain, the worker revalidates the exact binding and canonical county/trade/
trust eligibility. After asynchronous eligibility checks, it reloads the
binding and guards the submission transition with current request/assignment,
verified recipient address, notification state and every stored consent row.
Withdrawal, acceptance, reassignment, opt-out or changed verification/address
during validation cancels submission. Changed eligibility context safely
retries validation. Lease IDs prevent a superseded worker from submitting or
overwriting the current worker's receipt.

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
| `validating` | Claimed pre-submission checks. No provider call has begun. An expired validation lease can safely retry. |
| `running` | Submission authority passed. The provider may not yet have responded. |
| `retry` | Transient pre-submission validation failure, changed eligibility context, known rate-limit rejection or missing provider configuration; next attempt is scheduled with bounded backoff. At most five attempts occur. |
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

Migration `0136_restore_notification_outbox_schema.sql` restores the existing
modeled `notification_jobs` and `notification_templates` tables, which were
absent from the prior migration journal. It adds no email intents and preserves
existing synced tables and jobs. Prior journal entries remain unchanged.
Migration 0135 supplies the inbox, preferences and delivery-log compatibility
contract. Required-schema verification now checks every modeled outbox/template
column and default, indexes, immediate primary keys, the template foreign key,
and the recorded 0136 hash. Incompatible existing shapes block release rather
than being silently rewritten.

The new template/job notification-type columns use the journal's `varchar`
representation, matching 0000/0091; existing schema-pushed `notification_type`
enum columns are accepted and preserved. The varchar representation does not
enforce the enum's value list at the database layer. Server-owned producer,
binding and recipient checks remain the authority for email eligibility.

The full migration journal and verifier passed against a fresh disposable
PostgreSQL 18.4 database. Native proof covers missing/drifted schema rejection,
repeat migration preservation, transaction rollback, two separate Node workers
claiming disjoint batches while skipping a locked job, expired validation and
submission leases, and superseded receipt writes. All email adapters were
mocked; this does not attest production schema or external provider delivery.

To repeat the native proof, supply a dedicated loopback `TEST_DATABASE_URL`
whose database name explicitly identifies it as a test database. Set
`NODE_ENV=test` and configure that disposable database's timezone to `UTC`,
then run the normal migration owner with that same target and:

```sh
node --import tsx scripts/tests/notification-email-outbox.native.ts
```

The script rejects non-loopback targets, strips inherited provider settings,
checks the connected database identity and cleans up its synthetic fixtures.
Run it without other writers on that dedicated database. The complete minimum
release contract and production schema verification remain separate release
requirements.

An operational cutover still requires an enabled scheduler, the intended
shared provider/from configuration, and an email mode that permits notification
mail. `EMAIL_MODE=account_creation_only` continues to suppress this generic
notification purpose. The specialized operation adds email to the three normal
producer intents only after the checks above. Staff oversight, admin manual
notify and assisted assignment retain their existing in-app operation. Other
standalone profile/worker-specific producers remain outside this activation.
Existing Express Direct Connect provider-specific sends are a separate producer
path and are not silently enrolled or replayed here. Existing unsent historical
notifications are not bulk backfilled; newly created email intents and normal
scheduled dispatch use the queue.

Old application versions do not consume this job type. Rolling back this code
preserves pending jobs but pauses their worker. Do not run old and new versions
that actively dispatch the same scheduled notifications during cutover: the
older inline sender does not participate in the durable claim. Queue draining,
provider receipt reconciliation, and a controlled authorized external delivery
check remain operational release evidence, not conclusions from local tests.
