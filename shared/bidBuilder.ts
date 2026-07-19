export type BidBuilderDiscipline =
  | "general"
  | "millwork"
  | "doors_windows"
  | "framing"
  | "drywall"
  | "concrete"
  | "roofing"
  | "flooring"
  | "plumbing"
  | "electrical"
  | "hvac";

export type BidBuilderUnit =
  | "each"
  | "linear_ft"
  | "square_ft"
  | "cubic_ft"
  | "cubic_yd"
  | "board_ft"
  | "sheet"
  | "bundle"
  | "hour"
  | "allowance";

export type BidEvidenceSource =
  | "plan_pdf"
  | "field_camera"
  | "manual_measurement"
  | "direct_connect_request"
  | "supplier_catalog"
  | "completed_job_history";

export type BidReviewStatus =
  | "unreviewed"
  | "needs_review"
  | "confirmed"
  | "rejected";

export type BidDraftStatus = "draft" | "review_required" | "ready" | "sent";

export interface BidEvidenceRef {
  source: BidEvidenceSource;
  sourceId: string;
  sourceLabel: string;
  observedAt: string;
  confidence: number;
  pageNumber?: number;
  sheetLabel?: string;
  imageUrl?: string;
  note?: string;
}

export interface BidTakeoffItem {
  itemId: string;
  discipline: BidBuilderDiscipline;
  category: string;
  description: string;
  quantity: number;
  unit: BidBuilderUnit;
  dimensions?: string;
  planTag?: string;
  evidence: BidEvidenceRef[];
  confidence: number;
  reviewStatus: BidReviewStatus;
  warnings: string[];
}

export interface BidPricingBasis {
  materialUnitCostCents?: number;
  laborHours?: number;
  laborRateCents?: number;
  equipmentCostCents?: number;
  permitCostCents?: number;
  disposalCostCents?: number;
  travelCostCents?: number;
  otherCostCents?: number;
  wastePercent?: number;
  overheadPercent?: number;
  profitPercent?: number;
  taxPercent?: number;
  sourceNote?: string;
}

export interface BidBuilderInputLine {
  takeoff: BidTakeoffItem;
  pricing: BidPricingBasis;
}

export interface BidBuilderLineResult {
  lineId: string;
  discipline: BidBuilderDiscipline;
  category: string;
  description: string;
  quantity: number;
  unit: BidBuilderUnit;
  materialCostCents: number;
  laborCostCents: number;
  directCostCents: number;
  overheadCents: number;
  profitCents: number;
  taxCents: number;
  totalCents: number;
  confidence: number;
  reviewStatus: BidReviewStatus;
  evidence: BidEvidenceRef[];
  warnings: string[];
}

export interface TradeScoutBidDraft {
  bidId: string;
  projectId: string;
  title: string;
  scopeSummary: string;
  status: BidDraftStatus;
  createdAt: string;
  lines: BidBuilderLineResult[];
  subtotalCents: number;
  overheadCents: number;
  profitCents: number;
  taxCents: number;
  totalCents: number;
  assumptions: string[];
  exclusions: string[];
  warnings: string[];
}

export interface DirectConnectEstimateLineInput {
  lineType: "material" | "labor" | "permits" | "disposal" | "travel" | "equipment" | "other";
  name: string;
  quantity: number;
  unit: string;
  unitCost: number;
}

const DISCIPLINES = new Set<BidBuilderDiscipline>([
  "general",
  "millwork",
  "doors_windows",
  "framing",
  "drywall",
  "concrete",
  "roofing",
  "flooring",
  "plumbing",
  "electrical",
  "hvac",
]);

const UNITS = new Set<BidBuilderUnit>([
  "each",
  "linear_ft",
  "square_ft",
  "cubic_ft",
  "cubic_yd",
  "board_ft",
  "sheet",
  "bundle",
  "hour",
  "allowance",
]);

function requireText(value: string, field: string): void {
  if (!String(value || "").trim()) throw new Error(`${field} is required`);
}

function requireIso(value: string, field: string): void {
  requireText(value, field);
  if (Number.isNaN(Date.parse(value))) throw new Error(`${field} must be an ISO timestamp`);
}

function requireConfidence(value: number, field: string): void {
  if (!Number.isFinite(value) || value < 0 || value > 1) {
    throw new Error(`${field} must be between 0 and 1`);
  }
}

function requireNonNegativeMoney(value: number | undefined, field: string): number {
  if (value === undefined) return 0;
  if (!Number.isInteger(value) || value < 0) {
    throw new Error(`${field} must be a non-negative integer number of cents`);
  }
  return value;
}

