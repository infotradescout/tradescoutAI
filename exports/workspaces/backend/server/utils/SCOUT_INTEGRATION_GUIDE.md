/**
 * Scout Integration Guide
 * 
 * Shows how Scout uses capability inference to adapt responses
 * without ever asking what role the user has.
 * 
 * This file is NOT executable code — it's a reference showing
 * how to integrate capability checking into Scout's routing logic.
 */

import { createCapabilityChecker, buildCapabilitySignals } from "./userCapabilities";

/**
 * EXAMPLE 1: Invoicing Flow
 * 
 * When a user mentions payment/invoicing, Scout infers they may
 * want to send an invoice and offers that path.
 */
function example_invoicingFlow() {
  const userMessage = "I completed the roof job. How do I get paid?";

  // Scout builds capability signals from the message
  const signals = buildCapabilitySignals({
    message: userMessage,
    currentPage: "/dashboard",
    recentActions: ["completed_job", "created_estimate"],
  });

  const checker = createCapabilityChecker(signals);

  // Scout checks if user can send invoices (regardless of their role)
  if (checker.canSendInvoices()) {
    // Scout now offers invoicing as a next step
    const scoutResponse = {
      message: "Great! I can help you create an invoice. Let me know the total amount, and I'll draft it for you.",
      suggestedActions: [
        "Create invoice for $5,000",
        "Learn about invoice templates",
        "See payment collection options",
      ],
    };

    return scoutResponse;
  }

  // If not, Scout would take a different path
  // (but in this case, message + behavior unlocks it)
}

/**
 * EXAMPLE 2: HOA Management (No Role, But Context Infers It)
 * 
 * A user mentions "board" and "voting" but has no HOA role.
 * Scout infers they may be on an HOA board and offers those tools.
 */
function example_hoaWithoutRole() {
  const userMessage = "Our board is voting on a new vendor for snow removal. How do we compare quotes?";

  const signals = buildCapabilitySignals({
    message: userMessage,
    // Note: NO hoa_board role in profile
  });

  const checker = createCapabilityChecker(signals);

  if (checker.canManageHOA() && checker.canReviewBids()) {
    const scoutResponse = {
      message:
        "I found your board is evaluating vendors. I can help you compare bids side-by-side, track vendor performance, and even share the results with your board.",
      suggestedActions: [
        "Compare the snow removal bids",
        "Create a vendor scorecard",
        "Share results with board members",
      ],
    };

    // Scout might also suggest:
    // "It looks like you're managing HOA decisions. Want to add that to your profile?"
    return scoutResponse;
  }
}

/**
 * EXAMPLE 3: Multi-Role Context Switching
 * 
 * User is both homeowner and contractor.
 * Scout tailors the response based on which "hat" they're wearing right now.
 */
function example_multiRoleContextSwitch() {
  const userMessage = "I just got paid on a job I did, but I also need someone to fix my own roof.";

  const signals = buildCapabilitySignals({
    user: {
      roles: ["homeowner", "contractor"],
    },
    message: userMessage,
  });

  const checker = createCapabilityChecker(signals);

  const scoutResponse = {
    // Acknowledge they're switching contexts
    message:
      "Got it! You're wearing two hats here. Let me help with both: first, let's mark that job paid, then I'll help you find roofers.",

    // Offer both paths
    suggestedActions: [
      "Mark the job as paid in my invoices (contractor mode)",
      "Find roofing contractors in my area (homeowner mode)",
      "See details on both",
    ],

    // Later, Scout could show:
    // - "As a contractor, here's your recent invoices"
    // - "As a homeowner, here are your active projects"
  };

  return scoutResponse;
}

/**
 * EXAMPLE 4: Cold Start (No Profile)
 * 
 * New user, no profile data, but Scout still helps based on behavior.
 */
function example_coldStart() {
  const userMessage = "What can I sell from my garage?";

  const signals = buildCapabilitySignals({
    message: userMessage,
    // No user profile, no recent actions
  });

  const checker = createCapabilityChecker(signals);

  // Check what they can do
  if (checker.canPostMarketplaceItem()) {
    const scoutResponse = {
      message:
        "You can list items in our Exchange marketplace. Everything from tools to equipment to materials. Let me help you create a listing.",
      suggestedActions: [
        "Start a new listing",
        "See what's selling near me",
        "Learn pricing tips",
      ],
    };

    // Optionally suggest profile setup (not required)
    // "If you sell regularly, add that to your profile for faster listings."
    return scoutResponse;
  }
}

