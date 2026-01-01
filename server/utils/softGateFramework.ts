/**
 * Soft Gate Framework (C2-5)
 * 
 * A soft gate offers optional verification for features/benefits without blocking access.
 * 
 * Pattern:
 * - User can proceed unverified
 * - Verification offer is presented as an incentive ("get X benefit")
 * - Client receives `allowProceedUnverified: true` to know it can skip verification
 * - Telemetry tracks whether user chose to verify or skip
 * 
 * Examples:
 * - PUBLISH_PUBLIC_PROFILE: "Verified profiles rank higher in searches (optional)"
 * - POST_MARKETPLACE_LISTING: "Add verification badge to attract buyers (optional)"
 * - POST_JOB_REQUEST: "Get higher response rates with verified homeowner (optional)"
 */

export interface SoftGateContext {
  action: string;                      // e.g., 'PUBLISH_PUBLIC_PROFILE'
  userRole: 'homeowner' | 'contractor' | 'user';
  currentValue?: any;                  // Current setting if updating
  missingRequirements?: string[];      // Optional: what verification could unlock
  context?: Record<string, any>;       // Additional action context
}

export interface SoftGateOffer {
  message: string;                     // Main message ("Your profile will be visible, but...")
  benefits: {
    label: string;                     // "Better visibility"
    description: string;               // "Verified profiles rank higher in search results"
    estimatedBoost?: string;            // "Up to 3x more views"
  }[];
  verificationOptional: true;          // Flag that this is optional
  allowProceedUnverified: true;        // Client can proceed without verifying
  verifyNowAction?: {
    label: string;                     // "Verify now (2-3 min)"
    path: string;                      // '/address-verification'
    why: string;                       // Why this verification helps
  };
  proceedUnverifiedAction?: {
    label: string;                     // "Proceed without verification"
    why: string;                       // "You can always verify later"
  };
}

/**
 * Build a soft gate offer (optional verification incentive)
 * 
 * @param context - SoftGateContext with action, role, requirements
 * @returns SoftGateOffer with benefits and dual-action buttons
 */
export function buildSoftGateOffer(context: SoftGateContext): SoftGateOffer {
  const { action, userRole, missingRequirements = [] } = context;

  // Action-specific benefits
  const benefits: Record<string, SoftGateOffer['benefits']> = {
    PUBLISH_PUBLIC_PROFILE: [
      {
        label: 'Better visibility',
        description: 'Verified profiles rank higher in search results',
        estimatedBoost: 'Up to 3x more profile views',
      },
    ],
    POST_MARKETPLACE_LISTING: [
      {
        label: 'Trust badge',
        description: 'Verified badge displays on your listing',
        estimatedBoost: 'Average 40% higher interest rate',
      },
      {
        label: 'Priority placement',
        description: 'Verified listings feature in "trusted sellers" section',
        estimatedBoost: 'Up to 2x more buyer inquiries',
      },
    ],
    POST_JOB_REQUEST: [
      {
        label: 'Higher response rate',
        description: 'Contractors prefer verified homeowners (lower flake risk)',
        estimatedBoost: '2-3x more bid submissions',
      },
    ],
  };

  // Verification paths by requirement
  const requirementToPath: Record<string, string> = {
    address: '/address-verification',
    license: '/contractor-apply',
    insurance: '/insurance-verification',
    tax_id: '/tax-id-verification',
    bank_account: '/bank-account-verification',
  };

  const verifyPath = missingRequirements.length > 0 
    ? requirementToPath[missingRequirements[0]] 
    : '/verification';

  const verifyWhy = {
    address: 'so contractors know you\'re a real homeowner',
    license: 'so homeowners know you\'re legally licensed',
    insurance: 'to protect homeowners',
  }[missingRequirements[0]] || 'to build trust';

  return {
    message: `You can proceed without verification. ${
      benefits[action]?.[0]?.description || 'But verified users get benefits.'
    }`,
    benefits: benefits[action] || [
      {
        label: 'Increase trust',
        description: 'Verification builds credibility with other users',
      },
    ],
    verificationOptional: true,
    allowProceedUnverified: true,
    verifyNowAction: {
      label: missingRequirements.length > 0
        ? `Verify now (${getEstimatedTime(missingRequirements[0])})`
        : 'Verify to unlock benefits',
      path: verifyPath,
      why: verifyWhy,
    },
    proceedUnverifiedAction: {
      label: 'Proceed without verification',
      why: 'You can always verify later to unlock benefits',
    },
  };
}

/**
 * Get estimated time for a single verification requirement
 */
function getEstimatedTime(requirement: string): string {
  const times: Record<string, string> = {
    address: '2-3 min',
    license: '5-10 min',
    insurance: '5-10 min',
    identity: '5-10 min',
    tax_id: '2-3 min',
    bank_account: '2-3 min',
  };
  return times[requirement] || '5 min';
}

/**
 * Convert soft gate offer into Scout-compatible response
 * 
 * @param offer - SoftGateOffer from buildSoftGateOffer
 * @param actionName - Name of the action being taken
 * @returns Response object compatible with Scout message format
 */
export function buildSoftGateResponse(
  offer: SoftGateOffer,
  actionName: string,
) {
  return {
    message: offer.message,
    actions: [
      {
        label: offer.verifyNowAction?.label || 'Verify now',
        why: offer.verifyNowAction?.why || 'Get benefits',
        action: {
          type: 'NAVIGATE',
          path: offer.verifyNowAction?.path || '/verification',
        },
      },
      {
        label: offer.proceedUnverifiedAction?.label || 'Continue',
        why: offer.proceedUnverifiedAction?.why || 'Proceed anyway',
        action: {
          type: 'CONTINUE',  // Special action type for soft gates
        },
      },
    ],
    verificationOptional: true,
    allowProceedUnverified: true,
    benefits: offer.benefits,
    governorAction: 'SOFT_GATE',  // Signals this is optional
  };
}

/**
 * Determine if user should see a soft gate offer
 * 
 * @param action - Action name
 * @param userRole - User's role
 * @param verificationStatus - User's verification status
 * @returns true if soft gate should be offered
 */
export function shouldShowSoftGate(
  action: string,
  userRole: string,
  verificationStatus?: string,
): boolean {
  // Soft gates shown to unverified users
  const softGateActions = [
    'PUBLISH_PUBLIC_PROFILE',
    'POST_MARKETPLACE_LISTING',
    'POST_JOB_REQUEST',
  ];

  return (
    softGateActions.includes(action) &&
    verificationStatus !== 'approved'
  );
}

/**
 * Soft gate telemetry events
 */
export type SoftGateEventType =
  | 'soft_gate_shown'      // Gate was presented to user
  | 'soft_gate_verified'   // User chose to verify
  | 'soft_gate_skipped'    // User chose to proceed unverified
  | 'soft_gate_action_taken'; // User completed action (verified or unverified)

export interface SoftGateEvent {
  action: string;          // e.g., 'PUBLISH_PUBLIC_PROFILE'
  eventType: SoftGateEventType;
  userRole: string;
  userId?: string;
  timestamp?: Date;
  metadata?: Record<string, any>;
}

