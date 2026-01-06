# Custom Domain Mappings Schema

**TradeScout — Phase 1: Alias-Only Public Profile Rendering**  
**Status:** Design Draft (Not Executed)  
**Last Updated:** January 5, 2026

---

## Overview

This schema enables verified custom domains (e.g., `plumberjohn.com`) to render a user's public TradeScout profile without authentication, cookies, or custom code execution.

**Core Principle:** Edge routing resolves `Host` header → `domain` → `profile_id` → public profile template.

---

## Table: `domain_mappings`

Maps verified custom domains to public profiles for alias-only rendering.

```sql
CREATE TABLE domain_mappings (
  -- Core Identity
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id INTEGER NOT NULL,
  domain VARCHAR(255) NOT NULL,
  
  -- Verification Model
  verification_method VARCHAR(20) NOT NULL CHECK (verification_method IN ('dns_txt', 'html_file', 'meta_tag')),
  verification_token VARCHAR(64) NOT NULL, -- Opaque, rotated on re-verification
  verification_state VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (verification_state IN ('pending', 'verified', 'failed', 'revoked')),
  verification_error TEXT NULL, -- Last failure reason (DNS timeout, TXT mismatch, etc.)
  
  -- Kill Switches & Safety
  enabled BOOLEAN NOT NULL DEFAULT true, -- Per-domain hard off (immediate)
  global_disabled_at TIMESTAMP NULL, -- Global feature kill (set once, affects all reads)
  suspended_reason TEXT NULL, -- Abuse, policy violation, user request, billing
  
  -- Audit & Lifecycle
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  verified_at TIMESTAMP NULL, -- When verification_state became 'verified'
  last_checked_at TIMESTAMP NULL, -- Last verification re-check (health monitoring)
  disabled_at TIMESTAMP NULL, -- When enabled became false
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  
  -- Abuse & Rate Limit Hooks (no enforcement logic yet)
  request_count_24h INTEGER NOT NULL DEFAULT 0, -- Rolling window counter
  last_request_at TIMESTAMP NULL, -- Last edge request timestamp
  flagged_at TIMESTAMP NULL, -- Marked for review by abuse detection
  
  -- Constraints
  CONSTRAINT unique_domain UNIQUE (domain),
  CONSTRAINT unique_profile_initially UNIQUE (profile_id), -- One domain per profile (Phase 1)
  CONSTRAINT fk_profile FOREIGN KEY (profile_id) REFERENCES users(id) ON DELETE CASCADE
);
```

---

## Indexes

```sql
-- Edge routing lookup (primary hot path)
CREATE INDEX idx_domain_mappings_domain ON domain_mappings(domain) 
  WHERE enabled = true AND verification_state = 'verified';

-- Profile lookup (admin/settings UI)
CREATE INDEX idx_domain_mappings_profile_id ON domain_mappings(profile_id);

-- Health monitoring / re-verification jobs
CREATE INDEX idx_domain_mappings_last_checked ON domain_mappings(last_checked_at) 
  WHERE verification_state = 'verified';

-- Abuse detection queries
CREATE INDEX idx_domain_mappings_flagged ON domain_mappings(flagged_at) 
  WHERE flagged_at IS NOT NULL;
```

---

## Domain Normalization

**Critical:** Domains MUST be stored lowercased and punycode-normalized at write time.

```
Examples:
  Example.com      → example.com
  PLUMBER.COM      → plumber.com
  münchen.de       → xn--mnchen-3ya.de (punycode)
```

**Edge Assumption:** Host header is normalized before lookup. No case-sensitive matching.

---

## Verification Methods

### DNS TXT Record
```
Host:  _tradescout-verify.{domain}
Value: {verification_token}
Check: dig TXT _tradescout-verify.{domain} +short
```

### HTML File Challenge
```
Path:    https://{domain}/.well-known/tradescout-verify.txt
Content: {verification_token}
Check:   curl -L https://{domain}/.well-known/tradescout-verify.txt
```

