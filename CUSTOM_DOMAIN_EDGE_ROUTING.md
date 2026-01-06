# Custom Domain Edge Routing Specification

**Purpose**: Deterministic, low-latency routing logic for custom domain → public profile resolution.  
**Performance Target**: <5ms p95 edge decision time  
**Safety Model**: Kill switches at feature, global, and per-domain levels  
**Phase**: 1 (Alias-Only)

---

## 1. Host Normalization (Authoritative)

All custom domain lookups begin with canonical normalization to prevent cache fragmentation and security bypasses.

### Algorithm

```typescript
function normalizeHost(rawHost: string): string | null {
  // 1. Strip port (if present)
  const hostWithoutPort = rawHost.split(':')[0];
  
  // 2. Lowercase
  const lowercased = hostWithoutPort.toLowerCase();
  
  // 3. Punycode normalize (for IDN domains)
  const punycoded = punycode.toASCII(lowercased);
  
  // 4. Strip www. prefix (Phase 1: apex domains only)
  const withoutWww = punycoded.replace(/^www\./, '');
  
  // 5. Reject IP literals (IPv4 or IPv6)
  if (/^\d+\.\d+\.\d+\.\d+$/.test(withoutWww) || /^\[.*\]$/.test(withoutWww)) {
    return null; // IP literals not allowed
  }
  
  // 6. Basic domain validation
  if (!/^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/.test(withoutWww)) {
    return null; // Invalid domain format
  }
  
  return withoutWww;
}
```

### Examples

| Raw Input | Normalized Output | Reason |
|-----------|------------------|--------|
| `Example.COM` | `example.com` | Lowercase |
| `www.example.com` | `example.com` | Strip www. |
| `example.com:443` | `example.com` | Strip port |
| `münchen.de` | `xn--mnchen-3ya.de` | Punycode |
| `192.168.1.1` | `null` | IP literal rejected |
| `[::1]` | `null` | IPv6 rejected |
| `invalid..com` | `null` | Invalid format |

### Critical Properties

- **Idempotent**: `normalize(normalize(x)) === normalize(x)`
- **Deterministic**: Same input always produces same output
- **Cacheable**: Normalized host is the cache key
- **Security**: Prevents homograph attacks and cache poisoning

---

## 2. Lookup Order (Deterministic)

Edge routing uses a 3-tier cache hierarchy with fast-fail kill switch checks.

### Flow Diagram

```
┌─────────────────────────────────────┐
│ 1. Normalize Host                    │
│    normalizeHost(request.host)      │
│    → normalized_host or null        │
└──────────────┬──────────────────────┘
               │
               ▼
┌─────────────────────────────────────┐
│ 2. Feature Flag Check                │
│    FEATURE_CUSTOM_DOMAINS === false?│
│    → Yes: bypass to tradescout.com  │
│    → No: continue                   │
└──────────────┬──────────────────────┘
               │
               ▼
┌─────────────────────────────────────┐
│ 3. Global Kill Check                 │
│    global_disabled_at != null?      │
│    → Yes: bypass to tradescout.com  │
│    → No: continue                   │
└──────────────┬──────────────────────┘
               │
               ▼
┌─────────────────────────────────────┐
│ 4. L1 Cache (Edge Memory)            │
│    Key: custom_domain:{host}       │
│    → Hit: return cached result      │
│    → Miss: continue to L2           │
└──────────────┬──────────────────────┘
               │
               ▼
┌─────────────────────────────────────┐
│ 5. L2 Cache (Redis/Edge KV)          │
│    Key: custom_domain:{host}       │
│    → Hit: backfill L1, return       │
│    → Miss: continue to DB           │
└──────────────┬──────────────────────┘
               │
               ▼
┌─────────────────────────────────────┐
│ 6. Database Lookup (Rare)            │
│    SELECT profile_id, verified_at   │
│    FROM domain_mappings             │
│    WHERE domain = {host}            │
│      AND enabled = true             │
│      AND verification_state = ...   │
│    → Hit: backfill L2+L1, return    │
│    → Miss: cache negative result    │
└──────────────┬──────────────────────┘
               │
               ▼
┌─────────────────────────────────────┐
│ 7. Render Decision                   │
│    See Section 4 (Fallback Behavior)│
└─────────────────────────────────────┘
```

