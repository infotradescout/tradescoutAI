import { createHash } from "node:crypto";
import type {
  ScoutActionContract,
  ScoutAllowedActionV1,
  ScoutAmbiguityOptionV1,
  ScoutEvidenceV1,
  ScoutPublicEntityV1,
  ScoutResultContractIntentV1,
} from "../../shared/types/scout";

export const SCOUT_RESULT_CONTRACT_VERSION = "scout_result.v1" as const;

type IntentScore = Record<ScoutResultContractIntentV1, number>;

type IntentDecision = {
  intent: ScoutResultContractIntentV1;
  ambiguity: ScoutResultContractIntentV1[];
};

type BuildScoutResultContractInput = {
  requestMessage?: string | null;
  source: Record<string, unknown>;
  answer: string;
  actions?: ScoutActionContract[];
  suggestedActions?: string[];
  workingMemoryUpdate?: Record<string, unknown> | null;
};

const INTENT_LABELS: Record<
  ScoutResultContractIntentV1,
  { label: string; prompt: string }
> = {
  provider_search: {
    label: "Find Local Providers",
    prompt: "Find qualified local providers for this need.",
  },
  code_query: {
    label: "Check Codes or Requirements",
    prompt: "Answer this as a code, permit, pricing, or requirements question.",
  },
  asset_action: {
    label: "Work With My Saved Item",
    prompt: "Help me create, update, open, or act on the relevant TradeScout item.",
  },
};

function isObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function cleanText(value: unknown, maxChars: number): string {
  return typeof value === "string" ? value.trim().slice(0, maxChars) : "";
}

function stableId(prefix: string, value: string): string {
  const slug = value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 40);
  const digest = createHash("sha256").update(value).digest("hex").slice(0, 10);
  return `${prefix}_${slug || "source"}_${digest}`;
}

function mapExistingIntent(value: unknown): ScoutResultContractIntentV1 | null {
  const normalized = cleanText(value, 120).toLowerCase();
  if (!normalized) return null;
  if (
    /provider|contractor|direct_connect|find_(?:a_)?pro|hire|service_search/.test(normalized)
  ) {
    return "provider_search";
  }
  if (
    /asset|profile|listing|marketplace|community|project|job|invoice|payment|message|navigate|auth_required|action/.test(
      normalized
    )
  ) {
    return "asset_action";
  }
  if (/code|permit|knowledge|pricing|question|general|help|information/.test(normalized)) {
    return "code_query";
  }
  return null;
}

export function inferScoutResultIntentV1(
  requestMessage: unknown,
  existingIntent?: unknown
): IntentDecision {
  const message = cleanText(requestMessage, 4_000).toLowerCase();
  const scores: IntentScore = {
    code_query: 0,
    provider_search: 0,
    asset_action: 0,
  };

  const mappedExisting = mapExistingIntent(existingIntent);
  if (mappedExisting) scores[mappedExisting] += 6;

  if (
    /\b(contractor|provider|plumber|electrician|roofer|hvac|handyman|painter|builder|mechanic|installer)\b/.test(
      message
    )
  ) {
    scores.provider_search += 3;
  }
  if (/\b(find|hire|compare|match|quote|available|near me|in my area)\b/.test(message)) {
    scores.provider_search += 2;
  }

  if (
    /\b(codes?|permits?|inspections?|requirements?|regulations?|zoning|ordinances?|jurisdiction|tax|rules?|compliance)\b/.test(
      message
    )
  ) {
    scores.code_query += 6;
  }
  if (/^(what|why|how|when|where|which|can|do|does|is|are)\b/.test(message)) {
    scores.code_query += 1;
  }
  if (/\b(cost|price|pricing|material|specification|explain)\b/.test(message)) {
    scores.code_query += 2;
  }

  if (
    /\b(open|create|draft|post|publish|list|save|update|edit|upload|send|message|pay|invoice|schedule|start|join|add|remove|replace|attach|mark|record|prepare|turn|take|use)\b/.test(
      message
    )
  ) {
    scores.asset_action += 3;
  }
  if (
    /^(open|create|draft|post|publish|list|save|update|edit|upload|send|schedule|start|join|add|remove|replace|attach|mark|record|prepare|turn|take|use)\b/.test(
      message
    )
  ) {
    scores.asset_action += 3;
  }
  if (
    /\b(profile|listing|project|job|request|invoice|payment|document|photos?|community|exchange|direct connect|dashboard|homeid|inventory|services?|hours?|hero|cover|certificate|license|evidence|promotion|contract|note)\b/.test(
      message
    )
  ) {
    scores.asset_action += 2;
  }

  const ranked = (Object.entries(scores) as Array<[ScoutResultContractIntentV1, number]>).sort(
    (a, b) => b[1] - a[1] || a[0].localeCompare(b[0])
  );
  const [top, second] = ranked;
  const intent = top?.[1] > 0 ? top[0] : "code_query";
  const isBroadHelp = /^(help|help me|what can scout do|i need help)[?.!]*$/.test(message);
  const ambiguity = isBroadHelp
    ? (["provider_search", "code_query", "asset_action"] as ScoutResultContractIntentV1[])
    : second && second[1] >= 3 && top[1] - second[1] <= 1
      ? ranked.filter((entry) => entry[1] >= second[1]).map((entry) => entry[0])
      : [];

  return { intent, ambiguity };
}

