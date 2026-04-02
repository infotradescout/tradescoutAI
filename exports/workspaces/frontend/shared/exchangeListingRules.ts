export type ExchangeCategorySlug =
  | "business"
  | "real-estate"
  | "vehicles"
  | "construction"
  | "tools"
  | "furniture"
  | "farm"
  | "business-equipment"
  | "electronics"
  | "sports"
  | "collectibles"
  | "jewelry"
  | "metals"
  | "local-food"
  | "other";

export type SellCategoryFlow = {
  bestPlace: string;
  method: string;
  why: string;
  checklist: [string, string, string];
  sampleTitle: string;
  descriptionPrompt: string;
  defaultCondition?: "new" | "like_new" | "good" | "fair";
};

export type SellField = {
  key: string;
  label: string;
  placeholder: string;
  type?: "text" | "number";
  required?: boolean;
  options?: Array<{ value: string; label: string }>;
};

export const EXCHANGE_CATEGORY_TO_MARKETPLACE_NAME: Record<ExchangeCategorySlug, string> = {
  business: "Sell Your Business",
  "real-estate": "Real Estate",
  vehicles: "Vehicles",
  construction: "Construction Equipment",
  tools: "Tools & Hardware",
  furniture: "Furniture & Home Goods",
  farm: "Farm Equipment",
  "business-equipment": "Business Equipment",
  electronics: "Electronics & Technology",
  sports: "Sports & Recreation",
  collectibles: "Art & Collectibles",
  jewelry: "Jewelry & Luxury Items",
  metals: "Precious Metals (Physical)",
  "local-food": "Local Food & Artisan Goods",
  other: "Other High-Value Items",
};

