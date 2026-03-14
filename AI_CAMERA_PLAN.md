# Zero-Base-Fee Measurement System (TradeScout)

## Objective
Build a paid, production-ready mobile capture workflow that:
- unlocks on successful Stripe payment,
- captures image with timestamp + GPS burn-in,
- calibrates measurements using ArUco marker first,
- falls back to known fixed references (for example outlet screw spacing),
- exports a professional PDF report.

## Implemented in this pass
1. **Payment-gated API flow**
- `POST /api/zero-base-fee/checkout-session`
- `GET /api/zero-base-fee/verify-checkout?sessionId=...`
- Signed temporary access token for capture/report actions.

2. **Marker generation**
- `GET /api/zero-base-fee/marker.pdf?id=42&sizeIn=2`
- Uses ArUco marker matrix generation and renders printable PDF.

3. **Capture and report UI**
- New protected route/page: `/zero-base-fee` and `/zero-base-fee/camera`
- Camera capture, GPS/timestamp watermark burn-in.
- Calibration modes:
  - ArUco marker (auto-detect + manual fallback),
  - known fixed references (outlet screws, credit card, paper dimensions),
  - user-defined known references (for example, two level tape marks placed 36 inches apart).
- PDF report export via `jsPDF`.

4. **Storage/logging**
- Runtime table guards for `zero_base_fee_sessions` and `zero_base_fee_reports`.
- Report metadata persisted server-side.

## Next hardening steps
1. Add **automatic ArUco corner detection** (OpenCV.js path) and keep manual taps as fallback.
2. Expand known-reference detection and prompts:
- outlet screw center auto-pairing,
- common-object presets with confidence tagging,
- user-guided reference workflows ("place two marks X inches apart").
3. Add email attachment support for report PDFs.
4. Add admin reporting surface for paid sessions + report outcomes.
5. Add Stripe webhook reconciliation for payment finalization audits.

## Confidence tiers in final report
- **Tier A:** ArUco marker used (primary calibration).
- **Tier B:** Known fixed reference used (outlet screw spacing or other preset).
- **Tier C:** Custom user-provided reference distance.

## Deferred roadmap (planned, not in current build)
These are intentionally deferred so we keep the current release simple and stable.

1. **Real-world tolerance upgrades**
- Perspective/plane correction for non-square capture angles.
- Multi-reference averaging to reduce error from imperfect alignment.
- Explicit uncertainty band in reports (for example, `X in +/- Y in`).

2. **Additional marker/reference expansion**
- Charuco/checkerboard support for stronger calibration in difficult scenes.
- More known-object presets with stricter confidence scoring.
- Optional second-shot verification flow for low-confidence captures.

3. **Identity + valuation mode (future separate module)**
- OCR capture for VIN/serial/part identifiers.
- Decode and enrich identity data for valuation workflows.
- Keep valuation outputs separate from geometry measurement confidence.

## Cross-surface implementation scope (approved)
Build this as one shared intelligence layer across TradeScout surfaces, with county-aware outputs and minimal photo requirements.

### Surfaces
- Exchange (item valuation and fair-price support; exchange fees always apply).
- HomeScout (inspection + permit prep guidance).
- ScoutFitters (equipment/service fitment checks).
- Scout (next-step planning and guided execution).
- Direct Connect (pro matching and requirement handoff).

### Output model per request
- Predicted next steps (ranked).
- Products/material suggestions.
- Pro/service recommendations.
- Permit/requirement checklist.
- Cost ranges with confidence tiers.
- Fallback path when confidence is low or data is missing.

### Intelligence source priority
1. TradeScout first-party data (site-wide historical outcomes, county patterns, pricing outcomes, trust/CVS constraints).
2. County-specific stored intelligence snapshots.
3. Controlled fallback heuristics (only when first-party confidence is insufficient).

### Minimal-photo policy (billing protection)
- Require only the minimum number of photos needed for a reliable result per mode.
- Stop capture once confidence threshold is reached.
- Prompt for additional photos only when quality/confidence is below threshold.
- Show expected photo count before capture starts.
- For paid flows, cap the billable capture set per request and preserve reuse across retries.

### Municipality/permit fast-track path
- Standardized evidence packet for local permit and inspection workflows.
- County-specific checklist and submission readiness score.
- Designed for "first-pass acceptance" and fewer correction cycles.

### Phase sequence
1. Foundation data model + APIs (multi-mode inspection cases, artifacts, recommendation snapshots).
2. Surface adapters (Exchange, HomeScout, ScoutFitters, Scout, Direct Connect).
3. County permit fast-track workflow and admin county-map discovery surfaces.
4. Confidence and optimization upgrades (perspective correction, multi-reference averaging, low-friction second-shot verification).