### Pseudocode

```typescript
async function resolveCustomDomain(rawHost: string): Promise<RenderDecision> {
  // 1. Normalize
  const normalizedHost = normalizeHost(rawHost);
  if (!normalizedHost) {
    return { type: 'NOT_FOUND' };
  }
  
  // 2. Feature flag check
  if (!FEATURE_CUSTOM_DOMAINS) {
    return { type: 'BYPASS', fallbackRoute: 'tradescout.com' };
  }
  
  // 3. Global kill check (from config or DB singleton row)
  const globalDisabled = await getGlobalKillState();
  if (globalDisabled) {
    return { type: 'BYPASS', fallbackRoute: 'tradescout.com' };
  }
  
  // 4. L1 cache (edge memory, ~1ms)
  const cacheKey = `custom_domain:${normalizedHost}`;
  const l1Result = edgeMemoryCache.get(cacheKey);
  if (l1Result) {
    return buildRenderDecision(l1Result);
  }
  
  // 5. L2 cache (Redis/KV, ~3-5ms)
  const l2Result = await redisCache.get(cacheKey);
  if (l2Result) {
    edgeMemoryCache.set(cacheKey, l2Result, { ttl: 300 }); // 5min L1 TTL
    return buildRenderDecision(l2Result);
  }
  
  // 6. Database lookup (rare, ~10-20ms)
  const dbResult = await db.query(
    `SELECT profile_id, verified_at, enabled
     FROM domain_mappings
     WHERE domain = $1
       AND enabled = true
       AND verification_state = 'verified'`,
    [normalizedHost]
  );
  
  if (dbResult.rows.length === 1) {
    const domainData = {
      profileId: dbResult.rows[0].profile_id,
      verifiedAt: dbResult.rows[0].verified_at,
      enabled: dbResult.rows[0].enabled,
    };
    
    // Backfill caches
    await redisCache.set(cacheKey, domainData, { ttl: 900 }); // 15min L2 TTL
    edgeMemoryCache.set(cacheKey, domainData, { ttl: 300 }); // 5min L1 TTL
    
    return { type: 'RENDER_PROFILE', profileId: domainData.profileId };
  }
  
  // 7. Negative cache (short TTL to prevent lookup spam)
  const negativeResult = { type: 'NOT_FOUND' };
  await redisCache.set(cacheKey, negativeResult, { ttl: 60 }); // 1min negative cache
  edgeMemoryCache.set(cacheKey, negativeResult, { ttl: 30 }); // 30s L1 negative cache
  
  return negativeResult;
}
```

---

## 3. Cache Strategy (Explicit)

### Cache Keys

- **Format**: `custom_domain:{normalized_host}`
- **Example**: `custom_domain:mycompany.com`

### Cache Tiers

| Tier | Storage | TTL | Hit Time | Purpose |
|------|---------|-----|----------|---------|
| **L1** | Edge process memory | 5min | <1ms | Ultra-fast repeat lookups within single edge node |
| **L2** | Redis/Cloudflare KV | 15min | 3-5ms | Cross-edge consistency, warm restarts |
| **Negative** | Redis (separate key?) | 1min (L2) / 30s (L1) | 3-5ms | Prevent DB spam for unknown domains |

### Cache Values

```typescript
interface DomainCacheEntry {
  profileId: string;        // UUID of public profile
  verifiedAt: string;       // ISO timestamp (for staleness detection)
  enabled: boolean;         // Per-domain kill switch state
}

interface NegativeCacheEntry {
  type: 'NOT_FOUND';
  cachedAt: string;         // ISO timestamp
}
```

### Cache Invalidation Triggers

