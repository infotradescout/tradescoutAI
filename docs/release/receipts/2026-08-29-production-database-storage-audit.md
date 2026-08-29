# Production Database and Public-Media Storage Audit

Date: 2026-08-29
Project: TradeScout
Neon project ID: `mute-rice-47282135`
Production branch: `production` (`br-late-wildflower-ad3dn9vm`)
PostgreSQL: 17
Region: `aws-us-east-1`

## Direct findings

- Production logical size reported by Neon: **15,958,564,864 bytes**.
- Project synthetic storage reported by Neon: **15,958,548,480 bytes**.
- The known public-media manifests account for approximately:
  - JW Stone: 899 files / 175,020,735 bytes.
  - R.E.D. Graniti: 11 files / 2,433,960 bytes.
  - Profile media: 43 newly stored objects / 20,585,139 bytes, plus 13 aliases to existing objects.
- Known unique public-media bodies therefore account for approximately **198,039,834 bytes**, or about **1.24%** of the production branch's reported logical size.

## Conclusion

Public media is not the primary explanation for the roughly 15.96 GB production branch. Moving media to object storage remains the correct long-term architecture, but deleting the current public-media table alone would not materially explain or solve total database size. The next storage diagnosis must rank every production table, index, and TOAST relation by total bytes and row count.

## Required read-only production query

Run this against the production branch before any data cleanup:

```sql
SELECT
  n.nspname AS schema_name,
  c.relname AS relation_name,
  c.relkind,
  pg_total_relation_size(c.oid) AS total_bytes,
  pg_relation_size(c.oid) AS table_bytes,
  pg_indexes_size(c.oid) AS index_bytes,
  pg_total_relation_size(c.reltoastrelid) AS toast_bytes,
  COALESCE(s.n_live_tup, 0)::bigint AS estimated_live_rows,
  COALESCE(s.n_dead_tup, 0)::bigint AS estimated_dead_rows
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
LEFT JOIN pg_stat_user_tables s ON s.relid = c.oid
WHERE n.nspname NOT IN ('pg_catalog', 'information_schema')
  AND c.relkind IN ('r', 'm')
ORDER BY pg_total_relation_size(c.oid) DESC, n.nspname, c.relname;
```

Also record:

```sql
SELECT
  pg_database_size(current_database()) AS database_bytes,
  pg_size_pretty(pg_database_size(current_database())) AS database_size;

SELECT
  COUNT(*) AS public_media_object_count,
  COALESCE(SUM(octet_length(body)), 0) AS public_media_body_bytes,
  pg_total_relation_size('public.public_media_objects') AS public_media_relation_bytes
FROM public.public_media_objects;
```

No delete, vacuum-full, reindex, table rewrite, or branch reset is authorized from this audit alone.

## Stale Neon branch inventory

The project reported 14 branches: production plus 13 non-production proof/development branches. These are no longer release authorities:

- `br-falling-block-adj0b1m4` — proof-profile-native-accounts-20260820
- `br-misty-shape-ad5mt9q2` — jw-account-proof-20260820
- `br-quiet-resonance-adkwk52a` — jw-account-proof-20260820-v3
- `br-summer-thunder-ad2iqhct` — bidrock-preview-20260821
- `br-icy-paper-adjiote8` — catchup-rehearsal-20260807 (archived)
- `br-odd-bird-adktcoax` — jw-account-direct-connect-proof-20260821
- `br-weathered-pond-ad8hdvtu` — stone-inventory-file-transfer-20260820
- `br-twilight-cherry-add2m7wg` — stone-inventory-truth-transfer-20260820
- `br-plain-base-advad0p4` — proof-in-profile-accounts-20260819
- `br-little-dawn-adutd9zk` — stone-inventory-truth-transfer-20260820-copy
- `br-summer-credit-adotsfkl` — proof-bidrock-reconciled-foundation-20260819
- `br-little-wave-adoexi47` — proof-stone-core-e4d43aad-20260818
- `br-purple-firefly-adh8vdpz` — development (archived)

## Cleanup disposition

Delete the 13 non-production branches after a final active-release reference check. The connector exposed contradictory argument schemas for SQL and branch deletion during this audit, so no branch deletion or row-level production query is claimed. This is an execution-tool blocker, not evidence that the branches should remain.

## Long-term media exit conditions

Move public media bodies from PostgreSQL to durable object storage when all of the following are true:

1. A complete production R2 or S3 credential contract exists.
2. Every object is copied and verified by key, bytes, MIME type, and digest.
3. Existing public URLs remain stable.
4. GET, HEAD, ranges, ETag, Last-Modified, 304, 412, and 416 behavior passes.
5. Production startup remains fail closed when required objects are missing.
6. A rollback release can still read the prior PostgreSQL bodies until cutover proof completes.
7. Only after two successful releases should PostgreSQL media bodies become eligible for a separately authorized cleanup.