/**
 * EXAMPLE 5: Business Owner with Trade Tags
 * 
 * A restaurant owner can post deals based on their trade tag,
 * even without an explicit "business_owner" role.
 */
function example_restaurantOwner() {
  const userMessage = "We're having a 20% off special this weekend.";

  const signals = buildCapabilitySignals({
    user: {
      tradeTags: ["restaurant"],
    },
    message: userMessage,
  });

  const checker = createCapabilityChecker(signals);

  if (checker.canPostDeals() && checker.canRunPromotions()) {
    const scoutResponse = {
      message:
        "Great! I can help you broadcast that special across TradeScout. This reaches regulars and visitors looking for deals.",
      suggestedActions: [
        "Create promotion post for this weekend",
        "See who'll see this deal",
        "Track promotion performance",
      ],
    };

    return scoutResponse;
  }
}

/**
 * EXAMPLE 6: General Contractor with Crew Management
 * 
 * The trade tag "landscaping" + role "contractor" unlocks crew tools.
 */
function example_crewManagement() {
  const userMessage = "I need to schedule my team for three jobs next week.";

  const signals = buildCapabilitySignals({
    user: {
      roles: ["contractor"],
      tradeTags: ["landscaping"],
    },
    message: userMessage,
  });

  const checker = createCapabilityChecker(signals);

  if (checker.canManageCrew() && checker.canScheduleWork()) {
    const scoutResponse = {
      message:
        "I can help you schedule your crew across all three jobs. I'll show you availability conflicts and help optimize routes.",
      suggestedActions: [
        "View crew calendar for next week",
        "Assign team members to jobs",
        "Optimize crew schedules",
      ],
    };

    return scoutResponse;
  }
}

/**
 * EXAMPLE 7: Scout Never Asks "Are you X?"
 * 
 * Instead of asking "Are you a contractor?" Scout infers and confirms.
 */
function example_neverAsks() {
  // Old way (wrong):
  // "Are you a contractor? Yes/No"

  // New way (right):
  // Observe behavior, offer capabilities, suggest profile optionally

  const userMessage = "How do I bid on jobs?";

  const signals = buildCapabilitySignals({
    message: userMessage,
  });

  const checker = createCapabilityChecker(signals);

  if (checker.canBidOnJobs()) {
    const scoutResponse = {
      message:
        "I can help you find and bid on jobs. What type of work do you do?",

      // Scout infers capability from the question itself
      // And offers the flow directly

      suggestedActions: [
        "Show available jobs for contractors",
        "See recent bids I've made",
        "Learn about bidding strategy",
      ],

      // Only AFTER helping might Scout suggest:
      // "If you're actively bidding on jobs, adding your trade to your profile will help me find better matches."
    };

    return scoutResponse;
  }
}

/**
 * HOW TO INTEGRATE THIS INTO SCOUT
 * 
 * In server/routes/scout.ts, after receiving a message:
 * 
 * ```typescript
 * router.post("/", async (req, res) => {
 *   const { message, user, currentPage } = req.body;
 *   
 *   // Build capability signals from all inputs
 *   const signals = buildCapabilitySignals({
 *     user: {
 *       roles: user?.roles,
 *       tradeTags: user?.tradeTags,
 *     },
 *     message,
 *     currentPage,
 *     recentActions: user?.recentActions || [],
 *   });
 *   
 *   const checker = createCapabilityChecker(signals);
 *   
 *   // Now Scout checks capabilities instead of roles:
 *   
 *   if (checker.canSendInvoices()) {
 *     // Suggest invoicing flows
 *   }
 *   
 *   if (checker.canManageHOA()) {
 *     // Suggest HOA flows
 *   }
 *   
 *   if (checker.canPostMarketplaceItem()) {
 *     // Suggest marketplace flows
 *   }
 *   
 *   // No hard role checks. No gating. Just capabilities.
 * ```
 */

/**
 * BENEFIT SUMMARY
 * 
 * ✅ No role barriers
 *    User mentions invoicing → can invoice
 *    User mentions HOA → can manage HOA
 *    User mentions selling → can sell
 *
 * ✅ Multi-role support
 *    Same user, different contexts
 *    Scout adapts without asking "pick one"
 *
 * ✅ Cold start works
 *    No profile? Infer from message + context
 *    Add capabilities as they use them
 *
 * ✅ Scale without fragmentation
 *    Add new trade tags freely
 *    Add new capabilities without rewriting Scout
 *    Same logic for all users
 *
 * ✅ Smart suggestions
 *    "It looks like you're doing X"
 *    "Want to add X to your profile to unlock faster?"
 *    Profiles become hints, not requirements
 */
