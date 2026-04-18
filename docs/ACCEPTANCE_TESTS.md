# Acceptance Tests

Date: 2026-02-16

## Automated Coverage (API)

File: `server/tests/acceptance-realignment.test.ts`

Covers:
1. Public promo contact redaction (`GET /promo/:slug`)
2. Request-gated marketplace conversation creation (`POST /api/marketplace/conversations`)
3. Maps bounds endpoint (`GET /api/map/providers?bbox=...`)
4. Claim flow transition from `unclaimed` -> `claimed` during signup claim path

Run:

```bash
npm test
```

## Manual UI Smoke Checklist

### A) Request-gated contact
1. Open `/exchange` as a buyer.
2. Tap `Request Quote` on a listing.
3. Verify: app shows request-pending flow, not direct contact fields.
4. Verify no phone/email exposed in listing browse surfaces.

Expected: no direct contact unless request permission is accepted.

### B) Public promo redaction
1. Open a public promo URL (`/promo/<slug>`).
2. Verify contractor card does not show phone/email.
3. Verify CTA language routes to request flow.

Expected: awareness-only promo payload and request-first CTA.

### C) Maps v1
Prereq:
- `FEATURE_MAPS_V1=true`
- `VITE_FEATURE_MAPS_V1=true`
- `VITE_GOOGLE_MAPS_WEB_API_KEY` (or `VITE_GOOGLE_MAPS_API_KEY`) set
- Optional: `VITE_GOOGLE_MAPS_MAP_ID` set

1. Open `/maps`.
2. Pan/zoom the map.
3. Verify pin clusters update by viewport.
4. Toggle `Verified only` and pick a trade filter.
5. Tap a pin and verify preview contains only `Request Quote` CTA.

Expected: no direct phone/email in map preview; map remains discovery-only.

### D) Claim pipeline
1. Stage and merge an import batch (see `docs/PRELOAD_AND_CLAIM.md`).
2. Open signup flow and search for preloaded business.
3. Select listing and sign up with matching email/phone.
4. Verify listing is assigned and marked claimed.

Expected: claim succeeds without breaking existing claimed records.

## Regression Guardrails

If any acceptance fails after deployment:
1. Revert the offending commit quickly (`git revert <commit>`).
2. Re-run `npm test` and `npm run build`.
3. Re-validate the four API contract checks above before redeploy.
