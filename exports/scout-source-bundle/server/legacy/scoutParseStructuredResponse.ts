// Legacy helper moved out of server/routes/scout.ts to reduce
// cognitive load in the main Scout orchestrator.
// Kept here temporarily for reference; not imported by active code.

function deriveContextualActions(
  base: string[],
  userMessage: string,
  userContext?: any,
  historyMessages?: { role: string; content: string }[]
): string[] {
  // NOTE: this is a straight copy of the original helper signature.
  // The actual implementation now lives in server/routes/scout.ts
  // so this stub is intentionally empty.
  return base;
}

export function parseStructuredResponse(
  rawResponse: string,
  userMessage: string,
  userContext?: any,
  historyMessages?: { role: string; content: string }[]
): { message: string; suggestedActions: string[] } {
  // This legacy version is preserved only so older experiments can be
  // compared if needed. Active code should NOT import from here.
  return {
    message: rawResponse,
    suggestedActions: [],
  };
}
