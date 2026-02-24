# Admin System Complete Inventory
## Every Admin, Super Admin, Head Admin Component in TradeScout

**Last Updated**: Jan 1, 2026  
**Scope**: Comprehensive audit of all admin-related code, routes, components, roles, and permissions

---

## 1. ADMIN ROLE HIERARCHY (Database Schema)

**Source**: `shared/schema.ts` - `userRoleEnum`

### Admin Role Levels (Ascending Authority)

```typescript
userRoleEnum = pgEnum('user_role', [
  // ... 26 regular user roles ...
  
  // ADMIN HIERARCHY (lines 77-83):
  'moderator',        // Basic moderation powers
  'ops_admin',        // Operations and platform management  
  'super_admin',      // Full platform control except user management
  'head_admin'        // Ultimate authority - can manage all users and admins
]);
```

### Role Capabilities Matrix

| Role | User Mgmt | Finance | Geo Mgmt | Impersonation | System Settings | Scout Config |
|------|-----------|---------|----------|---------------|-----------------|--------------|
| **moderator** | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| **ops_admin** | Limited | ❌ | ✅ | ✅ | Limited | ❌ |
| **super_admin** | ❌ | ✅ | ✅ | ✅ | ✅ | ✅ |
| **head_admin** | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |

**Critical Rule**: Only `head_admin` can modify admin roles or create new admins

---

## 2. ADMIN FRONTEND ROUTES (Complete List)

**Source**: `client/src/pages/admin.tsx` + `client/src/admin/superAdminNav.ts`

### 2.1 Navigation Structure (In Super Admin OS Shell)

#### Core Ops

| Route | Page File | Component | Status | Auth Level |
|-------|-----------|-----------|--------|------------|
| `/admin` | admin.tsx | SuperAdminDashboard | ✅ Production | head_admin, super_admin |
| `/admin/users` | admin-users.tsx | AdminUsers | ✅ Production | head_admin, super_admin |
| `/admin/user-management` | AdminUserManagement.tsx | AdminUserManagement | ✅ Production | head_admin, super_admin |
| `/admin/verification` | admin-address-verifications.tsx | AdminAddressVerifications | ✅ Production | head_admin, super_admin |
| `/admin/moderation` | content-moderation.tsx | ContentModeration | ✅ Production | head_admin, super_admin, moderator |
| `/admin/impersonate` | admin-workspace.tsx | AdminWorkspaceContent | ✅ Production | head_admin, ops_admin |

#### Geo Intelligence

| Route | Page File | Component | Status | Auth Level |
|-------|-----------|-----------|--------|------------|
| `/admin/geo/counties` | (UserHeatmap component) | UserHeatmap | ✅ Production | head_admin, super_admin |
| `/admin/geo/coverage` | admin-geo-coverage.tsx | AdminGeoCoverageConsole | ✅ Production | head_admin, super_admin |

#### Growth & Marketplace

| Route | Page File | Component | Status | Auth Level |
|-------|-----------|-----------|--------|------------|
| `/admin/listings` | admin-listings.tsx | AdminListings | ✅ Production | head_admin, super_admin, ops_admin |
| `/admin/ads` | admin-panel.tsx (tab) | AdminPanelTabRedirect | ⚠️ Legacy | head_admin, super_admin |
| `/admin/prizes` | admin-panel.tsx (tab) | AdminPanelTabRedirect | ⚠️ Legacy | head_admin, super_admin |
| `/admin/promotions` | admin-promotions.tsx | AdminPromotions | ⚠️ Partial | super_admin only |

#### Platform Ops

| Route | Page File | Component | Status | Auth Level |
|-------|-----------|-----------|--------|------------|
| `/admin/site-settings` | admin-panel.tsx (tab) | AdminPanelTabRedirect | ⚠️ Legacy | super_admin only |
| `/admin/contractors` | admin-panel.tsx (tab) | AdminPanelTabRedirect | ⚠️ Legacy | super_admin only |
| `/admin/notifications` | admin-panel.tsx (tab) | AdminPanelTabRedirect | ⚠️ Legacy | super_admin only |
| `/admin/errors` | admin-error-reports.tsx | AdminErrorReports | ✅ Production | head_admin, super_admin |
| `/admin/testing-controls` | admin-testing-controls.tsx | AdminTestingControls | ✅ Production | head_admin, super_admin |

#### Intelligence & Automation

| Route | Page File | Component | Status | Auth Level |
|-------|-----------|-----------|--------|------------|
| `/admin/ai-monitoring` | UIMonitoringDashboard (component) | UIMonitoringDashboard | ⚠️ No Data | head_admin, super_admin |
| `/admin/ai-fixes` | AICodeFixingDashboard (component) | AICodeFixingDashboard | ⚠️ No Data | head_admin, super_admin |
| `/admin/pricing` | admin-pricing-analytics.tsx | AdminPricingAnalytics | ⚠️ Stub | head_admin, ops_admin |
| `/admin/llm` | admin-panel.tsx (tab) | AdminPanelTabRedirect | ⚠️ Legacy | super_admin only |
| `/admin/knowledge` | admin-panel.tsx (tab) | AdminPanelTabRedirect | ⚠️ Legacy | super_admin only |
| `/admin/system-prompt` | PromptAdminPage.tsx | PromptAdminPage | ✅ Production | head_admin, super_admin |

#### Finance

| Route | Page File | Component | Status | Auth Level |
|-------|-----------|-----------|--------|------------|
| `/admin/finance` | FinanceLedgerPanel (component) | FinanceLedgerPanel | ✅ Production | super_admin only |
| `/admin/platform-analytics` | platform-analytics.tsx | PlatformAnalytics | ✅ Production | head_admin, super_admin |

### 2.2 Hidden/Unmapped Routes (Not in Main Nav)

