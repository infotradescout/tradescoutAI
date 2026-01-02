# Data-TestId Implementation Roadmap

## Overview

Bot Army tests are **100% ready to run** once UI components include `data-testid` attributes. This document maps exactly which components need which data-testids.

**Status**: Tests complete → Waiting for data-testid additions to UI components

---

## 🚨 Critical (Mission Invariants - Must Have)

These prevent tests from even running correctly:

### Business Profile View
```tsx
// bp-mission: CRITICAL - Tests mission invariant
<section data-testid="bp-mission">
  {businessProfile.mission}
</section>

// bp-contact-cta: CRITICAL - Tests engagement availability  
<button data-testid="bp-contact-cta" onClick={openContactForm}>
  Contact / Connect
</button>
```

**Impact**: Without these, mission invariant tests will fail immediately  
**Affected Tests**: All 5 anonymous_business_profile tests

---

## 👤 Authentication (7 Tests)

### Login Page
```tsx
// /login
<button data-testid="login-google" onClick={loginWithGoogle}>
  Sign in with Google
</button>

<button data-testid="login-facebook" onClick={loginWithFacebook}>
  Sign in with Facebook
</button>

<input data-testid="login-email" type="email" placeholder="Email" />
<input data-testid="login-password" type="password" placeholder="Password" />
<button data-testid="login-submit">Sign In</button>

<a data-testid="forgot-password" href="/forgot-password">
  Forgot password?
</a>
```

### Create Account Page
```tsx
// /create-account
<button data-testid="auth-google" onClick={signupWithGoogle}>
  Sign up with Google
</button>

<button data-testid="auth-facebook" onClick={signupWithFacebook}>
  Sign up with Facebook
</button>

<input data-testid="signup-name" type="text" placeholder="Full Name" />
<input data-testid="signup-email" type="email" placeholder="Email" />
<input data-testid="signup-password" type="password" placeholder="Password" />
<button data-testid="signup-submit">Create Account</button>

<a data-testid="have-account" href="/login">
  Already have an account? Sign in
</a>
```

**Affected Tests**: `auth_buttons_present.spec.ts` (7 tests)

---

## ✏️ Business Profile Editor (6 Tests)

### Editor Form
```tsx
// Profile editor page (when owner clicks edit)
<div data-testid="bpe-form">
  <input 
    data-testid="bpe-headline"
    value={headline}
    placeholder="Your headline"
  />
  
  <button 
    data-testid="copyassist-open-headline"
    onClick={openCopyAssist}
    title="Get AI help"
  >
    ✨ Improve
  </button>

  <textarea 
    data-testid="bpe-description"
    value={description}
    placeholder="Tell your story..."
  />

  <div data-testid="bpe-services">
    {services.map((service, i) => (
      <input 
        key={i}
        data-testid={`bpe-service-${i}`}
        value={service}
      />
    ))}
  </div>

  <button data-testid="bpe-services-add">+ Add Service</button>

  <div data-testid="bpe-dirty-indicator" style={{ display: isDirty ? 'block' : 'none' }}>
    ● Unsaved changes
  </div>

  <button 
    data-testid="bpe-save"
    onClick={saveProfile}
    disabled={!isDirty}
  >
    Save Changes
  </button>

  <button 
    data-testid="bpe-discard"
    onClick={discardChanges}
  >
    Discard
  </button>
</div>
```

**Affected Tests**: `copy_assist_injects_no_autosave.spec.ts` (6 tests)

---

## 🤖 Copy Assist Modal (6 Tests)

