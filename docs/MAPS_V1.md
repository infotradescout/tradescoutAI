# Maps v1 (Discovery Layer)

Date: 2026-02-16

## Scope

Maps v1 is awareness-only discovery:
- Pins come only from TradeScout DB coordinates (`users.latitude`/`users.longitude` + provider joins)
- No direct contact exposure
- Pin preview CTA is request-gated (`Request Quote`)
- No Places Autocomplete, Geocoding, or Directions in v1

## Feature Flag

Maps v1 is isolated behind flags:
- Server: `FEATURE_MAPS_V1=true`
- Client: `VITE_FEATURE_MAPS_V1=true`

If either flag is false, `/maps` remains safe to ship but the map data endpoint stays disabled.

## Required Env Vars

Set these in your environment:

```bash
FEATURE_MAPS_V1=true
VITE_FEATURE_MAPS_V1=true
VITE_GOOGLE_MAPS_API_KEY=your_browser_key
```

## API Contract

### `GET /api/map/providers`

Query params:
- `bbox=minLng,minLat,maxLng,maxLat` (required)
- `trade=<trade-slug-or-name>` (optional)
- `verified=true` (optional; verified-only filter)
- `limit` (optional; max 2000)

Response:
- `providers[]` with:
  - `id`
  - `displayName`
  - `lat`
  - `lng`
  - `countyId`
  - `countyFips`
  - `countyName`
  - `tradeCategories[]`
  - `verifiedStatus` (`verified` | `unverified`)
  - `role`
- `meta` with count + filters + bbox

## Frontend Route

- Route: `/maps`
- File: `client/src/pages/maps.tsx`
- Uses marker clustering via `@googlemaps/markerclusterer`
- Preview card only exposes request path: `/request-quote?providerId=<id>`

## Key Restriction Checklist (Google Maps Browser Key)

1. Restrict application:
   - HTTP referrers only (your domains)
   - Example:
     - `https://www.thetradescout.com/*`
     - `https://thetradescout.com/*`
     - staging domains as needed
2. Restrict API usage:
   - Enable only Maps JavaScript API
3. Rotate leaked/old keys and remove unrestricted keys.
4. Keep server secrets out of browser env (`VITE_*` is public by design).

## Performance Target Notes

- Bounds queries are capped at 2000 providers per call.
- Marker clustering is enabled client-side to keep county-level pin density responsive.
- For larger geographies, keep map zoomed to county/state and rely on bbox fetch on pan/zoom.
