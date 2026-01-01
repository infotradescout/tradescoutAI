/**
 * D2-1: Onboarding Detection & Persistence
 * D2-2: Question Injection & Contextual Guidance
 * D2-3: Snapshot Updates & Confidence Handling
 * D2-4: Auto-Expiration Logic
 * 
 * Manages first-time Scout guidance when onboarding=true
 */

export interface OnboardingSession {
  isOnboarding: boolean;
  startedAt: Date;
  answeredQuestions: string[];
  snapshot: {
    intent?: 'seek_help' | 'offer_help' | 'explore';
    urgencySignal?: 'high' | 'medium' | 'low' | 'none';
    timelineSignal?: 'immediate' | 'soon' | 'planned' | 'browsing';
    context?: {
      scope?: 'residential' | 'business' | 'community' | 'multi';
      businessType?: string;
    };
    tradeSignal?: string;
    confidence: number;
  };
  skippedQuestions: string[];
  expirationReason?: 'confidence' | 'action' | 'timeout' | 'user_exit';
}

// In-memory session store (expires with server restart)
// In production, use Redis or short-lived DB table
const onboardingSessions = new Map<string, OnboardingSession>();

/**
 * D2-1: Detect onboarding flag from request
 * Returns true if onboarding=true in query params
 */
export function isOnboardingRequest(queryParams: Record<string, string>): boolean {
  return queryParams.onboarding === 'true';
}

/**
 * D2-1: Initialize onboarding session
 * Called when user first enters /scout?onboarding=true
 */
export function initializeOnboardingSession(sessionId: string): OnboardingSession {
  const session: OnboardingSession = {
    isOnboarding: true,
    startedAt: new Date(),
    answeredQuestions: [],
    snapshot: {
      confidence: 0.35,
    },
    skippedQuestions: [],
  };

  onboardingSessions.set(sessionId, session);
  return session;
}

/**
 * D2-1: Get current onboarding session
 */
export function getOnboardingSession(sessionId: string): OnboardingSession | undefined {
  return onboardingSessions.get(sessionId);
}

/**
 * D2-2: Determine which question to ask next
 * Returns question key (Q1, Q2, Q3, Q4) or null if no more questions
 */
export function getNextQuestion(session: OnboardingSession): string | null {
  // Q1: Intent - always ask first if not answered
  if (!session.snapshot.intent) return 'Q1';

  // Q2: Urgency - ask after Q1, unless intent is 'explore'
  if (session.snapshot.intent !== 'explore' && !session.snapshot.urgencySignal) {
    return 'Q2';
  }

  // Q3: Scope - ask if Q1 or Q2 answered (skippable)
  if (!session.snapshot.context?.scope) {
    if (session.snapshot.intent || session.snapshot.urgencySignal) {
      return 'Q3';
    }
  }

  // Q4: Category - optional refinement, ask if Q3 answered
  if (session.snapshot.context?.scope && !session.snapshot.tradeSignal) {
    // Only ask Q4 if user answered Q3 (didn't skip)
    if (!session.skippedQuestions.includes('Q3')) {
      return 'Q4';
    }
  }

  return null;
}

/**
 * D2-2: Check if signal already inferred (avoid redundant questions)
 */
export function shouldAskQuestion(session: OnboardingSession, questionKey: string): boolean {
  // If already answered, don't ask again
  if (session.answeredQuestions.includes(questionKey)) return false;

  // If skipped multiple times, don't re-ask
  const skipCount = session.skippedQuestions.filter(q => q === questionKey).length;
  if (skipCount >= 2) return false;

  return true;
}

/**
 * D2-3: Record answer to question and update snapshot
 */
