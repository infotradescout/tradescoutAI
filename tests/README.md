# Bot Army - TradeScout Regression Test Suite

🤖 Comprehensive Playwright-based E2E testing framework for TradeScout with mission invariant enforcement and trust leak detection.

## Overview

**Bot Army** is the automated regression testing harness that ensures TradeScout maintains its core mission invariants across releases:

- ✅ **Connection Without Compromise**: Mission statement always visible on business profiles
- ✅ **No Stub/Placeholder Content**: All UI surfaces are complete and production-ready
- ✅ **Trust Verification**: No "TODO", "coming soon", or mock data reaches users
- ✅ **Deterministic Testing**: Seeded random walks for reproducible failure analysis
- ✅ **Network Monitoring**: Captures console errors and failed requests for debugging

## Quick Start

### 1. Environment Setup

Create a `.env` file in the `tests/` directory:

```bash
cp tests/.env.example tests/.env
```

Configure with your system agent credentials (claims-first, non-human):

```env
BASE_URL=http://localhost:5000
AGENT_IDENTITY_EMAIL=test.agent@example.com
AGENT_IDENTITY_SECRET=your_agent_secret_here
AGENT_TYPE=bot_operator
AGENT_CLAIMS=post,observe,seed
AGENT_SCOPE_SLUG=your-scope-slug
DEBUG=false
TEST_SEED=12345
```

### 2. Run Tests Locally

```bash
# Install dependencies (if not already done)
npm install

# Start the development server
npm run dev

# In another terminal, run all tests
npm run test:e2e

# Run with UI (interactive mode)
npm run test:e2e:debug

# Run specific test file
npx playwright test tests/journeys/anonymous_business_profile.spec.ts

# Run with specific browser
npx playwright test --project=chromium
```

### 3. View Results

```bash
# Open HTML report
npm run test:e2e:report

# Generate Bot Army custom report
npm run test:e2e:report:bot-army
```

## Test Structure

### Journey Tests (`tests/journeys/`)

**Real user flows** that exercise core TradeScout features:

- **anonymous_business_profile.spec.ts**: Anonymous user views business profile
  - Mission element is visible (core invariant)
  - Contact CTA is present and clickable
  - No edit controls visible to non-owner

- **auth_buttons_present.spec.ts**: OAuth buttons work on auth pages
  - Google and Facebook login/signup buttons are present
  - OAuth flows are accessible (not stubbed)
  - Email form alternative is available

- **copy_assist_injects_no_autosave.spec.ts**: Copy Assist variant injection
  - Modal opens and closes properly
  - Variants inject without auto-saving
  - Dirty indicator shows when changed
  - No side effects from test interaction

- **contact_loop.spec.ts**: Full contact journey
  - Contact CTA opens contact form
  - Form fields accept input
  - Submission works and shows success
  - Graceful error handling

### Model-Based Testing (`tests/model/`)

**Deterministic random walk** exploring state space while enforcing invariants:

- **flow_runner.spec.ts**: 25-step random walk
  - Seeded RNG for reproducible failures
  - Validates mission invariants across flows
  - Detects stub content automatically
  - Captures network errors and console messages
  - Non-blocking error reporting (warnings vs. violations)

### Utilities (`tests/utils/`)

**Shared testing infrastructure**:

- **env.ts**: Environment variable loader with validation
  - Validates required vars (BASE_URL, AGENT_IDENTITY_*, AGENT_SCOPE_SLUG)
  - Clear error messages if config missing
  - Type-safe access to all settings

- **selectors.ts**: Centralized data-testid definitions
  - 100+ selectors organized by feature area
  - Helper function: `hasStubContent()` for stub detection
  - Dynamic selectors for indexed elements

- **networkWatch.ts**: Console and network error capture
  - Captures failed requests and status codes
  - Logs console errors and uncaught exceptions
  - Attaches errors to test info for artifact storage
  - Helper methods for debugging

### Report Generation (`tests/report/`)

- **generate_report.ts**: HTML report aggregator
  - Reads Playwright test results
  - Categorizes failures: Hard Failures, Trust Leaks, Unfinished UI
  - Generates interactive HTML report with pass rates
  - Integrates with CI for artifact storage

## CI/CD Integration

### GitHub Actions (`.github/workflows/bot-army.yml`)

**Automatic execution**:
- Runs on every `push` to main/develop
- Runs on every PR
- Nightly schedule at 3am UTC

**Artifacts**:
- Playwright HTML report
- Bot Army custom report
- Test videos and screenshots on failure
- JUnit XML for integrations

**Secrets Required**:
```
AGENT_IDENTITY_EMAIL
AGENT_IDENTITY_SECRET
AGENT_SCOPE_SLUG
```

### Local Pre-commit

Add to your pre-commit hook:

```bash
npm run test:e2e:report:bot-army
```

## Data-TestId Requirements

For tests to pass, UI components must include `data-testid` attributes:

