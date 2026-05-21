# Bot Army - Quick Reference

Status: historical runbook reference
Owner: QA/Automation
Last verified: 2026-05-20
Roadmap authority: docs/TRADESCOUT_MASTER_PLAN.md

## 🚀 Get Started in 5 Minutes

### 1. Setup Environment
```bash
cp tests/.env.example tests/.env
# Edit .env with your system agent credentials (non-human, claims-first):
# - BASE_URL=http://localhost:5000
# - AGENT_IDENTITY_EMAIL=agent@example.com
# - AGENT_IDENTITY_SECRET=your_agent_secret
# - AGENT_TYPE=bot_operator
# - AGENT_CLAIMS=post,observe,seed
# - AGENT_SCOPE_SLUG=your-scope-slug
```

### 2. Start Server
```bash
npm run dev
```

### 3. Run Tests
```bash
# In another terminal:
npm run test:e2e
```

### 4. View Results
```bash
npm run test:e2e:report
```

---

## 📋 Common Commands

| Command | Purpose |
|---------|---------|
| `npm run test:e2e` | Run all tests |
| `npm run test:e2e:debug` | Interactive debug mode |
| `npm run test:e2e:report` | Open Playwright HTML report |
| `npm run test:e2e:report:bot-army` | Generate Bot Army custom report |
| `npx playwright test --ui` | Run with UI (live view) |
| `npx playwright test tests/journeys/auth_buttons_present.spec.ts` | Run single test file |

---

## 🎯 What Gets Tested

### Anonymous User Flows
- View business profile without login ✅
- See mission statement ✅
- Access contact form ✅

### Authentication
- Google login/signup buttons ✅
- Facebook login/signup buttons ✅
- Email form fallback ✅

### Copy Assist
- Open modal from editor ✅
- Inject Safe variant ✅
- Inject Growth variant ✅
- No auto-save on inject ✅

### Contact Loop
- Click Contact CTA ✅
- Fill out form ✅
- Submit message ✅
- See success message ✅

### Mission Invariants
- Mission always visible ✅
- Contact CTA always available ✅
- No stub/placeholder content ✅
- No 404 errors on core pages ✅

---

## ⚠️ Troubleshooting

### "BASE_URL is required but not set in .env"
→ Create `tests/.env` and add your configuration

### "Element not found: [data-testid="bp-mission"]"
→ Add `data-testid="bp-mission"` to your mission statement component

### "Timeout waiting for element"
→ Element may not exist in DOM or selector is incorrect. Check console for errors.

### "Test failed: Stub content detected"
→ UI contains "TODO", "coming soon", "placeholder", etc. that shouldn't be visible

### Server connection refused
→ Make sure server is running: `npm run dev`

---

## 📊 Test Statistics

| Metric | Count |
|--------|-------|
| Total Tests | 28 |
| Journey Tests | 25 |
| Model-Based Tests | 3 |
| Data-TestId Selectors | 100+ |
| Expected Duration | ~2 minutes |

---

## 🔐 GitHub Secrets (for CI/CD)

Add these to your repository settings for automatic CI runs:

```
AGENT_IDENTITY_EMAIL=agent@example.com
AGENT_IDENTITY_SECRET=your_agent_secret
AGENT_TYPE=bot_operator
AGENT_CLAIMS=post,observe,seed
AGENT_SCOPE_SLUG=your-scope-slug
```

Once added, tests automatically run on:
- Every push to `main` or `develop`
- Every pull request
- Nightly at 3am UTC

---

## 📁 Key Files

| File | Purpose |
|------|---------|
| `tests/.env.example` | Environment template |
| `tests/utils/selectors.ts` | All UI selectors |
| `tests/journeys/*.spec.ts` | User flow tests |
| `tests/model/flow_runner.spec.ts` | Random walk testing |
| `playwright.config.ts` | Test configuration |
| `.github/workflows/bot-army.yml` | CI/CD automation |
| `tests/README.md` | Full documentation |

---

## ✅ Pre-PR Checklist

Before submitting a pull request:

```bash
# 1. Run tests locally
npm run test:e2e

# 2. Check for failures
npm run test:e2e:report

# 3. Verify no new issues
# Look for:
# - Red X failures (fix or skip)
# - Trust leaks (remove stub content)
# - Unfinished UI (complete implementation)

# 4. If tests pass, you're good to go!
# CI will run again on push
```

---

## 🤖 Understanding Bot Army

**What it does:**
- Automatically tests core TradeScout features
- Verifies mission invariants (mission visible, contact available)
- Detects stub/placeholder content
- Captures errors and network issues
- Generates reports on success/failure

**Why it matters:**
- Catches regressions before they reach users
- Ensures "Connection Without Compromise" always works
- Validates production-readiness of new features
- Provides evidence of quality in CI/CD

**How it works:**
- Tests anonymous and authenticated flows
- Uses seeded random walk for comprehensive coverage
- Monitors network and console for errors
- Generates HTML reports for analysis

---

## 🆘 Need Help?

1. **Check [tests/README.md](./tests/README.md)** - Full documentation
2. **Review [selector registry](./tests/utils/selectors.ts)** - All data-testids
3. **Look at existing tests** - Copy pattern from similar test
4. **Check CI logs** - GitHub Actions shows full output

---

## 💡 Pro Tips

- **Faster feedback**: Use `npm run test:e2e:debug` for interactive testing
- **Debug failures**: Check Playwright report videos/screenshots
- **Fix flakiness**: Add explicit waits: `await page.waitForNavigation()`
- **Reproducible failures**: Use `TEST_SEED=12345` to replay exact flow
- **Local vs CI**: Tests work same locally and in GitHub Actions (no flaky CI-only fails)

---

## 📞 Support

- **Questions?** → Check tests/README.md
- **Bug report?** → Check playwright-report/ artifacts
- **New test?** → Copy existing pattern and update selectors.ts
- **Data-testid missing?** → Add it to component and update selectors.ts

---

**Last Updated: 2024 | Status: Production Ready | Maintainer: TradeScout Engineering**
