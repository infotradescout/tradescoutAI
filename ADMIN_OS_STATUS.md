# Admin OS Routes & Implementation Status

**Last Updated**: Jan 1, 2026  
**Architecture**: Super Admin OS shell (role-based navigation) + modular pages  
**Entry Point**: `/admin` (requires super_admin or head_admin role)  
**Navigation**: Defined in `client/src/admin/superAdminNav.ts`

---

## Navigation Structure (Canonical Order)

Source: `SUPER_ADMIN_NAV` in `superAdminNav.ts`

### Core Ops

| Route | Label | Component | Status | Notes |
|-------|-------|-----------|--------|-------|
| `/admin` | Overview | SuperAdminDashboard | ✅ Working | Coverage summary + queues + map link |
| `/admin/users` | Users | AdminUsers | ✅ Working | User list + search + editing |
| `/admin/verification` | Verification | AdminAddressVerifications | ✅ Working | Address verification queue |
| `/admin/moderation` | Moderation | ContentModeration | ✅ Working | Content moderation center |
| `/admin/impersonate` | Impersonation | AdminWorkspaceContent | ✅ Working | Role impersonation tool |

### Geo Intelligence

| Route | Label | Component | Status | Notes |
|-------|-------|-----------|--------|-------|
| `/admin/geo/counties` | Geography | UserHeatmap | ✅ Working | County map + heatmap view |
| `/admin/geo/coverage` | Coverage Console | AdminGeoCoverageConsole | ✅ Working | County assignments + coverage tracking |

### Growth & Marketplace

| Route | Label | Component | Status | Notes |
|-------|-------|-----------|--------|-------|
| `/admin/listings` | Listings Approval | AdminListings | ✅ Working | Marketplace listing review |
| `/admin/ads` | Ads | AdminPanelTabRedirect | ⚠️ Partially Working | Deep-links to admin-panel.tsx tab |
| `/admin/prizes` | Prizes | AdminPanelTabRedirect | ⚠️ Partially Working | Deep-links to admin-panel.tsx tab |
| `/admin/tradedeals` | TradeDeals Ops | AdminPromotions | ⚠️ Partial | Exists but limited functionality |

### Platform Ops

| Route | Label | Component | Status | Notes |
|-------|-------|-----------|--------|-------|
| `/admin/site-settings` | Site Settings | AdminPanelTabRedirect | ⚠️ Half-built | Deep-links to legacy admin-panel.tsx |
| `/admin/contractors` | Contractor Settings | AdminPanelTabRedirect | ⚠️ Half-built | Deep-links to legacy admin-panel.tsx |
| `/admin/notifications` | Notification Ops | AdminPanelTabRedirect | ⚠️ Half-built | Deep-links to legacy admin-panel.tsx |
| `/admin/errors` | Error Reports | AdminErrorReports | ✅ Working | Error aggregation + filtering |

### Intelligence & Automation

| Route | Label | Component | Status | Notes |
|-------|-------|-----------|--------|-------|
| `/admin/ai-monitoring` | AI Monitoring | UIMonitoringDashboard | ⚠️ Implemented, No Data | Framework exists, backend data missing |
| `/admin/ai-fixes` | AI Fixes | AICodeFixingDashboard | ⚠️ Implemented, No Data | Framework exists, real-time fixes not wired |
| `/admin/pricing` | Pricing Analytics | AdminPricingAnalytics | ⚠️ Stub | Page exists but no real data |
| `/admin/llm` | LLM Admin | AdminPanelTabRedirect | ⚠️ Half-built | Deep-links to legacy admin-panel.tsx (PromptAdminPage) |
| `/admin/knowledge` | Knowledge Upload | AdminPanelTabRedirect | ⚠️ Half-built | Deep-links to legacy admin-panel.tsx |

### Finance

| Route | Label | Component | Status | Notes |
|-------|-------|-----------|--------|-------|
| `/admin/finance` | Finance / Ledger | FinanceLedgerPanel | ✅ Working | Ledger transactions + summary, real data |

---

## Hidden/Unmapped Admin Routes (In Code But Not in Nav)

These routes exist and work but aren't exposed in the main navigation:

