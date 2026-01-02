/**
 * Scout Interaction Test Suite
 *
 * Demonstrates how Bot Army logs Scout interactions across three pipelines:
 * 1. Action Pipeline - Real execution
 * 2. Observation Pipeline - Language, choices, friction
 * 3. Learning Pipeline - Heuristic updates (real users only, bots excluded)
 *
 * This test runs as isTestRun=true, so learning pipeline is hard-disabled.
 */

import { test, expect } from '@playwright/test';
import { env } from '../utils/env';
import { selectors } from '../utils/selectors';
import { NetworkWatcher } from '../utils/networkWatch';
import {
  ScoutInteractionLogger,
  InsightGenerator,
  ScoutAction,
  ScoutMode,
} from '../utils/scoutLogger';
import { v4 as uuidv4 } from 'crypto';

test.describe('Scout Interaction Logging - Bot Army', () => {
  let networkWatcher: NetworkWatcher;
  let scoutLogger: ScoutInteractionLogger;

  test.beforeEach(async ({ page }) => {
    networkWatcher = new NetworkWatcher(page);

    // Initialize Scout logger as test run
    // CRITICAL: isTestRun=true means this session will NOT influence learning
    scoutLogger = new ScoutInteractionLogger({
      sessionId: uuidv4(),
      userId: null, // Anonymous bot
      isTestRun: true, // ← HARD GUARD: Bots cannot learn
      mode: 'freeform',
    });
  });

  test('should log Scout offering control (do it vs route it)', async ({ page }, testInfo) => {
    try {
      await page.goto(`${env.BASE_URL}/business/${env.AGENT_SCOPE_SLUG}`);

      // Simulate Scout offering control to user
      scoutLogger.addTurn({
        role: 'scout',
        message:
          'I can create an invoice for you right now, or I can take you to the invoicing page to do it yourself. What would you prefer?',
        intentDetected: ['request_invoice'],
        actionsOffered: [
          {
            id: 'scout_create_invoice',
            type: 'create_invoice',
            label: 'Create invoice now',
            description: 'Scout will generate and send invoice',
          } as ScoutAction,
          {
            id: 'route_to_invoicing',
            type: 'route',
            label: 'Take me to invoicing',
            description: 'Navigate to manual invoicing interface',
          } as ScoutAction,
        ],
      });

      // Log user choice (choosing Scout-direct)
      scoutLogger.addTurn({
        role: 'user',
        message: 'You do it',
        actionChosen: {
          id: 'scout_create_invoice',
          type: 'create_invoice',
          label: 'Create invoice now',
        } as ScoutAction,
      });

      // Log action execution (Scout pipeline #1 - real action)
      scoutLogger.addActionExecution({
        actionId: 'scout_create_invoice',
        actionType: 'create_invoice',
        offered: true,
        selected: true,
        executed: true,
        executionPath: 'scout_direct',
        result: 'success',
        metadata: {
          actionDurationMs: 245,
          targetResourceId: 'inv_123abc',
          targetResourceType: 'invoice',
        },
      });

      // Log Scout confirmation (truthful reporting)
      scoutLogger.addTurn({
        role: 'scout',
        message: "Done. I've created invoice #INV-001 for $1,200. It's ready to send.",
        actionExecuted: true,
        executionResult: 'success',
      });

      // Verify session was logged
      const sessionLog = scoutLogger.getSessionLog();
      expect(sessionLog.turns.length).toBe(3); // Scout offer, User choice, Scout confirmation
      expect(sessionLog.isTestRun).toBe(true); // Marked as test
    } finally {
      networkWatcher.attachToTestInfo(testInfo);
    }
  });

  test('should record friction signal when user hesitates', async ({ page }, testInfo) => {
    try {
      await page.goto(`${env.BASE_URL}/business/${env.AGENT_SCOPE_SLUG}`);

      // Scout offers action
      scoutLogger.addTurn({
        role: 'scout',
        message: 'I can publish your profile to marketplace. Should I do that?',
        intentDetected: ['publish_profile'],
        actionsOffered: [
          {
            id: 'publish_profile',
            type: 'publish_profile',
            label: 'Publish to marketplace',
          } as ScoutAction,
        ],
      });

      // User asks "why" = friction signal (user_asked_why)
      scoutLogger.addTurn({
        role: 'user',
        message: 'Why should I do that?',
      });

      // Log friction signal (observation pipeline #2)
      scoutLogger.addFrictionSignal({
        turnNumber: 2,
        signalType: 'user_asked_why',
        context: {
          scoutMessage: 'I can publish your profile to marketplace. Should I do that?',
          userMessage: 'Why should I do that?',
          actionOffered: {
            id: 'publish_profile',
            type: 'publish_profile',
            label: 'Publish to marketplace',
          } as ScoutAction,
        },
        severity: 'medium', // User uncertain, language not clear enough
      });

      // Scout clarifies reasoning
      scoutLogger.addTurn({
        role: 'scout',
        message:
          'Publishing your profile means customers searching your area can find you directly. You remain in full control of messaging and pricing.',
      });

      // User skips action = another friction signal
      scoutLogger.addTurn({
        role: 'user',
        message: 'Not right now',
      });

      scoutLogger.addFrictionSignal({
        turnNumber: 4,
        signalType: 'user_skipped',
        context: {
          scoutMessage: 'Scout clarification',
          actionOffered: {
            id: 'publish_profile',
            type: 'publish_profile',
            label: 'Publish to marketplace',
          } as ScoutAction,
        },
        severity: 'low',
      });

      // Get friction signals for analysis
      const frictionSignals = scoutLogger.getFrictionSignals();
      expect(frictionSignals.length).toBe(2);
      expect(frictionSignals[0].signalType).toBe('user_asked_why');
      expect(frictionSignals[1].signalType).toBe('user_skipped');

      // CRITICAL: Learning pipeline check
      // isTestRun=true means getObservationsForLearning() returns null
      const learningData = scoutLogger.getObservationsForLearning();
      expect(learningData).toBeNull(); // ← TEST RUN EXCLUDED FROM LEARNING
    } finally {
      networkWatcher.attachToTestInfo(testInfo);
    }
  });

  test('should log failed action execution with error', async ({ page }, testInfo) => {
    try {
      await page.goto(`${env.BASE_URL}/business/${env.AGENT_SCOPE_SLUG}`);

      // Scout attempts action
      scoutLogger.addTurn({
        role: 'scout',
        message: 'I can update your mission statement right now.',
        actionsOffered: [
          {
            id: 'update_mission',
            type: 'update_mission',
            label: 'Update mission',
          } as ScoutAction,
        ],
      });

      scoutLogger.addTurn({
        role: 'user',
        message: 'Go ahead',
        actionChosen: {
          id: 'update_mission',
          type: 'update_mission',
          label: 'Update mission',
        } as ScoutAction,
      });

      // Log failed execution (action pipeline error)
      scoutLogger.addActionExecution({
        actionId: 'update_mission',
        actionType: 'update_mission',
        offered: true,
        selected: true,
        executed: true,
        executionPath: 'scout_direct',
        result: 'failed',
        errorCode: 'PERMISSION_DENIED',
        errorMessage: 'User is not profile owner',
      });

      // Scout reports failure (truthful - no silent failures)
      scoutLogger.addTurn({
        role: 'scout',
        message: "I couldn't update the mission statement because this profile is owned by someone else. Would you like me to take you to the owner?",
        actionExecuted: true,
        executionResult: 'failed',
        errorCode: 'PERMISSION_DENIED',
      });

      // Verify error was logged
      const actions = scoutLogger.getActionExecutions();
      expect(actions[0].result).toBe('failed');
      expect(actions[0].errorCode).toBe('PERMISSION_DENIED');
      expect(actions[0].errorMessage).toBeTruthy();
    } finally {
      networkWatcher.attachToTestInfo(testInfo);
    }
  });

  test('should log partial success with recovery', async ({ page }, testInfo) => {
    try {
      await page.goto(`${env.BASE_URL}/business/${env.AGENT_SCOPE_SLUG}`);

      // Scout offers batch action
      scoutLogger.addTurn({
        role: 'scout',
        message:
          'I can send messages to 5 contractors asking for quotes. Should I proceed? (This will take 30 seconds)',
        actionsOffered: [
          {
            id: 'batch_contact',
            type: 'batch_contact',
            label: 'Send batch inquiries',
          } as ScoutAction,
        ],
      });

      scoutLogger.addTurn({
        role: 'user',
        message: 'Yes, do it',
        actionChosen: {
          id: 'batch_contact',
          type: 'batch_contact',
          label: 'Send batch inquiries',
        } as ScoutAction,
      });

      // Log partial success (3 of 5 sent)
      scoutLogger.addActionExecution({
        actionId: 'batch_contact',
        actionType: 'batch_contact',
        offered: true,
        selected: true,
        executed: true,
        executionPath: 'scout_direct',
        result: 'partial',
        metadata: {
          actionDurationMs: 28500,
          targetResourceId: 'batch_001',
          targetResourceType: 'contact_batch',
        },
      });

      // Scout explains partial result
      scoutLogger.addTurn({
        role: 'scout',
        message:
          'I sent messages to 3 contractors successfully. 2 messages failed (invalid email). Would you like me to show you which ones?',
        actionExecuted: true,
        executionResult: 'partial',
      });

      // Get summary
      const summary = scoutLogger.getSummary();
      expect(summary.actionsExecuted).toBe(1);
    } finally {
      networkWatcher.attachToTestInfo(testInfo);
    }
  });

  test('should generate session summary for analysis', async ({ page }, testInfo) => {
    try {
      await page.goto(`${env.BASE_URL}/business/${env.AGENT_SCOPE_SLUG}`);

      // Simulate full session
      scoutLogger.addTurn({
        role: 'scout',
        message: 'Hi! How can I help you with your business today?',
      });

      scoutLogger.addTurn({
        role: 'user',
        message: 'I need to create an invoice',
        intentDetected: ['request_invoice'],
      });

      scoutLogger.addTurn({
        role: 'scout',
        message: 'I can create one for you, or show you the invoicing page. Which do you prefer?',
        actionsOffered: [
          {
            id: 'create_invoice',
            type: 'create_invoice',
            label: 'Create now',
          } as ScoutAction,
          {
            id: 'route_invoicing',
            type: 'route',
            label: 'Show me how',
          } as ScoutAction,
        ],
      });

      scoutLogger.addTurn({
        role: 'user',
        message: 'You do it',
        actionChosen: { id: 'create_invoice', type: 'create_invoice', label: 'Create now' } as ScoutAction,
      });

      scoutLogger.addActionExecution({
        actionId: 'create_invoice',
        actionType: 'create_invoice',
        offered: true,
        selected: true,
        executed: true,
        executionPath: 'scout_direct',
        result: 'success',
      });

      scoutLogger.addTurn({
        role: 'scout',
        message: "Done! Invoice #INV-001 is ready.",
        actionExecuted: true,
        executionResult: 'success',
      });

      // Get summary
      const summary = scoutLogger.getSummary();

      expect(summary.totalTurns).toBe(6);
      expect(summary.scoutTurns).toBe(3);
      expect(summary.userTurns).toBe(3);
      expect(summary.actionsOffered).toBe(1);
      expect(summary.actionsSelected).toBe(1);
      expect(summary.actionsExecuted).toBe(1);
      expect(summary.successRate).toBe(1); // 100%

      console.log('📊 Session Summary:', summary);
    } finally {
      networkWatcher.attachToTestInfo(testInfo);
    }
  });

  test('should verify isTestRun=true blocks learning pipeline', async ({ page }, testInfo) => {
    try {
      // This is the CRITICAL hard guard

      scoutLogger.addTurn({
        role: 'scout',
        message: 'Test message',
      });

      // Get observations for learning
      const observationsForLearning = scoutLogger.getObservationsForLearning();

      // HARD GUARD: Must return null because isTestRun=true
      expect(observationsForLearning).toBeNull();

      // But observation pipeline #2 still works
      const fullSession = scoutLogger.getSessionLog();
      expect(fullSession.turns.length).toBe(1);
      expect(fullSession.isTestRun).toBe(true);

      console.log('✅ Bot excluded from learning pipeline (as required)');
    } finally {
      networkWatcher.attachToTestInfo(testInfo);
    }
  });

  test.afterEach(({ testInfo }) => {
    // Log session even on failure
    const sessionLog = scoutLogger.getSessionLog();
    console.log(`📝 Scout Session (${scoutLogger.getSummary().totalTurns} turns):`, {
      sessionId: sessionLog.sessionId,
      isTestRun: sessionLog.isTestRun,
      durationMs: sessionLog.durationMs,
      turns: sessionLog.turns.length,
      frictionSignals: sessionLog.frictionSignals.length,
    });

    if (testInfo.status !== 'passed') {
      networkWatcher.logErrors();
    }
  });
});