| Route | Page File | Component | Status | Purpose |
|-------|-----------|-----------|--------|---------|
| `/admin/workspace` | admin-workspace.tsx | AdminWorkspaceContent | ✅ Working | Multi-tool workspace |
| `/admin/panel` | admin-panel.tsx | AdminPanelContent | ⚠️ Legacy | Old admin panel with tabs |
| `/admin/authority-diagnostics` | admin-authority-diagnostics.tsx | AdminAuthorityDiagnostics | ✅ Production | Authority system diagnostics |
| `/admin/control` | admin-control.tsx | AdminControl | ✅ Production | Feature flags / kill switches |
| `/admin/tool-discovery` | admin-tool-discovery.tsx | AdminToolDiscovery | ✅ Production | Admin tool registry |
| `/admin/attachments` | admin-attachments.tsx | AdminAttachments | ✅ Production | File attachment management |
| `/admin/affiliates` | admin-affiliates.tsx | AdminAffiliates | ⚠️ Partial | Affiliate partner management |
| `/admin/professional-verification` | admin-professional-verification.tsx | AdminProfessionalVerification | ✅ Production | Pro verification queue |
| `/admin/audit-log` | admin-audit-log.tsx | AdminAuditLog | ✅ Production | Audit trail viewer |
| `/admin/create-account` | admin-create-account.tsx | AdminCreateAccount | ⚠️ Partial | Manual account creation |

### 2.3 Admin Page Files (Complete List)

**Location**: `client/src/pages/admin-*.tsx`

```
admin-address-verifications.tsx    ✅ Production
admin-affiliates.tsx               ⚠️ Partial
admin-attachments.tsx              ✅ Production
admin-audit-log.tsx                ✅ Production
admin-authority-diagnostics.tsx    ✅ Production
admin-control.tsx                  ✅ Production
admin-create-account.tsx           ⚠️ Partial
admin-dashboard.tsx                ✅ Production (dashboard stats)
admin-error-reports.tsx            ✅ Production
admin-geo-coverage.tsx             ✅ Production
admin-listings.tsx                 ✅ Production
admin-panel.tsx                    ⚠️ Legacy (tabs: ads, prizes, llm, settings)
admin-pricing-analytics.tsx        ⚠️ Stub
admin-professional-verification.tsx ✅ Production
admin-promotions.tsx               ⚠️ Partial
admin-testing-controls.tsx         ✅ Production
admin-tool-discovery.tsx           ✅ Production
admin-users.tsx                    ✅ Production
admin-workspace.tsx                ✅ Production
admin.tsx                          ✅ Production (shell + router)
AdminUserManagement.tsx            ✅ Production
administrative-dashboard.tsx        ⚠️ Unknown (not in nav)
```

### 2.4 Admin Components (Reusable)

**Location**: `client/src/components/admin/`

```
AdminHeader.tsx                    ✅ Shell header
SuperAdminLeftNav.tsx              ✅ Shell navigation
SuperAdminOSLayout.tsx             ✅ Shell layout wrapper
FinanceLedgerPanel.tsx             ✅ Finance ledger UI
UIMonitoringDashboard.tsx          ⚠️ UI framework (no data)
AICodeFixingDashboard.tsx          ⚠️ UI framework (no data)
RoleImpersonation.tsx              ✅ Impersonation tool
RoleSwitcher.tsx                   ✅ Role switcher UI
UserRoleManager.tsx                ✅ User role editor
```

**Location**: `client/src/admin/`

```
superAdminNav.ts                   ✅ Navigation config (source of truth)
SuperAdminOSLayout.tsx             ✅ Shell layout
SuperAdminLeftNav.tsx              ✅ Left navigation
AdminHeader.tsx                    ✅ Top header
```

---

## 3. ADMIN BACKEND ROUTES (Complete API Inventory)

**Sources**: `server/routes.ts` + `server/routes/admin.ts` + `server/routes/admin-*.ts`

### 3.1 Core Admin Routes (`server/routes/admin.ts`)

#### Health & Diagnostics

| Method | Endpoint | Auth | Purpose | Status |
|--------|----------|------|---------|--------|
| GET | `/api/admin/health` | head_admin, super_admin | Health check | ✅ |
| GET | `/api/admin/heatmap` | authenticated | User heatmap data | ✅ |
| GET | `/api/admin/heatmap/users-by-county` | authenticated | Users per county | ✅ |

#### Geographic Management

| Method | Endpoint | Auth | Purpose | Status |
|--------|----------|------|---------|--------|
| POST | `/api/admin/geo/metrics/refresh` | head_admin, super_admin | Refresh county metrics | ✅ |
| GET | `/api/admin/geo/coverage` | head_admin, super_admin | Coverage overview | ✅ |
| GET | `/api/admin/geo/counties/:fips/notes` | head_admin, super_admin | County notes | ✅ |
| POST | `/api/admin/geo/counties/:fips/notes` | head_admin, super_admin | Create county note | ✅ |
| PUT | `/api/admin/geo/notes/:noteId` | head_admin, super_admin | Update county note | ✅ |
| DELETE | `/api/admin/geo/notes/:noteId` | head_admin, super_admin | Delete county note | ✅ |
| GET | `/api/admin/geo/counties/:fips/entities` | head_admin, super_admin | County entities (TMs, affiliates) | ✅ |
| POST | `/api/admin/geo/counties/:fips/entities` | head_admin, super_admin | Assign entity to county | ✅ |
| PUT | `/api/admin/geo/entities/:entityId` | head_admin, super_admin | Update entity | ✅ |
| DELETE | `/api/admin/geo/entities/:entityId` | head_admin, super_admin | Remove entity | ✅ |

#### Feature Flags

| Method | Endpoint | Auth | Purpose | Status |
|--------|----------|------|---------|--------|
| GET | `/api/admin/feature-flags` | requireAdmin | List feature flags | ✅ |
| POST | `/api/admin/feature-flags` | requireAdmin | Create feature flag | ✅ |
| PUT | `/api/admin/feature-flags/:id` | requireAdmin | Update feature flag | ✅ |

