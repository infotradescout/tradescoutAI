# Slice 70 — Direct Connect Mobile Usability Smoke + Post-Fix KPI Check

Date: 2026-05-31  
Status: PASS (mobile usability smoke coverage + live build verification) / KPI refresh pending staff-auth pull

## Scope
- Confirm Slice 69 build is live.
- Add focused mobile smoke coverage for Direct Connect composer hierarchy.
- Attempt post-fix KPI pull and record access status.

## Build Verification
- Endpoint: `GET /api/health`
- Result: `200`
- `x-tradescout-build`: `9734ed6b22a622c7d8d75e76559424f186f197a9`
- Decision: deployment lag is cleared for Slice 69.

## Mobile Usability Smoke
- Added gated Playwright smoke:
  - `tests/direct-connect-mobile-usability-smoke.spec.ts`
  - Gate: `RUN_DIRECT_CONNECT_MOBILE_USABILITY_SMOKE=1`
- Assertions:
  - `/direct-connect` route resolves (or explicitly auth-redirects).
  - Core request inputs are visible before Home Record controls:
    - title placeholder: `What do you need help with?`
    - details placeholder: `Describe what needs to be done, where it is, and your timeline.`
    - `Request photos`
  - Home Record section is compact and optional:
    - `Home record (optional)`
    - `Use saved home details`
    - `Create a home record`
    - `Skip for now`
    - `Show options`
  - Advanced technical field is not visible by default:
    - `Existing component ID` absent in default view

## KPI Pull Attempt
- Endpoint: `GET /api/analytics/product-kpi/summary`
- Unauthenticated runtime result: `403`
- Response body:
  - `{ "error": "Automated scraping is blocked." }`
- Interpretation:
  - Staff/auth gate remains intact.
  - Fresh post-fix KPI counts require a manual staff-authenticated browser pull.

## Slice 70 Decision
1. Slice 69 deploy is confirmed live.
2. Mobile Direct Connect composer usability is now explicitly smoke-covered.
3. Post-fix KPI decision remains pending staff-authenticated payload capture.

## Required Follow-up (Staff Browser)
Run from logged-in staff browser on production:

```js
(async () => {
  const health = await fetch('/api/health', { credentials: 'include' });
  console.log('BUILD:', health.headers.get('x-tradescout-build'));

  const kpi = await fetch('/api/analytics/product-kpi/summary', {
    credentials: 'include',
    headers: { Accept: 'application/json' }
  });

  console.log('KPI STATUS:', kpi.status);
  console.log(await kpi.text());
})();
```

Capture:
- `direct_connect_request_started`
- `direct_connect_home_record_prompt_viewed`
- `direct_connect_home_record_link_selected`
- `direct_connect_home_record_create_selected`
- `direct_connect_home_record_skipped`
- `direct_connect_request_submitted_after_home_record_skip`
- `direct_connect_homeid_link_selected`

## Validation
- `npm run check` PASS
- `npm run test` PASS
- `npm run build` PASS

