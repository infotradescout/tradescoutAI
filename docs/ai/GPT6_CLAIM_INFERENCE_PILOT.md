# Held GPT-6 claim-inference adapter preparation

This prepares one opt-in TradeScout service adapter. The code fallback remains
`gpt-5.4-nano`; no runtime environment, deployment, or provider account is changed
by this code. The separate Scout tier router keeps its existing model selection.

At `70ae5bc0b77ad80941e54c423665c23e208dff2d`, static search of non-test
`client/src` found no caller of `startOnboardingFlow` or
`shouldTriggerOnboarding` outside their hook. `ScoutOS.tsx` instantiates the
hook, but `?onboarding=true` redirects to the universal `/onboarding` owner.
No active customer consumer was identified in that searched source. This is
bounded static evidence, not proof that the API can never run: the authenticated,
rate-limited `/api/ai/inference` endpoint remains directly callable.

Keep this draft on hold. Merge, deployment, production inference settings, and
consumer rewiring require a named active owner, product acceptance, full required
proof and release authority. Do not reactivate a legacy onboarding path to justify
the benchmark. This adapter preparation is not an active onboarding migration.
Affirmatively defer the synthetic comparison while consumer/value is unresolved;
the owner's separate $5/140-request authorization persists but is not an
obligation to spend. A comparison of this callable service would establish only
an application-configuration comparison, not primary-flow acceptance.

The lane starts from main `d316f4d9dffc46cc564d1e4980cfb483eecbe0c9` on
`codex/gpt6-claim-inference-20261002`. The historical pricing checkpoint carried
in that source was not resumed. Unrelated checkout work was preserved.

## Configuration and compatibility

After representative evaluation and authorized release, the operator can select
`SCOUT_OPENAI_MODEL_INFERENCE=gpt-6-luna` for claim inference alone. The selection
order is trusted internal `AIInferenceRequest.model`, this workload setting,
`SCOUT_OPENAI_MODEL_FAST`, `SCOUT_OPENAI_MODEL_DEFAULT`, then the preserved
`gpt-5.4-nano` fallback. An unset workload setting preserves legacy routing.

HTTP callers of `/api/ai/inference` can no longer supply a `model` field. Any
supplied field, including `null`, returns HTTP 400 before inference work. The
first-party client does not send this field. This is an intentional API
compatibility change that keeps selection under server control. The handler
constructs the service request field by field. Authentication and rate limiting
remain at the original route registration.

`maxTokens` remains a caller-forwarded legacy field. The first-party client
requests 500 output tokens and the service defaults to 500; this is not a
server-enforced token or spend ceiling. The separate private evaluation child
enforces exactly 500 tokens and its own approved request/spend limits. It does
not establish an application-wide budget policy.

The adapter recognizes exactly `gpt-6-luna`, `gpt-6-sol`, `gpt-6.1-sol`, and
`gpt-6-astra`. These use Responses with explicit `reasoning.effort: "low"` and
no sampling controls. After the exact case-sensitive allowlist, every unknown
ID matching the case-insensitive `/^gpt-6/i` prefix fails before a
provider call. Sol and Astra handling is payload compatibility, not a rollout
assignment. Legacy overrides retain their prior emitted request shape.

The current SDK lock stays OpenAI 5.23.2. Requests use the installed SDK's real
`ResponseCreateParamsNonStreaming` type; no untyped outbound payload or SDK
upgrade is needed. Any later required SDK/lock change is a separate scope.

The migration changes model, effort (`minimal` to `low`), and sampling
(`temperature: 0.3` to absent). Do not claim those preserve behavior. Prompts,
JSON-object output, the client's 500-token request and service default, storage
disabled, the existing server
timeout/clamp and the client's five-second abort remain unchanged.

Model output remains a suggestion. Claim confirmation and the server's county,
trust, verification, and contact gates own authority. Inference cannot grant
verification, contact, or privileges. Mocked inference tests do not prove all
downstream gates or a completed browser/customer journey.

## Verification and remaining evaluation

The adapter tests inspect emitted Requests payloads, model precedence, sampling
omission, supported/unsupported IDs, credentials, timeouts, JSON text/usage
decoding and provider failures. Handler tests check 400 with zero inference
calls, field-only forwarding, success/error shapes and exact route wiring.
Client tests exercise suggestions and deterministic fallback on HTTP/network
failure, refusal, invalid/truncated JSON, and a five-second abort.

Run the focused checks:

```sh
npm run test:run -- server/tests/ai-inference.behavior.test.ts server/tests/ai-inference-route.behavior.test.ts client/src/scout/claimInference.test.ts server/tests/onboarding-flow-contracts.test.ts server/tests/onboarding-completion-authority.contract.test.ts server/tests/unified-onboarding.contract.test.ts
```

Run the unchanged `npm run gate:minimum-release` against the final clean commit
at integration. Its required disposable database, browser, build and typecheck
proof must not be replaced with mocked inference tests or a weakened gate.
Record actual results, baseline failures and unexecuted proof in the draft PR.
Later standalone database checks do not retroactively complete an earlier failed
gate. A documentation commit creates a new source head; bind each result to the
head actually tested. Real browser inference remains unproved. Local development
sign-in/routing and real-SDK requests over synthetic transport are separate proof,
not provider availability, model quality, rollback availability or a customer journey.

Live evaluation is disabled by default and is not authorized by this document.
Before the first paid request, obtain the owner's model selection, request cap
and spend ceiling, and verify TradeScout-scoped credentials/account access.
Use synthetic claim prompts only; no customer records or outbound actions.

Evaluate the preserved baseline and Luna on the same representative and
adversarial corpus with fixed prompts. Record actual returned model identity,
request shape, status/refusal/incomplete/invalid-JSON rate, claim correctness,
advisory authority boundary, p50/p95 latency against the five-second client
budget, fallback frequency, input/output/reasoning/cache tokens and cost per
successful task. A provider-rejected baseline is a failed original baseline;
evaluate any compatibility repair separately instead of rewriting its history.
The client's 500-token request and low reasoning may increase truncation or latency; neither
has been measured by offline tests.

Do not activate a canary until quality, latency, cost, required release proof and
release authority are established. At each stage verify that the exact rollback
model is still available. Roll back this workload by restoring its previously
recorded setting (or clearing it to use prior FAST/DEFAULT routing); do not
overwrite other workloads' settings. If the old endpoint is unavailable, hold
activation until a separately evaluated fallback exists.

Official migration guidance, fetched 2026-10-02:
[Using GPT-6: update API and model parameters](https://developers.openai.com/api/docs/guides/latest-model#gpt-6-astra-update-api-and-model-parameters).
