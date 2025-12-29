# Legacy Tour Deletion Checklist

This checklist inventories the current tour/onboarding components and maps each to a recommended action based on UNIVERSAL_USER_TOUR_SPEC.md.

Doctrine recap:
- We want **one universal, page-scoped tour system** that teaches the Scout + Direct Connect mental model.
- Legacy tours that teach conflicting or redundant narratives are treated as **bugs**, not product variants.
- Removing/suppressing them is **allowed during the freeze** as cleanup, not evolution.

Use this file as a working list while deleting or suppressing legacy tours.

---

## 1. Core tour infrastructure (KEEP, to be refactored later)

These are plumbing pieces that a future universal tour system can reuse.

- [client/src/components/onboarding/types.ts](client/src/components/onboarding/types.ts) — TourStep and TourConfig types.  
  - ✅ KEEP (can back the universal tour model later).

- [client/src/components/onboarding/OnboardingTour.tsx](client/src/components/onboarding/OnboardingTour.tsx) — generic tour renderer + hook.  
  - ✅ KEEP (candidate engine for universal tours; behavior may be simplified later).

- [client/src/components/onboarding/OnboardingProvider.tsx](client/src/components/onboarding/OnboardingProvider.tsx) — context for starting/completing tours.  
  - ✅ KEEP (central wiring; can be adapted to universal, page-scoped tours).

- [client/src/components/onboarding/OnboardingTrigger.tsx](client/src/components/onboarding/OnboardingTrigger.tsx) — generic trigger button.  
  - ✅ KEEP (may be reused for explicit “replay tour” buttons per page).

- [client/src/components/ui/help-bubble.tsx](client/src/components/ui/help-bubble.tsx#L115-L140) — GuidedTour component.  
  - ✅ KEEP (generic guided tour UI; integrate into the universal system later).

- [client/src/components/onboarding/SubtleHints.tsx](client/src/components/onboarding/SubtleHints.tsx) and SimpleSubtleHints imports.  
  - ✅ KEEP (subtle hints are compatible with universal tour doctrine and already favored over auto tours).

---

## 2. Legacy, role-specific or feature-specific tours (DELETE)

These are the tours that fragment the mental model and should be removed entirely, not refactored.

### 2.1 Board / dashboard tours

- [client/src/components/onboarding/tours/ContractorBoardTour.tsx](client/src/components/onboarding/tours/ContractorBoardTour.tsx)  
  - ❌ DELETE.  
  - Rationale: teaches a separate "contractor board" mental model; conflicts with Direct Connect as the hub.

- [client/src/components/onboarding/tours/ContractorDashboardTour.tsx](client/src/components/onboarding/tours/ContractorDashboardTour.tsx)  
  - ❌ DELETE.  
  - Rationale: role-specific dashboard tour; overlaps with universal tour goals and adds contractor-centric framing.

### 2.2 Feature tours

- [client/src/components/onboarding/tours/FeatureTour.tsx](client/src/components/onboarding/tours/FeatureTour.tsx)  
  - ❌ DELETE.  
  - Rationale: feature-by-feature tours encourage fragmented learning and contradict the “3 key ideas per surface” rule.

- [client/src/components/onboarding/OnboardingDemo.tsx](client/src/components/onboarding/OnboardingDemo.tsx)  
  - ❌ DELETE.  
  - Rationale: demo surface for interactive tours; duplicates universal tour intent and is no longer the desired pattern.

- [client/src/components/simple-floating-help.tsx](client/src/components/simple-floating-help.tsx)  
  - ❌ DELETE or fold into a single future help entry point.  
  - Rationale: presents “Help & Tours” options separate from the universal tour system; keep only one help/tour launcher.

### 2.3 New user, role-based tours

- [client/src/components/onboarding/tours/NewUserTour.tsx](client/src/components/onboarding/tours/NewUserTour.tsx)  
  - ❌ DELETE.  
  - Rationale: role-based new user tour with project-centric phrasing; conflicts with page-scoped, role-agnostic tours.

- Any use of NewUserTour or tour keys like `new-user-tour-*` in other components (e.g., demos, dashboards).  
  - ❌ DELETE or strip out when removing NewUserTour.

### 2.4 Floating tour menus

- [client/src/components/floating-help-button.tsx](client/src/components/floating-help-button.tsx)  
  - ⚠️ REVIEW.  
  - It currently lists specific tours ("Contractor Search Tour", "Daily Deals Tour", "Groups Tour").  
  - Recommended action:  
    - ❌ Remove tour-specific options once underlying tours are deleted.  
    - ✅ Keep the button as a generic entry to help/Docs/Scout orientation consistent with the universal spec.

- [client/src/components/help-system-provider.tsx](client/src/components/help-system-provider.tsx)  
  - ⚠️ REVIEW.  
  - Ensure `showOnboardingTour` stays disabled and that any future use routes into the universal tour, not feature-specific tours.

---

## 3. Tutorials and orientation flows (KEEP but align)

These are not strict “tours” but influence onboarding.

- [client/src/hooks/useTutorial.ts](client/src/hooks/useTutorial.ts)  
  - ⚠️ KEEP for now; ensure onboarding tutorials it auto-starts do not conflict with the universal tour doctrine.  
  - Future: may be folded into a unified guidance layer or limited to staff/advanced flows.

- [client/src/components/orientation/OrientationCard.tsx](client/src/components/orientation/OrientationCard.tsx)  
  - ✅ KEEP.  
  - Acts as a one-time orientation card after onboarding; should be checked to ensure it reinforces Scout + Direct Connect, not legacy concepts.

- [client/src/components/RoleDashboardRouter.tsx](client/src/components/RoleDashboardRouter.tsx#L69-L88)  
  - ✅ KEEP.  
  - Contains logic for post-onboarding orientation cards; copy should be aligned with universal tour and Direct Connect doctrine.

---

## 4. Implementation checklist

When you’re ready to apply this cleanup in code, follow this order:

1. **Remove legacy tour components**
   - Delete:
     - ContractorBoardTour.tsx
     - ContractorDashboardTour.tsx
     - FeatureTour.tsx
     - NewUserTour.tsx
     - OnboardingDemo.tsx
     - simple-floating-help.tsx (or refactor its affordance into a single help/tour entry if truly needed).

2. **Strip references to deleted tours**
   - Search for tour keys and components:
     - `contractor-board-tour`
     - `feature-tour-`
     - `new-user-tour-`
     - `OnboardingDemo`
     - `SimpleFloatingHelp` or similar
   - Remove or replace them with either:
     - No-op (for pure cleanup), or
     - A placeholder that will call the future universal tour for that surface.

3. **Verify OnboardingProvider remains generic**
   - Ensure it no longer auto-starts any feature- or role-specific tours.  
   - Confirm it can later be reused to host the per-surface universal tours.

4. **Sanity-check help and subtle hints**
   - Confirm the floating help entry and subtle hints:
     - Do not reference deleted tours by name.  
     - Point users toward Scout, Direct Connect, and the help system, not legacy walkthroughs.

5. **Defer universal tour implementation**
   - Do **not** build new tours yet.  
   - Use UNIVERSAL_USER_TOUR_SPEC.md as the blueprint when the freeze lifts and outcome triggers allow evolution.

This checklist keeps cleanup firmly in the “bug fix and consolidation” lane while preparing the ground for a single, coherent tour experience later.