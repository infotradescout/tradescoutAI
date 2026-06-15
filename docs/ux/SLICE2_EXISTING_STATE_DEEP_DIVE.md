# Slice 2 Existing-State Deep Dive - Inbox Action-Center Clarity

## Repo

infotradescout/tradescoutAI

## Baseline

main at 5fe356c341fc312ef39c232f61693e21df85bc33

## Purpose

This document records the existing-state analysis for the next Current Product UX Critical/High Fixes lane after Community Feed Hierarchy + Recommendation De-Systemization Slice 1.

No implementation is authorized by this document. This is a planning and pre-flight artifact only.

## Selected Slice 2 Target

Inbox Action-Center Clarity.

## Decision

Inbox Action-Center Clarity is the recommended Slice 2 target over Direct Connect Gate-Presentation Cleanup.

## Why This Target Comes First

The Direct Connect inbox/replies surface is the high-stakes bridge in the contact-gating lifecycle where a user evaluates an opportunity and decides whether to continue toward conversation/contact.

The current inbox presentation exposes internal matching and status concepts on the default UI. This makes the surface feel like an algorithmic cockpit or recommendation engine instead of a finished human-to-human local communication hub.

This risk is higher than general gate-presentation cleanup because the inbox is closer to the user's action moment. Confusing or system-looking copy here can reduce trust exactly when the product needs confidence, clarity, and local relevance.

## Files Inspected

Primary source surface:

- client/src/pages/direct-connect/DirectConnectShell.tsx

Relevant compiled shell evidence:

- DirectConnectShell compiled client artifact, if present in local build output

Relevant backend delivery surface:

- server/routes/direct-connect.ts

Relevant tests:

- server/tests/direct-connect.e2e.spec.ts

Relevant doctrine and product context:

- docs/ZACHARY_QA_DRY_RELEASE_GATE.md
- docs/ux/CORE_APP_SURFACE_UX_AUDIT.md
- docs/ux/TRADE_SCOUT_APP_SURFACE_LAW.md
- docs/TRADESCOUT_PRODUCT_AND_COPY_LAW.md
- Direct Connect execution/product documents where present

## Existing-State Findings

### P1 High - Fit Score Leakage

The inbox/replies card surface exposes "Fit score" terminology with a numeric value.

Risk:

- Makes the inbox feel like an internal matching system.
- Suggests algorithmic scoring without enough user context.
- Weakens the human, local, trust-first Direct Connect experience.
- Mirrors the same class of "exposing the engine" problem resolved in Community Slice 1.

Required implementation direction:

- Do not remove internal data flow if it is still needed for ordering, review, or contact decisions.
- Remove "Fit score" from default public card presentation.
- If supporting context is still useful, move it behind a public-safe disclosure such as "Match details."

### P2 Medium - Raw Distance Display

The inbox/replies card surface exposes raw distance values such as "X mi away."

Risk:

- Reads as a raw matching metric instead of useful local context.
- May be acceptable if reframed, but it should not appear as a naked system variable.

Required implementation direction:

- Hide raw distance from the primary default card row or reframe it as user-safe local context.
- If retained, place it inside a details area with copy that explains it as approximate local context.
- Do not alter backend distance calculation or API payloads.

### P2 Medium - Raw Timestamp Presentation

The inbox/replies surface may show raw or poorly formatted timestamp strings.

Risk:

- Raw date strings make the surface feel unfinished.
- Timestamps should support user action, not expose raw data formatting.

Required implementation direction:

- Use localized or relative user-facing time where practical.
- Do not alter stored timestamps or backend payload shape.

### P3 Low - Raw Status Label Presentation

The inbox/replies surface displays status labels such as "suggested" or "invited" near opportunity headers.

Risk:

- Raw enum-style copy reads like database state.
- Status labels need customer-safe vocabulary.

Required implementation direction:

- Map raw internal statuses to public-safe labels in the view layer.
- Do not change database enum strings or API response values.