### Modal Component
```tsx
// Opens when user clicks "Improve" buttons
<div data-testid="copyassist-modal" style={{ display: isOpen ? 'block' : 'none' }}>
  <div className="modal-header">
    <h2>AI-Powered Copy Variants</h2>
    <button 
      data-testid="copyassist-close"
      onClick={closeModal}
      aria-label="Close"
    >
      ✕
    </button>
  </div>

  <div className="modal-body">
    <div data-testid="copyassist-variant-safe" className="variant-card">
      <h3>Safe Approach</h3>
      <p>{safeVariant.text}</p>
      <button data-testid="copyassist-use-safe" onClick={useSafe}>
        Use This Version
      </button>
    </div>

    <div data-testid="copyassist-variant-growth" className="variant-card">
      <h3>Growth-Focused</h3>
      <p>{growthVariant.text}</p>
      <button data-testid="copyassist-use-growth" onClick={useGrowth}>
        Use This Version
      </button>
    </div>

    {isLoading && <div data-testid="copyassist-loading">Generating variants...</div>}
  </div>
</div>

// Open buttons in editor
<button data-testid="copyassist-open-services" onClick={() => openCopyAssist('services')}>
  ✨ Services
</button>

<button data-testid="copyassist-open-description" onClick={() => openCopyAssist('description')}>
  ✨ Description
</button>
```

**Affected Tests**: `copy_assist_injects_no_autosave.spec.ts` (6 tests)

---

## 💬 Direct Connect / Contact Form (7 Tests)

### Contact Form Modal
```tsx
// Opens when user clicks "Contact" on business profile
<div data-testid="dc-form" style={{ display: isOpen ? 'block' : 'none' }}>
  <div className="modal-header">
    <h2>Get in Touch</h2>
    <button 
      data-testid="dc-close"
      onClick={closeForm}
      aria-label="Close"
    >
      ✕
    </button>
  </div>

  <form>
    <input
      data-testid="dc-name"
      type="text"
      placeholder="Your Name"
      value={name}
      onChange={(e) => setName(e.target.value)}
      required
    />

    <input
      data-testid="dc-email"
      type="email"
      placeholder="Your Email"
      value={email}
      onChange={(e) => setEmail(e.target.value)}
      required
    />

    <input
      data-testid="dc-phone"
      type="tel"
      placeholder="Phone (optional)"
      value={phone}
      onChange={(e) => setPhone(e.target.value)}
    />

    <textarea
      data-testid="dc-message"
      placeholder="Your message..."
      value={message}
      onChange={(e) => setMessage(e.target.value)}
      required
    />

    <button 
      data-testid="dc-submit"
      type="submit"
      disabled={isSubmitting}
    >
      {isSubmitting ? 'Sending...' : 'Send Message'}
    </button>
  </form>

  {showSuccess && (
    <div data-testid="dc-success" className="success-message">
      ✅ Message sent! You'll hear back soon.
    </div>
  )}

  {errorMessage && (
    <div data-testid="dc-error" className="error-message">
      {errorMessage}
    </div>
  )}
</div>
```

**Affected Tests**: `contact_loop.spec.ts` (7 tests)

---

## 🌍 Business Profile View (5 Tests)

### Profile Display
```tsx
// /business/:slug page (public view)
<div className="business-profile">
  <h1 data-testid="bp-title">{business.name}</h1>
  
  <p data-testid="bp-mission">{business.mission}</p>
  
  <h2 data-testid="bp-headline">{business.headline}</h2>
  
  <p data-testid="bp-description">{business.description}</p>
  
  <div data-testid="bp-services">
    {business.services.map((service) => (
      <span key={service}>{service}</span>
    ))}
  </div>

  {isOwner && (
    <button data-testid="bp-edit" onClick={goToEditor}>
      Edit Profile
    </button>
  )}

  {!isOwner && (
    <button data-testid="bp-contact-cta" onClick={openContactForm}>
      Get in Touch
    </button>
  )}
</div>
```

**Affected Tests**: `anonymous_business_profile.spec.ts` (5 tests)

---

## 🏛️ Common Elements

```tsx
// Navigation
<button data-testid="nav-logo" onClick={() => navigate('/')}>
  TradeScout
</button>

// Loading states
<div data-testid="loading">Loading...</div>

// Error handling
<div data-testid="error-alert">{error.message}</div>
<div data-testid="not-found">Profile not found</div>

// Admin
<div data-testid="admin-panel">
  {/* Admin controls */}
</div>

// Scout (primary control plane)
<div data-testid="scout-chat">
  {/* Scout AI chat */}
</div>
```