function requirePercent(value: number | undefined, field: string): number {
  if (value === undefined) return 0;
  if (!Number.isFinite(value) || value < 0 || value > 100) {
    throw new Error(`${field} must be between 0 and 100`);
  }
  return value;
}

function cents(value: number): number {
  return Math.round(value);
}

export function assertBidTakeoffItem(item: BidTakeoffItem): void {
  requireText(item.itemId, "itemId");
  requireText(item.category, `category for ${item.itemId}`);
  requireText(item.description, `description for ${item.itemId}`);
  if (!DISCIPLINES.has(item.discipline)) {
    throw new Error(`Unknown discipline for ${item.itemId}: ${item.discipline}`);
  }
  if (!UNITS.has(item.unit)) throw new Error(`Unknown unit for ${item.itemId}: ${item.unit}`);
  if (!Number.isFinite(item.quantity) || item.quantity <= 0) {
    throw new Error(`quantity for ${item.itemId} must be positive`);
  }
  requireConfidence(item.confidence, `confidence for ${item.itemId}`);
  if (!Array.isArray(item.evidence) || item.evidence.length === 0) {
    throw new Error(`Takeoff item ${item.itemId} requires evidence`);
  }
  for (const evidence of item.evidence) {
    requireText(evidence.sourceId, `evidence sourceId for ${item.itemId}`);
    requireText(evidence.sourceLabel, `evidence sourceLabel for ${item.itemId}`);
    requireIso(evidence.observedAt, `evidence observedAt for ${item.itemId}`);
    requireConfidence(evidence.confidence, `evidence confidence for ${item.itemId}`);
    if (evidence.pageNumber !== undefined && (!Number.isInteger(evidence.pageNumber) || evidence.pageNumber <= 0)) {
      throw new Error(`evidence pageNumber for ${item.itemId} must be positive`);
    }
  }
  if (item.confidence < 0.9 && item.reviewStatus === "confirmed") {
    throw new Error(`Low-confidence item ${item.itemId} cannot be confirmed without review`);
  }
}

