# Optional Neon backend adapters

Disposition: **extend** the canonical `server/serverObjectStorage.ts`,
`scripts/server-object-storage.mjs`, and `server/services/llmProvider.ts` owners.
No new storage service, upload route, authorization owner, or SI engine is introduced.

Both integrations are disabled by default. No cloud resources, credentials, objects,
database rows, or production settings are changed by installing this code.

## Server-owned public media

With `SERVER_OBJECT_STORAGE_PROVIDER` unset, the established selection remains a
complete R2 contract, then a complete AWS S3 contract, then `DATABASE_URL`.
Explicit selections accept `cloudflare-r2`, `aws-s3`, `postgres-public-media`, or
`neon-s3`; an incomplete selected contract fails instead of trying another store.

To use Neon, set all of:

| Setting | Value |
| --- | --- |
| `SERVER_OBJECT_STORAGE_PROVIDER` | `neon-s3` |
| `AWS_ENDPOINT_URL_S3` | Bare HTTPS storage endpoint returned for the intended Neon branch |
| `AWS_REGION` | Region returned with that endpoint |
| `AWS_ACCESS_KEY_ID` | Branch storage credential ID |
| `AWS_SECRET_ACCESS_KEY` | Corresponding S3 secret |
| `AWS_S3_BUCKET` | Existing bucket name |

The client requires path-style addressing and uses
`requestChecksumCalculation: WHEN_REQUIRED`. The Neon endpoint is passed explicitly to the SDK. Supplying
`AWS_ENDPOINT_URL_S3` without selecting `neon-s3` fails configuration, preventing
Neon credentials from silently being interpreted as the legacy AWS/database
contract. Remove that variable when selecting a legacy store.

Before enabling:

1. Provision the bucket on the intended branch and install a credential with the
   necessary storage read/write scopes through the deployment secret store.
2. Copy and independently verify all existing server public-media objects into that
   bucket with their **exact current keys, bytes, and content types**. Keep the old
   store available for rollback. This code does not copy objects or perform read
   fallback to another backend when an object is absent.
3. Verify existing same-origin media URLs, conditional reads, ranges, and representative
   HEAD/GET requests against the staged runtime before changing production selection.

Existing URL formats and key construction are unchanged, so verified copies retain
their URLs. Private/user R2 uploads, legacy Replit object handling, and external
absolute file URLs keep their existing owners. Selecting this adapter does not move
those files or turn private files into public media.

Rollback: restore the prior provider selection and its matching credentials/bucket.
Account for any new objects written after cutover before rolling back; this code does
not mirror writes.

## Scout AI Gateway

The default order stays `openai,vertex,gemini`, even if Neon credentials are present.
Opt in with `SCOUT_LLM_PROVIDER_ORDER=neon` or an explicit fallback sequence such as
`neon,openai,vertex,gemini`. The alias `neon-ai-gateway` is also accepted. Fallbacks
retain the existing availability checks, output validation, failure counters,
cooldowns, and deterministic non-LLM response when every provider fails.

Required settings for explicit Neon selection:

| Setting | Value |
| --- | --- |
| `NEON_AI_GATEWAY_BASE_URL` | Bare HTTPS branch gateway host; no `/v1`, `/ai-gateway`, query, or credentials |
| `NEON_AI_GATEWAY_TOKEN` | Branch credential with `ai_gateway:invoke` permission |
| `SCOUT_NEON_MODEL_DEFAULT` | Explicit chat-completions-compatible model ID from that branch's catalog |

The existing OpenAI SDK uses `${NEON_AI_GATEWAY_BASE_URL}/v1` and its
`chat.completions` API. Optional `SCOUT_NEON_MODEL_FAST`,
`SCOUT_NEON_MODEL_STANDARD`, and `SCOUT_NEON_MODEL_REASONING` override the chosen
tier; there is no hardcoded Neon model fallback. Missing required configuration is
an error before requests are made.

`SCOUT_NEON_MAX_OUTPUT_TOKENS` defaults to 900 (700 for Scout synthesis JSON),
bounded to 100–4000; per-call output limits share those bounds.
`SCOUT_NEON_TIMEOUT_MS` defaults to 20000, bounded to 1000–120000. Optional
`SCOUT_NEON_TEMPERATURE` or per-call temperature is bounded to 0–2. Gateway SDK
retries are disabled; a failure passes to the existing provider fallback/cooldown
owner. Each configured fallback provider can incur its own cost. These request
bounds are not an account-wide spending cap.

Before enabling, confirm branch access, plan/billing eligibility, actual available
model ID, model support for chat completions and any requested JSON schema, and
deployment secrets. Runtime accepts string or text-block content. Unsupported
requests, empty output, and placeholder output enter the existing failure path.

Rollback: restore the prior provider order; Neon settings alone never enable it.

## Evidence boundary and platform law

Targeted tests use synthetic credentials, mocked gateway responses and local S3
URL signing. They do not establish live bucket access, copy completeness, model
availability, billing eligibility, production performance, or end-to-end county
behavior. A release still requires the repository's integration/release gates.

Contact/Decision Card, Trust/CVS, county routing, and JW business-membership gates:
**enforced by existing owners; unchanged in this slice**, not newly re-attested by
adapter unit tests. Live Neon cutover and full release proof: **policy_target**,
pending the deployment prerequisites above.

Official references checked 2026-09-17:
[storage quickstart](https://neon.com/docs/storage/get-started.md) and
[gateway chat completions](https://neon.com/docs/ai-gateway/chat-completions.md).
The current storage quickstart includes AWS US East (N. Virginia); older bundled
skill text limiting storage to Ohio is superseded by the current documentation.
