import type { ScoutAction, ScoutCluster } from "./state";
import type { ScoutIntentDetail } from "./intentDetails";
import {
  hasMaterialOrSupplierIntent,
  inferMaterialCategory,
  materialProductSummary,
} from "./scoutMaterialSignals";
import { optionBudgetForConfidence, type ScoutConfidenceBand } from "./scoutLearningOptions";

export type ScoutCapabilityId =
  | "plan"
  | "local_help"
  | "materials"
  | "prices"
  | "compare"
  | "trust"
  | "saved"
  | "community";

export type ScoutCapabilityCopy = {
  id: ScoutCapabilityId;
  title: string;
  detail: string;
  prompt: string;
};

export const SCOUT_CAPABILITY_COPY: ScoutCapabilityCopy[] = [
  {
    id: "plan",
    title: "Plan work",
    detail: "Scope, materials, permits, timing, and next steps",
    prompt:
      "Help me plan this work. Show findings, what has to be checked, and the best next paths.",
  },
  {
    id: "local_help",
    title: "Find local help",
    detail: "Pros, requests, saved options, and what to ask first",
    prompt:
      "Find local help for this. Show the best options and what I should know before contacting anyone.",
  },
  {
    id: "materials",
    title: "Materials",
    detail: "Supply Run, supplier links, local products, and Exchange items",
    prompt:
      "Help with materials. I can send a material list or supplier link and Scout can help turn it into a Supply Run.",
  },
  {
    id: "prices",
    title: "Prices and trends",
    detail: "Local ranges, recent signals, and changes worth checking",
    prompt:
      "Check prices and local trends for this. Show what looks normal, what changed, and what to verify.",
  },
  {
    id: "compare",
    title: "Compare options",
    detail: "When there are multiple paths, Scout lays them out",
    prompt:
      "Compare my options. Put the most likely path first and show the other reasonable choices.",
  },
  {
    id: "trust",
    title: "Trust checks",
    detail: "Before contact opens, Scout keeps the safety steps visible",
    prompt: "Help me check trust and safety before I contact anyone. Show what to verify first.",
  },
  {
    id: "saved",
    title: "Saved conversations",
    detail: "Keep findings so you can come back later",
    prompt:
      "Help me continue or save this Scout conversation so I can come back to the findings later.",
  },
  {
    id: "community",
    title: "Community activity",
    detail: "Nearby posts, projects, events, and local signals",
    prompt:
      "Show what is happening near me: local posts, requests, projects, events, and recent changes.",
  },
];

function askScout(label: string, prompt: string): ScoutAction {
  return { type: "ASK_SCOUT", label, prompt };
}

function actionKey(action: ScoutAction): string {
  return [action.type, action.label || "", action.to || "", action.path || "", action.prompt || ""]
    .join("|")
    .toLowerCase();
}

function uniqueActions(actions: ScoutAction[]): ScoutAction[] {
  const seen = new Set<string>();
  const out: ScoutAction[] = [];
  for (const action of actions) {
    const key = actionKey(action);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(action);
  }
  return out;
}

function cleanMessage(value: string): string {
  return String(value || "")
    .replace(/\s+/g, " ")
    .trim();
}

function confidenceActionBudget(band?: ScoutConfidenceBand | string | null): number {
  return Math.max(3, optionBudgetForConfidence(band));
}

function takeActions(actions: ScoutAction[], budget: number): ScoutAction[] {
  return actions.slice(0, budget);
}

function firstUrl(value: string): string | null {
  return value.match(/https?:\/\/[^\s)]+/i)?.[0] ?? null;
}

function hasPriceOrTrendIntent(value: string): boolean {
  return /\b(price|prices|cost|costs|estimate|quote|bid|range|trend|trends|deal|deals|supplier|material|materials)\b/i.test(
    value
  );
}

