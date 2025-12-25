// Deterministic intent helpers for Scout deal-room style flows.
// This module stays pure and has no dependency on Express or the main
// scout route so it can be tested and evolved independently.

export type DeterministicIntent =
  | "send_invoice"
  | "mark_invoice_paid"
  | "send_contract"
  | "sign_contract"
  | "open_deal_room";

export interface DeterministicContext {
  allowedActions?: string[];
  // Additional fields are allowed but not required; the
  // main route passes through the full resolvedContext.
  [key: string]: unknown;
}

function deriveDeterministicIntentInternal(message: string): DeterministicIntent | null {
  const lower = message.toLowerCase();
  // Mark invoice paid: handle common phrasing variations
  if (/mark (it )?paid|record payment|mark .*invoice paid|payment received/.test(lower)) {
    return "mark_invoice_paid";
  }
  // Send invoice
  if (/send (the )?invoice|invoice.*send/.test(lower)) {
    return "send_invoice";
  }
  // Send contract
  if (/send (the )?contract|contract.*send/.test(lower)) {
    return "send_contract";
  }
  // Sign contract
  if (/(sign|e-sign|esign|esig).*(contract)|contract.*sign/.test(lower)) {
    return "sign_contract";
  }
  // Open deal room / project tracker
  if (/open (the )?(deal\s*room|project\s*tracker|job\s*room)/.test(lower)) {
    return "open_deal_room";
  }
  return null;
}

function allowsAction(ctx: DeterministicContext | null, action: string): boolean {
  if (!ctx || !Array.isArray(ctx.allowedActions)) return false;
  return ctx.allowedActions.includes(action);
}

export function deriveDeterministicIntent(message: string): DeterministicIntent | null {
  return deriveDeterministicIntentInternal(message);
}

export function maybeHandleDeterministicIntent(args: {
  message: string;
  resolvedContext: DeterministicContext | null;
  currentJobId: string | null;
}):
  | {
      intent: DeterministicIntent;
      message: string;
      suggestedActions: string[];
      actions: {
        type: string;
        label: string;
        path: string;
        payload: { jobId: string; intent: DeterministicIntent };
      }[];
      metadata: {
        intent: DeterministicIntent;
        decision: string;
        resolvedContext: DeterministicContext & { requiresLLM: boolean };
      };
    }
  | null {
  const { message, resolvedContext, currentJobId } = args;
  const deterministicIntent = deriveDeterministicIntentInternal(message);
  if (!deterministicIntent || !resolvedContext || !currentJobId) {
    return null;
  }

  let actionLabel = "";
  let actionExplanation = "";
  let allowedKey: string | null = null;

  switch (deterministicIntent) {
    case "send_invoice":
      allowedKey = "SEND_INVOICE";
      actionLabel = "Open deal room";
      actionExplanation =
        "You can send the invoice for this project now. I'll open your deal room so you can review and send it.";
      break;
    case "mark_invoice_paid":
      allowedKey = "MARK_INVOICE_PAID";
      actionLabel = "Open deal room";
      actionExplanation =
        "You can record payment on this invoice from the deal room. I'll open it so you can mark it paid.";
      break;
    case "send_contract":
      allowedKey = "SEND_CONTRACT";
      actionLabel = "Open deal room";
      actionExplanation =
        "The contract is ready to send for signature. I'll open your deal room so you can send it.";
      break;
    case "sign_contract":
      allowedKey = "SIGN_CONTRACT";
      actionLabel = "Open deal room";
      actionExplanation =
        "This contract is waiting on signatures. I'll open your deal room so you can sign it.";
      break;
    case "open_deal_room":
      allowedKey = "OPEN_DEAL_ROOM";
      actionLabel = "Open deal room";
      actionExplanation =
        "I'll open your project deal room so you can handle this.";
      break;
  }

  if (!allowedKey || !allowsAction(resolvedContext, allowedKey)) {
    return null;
  }

  return {
    intent: deterministicIntent,
    message: actionExplanation,
    suggestedActions: [
      "Explain what’s blocking this project",
      "Show other ways TradeScout can help",
      "Ask another question",
    ],
    actions: [
      {
        type: "NAVIGATE",
        label: actionLabel,
        path: `/lead-management?jobId=${currentJobId}`,
        payload: { jobId: currentJobId, intent: deterministicIntent },
      },
    ],
    metadata: {
      intent: deterministicIntent,
      decision:
        "Handled via deterministic route based on project documents and allowed actions.",
      resolvedContext: {
        ...resolvedContext,
        requiresLLM: false,
      } as DeterministicContext & { requiresLLM: boolean },
    },
  };
}
