import type { ScoutAction, ScoutCluster } from "./state";
import type { ScoutIntentDetail } from "./intentDetails";
import {
  hasMaterialOrSupplierIntent,
  inferMaterialCategory,
  materialProductSummary,
} from "./scoutMaterialSignals";

export type ScoutConfidenceBand = "low" | "medium" | "high" | "unknown";

export type ScoutLearningSignal = {
  key: string;
  label: string;
  value?: string;
  source: "followup_option" | "action_click";
};

export type ScoutLearningSnapshot = {
  signals: Record<string, number>;
  lastSignals: string[];
  updatedAt?: string;
};

const LEARNING_STORAGE_KEY = "scout:learning:v1";

function cleanConfidenceBand(value: unknown): ScoutConfidenceBand {
  return value === "low" || value === "medium" || value === "high" ? value : "unknown";
}

export function optionBudgetForConfidence(value: unknown): number {
  const band = cleanConfidenceBand(value);
  if (band === "high") return 2;
  if (band === "medium") return 3;
  return 5;
}

function normalizeLearningSignal(value: unknown): ScoutLearningSignal | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const source = value as Record<string, unknown>;
  const key = typeof source.key === "string" ? source.key.trim() : "";
  const label = typeof source.label === "string" ? source.label.trim() : key;
  const rawSource =
    source.source === "action_click" || source.source === "followup_option"
      ? source.source
      : "action_click";
  if (!key || !label) return null;
  return {
    key,
    label,
    value: typeof source.value === "string" ? source.value.slice(0, 80) : undefined,
    source: rawSource,
  };
}

function safeSnapshot(value: unknown): ScoutLearningSnapshot {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return { signals: {}, lastSignals: [] };
  }
  const source = value as Record<string, unknown>;
  const rawSignals =
    source.signals && typeof source.signals === "object" && !Array.isArray(source.signals)
      ? (source.signals as Record<string, unknown>)
      : {};
  const signals: Record<string, number> = {};
  for (const [key, count] of Object.entries(rawSignals)) {
    const numeric = Number(count);
    if (key && Number.isFinite(numeric) && numeric > 0) {
      signals[key] = Math.min(99, Math.round(numeric));
    }
  }

  return {
    signals,
    lastSignals: Array.isArray(source.lastSignals)
      ? source.lastSignals
          .filter((item): item is string => typeof item === "string" && item.trim().length > 0)
          .slice(0, 8)
      : [],
    updatedAt: typeof source.updatedAt === "string" ? source.updatedAt : undefined,
  };
}

function readLocalSnapshot(): ScoutLearningSnapshot {
  if (typeof window === "undefined") return { signals: {}, lastSignals: [] };
  try {
    return safeSnapshot(JSON.parse(window.localStorage.getItem(LEARNING_STORAGE_KEY) || "null"));
  } catch {
    return { signals: {}, lastSignals: [] };
  }
}

function writeLocalSnapshot(snapshot: ScoutLearningSnapshot) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(LEARNING_STORAGE_KEY, JSON.stringify(snapshot));
  } catch {
    // best-effort only
  }
}

export function readScoutLearningSnapshot(user?: unknown): ScoutLearningSnapshot {
  const userRecord = user && typeof user === "object" ? (user as Record<string, unknown>) : {};
  const prefs =
    userRecord.preferences &&
    typeof userRecord.preferences === "object" &&
    !Array.isArray(userRecord.preferences)
      ? (userRecord.preferences as Record<string, unknown>)
      : {};
  const scout =
    prefs.scout && typeof prefs.scout === "object" && !Array.isArray(prefs.scout)
      ? (prefs.scout as Record<string, unknown>)
      : {};
  const persisted = safeSnapshot(scout.learning);
  const local = readLocalSnapshot();
  return {
    signals: { ...persisted.signals, ...local.signals },
    lastSignals: [...local.lastSignals, ...persisted.lastSignals].filter(
      (value, index, all) => all.indexOf(value) === index
    ),
    updatedAt: local.updatedAt || persisted.updatedAt,
  };
}

export function mergeScoutLearningSignal(
  snapshot: ScoutLearningSnapshot,
  signal: ScoutLearningSignal
): ScoutLearningSnapshot {
  const nextSignals = { ...snapshot.signals };
  nextSignals[signal.key] = Math.min(99, (nextSignals[signal.key] || 0) + 1);
  const lastSignals = [signal.key, ...snapshot.lastSignals.filter((key) => key !== signal.key)];
  return {
    signals: nextSignals,
    lastSignals: lastSignals.slice(0, 8),
    updatedAt: new Date().toISOString(),
  };
}

export function learningSignalFromAction(action: ScoutAction): ScoutLearningSignal | null {
  return normalizeLearningSignal(action.payload?.scoutLearning);
}

function withLearning(
  action: ScoutAction,
  signal: Omit<ScoutLearningSignal, "source">
): ScoutAction {
  return {
    ...action,
    payload: {
      ...(action.payload || {}),
      scoutLearning: { ...signal, source: "followup_option" },
    },
  };
}