### Authentication
- `data-testid="login-google"`, `data-testid="login-facebook"`
- `data-testid="signup-name"`, `data-testid="signup-email"`, `data-testid="signup-password"`
- `data-testid="forgot-password"`, `data-testid="have-account"`

### Business Profile
- `data-testid="bp-mission"` (CRITICAL - mission invariant)
- `data-testid="bp-headline"`, `data-testid="bp-description"`
- `data-testid="bp-contact-cta"` (CRITICAL - engagement CTA)

### Copy Assist
- `data-testid="copyassist-open-headline"` / `-services` / `-description`
- `data-testid="copyassist-modal"`
- `data-testid="copyassist-use-safe"` / `-use-growth`

### Direct Connect
- `data-testid="dc-form"`
- `data-testid="dc-name"`, `data-testid="dc-email"`, `data-testid="dc-phone"`, `data-testid="dc-message"`
- `data-testid="dc-submit"`, `data-testid="dc-success"`

See [selectors.ts](./utils/selectors.ts) for complete list.

## Trust Leaks Detection

Tests automatically flag "stub" content—unfinished UI that should not reach users:

### Detected Patterns
- "TODO", "coming soon"
- "placeholder", "stub"
- "unimplemented", "WIP"
- "fixture", "mock", "sample"

### Example Failure

```
Trust Leak: Unfinished UI surface detected on /business/test-biz
  - Expected: Real mission statement
  - Found: "TODO: Add mission statement"
```

This is treated as a **blocking violation** (test fails automatically).

## Seeded RNG for Model-Based Testing

Flow runner uses deterministic seeding:

```bash
# Run with specific seed for reproducible failures
TEST_SEED=12345 npm run test:e2e

# Default: uses current timestamp as seed (new seed each run)
npm run test:e2e
```

This enables:
- Capturing exact failure sequences for debugging
- Comparing before/after regression analysis
- Recording failures for later investigation

## Troubleshooting

### Tests Won't Run: Missing .env

```
Error: BASE_URL is required but not set in .env
```

**Solution**: Create `tests/.env` with required variables (see Quick Start).

### Tests Won't Run: Server Not Ready

```
Error: Could not connect to http://localhost:5000
```

**Solution**: Ensure server is running before tests:
```bash
npm run dev    # Terminal 1
npm run test:e2e  # Terminal 2 (after server starts)
```

### Tests Flaking: Async Timing Issues

Add explicit waits:
```typescript
await page.waitForNavigation({ url: /\/dashboard/ });
await page.waitForTimeout(500); // Use sparingly
```

### Tests Failing: Data-TestId Missing

If selectors can't find elements:
1. Check [selectors.ts](./utils/selectors.ts) for correct selector name
2. Add `data-testid` attribute to UI component
3. Verify selector matches component's testid

## Mission Invariants (Non-negotiable)

These must **never** fail or be skipped:

1. **Mission Visible**: `selectors.businessProfileView.mission` must be visible on business profile
2. **Contact CTA Available**: `selectors.businessProfileView.contactCTA` must be clickable
3. **No Stubs**: No "TODO", "coming soon", or placeholder text reaches users
4. **No 404s**: Core pages must return 2xx or 3xx status codes

## Performance Targets

- Individual journey tests: < 10s each
- Flow runner (25 steps): < 30s
- Full suite (13 tests): < 2 minutes

## Contributing

When adding new tests:

1. Create `.spec.ts` file in appropriate `tests/journeys/` or `tests/model/` directory
2. Import `NetworkWatcher` and attach errors to `testInfo`
3. Use centralized selectors from `selectors.ts`
4. Add `data-testid` to UI components as needed
5. Run locally: `npm run test:e2e`
6. PR will run tests in CI automatically

Example test template:

```typescript
import { test, expect } from '@playwright/test';
import { env } from '../utils/env';
import { selectors } from '../utils/selectors';
import { NetworkWatcher } from '../utils/networkWatch';

test.describe('Feature Name', () => {
  let networkWatcher: NetworkWatcher;

  test.beforeEach(async ({ page }) => {
    networkWatcher = new NetworkWatcher(page);
  });

  test('should do something', async ({ page }, testInfo) => {
    try {
      await page.goto(`${env.BASE_URL}/page`);
      // Your test here
      expect(true).toBe(true);
    } finally {
      networkWatcher.attachToTestInfo(testInfo);
    }
  });

  test.afterEach(({ testInfo }) => {
    if (testInfo.status !== 'passed') {
      networkWatcher.logErrors();
    }
  });
});
```

## Resources

- [Playwright Docs](https://playwright.dev)
- [TradeScout Copilot Instructions](../../.github/copilot-instructions.md)
- [Selector Registry](./utils/selectors.ts)
- [Environment Configuration](../.env.example)

---

**Last Updated**: 2024 | **Maintainer**: TradeScout Engineering | **Status**: Production-Ready
