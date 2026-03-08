export type ProjectTradeType = "plumber" | "electrician" | "hvac" | "general";

export type ProjectUrgency = "immediate" | "soon" | "flexible";

export type MaterialsStatus = "has_materials" | "needs_pro_to_supply";

export const PROJECT_CLARIFIER_UNKNOWNS = {
  tradeType: "Trade type not specified",
  urgency: "Urgency not specified",
  materials: "Materials status unknown",
  photos: "No photos of the issue/area",
  age: "Age of system/structure unknown",
  scope: "Scope/size not specified",
} as const;

export function inferTradeTypeFromText(lower: string): ProjectTradeType | null {
  if (!lower) return null;
  if (/\b(plumb|plumber|water heater|pipe|leak|toilet|faucet|drain)\b/i.test(lower))
    return "plumber";
  if (/\b(electric|electrician|breaker|panel|outlet|wiring|circuit)\b/i.test(lower))
    return "electrician";
  if (/\b(hvac|a\/c|ac\b|air conditioner|furnace|heat pump|thermostat)\b/i.test(lower))
    return "hvac";
  return null;
}

export function inferUrgencyFromText(lower: string): ProjectUrgency | null {
  if (!lower) return null;
  if (/\b(asap|urgent|emergency|right now|today|tonight)\b/i.test(lower)) return "immediate";
  if (/\b(soon|this week|next week|in a few days)\b/i.test(lower)) return "soon";
  if (/\b(no rush|whenever|flexible|planning|in the next month)\b/i.test(lower)) return "flexible";
  return null;
}

export function inferMaterialsStatusFromText(lower: string): MaterialsStatus | null {
  if (!lower) return null;
  if (/\b(i have|already have|materials? on hand|parts? on hand|bought)\b/i.test(lower))
    return "has_materials";
  if (
    /\b(need you to supply|need them to supply|provide materials|bring materials|need parts)\b/i.test(
      lower
    )
  )
    return "needs_pro_to_supply";
  return null;
}

export function getTradeClarifierQuestion(tradeType: ProjectTradeType): string {
  switch (tradeType) {
    case "plumber":
      return "Is this an active leak/emergency or a planned install?";
    case "electrician":
      return "Are you trying to repair an existing circuit/outlet, or add something new?";
    case "hvac":
      return "Is the system completely down, or just underperforming?";
    default:
      return "Do you already have the materials, or should the pro supply them?";
  }
}
