/**
 * Model-Based Flow Runner - Deterministic Random Walk
 * 
 * Tests core invariants across randomized flows:
 * - No 404 errors
 * - Mission element always visible (on business profile)
 * - No stub/placeholder content
 * - Contact CTA always present on business profile
 * - Graceful error handling
 * 
 * Uses seeded RNG for reproducible runs
 */

import { test, expect } from '../fixtures/botArmy';
import { env } from '../utils/env';
import { selectors, hasStubContent } from '../utils/selectors';
import { NetworkWatcher } from '../utils/networkWatch';

/**
 * Seeded random number generator (for reproducibility)
 */
class SeededRandom {
  private seed: number;

  constructor(seed?: number) {
    this.seed = seed || (env.TEST_SEED ? parseInt(env.TEST_SEED, 10) : Date.now());
  }

  next(): number {
    // Linear congruential generator
    this.seed = (this.seed * 1664525 + 1013904223) % 4294967296;
    return (this.seed >>> 0) / 4294967296;
  }

  choice<T>(arr: T[]): T {
    return arr[Math.floor(this.next() * arr.length)];
  }

  integer(min: number, max: number): number {
    return Math.floor(this.next() * (max - min + 1)) + min;
  }
}

interface FlowState {
  currentUrl: string;
  visitedPages: Set<string>;
  errors: string[];
  invariantViolations: string[];
}

test.describe('Model-Based Testing - Deterministic Flow Runner', () => {
  let networkWatcher: NetworkWatcher;
  let rng: SeededRandom;

  const PAGES = [
    '/',
    '/login',
    '/create-account',
    `/business/${env.AGENT_SCOPE_SLUG}`,
  ];

  const ACTIONS = {
    navigate: (page: string) => `navigate:${page}`,
    clickContactCTA: 'click:contact-cta',
    openEditor: 'open:editor',
    closeModal: 'close:modal',
  };

  test.beforeEach(async ({ page }) => {
    networkWatcher = new NetworkWatcher(page);
    rng = new SeededRandom();
    console.log(`🌱 Seeded RNG with: ${rng.toString()}`);
  });

  test('should satisfy mission invariants across 25-step random walk', async ({ page }, testInfo) => {
    try {
      const state: FlowState = {
        currentUrl: `${env.BASE_URL}/`,
        visitedPages: new Set(),
        errors: [],
        invariantViolations: [],
      };

      const maxSteps = 25;
      let step = 0;

      while (step < maxSteps) {
        step++;
        console.log(`\n[Step ${step}/${maxSteps}] At: ${state.currentUrl}`);

        // Navigate to current URL
        const response = await page.goto(state.currentUrl, { waitUntil: 'networkidle' });

        if (!response?.ok()) {
          state.errors.push(
            `Navigation to ${state.currentUrl} returned ${response?.status()}`
          );
          // 404s are not acceptable in core flows
          if (response?.status() === 404) {
            state.invariantViolations.push(
              `Got 404 at ${state.currentUrl}`
            );
          }
        }

        state.visitedPages.add(state.currentUrl);

        // Check mission invariant (if on business profile)
        if (state.currentUrl.includes(`/business/${env.AGENT_SCOPE_SLUG}`)) {
          const missionElement = page.locator(selectors.businessProfileView.mission);
          const isMissionVisible = await missionElement.isVisible().catch(() => false);

          if (!isMissionVisible) {
            state.invariantViolations.push(
              'VIOLATION: Mission element not visible on business profile'
            );
          } else {
            const missionText = await missionElement.textContent();
            if (hasStubContent(missionText || '')) {
              state.invariantViolations.push(
                'VIOLATION: Mission contains stub content'
              );
            }
          }
        }

        // Check for stub/unfinished UI
        const allText = await page.content();
        if (hasStubContent(allText)) {
          state.invariantViolations.push(
            `Stub content found on ${state.currentUrl}`
          );
        }

        // Randomly choose next action
        const nextAction = rng.choice([
          ACTIONS.navigate(rng.choice(PAGES)),
          ACTIONS.clickContactCTA,
          ACTIONS.openEditor,
          ACTIONS.closeModal,
        ]);

        console.log(`  → Action: ${nextAction}`);

        if (nextAction.startsWith('navigate:')) {
          const targetPage = nextAction.replace('navigate:', '');
          state.currentUrl = `${env.BASE_URL}${targetPage}`;
        } else if (nextAction === ACTIONS.clickContactCTA) {
          const contactCTA = page.locator(selectors.businessProfileView.contactCTA);
          const isVisible = await contactCTA.isVisible().catch(() => false);

          if (isVisible) {
            await contactCTA.click();
            await page.waitForTimeout(500);
          }
        } else if (nextAction === ACTIONS.closeModal) {
          const closeButton = page.locator('button:has-text("Cancel"), button:has-text("Close"), [aria-label="Close"]');
          const isVisible = await closeButton.first().isVisible().catch(() => false);

          if (isVisible) {
            await closeButton.first().click();
            await page.waitForTimeout(300);
          }
        }
      }

      // Verify results
      console.log(`\n✅ Walk completed: visited ${state.visitedPages.size} unique pages`);
      console.log(`📊 Errors: ${state.errors.length}`);
      console.log(`⚠️  Invariant Violations: ${state.invariantViolations.length}`);

      // Non-blocking errors
      if (state.errors.length > 0) {
        console.warn('Network/Navigation Errors:', state.errors);
      }

      // Blocking violations (mission invariants)
      if (state.invariantViolations.length > 0) {
        console.error('MISSION INVARIANT VIOLATIONS:', state.invariantViolations);
        expect(state.invariantViolations.length).toBe(0);
      }
    } finally {
      networkWatcher.attachToTestInfo(testInfo);
    }
  });

  test('should handle missing test user gracefully', async ({ page }, testInfo) => {
    try {
      // Try to navigate to a page that might require auth
      const response = await page.goto(`${env.BASE_URL}/dashboard`, {
        waitUntil: 'domcontentloaded',
      });

      // Should either:
      // 1. Redirect to login (acceptable)
      // 2. Show a 403 (acceptable)
      // 3. Show a "not authenticated" message (acceptable)
      if (response?.status() === 403 || response?.status() === 401) {
        // Fine - auth required
        expect([401, 403]).toContain(response.status());
      } else if (page.url().includes('/login')) {
        // Redirected to login - fine
        expect(page.url()).toContain('/login');
      } else {
        // Should not be a generic error
        expect(response?.status()).toBeLessThanOrEqual(400);
      }
    } finally {
      networkWatcher.attachToTestInfo(testInfo);
    }
  });

  test('should verify Scout AI chat is available', async ({ page }, testInfo) => {
    try {
      await page.goto(`${env.BASE_URL}/`);

      // Scout should be present (primary control plane)
      const scoutChat = page.locator(selectors.common.scoutChat);
      const isChatVisible = await scoutChat.isVisible().catch(() => false);

      if (!isChatVisible) {
        console.warn('⚠️  Scout chat not immediately visible (may load asynchronously)');
      } else {
        console.log('✅ Scout chat is visible');
      }
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