export const SELL_CATEGORY_FLOWS: Record<ExchangeCategorySlug, SellCategoryFlow> = {
  business: {
    bestPlace: "Business listing flow",
    method: "Confidential buyer qualification + serious offer screening",
    why: "Best for selling full businesses, partial ownership, or brand assets with vetted interest.",
    checklist: [
      "Include annual revenue range or normalized monthly cashflow.",
      "State what is included: equipment, lease terms, staff, and brand IP.",
      "Add buyer qualification notes (proof of funds, NDA, timeline).",
    ],
    sampleTitle: "Profitable local service business with recurring contracts",
    descriptionPrompt:
      "Include business model, owner involvement, revenue profile, transfer support, and ideal buyer type.",
    defaultCondition: "good",
  },
  "real-estate": {
    bestPlace: "HomeScout",
    method: "Property-first listing with county routing and housing filters",
    why: "Best for homes, land, and commercial property exposure inside the dedicated real-estate stack.",
    checklist: [
      "Add property specs: beds/baths/sqft/lot size/year built.",
      "Include financing details and showing availability.",
      "Upload exterior + interior photos plus location context.",
    ],
    sampleTitle: "3BR home with new roof and fenced yard in county core",
    descriptionPrompt:
      "Describe condition, upgrades, neighborhood access, and showing window. Include known disclosures.",
    defaultCondition: "good",
  },
  vehicles: {
    bestPlace: "Vehicle Marketplace",
    method: "VIN-level listing with buyer-ready vehicle details",
    why: "Best for cars, trucks, trailers, and heavy-duty vehicles where spec confidence drives conversion.",
    checklist: [
      "Include year, make, model, trim, VIN, and mileage.",
      "List maintenance history, title status, and known issues.",
      "Add engine bay, interior, odometer, and tire photos.",
    ],
    sampleTitle: "2020 Ford F-150 XLT 4x4, clean title, 82k miles",
    descriptionPrompt:
      "Include drivetrain, recent service, modifications, title status, and transfer terms.",
    defaultCondition: "good",
  },
  construction: {
    bestPlace: "Exchange listing",
    method: "Spec-heavy listing + local pickup/inspection",
    why: "Best for high-value equipment where service records and runtime matter more than broad catalog exposure.",
    checklist: [
      "Include model number, serial, and operating hours/runtime.",
      "Attach maintenance/service logs and current operating status.",
      "Set inspection availability and loading/pickup requirements.",
    ],
    sampleTitle: "Skid steer with low hours, bucket + forks included",
    descriptionPrompt:
      "Describe hours, attachments, service records, wear areas, and what a buyer can test onsite.",
    defaultCondition: "good",
  },
  tools: {
    bestPlace: "Exchange listing",
    method: "Bundle-oriented listings with clear condition proof",
    why: "Best for pro tool sets when buyers can quickly evaluate completeness and wear.",
    checklist: [
      "List exact brand/model for each major item in the bundle.",
      "Show close-up photos of wear points and included accessories.",
      "State whether batteries/chargers/cases are included.",
    ],
    sampleTitle: "Milwaukee M18 contractor bundle with 8 batteries",
    descriptionPrompt:
      "List each included tool, age, duty cycle, and any missing or replaced components.",
    defaultCondition: "good",
  },
  furniture: {
    bestPlace: "Exchange listing",
    method: "Visual-first presentation + dimensions",
    why: "Best for furniture/home goods where measurements and finish condition prevent wasted inquiries.",
    checklist: [
      "Provide exact dimensions and material/finish details.",
      "Include blemish photos and delivery/pickup constraints.",
      "State if disassembly or loading help is available.",
    ],
    sampleTitle: "Solid wood dining set for 8 with matching bench",
    descriptionPrompt: "Include dimensions, materials, condition notes, and pickup logistics.",
    defaultCondition: "good",
  },
  farm: {
    bestPlace: "Exchange listing",
    method: "Operational-status listing with season timing",
    why: "Best for farm equipment where local relevance and service state are critical.",
    checklist: [
      "Include season readiness and current operating condition.",
      "List PTO/hydraulic compatibility and included implements.",
      "Provide transport/loading constraints for farm pickup.",
    ],
    sampleTitle: "Hay baler ready for season, field-tested this month",
    descriptionPrompt:
      "Describe compatibility, service history, wear parts, and pickup/haul details.",
    defaultCondition: "good",
  },
  "business-equipment": {
    bestPlace: "Exchange listing",
    method: "Commercial-use specs + install requirements",
    why: "Best for office and commercial equipment with clear ROI and setup details.",
    checklist: [
      "State duty cycle, throughput, and power requirements.",
      "Include accessories, firmware/software status, and licensing transfer.",
      "Clarify installation requirements and test/demo options.",
    ],
    sampleTitle: "Commercial POS bundle with printer, drawer, scanner",
    descriptionPrompt:
      "Include throughput, integration details, included licenses, and install requirements.",
    defaultCondition: "good",
  },
  electronics: {
    bestPlace: "Exchange listing",
    method: "Verification-first listing with serial and test proof",
    why: "Best for high-end electronics where trust is driven by proof of authenticity and function checks.",
    checklist: [
      "Include serial/model identifiers and purchase source if available.",
      "Add powered-on proof photos/video and battery health where relevant.",
      "State reset status, firmware version, and included accessories.",
    ],
    sampleTitle: "MacBook Pro 16-inch M3 Max, 36GB RAM, excellent battery",
    descriptionPrompt:
      "List exact specs, cycle counts/health, included accessories, and any cosmetic defects.",
    defaultCondition: "like_new",
  },
  sports: {
    bestPlace: "Exchange listing",
    method: "Use-case-focused listing by sport/discipline",
    why: "Best for specialty gear where fitment and usage history drive demand quality.",
    checklist: [
      "Specify sport, level (recreational/competitive), and fit sizing.",
      "Note usage frequency, storage conditions, and impacts.",
      "Include all protective/accessory components in photos.",
    ],
    sampleTitle: "Tournament-level compound bow package, right-hand",
    descriptionPrompt: "Include sizing, usage history, upgrades, and what is included in the kit.",
    defaultCondition: "good",
  },
  collectibles: {
    bestPlace: "Exchange listing",
    method: "Provenance-first listing with authenticity evidence",
    why: "Best for art/collectibles where documentation and condition grading are the conversion levers.",
    checklist: [
      "Include provenance, COA/grading details, and acquisition source.",
      "Photograph signatures, stamps, serials, and edge wear clearly.",
      "State appraisal context and insured shipping options.",
    ],
    sampleTitle: "Signed limited-edition print with COA and frame",
    descriptionPrompt:
      "Include provenance, grading/authentication details, and condition notes by area.",
    defaultCondition: "good",
  },
  jewelry: {
    bestPlace: "Exchange listing",
    method: "Authentication-led listing with material specs",
    why: "Best for luxury pieces when stone/metal specs and appraisal proof are explicit.",
    checklist: [
      "Include metal type, karat, weight, and stone details.",
      "Attach appraisal/certification details and issue date.",
      "State insured shipping/meetup security preferences.",
    ],
    sampleTitle: "14k gold bracelet with recent certified appraisal",
    descriptionPrompt:
      "Provide metal/stone specs, certification/appraisal details, and security/transfer terms.",
    defaultCondition: "like_new",
  },
  metals: {
    bestPlace: "Metals Exchange",
    method: "Physical metals listing with spot-aware details",
    why: "Best for physical metals where weight, purity, and form factor drive trust.",
    checklist: [
      "Use the dedicated metals flow.",
      "Include weight, purity, and form factor.",
      "Keep handoff local and secure.",
    ],
    sampleTitle: "1 oz gold coin",
    descriptionPrompt: "Use the dedicated metals exchange flow.",
    defaultCondition: "like_new",
  },
  "local-food": {
    bestPlace: "Handmade marketplace",
    method: "Story-led product listing + local artisan positioning",
    why: "Best for local makers and artisan goods where craft story and repeat buyers matter.",
    checklist: [
      "Include sourcing and production details buyers care about.",
      "Add freshness/lead-time notes and order fulfillment method.",
      "Show packaging quality and quantity/size options.",
    ],
    sampleTitle: "Small-batch hot sauce gift set from local farm peppers",
    descriptionPrompt:
      "Describe ingredients/materials, production cadence, shelf life (if food), and fulfillment timeline.",
    defaultCondition: "new",
  },
  other: {
    bestPlace: "Exchange listing",
    method: "High-trust listing with verification artifacts",
    why: "Best for uncommon high-value items when condition and authenticity are clearly documented.",
    checklist: [
      "Provide model/spec and known provenance or purchase history.",
      "Add close-up photos of identifiers, wear, and function tests.",
      "State transfer method, inspection terms, and payment expectations.",
    ],
    sampleTitle: "High-value specialty equipment with full documentation",
    descriptionPrompt:
      "Focus on specs, verification proof, condition transparency, and transfer/inspection terms.",
    defaultCondition: "good",
  },
};

