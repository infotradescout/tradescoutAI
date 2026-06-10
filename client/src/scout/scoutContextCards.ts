import type { ScoutAction } from "./state";
import type { ScoutTileContext } from "./scoutActionTiles";
import {
  hasMaterialOrSupplierIntent,
  inferMaterialCategory,
  materialProductSummary,
} from "./scoutMaterialSignals";

export type ScoutContextCardKind =
  | "project"
  | "home"
  | "vehicle"
  | "pro"
  | "nearby"
  | "supplier"
  | "material"
  | "marketplace";

export type ScoutContextCard = {
  id: string;
  kind: ScoutContextCardKind;
  label: string;
  description: string;
  action: ScoutAction;
  prompt: string;
};

function normalize(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function hasAny(text: string, terms: string[]): boolean {
  return terms.some((term) => text.includes(term));
}

function words(value: string): string[] {
  return normalize(value)
    .split(" ")
    .filter((word) => word.length >= 4);
}

function titleMatchesQuery(title: string, query: string): boolean {
  const queryWords = new Set(words(query));
  if (queryWords.size === 0) return false;
  return words(title).some((word) => queryWords.has(word));
}

export function buildScoutContextCards(
  ctx: ScoutTileContext,
  rawQuery?: string,
  maxCards = 4
): ScoutContextCard[] {
  const query = normalize(rawQuery || "");
  const cards: ScoutContextCard[] = [];
  const activeJobs = Array.isArray(ctx.activeJobs) ? ctx.activeJobs : [];
  const activeInvoices = Array.isArray(ctx.activeInvoices) ? ctx.activeInvoices : [];
  const savedContractors = Array.isArray(ctx.savedContractors) ? ctx.savedContractors : [];
  const homes = Array.isArray(ctx.homes) ? ctx.homes : [];
  const vehicles = Array.isArray(ctx.vehicles) ? ctx.vehicles : [];

  const wantsHome =
    !query ||
    hasAny(query, [
      "home",
      "house",
      "roof",
      "ac",
      "hvac",
      "heat",
      "plumb",
      "electric",
      "concrete",
      "driveway",
      "fence",
      "appliance",
      "remodel",
      "yard",
    ]);
  const wantsVehicle =
    !query ||
    hasAny(query, [
      "vehicle",
      "car",
      "truck",
      "auto",
      "mechanic",
      "service",
      "repair shop",
      "suv",
      "brake",
      "tire",
      "engine",
      "oil",
      "battery",
      "alternator",
      "starter",
      "transmission",
      "mileage",
    ]);
  const wantsProject =
    !query ||
    hasAny(query, [
      "project",
      "job",
      "quote",
      "estimate",
      "request",
      "repair",
      "install",
      "service",
      "maintenance",
    ]) ||
    activeJobs.some((job) => titleMatchesQuery(job.name, query));
  const wantsPro =
    !query ||
    hasAny(query, ["contractor", "pro", "help", "plumber", "electrician", "roofer", "handyman"]);
  const wantsSupplyRun = hasMaterialOrSupplierIntent(query);

  if (wantsProject && activeJobs.length > 0) {
    const job = activeJobs.find((item) => titleMatchesQuery(item.name, query)) || activeJobs[0];
    cards.push({
      id: `project-${job.id}`,
      kind: "project",
      label:
        activeJobs.length === 1 ? `Continue ${job.name}` : `${activeJobs.length} open projects`,
      description: "Keep this tied to work you already started.",
      action: { type: "NAVIGATE", label: "Open projects", to: "/direct-connect" },
      prompt: `Help me continue this project and choose the best next move: ${job.name}.`,
    });
  }

  if (activeInvoices.length > 0 && hasAny(query, ["invoice", "payment", "pay", "bill", "quote"])) {
    cards.push({
      id: "invoice-active",
      kind: "project",
      label:
        activeInvoices.length === 1
          ? `Review ${activeInvoices[0].jobName || "active invoice"}`
          : `${activeInvoices.length} active invoices`,
      description: "Only show payments when there is an actual transaction.",
      action: { type: "NAVIGATE", label: "Open invoices", to: "/finances" },
      prompt: `Help me review what to check before I handle this invoice: ${rawQuery || "my invoice"}.`,
    });
  }

  if (wantsSupplyRun) {
    const materialCategory = inferMaterialCategory(query);
    const products = materialProductSummary(query);
    cards.push(
      {
        id: "local-suppliers",
        kind: "supplier",
        label: "Local suppliers",
        description: "Find nearby supplier options before anything is contacted or ordered.",
        action: {
          type: "NAVIGATE",
          label: "Find local suppliers",
          to: "/direct-connect/pros?trade=supplier",
        },
        prompt: `Help me identify local supplier options and what to verify before ordering: ${rawQuery || "materials"}.`,
      },
      {
        id: "product-options",
        kind: "material",
        label: materialCategory.label,
        description: `Compare products to check: ${products}.`,
        action: {
          type: "NAVIGATE",
          label: "Compare products",
          to: materialCategory.exchangePath,
        },
        prompt: `Help me compare product options and specs for: ${rawQuery || materialCategory.label}.`,
      },
      {
        id: "exchange-materials",
        kind: "marketplace",
        label: "Exchange materials",
        description: "Check nearby material, tool, and equipment listings.",
        action: { type: "NAVIGATE", label: "Browse Exchange", to: materialCategory.exchangePath },
        prompt: `Search appropriate Exchange categories for materials or tools related to: ${rawQuery || "this job"}.`,
      },
      {
        id: "supply-run",
        kind: "project",
        label: "Start a material run",
        description:
          "Send a material list or supplier link and Scout will turn it into a Supply Run draft.",
        action: { type: "NAVIGATE", label: "Open Supply Run", to: "/utilities/supply-run" },
        prompt: `Help me turn this into a Supply Run: ${rawQuery || "materials or supplier link"}.`,
      }
    );
  }

  if (wantsHome && homes.length > 0) {
    const home = homes[0];
    cards.push({
      id: `home-${home.id}`,
      kind: "home",
      label: home.label || "Your home",
      description: "Use saved home details only where they help.",
      action: { type: "NAVIGATE", label: "Open Home Vault", to: "/homes" },
      prompt: `Use my saved home details to help with this: ${rawQuery || "home help"}.`,
    });
  } else if (wantsHome && homes.length === 0 && query) {
    cards.push({
      id: "home-add",
      kind: "home",
      label: "Add your home",
      description: "Save home details once for better project help.",
      action: { type: "NAVIGATE", label: "Add home", to: "/homes" },
      prompt: `Help me with this home issue even though I have not saved home details yet: ${rawQuery}.`,
    });
  }

  if (wantsVehicle && vehicles.length > 0) {
    const vehicle = vehicles[0];
    cards.push({
      id: `vehicle-${vehicle.id}`,
      kind: "vehicle",
      label: vehicle.label || "Your vehicle",
      description: "Use saved vehicle details for service, records, or listings.",
      action: { type: "NAVIGATE", label: "Open Vehicle Vault", to: "/vehicles" },
      prompt: `Use my saved vehicle details to help with this: ${rawQuery || "vehicle help"}.`,
    });
  } else if (wantsVehicle && vehicles.length === 0 && query) {
    cards.push({
      id: "vehicle-add",
      kind: "vehicle",
      label: "Add a vehicle",
      description: "Save service history, repairs, and documents in one place.",
      action: { type: "NAVIGATE", label: "Add vehicle", to: "/vehicles" },
      prompt: `Help me with this vehicle issue even though I have not saved vehicle details yet: ${rawQuery}.`,
    });
  }

  if (wantsPro && savedContractors.length > 0) {
    cards.push({
      id: "saved-pros",
      kind: "pro",
      label:
        savedContractors.length === 1
          ? `Use ${savedContractors[0].name}`
          : `${savedContractors.length} saved pros`,
      description: "Start with people you already saved.",
      action: { type: "NAVIGATE", label: "Saved pros", to: "/direct-connect/pros" },
      prompt: `Help me decide whether one of my saved pros fits this: ${rawQuery || "local help"}.`,
    });
  }

  cards.push({
    id: "nearby-activity",
    kind: "nearby",
    label: "See nearby activity",
    description: "Local posts and signals stay available without using chat.",
    action: { type: "NAVIGATE", label: "See local posts", to: "/community" },
    prompt: `Check nearby activity that may help with: ${rawQuery || "local help"}.`,
  });

  const seen = new Set<string>();
  return cards
    .filter((card) => {
      if (seen.has(card.id)) return false;
      seen.add(card.id);
      return true;
    })
    .slice(0, maxCards);
}
