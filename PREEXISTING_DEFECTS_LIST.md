# Pre-Existing Defects List (PEDL)
**Created:** December 6, 2025  
**Status:** Issue Isolation Mode – New Production Changes Validated & Frozen  
**Scope:** Historical defects blocking zero-regression validation (not caused by health/email/reset/rate-limit/CORS/Sentry changes)

---

## 🚨 BLOCKER SEVERITY (Runtime Failures / Deployment Risk)

### B1: Drizzle ORM API Inconsistency – `db.from()` Misuse
**Location:** `server/routes.ts` (multiple lines)  
**Issue:** Code uses `db.from()` which doesn't exist on NeonDatabase type; should use `db.select().from()` or direct queries.  
**Lines Affected:** 246, 265, 268, 339, 374, 378, 403, 406, 409  
**Impact:** Runtime crash when affiliate routes execute; affiliate dashboard will 500.  
**Example (Line 246):**
```typescript
// BROKEN
const affiliateAccountsData = db.from(affiliateAccounts) as AffiliateAccount[];

// FIXED
const affiliateAccountsData = await db.query.affiliateAccounts.findMany();
```
**Patch:** Audit all `db.from()` calls; replace with canonical Drizzle pattern.  
**Risk Level:** **CRITICAL** – endpoint unreachable.

---

### B2: Socket.IO Missing Type Declarations
**Location:** `server/messaging-service.ts`  
**Issue:** `socket.io` module cannot find declarations.  
**Lines Affected:** 1  
**Impact:** Build fails; messaging/real-time features unavailable.  
**Fix:** Ensure `@types/socket.io` and `@types/socket.io-client` installed.  
**Package Status:** Already in `package.json` but types may not resolve.  
**Patch:** Run `npm i --save-dev @types/socket.io @types/socket.io-client` + verify `tsconfig.json` includes `node_modules`.  
**Risk Level:** **CRITICAL** – build blocker.

---

### B3: Community-Builder Schema Mismatch – `getAllBuilders()` Missing
**Location:** `server/routes/admin-community-builder-routes.ts` line 324  
**Issue:** `storage.getAllBuilders()` doesn't exist; should be `getAllUsers()` + filter or dedicated method.  
**Impact:** Admin community builder routes return 500.  
**Patch:** Add method to storage layer or use alternative query.  
**Risk Level:** **HIGH** – admin panel crash.

---

## ⚠️ FUNCTIONAL SEVERITY (Silent Logic Errors / Type Violations)

### F1: User Schema Property Missing – `profileViews`
**Location:** `server/routes.ts` line 8324  
**Issue:** `user.profileViews` doesn't exist in User schema.  
**Code:**
```typescript
dashboardData.stats.totalViews = user.profileViews || 0;
```
**Impact:** Always evaluates to 0; profile view tracking broken.  
**Patch:** Add `profileViews` to User schema migration or remove if not implemented.  
**Risk Level:** **MEDIUM** – feature doesn't work but doesn't crash.

---

### F2: Conversation Schema Missing Fields
**Location:** `server/routes.ts` lines 8392–8426  
**Issue:** Code references `conversations.participant1Id` and `conversations.participant2Id` which don't exist.  
**Actual Fields:** `contractorId` and `homeownerId` (from schema).  
**Impact:** Messaging queries fail silently or crash.  
**Lines Affected:** 8392, 8393, 8403, 8426  
**Patch:**
```typescript
// BROKEN
sql`(${conversations.participant1Id} = ${userId} AND ${conversations.participant2Id} = ${participantId})`

// FIXED (if contractor/homeowner model)
sql`(${conversations.contractorId} = ${userId} AND ${conversations.homeownerId} = ${participantId})`

// OR (if generic participants model needed)
// Refactor schema to use participant1Id/participant2Id consistently
```
**Risk Level:** **HIGH** – messaging completely broken.

---

### F3: Affiliate Route Type Mismatches
**Location:** `server/routes.ts` lines 246–409  
**Issue:** Multiple `db.from()` calls with incorrect casting.  
**Impact:** Affiliate dashboard returns incorrect/empty data.  
**Patch:** Use proper Drizzle query syntax + type inference.  
**Risk Level:** **MEDIUM** – feature unusable but doesn't crash if errors caught.

---

### F4: Community-Builder Form Data Type Mismatch
**Location:** `client/src/pages/community-builder/new-contribution.tsx` line 49  
**Issue:** `createMutation.mutate()` expects void but receives form object.  
**Code:**
```typescript
createMutation.mutate(formData); // formData is object, mutate expects void
```
**Impact:** Form submission fails; contributions can't be created.  
**Patch:** Ensure mutation hook is typed correctly with `useMutation<void, FormData>` or similar.  
**Risk Level:** **MEDIUM** – community builder feature broken.

---

### F5: Task Schema Type Violations
**Location:** `server/routes.ts` lines 3987, 4015, 4042  
**Issue:** Invalid field names and types in task insert:
- Line 3987: `budget` doesn't exist in tasks schema
- Line 4015: `taskId` should be string, not `parseInt(taskId)` (number)
- Line 4042: `verified` doesn't exist; should be `verifiedAt`

**Impact:** Task creation fails.  
**Patch:** Align field names with actual tasks schema definition.  
**Risk Level:** **MEDIUM** – task feature broken.

---

