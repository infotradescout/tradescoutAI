import type { ScoutLocality } from "./api";

export type ScoutIntentDetail = {
  need?: string;
  area?: string;
  timing?: string;
  context?: "home" | "vehicle" | "materials" | "project" | "general";
  perspective?: "client" | "self";
  missing: Array<"need" | "area" | "timing" | "context">;
};

export type ScoutIntentDetailPrompt = {
  label: string;
  prompt: string;
};

function cleanSnippet(value: string, max = 52): string {
  const clean = value.replace(/\s+/g, " ").trim();
  if (clean.length <= max) return clean;
  return `${clean.slice(0, max - 3).trim()}...`;
}

function inferContext(text: string): ScoutIntentDetail["context"] {
  if (/\b(car|truck|vehicle|vin|tire|brake|engine|transmission)\b/.test(text)) return "vehicle";
  if (/\b(material|supplier|lowe|home depot|lumber|pipe|wire)\b/.test(text)) {
    return "materials";
  }
  if (
    /\b(home|house|roof|plumb|hvac|ac|heater|electrical|yard|driveway|deck|porch|patio)\b/.test(
      text
    )
  ) {
    return "home";
  }
  if (/\b(project|remodel|build|install|replace|repair)\b/.test(text)) return "project";
  return undefined;
}

function inferPerspective(text: string): ScoutIntentDetail["perspective"] {
  if (
    /\b(client|customer|homeowner|for someone|for somebody|for a customer|for my customer|my crew|my bid|bid this|price this|quote this|invoice)\b/.test(
      text
    )
  ) {
    return "client";
  }
  if (/\b(my house|my home|my place|for me|personal)\b/.test(text)) return "self";
  return undefined;
}

export function inferScoutIntentDetails(
  message?: string,
  locality?: ScoutLocality
): ScoutIntentDetail {
  const raw = String(message || "").trim();
  const text = raw.toLowerCase();
  const area = /\bnear me|nearby\b/.test(text)
    ? "near me"
    : locality?.countyName || locality?.county || locality?.stateCode || locality?.state;
  const timing =
    text.match(/\b(emergency|urgent|asap|today|tomorrow|this week|next week|flexible)\b/)?.[1] ||
    undefined;
  const context = inferContext(text);
  const perspective = inferPerspective(text);
  const hasNeed =
    /\b(repair|replace|install|quote|compare|price|leak|broken|not working|not cooling|material|supplier|project|help)\b/.test(
      text
    ) || raw.length >= 12;

  const detail: ScoutIntentDetail = {
    need: hasNeed ? cleanSnippet(raw) : undefined,
    area,
    timing,
    context,
    perspective,
    missing: [],
  };

  if (!detail.need) detail.missing.push("need");
  if (!detail.area) detail.missing.push("area");
  if (!detail.timing) detail.missing.push("timing");
  if (!detail.context) detail.missing.push("context");

  return detail;
}

export function buildIntentDetailPrompts(
  message?: string,
  locality?: ScoutLocality
): ScoutIntentDetailPrompt[] {
  const detail = inferScoutIntentDetails(message, locality);
  const prompts: ScoutIntentDetailPrompt[] = [];

  if (detail.missing.includes("need")) {
    prompts.push({ label: "Add what happened", prompt: "More detail: the issue is " });
  }
  if (detail.missing.includes("area")) {
    prompts.push({ label: "Add location", prompt: "More detail: this is in " });
  }
  if (detail.missing.includes("timing")) {
    prompts.push({ label: "Add timing", prompt: "More detail: I need this " });
  }

  if (detail.context === "materials") {
    prompts.push({
      label: "Add material list or link",
      prompt: "Material list or supplier link: ",
    });
  } else if (detail.context === "vehicle") {
    prompts.push({
      label: "Add vehicle details",
      prompt: "Vehicle details: year, make, model, and issue are ",
    });
  } else {
    prompts.push({ label: "Add home or project details", prompt: "Home or project details: " });
  }

  return prompts.slice(0, 3);
}

export function formatIntentDetailChips(detail: ScoutIntentDetail): string[] {
  return [
    detail.need ? `Need: ${detail.need}` : null,
    detail.area ? `Area: ${detail.area}` : null,
    detail.timing ? `When: ${detail.timing}` : null,
    detail.perspective === "client" ? "For: client job" : null,
    detail.context ? `Context: ${detail.context}` : null,
  ].filter((value): value is string => Boolean(value));
}
