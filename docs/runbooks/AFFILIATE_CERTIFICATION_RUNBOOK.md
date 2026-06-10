# Affiliate Certification + Rollback Runbook (TradeScout)

## Purpose
This runbook certifies affiliate reliability without changing monetization philosophy.

Psychological intent:
- Target belief: affiliate attribution and earnings are trustworthy and deterministic.
- Target behavior: operators can verify, monitor, and recover affiliate integrity quickly.
- Principle: transparency + reversibility + deterministic attribution.
- Risk prevented: duplicate programs, duplicate conversion attribution, and silent settings loss.

## Scope of hardening
Implemented in this pass:
- Idempotent affiliate program creation in storage (`createAffiliateProgram` returns existing account when present).
- Idempotent referral conversion (`convertReferral` exits if user already has a converted referral).
- Lifetime owner persistence on conversion (`users.referredByAffiliateAccountId` set when missing).
- Affiliate route auth normalization (`claims.sub || id`) for reliability across auth providers.
- Commission route numeric validation (positive finite values required).
- Duplicate `/api/affiliate/settings` route removed.
- Affiliate settings persistence (`preferences.affiliate.payoutMethod` / `payoutDetails`).

Explicitly NOT changed:
- Commission percentage policy.
- Payout thresholds/frequency policy.
- Trust/CVS governance rules.
- Discovery → Scout → Intent → Decision Card → Contact flow.

## Certification checklist (pre-prod and prod)
1. Program creation idempotency
   - Call `GET /api/affiliate/dashboard` twice for a user with no account.
   - Verify only one `affiliate_accounts` row exists for that user.

2. Conversion idempotency
   - Trigger `/api/affiliate/convert` twice with same user/code.
   - Verify only one `affiliate_referrals` row has `referred_user_id = <user>`.

3. Lifetime attribution persistence
   - After conversion, verify `users.referred_by_affiliate_account_id` is populated.
   - Verify repeated conversions do not overwrite existing owner.

4. Settings durability
   - `PUT /api/affiliate/settings` with payout payload.
   - Re-fetch dashboard/session and verify values remain in `users.preferences.affiliate`.

5. Route consistency
   - Verify `/api/affiliate/referrals`, `/api/affiliate/commissions`, `/api/affiliate/payouts` all work for both auth payload styles (`claims.sub` and `id`).

6. Build sanity
   - Run `npm run build` and confirm successful server bundle.

7. Automated integrity audit
   - Run `npm run audit:affiliate-integrity` for report output.
   - Run `npm run audit:affiliate-integrity:strict` in CI/cron (fails on integrity drift).

## SQL spot checks
```sql
-- Duplicate affiliate accounts by user should be zero
SELECT affiliate_id, COUNT(*)
FROM affiliate_accounts
GROUP BY affiliate_id
HAVING COUNT(*) > 1;

-- A user should not have multiple converted referrals
SELECT referred_user_id, COUNT(*)
FROM affiliate_referrals
WHERE referred_user_id IS NOT NULL
GROUP BY referred_user_id
HAVING COUNT(*) > 1;

-- Missing lifetime owner for converted users (should trend to zero)
SELECT COUNT(*) AS missing_owner
FROM users u
WHERE EXISTS (
  SELECT 1
  FROM affiliate_referrals r
  WHERE r.referred_user_id = u.id
)
AND u.referred_by_affiliate_account_id IS NULL;
```

## Rollback plan
### Application rollback
1. Revert deployment to previous known-good release.
2. Verify affiliate dashboard endpoints return 200 for test user.
3. Verify no active 5xx spikes on `/api/affiliate/*`.

### Data rollback (only if required)
These changes are additive/guarding and should not require destructive rollback.
If emergency data correction is required:
- Do NOT delete attribution rows blindly.
- Run a scoped correction only for known bad window.

Example correction template:
```sql
-- Example only: clear accidental duplicate converted rows created in a known window
WITH ranked AS (
  SELECT id,
         referred_user_id,
         ROW_NUMBER() OVER (
           PARTITION BY referred_user_id
           ORDER BY created_at ASC
         ) AS rn
  FROM affiliate_referrals
  WHERE referred_user_id IS NOT NULL
    AND created_at >= :incident_start
    AND created_at <= :incident_end
)
UPDATE affiliate_referrals r
SET referred_user_id = NULL
FROM ranked x
WHERE r.id = x.id
  AND x.rn > 1;
```

## Post-rollback verification
- Re-run certification checklist steps 1–6.
- Confirm no new duplicate affiliate accounts.
- Confirm conversion and payout settings behavior is stable.

## Ownership
- Product authority: Thomas
- Execution owner: platform engineering
- Escalation: if attribution integrity is uncertain, halt payouts until verified.

## P6 Universal Attribution Click Session Smoke
Goal: prove `/ref/<tag>?to=<safe-internal-path>` validates and then attaches attribution to session/cookie before redirect.

Run command:
```bash
RUN_UNIVERSAL_ATTRIBUTION_REF_SMOKE=1 \
TRADESCOUT_PRODUCTION_ORIGIN=https://www.thetradescout.com \
TRADESCOUT_REF_TAG=<valid_affiliate_tag> \
TRADESCOUT_REF_TARGET=/scout \
npm run smoke:universal-attribution-ref
```

Artifact:
- `artifacts/universal-attribution-ref-smoke-latest.json`

Status interpretation:
- `fail-closed production pass`: unsafe target rejection works, valid-ref probe not complete.
- `valid-ref blocked`: preconditions missing or valid-ref probe cannot complete.
- `valid-ref complete`: unsafe target rejected and valid tag+target sets attribution cookie then redirects to validated internal target.

## P7 Attribution Conversion Event Ledger
Goal: record qualified downstream conversion events only when valid attribution proof already exists.

Qualified conversion types:
- `signup_completed`
- `claim_started`
- `request_created`
- `profile_contact_clicked`
- `booking_request_started`

Operational boundaries:
- Click attribution: handled by `/ref/:tag` and click/session proof.
- Conversion attribution: handled by conversion ledger event recording.
- Payout/payment: explicitly out of scope for P7 (must remain false and untriggered).

Fail-closed requirements:
- No attribution session/cookie proof: reject conversion recording.
- Missing or default-looking affiliate tag (`userNNNN`): reject conversion recording.
- Unsupported conversion type: reject conversion recording.
- Any request asking payout/payment flags as true: reject conversion recording.
