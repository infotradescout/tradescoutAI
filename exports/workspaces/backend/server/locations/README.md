# Location Data Layout

This folder standardizes how county-level assets are stored and moved for backend workflows. Use it for any location-scoped payloads (exports, overrides, seeds, vault snapshots, etc.) so ops can push/pull by location.

## Folder structure
```
server/locations/
  US/
    {STATE_CODE}/
      {FIPS5}/
        data.json        # optional: snapshot or overrides for this county
        notes.md         # optional: ops notes
        exports/         # optional: CSV/JSON exports for this county
```
- `STATE_CODE`: 2-letter state code (e.g., CA, TX, NY).
- `FIPS5`: zero-padded 5-digit county FIPS code (e.g., 037 for Los Angeles County).

## Conventions
- All location-aware records must carry a location identifier (county_id / FIPS) so they can be routed to the correct folder.
- Use the folder as the canonical spot for manual or automated exports/imports for that county.
- Keep files small and text-based (JSON/CSV/MD) to stay version-friendly.

## Suggested flows
- **Export**: dump county-scoped datasets or vault snapshots to `exports/` for ops review.
- **Import/overrides**: place curated seeds or overrides in `data.json`; ingestion scripts can read from the matching FIPS path.
- **Notes**: capture partner contacts, compliance notes, or runbooks in `notes.md` per county.

## Example seed path
```
server/locations/US/CA/037/data.json
```
This path matches Los Angeles County (CA, FIPS 037).
