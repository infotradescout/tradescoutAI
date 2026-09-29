export type DirectConnectSolicitationDecision = {
  action: "allow" | "block";
  score: number;
  reasons: string[];
};

/**
 * Conservative, high-confidence solicitation guard for public-profile Direct Connect.
 *
 * Design goal: preserve genuine customer requests. We only block when multiple
 * outbound-sales signals agree, or when explicit bulk-marketing opt-out language
 * is paired with another prospecting signal. Ambiguous messages pass through.
 */
export function classifyDirectConnectSolicitation(input: {
  message: string;
  name?: string | null;
  email?: string | null;
  requestType?: string | null;
}): DirectConnectSolicitationDecision {
  const text = [input.message, input.name, input.email].filter(Boolean).join(" ").toLowerCase();

  let score = 0;
  const reasons: string[] = [];

  const add = (points: number, reason: string) => {
    score += points;
    reasons.push(reason);
  };

  const explicitOptOut =
    /\b(?:reply|respond|text)\s+(?:with\s+)?stop\b/.test(text) ||
    /\bopt[ -]?out\b/.test(text) ||
    /\bunsubscribe\b/.test(text);
  if (explicitOptOut) add(5, "bulk_marketing_opt_out_language");

  const salesRole =
    /\b(?:business development|sales|account)\s+(?:rep(?:resentative)?|manager|executive)\b/.test(text) ||
    /\b(?:bdr|sdr)\b/.test(text);
  if (salesRole) add(3, "sales_role_language");

  const prospecting =
    /\b(?:we|i)\s+(?:help|work with|serve)\s+(?:many\s+)?(?:local\s+)?(?:companies|businesses|organizations)\b/.test(text) ||
    /\b(?:reaching out|wanted to reach out|hoping to connect|introduce (?:myself|our company))\b/.test(text);
  if (prospecting) add(2, "prospecting_language");

  const outboundOffer =
    /\b(?:come by|stop by|schedule (?:a )?(?:demo|visit|consultation)|offer (?:you |a |an )|provide (?:you |a |an ))\b/.test(text) &&
    /\b(?:complimentary|free|cleaning|marketing|seo|insurance|staffing|payroll|merchant|facility|janitorial|demo|consultation|bid)\b/.test(text);
  if (outboundOffer) add(2, "outbound_service_offer");

  const asksTargetToBuy =
    /\b(?:your company|your business|you)\b.{0,80}\b(?:need|interested in|looking for)\b.{0,80}\b(?:our|my)\b/.test(text);
  if (asksTargetToBuy) add(2, "seller_to_business_pitch");

  // Never block merely because a visitor asks for a quote, estimate, bid, price,
  // service, or free consultation. Those are normal customer intents.
  const highConfidence =
    (explicitOptOut && score >= 7) ||
    (salesRole && prospecting && outboundOffer && score >= 7) ||
    (salesRole && asksTargetToBuy && score >= 7);

  return {
    action: highConfidence ? "block" : "allow",
    score,
    reasons,
  };
}
