/**
 * C2-2: explainAndOfferVerification
 *
 * Canonical Scout response builder for verification gates.
 * Converts hard blocks into explainable, optional-until-required flows.
 *
 * USAGE:
 * const response = explainAndOfferVerification({
 *   action: 'MESSAGE_USER',
 *   missingRequirements: ['address'],
 *   userContext: { role: 'homeowner', ... }
 * });
 * // Returns Scout-compatible response with explanation + alternate paths
 *
 * RULES:
 * - Every verification gate must explain WHY
 * - Every gate must offer AT LEAST one alternate path
 * - No dead ends (user always has a next action)
 * - Language is plain, not technical
 */

import type { ScoutAction, ScoutResponse } from '../routes/scout';

export interface VerificationGateContext {
  action: string;          // e.g., 'MESSAGE_USER', 'APPLY_AS_CONTRACTOR'
  missingRequirements: string[];  // e.g., ['address'], ['license', 'insurance']
  userRole?: string;       // 'homeowner', 'contractor', 'admin'
  targetUserId?: string;   // For asymmetric gates (who are we messaging?)
  targetRole?: string;     // Role of recipient
  context?: Record<string, unknown>; // Additional context (county, state, etc)
}

export interface VerificationExplanation {
  message: string;
  whyNeeded: string;
  estimatedTime: string;
  actions: ScoutAction[];
}

/**
 * Plain language explanation for each verification type
 */
const REQUIREMENT_EXPLANATIONS: Record<string, {
  label: string;
  why: string;
  time: string;
}> = {
  address: {
    label: 'Verify your address',
    why: "So contractors know you're a real homeowner and can find you locally",
    time: '2-3 minutes',
  },
  license: {
    label: 'Upload your contractor license',
    why: "Homeowners need to know you're legally licensed to do this work",
    time: '5-10 minutes',
  },
  insurance: {
    label: 'Upload your insurance certificate',
    why: 'Protects homeowners if something goes wrong; most contractors carry this anyway',
    time: '2 minutes',
  },
  identity: {
    label: 'Verify your identity',
    why: 'Required by tax law before we can process payments',
    time: '1-2 minutes',
  },
  tax_id: {
    label: 'Provide your tax ID',
    why: 'Required by the IRS for income reporting',
    time: '1 minute',
  },
  bank_account: {
    label: 'Add your bank account',
    why: 'So we can send you payments for completed work',
    time: '2 minutes',
  },
};

/**
 * Alternate paths per action (what can user do instead of verifying?)
 */
const ALTERNATE_PATHS: Record<string, {
  label: string;
  why: string;
  path: string;
}> = {
  MESSAGE_USER: {
    label: 'Use Scout-mediated contact',
    why: 'Ask Scout to help you connect without direct messaging',
    path: '/scout',
  },
  REQUEST_CONTRACTOR_QUOTE: {
    label: 'Browse contractors with Scout',
    why: 'Scout will show you verified contractors in your area',
    path: '/scout',
  },
  APPLY_AS_CONTRACTOR: {
    label: 'Explore as homeowner first',
    why: 'See how the platform works before applying',
    path: '/contractors',
  },
  ACCEPT_CONTRACTOR_PAYMENT: {
    label: 'Arrange payment offline',
    why: 'Homeowner can send check or wire transfer',
    path: '/community',
  },
  PUBLISH_PUBLIC_PROFILE: {
    label: 'Keep profile private',
    why: 'Still accessible via direct link; you can share with clients directly',
    path: '/settings/profile',
  },
};

/**
 * Main implementation: explainAndOfferVerification
 * 
 * Converts verification requirement into Scout response with:
 * 1. Clear explanation of why verification matters
 * 2. Primary path: verification flow with time estimate
 * 3. Secondary path: alternate action that doesn't require verification
 */
