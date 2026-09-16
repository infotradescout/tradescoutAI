import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';

export const VIEWPORTS = Object.freeze([
  { name: 'desktop', width: 1440, height: 1000 },
  { name: 'mobile', width: 390, height: 844 },
]);
// Identity/verification fixtures, NOT implied provider approval or supplier access.
export const PERSONAS = Object.freeze([
  { name: 'new-user', role: 'homeowner', onboarding: false, emailVerified: false, addressVerified: false },
  { name: 'unverified-homeowner', role: 'homeowner', addressVerified: false },
  { name: 'homeowner', role: 'homeowner' },
  { name: 'other-homeowner', role: 'homeowner' },
  { name: 'other-county', role: 'homeowner', countyFips: '12001' },
  { name: 'buyer', role: 'homeowner' },
  { name: 'seller', role: 'homeowner' },
  { name: 'property-manager', role: 'property_manager' },
  { name: 'contractor-account', role: 'contractor_user' },
  { name: 'unverified-contractor', role: 'contractor_user', addressVerified: false },
  { name: 'business-owner', role: 'business_owner' },
  // Community participation uses an ordinary personal account, not a new role.
  { name: 'community-member', role: 'homeowner' },
  { name: 'support-agent', role: 'support_agent' },
  { name: 'operations-admin', role: 'ops_admin' },
  { name: 'super-admin', role: 'super_admin' },
].map(persona => Object.freeze({ onboarding: true, emailVerified: true,
  addressVerified: true, countyFips: '12033', ...persona })));

export const IMPLEMENTED_ACCOUNT_JOURNEYS = Object.freeze([
  'correct-password-owner', 'wrong-password-denied', 'session-reload-owner',
  'private-work-owner-override', 'private-work-response-shape',
  'scout-browser-entry', 'logout-private-work-denied',
]);

// Explicitly NOT promoted to passed by a login, a route load or another suite.
// These require the owning workflow's native fixtures and observable outcomes.
export const REMAINING_JOURNEYS = Object.freeze([
  ['signup', 'claims-first registration, duplicate identity and incomplete onboarding'],
  ['password-reset', 'reset delivery, token expiry, reuse rejection and real login afterward'],
  ['email-verification', 'verification token delivery, expiry and account update'],
  ['scout-planning', 'multi-turn scope, budget and selected-record continuity'],
  ['scout-request-create', 'real modal create/cancel, duplicate clicks and lost response'],
  ['scout-request-resume', 'saved request restored into conversation and approved next action'],
  ['scout-profile-actions', 'approved save, cancellation, uncertainty and durable replay'],
  ['saved-conversations', 'create, restore, rename, delete and other-owner denial'],
  ['direct-connect-lifecycle', 'draft, submit, routing, response, assignment and closure'],
  ['contact-gates', 'intent, decision, consent, release and premature-contact denial'],
  ['messaging', 'authorized send, thread read, attachments and cross-owner denial'],
  ['notifications', 'delivery sink, unread counts, mark read and preferences'],
  ['community', 'county post, reply, edit, delete, report and global-action denial'],
  ['exchange', 'single listing, images, edit, draft, publish and removal'],
  ['exchange-batch', 'CSV and multi-image matching, validation, partial failure and duplicate prevention'],
  ['business-profiles', 'ownership, public card, edit, publish and hidden fields'],
  ['bookings', 'booking request, owner response, cancellation and duplicate handling'],
  ['home-vault', 'home create, evidence upload, access control and ownership transfer'],
  ['home-projects', 'project create, scope update, progress and completion'],
  ['supply-runs', 'draft, quote, approval, purchasing handoff, delivery and failure'],
  ['cabinet-design', 'dimensions, constraints, layout, save, restore and material list'],
  ['countertop-design', 'measurements, cutouts, slab constraints, save and quote handoff'],
  ['other-design-tools', 'flooring, metal-building and home-design owned capabilities'],
  ['quotes-invoices', 'create, revise, deliver to test recipient, accept and cancellation'],
  ['payment-sandbox', 'test checkout, declined payment, webhook replay and refund'],
  ['jw-employee', 'manual employee grant, inventory capture, dimensions, pricing and revocation'],
  ['jw-memberships', 'pending, active, rejected and revoked fabricator membership'],
  ['jw-cart', 'restricted prices, stock/hold checks, cart, delivery and checkout handoff'],
  ['admin-operations', 'scope-restricted moderation and operational actions; unauthorized denial'],
  ['account-switch', 'same-browser logout/login with no former-account cached data'],
  ['uploads', 'valid images/documents, invalid type/size, interrupted upload and cleanup'],
  ['accessibility', 'keyboard, focus, names, touch targets and screen-reader state changes'],
  ['network-recovery', 'offline, timeout, server error and stale data in every owning flow'],
  ['rate-limits', 'real throttling, safe errors and recovery without bypass'],
].map(([id, requirement]) => Object.freeze({ id, requirement, state: 'not_run' })));

