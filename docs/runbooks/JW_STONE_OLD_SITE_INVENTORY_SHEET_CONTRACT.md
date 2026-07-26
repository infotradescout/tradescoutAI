# JW Stone old-site inventory sheet contract

## Scope

JW Stone's existing current inventory remains authoritative and unchanged. This contract applies
only to candidate slabs and bundles recovered from the old website. An archived page is discovery
evidence, not proof that an item is current.

The public Exchange continues to show one JW Stone express catalog listing. Individual slabs and
bundles belong in the maintained JW Stone profile catalog, not as separate Exchange listings.

## Additive-only change boundary

This old-site reconciliation may add a confirmed item; it may not update, replace, reclassify,
rename, hide, reorder, or delete an existing current-inventory record. The master operational sheet
may include existing inventory for product-number and image-file management, but this import lane
must treat those rows as read-only reference records.

Before publication, the generated diff must prove that:

- every public data change is a newly added old-site item;
- no existing product, image assignment, label, or current-inventory status changed;
- each addition has a new stable product number that does not collide with any current record; and
- a failed or ambiguous candidate leaves the entire public catalog unchanged.

Normal future inventory operations are a separate workflow. This contract grants no authority to
rewrite today's catalog from the old website.

## Required sheet columns

Use one row for every individual slab and one row for every bundle in the master operational
inventory. Only rows identified as old-site additions are eligible for this reconciliation.

```text
product_number,record_type,parent_bundle_number,material_name,material_category,finish,thickness_cm,length_in,width_in,slab_count,inventory_status,status_verified_at,status_verified_by,primary_image_filename,image_filenames,source_reference,internal_notes
```

| Column | Rule |
|---|---|
| `product_number` | Required, unique, stable, and never reused. Suggested forms: `JWS-S-000001` for a slab and `JWS-B-000001` for a bundle. |
| `record_type` | Required: `slab` or `bundle`. |
| `parent_bundle_number` | Optional for a slab; when present it must resolve to one active bundle row. Blank for bundle rows. |
| `material_name` | Required only when JW Stone or another current source confirms the identity. Never infer it from an old page alone. |
| `material_category` | Controlled value such as `granite`, `marble`, `quartzite`, `quartz`, `onyx`, `soapstone`, `basalt`, or `unconfirmed`. |
| `finish` | Use only an explicitly confirmed finish. Otherwise leave blank. |
| `thickness_cm`, `length_in`, `width_in` | Optional measured values; numeric when present. |
| `slab_count` | `1` for an individual slab; confirmed positive whole number for a bundle. |
| `inventory_status` | Required: `candidate`, `confirmed_current`, `reserved`, `sold`, or `archived`. Only `confirmed_current` and intentionally displayed `reserved` rows may be public. |
| `status_verified_at` | Required ISO timestamp for `confirmed_current`, `reserved`, or `sold`. |
| `status_verified_by` | Required accountable operator for any verified status. |
| `primary_image_filename` | Required before publication and must be included in `image_filenames`. |
| `image_filenames` | Semicolon-separated exact filenames. Every file must exist and belong to this product number. |
| `source_reference` | Drive file/folder ID, current JW record, or archived URL used to locate the candidate. It does not by itself establish current status. |
| `internal_notes` | Non-public reconciliation notes. Do not place contact details here. |

## Image naming

Rename approved images only after the product number is assigned:

```text
<PRODUCT_NUMBER>__<VIEW_NUMBER>__<MATERIAL_SLUG>.<extension>
```

Example:

```text
JWS-S-000142__01__taj-mahal.webp
JWS-S-000142__02__taj-mahal.webp
JWS-B-000031__01__rhino-white.webp
```

`VIEW_NUMBER` is two digits and unique within the product. `MATERIAL_SLUG` may be `unconfirmed`
until JW Stone confirms the identity; renaming a slug must never change the product number.

## Fail-closed import rules

The importer must stop without changing the public catalog when it finds:

- a missing or duplicate product number;
- an orphaned or circular bundle reference;
- a missing, duplicate, or cross-assigned image filename;
- a primary image absent from the row's image set;
- an unsupported record type, material category, or inventory status;
- a verified status without both verifier and timestamp;
- a public candidate whose material identity is unsupported;
- a sheet row that attempts to introduce price, direct-contact, or shipping claims.

The update sequence is: sheet export → schema validation → image reconciliation → generated-data
diff → operator review → publication. No old-site candidate auto-publishes merely because an image
or archived product name was found.