---

## 📋 Implementation Checklist

### High Priority (Blocks tests)
- [ ] `bp-mission` - Business profile mission statement
- [ ] `bp-contact-cta` - Contact button
- [ ] `login-google`, `login-facebook` - Auth buttons
- [ ] `signup-*` - Account creation inputs
- [ ] `copyassist-open-headline`, `copyassist-modal`, `copyassist-use-safe`, `copyassist-use-growth`
- [ ] `dc-form`, `dc-*` (name, email, phone, message, submit, success)
- [ ] `bpe-*` (headline, services, description, save, dirty-indicator, discard)

### Medium Priority (Recommended)
- [ ] Auth page links: `forgot-password`, `have-account`
- [ ] Editor buttons: `copyassist-open-services`, `copyassist-open-description`
- [ ] Common: `loading`, `error-alert`, `not-found`

### Low Priority (Nice to have)
- [ ] Navigation: `nav-logo`
- [ ] Admin: `admin-panel`
- [ ] Chat: `scout-chat`

---

## 🚀 Implementation Strategy

### Option A: Full Implementation (Recommended)
Add all data-testids at once, then run full test suite

**Pros**: Complete coverage, ready for CI/CD  
**Time**: 2-4 hours  
**Order**: Start with Critical, then Medium/Low

### Option B: Phased Implementation
1. Phase 1: Critical data-testids → Run anonymous_business_profile tests
2. Phase 2: Auth + Copy Assist → Run all journey tests except contact
3. Phase 3: Contact form → Run complete test suite
4. Phase 4: Common elements → Full coverage

**Pros**: Incremental validation  
**Time**: Same total, but spreads across multiple PRs

### Option C: Parallel Implementation
While tests run, add data-testids in separate branch, then merge

**Pros**: No blocking  
**Time**: No added time (parallel work)

---

## ✅ Verification Steps

After adding each data-testid:

```bash
# 1. Add data-testid to component
# Example: <h1 data-testid="bp-headline">{headline}</h1>

# 2. Run specific test
npx playwright test tests/journeys/anonymous_business_profile.spec.ts

# 3. Check console for results
# Should see: "✓ should display headline and services summary"

# 4. Once all data-testids added, run full suite
npm run test:e2e
```

---

## 📊 Progress Tracking

| Area | Tests | Data-TestIds | Status |
|------|-------|--------------|--------|
| Auth | 7 | 12 | ⏳ Pending |
| Profile View | 5 | 8 | ⏳ Pending |
| Copy Assist | 6 | 8 | ⏳ Pending |
| Contact | 7 | 8 | ⏳ Pending |
| Model-Based | 3 | Reuses above | ⏳ Pending |
| **TOTAL** | **28** | **44+** | ⏳ Pending |

---

## 🎯 Success Criteria

✅ All 44+ data-testids added to components  
✅ `npm run test:e2e` runs and passes  
✅ HTML report generated successfully  
✅ No test timeouts or "element not found" errors  
✅ All mission invariants verified  

---

## 📞 Questions?

- **Where should this data-testid go?** → Check selector location in [selectors.ts](./tests/utils/selectors.ts)
- **Is this data-testid correct?** → Match the selector string exactly (e.g., `data-testid="bp-mission"`)
- **Can I remove this data-testid later?** → Not without updating tests. Keep them permanent.
- **Will this affect production?** → No, data-testid attributes don't affect styling or functionality.

---

**Status**: Tests Ready | Components: Awaiting Data-TestIds | Timeline: ~4 hours to full implementation

Once data-testids are added, Bot Army will automatically:
- ✅ Run on every push to main/develop
- ✅ Run on every PR
- ✅ Run nightly at 3am UTC
- ✅ Generate reports and upload artifacts
- ✅ Comment on PRs with results