export const SELL_CATEGORY_FIELDS: Record<
  Exclude<ExchangeCategorySlug, "real-estate" | "metals">,
  SellField[]
> = {
  business: [
    { key: "annualRevenueRange", label: "Revenue", placeholder: "Revenue range" },
    { key: "cashflowRange", label: "Cashflow", placeholder: "Cashflow / EBITDA range" },
  ],
  vehicles: [
    { key: "vin", label: "VIN", placeholder: "17-character VIN", required: false },
    { key: "year", label: "Year", placeholder: "Year", type: "number" },
    { key: "make", label: "Make", placeholder: "Ford, Chevrolet..." },
    { key: "model", label: "Model", placeholder: "F-150, Tahoe..." },
    { key: "mileage", label: "Mileage", placeholder: "Mileage", type: "number" },
    {
      key: "titleStatus",
      label: "Title Status",
      placeholder: "Select title status",
      options: [
        { value: "clean", label: "Clean" },
        { value: "rebuilt", label: "Rebuilt" },
        { value: "salvage", label: "Salvage" },
        { value: "lien", label: "Lien" },
      ],
    },
  ],
  construction: [
    { key: "hours", label: "Hours", placeholder: "Machine hours", type: "number" },
    { key: "serialNumber", label: "Serial", placeholder: "Serial number" },
    { key: "attachments", label: "Attachments", placeholder: "Bucket, forks, etc." },
    {
      key: "serviceHistory",
      label: "Service History",
      placeholder: "Recent service / maintenance history",
    },
    {
      key: "inspectionReady",
      label: "Inspection Ready",
      placeholder: "Select inspection status",
      options: [
        { value: "yes", label: "Yes" },
        { value: "no", label: "No" },
      ],
    },
  ],
  tools: [
    { key: "brand", label: "Brand", placeholder: "Milwaukee, DeWalt..." },
    { key: "model", label: "Model", placeholder: "Model number(s)" },
    { key: "bundleCount", label: "Pieces", placeholder: "Number of tools / items", type: "number" },
    {
      key: "includesBatteries",
      label: "Batteries Included",
      placeholder: "Select battery status",
      options: [
        { value: "yes", label: "Yes" },
        { value: "no", label: "No" },
      ],
    },
    {
      key: "includesChargers",
      label: "Chargers Included",
      placeholder: "Select charger status",
      options: [
        { value: "yes", label: "Yes" },
        { value: "no", label: "No" },
      ],
    },
    {
      key: "includesCase",
      label: "Case Included",
      placeholder: "Select case status",
      options: [
        { value: "yes", label: "Yes" },
        { value: "no", label: "No" },
      ],
    },
  ],
  furniture: [
    { key: "dimensions", label: "Dimensions", placeholder: "L x W x H" },
    { key: "material", label: "Material", placeholder: "Wood, leather, etc." },
    {
      key: "assemblyStatus",
      label: "Assembly",
      placeholder: "Select assembly status",
      options: [
        { value: "assembled", label: "Assembled" },
        { value: "disassembled", label: "Disassembled" },
      ],
    },
    {
      key: "deliveryOption",
      label: "Delivery",
      placeholder: "Select delivery option",
      options: [
        { value: "pickup_only", label: "Pickup Only" },
        { value: "local_delivery", label: "Local Delivery" },
      ],
    },
  ],
  farm: [
    { key: "hours", label: "Hours", placeholder: "Engine/PTO hours", type: "number" },
    { key: "compatibility", label: "Compatibility", placeholder: "Tractor/PTO size, etc." },
    { key: "implementType", label: "Implement", placeholder: "Baler, mower, tiller..." },
    {
      key: "fieldReady",
      label: "Field Ready",
      placeholder: "Select field readiness",
      options: [
        { value: "yes", label: "Yes" },
        { value: "no", label: "No" },
      ],
    },
  ],
  "business-equipment": [
    { key: "brand", label: "Brand", placeholder: "Manufacturer" },
    { key: "model", label: "Model", placeholder: "Model / SKU" },
    { key: "powerRequirements", label: "Power", placeholder: "120V, 240V, 3-phase..." },
    { key: "throughput", label: "Throughput", placeholder: "Capacity / output" },
    {
      key: "installRequired",
      label: "Install Required",
      placeholder: "Select install status",
      options: [
        { value: "yes", label: "Yes" },
        { value: "no", label: "No" },
      ],
    },
  ],
  electronics: [
    { key: "brand", label: "Brand", placeholder: "Apple, Samsung, Sony..." },
    { key: "model", label: "Model", placeholder: "MacBook Pro, iPhone 15..." },
    { key: "serial", label: "Serial", placeholder: "Serial (optional)", required: false },
    { key: "storage", label: "Storage", placeholder: "256GB, 1TB, etc." },
    { key: "batteryHealth", label: "Battery Health", placeholder: "90%, 12 cycles, etc." },
    {
      key: "powersOn",
      label: "Powers On",
      placeholder: "Select power status",
      options: [
        { value: "yes", label: "Yes" },
        { value: "no", label: "No" },
      ],
    },
    {
      key: "carrierStatus",
      label: "Carrier Status",
      placeholder: "Unlocked / carrier / Wi-Fi only",
      required: false,
    },
  ],
  sports: [
    { key: "size", label: "Size", placeholder: "Size / fit" },
    { key: "sport", label: "Sport", placeholder: "Golf, cycling, etc." },
    {
      key: "competitionReady",
      label: "Competition Ready",
      placeholder: "Select readiness",
      options: [
        { value: "yes", label: "Yes" },
        { value: "no", label: "No" },
      ],
    },
  ],
  collectibles: [
    { key: "provenance", label: "Provenance", placeholder: "COA / origin details" },
    {
      key: "authenticated",
      label: "Authenticated",
      placeholder: "Select authentication status",
      options: [
        { value: "yes", label: "Yes" },
        { value: "no", label: "No" },
      ],
    },
    {
      key: "graded",
      label: "Graded",
      placeholder: "Select grading status",
      options: [
        { value: "yes", label: "Yes" },
        { value: "no", label: "No" },
      ],
    },
    { key: "grade", label: "Grade", placeholder: "PSA 9, VF, etc.", required: false },
    { key: "year", label: "Year", placeholder: "Year (if known)", type: "number", required: false },
  ],
  jewelry: [
    { key: "metal", label: "Metal", placeholder: "14k gold, platinum..." },
    { key: "weight", label: "Weight", placeholder: "Weight / carat" },
    {
      key: "stoneDetails",
      label: "Stone",
      placeholder: "Diamond, sapphire, etc.",
      required: false,
    },
    {
      key: "appraisalStatus",
      label: "Appraisal",
      placeholder: "Select appraisal status",
      options: [
        { value: "available", label: "Available" },
        { value: "not_available", label: "Not Available" },
      ],
    },
    {
      key: "certified",
      label: "Certified",
      placeholder: "Select certification status",
      options: [
        { value: "yes", label: "Yes" },
        { value: "no", label: "No" },
      ],
    },
    {
      key: "handoff",
      label: "Handoff",
      placeholder: "Select handoff method",
      options: [
        { value: "secure_meetup", label: "Secure Meetup" },
        { value: "insured_shipping", label: "Insured Shipping" },
      ],
    },
  ],
  "local-food": [
    { key: "ingredients", label: "Ingredients", placeholder: "Main ingredients/materials" },
    { key: "batchSize", label: "Batch / Qty", placeholder: "Batch size or available qty" },
    { key: "leadTime", label: "Lead Time", placeholder: "Same day, 48 hours, weekly..." },
    {
      key: "pickupOrDelivery",
      label: "Fulfillment",
      placeholder: "Select fulfillment method",
      options: [
        { value: "pickup", label: "Pickup" },
        { value: "delivery", label: "Delivery" },
        { value: "both", label: "Both" },
      ],
    },
  ],
  other: [
    { key: "brand", label: "Brand", placeholder: "Brand / maker" },
    { key: "model", label: "Model", placeholder: "Model / identifier" },
    { key: "proof", label: "Proof", placeholder: "Receipt, serial, provenance, etc." },
    {
      key: "inspectionAvailable",
      label: "Inspection Available",
      placeholder: "Select inspection status",
      options: [
        { value: "yes", label: "Yes" },
        { value: "no", label: "No" },
      ],
    },
  ],
};

