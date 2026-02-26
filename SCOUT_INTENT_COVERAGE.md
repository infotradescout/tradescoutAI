# Scout Intent Coverage

Generated: 2026-02-26T00:23:30.097Z
Registry Version: 2026-02-24

## Summary
- Total registered behaviors: 21
- Client behaviors: 12
- Server behaviors: 9
- Behaviors without mapped tests: 0

## Representation Signal
- Target belief: Scout behavior is deliberate and test-governed.
- Target behavior: teams verify maturity with concrete coverage, not claims.
- Principle: transparency through measurable evidence.
- Risk prevented: under-representing existing system depth.

## Coverage Table
| ID | Surface | Label | Test Coverage |
| --- | --- | --- | --- |
| client.explicit-nav-intent | client | EXPLICIT NAV INTENT (high confidence; user asked to be routed) | 2 tests |
| client.explanation-why-not-moving | client | EXPLANATION: "Why isn't this moving yet?" | 1 tests |
| client.explanation-why-cannot-message | client | EXPLANATION: "Why can't I message yet?" | 2 tests |
| client.onboarding-intent | client | SCOUT ONBOARDING INTENT (fast win) | 1 tests |
| client.provider-intent-offer-services | client | PROVIDER INTENT A: "I want to offer services here" | 2 tests |
| client.provider-intent-presence-strength | client | PROVIDER INTENT B: "How strong is my presence here?" | 1 tests |
| client.provider-intent-promotion | client | PROVIDER INTENT C: "Help me run a promotion/deal" | 2 tests |
| client.community-intent | client | COMMUNITY INTENT: "Help me post an announcement/update" | 1 tests |
| client.contractor-search-intent | client | CONTRACTOR SEARCH INTENT | 2 tests |
| client.marketplace-intent | client | MARKETPLACE INTENT: search vs post | 1 tests |
| client.contact-support-intent | client | CONTACT SUPPORT INTENT | 1 tests |
| client.fallback-server-flow | client | FALLBACK: Use existing server flow if no intent matched | 2 tests |
| server.smart-synthesis-contract | server | Smart synthesis that ENFORCES the execution contract | 2 tests |
| server.oversize-hard-slice-fallback | server | Fallback: take a hard slice if everything is oversized | 1 tests |
| server.intro-overview-special-handling | server | SPECIAL HANDLING: Detect intro/overview questions and use comprehensive synthesis | 1 tests |
| server.governor-mode-situation | server | GOVERNOR MODE: Situation-driven intelligence | 1 tests |
| server.layer-resolution | server | LAYER RESOLUTION: Use knowledge service 4-layer system | 1 tests |
| server.smart-synthesis-deterministic-routing | server | SMART SYNTHESIS / DETERMINISTIC ROUTING | 1 tests |
| server.deterministic-early-exit | server | Deterministic early-exit: if user intent maps cleanly to an allowed | 1 tests |
| server.brand-identity-firewall | server | Brand identity firewall: if the synthesized answer clearly violates | 1 tests |
| server.auth-required-intent | server | Handle auth-required intent | 2 tests |

## Missing Test Mapping
- None

## Belief/Behavior Contract

### client.explicit-nav-intent
- Label: EXPLICIT NAV INTENT (high confidence; user asked to be routed)
- Target belief: Scout routes intentionally and transparently.
- Target behavior: User trusts explicit route intents and follows suggested actions.
- Risk prevented: Perceived randomness that erodes trust in Scout authority.

### client.explanation-why-not-moving
- Label: EXPLANATION: "Why isn't this moving yet?"
- Target belief: State transitions are explainable.
- Target behavior: User requests clarification instead of abandoning flow.
- Risk prevented: Confusion interpreted as platform unreliability.

### client.explanation-why-cannot-message
- Label: EXPLANATION: "Why can't I message yet?"
- Target belief: Contact gating is intentional and fair.
- Target behavior: User completes required intent/decision steps before contact.
- Risk prevented: Bypass pressure on gated discovery-to-contact pathway.

### client.onboarding-intent
- Label: SCOUT ONBOARDING INTENT (fast win)
- Target belief: Onboarding is guided and immediate.
- Target behavior: User takes first eligible action quickly.
- Risk prevented: Early-session drop-off due to uncertainty.

### client.provider-intent-offer-services
- Label: PROVIDER INTENT A: "I want to offer services here"
- Target belief: Provider pathways are structured and rule-based.
- Target behavior: Provider follows claim-first steps rather than role assumption.
- Risk prevented: Role-first misuse that violates claims-first law.