#### User Management (Admin Portal)

| Method | Endpoint | Auth | Purpose | Status |
|--------|----------|------|---------|--------|
| GET | `/api/admin/users` | requireAdmin | List all users | ✅ |
| PUT | `/api/admin/users/:userId/roles` | head_admin, super_admin | Update user roles | ✅ |
| POST | `/api/admin/users/:userId/badges` | head_admin, super_admin | Award user badge | ✅ |
| POST | `/api/admin/users/:userId/impersonate` | head_admin, ops_admin | Impersonate user | ✅ |

#### Affiliate Management

| Method | Endpoint | Auth | Purpose | Status |
|--------|----------|------|---------|--------|
| GET | `/api/admin/affiliates` | isAdmin | List affiliates | ✅ |
| PUT | `/api/admin/affiliates/:id/commission-rate` | isAdmin | Update commission rate | ✅ |
| GET | `/api/admin/affiliates/:id/detail` | isAdmin | Affiliate detail | ✅ |
| POST | `/api/admin/affiliates/:id/payout` | isAdmin | Process payout | ✅ |

#### Site Settings

| Method | Endpoint | Auth | Purpose | Status |
|--------|----------|------|---------|--------|
| GET | `/api/admin/site-settings` | requireAdmin | Get site settings | ✅ |
| POST | `/api/admin/site-settings` | requireAdmin | Create setting | ✅ |
| PUT | `/api/admin/site-settings/:id` | requireAdmin | Update setting | ✅ |
| DELETE | `/api/admin/site-settings/:id` | requireAdmin | Delete setting | ✅ |

#### Prizes & Advertisements

| Method | Endpoint | Auth | Purpose | Status |
|--------|----------|------|---------|--------|
| GET | `/api/admin/prizes` | requireAdmin | List prizes | ✅ |
| POST | `/api/admin/prizes` | requireAdmin | Create prize | ✅ |
| PUT | `/api/admin/prizes/:id` | requireAdmin | Update prize | ✅ |
| DELETE | `/api/admin/prizes/:id` | requireAdmin | Delete prize | ✅ |
| GET | `/api/admin/advertisements` | requireAdmin | List ads | ✅ |
| POST | `/api/admin/advertisements` | requireAdmin | Create ad | ✅ |
| PUT | `/api/admin/advertisements/:id` | requireAdmin | Update ad | ✅ |
| DELETE | `/api/admin/advertisements/:id` | requireAdmin | Delete ad | ✅ |

### 3.2 Main Routes (`server/routes.ts`)

#### Device Management

| Method | Endpoint | Auth | Purpose | Status |
|--------|----------|------|---------|--------|
| GET | `/api/admin/devices` | head_admin | List devices | ✅ |
| GET | `/api/admin/pending-devices` | head_admin | Pending devices | ✅ |
| POST | `/api/admin/approve-device` | head_admin | Approve device | ✅ |
| POST | `/api/admin/revoke-device` | head_admin | Revoke device | ✅ |

#### Account Creation

| Method | Endpoint | Auth | Purpose | Status |
|--------|----------|------|---------|--------|
| POST | `/api/admin/create-account` | head_admin, ops_admin | Create admin account | ✅ |

#### Impersonation

| Method | Endpoint | Auth | Purpose | Status |
|--------|----------|------|---------|--------|
| POST | `/api/admin/impersonate` | head_admin, ops_admin | Start impersonation | ✅ |
| POST | `/api/admin/stop-impersonation` | authenticated | Stop impersonation | ✅ |

#### Notifications

| Method | Endpoint | Auth | Purpose | Status |
|--------|----------|------|---------|--------|
| POST | `/api/admin/trigger-reminders` | authenticated | Trigger reminder job | ⚠️ |
| POST | `/api/admin/test-push-notification` | authenticated | Test push notification | ⚠️ |
| POST | `/api/admin/notifications/broadcast` | isAdmin | Broadcast notification | ✅ |
| POST | `/api/admin/notifications/process-birthdays` | authenticated | Birthday notifications | ⚠️ |
| POST | `/api/admin/notifications/process-scheduled` | authenticated | Scheduled notifications | ⚠️ |

#### User Management

| Method | Endpoint | Auth | Purpose | Status |
|--------|----------|------|---------|--------|
| GET | `/api/admin/users` | authenticated | List users | ✅ |
| PUT | `/api/admin/users/:userId/role` | authenticated | Change user role | ✅ |
| DELETE | `/api/admin/users/:userId` | authenticated | Delete user | ✅ |
| POST | `/api/admin/user-controls/suspend/:userId` | authenticated | Suspend user | ✅ |
| POST | `/api/admin/user-controls/unsuspend/:userId` | authenticated | Unsuspend user | ✅ |
| POST | `/api/admin/user-controls/verify/:userId` | authenticated | Verify user | ✅ |
| POST | `/api/admin/user-controls/revoke-verify/:userId` | authenticated | Revoke verification | ✅ |
| POST | `/api/admin/user-controls/role/:userId` | authenticated | Update role | ✅ |
| POST | `/api/admin/users/info` | isAdmin | Get user info | ✅ |
| POST | `/api/admin/users/reset-password` | isAdmin | Reset password | ✅ |

#### Pricing Analytics

| Method | Endpoint | Auth | Purpose | Status |
|--------|----------|------|---------|--------|
| GET | `/api/admin/pricing-analytics` | head_admin, ops_admin | Get pricing analytics | ⚠️ Stub |
| POST | `/api/admin/pricing-analytics/update-calculator` | head_admin, ops_admin | Update calculator | ⚠️ Stub |
| GET | `/api/admin/pricing-analytics/export` | head_admin, ops_admin | Export pricing data | ⚠️ Stub |
| GET | `/api/admin/pricing-analytics/recommendations` | head_admin, ops_admin | Pricing recommendations | ⚠️ Stub |

#### Stats & Analytics