### F6: Knowledge Service Query API Mismatch
**Location:** `server/services/knowledgeService.ts` lines 249, 270  
**Issue:** Uses `db.query.marketplace_listings` and `db.query.groups` (snake_case) but Drizzle camelCase tables are `marketplaceListings` and `communityGroups`.  
**Impact:** Knowledge indexing fails; scout AI knowledge base doesn't populate.  
**Patch:** Rename to camelCase: `db.query.marketplaceListings.findMany()` etc.  
**Risk Level:** **MEDIUM** – Scout knowledge system broken.

---

## 🟡 COSMETIC/TECHNICAL DEBT (No Immediate Runtime Impact)

### C1: Implicit Type Parameters – Missing `Request/Response` Types
**Location:** `server/routes.ts` line 8338, `server/messaging-service.ts` multiple  
**Issue:** Parameters lack explicit types, relying on inference.  
**Impact:** Harder debugging; potential type narrowing issues.  
**Patch:** Add explicit `(req: Request, res: Response)` everywhere.  
**Risk Level:** **LOW** – best practice.

---

### C2: Community-Builder Mutation Type Inference
**Location:** `client/src/pages/community-builder/contribution-detail.tsx` line 204  
**Issue:** Mutation type not properly generic-bound.  
**Patch:** Add explicit type: `useMutation<UpdateResult, UpdatePayload>`.  
**Risk Level:** **LOW** – works but TypeScript unhappy.

---

### C3: Next.js Import in React/Wouter Project
**Location:** `client/src/pages/community-builder/dashboard.tsx` line 15  
**Issue:** Imports `next/link` but project uses Wouter for routing.  
**Impact:** Runtime would fail; inconsistent routing patterns.  
**Patch:** Replace with Wouter equivalent: `import { Link } from 'wouter'`.  
**Risk Level:** **MEDIUM** – mixing routing libraries is bad practice.

---

## 📊 SEVERITY RANKING TABLE

| ID | Category | Title | Severity | ROI (Fix First?) | Est. Effort |
|----|----------|-------|----------|-----------------|-------------|
| B1 | Blocker | Drizzle db.from() | **CRITICAL** | 1 | 2 hrs |
| B2 | Blocker | Socket.IO Types | **CRITICAL** | 2 | 15 min |
| B3 | Blocker | getAllBuilders() Missing | **HIGH** | 3 | 30 min |
| F2 | Functional | Conversation Schema | **HIGH** | 4 | 1 hr |
| F1 | Functional | profileViews Missing | **MEDIUM** | 5 | 30 min |
| F3 | Functional | Affiliate Route Types | **MEDIUM** | 6 | 1 hr |
| F6 | Functional | Knowledge Service Query | **MEDIUM** | 7 | 45 min |
| F4 | Functional | Community-Builder Mutation | **MEDIUM** | 8 | 1 hr |
| F5 | Functional | Task Schema Types | **MEDIUM** | 9 | 1 hr |
| C1 | Cosmetic | Missing Param Types | **LOW** | 10 | 2 hrs |
| C2 | Cosmetic | Mutation Generic Binding | **LOW** | 11 | 30 min |
| C3 | Cosmetic | Next.js Import Mismatch | **LOW** | 12 | 15 min |

---

## 🔧 PROPOSED PATCH SEQUENCE

### Phase 1: Blockers (Prevents Build/Deployment)
1. **Patch B2:** Install socket.io types → 15 min
2. **Patch B1:** Normalize all Drizzle queries → 2 hrs
3. **Patch B3:** Add getAllBuilders() or fix admin route → 30 min

### Phase 2: High-Risk Functional (Breaks Core Features)
4. **Patch F2:** Fix conversation schema queries → 1 hr
5. **Patch F6:** Fix knowledge service query API → 45 min

### Phase 3: Medium-Risk Functional (Feature Incomplete)
6. **Patch F1:** Add profileViews or remove tracking → 30 min
7. **Patch F3:** Align affiliate routes with Drizzle → 1 hr
8. **Patch F5:** Fix task schema field mapping → 1 hr
9. **Patch F4:** Fix community-builder mutations → 1 hr

### Phase 4: Debt Reduction (Best Practices)
10. **Patch C3:** Replace next/link with Wouter → 15 min
11. **Patch C1:** Add explicit types to handlers → 2 hrs
12. **Patch C2:** Fix mutation generics → 30 min

**Total Effort:** ~12 hours  
**Blocking Deployment:** Phases 1 & 2 (~3.5 hrs)  
**Optional (Post-Launch):** Phases 3 & 4

---

## ✅ DEPLOYMENT FREEZE CHECKLIST

- [x] New code (health/email/reset/rate-limit/CORS/Sentry) validated – **zero compilation errors**
- [x] Pre-existing defects isolated and ranked – **PEDL created**
- [ ] Phase 1 blockers fixed (socket.io types, Drizzle queries, getAllBuilders)
- [ ] Phase 2 high-risk functional fixed (conversation schema, knowledge queries)
- [ ] Full compile + no new errors
- [ ] Production smoke test (health check, email send, password reset, CORS headers, error tracking)
- [ ] Deploy with confidence

---

## 🎯 DECISION GATES

**Gate 1 (Phase 1 Complete):** Safe to deploy if Phase 1 fixes only + new code confirmed.  
**Gate 2 (Phase 2 Complete):** Safe to enable messaging/knowledge features.  
**Gate 3 (Phase 3 Complete):** Safe to enable affiliate/community-builder features.  
**Gate 4 (Phase 4 Complete):** Production-grade code quality.

---

**Document Owner:** GitHub Copilot  
**Last Updated:** December 6, 2025  
**Status:** Ready for patching – New production changes frozen & isolated.
