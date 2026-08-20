# Admin Production Acceptance Runbook

1. Open `/admin/production-acceptance` while signed in as an authorized admin.
2. Review the Working, Genuinely Empty, Unavailable, and Blocked totals.
3. Open each blocked or unavailable workspace from its report row.
4. Use **Run full acceptance** only when a rollback-only database write proof is required.
5. Confirm the write-proof message states that the temporary record was rolled back.
6. Never substitute real customer messages, payments, contact releases, partner assignments, inventory, or finance transactions for acceptance test material.