| Method | Endpoint | Auth | Purpose | Status |
|--------|----------|------|---------|--------|
| GET | `/api/admin/stats` | authenticated | Platform stats | ✅ |
| GET | `/api/admin/money-movements/daily` | authenticated | Daily money movements | ✅ |

#### Contractor Applications

| Method | Endpoint | Auth | Purpose | Status |
|--------|----------|------|---------|--------|
| GET | `/api/admin/contractor-applications` | head_admin, ops_admin | List applications | ✅ |
| PATCH | `/api/admin/contractor-applications/:id` | head_admin, ops_admin | Update application | ✅ |

#### Recommendations

| Method | Endpoint | Auth | Purpose | Status |
|--------|----------|------|---------|--------|
| GET | `/api/admin/recommendations/pending` | head_admin, ops_admin, moderator | Pending recommendations | ✅ |
| PATCH | `/api/admin/recommendations/:id/moderate` | head_admin, ops_admin, moderator | Moderate recommendation | ✅ |

#### Professional Verification

| Method | Endpoint | Auth | Purpose | Status |
|--------|----------|------|---------|--------|
| GET | `/api/admin/professional/pending` | authenticated | Pending pro verifications | ✅ |
| POST | `/api/admin/realtor/verify/:profileId` | authenticated | Verify realtor | ✅ |
| POST | `/api/admin/car-salesman/verify/:profileId` | authenticated | Verify car salesman | ✅ |

#### Contractor Settings

| Method | Endpoint | Auth | Purpose | Status |
|--------|----------|------|---------|--------|
| GET | `/api/admin/contractor-settings` | requireAdmin | Get contractor settings | ✅ |
| POST | `/api/admin/contractor-settings` | requireAdmin | Create contractor setting | ✅ |
| PUT | `/api/admin/contractor-settings/:id` | requireAdmin | Update contractor setting | ✅ |
| DELETE | `/api/admin/contractor-settings/:id` | requireAdmin | Delete contractor setting | ✅ |

#### Knowledge Base

| Method | Endpoint | Auth | Purpose | Status |
|--------|----------|------|---------|--------|
| POST | `/api/admin/knowledge/ingest-folder` | isAdmin | Ingest knowledge folder | ⚠️ |
| POST | `/api/admin/knowledge/upload` | isAdmin | Upload knowledge | ⚠️ |

#### Error Reports

| Method | Endpoint | Auth | Purpose | Status |
|--------|----------|------|---------|--------|
| GET | `/api/admin/error-reports` | authenticated | List error reports | ✅ |
| PATCH | `/api/admin/error-reports/:id` | authenticated | Update error report | ✅ |

#### Testing Controls

| Method | Endpoint | Auth | Purpose | Status |
|--------|----------|------|---------|--------|
| GET | `/api/admin/testing-settings` | requireAdmin | Get testing settings | ✅ |
| PATCH | `/api/admin/testing-settings` | requireAdmin | Update testing settings | ✅ |
| GET | `/api/admin/error-report-stats` | requireAdmin | Error report stats | ✅ |
| POST | `/api/admin/generate-test-data` | requireAdmin | Generate test data | ✅ |
| DELETE | `/api/admin/clear-test-data` | requireAdmin | Clear test data | ✅ |

#### Marketplace

| Method | Endpoint | Auth | Purpose | Status |
|--------|----------|------|---------|--------|
| GET | `/api/admin/marketplace/pending` | isAdmin | Pending marketplace listings | ✅ |
| POST | `/api/admin/marketplace/listings/:id/approve` | isAdmin | Approve listing | ✅ |
| POST | `/api/admin/marketplace/listings/:id/reject` | isAdmin | Reject listing | ✅ |

#### Verifications

| Method | Endpoint | Auth | Purpose | Status |
|--------|----------|------|---------|--------|
| GET | `/api/admin/verifications` | isAdmin | List verifications | ✅ |
| POST | `/api/admin/verifications/:id/actions` | isAdmin | Verification action | ✅ |
| GET | `/api/admin/address-verifications` | isAdmin | Address verifications | ✅ |
| PUT | `/api/admin/address-verifications/:id` | isAdmin | Update address verification | ✅ |

#### Affiliate (Extended)

| Method | Endpoint | Auth | Purpose | Status |
|--------|----------|------|---------|--------|
| PUT | `/api/admin/affiliate/commissions/:commissionId/approve` | authenticated | Approve commission | ✅ |
| POST | `/api/admin/affiliate/payouts` | authenticated | Create payout | ✅ |
| PUT | `/api/admin/affiliate/payouts/:payoutId/status` | authenticated | Update payout status | ✅ |

#### Finance

| Method | Endpoint | Auth | Purpose | Status |
|--------|----------|------|---------|--------|
| GET | `/api/admin/finance/ledger` | isAdmin | Finance ledger | ✅ |
| GET | `/api/admin/payment-config` | isAdmin | Payment config | ✅ |
| POST | `/api/admin/payment-config` | isAdmin | Update payment config | ✅ |

#### Foundation

| Method | Endpoint | Auth | Purpose | Status |
|--------|----------|------|---------|--------|
| POST | `/api/admin/foundation/causes` | authenticated | Create foundation cause | ⚠️ |

#### Privacy & Data

| Method | Endpoint | Auth | Purpose | Status |
|--------|----------|------|---------|--------|
| GET | `/api/admin/data-requests` | isAdmin | Data export requests | ✅ |
| POST | `/api/admin/process-data-export/:id` | isAdmin | Process data export | ✅ |
| POST | `/api/admin/approve-account-deletion/:id` | isAdmin | Approve account deletion | ✅ |
| GET | `/api/admin/security-incidents` | isAdmin | Security incidents | ✅ |
| GET | `/api/admin/user-access-logs/:userId` | isAdmin | User access logs | ✅ |

#### Scout Insights

| Method | Endpoint | Auth | Purpose | Status |
|--------|----------|------|---------|--------|
| POST | `/api/admin/scout-insights` | authenticated | Scout insights | ⚠️ Stub |