| Event | Action | Why |
|-------|--------|-----|
| **Verification success** | Invalidate L1+L2 for `custom_domain:{domain}` | Domain transitions from unverified → verified |
| **Domain disabled** | Invalidate L1+L2 for `custom_domain:{domain}` | User/admin disables domain |
| **Domain suspended** | Invalidate L1+L2 for `custom_domain:{domain}` | Abuse detection triggers suspension |
| **Global kill toggle** | Invalidate ALL custom domain cache entries | Emergency kill switch activated |
| **Profile deleted** | Invalidate L1+L2 for all domains pointing to profile | Profile no longer exists |

### Invalidation Implementation

```typescript
async function invalidateDomainCache(domain: string): Promise<void> {
  const normalizedHost = normalizeHost(domain);
  if (!normalizedHost) return;
  
  const cacheKey = `custom_domain:${normalizedHost}`;
  
  // Clear L1 (local edge node only)
  edgeMemoryCache.delete(cacheKey);
  
  // Clear L2 (global)
  await redisCache.delete(cacheKey);
  
  // Emit telemetry (async, non-blocking)
  telemetry.trackCacheInvalidation({
    domain: normalizedHost,
    timestamp: new Date().toISOString(),
  });
}

async function invalidateAllCustomDomains(): Promise<void> {
  // Global kill scenario: purge all custom domain cache entries
  
  // L1: Clear all entries with prefix
  edgeMemoryCache.deleteByPrefix('custom_domain:');
  
  // L2: Use Redis SCAN to avoid blocking
  await redisCache.deleteByPrefix('custom_domain:');
  
  telemetry.trackGlobalCacheInvalidation({
    reason: 'global_kill_activated',
    timestamp: new Date().toISOString(),
  });
}
```

---

## 4. Fallback Behavior (No Ambiguity)

### Decision Matrix

| Condition | HTTP Status | Response | SEO Impact | User Visibility |
|-----------|-------------|----------|------------|-----------------|
| **Verified + enabled** | 200 | Render public profile | Indexed | ✅ Full profile |
| **Disabled (user)** | 200 | Branded "Domain unavailable" page | No index (meta robots) | "This domain is temporarily unavailable. Visit tradescout.com/{username}" |
| **Suspended (admin/abuse)** | 200 | Branded "Domain suspended" page | No index | "This domain has been suspended. Contact support." |
| **Unverified** | 404 | Generic 404 (do NOT leak existence) | Not indexed | Standard 404 page |
| **Global kill active** | Bypass (no custom domain check) | Render tradescout.com route | N/A (original URL unchanged) | User sees tradescout.com/{username} |
| **Feature flag OFF** | Bypass (no custom domain check) | Render tradescout.com route | N/A | Same as global kill |
| **Unknown domain** | 404 | Fast 404 (negative cache hit) | Not indexed | Standard 404 page |
| **Normalization failed** | 404 | Immediate 404 (no cache, no DB) | Not indexed | Standard 404 page |

### Key Principles

1. **No Redirects in Phase 1**
   - Why: Prevents SEO confusion (301/302 signals), cache complexity, and URL leakage
   - All responses render content at the requested domain
   - Branded error pages use 200 status (not 503) to avoid retry storms

2. **Do Not Leak Domain Existence**
   - Unverified domains return generic 404 (same as unknown domains)
   - Prevents enumeration attacks (checking if competitor domains are claimed)

3. **Public Routes Only**
   - No cookies set on custom domains
   - No authentication state
   - No session management
   - Only public profile content

4. **Async Metrics Only**
   - Request counting (for rate limits) happens async
   - View tracking happens async
   - Never block response on telemetry

---

## 5. Performance & Safety Targets

### Performance SLOs

| Metric | Target | Measurement |
|--------|--------|-------------|
| **Edge decision time** | <5ms p95 | Time from host normalize → render decision |
| **L1 cache hit rate** | >90% | Repeat requests within 5min window |
| **L2 cache hit rate** | >95% | Cold edge nodes or L1 miss |
| **Database queries** | <1% of requests | Only for cache misses + new verifications |
| **Negative cache effectiveness** | >99% for unknown domains | Prevent DB spam |

