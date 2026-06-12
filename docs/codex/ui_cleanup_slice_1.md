# UI Cleanup Slice 1

## Scope

Slice 1 targets the mobile Direct Connect / Post a Request / Prepare a Request flow.

Primary job: let a requester describe what they need.

Primary action: review request.

## Active UI Law

Every app screen gets exactly one primary job, one primary action, and only the minimum explanation required to complete it safely.

## Global UI Filter

If a normal user needs visible information to take action, keep it short and close to the action.

If visible text exposes internal system logic, move it out of the primary viewport, collapse it, or enforce it through code, contracts, tests, admin surfaces, or docs.

## Slice 1 Execution Standard

- Direct Connect remains primary.
- Requester-neutral language is required.
- Scout remains search/local summary, not chatbot/helper language.
- HomeID stays optional and secondary.
- Anonymous posting behavior is not changed.
- Direct Connect submission behavior is not changed.
- Contact protection is preserved through existing logic, not explained as doctrine in the form viewport.
- Legal acknowledgment remains present where already implemented.

## Approved Beta Copy

Title: TradeScout beta

Body: We’re improving requests while beta is active. Report anything that feels off.

The beta notice must be compact, inline, and non-blocking. It must not float over inputs, legal text, CTA buttons, or bottom navigation.

## Slice 1 Changes Applied

- Replaced system-thinking form intro copy with action-oriented request copy.
- Converted the request stepper into a compact mobile progress row.
- Reduced visible HomeID explanation to a short optional save prompt.
- Kept HomeID details behind an explicit action.
- Normalized request fields, spacing, textarea sizing, and photo upload affordance.
- Preserved the photo count and accepted formats.
- Kept the final legal acknowledgment near the review action.
- Softened shared mobile bottom navigation without changing route semantics.

## Out Of Scope

- Backend contracts
- Database schemas
- Auth rules
- Analytics event names or payloads
- Direct Connect API submission mechanics
- HomeID persistence behavior
- Admin, SEO, onboarding, Scout, MealScout, or Sway lanes