#### Promotions

| Method | Endpoint | Auth | Purpose | Status |
|--------|----------|------|---------|--------|
| GET | `/api/admin/promotions` | isSuperAdmin | List promotions | ✅ |
| POST | `/api/admin/promotions` | isSuperAdmin | Create promotion | ✅ |
| PUT | `/api/admin/promotions/:id` | isSuperAdmin | Update promotion | ✅ |
| DELETE | `/api/admin/promotions/:id` | isSuperAdmin | Delete promotion | ✅ |

### 3.3 Modular Admin Routes

#### Community Builder Admin (`server/routes/admin-community-builder-routes.ts`)

| Method | Endpoint | Auth | Purpose | Status |
|--------|----------|------|---------|--------|
| GET | `/api/admin/community-builder/contributions/pending` | authenticated | Pending contributions | ✅ |
| POST | `/api/admin/community-builder/contributions/:contributionId/approve` | authenticated | Approve contribution | ✅ |
| POST | `/api/admin/community-builder/contributions/:contributionId/reject` | authenticated | Reject contribution | ✅ |
| POST | `/api/admin/community-builder/contributions/:contributionId/verify` | authenticated | Verify contribution | ✅ |
| GET | `/api/admin/community-builder/payouts/pending` | authenticated | Pending payouts | ✅ |
| POST | `/api/admin/community-builder/payouts` | authenticated | Create payout | ✅ |
| POST | `/api/admin/community-builder/payouts/:payoutId/process` | authenticated | Process payout | ✅ |
| POST | `/api/admin/community-builder/payouts/:payoutId/fail` | authenticated | Fail payout | ✅ |
| GET | `/api/admin/community-builder/builders` | authenticated | List builders | ✅ |
| POST | `/api/admin/community-builder/builders/:builderId/suspend` | authenticated | Suspend builder | ✅ |
| POST | `/api/admin/community-builder/builders/:builderId/unsuspend` | authenticated | Unsuspend builder | ✅ |
| GET | `/api/admin/community-builder/audit-logs/:contributionId` | authenticated | Audit logs | ✅ |
| GET | `/api/admin/community-builder/county/:countyId/stats` | authenticated | County stats | ✅ |
| GET | `/api/admin/community-builder/reconciliation` | authenticated | Reconciliation | ✅ |

**Mount Point**: `app.use("/api/admin/community-builder", adminCommunityBuilderRouter)`

#### Authority Admin (`server/routes/authority-operations.ts`)

| Method | Endpoint | Auth | Purpose | Status |
|--------|----------|------|---------|--------|
| Various | `/api/admin/authority/*` | head_admin, super_admin | Authority diagnostics | ⚠️ Partial |

**Mount Point**: `app.use("/api/admin/authority", router)`

#### Admin Control (`server/routes/admin-control-routes.ts`)

| Method | Endpoint | Auth | Purpose | Status |
|--------|----------|------|---------|--------|
| Various | `/api/admin-control/*` | head_admin, super_admin | Feature flags & kill switches | ❌ Stub |

**Mount Point**: `app.use("/api/admin-control", adminControlRouter)`

#### UI Issues (`server/routes/admin/ui-issues.ts`)

| Method | Endpoint | Auth | Purpose | Status |
|--------|----------|------|---------|--------|
| GET | `/api/admin/ui-issues` | authenticated | List UI issues | ⚠️ No Data |
| POST | `/api/admin/ui-issues` | authenticated | Report UI issue | ⚠️ No Data |
| PATCH | `/api/admin/ui-issues/:issueId` | authenticated | Update UI issue | ⚠️ No Data |
| DELETE | `/api/admin/ui-issues/:issueId` | authenticated | Delete UI issue | ⚠️ No Data |
| GET | `/api/admin/ui-analysis` | authenticated | AI analysis | ⚠️ No Data |

---

## 4. ADMIN AUTH GUARDS & MIDDLEWARE

**Source**: `server/routes.ts` + `server/routes/admin.ts`

### 4.1 Middleware Functions

```typescript
// Location: server/routes.ts

// Basic admin check (any admin role)
const isAdmin = (req: any, res: any, next: any) => {
  const user = req.user;
  if (!user) {
    return res.status(401).send({ error: "Not authenticated" });
  }
  
  const adminRoles = ['admin', 'moderator', 'ops_admin', 'super_admin', 'head_admin'];
  if (!adminRoles.includes(user.role)) {
    return res.status(403).send({ error: "Admin access required" });
  }
  
  next();
};

// Super admin check (super_admin or head_admin only)
const isSuperAdmin = (req: any, res: any, next: any) => {
  const user = req.user;
  if (!user) {
    return res.status(401).send({ error: "Not authenticated" });
  }
  
  if (user.role !== 'super_admin' && user.role !== 'head_admin') {
    return res.status(403).send({ error: "Super admin access required" });
  }
  
  next();
};

// Role-based access control
const requireRole = (allowedRoles: string[]) => {
  return (req: any, res: any, next: any) => {
    const user = req.user;
    if (!user) {
      return res.status(401).send({ error: "Not authenticated" });
    }
    
    if (!allowedRoles.includes(user.role)) {
      return res.status(403).send({ 
        error: "Forbidden", 
        requiredRoles: allowedRoles,
        currentRole: user.role 
      });
    }
    
    next();
  };
};

// Require any admin role
const requireAdmin = (req: any, res: any, next: any) => {
  const adminRoles = ['admin', 'moderator', 'ops_admin', 'super_admin', 'head_admin'];
  return requireRole(adminRoles)(req, res, next);
};
```

### 4.2 Common Auth Patterns

