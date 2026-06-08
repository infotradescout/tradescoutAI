# Slice 95 - Landing Conversion Instrumentation Baseline

Status: implemented

Date: 2026-06-08

## Goal

Measure whether the locked public landing page converts visitors into request starts without
changing landing copy, layout, routing, or product behavior.

## Baseline Events

- `demand.landing_view`: emitted when the locked public landing page renders.
- `demand.cta_click`: emitted when the primary `Start a Request` CTA is selected.
- `direct_connect_request_started`: already emitted by the request composer; now attributable to
  `source=landing_primary_cta` when entered from the locked landing CTA.

## Contract Coverage

- `server/tests/landing-conversion-instrumentation.contract.test.ts`
  - verifies locked landing demand view instrumentation.
  - verifies primary CTA click instrumentation.
  - verifies request-composer source propagation to request-start KPI tracking.
- `server/tests/product-kpi-audit-route.contract.test.ts`
  - verifies `direct_connect_request_started` remains in the product KPI allowlist.
- `server/tests/core-product-kpi-event-delivery.contract.test.ts`
  - verifies landing-attributed request-start KPI events persist through `/api/analytics/shell`.

## Law Impact

- Visibility/contact gating: enforced, unchanged.
- Customer-facing copy restrictions: enforced, unchanged.
- County routing containers: enforced, unchanged.
- Trust/CVS exposure path: enforced, unchanged.

## KPI Readout Path

Use the existing demand and product KPI analytics surfaces to compare:

- landing views
- primary CTA clicks
- request composer starts from `landing_primary_cta`
- submitted requests
