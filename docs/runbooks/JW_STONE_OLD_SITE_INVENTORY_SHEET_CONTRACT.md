# JW Stone old-site inventory sheet contract

## Scope

JW Stone's current reconciled inventory remains authoritative and unchanged. This lane applies
only to candidate slabs or bundles recovered from the old website. An archived page is discovery
evidence, not proof that an item is current.

Exchange may show one request-only JW Stone profile-catalog spotlight. Individual materials remain
in the maintained JW Stone profile catalog and are not duplicated as Exchange listings.

## Additive-only boundary

This lane may add a confirmed old-site item. It may not update, replace, reclassify, rename, hide,
reorder, or delete any current-inventory record. Existing rows in an operational sheet are read-only
reference records for this lane.

Before publication, a generated diff must prove:

- every public data change is a newly added old-site item;
- no existing product, image assignment, label, ordering, or status changed;
- every addition has a new stable product number with no collision; and
- any failed or ambiguous candidate leaves the public catalog unchanged.

## Required columns

```text
product_number,record_type,parent_bundle_number,material_name,material_category,finish,thickness_cm,length_in,width_in,slab_count,inventory_status,status_verified_at,status_verified_by,primary_image_filename,image_filenames,source_reference,internal_notes
```

- `product_number` is required, unique, stable, and never reused.
- `record_type` is `slab` or `bundle`; a parent reference must resolve exactly once.
- material identity and finish stay blank or `unconfirmed` unless a current source confirms them.
- measurements are numeric when present; slab counts are confirmed positive whole numbers.
- public status requires both an accountable verifier and ISO verification timestamp.
- the primary image must occur in the exact semicolon-separated image filename set.
- source references locate evidence but do not establish current inventory status.
- no sheet field may introduce price, direct-contact, shipping, or availability claims.

## Fail-closed sequence

The importer must reject the whole candidate batch for duplicate product numbers, invalid bundle
references, missing or cross-assigned images, unsupported values, unsupported material claims, or
attempts to mutate a current row.

The sequence is: sheet export → schema validation → image reconciliation → additive-only diff →
operator review → publication. No archived candidate auto-publishes.
