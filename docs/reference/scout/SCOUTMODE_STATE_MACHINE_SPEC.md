/**
 * PHASE 3d-B: Scout Mode State Machine Implementation
 * LOCKED & SHIPPED
 * 
 * Final Canonical Specification: Post-Onboarding Action Router
 * 
 * =============================================================================
 * OVERVIEW
 * =============================================================================
 * 
 * Scout is now a finite state machine with three modes:
 * 
 *   1. 'onboarding'        – bounded: claim inference + confirmation
 *   2. 'post_onboarding'   – bounded: action selection (deterministic)
 *   3. 'freeform'          – unbounded: normal Scout assistant
 * 
 * This prevents the UX problem where users hit a blank chat after signing up.
 * Every new user sees a professional action menu before freeform Scout unlocks.
 * 
 * =============================================================================
 * ENTRY CONDITIONS (GUARDS)
 * =============================================================================
 * 
 * onboarding
 * ──────────
 * Entered when ALL of:
 *   ✓ route === '/scout'
 *   ✓ query.onboarding === 'true'
 *   ✓ profileDraft.complete === true  (countyFips + presenceType)
 *   ✓ claims.confirmed === false
 *   ✓ session.ts_onboarding_complete !== '1'
 * 
 * If any guard fails → skip to freeform.
 * 
 * post_onboarding
 * ───────────────
 * Entered when ALL of:
 *   ✓ claims.confirmed === true  (user confirmed claims from inference)
 *   ✓ profileDraft.published === true  (currently same as .complete, will expand)
 *   ✓ session.ts_onboarding_complete !== '1'
 * 
 * This is a mandatory interstitial for new users post-claim-confirmation.
 * 
 * freeform
 * ────────
 * Entered when:
 *   • Any other state
 *   • User completes onboarding
 *   • User selects action from post_onboarding
 *   • User skips either onboarding or post_onboarding
 * 
 * =============================================================================
 * TRANSITIONS (Authoritative)
 * =============================================================================
 * 
 * onboarding → post_onboarding
 * ────────────────────────────
 * Trigger:
 *   User confirms claim suggestions via ClaimConfirmationCard
 *   → Calls onboarding.confirmClaims()
 *   → Calls scoutModeHook.completeOnboarding(selectedClaims)
 * 
 * Side Effects:
 *   ✓ writeClaimEvents() (claims written to DB)
 *   ✓ publishProfile() (profile marked as published)
 *   ✓ sessionStorage.setItem('ts_onboarding_complete', '1')
 *   ✓ Telemetry: scout_onboarding_completed
 * 
 * Then:
 *   setScoutMode('post_onboarding')
 * 
 * Rendering:
 *   ScoutOS renders <PostOnboardingActionCard /> instead of chat
 * 
 * ────────────────────────────
 * post_onboarding → freeform
 * ────────────────────────────
 * Trigger:
 *   User clicks ANY button in <PostOnboardingActionCard />
 *   → onActionSelected(actionId, destination)
 *   → Calls scoutModeHook.selectPostOnboardingAction(actionId)
 *   → navigate(destination) [e.g., /business/{slug}/edit, /community]
 * 
 * Side Effects:
 *   ✓ Telemetry: post_onboarding_action_selected
 *   ✓ Routes to explicit destination
 * 
 * Then:
 *   setScoutMode('freeform')
 * 
 * ────────────────────────────
 * onboarding → freeform (escape hatch)
 * ────────────────────────────
 * Trigger:
 *   User clicks "Skip for now" button during onboarding
 *   → Calls onboarding.skipOnboarding()
 *   → Calls scoutModeHook.skipOnboarding()
 * 
 * Side Effects:
 *   ✓ sessionStorage.setItem('ts_onboarding_complete', '1')
 *   ✓ Telemetry: scout_onboarding_skipped { reason: 'user_skip' }
 *   ✓ navigate('/community')
 * 
 * Then:
 *   setScoutMode('freeform')
 * 
 * This is logged but allowed. Users who skip don't get harassed later.
 * 
 * =============================================================================
 * RENDERING LOGIC (Mode-Driven Switch)
 * =============================================================================
 * 
 * In ScoutOS.tsx, after imports and hook setup:
 * 
 *   const scoutModeHook = useScoutMode({
 *     userId: (user as any)?.id,
 *     profileDraftComplete: ...,
 *     profileDraftPublished: ...,
 *     claimsConfirmed: ...,
 *     confirmedClaims: ...,
 *     publishedProfileSlug: ...,
 *   });
 * 
 * Then in JSX:
 * 
 *   // Phase 3d-A: Claim confirmation card (during 'onboarding')
 *   {onboarding.flowState.phase === 'confirming' && (
 *     <ClaimConfirmationCardComponent
 *       data={...}
 *       onConfirm={(selectedClaims) => {
 *         onboarding.confirmClaims(...);
 *         scoutModeHook.completeOnboarding(selectedClaims);  // ← IMPORTANT
 *       }}
 *       onSkip={() => {
 *         onboarding.skipOnboarding();
 *         scoutModeHook.skipOnboarding();  // ← IMPORTANT
 *       }}
 *     />
 *   )}
 * 
 *   // Phase 3d-B: Action card (during 'post_onboarding')
 *   {scoutModeHook.scoutMode === 'post_onboarding' && (
 *     <PostOnboardingActionCard
 *       claims={scoutModeHook.confirmedClaims}
 *       actions={resolvePostOnboardingActions(...)}
 *       onActionSelected={(actionId, destination) => {
 *         scoutModeHook.selectPostOnboardingAction(actionId);
 *         navigate(destination);
 *       }}
 *     />
 *   )}
 * 
 *   // Normal Scout (all other cases)
 *   {scoutModeHook.scoutMode === 'freeform' && (
 *     <ScoutThread />
 *     <ScoutInput />
 *   )}
 * 
 * =============================================================================
 * ACTION RESOLUTION (Claim → Action Mapping)
 * =============================================================================
 * 
 * File: client/src/scout/resolvePostOnboardingActions.ts
 * 
 * Pure function, no side effects, deterministic:
 * 
 *   resolvePostOnboardingActions(claims: ClaimType[], profile): PostOnboardingAction[]
 * 
 * Example mappings:
 * 
 *   if (claims.includes('offer_services')) {
 *     actions.push({
 *       id: 'setup_services',
 *       label: 'Set up services & availability',
 *       destination: `/business/${profile.slug}/edit?tab=services`,
 *       primary: true,
 *     });
 *   }
 * 
 *   if (claims.includes('find_help')) {
 *     actions.push({
 *       id: 'post_request',
 *       label: 'Post a request',
 *       destination: '/direct-connect/new',
 *       primary: true,
 *     });
 *   }
 * 
 * Always includes fallback actions:
 *   • 'explore'     → /community
 *   • 'ask_scout'   → /scout
 * 
 * Result is deduped by ID.
 * 
 * =============================================================================
 * STATE MACHINE TYPES & GUARDS
 * =============================================================================
 * 
 * File: client/src/scout/scoutModeTypes.ts
 * 
 * Contains:
 * 
 *   type ScoutMode = 'onboarding' | 'post_onboarding' | 'freeform'
 * 
 *   interface PostOnboardingAction {
 *     id: string;
 *     label: string;
 *     destination: string;
 *     primary?: boolean;
 *   }
 * 
 *   canEnterOnboarding(input): boolean
 *   canEnterPostOnboarding(input): boolean
 *   canEnterFreeform(): boolean
 * 
 * Guards are pure: they only check input, never modify state.
 * 
 * =============================================================================
 * HOOK: useScoutMode
 * =============================================================================
 * 
 * File: client/src/scout/useScoutMode.ts
 * 
 * Signature:
 * 
 *   useScoutMode(input: {
 *     userId?: string;
 *     profileDraftComplete?: boolean;
 *     profileDraftPublished?: boolean;
 *     claimsConfirmed?: boolean;
 *     confirmedClaims?: ClaimType[];
 *     publishedProfileSlug?: string;
 *   })
 * 
 * Returns:
 * 
 *   {
 *     scoutMode: ScoutMode;                            // Current mode
 *     setScoutMode(mode: ScoutMode): void;             // Manual override (rarely used)
 *     completeOnboarding(claims: ClaimType[]): void;   // Transition to post_onboarding
 *     selectPostOnboardingAction(id: string): void;    // Transition to freeform
 *     skipOnboarding(): void;                          // Transition to freeform
 *     enterFreeform(from?: ScoutMode): void;           // Explicit transition
 *     confirmedClaims: ClaimType[] | undefined;        // Input data (for rendering)
 *     publishedProfileSlug: string | undefined;        // Input data (for rendering)
 *   }
 * 
 * =============================================================================
 * COMPONENT: PostOnboardingActionCard
 * =============================================================================
 * 
 * File: client/src/scout/PostOnboardingActionCard.tsx
 * 
 * Props:
 * 
 *   interface PostOnboardingActionCardProps {
 *     claims: ClaimType[];
 *     actions: PostOnboardingAction[];
 *     onActionSelected: (actionId: string, destination: string) => void;
 *   }
 * 
 * Rendering:
 * 
 *   • Card header: "What's next?"
 *   • Button per action (primary = blue, secondary = gray)
 *   • Each button shows label + ArrowRight icon
 *   • Footer: "You can always change your mind. Scout is here to help anytime."
 * 
 * Behavior:
 * 
 *   User clicks action button
 *   → onActionSelected(actionId, destination)
 *   → ScoutOS calls navigate(destination)
 *   → scoutModeHook.selectPostOnboardingAction() logs telemetry
 * 
 * No LLM calls, no chat, no freeform suggestions in this mode.
 * Pure navigation UI.
 * 
 * =============================================================================
 * TELEMETRY EVENTS (Non-Optional)
 * =============================================================================
 * 
 * Event: scout_onboarding_started
 * Payload: { profileType, countyFips }
 * When: User enters onboarding mode
 * 
 * Event: scout_onboarding_completed
 * Payload: { claims: string[], profileType, countyFips }
 * When: User confirms claims → transition to post_onboarding
 * 
 * Event: scout_onboarding_skipped
 * Payload: { reason: 'user_skip' }
 * When: User skips onboarding via "Skip for now" button
 * 
 * Event: post_onboarding_action_card_shown
 * Payload: { claims: string[], actionCount }
 * When: PostOnboardingActionCard renders
 * 
 * Event: post_onboarding_action_selected
 * Payload: { actionId: string, claims: string[], destination?: string }
 * When: User clicks any action button
 * 
 * Event: scout_entered_freeform
 * Payload: { from: 'onboarding' | 'post_onboarding' }
 * When: Transition from any bounded mode to freeform
 * 
 * All events are logged via window.__telemetry() stub.
 * 
 * =============================================================================
 * KPIs & MEASUREMENT
 * =============================================================================
 * 
 * Onboarding Completion Rate
 *   = scout_onboarding_completed / scout_onboarding_started
 * 
 * Skip Rate
 *   = scout_onboarding_skipped / scout_onboarding_started
 * 
 * Time-to-First-Action
 *   = post_onboarding_action_selected timestamp - scout_onboarding_completed timestamp
 * 
 * Action Distribution by Claim
 *   = count(post_onboarding_action_selected { actionId=X }) / count(post_onboarding_action_card_shown)
 *   → reveals which next-steps users choose most often
 * 
 * =============================================================================
 * NO REGRESSION GUARANTEES
 * =============================================================================
 * 
 * Once a user enters 'post_onboarding', they CANNOT re-enter 'onboarding'.
 * Session guard: sessionStorage.setItem('ts_onboarding_complete', '1')
 * 
 * This prevents:
 *   ✓ Re-running claim inference on user action
 *   ✓ Showing claim confirmation card twice
 *   ✓ Double-writing claims
 * 
 * =============================================================================
 * FUTURE EXPANSIONS
 * =============================================================================
 * 
 * Business Profile v1 Integration:
 *   • post_onboarding action: "Manage your business profile"
 *   • Once Business Profile is live, route: /business/{slug}/edit
 * 
 * Explore Mode (replaces /community neutral fallback):
 *   • When /explore ships, update freeform fallback routing
 *   • Currently: navigate('/community') for skipped/no-claim users
 *   • Future: navigate('/explore') for more neutral, ORCA-friendly UX
 * 
 * Claim Updates (minor):
 *   • If new claim types added, update resolvePostOnboardingActions()
 *   • Action resolver is pure → no state machine changes needed
 * 
 * =============================================================================
 * TESTING CHECKLIST
 * =============================================================================
 * 
 * □ User completes pre-scout-setup → redirects to /scout?onboarding=true
 * □ onboarding mode renders ClaimConfirmationCard (not chat)
 * □ User confirms claims → transition to post_onboarding
 * □ post_onboarding mode renders PostOnboardingActionCard (not chat)
 * □ Each action button routes to correct destination
 * □ Skipping onboarding → freeform + navigate('/community')
 * □ Session guard prevents re-entry to onboarding
 * □ All telemetry events fire at correct transitions
 * □ Mobile layout responsive on small screens
 * □ Build succeeds, no TypeScript errors
 * 
 * =============================================================================
 * ARCHITECTURAL INVARIANTS (Do Not Violate)
 * =============================================================================
 * 
 * 1. Mode is the source of truth for UX surface
 *    → No conditional rendering inside individual components
 *    → ScoutOS owns the switch statement
 * 
 * 2. Transitions are explicit and logged
 *    → Every mode change goes through a named function
 *    → Telemetry always fires during transitions
 * 
 * 3. Guards are pure, transitions are effectful
 *    → canEnterX() functions never modify state
 *    → completeOnboarding(), selectPostOnboardingAction(), etc. do
 * 
 * 4. Post-onboarding has no LLM
 *    → Pure deterministic action resolution
 *    → Buttons are claim-derived, not suggestion-derived
 *    → No Chat.* components used in post_onboarding mode
 * 
 * 5. Actions map to real routes only
 *    → No placeholder destinations
 *    → /business/{slug}/edit must exist before action is offered
 * 
 * =============================================================================
 * STATUS: LOCKED & SHIPPED
 * =============================================================================
 * 
 * Implementation Date: 2026-01-01
 * Build Status: ✓ Green
 * Telemetry: ✓ Wired
 * Integration Points: ✓ Complete
 * 
 * Next Phase:
 *   • Business Profile v1 (blocked until this is live)
 *   • SEO hardening v1.1
 * 
 * Critical Path:
 *   ScoutMode machine → Business Profile v1 → SEO hardening
 */
