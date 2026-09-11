# Recommendation schema recovery

The historical journal created a numeric `rating` table in `0000`. Current
recommendation writers, public readers and Trust/CVS scoring use explicit
`recommendation_type`, customer context, verification and moderation fields.
Migration `0137_restore_recommendation_runtime_schema.sql` restores those existing
modeled columns. It follows the separately recovered notification migration 0136
when both changes are integrated; previous journal entries must remain immutable.

The migration retains numeric ratings and every existing non-null comment and
customer value. Missing types become `legacy_unclassified`, with publication
disabled and moderation pending for only those previously unclassified rows.
Ratings never imply positive or negative sentiment. Missing required historical
strings become empty strings, representing unknown facts rather than invented
identities. Valid classified rows retain their evidence and visibility choices.
The obsolete rating requirement is removed so current writers need not invent a
number. Replaying the SQL preserves established canonical rows.

Public recommendation readers and moderation approval require an exact positive
or negative type. Rejection of an unclassified historical record remains allowed.
Cached recommendation totals and private analytics also exclude unclassified
records. Their existing policy still counts approved canonical rows without
requiring both public visibility and verification; this recovery does not change
that separate policy. Canonical Trust/CVS credit continues to require verified,
public, approved records with explicit sentiment.

The migration does not recompute existing cached totals, goals or insight rows.
Those projections use the corrected filters when their existing owners next
recalculate them. Previously stored aggregate values may remain stale until then.

The required-schema verifier checks all modeled columns, types, nullability and
defaults, the primary key, compatibility with an optional nullable legacy rating,
and the executed migration hash. Missing publication/moderation fields cannot
silently pass a release check.

Disposable native PostgreSQL evidence is provided by:

```text
node runtime/run-release.mjs db-migrate-safe scripts/db-migrate-safe.mjs
node --import tsx scripts/tests/recommendation-runtime-schema.native.mjs
```

The second command requires `NODE_ENV=test` and an explicitly selected loopback
`TEST_DATABASE_URL` with a disposable test database name. It uses transactions
that roll back its fixtures and adversarial schema changes. It tests populated
legacy and partially restored records, repeated migration application, missing
columns/defaults/primary key/migration evidence, canonical inserts, the actual
moderation handler and storage query owners, and the full current scoring query.
No production database or provider delivery is part of this proof.