const PHOTO_MINIMUMS: Partial<Record<ExchangeCategorySlug, number>> = {
  vehicles: 4,
  construction: 4,
  tools: 3,
  electronics: 3,
  jewelry: 3,
  collectibles: 3,
  furniture: 3,
  farm: 4,
  "business-equipment": 3,
  sports: 3,
  "local-food": 2,
  other: 3,
};

export function getExchangeCategorySlugFromMarketplaceCategoryName(
  name: string | null | undefined
): ExchangeCategorySlug | null {
  const normalized = String(name || "")
    .trim()
    .toLowerCase();
  if (!normalized) return null;

  const match = (
    Object.entries(EXCHANGE_CATEGORY_TO_MARKETPLACE_NAME) as Array<[ExchangeCategorySlug, string]>
  ).find(([, categoryName]) => categoryName.toLowerCase() === normalized);

  return match?.[0] || null;
}

export function getExchangePhotoMinimum(category: string | null | undefined): number {
  const slug = String(category || "") as ExchangeCategorySlug;
  return PHOTO_MINIMUMS[slug] || 0;
}

export function getExchangePhotoHint(category: string | null | undefined): string {
  const minimum = getExchangePhotoMinimum(category);
  return minimum > 0 ? `Upload photos (min ${minimum}, max 8)` : "Upload photos (max 8)";
}