export function buildAccounts(runId = randomBytes(8).toString('hex')) {
  assert.match(runId, /^[a-f0-9]{16}$/, 'A fresh opaque smoke run identity is required');
  return VIEWPORTS.flatMap(viewport => PERSONAS.map(persona => ({
    ...persona, viewport: { ...viewport }, id: randomUUID(), runId,
    email: `smoke-${runId}-${persona.name}-${viewport.name}@example.invalid`,
    password: randomBytes(24).toString('hex'),
  })));
}

export function publicAccount(account) {
  // Never spread credentials, session cookies or tokens into a report.
  return { id: account.id, persona: account.name, role: account.role,
    viewport: account.viewport.name, countyFips: account.countyFips,
    onboarding: account.onboarding, emailVerified: account.emailVerified,
    addressVerified: account.addressVerified };
}

export function validateNativeTarget({ base, environment, databaseName, serverAddress, proofTable }) {
  assert.equal(base, 'https://127.0.0.1:5448', 'Only the existing disposable loopback harness is allowed');
  const db = new URL(environment.DATABASE_URL);
  assert(['postgres:', 'postgresql:'].includes(db.protocol));
  assert(['127.0.0.1', 'localhost', '[::1]'].includes(db.hostname));
  assert.equal(decodeURIComponent(db.pathname.slice(1)), 'cabinet_placement_test');
  assert.equal(databaseName, 'cabinet_placement_test');
  assert(['127.0.0.1', '::1'].includes(serverAddress));
  assert.equal(proofTable, true, 'The native harness proof fixture must already exist');
  for (const key of ['MASTER_ADMIN_EMAIL', 'MASTER_ADMIN_PASSWORD', 'STRIPE_SECRET_KEY',
    'SENDGRID_API_KEY', 'RESEND_API_KEY', 'TWILIO_AUTH_TOKEN', 'GEMINI_API_KEY', 'OPENAI_API_KEY']) {
    assert(!environment[key], `${key} must not be inherited by the account matrix`);
  }
}

export function newLedger(commit) {
  assert.match(commit, /^[a-f0-9]{40}$/);
  return { contract: 'scout_smoke_accounts.v1', commit, startedAt: new Date().toISOString(),
    accountsCreated: 0, provisioningOutcome: 'not_started', accounts: [], cases: [], browserJourneysExecuted: 0,
    remaining: REMAINING_JOURNEYS.map(item => ({ ...item })),
    allPossibleInteractionsCovered: false, coreMatrixPassed: false };
}

export function recordCase(ledger, actor, journey, assertionCount, error) {
  assert(IMPLEMENTED_ACCOUNT_JOURNEYS.includes(journey));
  assert(PERSONAS.some(persona => persona.name === actor.name && persona.role === actor.role));
  assert(VIEWPORTS.some(viewport => viewport.name === actor.viewport.name));
  const id = `${actor.viewport.name}:${actor.name}:${journey}`;
  assert(!ledger.cases.some(item => item.id === id), 'Duplicate case evidence is forbidden');
  assert(Number.isSafeInteger(assertionCount) && assertionCount >= 0);
  // An executed callback with zero positive assertions cannot be a passing test.
  const passed = error === undefined && assertionCount > 0;
  ledger.cases.push({ id, persona: actor.name, viewport: actor.viewport.name,
    journey, passed, assertions: assertionCount,
    ...(error !== undefined ? { error: String(error) } : !passed ? { error: 'No outcome assertions recorded' } : {}) });
}

export function finishLedger(ledger) {
  const expected = PERSONAS.length * VIEWPORTS.length * IMPLEMENTED_ACCOUNT_JOURNEYS.length;
  ledger.totals = { expected, executed: ledger.cases.length,
    passed: ledger.cases.filter(item => item.passed).length,
    failed: ledger.cases.filter(item => !item.passed).length,
    missing: Math.max(0, expected - ledger.cases.length) };
  ledger.coreMatrixPassed = !ledger.setupError && ledger.provisioningOutcome === 'confirmed' &&
    ledger.accountsCreated === PERSONAS.length * VIEWPORTS.length &&
    ledger.accounts.length === PERSONAS.length * VIEWPORTS.length &&
    ledger.totals.executed === expected && ledger.totals.failed === 0 &&
    ledger.browserJourneysExecuted === PERSONAS.length * VIEWPORTS.length;
  ledger.finishedAt = new Date().toISOString();
  return ledger;
}