export function explainAndOfferVerification(
  context: VerificationGateContext
): VerificationExplanation {
  const { action, missingRequirements, userRole, targetRole } = context;

  // Build explanation message based on action type
  let mainMessage = '';
  let whyExplanation = '';

  switch (action) {
    case 'MESSAGE_USER': {
      const isSender = userRole !== targetRole; // asymmetric check
      mainMessage = isSender
        ? `To send messages, we need to verify your address. It only takes 2-3 minutes.`
        : `This person hasn't verified their address yet. You can still reach them through Scout.`;
      whyExplanation = `TradeScout verifies addresses so contractors know they're talking to real homeowners. It helps prevent spam and builds trust.`;
      break;
    }

    case 'REQUEST_CONTRACTOR_QUOTE': {
      mainMessage = `Contractors want to know you're a real homeowner. Verify your address in 2-3 minutes, then you can request quotes.`;
      whyExplanation = `Most contractors won't respond to unverified requests. Once you verify, you'll get better quality leads.`;
      break;
    }

    case 'APPLY_AS_CONTRACTOR': {
      const missingDocs = missingRequirements.join(', ');
      mainMessage = `To apply as a contractor, upload your ${missingDocs}. Homeowners need to know you're licensed and insured.`;
      whyExplanation = `Verification builds homeowner confidence and protects them legally. It's standard in the industry.`;
      break;
    }

    case 'ACCEPT_CONTRACTOR_PAYMENT': {
      mainMessage = `Before we can send you payment, we need your tax ID and bank account info. It's required by the IRS.`;
      whyExplanation = `The IRS requires us to report contractor income. This takes 2 minutes and protects both you and us.`;
      break;
    }

    case 'PUBLISH_PUBLIC_PROFILE': {
      mainMessage = `Verify your address to show up in the contractor directory. Unverified profiles still have a public link.`;
      whyExplanation = `Verified contractors get more visibility because homeowners trust them. But you're still findable via your profile link.`;
      break;
    }

    default: {
      mainMessage = `To proceed, we need to verify ${missingRequirements.join(', ')}. It helps keep the community safe.`;
      whyExplanation = `Verification prevents spam and fraud. It takes just a few minutes.`;
    }
  }

  // Build primary action (verification flow)
  const estimatedTime = getEstimatedTimeForRequirements(missingRequirements);
  const verifyPath = getVerificationPath(missingRequirements, context);

  const primaryAction: ScoutAction = {
    type: 'NAVIGATE',
    label: `Verify now (${estimatedTime})`,
    path: verifyPath,
    subtitle: missingRequirements.join(' + '),
    why: `Required to ${action.toLowerCase().replace(/_/g, ' ')}`,
    primary: true
  };

  // Build secondary action (alternate path)
  const alternatePath = ALTERNATE_PATHS[action];
  const secondaryAction: ScoutAction | null = alternatePath
    ? {
        type: 'NAVIGATE',
        label: `Continue without verification`,
        path: alternatePath.path,
        subtitle: alternatePath.label,
        why: alternatePath.why,
      }
    : null;

  // Build response
  return {
    message: mainMessage,
    whyNeeded: whyExplanation,
    estimatedTime,
    actions: [primaryAction, secondaryAction].filter(Boolean) as ScoutAction[],
  };
}

/**
 * Calculate estimated time based on verification requirements
 */
function getEstimatedTimeForRequirements(requirements: string[]): string {
  if (requirements.length === 0) return '0 min';

  const times: Record<string, number> = {
    address: 3,
    license: 10,
    insurance: 2,
    identity: 2,
    tax_id: 1,
    bank_account: 2,
  };

  let total = 0;
  for (const req of requirements) {
    total += times[req] || 5;
  }

  if (total <= 2) return '1-2 min';
  if (total <= 5) return '2-5 min';
  if (total <= 10) return '5-10 min';
  return '10+ min';
}

/**
 * Get the correct verification flow path based on requirements
 */
function getVerificationPath(
  requirements: string[],
  context: VerificationGateContext
): string {
  // Check what's needed and route to appropriate flow
  if (requirements.includes('license') || requirements.includes('insurance')) {
    return '/contractor-apply?ref=' + context.action;
  }

  if (requirements.includes('address')) {
    return '/address-verification?next=' + encodeURIComponent(`/${context.action}`);
  }

  if (requirements.includes('identity') || requirements.includes('tax_id')) {
    return '/verification?tab=identity&next=' + encodeURIComponent(`/${context.action}`);
  }

  return '/verification?next=' + encodeURIComponent(`/${context.action}`);
}

/**
 * Helper: Convert verification explanation to full Scout response
 */
export function buildVerificationGateResponse(
  context: VerificationGateContext
): Partial<ScoutResponse> {
  const explanation = explainAndOfferVerification(context);

  return {
    message: explanation.message,
    suggestedActions: explanation.actions.map(action => action.label),
    actions: explanation.actions,
    metadata: {
      intent: `verification_gate_${context.action}`,
      decision: `User needs ${context.missingRequirements.join(', ')} to proceed with ${context.action}`,
      governorAction: 'DEFER',  // Defer to verification, not block
    },
  };
}

/**
 * Helper: Check if user is already verified for action
 * (Used in C2-3 to decide whether to show gate or proceed)
 */
export function isUserVerifiedFor(
  user: any,
  action: string,
  requirementsMap: Record<string, string[]>
): boolean {
  const requirements = requirementsMap[action] || [];

  for (const req of requirements) {
    switch (req) {
      case 'address':
        if (!user.addressVerified) return false;
        break;
      case 'license':
      case 'insurance':
        if (user.verificationStatus !== 'approved') return false;
        break;
      case 'identity':
      case 'tax_id':
        if (!user.identityVerified) return false;  // Future field
        break;
      case 'bank_account':
        if (!user.bankAccountVerified) return false;  // Future field
        break;
    }
  }

  return true;
}