export function recordAnswer(
  session: OnboardingSession,
  questionKey: string,
  answer: string
): void {
  session.answeredQuestions.push(questionKey);

  // Update snapshot signals based on answer
  switch (questionKey) {
    case 'Q1': {
      // Q1 answers: 'seek_help' | 'offer_help' | 'explore'
      if (answer === 'seek_help' || answer === 'offer_help' || answer === 'explore') {
        session.snapshot.intent = answer;
        session.snapshot.confidence += 0.20; // +20% per D1 spec
      }
      break;
    }

    case 'Q2': {
      // Q2 answers: 'immediate' | 'soon' | 'planned' | 'browsing'
      if (answer === 'immediate') {
        session.snapshot.urgencySignal = 'high';
        session.snapshot.timelineSignal = 'immediate';
      } else if (answer === 'soon') {
        session.snapshot.urgencySignal = 'medium';
        session.snapshot.timelineSignal = 'soon';
      } else if (answer === 'planned') {
        session.snapshot.urgencySignal = 'low';
        session.snapshot.timelineSignal = 'planned';
      } else if (answer === 'browsing') {
        session.snapshot.urgencySignal = 'none';
        session.snapshot.timelineSignal = 'browsing';
      }
      session.snapshot.confidence += 0.15; // +15% per D1 spec
      break;
    }

    case 'Q3': {
      // Q3 answers: 'residential' | 'business' | 'community' | 'multi'
      if (!session.snapshot.context) session.snapshot.context = {};
      if (answer === 'residential') {
        session.snapshot.context.scope = 'residential';
        session.snapshot.context.businessType = 'homeowner';
      } else if (answer === 'business') {
        session.snapshot.context.scope = 'business';
        session.snapshot.context.businessType = 'business_owner';
      } else if (answer === 'community') {
        session.snapshot.context.scope = 'community';
        session.snapshot.confidence += 0.05; // Extra +5% for strong community signal
      } else if (answer === 'multi') {
        session.snapshot.context.scope = 'multi';
      }
      session.snapshot.confidence += 0.15; // +15% per D1 spec
      break;
    }

    case 'Q4': {
      // Q4 answer: category selection (string)
      session.snapshot.tradeSignal = answer;
      session.snapshot.confidence += 0.10; // +10% per D1 spec
      break;
    }
  }

  // Cap confidence at 1.0
  session.snapshot.confidence = Math.min(session.snapshot.confidence, 1.0);
}

/**
 * D2-3: Record skip for question
 */
export function recordSkip(session: OnboardingSession, questionKey: string): void {
  session.skippedQuestions.push(questionKey);

  // Apply default values based on skip context
  switch (questionKey) {
    case 'Q2': {
      // Default to medium urgency if skipped
      if (!session.snapshot.urgencySignal) {
        session.snapshot.urgencySignal = 'medium';
      }
      break;
    }
    case 'Q3': {
      // Default to multi scope if skipped
      if (!session.snapshot.context?.scope) {
        if (!session.snapshot.context) session.snapshot.context = {};
        session.snapshot.context.scope = 'multi';
      }
      break;
    }
  }
}

/**
 * D2-4: Check if onboarding should auto-expire
 * Returns reason if should expire, null if should continue
 */
export function checkAutoExpiration(session: OnboardingSession): 'confidence' | 'timeout' | null {
  // Rule 1: Snapshot confidence ≥ 80%
  if (session.snapshot.confidence >= 0.80) {
    return 'confidence';
  }

  // Rule 2: 5 minutes elapsed
  const elapsedMs = Date.now() - session.startedAt.getTime();
  const elapsedMinutes = elapsedMs / 1000 / 60;
  if (elapsedMinutes >= 5) {
    return 'timeout';
  }

  return null;
}

/**
 * D2-4: Mark onboarding as expired
 */
export function expireOnboarding(
  session: OnboardingSession,
  reason: 'confidence' | 'action' | 'timeout' | 'user_exit'
): void {
  session.isOnboarding = false;
  session.expirationReason = reason;
}

/**
 * D2-4: Record first successful action (for auto-expiration)
 * Examples: view profile, send message, apply to project
 */
export function recordFirstAction(session: OnboardingSession): void {
  // Mark as completed via action
  expireOnboarding(session, 'action');
}

/**
 * Cleanup expired sessions (prevents memory leak)
 * Call periodically (e.g., every 10 minutes)
 */
export function cleanupExpiredSessions(): void {
  const now = Date.now();
  const maxAge = 30 * 60 * 1000; // 30 minutes

  for (const [sessionId, session] of onboardingSessions.entries()) {
    const age = now - session.startedAt.getTime();
    if (age > maxAge) {
      onboardingSessions.delete(sessionId);
    }
  }
}

