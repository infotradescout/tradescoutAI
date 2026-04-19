# TradeScout Onboarding Flow: Deep Dive Analysis

## Executive Summary

The TradeScout onboarding flow is a multi-layered system designed to progressively capture user intent, location, and role without creating high-friction barriers. It operates across three distinct phases: the pre-Scout setup (authentication and initial location capture), the profile normalization and intent confirmation (core onboarding), and the Scout-driven contextual onboarding (D2 implementation). This analysis explores the architecture, user experience (UX), state management, and potential areas for improvement within the current implementation.

## Architecture and Flow Overview

The onboarding journey is orchestrated through a combination of client-side routing guards and server-side middleware, ensuring that users cannot access core platform features until they have provided essential profile data.

### 1. Pre-Scout Setup (`/pre-scout-setup`)
This is the entry point for unauthenticated users. It combines authentication (local and OAuth) with the initial capture of provisional data.
- **Authentication:** Users can sign in or create an account. The UI dynamically switches between these modes based on URL parameters (`?mode=create` or `?mode=signin`).
- **Location Capture:** For new users, the system captures their `presenceType` (personal or business), `stateCode`, `countyFips`, and optionally a `city` and `businessName`. A notable UX feature is the automatic county inference based on the provided city and state.
- **Provisional State:** This data is saved as a `ProfileDraft` within the user's `preferences.provisional` object, allowing the system to route the user appropriately even if the full profile normalization is delayed.

### 2. Core Onboarding Gates (`/onboarding/profile` and `/onboarding/intent`)
Once authenticated, users are evaluated against two primary flags: `onboardingCompleted` and `profileVersion`.
- **The Gatekeeper:** The `AppRoutes.tsx` and `ProtectedRoute.tsx` components enforce this check. If a user's `profileVersion` is less than `CURRENT_PROFILE_VERSION` (currently set to 1) or `onboardingCompleted` is false, they are redirected to the onboarding flow. Super admins and specific privileged roles bypass this gate.
- **Profile Normalization (`/onboarding/profile`):** This step ensures the user has a first name, last name, and a canonical location (`stateCode` and `countyFips`). It hydrates from the provisional draft if available.
- **Intent Confirmation (`/onboarding/intent`):** Users select their primary reason for joining (Community, Local Directory, Offer Services, or Scout). This selection dictates their immediate post-onboarding destination. Crucially, this step calls the `/api/user/complete-onboarding` endpoint, which sets `onboardingCompleted` to true and updates the `profileVersion`.

### 3. Scout Contextual Onboarding (D1/D2 Design)
TradeScout implements a sophisticated, conversational onboarding flow directly within the Scout AI interface, triggered by the `?onboarding=true` query parameter.
- **Inference Engine:** The `useScoutOnboarding` hook utilizes an LLM (via `/api/ai/inference`) to parse the user's free-form intent text into structured `ClaimType` suggestions (e.g., `find_help`, `offer_services`).
- **Contextual Questions:** The server-side `onboardingService.ts` manages a session state, injecting specific questions (Intent, Urgency, Scope, Category) into the Scout chat to refine the user's profile confidence.
- **Auto-Expiration:** The flow is designed to be unobtrusive. It auto-expires if the system's confidence in the user's intent reaches 80%, if 5 minutes elapse, or if the user takes a significant action.

## State Management and Data Integrity

The system employs a robust approach to state management, balancing immediate UX needs with long-term data integrity.

- **Provisional vs. Canonical:** Initial data is stored in a flexible `preferences.provisional` JSON structure. This allows for low-friction data capture before the user is fully committed. The core onboarding flow then promotes this data into canonical, strongly-typed database columns (e.g., `firstName`, `countyFips`).
- **Session Tracking:** The Scout contextual onboarding uses a combination of server-side memory (`onboardingSessions` Map) and client-side `sessionStorage` (`ts:onboardingClaimsDone`) to ensure the flow only runs once per session and doesn't trap the user in a loop.
- **Version Control:** The `CURRENT_PROFILE_VERSION` constant is a critical mechanism. It allows the development team to force existing users through a new onboarding flow if breaking changes are made to the profile schema, ensuring data consistency across the user base.

## UX Observations and Improvement Opportunities

While the onboarding flow is well-architected, several areas present opportunities for refinement.

### 1. County Inference Feedback Loop
The automatic county inference in `/pre-scout-setup` is a strong UX feature, reducing friction for users who may not know their exact county. However, the feedback mechanism relies on small text indicators below the input fields.
**Recommendation:** Enhance the visual feedback when a county is successfully inferred. A subtle animation or a clearer confirmation badge could improve user confidence in the system's automated selection.

### 2. Handling of Skipped Intent
In `/onboarding/intent`, users can choose to "Skip for now." This action defers the onboarding completion and routes them to a fallback destination (Community). However, because `onboardingCompleted` remains false, they will be caught by the `AuthenticatedOnboardingGate` on subsequent navigations to protected routes.
**Recommendation:** Clarify the implications of skipping. If skipping is intended to be a temporary pause, the UI should clearly indicate that the user is in a restricted state. Alternatively, if skipping is meant to allow full access with default settings, the skip action should still call `/api/user/complete-onboarding` but record the intent as "unspecified."

### 3. Scout Onboarding Session Persistence
The server-side `onboardingSessions` Map in `onboardingService.ts` is stored in memory. This means that if the Node.js server restarts or if the application is scaled across multiple instances without sticky sessions, the user's conversational onboarding state will be lost.
**Recommendation:** Migrate the `OnboardingSession` storage to a distributed cache like Redis. This ensures state persistence across server restarts and supports horizontal scaling, providing a seamless experience for the user regardless of backend infrastructure events.

### 4. Error Handling in Claim Inference
The `inferClaimsFromIntent` function relies on an LLM to parse user intent. While it has a fallback mechanism (defaulting to "exploring"), LLM latency or temporary unavailability could disrupt the flow.
**Recommendation:** Implement a more robust retry mechanism or a faster, deterministic fallback path that doesn't rely on the LLM if the initial request times out. This ensures the user is never blocked by third-party API latency during their critical first interaction.

## Conclusion

The TradeScout onboarding flow demonstrates a mature approach to user acquisition, balancing the need for structured data with a low-friction, conversational user experience. The separation of provisional data capture, canonical profile normalization, and AI-driven intent refinement creates a flexible and powerful system. By addressing the minor UX and state persistence opportunities identified above, the flow can be further optimized for scale and user satisfaction.