export function buildTradeScoutBidDraft(input: {
  bidId: string;
  projectId: string;
  title: string;
  scopeSummary: string;
  createdAt: string;
  lines: BidBuilderInputLine[];
  assumptions?: string[];
  exclusions?: string[];
}): TradeScoutBidDraft {
  requireText(input.bidId, "bidId");
  requireText(input.projectId, "projectId");
  requireText(input.title, "title");
  requireText(input.scopeSummary, "scopeSummary");
  requireIso(input.createdAt, "createdAt");
  if (!Array.isArray(input.lines) || input.lines.length === 0) {
    throw new Error("At least one takeoff line is required");
  }

  const ids = new Set<string>();
  const lines = input.lines.map<BidBuilderLineResult>(({ takeoff, pricing }) => {
    assertBidTakeoffItem(takeoff);
    if (ids.has(takeoff.itemId)) throw new Error(`Duplicate takeoff item: ${takeoff.itemId}`);
    ids.add(takeoff.itemId);

    const materialUnitCostCents = requireNonNegativeMoney(
      pricing.materialUnitCostCents,
      `materialUnitCostCents for ${takeoff.itemId}`
    );
    const laborRateCents = requireNonNegativeMoney(
      pricing.laborRateCents,
      `laborRateCents for ${takeoff.itemId}`
    );
    const laborHours = pricing.laborHours ?? 0;
    if (!Number.isFinite(laborHours) || laborHours < 0) {
      throw new Error(`laborHours for ${takeoff.itemId} must be non-negative`);
    }
    const wastePercent = requirePercent(pricing.wastePercent, `wastePercent for ${takeoff.itemId}`);
    const overheadPercent = requirePercent(pricing.overheadPercent, `overheadPercent for ${takeoff.itemId}`);
    const profitPercent = requirePercent(pricing.profitPercent, `profitPercent for ${takeoff.itemId}`);
    const taxPercent = requirePercent(pricing.taxPercent, `taxPercent for ${takeoff.itemId}`);

    const materialBase = takeoff.quantity * materialUnitCostCents;
    const materialCostCents = cents(materialBase * (1 + wastePercent / 100));
    const laborCostCents = cents(laborHours * laborRateCents);
    const equipmentCostCents = requireNonNegativeMoney(
      pricing.equipmentCostCents,
      `equipmentCostCents for ${takeoff.itemId}`
    );
    const permitCostCents = requireNonNegativeMoney(
      pricing.permitCostCents,
      `permitCostCents for ${takeoff.itemId}`
    );
    const disposalCostCents = requireNonNegativeMoney(
      pricing.disposalCostCents,
      `disposalCostCents for ${takeoff.itemId}`
    );
    const travelCostCents = requireNonNegativeMoney(
      pricing.travelCostCents,
      `travelCostCents for ${takeoff.itemId}`
    );
    const otherCostCents = requireNonNegativeMoney(
      pricing.otherCostCents,
      `otherCostCents for ${takeoff.itemId}`
    );

    const directCostCents =
      materialCostCents +
      laborCostCents +
      equipmentCostCents +
      permitCostCents +
      disposalCostCents +
      travelCostCents +
      otherCostCents;
    const overheadCents = cents(directCostCents * (overheadPercent / 100));
    const profitCents = cents((directCostCents + overheadCents) * (profitPercent / 100));
    const taxCents = cents((materialCostCents + otherCostCents) * (taxPercent / 100));
    const warnings = [...takeoff.warnings];

    if (directCostCents === 0) warnings.push("No pricing basis has been entered for this item.");
    if (!pricing.sourceNote?.trim()) warnings.push("Pricing source is not documented.");
    if (takeoff.confidence < 0.9) warnings.push("Measurement or plan extraction needs human review.");

    return {
      lineId: takeoff.itemId,
      discipline: takeoff.discipline,
      category: takeoff.category,
      description: takeoff.description,
      quantity: takeoff.quantity,
      unit: takeoff.unit,
      materialCostCents,
      laborCostCents,
      directCostCents,
      overheadCents,
      profitCents,
      taxCents,
      totalCents: directCostCents + overheadCents + profitCents + taxCents,
      confidence: takeoff.confidence,
      reviewStatus: takeoff.reviewStatus,
      evidence: takeoff.evidence,
      warnings,
    };
  });

  const subtotalCents = lines.reduce((sum, line) => sum + line.directCostCents, 0);
  const overheadCents = lines.reduce((sum, line) => sum + line.overheadCents, 0);
  const profitCents = lines.reduce((sum, line) => sum + line.profitCents, 0);
  const taxCents = lines.reduce((sum, line) => sum + line.taxCents, 0);
  const unresolved = lines.some(
    (line) => line.reviewStatus === "unreviewed" || line.reviewStatus === "needs_review"
  );
  const missingPricing = lines.some((line) => line.directCostCents === 0);
  const warnings = Array.from(new Set(lines.flatMap((line) => line.warnings)));

  return {
    bidId: input.bidId,
    projectId: input.projectId,
    title: input.title.trim(),
    scopeSummary: input.scopeSummary.trim(),
    status: unresolved || missingPricing ? "review_required" : "ready",
    createdAt: input.createdAt,
    lines,
    subtotalCents,
    overheadCents,
    profitCents,
    taxCents,
    totalCents: subtotalCents + overheadCents + profitCents + taxCents,
    assumptions: input.assumptions || [],
    exclusions: input.exclusions || [],
    warnings,
  };
}

export function bidDraftToDirectConnectEstimateLines(
  bid: TradeScoutBidDraft
): DirectConnectEstimateLineInput[] {
  if (bid.status !== "ready") {
    throw new Error("Bid must be ready before it can become a Direct Connect estimate");
  }

  const estimateLines: DirectConnectEstimateLineInput[] = [];
  for (const line of bid.lines) {
    if (line.materialCostCents > 0) {
      estimateLines.push({
        lineType: "material",
        name: `${line.description} — materials`,
        quantity: line.quantity,
        unit: line.unit,
        unitCost: line.materialCostCents / line.quantity / 100,
      });
    }
    if (line.laborCostCents > 0) {
      estimateLines.push({
        lineType: "labor",
        name: `${line.description} — labor`,
        quantity: 1,
        unit: "allowance",
        unitCost: line.laborCostCents / 100,
      });
    }
    const combinedOther =
      line.directCostCents - line.materialCostCents - line.laborCostCents;
    if (combinedOther > 0) {
      estimateLines.push({
        lineType: "other",
        name: `${line.description} — equipment, permits, travel, disposal, and other direct cost`,
        quantity: 1,
        unit: "allowance",
        unitCost: combinedOther / 100,
      });
    }
    const markup = line.overheadCents + line.profitCents;
    if (markup > 0) {
      estimateLines.push({
        lineType: "other",
        name: `${line.description} — overhead and profit`,
        quantity: 1,
        unit: "allowance",
        unitCost: markup / 100,
      });
    }
    if (line.taxCents > 0) {
      estimateLines.push({
        lineType: "other",
        name: `${line.description} — tax`,
        quantity: 1,
        unit: "allowance",
        unitCost: line.taxCents / 100,
      });
    }
  }
  return estimateLines;
}