export function buildScoutExperienceClusters(args: {
  message: string;
  confidenceBand?: ScoutConfidenceBand | string | null;
  intentDetails?: ScoutIntentDetail;
  existingLabels?: string[];
}): ScoutCluster[] {
  const message = cleanMessage(args.message);
  if (!message) return [];

  const existing = new Set((args.existingLabels || []).map((label) => label.toLowerCase()));
  const detail = args.intentDetails;
  const isMaterialNeed = detail?.context === "materials" || hasMaterialOrSupplierIntent(message);
  const supplierUrl = firstUrl(message);
  const materialCategory = inferMaterialCategory(message);
  const actionBudget = confidenceActionBudget(args.confidenceBand);

  const clusters: ScoutCluster[] = [];
  const overviewActions = uniqueActions([
    askScout(
      "Compare the paths",
      `Compare the realistic paths for this. Put the best next path first, then show the other reasonable choices: ${message}`
    ),
    askScout(
      "Plan the work",
      `Plan this with scope, required checks, materials, labor, timing, and next steps: ${message}`
    ),
    { type: "NAVIGATE", label: "Find local help", to: "/direct-connect/pros" },
    askScout(
      "Check prices",
      `Check price factors, local ranges, and what could change the cost for: ${message}`
    ),
    { type: "NAVIGATE", label: "See nearby activity", to: "/community" },
    supplierUrl
      ? {
          type: "NAVIGATE",
          label: "Use supplier link",
          to: `/utilities/supply-run/new?supplierUrl=${encodeURIComponent(supplierUrl)}`,
          subtitle: "Review before anything is sent",
        }
      : {
          type: "NAVIGATE",
          label: "Start a material run",
          to: "/utilities/supply-run/new",
          subtitle: "Review before anything is sent",
        },
  ]).slice(0, actionBudget);

  if (!existing.has("full scout view")) {
    clusters.push({
      id: `full-scout-view-${Date.now()}`,
      title: "Full Scout view",
      kind: "site",
      body: "Scout checks the main angles before you choose: expectation, required steps, feasible paths, local help, materials, prices, and trust.",
      items: [
        {
          id: "expectation",
          label: detail?.expectation ? "Expected result found" : "Expected result still matters",
          description: detail?.expectation || "Add what good looks like if you want a tighter path",
        },
        {
          id: "requirements",
          label: "Required checks",
          description: "Scope, materials, labor, rules, and safety can change the right answer",
        },
        {
          id: "feasible-paths",
          label: "Recommended paths",
          description:
            "Scout puts the most likely path forward and keeps alternatives one tap away",
        },
      ],
      actions: overviewActions,
    });
  }

  if (isMaterialNeed && !existing.has("materials and local options")) {
    clusters.push({
      id: `materials-local-${Date.now()}`,
      title: "Materials and local options",
      kind: "marketplace",
      body: "Scout can help organize products, supplier links, nearby supplier options, and Exchange materials before you order or share anything.",
      items: [
        {
          id: "products",
          label: materialCategory.label,
          description: materialProductSummary(message),
        },
        {
          id: "supplier-link",
          label: "Material list or supplier link",
          description: "Send it here and Scout can help turn it into a Supply Run",
        },
        {
          id: "approval",
          label: "Review before action",
          description:
            "Nothing is ordered, paid, quoted, invoiced, posted, or messaged automatically",
        },
      ],
      actions: takeActions(
        [
          supplierUrl
            ? {
                type: "NAVIGATE",
                label: "Use supplier link",
                to: `/utilities/supply-run/new?supplierUrl=${encodeURIComponent(supplierUrl)}`,
                primary: true,
                subtitle: "Review before anything is sent",
              }
            : {
                type: "NAVIGATE",
                label: "Start a material run",
                to: "/utilities/supply-run/new",
                primary: true,
                subtitle: "Review before anything is sent",
              },
          {
            type: "NAVIGATE",
            label: "Find local suppliers",
            to: "/direct-connect/pros?trade=supplier",
          },
          {
            type: "NAVIGATE",
            label: "Browse Exchange materials",
            to: materialCategory.exchangePath,
          },
          askScout(
            "Compare products",
            `Compare product choices, quantities, specs, and gotchas for: ${message}`
          ),
        ],
        actionBudget
      ),
    });
  }

  if (hasPriceOrTrendIntent(message) && !existing.has("price and trend checks")) {
    clusters.push({
      id: `price-trend-${Date.now()}`,
      title: "Price and trend checks",
      kind: "rules",
      body: "Scout can compare price factors, material signals, nearby posts, and recent local activity before you call, quote, or order.",
      items: [
        {
          id: "materials-source",
          label: "Material price signals",
          description:
            "Use the materials view and supplier links as the source of truth when available",
        },
        {
          id: "community-source",
          label: "Nearby activity",
          description: "Local posts and projects can explain timing, availability, and demand",
        },
        {
          id: "verify-before-use",
          label: "Verify before committing",
          description: "Scout can guide the check, but a supplier or pro confirms the final number",
        },
      ],
      actions: takeActions(
        [
          { type: "NAVIGATE", label: "Open materials view", to: "/finances/materials" },
          { type: "NAVIGATE", label: "See nearby activity", to: "/community" },
          askScout(
            "Check price factors",
            `Compare price factors, local signals, and what needs verification for: ${message}`
          ),
        ],
        actionBudget
      ),
    });
  }

  if (detail?.perspective === "client" && !existing.has("client job prep")) {
    clusters.push({
      id: `client-job-prep-${Date.now()}`,
      title: "Client job prep",
      kind: "projects",
      body: "Because this may be for a client or customer, Scout can keep scope, materials, quote prep, and approvals separated before anything is sent.",
      items: [
        {
          id: "scope",
          label: "Scope before sharing",
          description:
            "Measurements, assumptions, exclusions, and permit checks belong in the draft",
        },
        {
          id: "approval",
          label: "You approve sends",
          description: "Messages, quotes, invoices, and posts stay gated",
        },
      ],
      actions: takeActions(
        [
          askScout(
            "Build client scope",
            `Build a client-ready scope draft with materials, labor, assumptions, and next steps: ${message}`
          ),
          { type: "NAVIGATE", label: "Open project tools", to: "/project-tracker" },
          { type: "NAVIGATE", label: "Open invoices", to: "/finances" },
        ],
        actionBudget
      ),
    });
  }

  return clusters;
}