### Safety Constraints

1. **No Cookies**
   - Custom domains must not set cookies
   - Prevents CSRF, session fixation, and subdomain security issues
   - Public profiles are stateless

2. **Public Routes Only**
   - No `/dashboard`, `/admin`, `/api/private` routes
   - Custom domains only resolve to `/profiles/{username}` equivalent
   - All other paths return 404

3. **Async Telemetry**
   - View counts updated via background job (not inline)
   - Request rate limiting checked async (soft enforcement)
   - Abuse detection triggered async
   - Never block response on analytics

4. **Kill Switch Precedence**
   - Feature flag > Global kill > Per-domain kill
   - Kill checks happen before cache lookup (no stale enabled state)

### Error Budget

- **Acceptable failure rate**: 0.01% (99.99% success)
- **Max latency regression**: +10ms p95 vs. tradescout.com routes
- **Cache invalidation lag**: <30s (L2 propagation time acceptable)

---

## 6. Kill Switches (Edge-Resident)

### Three-Level Kill Hierarchy

```typescript
// Level 1: Feature Flag (instant bypass, no DB query)
const FEATURE_CUSTOM_DOMAINS = process.env.FEATURE_CUSTOM_DOMAINS === 'true';

// Level 2: Global Kill (DB or config singleton, cached)
async function getGlobalKillState(): Promise<boolean> {
  // Option A: Environment variable (requires redeploy)
  if (process.env.GLOBAL_CUSTOM_DOMAINS_DISABLED === 'true') {
    return true;
  }
  
  // Option B: Database singleton (cached with 1min TTL)
  const cached = edgeMemoryCache.get('global_custom_domains_kill');
  if (cached !== undefined) return cached;
  
  const result = await db.query(
    `SELECT global_disabled_at FROM domain_mappings LIMIT 1`
  );
  const isDisabled = result.rows[0]?.global_disabled_at !== null;
  
  edgeMemoryCache.set('global_custom_domains_kill', isDisabled, { ttl: 60 });
  return isDisabled;
}

// Level 3: Per-Domain Kill (via cache or DB)
// Enforced in WHERE clause: enabled = true
```

### Kill Switch Use Cases

| Scenario | Kill Level | Action | Recovery |
|----------|-----------|--------|----------|
| **Emergency security issue** | Feature flag OFF | Deploy with `FEATURE_CUSTOM_DOMAINS=false` | Fix + redeploy with flag ON |
| **Global abuse wave** | Set `global_disabled_at` | UPDATE single row, invalidate all caches | Clear timestamp after mitigation |
| **Single domain abuse** | Set `enabled = false` | UPDATE one row, invalidate domain cache | User appeals or admin re-enables |
| **Planned maintenance** | Feature flag OFF or global kill | Announce + toggle | Toggle back after maintenance |

### Bypass Behavior

When any kill switch is active:

1. **Skip custom domain lookup** (no cache, no DB)
2. **Render tradescout.com route** (e.g., `/profiles/{username}`)
3. **Preserve original URL** (user still sees custom domain in browser, but content is from tradescout.com route)
4. **Log bypass event** (async telemetry for audit trail)

Alternative: Return branded "Service temporarily unavailable" page (200 status) instead of bypass. Decision deferred to UX phase.

---

## 7. Error/Response Matrix

### HTTP Status Codes

| Scenario | Status | Headers | Body Content |
|----------|--------|---------|--------------|
| **Valid profile** | 200 | `Content-Type: text/html` | Public profile HTML |
| **Disabled domain** | 200 | `X-Robots-Tag: noindex` | Branded "unavailable" page |
| **Suspended domain** | 200 | `X-Robots-Tag: noindex` | Branded "suspended" page |
| **Unknown domain** | 404 | `Content-Type: text/html` | Generic 404 page |
| **Unverified domain** | 404 | `Content-Type: text/html` | Generic 404 page (no leak) |
| **Invalid host format** | 404 | `Content-Type: text/html` | Generic 404 page |
| **Feature flag OFF** | (bypass) | N/A | Render tradescout.com route |
| **Global kill active** | (bypass) | N/A | Render tradescout.com route |