// Run cleanup every 10 minutes
if (typeof global !== 'undefined') {
  setInterval(cleanupExpiredSessions, 10 * 60 * 1000);
}

/**
 * D2-2: Get question prompt and options for display
 * Used to inject questions contextually into Scout response
 */
export function getQuestionPrompt(
  questionKey: string,
  context?: { scope?: string; intent?: string }
): {
  question: string;
  options: { label: string; value: string; why: string }[];
  skipLabel: string;
  explanation: string;
} | null {
  switch (questionKey) {
    case 'Q1':
      return {
        question: 'What brings you to TradeScout right now?',
        options: [
          {
            label: 'I need help with something',
            value: 'seek_help',
            why: 'Helps Scout find contractors, pros, or peers who can help',
          },
          {
            label: "I'm here to help others",
            value: 'offer_help',
            why: 'Helps Scout route you to people looking for your skills',
          },
          {
            label: 'I\'m exploring / learning',
            value: 'explore',
            why: 'Helps Scout show relevant projects and community first',
          },
        ],
        skipLabel: 'Skip for now',
        explanation: 'This helps Scout suggest the right people and projects for you',
      };

    case 'Q2':
      return {
        question: 'How soon do you need help or want to start?',
        options: [
          {
            label: 'Right now / This week',
            value: 'immediate',
            why: 'Scout will prioritize active contractors and same-day response options',
          },
          {
            label: 'Next 1–2 weeks',
            value: 'soon',
            why: 'Scout will balance availability and quality',
          },
          {
            label: 'Next month or later',
            value: 'planned',
            why: 'Scout can show more options and help you plan',
          },
          {
            label: 'No specific timeline',
            value: 'browsing',
            why: 'Scout will show featured projects and trending in your area',
          },
        ],
        skipLabel: "I'm not sure yet",
        explanation: 'Helps Scout filter contractors and projects by availability',
      };

    case 'Q3': {
      const options = [
        {
          label: 'My home / Personal',
          value: 'residential',
          why: 'Scout prioritizes contractors, maintenance experts, and community helpers',
        },
        {
          label: 'My business',
          value: 'business',
          why: 'Scout shows B2B services, bulk rates, and business networks',
        },
        {
          label: 'Community / Volunteering',
          value: 'community',
          why: 'Scout connects you with local groups and initiatives',
        },
        {
          label: 'Multiple / All of the above',
          value: 'multi',
          why: 'Scout will show both personal and business tools',
        },
      ];

      return {
        question: 'Is this for your home, a business, or the community?',
        options,
        skipLabel: 'Show me everything',
        explanation: 'Helps Scout show the right type of projects and people for you',
      };
    }

    case 'Q4': {
      // Q4 is category-specific; return placeholder
      // Client will resolve actual categories based on Q3 answer
      return {
        question: 'Is there a specific type of work or category you\'re interested in?',
        options: [
          {
            label: 'See All Categories',
            value: 'all',
            why: 'Scout will show comprehensive category list',
          },
        ],
        skipLabel: 'Not sure / Skip this',
        explanation: 'Optional — Scout can show your category first if you\'d like',
      };
    }

    default:
      return null;
  }
}

/**
 * D2-5: Apply softer language transformation
 * Wraps Scout response with additional explanation when onboarding
 */
export function applySofterLanguage(
  message: string,
  session: OnboardingSession
): string {
  if (!session.isOnboarding) return message;

  // Add confidence indicator
  const confidencePercent = Math.round(session.snapshot.confidence * 100);
  const confidenceBar = buildConfidenceBar(confidencePercent);

  // Add explanatory preamble if low confidence
  let preamble = '';
  if (confidencePercent < 50) {
    preamble = 'To give you better suggestions, let me ask a quick question first:\n\n';
  } else if (confidencePercent < 80) {
    preamble = 'Here\'s what I can suggest based on what you\'ve told me:\n\n';
  }

  // Wrap with confidence display
  return `${preamble}${message}\n\n${confidenceBar}`;
}

/**
 * Helper: Build confidence progress bar for UI
 */
function buildConfidenceBar(percent: number): string {
  const filled = Math.round(percent / 10);
  const empty = 10 - filled;
  const bar = '█'.repeat(filled) + '░'.repeat(empty);
  return `Confidence: ${bar} ${percent}%`;
}