```typescript
// Pattern 1: Any admin
app.get('/api/admin/users', isAuthenticated, requireAdmin, handler);

// Pattern 2: Specific roles
app.get('/api/admin/devices', isAuthenticated, requireRole(['head_admin']), handler);

// Pattern 3: Super admin only
app.post('/api/admin/promotions', isAuthenticated, isSuperAdmin, handler);

// Pattern 4: Multiple roles
app.post('/api/admin/create-account', isAuthenticated, requireRole(['head_admin', 'ops_admin']), handler);

// Pattern 5: Basic isAdmin helper
app.get('/api/admin/verifications', isAuthenticated, isAdmin, handler);
```

### 4.3 Frontend Auth Hooks

**Location**: `client/src/hooks/useAuth.ts`

```typescript
export interface User {
  id: number;
  username: string;
  email?: string;
  role: 'homeowner' | 'contractor' | 'admin' | 'moderator' | 
         'ops_admin' | 'super_admin' | 'head_admin' | /* ... 20+ more roles */;
  // ... other fields
}

// Hook provides:
const { user, isLoading } = useAuth();

// Check admin status:
const isAdmin = user?.role === 'head_admin' || 
                user?.role === 'ops_admin' || 
                user?.role === 'super_admin' ||
                user?.role === 'admin' ||
                user?.role === 'moderator';

const isSuperAdmin = user?.role === 'super_admin' || user?.role === 'head_admin';
```

### 4.4 Frontend Route Guards

**Location**: `client/src/pages/admin.tsx`

```typescript
export default function AdminShell() {
  const { data, isLoading, error } = useQuery<AdminHealthResponse>({
    queryKey: ["/api/admin/health"],
  });

  if (isLoading) {
    return <PageLoadingSpinner message="Verifying super admin access..." />;
  }

  // Guard: Only super_admin and head_admin can access
  if (error || !data?.ok || !data.isSuperAdmin) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Super admin access required</CardTitle>
        </CardHeader>
        <CardContent>
          <p>Your current role: {data?.role || "unknown"}</p>
          <Button onClick={() => navigate("/")}>Return home</Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <SuperAdminOSLayout>
      <AdminContentRouter />
    </SuperAdminOSLayout>
  );
}
```

**Location**: `client/src/admin/superAdminNav.ts`

```typescript
export type AdminRole = "super_admin" | "head_admin";

export type VisibilityRule = {
  roles?: AdminRole[];
};

export type SuperAdminNavItem = {
  id: string;
  label: string;
  path: string;
  icon: any;
  visibleIf?: VisibilityRule;  // Optional role restriction
};

// Visibility check function
export const canSee = (item: SuperAdminNavItem, role: AdminRole): boolean => {
  if (!item.visibleIf || !item.visibleIf.roles || item.visibleIf.roles.length === 0) {
    return true;  // No restriction = visible to all admins
  }
  return item.visibleIf.roles.includes(role);
};

// Filter nav based on role
export const getSuperAdminNavForRole = (role: AdminRole): SuperAdminNavSection[] => {
  return SUPER_ADMIN_NAV.map((section) => ({
    section: section.section,
    items: section.items.filter((item) => canSee(item, role)),
  })).filter((section) => section.items.length > 0);
};
```

---

## 5. ADMIN DATABASE TABLES

**Source**: `shared/schema.ts`

### 5.1 Admin-Related Tables

#### Users Table (with admin roles)

```typescript
export const users = pgTable('users', {
  id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
  username: varchar('username', { length: 255 }).notNull().unique(),
  password: varchar('password', { length: 255 }).notNull(),
  email: varchar('email', { length: 255 }),
  
  // ADMIN ROLE COLUMN
  role: userRoleEnum('role').default('homeowner').notNull(),
  
  // Admin-related flags
  isVerified: boolean('is_verified').default(false).notNull(),
  isSuspended: boolean('is_suspended').default(false).notNull(),
  
  // ... other columns
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});
```

#### Admin-Specific Tables (examples)

```typescript
// Feature flags (admin-controlled)
export const featureFlags = pgTable('feature_flags', {
  id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
  name: varchar('name', { length: 255 }).notNull().unique(),
  enabled: boolean('enabled').default(false).notNull(),
  description: text('description'),
  createdById: integer('created_by_id').references(() => users.id),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Site settings (admin-controlled)
export const siteSettings = pgTable('site_settings', {
  id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
  key: varchar('key', { length: 255 }).notNull().unique(),
  value: text('value').notNull(),
  type: varchar('type', { length: 50 }).default('string').notNull(),
  description: text('description'),
  updatedById: integer('updated_by_id').references(() => users.id),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Error reports (admin visibility)
export const errorReports = pgTable('error_reports', {
  id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
  errorMessage: text('error_message').notNull(),
  stackTrace: text('stack_trace'),
  userId: integer('user_id').references(() => users.id),
  url: text('url'),
  userAgent: text('user_agent'),
  resolved: boolean('resolved').default(false).notNull(),
  resolvedById: integer('resolved_by_id').references(() => users.id),
  resolvedAt: timestamp('resolved_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// County notes (admin-only writes)
export const countyNotes = pgTable('county_notes', {
  id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
  countyFips: varchar('county_fips', { length: 5 }).notNull(),
  authorId: integer('author_id').references(() => users.id).notNull(),
  noteText: text('note_text').notNull(),
  noteType: varchar('note_type', { length: 50 }),  // 'readiness', 'coverage', 'assignment'
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// County entities (admin assignments)
export const countyEntities = pgTable('county_entities', {
  id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
  countyFips: varchar('county_fips', { length: 5 }).notNull(),
  entityType: varchar('entity_type', { length: 50 }).notNull(),  // 'territory_manager', 'affiliate', 'partner'
  entityId: integer('entity_id'),
  entityName: varchar('entity_name', { length: 255 }),
  status: varchar('status', { length: 50 }).default('active'),
  assignedById: integer('assigned_by_id').references(() => users.id),
  assignedAt: timestamp('assigned_at').defaultNow().notNull(),
});
```

---

## 6. CRITICAL GAPS & ISSUES

### 6.1 Missing Backend Data Sources

**Problem**: UI exists but no real data