export function getRequiredExchangeFieldKeys(category: string | null | undefined): string[] {
  const slug = String(category || "") as keyof typeof SELL_CATEGORY_FIELDS;
  const fields = SELL_CATEGORY_FIELDS[slug] || [];
  return fields.filter((field) => field.required !== false).map((field) => field.key);
}

export type ExchangeCategoryValidationInput = {
  category: string | null | undefined;
  imageCount: number;
  specs?: Record<string, unknown> | null;
};

export type ExchangeCategoryValidationResult = {
  message: string;
  reasonCode: string;
} | null;

export function validateExchangeCategoryListing(
  input: ExchangeCategoryValidationInput
): ExchangeCategoryValidationResult {
  const category = String(input.category || "") as ExchangeCategorySlug;
  const specs = (input.specs || {}) as Record<string, unknown>;
  const imageCount = Number.isFinite(input.imageCount) ? Number(input.imageCount) : 0;
  const photoMinimum = getExchangePhotoMinimum(category);

  if (photoMinimum > 0 && imageCount < photoMinimum) {
    return {
      message: `This ${category.replace(/-/g, " ")} listing requires at least ${photoMinimum} photos.`,
      reasonCode: "CATEGORY_PHOTO_MINIMUM",
    };
  }

  if (category === "vehicles") {
    const vin = String(specs.vin || "")
      .trim()
      .toUpperCase();
    if (vin && vin.length !== 17) {
      return { message: "Vehicle VIN must be 17 characters.", reasonCode: "INVALID_VIN" };
    }
  }

  if (category === "electronics") {
    if (
      String(specs.powersOn || "")
        .trim()
        .toLowerCase() !== "yes"
    ) {
      return {
        message: "Electronics listings must confirm the device powers on.",
        reasonCode: "ELECTRONICS_POWER_REQUIRED",
      };
    }
  }

  if (category === "jewelry" && !String(specs.handoff || "").trim()) {
    return {
      message: "Jewelry listings must include a handoff method.",
      reasonCode: "JEWELRY_HANDOFF_REQUIRED",
    };
  }

  if (category === "collectibles" && String(specs.provenance || "").trim().length < 8) {
    return {
      message: "Collectibles listings must include provenance details.",
      reasonCode: "COLLECTIBLES_PROVENANCE_REQUIRED",
    };
  }

  if (category === "furniture" && !String(specs.deliveryOption || "").trim()) {
    return {
      message: "Furniture listings must include a delivery option.",
      reasonCode: "FURNITURE_DELIVERY_REQUIRED",
    };
  }

  if (category === "other" && String(specs.proof || "").trim().length < 6) {
    return {
      message: "High-value listings must include proof details.",
      reasonCode: "HIGH_VALUE_PROOF_REQUIRED",
    };
  }

  return null;
}
