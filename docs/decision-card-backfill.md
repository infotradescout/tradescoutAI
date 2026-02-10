# Decision Card Backfill

This backfill creates missing `decision_cards` rows for existing conversations
that already reference `source_decision_card_id` with `authority_gate = 'decision_card'`.

It does **not** generate new IDs or modify conversations. It only fills missing rows
so Decision Card validation can pass safely.

## Run

```bash
node scripts/backfill-decision-cards.mjs
```

## Dry Run

```bash
node scripts/backfill-decision-cards.mjs --dry-run
```

## Notes

- Uses `marketplace_conversations.buyer_id` as the Decision Card owner.
- Sets `status = 'completed'` and timestamps from the conversation `created_at`.