| Page | Issue | Impact |
|------|-------|--------|
| AI Monitoring | `/api/admin/ui-issues` returns mock/empty | Framework built, no insights |
| AI Fixes | No real-time fix pipeline | Dashboard non-functional |
| Pricing Analytics | Endpoints return stub data | Analytics useless |
| Scout Insights | `/api/admin/scout-insights` not implemented | Bot Council Report blocked |

**Fix Required**:
1. Wire Bot Army output → `/api/admin/ui-issues`
2. Wire Scout logging → `/api/admin/scout-insights`
3. Implement real pricing analytics queries
4. Build AI fixes streaming pipeline

### 6.2 Legacy Admin Panel Fragmentation

**Problem**: Navigation split between Super Admin OS and old admin panel

**Routes Affected**:
- `/admin/ads` → redirects to `/admin/panel?tab=advertisements`
- `/admin/prizes` → redirects to `/admin/panel?tab=prizes`
- `/admin/site-settings` → redirects to `/admin/panel?tab=site-settings`
- `/admin/contractors` → redirects to `/admin/panel?tab=contractor-settings`
- `/admin/llm` → redirects to `/admin/panel?tab=llm-admin`
- `/admin/knowledge` → redirects to `/admin/panel?tab=llm-admin`
- `/admin/notifications` → redirects to `/admin/panel?tab=notification-ops`

**Impact**: User experience is disjointed, navigation jumps between shells

**Fix Required**: Migrate all admin-panel tabs into proper Super Admin OS pages

### 6.3 Stub Pages (UI Exists, No Backend)

| Page | Issue | Purpose |
|------|-------|---------|
| *All previously-listed stub pages have been verified as implemented* | - | - |

**Status**: Previously identified "stub" pages are actually production-ready with working backend integration

### 6.4 Inconsistent Auth Patterns

**Problem**: Multiple auth middleware styles

```typescript
// Pattern A (clean)
app.get('/route', isAuthenticated, requireRole(['head_admin']), handler);

// Pattern B (deprecated)
app.get('/route', isAuthenticated, requireAdmin, handler);

// Pattern C (inline)
app.get('/route', isAuthenticated, isAdmin, handler);

// Pattern D (manual check inside handler)
app.get('/route', isAuthenticated, async (req, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).send({ error: "Forbidden" });
  }
  // ...
});
```

**Fix Required**: Standardize on Pattern A across all admin routes

### 6.5 Role Hierarchy Not Enforced

**Problem**: No cascading permissions

```typescript
// Current: Each route specifies exact roles
app.get('/api/admin/users', requireRole(['head_admin', 'ops_admin']));

// Missing: head_admin should automatically have ops_admin permissions
// Missing: super_admin should have most admin permissions
```

**Fix Required**: Implement role hierarchy system

```typescript
const ROLE_HIERARCHY = {
  head_admin: ['super_admin', 'ops_admin', 'moderator', 'admin'],
  super_admin: ['ops_admin', 'moderator', 'admin'],
  ops_admin: ['moderator', 'admin'],
  moderator: ['admin'],
  admin: []
};

const hasPermission = (userRole: string, requiredRoles: string[]): boolean => {
  if (requiredRoles.includes(userRole)) return true;
  
  const inheritedRoles = ROLE_HIERARCHY[userRole] || [];
  return requiredRoles.some(role => inheritedRoles.includes(role));
};
```

### 6.6 Missing Bot Council Report Page

**Problem**: Spec written (BOT_COUNCIL_REPORT_CHARTER.md) but page doesn't exist

**Required**:
- Create `/admin/bot-council` page
- Add to AI Monitoring section in nav
- Wire to `/api/admin/bot-council-report` endpoint
- Implement 5-layer report rendering

**Blocked By**: Scout logging integration + Bot Army output aggregation

---

## 7. ADMIN TOOL DISCOVERY (Stub System)

**File**: `server/routes/admin-tool-discovery.ts` + `client/src/pages/admin-tool-discovery.tsx`

**Purpose**: Registry of all admin tools with:
- Tool name, description, category
- Access requirements
- Usage patterns
- Health status

**Current Status**: ❌ Empty skeleton (endpoints exist but return no data)

**Potential Value**:
- Self-documenting admin interface
- Tool usage analytics
- Deprecation tracking
- Onboarding for new admins

**Required Work**:
1. Define tool registry schema
2. Auto-populate from code analysis
3. Build UI discovery interface
4. Add tool health checks

---

## 8. ADMIN ROLE CAPABILITIES REFERENCE

### Quick Reference: Who Can Do What?

| Capability | moderator | ops_admin | super_admin | head_admin |
|------------|-----------|-----------|-------------|------------|
| **User Management** |
| View users | ❌ | Limited | ❌ | ✅ |
| Edit user roles | ❌ | Limited | ❌ | ✅ |
| Create admin accounts | ❌ | ❌ | ❌ | ✅ |
| Suspend/ban users | ✅ | ✅ | ✅ | ✅ |
| Delete users | ❌ | ❌ | ❌ | ✅ |
| Impersonate users | ❌ | ✅ | ✅ | ✅ |
| **Content Moderation** |
| Review recommendations | ✅ | ✅ | ✅ | ✅ |
| Moderate posts | ✅ | ✅ | ✅ | ✅ |
| Approve marketplace listings | ❌ | ✅ | ✅ | ✅ |
| **Geographic Management** |
| View county data | ❌ | ✅ | ✅ | ✅ |
| Edit county assignments | ❌ | ✅ | ✅ | ✅ |
| Manage Territory Managers | ❌ | ✅ | ✅ | ✅ |
| **Finance** |
| View finance ledger | ❌ | ❌ | ✅ | ✅ |
| Process payouts | ❌ | ❌ | ✅ | ✅ |
| Approve commissions | ❌ | ❌ | ✅ | ✅ |
| **Platform Settings** |
| View site settings | ❌ | Limited | ✅ | ✅ |
| Edit site settings | ❌ | ❌ | ✅ | ✅ |
| Manage feature flags | ❌ | ❌ | ✅ | ✅ |
| **Scout & AI** |
| View Scout insights | ❌ | ❌ | ✅ | ✅ |
| Edit system prompts | ❌ | ❌ | ✅ | ✅ |
| Configure AI monitoring | ❌ | ❌ | ✅ | ✅ |
| **Promotions** |
| View ads/prizes | ❌ | ✅ | ✅ | ✅ |
| Create promotions | ❌ | ❌ | ✅ | ✅ |
| Delete promotions | ❌ | ❌ | ✅ | ✅ |