function uniqueActions(actions: ScoutAction[]): ScoutAction[] {
  const seen = new Set<string>();
  const out: ScoutAction[] = [];
  for (const action of actions) {
    const key = [action.type, action.label || "", action.to || "", action.prompt || ""].join("|");
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(action);
  }
  return out;
}

export function buildScoutLearningCluster(args: {
  message: string;
  confidenceBand?: ScoutConfidenceBand | string | null;
  intentDetails?: ScoutIntentDetail;
  existingLabels?: string[];
}): ScoutCluster | null {
  const message = String(args.message || "").trim();
  if (!message) return null;

  const detail = args.intentDetails;
  const existing = new Set((args.existingLabels || []).map((label) => label.toLowerCase()));
  const budget = optionBudgetForConfidence(args.confidenceBand);
  const actions: ScoutAction[] = [];
  const isMaterialNeed = detail?.context === "materials" || hasMaterialOrSupplierIntent(message);
  const materialCategory = inferMaterialCategory(message);

  if (detail?.perspective !== "self") {
    actions.push(
      withLearning(
        {
          type: "ASK_SCOUT",
          label: "This is for my home",
          prompt: `This is for my home or personal property. Keep going with that context: ${message}`,
        },
        { key: "perspective.self", label: "Personal/home need", value: "self" }
      )
    );
  }

  if (detail?.perspective !== "client") {
    actions.push(
      withLearning(
        {
          type: "ASK_SCOUT",
          label: "This is for a client",
          prompt: `This is for a client or customer. Keep going with job scope, materials, quote prep, and approvals: ${message}`,
        },
        { key: "perspective.client", label: "Client job", value: "client" }
      )
    );
  }

  if (isMaterialNeed) {
    actions.push(
      withLearning(
        {
          type: "NAVIGATE",
          label: "Local suppliers",
          to: "/direct-connect/pros?trade=supplier",
        },
        { key: "next.local_suppliers", label: "Local suppliers" }
      ),
      withLearning(
        {
          type: "ASK_SCOUT",
          label: "Products to compare",
          prompt: `Help me compare product choices, specs, quantities, and gotchas for: ${message}`,
        },
        {
          key: "next.product_compare",
          label: "Products to compare",
          value: materialProductSummary(message),
        }
      ),
      withLearning(
        {
          type: "NAVIGATE",
          label: "Exchange materials",
          to: materialCategory.exchangePath,
        },
        { key: "next.exchange_materials", label: "Exchange materials" }
      ),
      withLearning(
        {
          type: "NAVIGATE",
          label: "Start a material run",
          to: "/utilities/supply-run",
        },
        { key: "next.supply_run", label: "Start a material run" }
      )
    );
  }

  if (!isMaterialNeed && !existing.has("find local help")) {
    actions.push(
      withLearning(
        {
          type: "NAVIGATE",
          label: "Find local help",
          to: "/direct-connect/pros",
        },
        { key: "next.local_help", label: "Find local help" }
      )
    );
  }

  if (!isMaterialNeed) {
    actions.push(
      withLearning(
        {
          type: "ASK_SCOUT",
          label: "Check prices",
          prompt: `Help me compare normal price factors and what changes the range for: ${message}`,
        },
        { key: "next.price_guidance", label: "Check prices" }
      )
    );
  }

  if (!isMaterialNeed && detail?.context !== "materials") {
    actions.push(
      withLearning(
        {
          type: "NAVIGATE",
          label: "Start a material run",
          to: "/utilities/supply-run",
        },
        { key: "next.supply_run", label: "Start a material run" }
      )
    );
  }

  if (!detail?.timing) {
    actions.push(
      withLearning(
        {
          type: "ASK_SCOUT",
          label: "I need this soon",
          prompt: `This needs to happen soon. Help me narrow the safest next steps: ${message}`,
        },
        { key: "timing.soon", label: "Soon" }
      )
    );
  }

  actions.push(
    withLearning(
      {
        type: "NAVIGATE",
        label: "See nearby activity",
        to: "/community",
      },
      { key: "next.nearby_activity", label: "See nearby activity" }
    )
  );

  const visibleActions = uniqueActions(actions).slice(0, budget);
  if (visibleActions.length === 0) return null;

  return {
    id: `learn-next-${Date.now()}`,
    title: "Make this fit you",
    kind: "site",
    body: "Tap what matches. Scout uses that signal to narrow this result and remember better defaults over time.",
    items: [
      {
        id: "learn-one-tap",
        label: budget >= 5 ? "More paths ready" : "Fewer paths needed",
        description: "Nothing is sent, posted, ordered, or paid from these taps.",
      },
    ],
    actions: visibleActions,
  };
}

export function persistScoutLearningSignalLocally(
  action: ScoutAction,
  user?: unknown
): ScoutLearningSnapshot | null {
  const signal = learningSignalFromAction(action);
  if (!signal) return null;
  const next = mergeScoutLearningSignal(readScoutLearningSnapshot(user), {
    ...signal,
    source: "action_click",
  });
  writeLocalSnapshot(next);
  return next;
}