| Route | Component | Status | Purpose |
|-------|-----------|--------|---------|
| `/admin/platform-analytics` | PlatformAnalytics | ✅ Working | Money movements analytics |
| `/admin/workspace` | AdminWorkspaceContent | ✅ Working | Multi-tool workspace |
| `/admin/panel` | AdminPanelContent | ⚠️ Legacy | Old admin panel with tabs (Ads, Prizes, LLM, etc.) |
| `/admin/authority-diagnostics` | AdminAuthorityDiagnostics | ⚠️ Stub | Authority system diagnostics (empty UI) |
| `/admin/control` | AdminControl | ⚠️ Stub | Feature flags / kill switches (placeholder) |
| `/admin/tool-discovery` | AdminToolDiscovery | ⚠️ Stub | Admin tool registry (not implemented) |
| `/admin/attachments` | AdminAttachments | ⚠️ Stub | File attachment management (empty) |
| `/admin/affiliates` | AdminAffiliates | ⚠️ Stub | Affiliate partner management (empty) |
| `/admin/professional-verification` | AdminProfessionalVerification | ⚠️ Stub | Pro verification queue (empty) |
| `/admin/audit-log` | AdminAuditLog | ⚠️ Stub | Audit trail viewer (empty) |
| `/admin/testing-controls` | AdminTestingControls | ✅ Working | Bot Army controls + error report stats |
| `/admin/create-account` | AdminCreateAccount | ⚠️ Stub | Manual account creation (form exists, limited integration) |

---

## Assessment Summary

### ✅ Fully Working (Real Data, Real Functionality)

1. **Admin Dashboard** (`/admin`) — Coverage overview + queues
2. **Users** (`/admin/users`) — Full CRUD + search
3. **Verification** (`/admin/verification`) — Queue + approval flow
4. **Moderation** (`/admin/moderation`) — Content review
5. **Geography Map** (`/admin/geo/counties`) — County heatmap
6. **Coverage Console** (`/admin/geo/coverage`) — Assignments + tracking
7. **Finance Ledger** (`/admin/finance`) — Transaction ledger + summaries
8. **Error Reports** (`/admin/errors`) — Error aggregation + filtering
9. **Listings Approval** (`/admin/listings`) — Marketplace review
10. **Testing Controls** (`/admin/testing-controls`) — Bot Army + error report stats
11. **Platform Analytics** (`/admin/platform-analytics`) — Money movements

### ⚠️ Partially Working (Framework Built, Data Missing or Incomplete)

1. **AI Monitoring** (`/admin/ai-monitoring`) — UI exists, backend data source unclear/missing
2. **AI Fixes** (`/admin/ai-fixes`) — Dashboard framework exists, real-time fixes not wired
3. **Pricing Analytics** (`/admin/pricing`) — Page exists, no real data flowing
4. **Ads / Prizes** (`/admin/ads`, `/admin/prizes`) — Deep-links to legacy admin panel (working but interface fragmented)
5. **Site Settings / Contractor Settings / Notifications** — Deep-link to legacy admin panel (maintenance mode)
6. **LLM Admin** (`/admin/llm`) — Points to PromptAdminPage (works but UI minimal)

### ❌ Stub/Not Implemented (Page Exists, No Functionality)

1. **Authority Diagnostics** (`/admin/authority-diagnostics`) — Empty page
2. **Control / Kill Switches** (`/admin/control`) — Placeholder (no toggles wired)
3. **Tool Discovery** (`/admin/tool-discovery`) — Empty registry
4. **Attachments** (`/admin/attachments`) — File mgmt skeleton
5. **Affiliates** (`/admin/affiliates`) — Partner mgmt skeleton
6. **Professional Verification** (`/admin/professional-verification`) — Empty queue
7. **Audit Log** (`/admin/audit-log`) — Viewer skeleton (no data)
8. **Create Account** (`/admin/create-account`) — Form exists, backend integration spotty

---

## Critical Issues

### 1. **Fragmentation: Legacy Admin Panel Still Alive**

**Problem**: `/admin/panel` (old AdminPanelContent) still contains:
- Ads management
- Prizes management
- Site settings
- Contractor settings
- LLM admin
- Knowledge upload
- Notification ops

**Impact**: Navigation split between Super Admin OS shell and legacy panel  
**Status**: Routes redirect to `/admin/panel?tab=...` but this breaks the unified shell experience  
**Fix Required**: Migrate all tabs into proper Super Admin OS pages

### 2. **AI Monitoring Has No Real Data**

**Problem**: UIMonitoringDashboard is fully built but calls `/api/admin/ui-issues` which:
- May not exist or return empty
- Backend may not be collecting UI issues
- No real integration with Bot Army output

**Status**: Framework + UI complete, backend data source missing  
**Fix Required**: Wire real Bot Army output → AI Monitoring dashboard

### 3. **No Bot Council Report Page**

**Problem**: You specified Bot Council Report should live at:
- `Super Admin OS → AI Monitoring → Bot Council`

**Current State**: Bot Council Report spec exists (BOT_COUNCIL_REPORT_CHARTER.md) but:
- No page component exists yet
- Not in the navigation
- No data pipeline built

**Fix Required**: Create dedicated page + wire Scout logging data

### 4. **Some Pages Missing Backend Integration**