function normalizeUrl(value: unknown): string | null {
  const raw = cleanText(value, 2_000);
  if (!raw) return null;
  if (raw.startsWith("/")) return raw;
  try {
    const parsed = new URL(raw);
    return parsed.protocol === "https:" || parsed.protocol === "http:" ? parsed.toString() : null;
  } catch {
    return null;
  }
}

function normalizeEvidenceItem(raw: unknown): ScoutEvidenceV1 | null {
  if (typeof raw === "string") {
    const title = cleanText(raw, 300);
    if (!title || /no reliable source found/i.test(title)) return null;
    return {
      source_id: stableId("src", title),
      title,
      url: null,
    };
  }
  if (!isObject(raw)) return null;
  const title =
    cleanText(raw.title ?? raw.label ?? raw.name ?? raw.source_id, 300) || "TradeScout source";
  const url = normalizeUrl(raw.url ?? raw.href);
  const sourceId =
    cleanText(raw.source_id ?? raw.sourceId ?? raw.id, 160) ||
    stableId("src", `${title}|${url || ""}`);
  return {
    source_id: sourceId,
    title,
    url,
    ...(cleanText(raw.type, 80) ? { type: cleanText(raw.type, 80) } : {}),
    ...(cleanText(raw.provider, 120) ? { provider: cleanText(raw.provider, 120) } : {}),
    ...(cleanText(raw.match_reason ?? raw.matchReason, 500)
      ? { match_reason: cleanText(raw.match_reason ?? raw.matchReason, 500) }
      : {}),
  };
}

function collectEvidence(source: Record<string, unknown>): ScoutEvidenceV1[] {
  const knowledge = isObject(source.knowledge) ? source.knowledge : {};
  const candidates = [
    ...(Array.isArray(source.evidence) ? source.evidence : []),
    ...(Array.isArray(knowledge.sources) ? knowledge.sources : []),
  ];
  const seen = new Set<string>();
  const evidence: ScoutEvidenceV1[] = [];

  for (const candidate of candidates) {
    const normalized = normalizeEvidenceItem(candidate);
    if (!normalized) continue;
    const key = `${normalized.source_id}|${normalized.url || ""}`;
    if (seen.has(key)) continue;
    seen.add(key);
    evidence.push(normalized);
  }
  return evidence.slice(0, 25);
}

function normalizeEntity(raw: unknown): ScoutPublicEntityV1 | null {
  if (!isObject(raw)) return null;
  const id = cleanText(raw.id ?? raw.entity_id ?? raw.entityId, 160);
  const type = cleanText(raw.type ?? raw.entity_type ?? raw.entityType, 80);
  if (!id || !type) return null;
  return {
    id,
    type,
    ...(cleanText(raw.name ?? raw.label ?? raw.title, 300)
      ? { name: cleanText(raw.name ?? raw.label ?? raw.title, 300) }
      : {}),
    ...(normalizeUrl(raw.url ?? raw.href) ? { url: normalizeUrl(raw.url ?? raw.href) } : {}),
    ...(Array.isArray(raw.match_reasons)
      ? {
          match_reasons: raw.match_reasons
            .map((value) => cleanText(value, 300))
            .filter(Boolean)
            .slice(0, 8),
        }
      : {}),
  };
}

