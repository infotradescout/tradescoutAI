export type InspectionSurface =
  | "exchange"
  | "homescout"
  | "scoutfitters"
  | "scout"
  | "direct_connect";

export type InspectionMode =
  | "permit_inspection"
  | "home_inspection"
  | "insurance_claim"
  | "pre_sale"
  | "item_valuation"
  | "equipment_condition";

export const INSPECTION_SURFACES: InspectionSurface[] = [
  "exchange",
  "homescout",
  "scoutfitters",
  "scout",
  "direct_connect",
];

export const INSPECTION_MODES: InspectionMode[] = [
  "permit_inspection",
  "home_inspection",
  "insurance_claim",
  "pre_sale",
  "item_valuation",
  "equipment_condition",
];

export type ConfidenceTier = "A" | "B" | "C";

export type CapturePolicy = {
  mode: InspectionMode;
  minPhotos: number;
  maxBillablePhotos: number;
  targetConfidence: ConfidenceTier;
};

export const DEFAULT_CAPTURE_POLICIES: CapturePolicy[] = [
  {
    mode: "permit_inspection",
    minPhotos: 3,
    maxBillablePhotos: 6,
    targetConfidence: "B",
  },
  {
    mode: "home_inspection",
    minPhotos: 4,
    maxBillablePhotos: 8,
    targetConfidence: "B",
  },
  {
    mode: "insurance_claim",
    minPhotos: 4,
    maxBillablePhotos: 8,
    targetConfidence: "B",
  },
  {
    mode: "pre_sale",
    minPhotos: 3,
    maxBillablePhotos: 6,
    targetConfidence: "B",
  },
  {
    mode: "item_valuation",
    minPhotos: 2,
    maxBillablePhotos: 5,
    targetConfidence: "B",
  },
  {
    mode: "equipment_condition",
    minPhotos: 3,
    maxBillablePhotos: 6,
    targetConfidence: "B",
  },
];