### Meta Tag
```
Path: https://{domain}/
Tag:  <meta name="tradescout-verify" content="{verification_token}">
Check: curl -L https://{domain}/ | grep tradescout-verify
```

---

## Verification State Machine

```
pending → verified    (verification passes)
pending → failed      (DNS timeout, TXT mismatch, HTTP 404, etc.)
verified → revoked    (user deletes, admin suspension, domain expires)
failed → pending      (user retries after fixing DNS)
revoked → pending     (user re-enables after fixing issue)
```

**Forbidden Transitions:**
- No direct `pending → revoked` (must fail or verify first)
- No direct `verified → failed` (verified stays verified until revoked or re-check fails)

---

## Kill Switch Semantics

### Per-Domain Kill
```sql
UPDATE domain_mappings 
SET enabled = false, disabled_at = NOW() 
WHERE id = ?;
```
**Result:** Domain immediately stops resolving (edge checks `enabled = true`).

### Global Feature Kill
```sql
UPDATE domain_mappings 
SET global_disabled_at = NOW();
```
**Result:** ALL domains stop resolving (edge checks `global_disabled_at IS NULL`).

**Reversible:**
```sql
UPDATE domain_mappings 
SET global_disabled_at = NULL;
```

**NOTE:** `global_disabled_at` is treated as a global kill switch. Edge checks for existence of ANY non-null value across rows. This is a global state stored per-row for simplicity in Phase 1. Future optimization: migrate to `feature_flags` table.

### Suspension (Abuse/Policy)
```sql
UPDATE domain_mappings 
SET enabled = false, suspended_reason = 'abuse_detected', disabled_at = NOW() 
WHERE id = ?;
```
**Result:** User sees "Domain suspended" in settings, support notified.

---

## Edge Routing Pseudocode

```typescript
function routeCustomDomain(hostHeader: string): ProfileID | null {
  // Normalize host header (lowercase, punycode)
  const normalizedHost = normalizeHost(hostHeader);
  
  // Lookup verified domain mapping
  const mapping = SELECT * FROM domain_mappings 
    WHERE domain = normalizedHost
    AND enabled = true
    AND verification_state = 'verified'
    AND global_disabled_at IS NULL
    LIMIT 1;
  
  if (!mapping) return null;
  
  // Update request counter (async, non-blocking, best-effort)
  asyncIncrementRequestCount(mapping.id);
  
  return mapping.profile_id;
}
```

**Performance Note:** This query hits the indexed `idx_domain_mappings_domain` and should complete in <5ms.

---

## Rate Limit & Abuse Prevention

**Current Status:** Hooks only (no enforcement). Metrics logged for observability.

### Rate Limit Signals (Not Enforced Yet)
- `request_count_24h > 10,000` → flag for review
- `last_request_at` is >30 days old → suggest deprecation

### Abuse Signals (Not Enforced Yet)
- Excessive 404s → possible misconfiguration
- Rapid verification retries → possible token guessing
- Domain serving different content than tradescout.com → possible phishing

**NOTE:** `request_count_24h` is updated asynchronously at the edge and is best-effort (eventual consistency, not transactional). Do not use for strict quota enforcement.

---

## Forward Compatibility

### Multiple Domains Per Profile (Phase 2)
- Remove `UNIQUE(profile_id)` constraint
- Add `is_primary BOOLEAN` column
- Update edge routing to support multiple aliases

### Custom Homepage Sections (Phase 3)
- Add `homepage_config JSONB` column
- Support toggles: `show_about`, `show_services`, `show_testimonials`, etc.
- **NO custom HTML/CSS** (security boundary)