### Security Headers (All Responses)

```http
X-Frame-Options: DENY
X-Content-Type-Options: nosniff
Referrer-Policy: strict-origin-when-cross-origin
Content-Security-Policy: default-src 'self'; (adjust per phase)
```

### SEO Headers

```http
# Verified + enabled domain
Link: <https://tradescout.com/profiles/{username}>; rel="canonical"

# Disabled/suspended domain
X-Robots-Tag: noindex, nofollow
Link: <https://tradescout.com/profiles/{username}>; rel="canonical"
```

---

## 8. Canary Considerations (Phase 6)

### Metrics to Track

1. **Cache hit rates** (L1, L2, negative)
2. **Edge decision latency** (p50, p95, p99)
3. **Database query volume** (should be <1% of traffic)
4. **Invalidation lag** (time from UPDATE to cache clear)
5. **404 rate** (unknown domains vs. unverified vs. normalization failures)
6. **Kill switch activations** (frequency, duration)

### Canary Gates

- **Start with 1-5 beta users** (known domains, trusted profiles)
- **Monitor for 48 hours** before expanding
- **Require <5ms p95 edge latency** before scaling
- **Validate cache invalidation** (disable → enable → verify cache cleared)
- **Test global kill switch** (ensure instant bypass, no DB queries)

### Rollback Triggers

- Edge latency >10ms p95
- Cache hit rate <80% (indicates cache thrashing)
- Database query volume >5% (cache not working)
- Any 5xx errors on custom domain routes
- User-reported content mismatches (wrong profile served)

### Feature Flag Gradual Rollout

```typescript
// Phase 6A: Beta users only (allowlist)
if (!FEATURE_CUSTOM_DOMAINS) return bypass;
if (!BETA_USER_ALLOWLIST.includes(profileId)) return bypass;

// Phase 6B: Percentage rollout
if (Math.random() > CUSTOM_DOMAIN_ROLLOUT_PERCENT) return bypass;

// Phase 6C: Full rollout
// Remove all rollout gates
```

---

## 9. Implementation Checklist

- [ ] Implement `normalizeHost()` with test suite (100+ test cases)
- [ ] Set up L1 edge memory cache (in-process LRU)
- [ ] Set up L2 Redis/KV cache (Cloudflare KV or Redis)
- [ ] Implement cache invalidation functions
- [ ] Add cache invalidation triggers to domain enable/disable flows
- [ ] Add cache invalidation to verification success flow
- [ ] Implement global kill switch check (cached)
- [ ] Implement feature flag check
- [ ] Add edge routing middleware to request pipeline
- [ ] Create branded "unavailable" and "suspended" pages
- [ ] Add telemetry for cache hits/misses/invalidations
- [ ] Load test with 10k req/s to validate <5ms p95
- [ ] Test cache invalidation propagation time
- [ ] Test global kill switch bypass
- [ ] Document runbook for emergency kill procedures

---

## 10. Open Questions

1. **L1 cache size limit**: Max domains per edge node? (LRU eviction at 10k entries?)
2. **Negative cache strategy**: Separate Redis keys or embed in same key with `type` field?
3. **Global kill implementation**: Environment variable (requires redeploy) vs. database singleton (cached)?
4. **Bypass vs. error page**: When kill switch active, bypass to tradescout.com or show "temporarily unavailable" page?
5. **Rate limiting**: Per-domain request counters in cache or async background job?
6. **Health monitoring**: Ping verified domains to detect DNS changes or domain transfers?

---

**Status**: Ready for implementation post-Phase 5 closure.  
**Next**: DNS Verification UX (user-facing copy, settings UI, error messages, support structure).