---

## 9. DEPLOYMENT CHECKLIST

Before deploying admin changes:

### Security
- [ ] All admin routes protected with proper auth guards
- [ ] No sensitive data exposed in client-side code
- [ ] Rate limiting on admin endpoints
- [ ] Audit logging for destructive actions
- [ ] CSRF protection on state-changing endpoints

### Functionality
- [ ] All stub pages either implemented or removed
- [ ] Legacy admin panel fully migrated
- [ ] Role hierarchy properly enforced
- [ ] Impersonation exit mechanism working
- [ ] Error handling on all admin actions

### Data Integrity
- [ ] Admin actions logged to audit trail
- [ ] Destructive actions require confirmation
- [ ] Soft deletes where appropriate
- [ ] Rollback capability for critical changes

### Documentation
- [ ] This inventory document updated
- [ ] API endpoints documented
- [ ] Role permissions matrix current
- [ ] Admin onboarding guide written

---

## 10. SUMMARY STATISTICS

### Current State

**Frontend**:
- ✅ 21 admin page files
- ✅ 9 reusable admin components
- ✅ 17 fully working pages
- ⚠️ 3 partially working pages
- ⚠️ 1 legacy page (admin-panel.tsx)

**Backend**:
- ✅ 120+ admin API endpoints
- ✅ 4 admin route modules
- ⚠️ ~80% production-ready
- ⚠️ ~15% stub/partial
- ❌ ~5% non-functional

**Roles**:
- ✅ 4 admin roles defined
- ⚠️ Role hierarchy not enforced
- ⚠️ Permissions scattered across codebase

**Auth**:
- ✅ Auth middleware implemented
- ⚠️ Inconsistent patterns
- ✅ Frontend guards working

### Priority Fixes

1. **HIGH**: Create Bot Council Report page
2. **HIGH**: Migrate legacy admin panel tabs
3. **HIGH**: Wire real data to AI Monitoring
4. **MEDIUM**: Implement role hierarchy
5. **MEDIUM**: Standardize auth patterns
6. **LOW**: Remove/implement stub pages

---

## APPENDIX A: File Locations Quick Reference

### Frontend (Client)

```
client/src/
├── admin/
│   ├── superAdminNav.ts              ✅ Navigation config (source of truth)
│   ├── SuperAdminOSLayout.tsx        ✅ Shell layout
│   ├── SuperAdminLeftNav.tsx         ✅ Left nav component
│   └── AdminHeader.tsx               ✅ Header component
│
├── components/admin/
│   ├── FinanceLedgerPanel.tsx        ✅ Finance UI
│   ├── UIMonitoringDashboard.tsx     ⚠️ No data
│   ├── AICodeFixingDashboard.tsx     ⚠️ No data
│   ├── RoleImpersonation.tsx         ✅ Impersonation tool
│   ├── RoleSwitcher.tsx              ✅ Role switcher
│   └── UserRoleManager.tsx           ✅ Role editor
│
└── pages/
    ├── admin.tsx                     ✅ Shell + router
    ├── admin-users.tsx               ✅ User management
    ├── admin-geo-coverage.tsx        ✅ Geo coverage
    ├── admin-error-reports.tsx       ✅ Error reports
    ├── admin-testing-controls.tsx    ✅ Testing controls
    ├── admin-listings.tsx            ✅ Marketplace approval
    ├── admin-pricing-analytics.tsx   ⚠️ Stub
    ├── admin-panel.tsx               ⚠️ Legacy (tabs)
    ├── admin-promotions.tsx          ⚠️ Partial
    ├── admin-control.tsx             ❌ Stub
    ├── admin-authority-diagnostics.tsx ❌ Stub
    └── ... 10 more admin pages
```

### Backend (Server)

```
server/
├── routes.ts                         ✅ Main admin endpoints (60+)
│
├── routes/
│   ├── admin.ts                      ✅ Core admin routes (40+)
│   ├── admin-community-builder-routes.ts ✅ CB admin (14 endpoints)
│   ├── authority-operations.ts       ⚠️ Authority admin
│   ├── admin-control-routes.ts       ❌ Stub
│   ├── notification-routes.ts        ✅ Notification admin
│   └── admin/
│       └── ui-issues.ts              ⚠️ UI monitoring (no data)
│
└── middleware/
    └── (inline in routes.ts)
        ├── isAdmin()                 ✅ Any admin check
        ├── isSuperAdmin()            ✅ Super/head admin check
        ├── requireRole()             ✅ Specific role check
        └── requireAdmin()            ✅ Any admin check
```

### Database

```
shared/schema.ts
  ├── userRoleEnum                    ✅ 4 admin roles defined
  ├── users table                     ✅ role column
  ├── featureFlags table              ✅ Admin-controlled
  ├── siteSettings table              ✅ Admin-controlled
  ├── errorReports table              ✅ Admin visibility
  ├── countyNotes table               ✅ Admin-only writes
  └── countyEntities table            ✅ Admin assignments
```

---

**END OF COMPREHENSIVE ADMIN INVENTORY**

This document covers every admin-related component, route, role, guard, and database table in TradeScout. Use as master reference for:
- Understanding admin architecture
- Planning admin feature work
- Debugging auth issues
- Onboarding new admin developers
- Security audits
- Role permission reviews