### client.provider-intent-presence-strength
- Label: PROVIDER INTENT B: "How strong is my presence here?"
- Target belief: Exposure is merit/trust driven, not arbitrary.
- Target behavior: Provider improves trust signals instead of seeking shortcuts.
- Risk prevented: Assumption that spend or noise overrides trust/CVS.

### client.provider-intent-promotion
- Label: PROVIDER INTENT C: "Help me run a promotion/deal"
- Target belief: Promotions are eligibility-governed, not pay-to-play.
- Target behavior: Provider aligns promotion requests with trust/relevance gates.
- Risk prevented: Perception of lead-selling or exposure-for-payment.

### client.community-intent
- Label: COMMUNITY INTENT: "Help me post an announcement/update"
- Target belief: Community memory is governed and purposeful.
- Target behavior: User uses Scout-guided posting path instead of open feed behavior.
- Risk prevented: Social-feed expectations that conflict with authority model.

### client.contractor-search-intent
- Label: CONTRACTOR SEARCH INTENT
- Target belief: Discovery resolves through Scout mediation.
- Target behavior: User follows discovery -> Scout -> intent pathway.
- Risk prevented: Ungated direct contact assumptions.

### client.marketplace-intent
- Label: MARKETPLACE INTENT: search vs post
- Target belief: Marketplace actions are scoped and policy-bound.
- Target behavior: User selects policy-compatible path (search or post).
- Risk prevented: Marketplace framing drift into ad-tech behavior.

### client.contact-support-intent
- Label: CONTACT SUPPORT INTENT
- Target belief: Support access is reliable and available.
- Target behavior: User escalates via approved support pathways.
- Risk prevented: Dead-end frustration in edge or blocked states.

### client.fallback-server-flow
- Label: FALLBACK: Use existing server flow if no intent matched
- Target belief: Scout remains responsive when local matching is uncertain.
- Target behavior: User continues asking instead of abandoning due to miss.
- Risk prevented: Perceived dead-end when local intent classifier misses.

### server.smart-synthesis-contract
- Label: Smart synthesis that ENFORCES the execution contract
- Target belief: Scout output follows enforceable contracts.
- Target behavior: Operators trust action payloads for deterministic handling.
- Risk prevented: Contract drift producing unsafe or non-actionable outputs.

### server.oversize-hard-slice-fallback
- Label: Fallback: take a hard slice if everything is oversized
- Target belief: Scout degrades safely under payload pressure.
- Target behavior: Users still receive bounded responses in heavy contexts.
- Risk prevented: Timeouts or null responses interpreted as system failure.

### server.intro-overview-special-handling
- Label: SPECIAL HANDLING: Detect intro/overview questions and use comprehensive synthesis
- Target belief: First-time questions receive coherent orientation.
- Target behavior: Users build mental model before taking actions.
- Risk prevented: Early confusion that reduces trust in controller outputs.

### server.governor-mode-situation
- Label: GOVERNOR MODE: Situation-driven intelligence
- Target belief: Governance constraints are active, not decorative.
- Target behavior: System routes by situation and policy instead of role assumptions.
- Risk prevented: Authority bypass or misrouting under ambiguous prompts.

### server.layer-resolution
- Label: LAYER RESOLUTION: Use knowledge service 4-layer system
- Target belief: Scout answers are sourced through layered retrieval.
- Target behavior: Operators trust provenance and fallback behavior.
- Risk prevented: Opaque sourcing undermining confidence in responses.

### server.smart-synthesis-deterministic-routing
- Label: SMART SYNTHESIS / DETERMINISTIC ROUTING
- Target belief: Routing remains stable across equivalent intents.
- Target behavior: Users repeat successful prompts with consistent outcomes.
- Risk prevented: Perceived randomness in action routing.

### server.deterministic-early-exit
- Label: Deterministic early-exit: if user intent maps cleanly to an allowed
- Target belief: Simple intents complete quickly without unnecessary friction.
- Target behavior: User trusts direct, policy-safe outcomes.
- Risk prevented: Latency frustration for obvious intents.

### server.brand-identity-firewall
- Label: Brand identity firewall: if the synthesized answer clearly violates
- Target belief: Brand and authority boundaries are actively protected.
- Target behavior: System resists identity drift or off-brand responses.
- Risk prevented: Brand confusion and trust erosion from identity violations.

### server.auth-required-intent
- Label: Handle auth-required intent
- Target belief: Protected actions require authentication consistently.
- Target behavior: User authenticates before proceeding with gated intents.
- Risk prevented: Unauthorized action expectations and gate bypass attempts.