function collectEntities(source: Record<string, unknown>): ScoutPublicEntityV1[] {
  const candidates = [
    ...(Array.isArray(source.entities) ? source.entities : []),
    ...(Array.isArray(source.publicEntities) ? source.publicEntities : []),
  ];
  const seen = new Set<string>();
  const entities: ScoutPublicEntityV1[] = [];
  for (const candidate of candidates) {
    const normalized = normalizeEntity(candidate);
    if (!normalized) continue;
    const key = `${normalized.type}:${normalized.id}`;
    if (seen.has(key)) continue;
    seen.add(key);
    entities.push(normalized);
  }
  return entities.slice(0, 50);
}

function actionRequiresConfirmation(type: string): boolean {
  return !new Set(["NAVIGATE", "EXTERNAL_LINK", "ASK_SCOUT", "PREFILL_INPUT", "NOOP"]).has(
    type.toUpperCase()
  );
}

function buildAllowedActions(
  actions: ScoutActionContract[],
  suggestedActions: string[],
  ambiguity: ScoutResultContractIntentV1[]
): {
  allowedActions: ScoutAllowedActionV1[];
  ambiguityOptions: ScoutAmbiguityOptionV1[];
} {
  const allowedActions: ScoutAllowedActionV1[] = [];
  const ambiguityOptions: ScoutAmbiguityOptionV1[] = [];
  const seen = new Set<string>();

  for (const [index, ambiguityIntent] of ambiguity.entries()) {
    const definition = INTENT_LABELS[ambiguityIntent];
    const actionId = `amb_${index + 1}`;
    ambiguityOptions.push({ label: definition.label, action_id: actionId });
    allowedActions.push({
      action_id: actionId,
      type: "ASK_SCOUT",
      label: definition.label,
      prompt: definition.prompt,
      requires_confirmation: false,
    });
    seen.add(`ask_scout|${definition.label.toLowerCase()}|${definition.prompt.toLowerCase()}`);
  }

  let actionOrdinal = 1;
  for (const action of actions) {
    const target = action.to || action.path || action.prompt || "";
    const key = `${action.type.toLowerCase()}|${action.label.toLowerCase()}|${target.toLowerCase()}`;
    if (seen.has(key)) continue;
    seen.add(key);
    allowedActions.push({
      action_id: `act_${actionOrdinal++}`,
      type: action.type,
      label: action.label,
      ...(action.to ? { target: action.to } : action.path ? { target: action.path } : {}),
      ...(action.prompt ? { prompt: action.prompt } : {}),
      ...(action.payload ? { payload: action.payload } : {}),
      ...(typeof action.primary === "boolean" ? { primary: action.primary } : {}),
      requires_confirmation: actionRequiresConfirmation(action.type),
    });
  }

  for (const suggestion of suggestedActions) {
    const label = cleanText(suggestion, 160);
    if (!label) continue;
    const key = `ask_scout|${label.toLowerCase()}|${label.toLowerCase()}`;
    if (seen.has(key)) continue;
    seen.add(key);
    allowedActions.push({
      action_id: `act_${actionOrdinal++}`,
      type: "ASK_SCOUT",
      label,
      prompt: label,
      requires_confirmation: false,
    });
  }

  return {
    allowedActions: allowedActions.slice(0, 12),
    ambiguityOptions,
  };
}

export function buildScoutResultContractV1(input: BuildScoutResultContractInput) {
  const metadata = isObject(input.source.metadata) ? input.source.metadata : {};
  const intentDecision = inferScoutResultIntentV1(
    input.requestMessage,
    input.source.intent ?? metadata.intent
  );
  const { allowedActions, ambiguityOptions } = buildAllowedActions(
    input.actions || [],
    input.suggestedActions || [],
    intentDecision.ambiguity
  );
  const workingMemoryUpdate =
    input.workingMemoryUpdate && isObject(input.workingMemoryUpdate)
      ? input.workingMemoryUpdate
      : isObject(input.source.working_memory_update)
        ? input.source.working_memory_update
        : {};

  return {
    contract_version: SCOUT_RESULT_CONTRACT_VERSION,
    intent: intentDecision.intent,
    ambiguity_options: ambiguityOptions,
    entities: collectEntities(input.source),
    evidence: collectEvidence(input.source),
    answer: input.answer,
    allowed_actions: allowedActions,
    working_memory_update: workingMemoryUpdate,
  };
}