**Pages with UI but no working backend**:
- Authority Diagnostics (UI empty, no API)
- Control / Kill Switches (UI empty, no flag endpoints)
- Tool Discovery (UI empty, no tool registry)
- Create Account (form exists, needs user creation API)

**Status**: All are placeholders waiting for backend

### 5. **No Real-Time Scout Insights**

**Problem**: You want founder to see Scout learning insights daily.

**Current State**: No page exists for:
- Weekly Scout insights
- Language performance heatmap
- Friction signal dashboard
- Action capability coverage

**New Pages Needed**:
- `/admin/scout-insights` — Daily/weekly Scout report
- Potentially integrate into existing AI Monitoring

---

## What Works Best Right Now

**Tier 1 (Production-Ready)**:
- Overview + Coverage
- User management
- Moderation
- Finance ledger
- Error reports
- Geography/heatmap

**Tier 2 (Mostly Ready)**:
- Verification queues
- Listings approval
- Bot Army controls

**Tier 3 (Needs Work)**:
- AI Monitoring (framework ready, data missing)
- Pricing analytics (UI ready, data missing)
- Legacy tabs (redirect works, UX fragmented)

---

## Missing / Incomplete Features

### High Priority (Blocks Founder Visibility)

| Feature | Where It Should Be | Current State | Impact |
|---------|-------------------|---------------|--------|
| **Bot Council Report** | AI Monitoring section | Spec written, no page | Can't see daily intelligence |
| **Scout Insights** | AI Monitoring or new section | Spec written, no page | Can't see Scout learning patterns |
| **Kill Switches / Feature Flags** | Control page | Placeholder | Can't quickly disable features |
| **Audit Trail** | Audit Log page | Skeleton only | No compliance trail |

### Medium Priority (Nice to Have)

| Feature | Where It Should Be | Current State | Impact |
|---------|-------------------|---------------|--------|
| **AI Fixes Streaming** | AI Fixes page | UI exists, fixes not wired | Can't see real-time AI corrections |
| **Pro Verification Queue** | Pro Verification page | Empty skeleton | Manual process has no visibility |
| **Tool Registry** | Tool Discovery page | Empty skeleton | No admin-side tool management |
| **Affiliate Management** | Affiliates page | Empty skeleton | Partners not manageable |

### Low Priority (Polish)

| Feature | Where It Should Be | Current State | Impact |
|---------|-------------------|---------------|--------|
| **Create Account** | Create Account page | Form exists, limited backend | Manual account creation works but rough |
| **Attachment Management** | Attachments page | Skeleton | File management scattered |

---

## Recommendations

### Phase 1 (This Week)
1. ✅ Bot Council Report page (integrate with AI Monitoring)
2. ✅ Create Scout Insights page
3. ✅ Move legacy admin-panel tabs into Super Admin OS shell

### Phase 2 (Next Week)
1. Wire real Bot Army data → AI Monitoring dashboard
2. Wire real Scout logs → AI Monitoring / Scout Insights
3. Implement Kill Switches / Feature Flags page

### Phase 3 (Polish)
1. Audit Log real integration
2. Professional Verification queue
3. Tool Discovery registry

---

## Code Locations

| File | Purpose |
|------|---------|
| `client/src/admin/superAdminNav.ts` | Navigation config (source of truth) |
| `client/src/admin/SuperAdminOSLayout.tsx` | Shell layout + routing |
| `client/src/pages/admin.tsx` | Main entry point + AdminContentRouter |
| `client/src/pages/admin-*.tsx` | Individual page components |
| `client/src/components/admin/*.tsx` | Reusable admin components |

---

## Quick Links for Navigation Definition Changes

To add a new route to the Super Admin OS navigation:

1. Add item to `SUPER_ADMIN_NAV` array in `client/src/admin/superAdminNav.ts`
   ```typescript
   {
     id: "unique_id",
     label: "Display Label",
     path: "/admin/path",
     icon: IconComponent,
     visibleIf: { roles: ["super_admin"] } // optional
   }
   ```

2. Create page component at `client/src/pages/admin-path.tsx`

3. Add route handler in `AdminContentRouter` function in `client/src/pages/admin.tsx`
   ```typescript
   if (subPath === "/path") {
     return <ComponentName />;
   }
   ```

4. If component needs backend: add API endpoint in `server/routes/*.ts`

---

## Next: Build Your Admin OS

Based on this status, your priorities are:

1. **Create Bot Council Report page** (highest value for founder intelligence)
2. **Create Scout Insights page** (real user learning visibility)
3. **Consolidate legacy admin panel** (clean up navigation fragmentation)
4. **Wire AI Monitoring to real data** (make framework useful)

Which would you like to tackle first?
