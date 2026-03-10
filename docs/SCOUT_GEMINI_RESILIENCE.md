# Scout Gemini Resilience

This document describes the Gemini failure hardening now active in TradeScout Scout flows.

## What is now protected

- `404 model not found / unsupported operation`
  - Scout skips the failing model and tries the next configured fallback model.
  - Failing models are cached as temporarily unavailable to avoid repeated dead calls.

- `429 too many requests / quota exhausted`
  - Scout retries with bounded backoff per model.
  - If all candidates are rate-limited, Scout enters short cooldown and stops hammering Gemini.
  - During cooldown, Scout uses contextual fallback responses and keeps trust gates intact.

- `5xx / timeout transient failures`
  - Scout retries with bounded backoff, then continues fallback chain.

## Runtime controls (environment variables)

- `GEMINI_RATE_LIMIT_RETRIES` (default: `2`)
  - Retry attempts for rate-limit responses per model.

- `GEMINI_TRANSIENT_RETRIES` (default: `1`)
  - Retry attempts for transient failures per model.

- `GEMINI_RETRY_BACKOFF_MS` (default: `300`)
  - Base delay for linear retry backoff.

- `GEMINI_RATE_LIMIT_COOLDOWN_MS` (default: `30000`)
  - Circuit-breaker cooldown after all-candidate rate-limit failure.

- `GEMINI_MODEL_UNAVAILABLE_TTL_MS` (default: `3600000`)
  - TTL for temporarily unavailable model cache after model-unavailable errors.

## Observability

- Admin status endpoint now includes Gemini fallback runtime state:
  - `GET /api/scout/admin/system-status`
  - Field: `data.geminiFallback`
    - `rateLimitCooldownRemainingMs`
    - `temporarilyUnavailableModelCount`

- Fallback analytics reasons are recorded:
  - `intro_rate_limited`
  - `intro_error`
  - `schema_violation`
  - `json_parse_error`
  - `synthesis_rate_limited`
  - `synthesis_system_error`

## Safety notes

- Contact gating and Trust/CVS rules are unchanged.
- This hardening only affects model-call reliability and fallback behavior.
