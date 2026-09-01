export type ExchangeCategorySlug =
  | "business"
  | "real-estate"
  | "vehicles"
  | "construction"
  | "building-materials"
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
  "building-materials": "Building Materials & Surfaces",
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
  "building-materials": {
    bestPlace: "Business profile catalog spotlight",
    method: "One profile-linked catalog entry with a managed request path",
    why: "Best for materials that need availability, project fit, and quote review without duplicating a maintained business catalog or inventing a public price.",
    checklist: [
      "Publish one spotlight per business rather than one listing per material.",
      "Keep unknown price, stock, and availability out of public claims.",
      "Route the buyer into the exact business catalog and protected TradeScout request flow.",
    ],
    sampleTitle: "Natural stone catalog — availability and quote by request",
    descriptionPrompt:
      "Describe supported material families and direct buyers to the maintained business profile for current availability and a managed quote.",
    defaultCondition: "new",
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
  Exclude<ExchangeCategorySlug, "real-estate" | "metals" | "building-materials">,
  SellField[]
> = {
  business: [
    {
      key: "businessType",
      label: "Business Type",
      placeholder: "Select business type",
      options: [
        { value: "retail", label: "Retail" },
        { value: "service", label: "Service" },
        { value: "restaurant", label: "Restaurant / Food" },
        { value: "manufacturing", label: "Manufacturing" },
        { value: "franchise", label: "Franchise" },
        { value: "ecommerce", label: "E-Commerce" },
        { value: "other", label: "Other" },
      ],
    },
    { key: "annualRevenueRange", label: "Revenue", placeholder: "Revenue range" },
    { key: "cashflowRange", label: "Cashflow", placeholder: "Cashflow / EBITDA range" },
    {
      key: "yearsInOperation",
      label: "Years Operating",
      placeholder: "Years in operation",
      type: "number",
      required: false,
    },
    {
      key: "employeeCount",
      label: "Employees",
      placeholder: "Number of employees",
      type: "number",
      required: false,
    },
    {
      key: "reasonForSale",
      label: "Reason for Sale",
      placeholder: "Retirement, relocation, etc.",
      required: false,
    },
    {
      key: "ownerFinancing",
      label: "Owner Financing",
      placeholder: "Select financing option",
      required: false,
      options: [
        { value: "yes", label: "Available" },
        { value: "no", label: "Not Available" },
      ],
    },
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
    { key: "make", label: "Make", placeholder: "Caterpillar, John Deere, Komatsu..." },
    { key: "model", label: "Model", placeholder: "Model / SKU" },
    { key: "year", label: "Year", placeholder: "Year", type: "number", required: false },
    { key: "hours", label: "Hours", placeholder: "Machine hours", type: "number" },
    { key: "serialNumber", label: "Serial", placeholder: "Serial number" },
    {
      key: "attachments",
      label: "Attachments",
      placeholder: "Bucket, forks, etc.",
      required: false,
    },
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
    { key: "make", label: "Make", placeholder: "John Deere, Kubota, Case..." },
    { key: "model", label: "Model", placeholder: "Model / series" },
    { key: "year", label: "Year", placeholder: "Year", type: "number", required: false },
    { key: "hours", label: "Hours", placeholder: "Engine/PTO hours", type: "number" },
    { key: "serialNumber", label: "Serial", placeholder: "Serial number", required: false },
    {
      key: "compatibility",
      label: "Compatibility",
      placeholder: "Tractor/PTO size, etc.",
      required: false,
    },
    {
      key: "implementType",
      label: "Implement Type",
      placeholder: "Baler, mower, tiller...",
      required: false,
    },
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
    { key: "sport", label: "Sport / Activity", placeholder: "Golf, cycling, archery..." },
    { key: "brand", label: "Brand", placeholder: "Callaway, Trek, Bowtech..." },
    { key: "model", label: "Model", placeholder: "Model / series", required: false },
    {
      key: "size",
      label: "Size / Fit",
      placeholder: "Size, draw length, frame size...",
      required: false,
    },
    {
      key: "usageHistory",
      label: "Usage History",
      placeholder: "Recreational, competitive, seasons used...",
      required: false,
    },
    {
      key: "includesAccessories",
      label: "Accessories Included",
      placeholder: "List included accessories",
      required: false,
    },
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
  "real-estate": 5,
  vehicles: 3,
  construction: 3,
  tools: 2,
  electronics: 2,
  jewelry: 2,
  collectibles: 2,
  furniture: 2,
  farm: 3,
  "business-equipment": 2,
  sports: 2,
  "local-food": 1,
  other: 2,
};

/**
 * Maximum number of photos per listing.
 * - real-estate: no cap (undefined)
 * - vehicles: 10
 * - all others: 5
 */
const PHOTO_MAXIMUMS: Partial<Record<ExchangeCategorySlug, number>> = {
  vehicles: 10,
  // real-estate intentionally omitted → no cap
};
const DEFAULT_PHOTO_MAX = 5;

export function getExchangePhotoMaximum(category: string | null | undefined): number | undefined {
  const slug = String(category || "") as ExchangeCategorySlug;
  if (slug === "real-estate") return undefined; // no max
  return PHOTO_MAXIMUMS[slug] ?? DEFAULT_PHOTO_MAX;
}

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
  const maximum = getExchangePhotoMaximum(category);
  const maxLabel = maximum !== undefined ? `max ${maximum}` : "no max";
  return minimum > 0
    ? `Upload photos (min ${minimum}, ${maxLabel})`
    : `Upload photos (${maxLabel})`;
}

export function getRequiredExchangeFieldKeys(category: string | null | undefined): string[] {
  const slug = String(category || "") as keyof typeof SELL_CATEGORY_FIELDS;
  const fields = SELL_CATEGORY_FIELDS[slug] || [];
  return fields.filter((field) => field.required !== false).map((field) => field.key);
}

// ---------------------------------------------------------------------------
// PROHIBITED ITEMS POLICY
// ---------------------------------------------------------------------------

/**
 * Items that are never allowed on the TradeScout Exchange, regardless of
 * category. These are checked server-side on every listing create/update
 * and surfaced in the client sell flow.
 */
export const EXCHANGE_PROHIBITED_KEYWORDS: string[] = [
  // Alcohol
  "alcohol",
  "beer",
  "wine",
  "liquor",
  "spirits",
  "whiskey",
  "whisky",
  "bourbon",
  "vodka",
  "gin",
  "rum",
  "tequila",
  "brandy",
  "champagne",
  "mead",
  "cider",
  "homebrew",
  "moonshine",
  // Animals / livestock (live)
  "live animal",
  "live animals",
  "puppy",
  "puppies",
  "kitten",
  "kittens",
  "dog for sale",
  "cat for sale",
  "livestock",
  "cattle",
  "horses for sale",
  "exotic animal",
  "exotic bird",
  "reptile for sale",
  // Firearms & weapons
  "firearm",
  "handgun",
  "pistol",
  "revolver",
  "rifle",
  "shotgun",
  "assault rifle",
  "machine gun",
  "silencer",
  "suppressor",
  "ghost gun",
  "80% lower",
  "unregistered",
  // Controlled substances / drugs
  "marijuana",
  "cannabis",
  "weed",
  "thc",
  "cbd oil for sale",
  "cocaine",
  "heroin",
  "methamphetamine",
  "fentanyl",
  "opioid",
  "prescription drugs",
  "controlled substance",
  // Tobacco / vaping
  "cigarettes",
  "cigars",
  "tobacco",
  "vape",
  "e-cigarette",
  "juul",
  "nicotine",
  // Adult / explicit content
  "adult content",
  "explicit",
  "pornography",
  "escort",
  "sexual services",
  // Counterfeit / stolen
  "counterfeit",
  "replica watch",
  "fake",
  "stolen",
  "no title",
];

/**
 * Human-readable policy statement shown to sellers in the UI.
 */
export const EXCHANGE_PROHIBITED_POLICY_NOTICE =
  "TradeScout does not allow the sale of alcohol, live animals, firearms, " +
  "controlled substances, tobacco/vaping products, adult content, or " +
  "counterfeit/stolen goods. Listings that include these items will be " +
  "removed and the account may be suspended.";

/**
 * Returns the first prohibited keyword found in the given text fields,
 * or null if none are found.
 */
export function findProhibitedKeyword(fields: Array<string | null | undefined>): string | null {
  const combined = fields.map((f) => String(f || "").toLowerCase()).join(" ");
  for (const kw of EXCHANGE_PROHIBITED_KEYWORDS) {
    // Word-boundary match: the keyword must appear as a standalone word/phrase
    const escaped = kw.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const re = new RegExp(`(?<![a-z0-9])${escaped}(?![a-z0-9])`, "i");
    if (re.test(combined)) return kw;
  }
  return null;
}

// ---------------------------------------------------------------------------
// COTTAGE FOOD LAW — STATE-LEVEL PRODUCT ELIGIBILITY
// ---------------------------------------------------------------------------

/**
 * State-level cottage food law data.
 * Source: National Conference of State Legislatures + state ag dept summaries.
 * Each entry describes what a home-based food producer MAY sell without a
 * commercial kitchen license in that state.
 *
 * `allowedProducts`: broad product categories permitted under cottage law.
 * `prohibitedProducts`: items explicitly excluded even in permissive states.
 * `requiresLabeling`: whether state requires a cottage food label.
 * `saleLimitUSD`: annual gross sales cap (null = no cap or not specified).
 * `directSaleOnly`: whether sales must be direct to consumer (no online shipping).
 * `notes`: plain-language summary of key restrictions.
 */
export type CottageFoodStateRule = {
  allowedProducts: string[];
  prohibitedProducts: string[];
  requiresLabeling: boolean;
  saleLimitUSD: number | null;
  directSaleOnly: boolean;
  notes: string;
};

export const COTTAGE_FOOD_RULES_BY_STATE: Record<string, CottageFoodStateRule> = {
  AL: {
    allowedProducts: [
      "baked goods",
      "candy",
      "jams",
      "jellies",
      "honey",
      "dried herbs",
      "roasted nuts",
    ],
    prohibitedProducts: ["meat", "dairy", "eggs", "canned goods", "refrigerated items", "alcohol"],
    requiresLabeling: true,
    saleLimitUSD: null,
    directSaleOnly: true,
    notes: "Alabama allows non-potentially-hazardous foods sold direct to consumer.",
  },
  AK: {
    allowedProducts: ["baked goods", "jams", "jellies", "candy", "dried goods", "honey"],
    prohibitedProducts: ["meat", "dairy", "canned low-acid foods", "alcohol"],
    requiresLabeling: true,
    saleLimitUSD: 25000,
    directSaleOnly: false,
    notes: "Alaska permits online sales with shipping within the state.",
  },
  AZ: {
    allowedProducts: [
      "baked goods",
      "candy",
      "jams",
      "jellies",
      "honey",
      "dried herbs",
      "roasted nuts",
      "tortillas",
    ],
    prohibitedProducts: ["meat", "dairy", "canned low-acid foods", "alcohol"],
    requiresLabeling: true,
    saleLimitUSD: null,
    directSaleOnly: false,
    notes: "Arizona has broad cottage food law with no sales cap.",
  },
  AR: {
    allowedProducts: ["baked goods", "candy", "jams", "jellies", "honey", "dried goods"],
    prohibitedProducts: ["meat", "dairy", "canned goods", "alcohol"],
    requiresLabeling: true,
    saleLimitUSD: null,
    directSaleOnly: true,
    notes: "Arkansas requires direct-to-consumer sales only.",
  },
  CA: {
    allowedProducts: [
      "baked goods",
      "candy",
      "jams",
      "jellies",
      "honey",
      "dried herbs",
      "roasted nuts",
      "granola",
      "dried pasta",
      "chocolate",
      "fruit butters",
    ],
    prohibitedProducts: ["meat", "dairy", "canned low-acid foods", "alcohol", "raw sprouts"],
    requiresLabeling: true,
    saleLimitUSD: 75000,
    directSaleOnly: false,
    notes:
      "California AB 1144 (2022) allows online sales and third-party platforms up to $75K/year.",
  },
  CO: {
    allowedProducts: [
      "baked goods",
      "candy",
      "jams",
      "jellies",
      "honey",
      "dried herbs",
      "roasted nuts",
      "granola",
    ],
    prohibitedProducts: ["meat", "dairy", "canned goods", "alcohol"],
    requiresLabeling: true,
    saleLimitUSD: null,
    directSaleOnly: false,
    notes: "Colorado allows online sales with no sales cap.",
  },
  CT: {
    allowedProducts: ["baked goods", "jams", "jellies", "honey", "candy", "dried goods"],
    prohibitedProducts: ["meat", "dairy", "canned goods", "alcohol"],
    requiresLabeling: true,
    saleLimitUSD: 25000,
    directSaleOnly: true,
    notes: "Connecticut requires direct-to-consumer sales only.",
  },
  DE: {
    allowedProducts: ["baked goods", "jams", "jellies", "honey", "candy"],
    prohibitedProducts: ["meat", "dairy", "canned goods", "alcohol"],
    requiresLabeling: true,
    saleLimitUSD: null,
    directSaleOnly: true,
    notes: "Delaware cottage food is limited to non-potentially-hazardous foods.",
  },
  FL: {
    allowedProducts: [
      "baked goods",
      "candy",
      "jams",
      "jellies",
      "honey",
      "dried herbs",
      "roasted nuts",
      "granola",
      "fruit pies",
      "canned high-acid foods",
    ],
    prohibitedProducts: ["meat", "dairy", "canned low-acid foods", "alcohol"],
    requiresLabeling: true,
    saleLimitUSD: 50000,
    directSaleOnly: false,
    notes: "Florida allows online sales and third-party platforms up to $50K/year.",
  },
  GA: {
    allowedProducts: ["baked goods", "candy", "jams", "jellies", "honey", "dried goods"],
    prohibitedProducts: ["meat", "dairy", "canned low-acid foods", "alcohol"],
    requiresLabeling: true,
    saleLimitUSD: null,
    directSaleOnly: true,
    notes: "Georgia requires direct-to-consumer sales only.",
  },
  HI: {
    allowedProducts: ["baked goods", "jams", "jellies", "honey", "candy", "dried goods"],
    prohibitedProducts: ["meat", "dairy", "canned goods", "alcohol"],
    requiresLabeling: true,
    saleLimitUSD: null,
    directSaleOnly: true,
    notes: "Hawaii cottage food is limited to non-potentially-hazardous foods sold direct.",
  },
  ID: {
    allowedProducts: [
      "baked goods",
      "jams",
      "jellies",
      "honey",
      "candy",
      "dried goods",
      "roasted nuts",
    ],
    prohibitedProducts: ["meat", "dairy", "canned low-acid foods", "alcohol"],
    requiresLabeling: true,
    saleLimitUSD: null,
    directSaleOnly: false,
    notes: "Idaho allows online sales with no sales cap.",
  },
  IL: {
    allowedProducts: [
      "baked goods",
      "jams",
      "jellies",
      "honey",
      "candy",
      "dried herbs",
      "roasted nuts",
    ],
    prohibitedProducts: ["meat", "dairy", "canned low-acid foods", "alcohol"],
    requiresLabeling: true,
    saleLimitUSD: 25000,
    directSaleOnly: false,
    notes: "Illinois allows online sales up to $25K/year.",
  },
  IN: {
    allowedProducts: ["baked goods", "jams", "jellies", "honey", "candy", "dried goods"],
    prohibitedProducts: ["meat", "dairy", "canned goods", "alcohol"],
    requiresLabeling: true,
    saleLimitUSD: null,
    directSaleOnly: true,
    notes: "Indiana requires direct-to-consumer sales only.",
  },
  IA: {
    allowedProducts: [
      "baked goods",
      "jams",
      "jellies",
      "honey",
      "candy",
      "dried goods",
      "roasted nuts",
    ],
    prohibitedProducts: ["meat", "dairy", "canned low-acid foods", "alcohol"],
    requiresLabeling: true,
    saleLimitUSD: null,
    directSaleOnly: false,
    notes: "Iowa allows online sales with no sales cap.",
  },
  KS: {
    allowedProducts: ["baked goods", "jams", "jellies", "honey", "candy", "dried goods"],
    prohibitedProducts: ["meat", "dairy", "canned goods", "alcohol"],
    requiresLabeling: true,
    saleLimitUSD: 50000,
    directSaleOnly: false,
    notes: "Kansas allows online sales up to $50K/year.",
  },
  KY: {
    allowedProducts: ["baked goods", "jams", "jellies", "honey", "candy", "dried herbs"],
    prohibitedProducts: ["meat", "dairy", "canned goods", "alcohol"],
    requiresLabeling: true,
    saleLimitUSD: null,
    directSaleOnly: true,
    notes: "Kentucky requires direct-to-consumer sales only.",
  },
  LA: {
    allowedProducts: [
      "baked goods",
      "jams",
      "jellies",
      "honey",
      "candy",
      "dried goods",
      "pralines",
    ],
    prohibitedProducts: ["meat", "dairy", "canned low-acid foods", "alcohol"],
    requiresLabeling: true,
    saleLimitUSD: null,
    directSaleOnly: false,
    notes: "Louisiana allows online sales with no sales cap.",
  },
  ME: {
    allowedProducts: ["baked goods", "jams", "jellies", "honey", "candy", "dried goods"],
    prohibitedProducts: ["meat", "dairy", "canned goods", "alcohol"],
    requiresLabeling: true,
    saleLimitUSD: null,
    directSaleOnly: true,
    notes: "Maine requires direct-to-consumer sales only.",
  },
  MD: {
    allowedProducts: ["baked goods", "jams", "jellies", "honey", "candy"],
    prohibitedProducts: ["meat", "dairy", "canned goods", "alcohol"],
    requiresLabeling: true,
    saleLimitUSD: null,
    directSaleOnly: true,
    notes: "Maryland requires direct-to-consumer sales only.",
  },
  MA: {
    allowedProducts: ["baked goods", "jams", "jellies", "honey", "candy", "dried goods"],
    prohibitedProducts: ["meat", "dairy", "canned goods", "alcohol"],
    requiresLabeling: true,
    saleLimitUSD: null,
    directSaleOnly: true,
    notes: "Massachusetts requires direct-to-consumer sales only.",
  },
  MI: {
    allowedProducts: [
      "baked goods",
      "jams",
      "jellies",
      "honey",
      "candy",
      "dried goods",
      "roasted nuts",
    ],
    prohibitedProducts: ["meat", "dairy", "canned low-acid foods", "alcohol"],
    requiresLabeling: true,
    saleLimitUSD: 25000,
    directSaleOnly: false,
    notes: "Michigan allows online sales up to $25K/year.",
  },
  MN: {
    allowedProducts: ["baked goods", "jams", "jellies", "honey", "candy", "dried goods", "granola"],
    prohibitedProducts: ["meat", "dairy", "canned low-acid foods", "alcohol"],
    requiresLabeling: true,
    saleLimitUSD: 78000,
    directSaleOnly: false,
    notes: "Minnesota allows online sales up to $78K/year.",
  },
  MS: {
    allowedProducts: ["baked goods", "jams", "jellies", "honey", "candy"],
    prohibitedProducts: ["meat", "dairy", "canned goods", "alcohol"],
    requiresLabeling: true,
    saleLimitUSD: null,
    directSaleOnly: true,
    notes: "Mississippi requires direct-to-consumer sales only.",
  },
  MO: {
    allowedProducts: ["baked goods", "jams", "jellies", "honey", "candy", "dried goods"],
    prohibitedProducts: ["meat", "dairy", "canned goods", "alcohol"],
    requiresLabeling: true,
    saleLimitUSD: null,
    directSaleOnly: true,
    notes: "Missouri requires direct-to-consumer sales only.",
  },
  MT: {
    allowedProducts: [
      "baked goods",
      "jams",
      "jellies",
      "honey",
      "candy",
      "dried goods",
      "roasted nuts",
    ],
    prohibitedProducts: ["meat", "dairy", "canned low-acid foods", "alcohol"],
    requiresLabeling: true,
    saleLimitUSD: null,
    directSaleOnly: false,
    notes: "Montana allows online sales with no sales cap.",
  },
  NE: {
    allowedProducts: ["baked goods", "jams", "jellies", "honey", "candy", "dried goods"],
    prohibitedProducts: ["meat", "dairy", "canned goods", "alcohol"],
    requiresLabeling: true,
    saleLimitUSD: null,
    directSaleOnly: true,
    notes: "Nebraska requires direct-to-consumer sales only.",
  },
  NV: {
    allowedProducts: ["baked goods", "jams", "jellies", "honey", "candy"],
    prohibitedProducts: ["meat", "dairy", "canned goods", "alcohol"],
    requiresLabeling: true,
    saleLimitUSD: null,
    directSaleOnly: true,
    notes: "Nevada requires direct-to-consumer sales only.",
  },
  NH: {
    allowedProducts: ["baked goods", "jams", "jellies", "honey", "candy", "dried goods"],
    prohibitedProducts: ["meat", "dairy", "canned goods", "alcohol"],
    requiresLabeling: true,
    saleLimitUSD: null,
    directSaleOnly: true,
    notes: "New Hampshire requires direct-to-consumer sales only.",
  },
  NJ: {
    allowedProducts: ["baked goods", "jams", "jellies", "honey", "candy"],
    prohibitedProducts: ["meat", "dairy", "canned goods", "alcohol"],
    requiresLabeling: true,
    saleLimitUSD: null,
    directSaleOnly: true,
    notes: "New Jersey requires direct-to-consumer sales only.",
  },
  NM: {
    allowedProducts: [
      "baked goods",
      "jams",
      "jellies",
      "honey",
      "candy",
      "dried goods",
      "roasted nuts",
      "tortillas",
    ],
    prohibitedProducts: ["meat", "dairy", "canned low-acid foods", "alcohol"],
    requiresLabeling: true,
    saleLimitUSD: null,
    directSaleOnly: false,
    notes: "New Mexico allows online sales with no sales cap.",
  },
  NY: {
    allowedProducts: ["baked goods", "jams", "jellies", "honey", "candy", "dried goods"],
    prohibitedProducts: ["meat", "dairy", "canned goods", "alcohol"],
    requiresLabeling: true,
    saleLimitUSD: null,
    directSaleOnly: true,
    notes: "New York requires direct-to-consumer sales only.",
  },
  NC: {
    allowedProducts: ["baked goods", "jams", "jellies", "honey", "candy", "dried goods"],
    prohibitedProducts: ["meat", "dairy", "canned goods", "alcohol"],
    requiresLabeling: true,
    saleLimitUSD: null,
    directSaleOnly: true,
    notes: "North Carolina requires direct-to-consumer sales only.",
  },
  ND: {
    allowedProducts: [
      "baked goods",
      "jams",
      "jellies",
      "honey",
      "candy",
      "dried goods",
      "roasted nuts",
    ],
    prohibitedProducts: ["meat", "dairy", "canned low-acid foods", "alcohol"],
    requiresLabeling: true,
    saleLimitUSD: null,
    directSaleOnly: false,
    notes: "North Dakota allows online sales with no sales cap.",
  },
  OH: {
    allowedProducts: ["baked goods", "jams", "jellies", "honey", "candy", "dried goods"],
    prohibitedProducts: ["meat", "dairy", "canned goods", "alcohol"],
    requiresLabeling: true,
    saleLimitUSD: null,
    directSaleOnly: true,
    notes: "Ohio requires direct-to-consumer sales only.",
  },
  OK: {
    allowedProducts: [
      "baked goods",
      "jams",
      "jellies",
      "honey",
      "candy",
      "dried goods",
      "roasted nuts",
    ],
    prohibitedProducts: ["meat", "dairy", "canned low-acid foods", "alcohol"],
    requiresLabeling: true,
    saleLimitUSD: null,
    directSaleOnly: false,
    notes: "Oklahoma allows online sales with no sales cap.",
  },
  OR: {
    allowedProducts: [
      "baked goods",
      "jams",
      "jellies",
      "honey",
      "candy",
      "dried goods",
      "granola",
      "roasted nuts",
    ],
    prohibitedProducts: ["meat", "dairy", "canned low-acid foods", "alcohol"],
    requiresLabeling: true,
    saleLimitUSD: 20000,
    directSaleOnly: false,
    notes: "Oregon allows online sales up to $20K/year.",
  },
  PA: {
    allowedProducts: ["baked goods", "jams", "jellies", "honey", "candy"],
    prohibitedProducts: ["meat", "dairy", "canned goods", "alcohol"],
    requiresLabeling: true,
    saleLimitUSD: null,
    directSaleOnly: true,
    notes: "Pennsylvania requires direct-to-consumer sales only.",
  },
  RI: {
    allowedProducts: ["baked goods", "jams", "jellies", "honey", "candy"],
    prohibitedProducts: ["meat", "dairy", "canned goods", "alcohol"],
    requiresLabeling: true,
    saleLimitUSD: null,
    directSaleOnly: true,
    notes: "Rhode Island requires direct-to-consumer sales only.",
  },
  SC: {
    allowedProducts: ["baked goods", "jams", "jellies", "honey", "candy", "dried goods"],
    prohibitedProducts: ["meat", "dairy", "canned goods", "alcohol"],
    requiresLabeling: true,
    saleLimitUSD: null,
    directSaleOnly: true,
    notes: "South Carolina requires direct-to-consumer sales only.",
  },
  SD: {
    allowedProducts: [
      "baked goods",
      "jams",
      "jellies",
      "honey",
      "candy",
      "dried goods",
      "roasted nuts",
    ],
    prohibitedProducts: ["meat", "dairy", "canned low-acid foods", "alcohol"],
    requiresLabeling: true,
    saleLimitUSD: null,
    directSaleOnly: false,
    notes: "South Dakota allows online sales with no sales cap.",
  },
  TN: {
    allowedProducts: ["baked goods", "jams", "jellies", "honey", "candy", "dried goods"],
    prohibitedProducts: ["meat", "dairy", "canned goods", "alcohol"],
    requiresLabeling: true,
    saleLimitUSD: null,
    directSaleOnly: true,
    notes: "Tennessee requires direct-to-consumer sales only.",
  },
  TX: {
    allowedProducts: [
      "baked goods",
      "candy",
      "jams",
      "jellies",
      "honey",
      "dried herbs",
      "roasted nuts",
      "granola",
      "popcorn",
      "dried pasta",
      "tortillas",
      "fruit pies",
    ],
    prohibitedProducts: ["meat", "dairy", "canned low-acid foods", "alcohol"],
    requiresLabeling: true,
    saleLimitUSD: 50000,
    directSaleOnly: false,
    notes: "Texas Cottage Food Law allows online sales and third-party platforms up to $50K/year.",
  },
  UT: {
    allowedProducts: [
      "baked goods",
      "jams",
      "jellies",
      "honey",
      "candy",
      "dried goods",
      "roasted nuts",
    ],
    prohibitedProducts: ["meat", "dairy", "canned low-acid foods", "alcohol"],
    requiresLabeling: true,
    saleLimitUSD: null,
    directSaleOnly: false,
    notes: "Utah allows online sales with no sales cap.",
  },
  VT: {
    allowedProducts: [
      "baked goods",
      "jams",
      "jellies",
      "honey",
      "candy",
      "dried goods",
      "maple products",
    ],
    prohibitedProducts: ["meat", "dairy", "canned goods", "alcohol"],
    requiresLabeling: true,
    saleLimitUSD: null,
    directSaleOnly: true,
    notes: "Vermont requires direct-to-consumer sales only.",
  },
  VA: {
    allowedProducts: ["baked goods", "jams", "jellies", "honey", "candy", "dried goods"],
    prohibitedProducts: ["meat", "dairy", "canned goods", "alcohol"],
    requiresLabeling: true,
    saleLimitUSD: null,
    directSaleOnly: true,
    notes: "Virginia requires direct-to-consumer sales only.",
  },
  WA: {
    allowedProducts: [
      "baked goods",
      "jams",
      "jellies",
      "honey",
      "candy",
      "dried goods",
      "roasted nuts",
    ],
    prohibitedProducts: ["meat", "dairy", "canned low-acid foods", "alcohol"],
    requiresLabeling: true,
    saleLimitUSD: 25000,
    directSaleOnly: false,
    notes: "Washington allows online sales up to $25K/year.",
  },
  WV: {
    allowedProducts: ["baked goods", "jams", "jellies", "honey", "candy"],
    prohibitedProducts: ["meat", "dairy", "canned goods", "alcohol"],
    requiresLabeling: true,
    saleLimitUSD: null,
    directSaleOnly: true,
    notes: "West Virginia requires direct-to-consumer sales only.",
  },
  WI: {
    allowedProducts: ["baked goods", "jams", "jellies", "honey", "candy", "dried goods"],
    prohibitedProducts: ["meat", "dairy", "canned goods", "alcohol"],
    requiresLabeling: true,
    saleLimitUSD: null,
    directSaleOnly: true,
    notes: "Wisconsin requires direct-to-consumer sales only.",
  },
  WY: {
    allowedProducts: [
      "baked goods",
      "jams",
      "jellies",
      "honey",
      "candy",
      "dried goods",
      "roasted nuts",
    ],
    prohibitedProducts: ["meat", "dairy", "canned low-acid foods", "alcohol"],
    requiresLabeling: true,
    saleLimitUSD: null,
    directSaleOnly: false,
    notes: "Wyoming allows online sales with no sales cap.",
  },
};

/**
 * Returns the cottage food rules for a given US state abbreviation,
 * or null if the state is not found.
 */
export function getCottageFoodRules(
  stateAbbr: string | null | undefined
): CottageFoodStateRule | null {
  const key = String(stateAbbr || "")
    .toUpperCase()
    .trim();
  return COTTAGE_FOOD_RULES_BY_STATE[key] || null;
}

/**
 * Checks whether a product description is likely allowed under the
 * cottage food law for the given state.
 * Returns an error message if not allowed, or null if OK.
 */
export function validateCottageFoodProduct(
  stateAbbr: string | null | undefined,
  productDescription: string | null | undefined
): string | null {
  const rules = getCottageFoodRules(stateAbbr);
  if (!rules) {
    // Unknown state — warn but don't block
    return null;
  }
  const desc = String(productDescription || "").toLowerCase();
  for (const prohibited of rules.prohibitedProducts) {
    if (desc.includes(prohibited.toLowerCase())) {
      return (
        `"${prohibited}" is not permitted under ${stateAbbr} cottage food law. ` +
        `Allowed products include: ${rules.allowedProducts.slice(0, 5).join(", ")}. ` +
        rules.notes
      );
    }
  }
  return null;
}

export type ExchangeCategoryValidationInput = {
  category: string | null | undefined;
  imageCount: number;
  specs?: Record<string, unknown> | null;
  /** Seller's US state abbreviation (e.g. "TX") — required for local-food listings */
  sellerState?: string | null;
  /** Listing title — checked for prohibited keywords */
  title?: string | null;
  /** Listing description — checked for prohibited keywords */
  description?: string | null;
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

  // --- Prohibited items check (runs first, blocks all categories) ---
  const prohibitedKw = findProhibitedKeyword([
    input.title,
    input.description,
    String(specs.ingredients || ""),
    String(specs.provenance || ""),
  ]);
  if (prohibitedKw) {
    return {
      message:
        `This listing contains a prohibited term ("${prohibitedKw}"). ` +
        EXCHANGE_PROHIBITED_POLICY_NOTICE,
      reasonCode: "PROHIBITED_ITEM",
    };
  }

  // --- Cottage food law check (local-food category only) ---
  if (category === "local-food") {
    const sellerState = String(input.sellerState || "")
      .toUpperCase()
      .trim();
    if (!sellerState) {
      return {
        message:
          "Local Food listings require your state to verify cottage food law eligibility. " +
          "Please update your profile with your state before listing.",
        reasonCode: "LOCAL_FOOD_STATE_REQUIRED",
      };
    }
    const rules = getCottageFoodRules(sellerState);
    if (!rules) {
      return {
        message:
          `Cottage food law data is not available for state "${sellerState}". ` +
          "Please contact support to verify your eligibility before listing.",
        reasonCode: "LOCAL_FOOD_STATE_UNKNOWN",
      };
    }
    // Seller must attest compliance
    if (!specs.cottageFoodAttestation) {
      return {
        message: `You must confirm that your product complies with ${sellerState} cottage food law before listing.`,
        reasonCode: "LOCAL_FOOD_ATTESTATION_REQUIRED",
      };
    }
    // Check product description against prohibited products for this state
    const productErr = validateCottageFoodProduct(
      sellerState,
      String(input.description || specs.ingredients || "")
    );
    if (productErr) {
      return { message: productErr, reasonCode: "LOCAL_FOOD_PRODUCT_NOT_ALLOWED" };
    }
    // Warn if state requires direct sale only (online platform may not be allowed)
    if (rules.directSaleOnly) {
      // We allow the listing but the description must note pickup/local delivery only
      const fulfillment = String(specs.pickupOrDelivery || "").toLowerCase();
      if (!fulfillment || fulfillment === "shipping") {
        return {
          message:
            `${sellerState} cottage food law requires direct-to-consumer sales only. ` +
            "Your listing must use local pickup or local delivery as the fulfillment method.",
          reasonCode: "LOCAL_FOOD_DIRECT_SALE_REQUIRED",
        };
      }
    }
  }

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