Example public-safe label mapping direction:

- suggested -> New opportunity
- invited -> Invited
- saved -> Saved opportunity
- accepted -> Connected
- declined -> Dismissed
- expired -> Closed

Exact final labels should be confirmed during Gemini pre-flight and implementation.

## Selected Implementation Approach For Future Slice

Future implementation should de-systemize the inbox layout by changing only frontend presentation.

Expected approach:

1. Hide raw fit score from default card presentation.
2. Hide or reframe raw distance from default card presentation.
3. Convert raw timestamps to polished display text.
4. Map internal status values to public-safe labels.
5. Place any still-useful technical context behind a collapsed, user-safe "Match details" or equivalent disclosure.
6. Preserve the existing contact gating and reply/opportunity flow.

## Required Preservation Rules

Future implementation must preserve:

- Direct Connect routes
- inbox/replies mode behavior
- contact-gating lifecycle
- Decision Card/contact modal path
- session/auth checks
- county/regional context
- requester vocabulary
- existing API contracts
- existing backend serializers
- existing SQLite schema and data model
- existing post/reply/opportunity behavior
- existing trust/safety behavior

## Hard Non-Goals

Future implementation must not include:

- new features
- schema changes
- migrations
- API endpoint changes
- backend serializer changes
- auth changes
- route changes
- Direct Connect lifecycle redesign
- Inbox data model changes
- Scout search/control work
- sitemap work
- SEO work
- deploy work
- broad redesign
- DRY/SRP refactor
- module splitting
- unrelated cleanup

## Likely Files For Future Implementation Inspection

- client/src/pages/direct-connect/DirectConnectShell.tsx
- server/routes/direct-connect.ts
- server/tests/direct-connect.e2e.spec.ts
- any Direct Connect contract tests that cover inbox/replies rendering
- any shared Direct Connect type or fixture files used by the inbox card rendering

## Likely Future Contract Coverage

Future contract tests should verify that default-visible inbox/replies UI does not expose:

- Fit score
- raw score values as primary card copy
- raw matching metrics
- raw distance metrics without public-safe framing
- confidence
- scoring
- recommendation engine
- internal status/debug language
- raw JSON/debug blocks

Future tests should also verify public-safe inbox framing remains visible, such as:

- New opportunity
- Review before contact
- Local reply
- Match details
- Saved opportunity
- Connected
- Closed

Exact labels should be finalized during Gemini pre-flight.

## Likely Validation Commands For Future Implementation

Focused validations likely include:

npm run check

git diff --check

npm run build

Focused Direct Connect tests, depending on current test availability:

npm run test:run -- server/tests/direct-connect.e2e.spec.ts

Additional or updated focused contract coverage may be required if current tests do not inspect the rendered inbox/replies copy.

## Known Risks

1. Accidentally weakening contact gating while changing presentation.
2. Changing backend/API payloads instead of mapping copy in the view layer.
3. Hiding useful user context entirely instead of moving it behind clear public-safe disclosure.
4. Expanding into a broad Direct Connect redesign.
5. Breaking existing e2e tests that rely on seeded local Direct Connect data.
6. Confusing raw internal statuses with public-facing action states.

## Recommended Gemini Pre-Flight Question

Should Slice 2 proceed as a narrow frontend-only Inbox Action-Center Clarity lane that:

1. removes default-visible Fit score language,
2. reframes or collapses raw distance values,
3. formats timestamps into user-safe display copy,
4. maps raw status labels to customer-safe labels,
5. preserves all Direct Connect contact-gating behavior,
6. makes no backend/schema/API/auth/route changes?

Recommended pre-flight verdict requested:

PASS
PASS WITH CONDITIONS
BLOCK

Gemini should specifically evaluate whether Inbox Action-Center Clarity is the correct next UX slice and whether the proposed scope is tight enough to avoid Direct Connect lifecycle drift.