### SSL Auto-Provisioning (Phase 3)
- Add `ssl_status VARCHAR(20)` CHECK IN ('pending', 'active', 'failed', 'expired')
- Add `ssl_issued_at TIMESTAMP`
- Add `ssl_expires_at TIMESTAMP`
- Integrate with ACME (Let's Encrypt) for automatic cert provisioning

### Subdomain Support (Phase 4)
- Currently `domain` is apex only (`example.com`)
- Future: support `www.example.com`, `shop.example.com`
- Add `subdomain VARCHAR(63)` column
- Constraint: `UNIQUE(domain, subdomain)`

### Email Notifications (Phase 2)
- `verification_state → failed`: email user with fix instructions
- `last_checked_at` → health failure: warn about expiring DNS
- `ssl_expires_at` approaching: auto-renew or notify

---

## SEO Canonicalization Strategy

### Public Profile Canonical Tag
```html
<link rel="canonical" href="https://{custom_domain}/" />
```
**When:** Custom domain is verified and enabled.

### TradeScout Mirror (Optional)
**Option A:** `<meta name="robots" content="noindex, follow" />`  
**Option B:** `301 redirect tradescout.com/profile/{id} → {custom_domain}`

**Goal:** Prevent duplicate content penalties.

### Structured Data Preservation
- Same JSON-LD as `tradescout.com` profile
- Same meta tags (`og:`, `twitter:`)
- Same sitemap inclusion

---

## Rollback Strategy

### Phase 1 Rollback (No Data Loss)
```sql
-- Global kill
UPDATE domain_mappings SET global_disabled_at = NOW();
```
**Result:** All custom domains fall back to `tradescout.com/{profile_id}`. User data preserved, no DNS changes needed.

### Emergency Edge Bypass
- Edge middleware checks `FEATURE_CUSTOM_DOMAINS` env var
- If `false`, skip `domain_mappings` lookup entirely
- Instant rollback without database writes

### Domain-Specific Rollback
- User can disable via settings UI
- Admin can suspend via admin panel
- Both update `enabled = false` immediately

### Data Retention After Disable
- Keep `domain_mappings` row (`disabled_at` populated)
- Allows re-enable without re-verification
- Purge after 90 days of `disabled_at` if desired

---

## Security Boundaries (Non-Negotiable)

### ❌ Forbidden
- NO cookies set on custom domains (session/auth cookies stay on `tradescout.com`)
- NO authenticated routes (dashboards, admin, settings)
- NO user-uploaded HTML/CSS/JS
- NO shared apex domain cookies (prevents session hijacking)
- NO auto-accept domains (verification required)

### ✅ Required
- Public routes only (`/profile/{id}` equivalent)
- DNS verification required (TXT, HTML, or meta tag)
- Rate limit by host (prevent abuse)
- Explicit domain allowlist per profile
- Global kill switch (`global_disabled_at`)
- Per-domain kill switch (`enabled` flag)

---

## Open Questions for Implementation

1. **Verification Token Rotation**  
   Auto-rotate on each retry, or manual user action?

2. **Health Monitoring Frequency**  
   Re-check verified domains daily/weekly? What's the failure threshold before auto-revoke?

3. **Rate Limit Thresholds**  
   10K requests/24h is arbitrary—what's realistic for a contractor profile?

4. **Suspension Appeal Flow**  
   Does `suspended_reason` need a corresponding `appeal_status` field?

5. **Domain Normalization Library**  
   Use existing lib (e.g., `psl`, `punycode`) or custom implementation?

---

## Implementation Checklist (Post-Phase 5)

- [ ] Create migration (not executed during Hold)
- [ ] Implement domain normalization utils
- [ ] Add edge routing middleware
- [ ] Create verification job (TXT/HTML/meta check)
- [ ] Build settings UI (add/verify/disable domain)
- [ ] Add admin panel (suspend/unsuspend)
- [ ] Wire feature flag (`FEATURE_CUSTOM_DOMAINS`)
- [ ] Create health monitoring job
- [ ] Document DNS instructions for users
- [ ] Set up canary (1-3 internal profiles)
- [ ] Define abuse detection rules
- [ ] Implement rate limit counters
- [ ] Add telemetry/logging
- [ ] Test rollback procedures

---

**Status:** Design approved. Implementation authorized post-Phase 5 closure.
