/**
 * Scout Knowledge Loader
 *
 * Loads and caches knowledge from the TradeScout Brain knowledge base.
 * Provides mock/fallback data for development and testing.
 *
 * Production: Reads from data/TradeScout Brain/40_KNOWLEDGE/
 * Development: Uses mock data to avoid file I/O overhead
 */

export interface BuildingCodeData {
  trade: string;
  jurisdiction: string;
  requirements: string[];
  permitRequired: boolean;
  inspectionPoints: string[];
  references: string[];
}

export interface PricingData {
  trade: string;
  region: string;
  laborCostPerHour: { min: number; max: number };
  materialCostPerUnit: { min: number; max: number };
  typicalProjectCost: { min: number; max: number };
  factors: string[];
  lastUpdated: string;
}

export interface TradeGuideData {
  trade: string;
  overview: string;
  steps: string[];
  tools: string[];
  safetyTips: string[];
  commonMistakes: string[];
}

export interface LocalGuideData {
  county: string;
  state: string;
  populationTrend: string;
  averageHomeValue: number;
  commonIssues: string[];
  localResources: Array<{ name: string; type: string; url?: string }>;
}

// ============================================================================
// MOCK DATA FOR DEVELOPMENT
// ============================================================================

const MOCK_BUILDING_CODES: Record<string, BuildingCodeData> = {
  "deck-texas": {
    trade: "Deck Building",
    jurisdiction: "Texas",
    requirements: [
      "Posts must be on concrete footings below frost line (12-18 inches in Texas)",
      "Deck must be at least 4 feet wide",
      "Railings required if deck is 30 inches or higher",
      "Railing height must be 36-42 inches",
      "Spacing between balusters must not exceed 4 inches",
      "Decking boards must be rated for outdoor use",
      "Fasteners must be corrosion-resistant",
    ],
    permitRequired: true,
    inspectionPoints: [
      "Foundation and footing inspection",
      "Framing and joist spacing",
      "Railing and guardrail installation",
      "Final deck surface inspection",
    ],
    references: [
      "Texas Building Code (IBC 2021)",
      "International Residential Code (IRC)",
      "Local county building department",
    ],
  },
  "roof-texas": {
    trade: "Roofing",
    jurisdiction: "Texas",
    requirements: [
      "Minimum roof pitch: 3:12 for asphalt shingles",
      "Wind resistance rating: 130+ mph recommended",
      "Ice and water shield required in certain areas",
      "Ventilation: 1 sq ft per 150 sq ft of attic space",
      "Flashing required at all penetrations",
      "Gutters and downspouts required",
    ],
    permitRequired: true,
    inspectionPoints: [
      "Roof deck inspection",
      "Underlayment and flashing",
      "Shingle installation and fastening",
      "Ventilation and ridge vent",
      "Final walkthrough",
    ],
    references: [
      "Texas Building Code (IBC 2021)",
      "NFPA 101 Life Safety Code",
      "Local wind speed requirements",
    ],
  },
  "electrical-texas": {
    trade: "Electrical Work",
    jurisdiction: "Texas",
    requirements: [
      "All circuits must have proper overcurrent protection",
      "GFCI protection required in bathrooms, kitchens, and outdoor areas",
      "AFCI protection required in bedrooms and living areas",
      "Grounding required for all circuits",
      "Wire sizing must match circuit amperage",
      "Conduit required for exposed wiring",
    ],
    permitRequired: true,
    inspectionPoints: [
      "Rough-in inspection (before drywall)",
      "Panel inspection and labeling",
      "GFCI and AFCI installation",
      "Final inspection and testing",
    ],
    references: [
      "National Electrical Code (NEC 2020)",
      "Texas Electrical Code",
      "Local utility requirements",
    ],
  },
};

const MOCK_PRICING: Record<string, PricingData> = {
  "deck-texas": {
    trade: "Deck Building",
    region: "Texas",
    laborCostPerHour: { min: 45, max: 75 },
    materialCostPerUnit: { min: 8, max: 15 }, // per sq ft
    typicalProjectCost: { min: 3000, max: 12000 }, // 400-1600 sq ft deck
    factors: [
      "Deck size and complexity",
      "Material quality (pressure-treated vs composite)",
      "Local labor rates",
      "Permit and inspection costs",
      "Site accessibility",
    ],
    lastUpdated: "2026-05-01",
  },
  "roof-texas": {
    trade: "Roofing",
    region: "Texas",
    laborCostPerHour: { min: 50, max: 85 },
    materialCostPerUnit: { min: 3, max: 8 }, // per sq ft
    typicalProjectCost: { min: 5000, max: 25000 }, // 1500-3000 sq ft roof
    factors: [
      "Roof size and pitch",
      "Material type (asphalt, metal, tile)",
      "Removal of old roofing",
      "Structural repairs needed",
      "Local market rates",
    ],
    lastUpdated: "2026-05-01",
  },
  "electrical-texas": {
    trade: "Electrical Work",
    region: "Texas",
    laborCostPerHour: { min: 65, max: 120 },
    materialCostPerUnit: { min: 2, max: 5 }, // per linear foot of wire
    typicalProjectCost: { min: 1500, max: 8000 }, // varies widely
    factors: [
      "Scope of work (new circuit, panel upgrade, etc.)",
      "Complexity and accessibility",
      "Material quality and brand",
      "Permit and inspection costs",
      "Electrician experience level",
    ],
    lastUpdated: "2026-05-01",
  },
};

const MOCK_TRADE_GUIDES: Record<string, TradeGuideData> = {
  deck: {
    trade: "Deck Building",
    overview:
      "Building a deck requires careful planning, proper materials, and adherence to local building codes. A well-built deck can last 15-20 years with proper maintenance.",
    steps: [
      "1. Plan and design: Determine size, layout, and materials",
      "2. Obtain permits: Get approval from local building department",
      "3. Prepare site: Clear area and mark layout",
      "4. Install footings: Dig below frost line and set concrete",
      "5. Build frame: Install posts, beams, and joists",
      "6. Add decking: Install deck boards and fasteners",
      "7. Install railings: Add safety railings and balusters",
      "8. Final touches: Add stairs, lighting, and finishing",
    ],
    tools: [
      "Circular saw or miter saw",
      "Power drill",
      "Level and measuring tape",
      "Post hole digger",
      "Nail gun or screwdriver",
      "Stair gauge",
    ],
    safetyTips: [
      "Always wear safety glasses and work gloves",
      "Use fall protection if working at heights",
      "Ensure proper ventilation under the deck",
      "Keep work area clear of obstacles",
      "Follow all local building codes",
    ],
    commonMistakes: [
      "Insufficient footing depth (frost heave)",
      "Improper spacing between balusters",
      "Using untreated lumber",
      "Inadequate fastening",
      "Poor drainage around footings",
    ],
  },
  roofing: {
    trade: "Roofing",
    overview:
      "Roofing is a critical structural component that protects your home. Proper installation and maintenance can extend roof life to 25-30 years.",
    steps: [
      "1. Inspect existing roof: Assess condition and damage",
      "2. Remove old roofing: Strip old shingles and underlayment",
      "3. Repair deck: Fix any damaged roof decking",
      "4. Install underlayment: Add ice and water shield",
      "5. Install flashing: Seal around penetrations",
      "6. Install shingles: Start from bottom and work up",
      "7. Install ridge vent: Add ventilation at peak",
      "8. Final inspection: Check all seams and fasteners",
    ],
    tools: [
      "Roofing nailer",
      "Hammer and pry bar",
      "Utility knife",
      "Measuring tape",
      "Chalk line",
      "Roof brackets and safety harness",
    ],
    safetyTips: [
      "Always use fall protection",
      "Work on clear, dry days",
      "Never work alone on a roof",
      "Keep tools secured to prevent dropping",
      "Watch for power lines",
    ],
    commonMistakes: [
      "Insufficient nailing (4 nails per shingle)",
      "Poor flashing installation",
      "Inadequate ventilation",
      "Improper underlayment overlap",
      "Ignoring local wind speed requirements",
    ],
  },
};

const MOCK_LOCAL_GUIDES: Record<string, LocalGuideData> = {
  "travis-tx": {
    county: "Travis",
    state: "TX",
    populationTrend: "Growing rapidly (Austin metro area)",
    averageHomeValue: 650000,
    commonIssues: [
      "Limestone foundation issues (expansive soil)",
      "High wind speeds during storms",
      "Drought and water restrictions",
      "Rapid urban development",
    ],
    localResources: [
      {
        name: "City of Austin Building Services",
        type: "Permits & Inspections",
        url: "https://www.austintexas.gov/building-services",
      },
      {
        name: "Travis County Building Inspection",
        type: "County Services",
        url: "https://www.traviscountytx.gov",
      },
      {
        name: "Austin Energy Code",
        type: "Energy Efficiency",
        url: "https://www.austintexas.gov/austin-energy-code",
      },
    ],
  },
  "harris-tx": {
    county: "Harris",
    state: "TX",
    populationTrend: "Stable (Houston metro area)",
    averageHomeValue: 380000,
    commonIssues: [
      "High humidity and moisture",
      "Coastal storm surge and flooding",
      "Subsidence (ground settling)",
      "Heat and UV damage to materials",
    ],
    localResources: [
      {
        name: "Harris County Building Services",
        type: "Permits & Inspections",
        url: "https://www.harriscountytx.gov",
      },
      {
        name: "City of Houston Building Services",
        type: "City Permits",
        url: "https://www.houstontx.gov/building",
      },
    ],
  },
};

// ============================================================================
// LOADER FUNCTIONS
// ============================================================================

/**
 * Get building code data for a specific trade and jurisdiction.
 */
export function getBuildingCodeData(trade: string, jurisdiction: string): BuildingCodeData | null {
  const key = `${trade.toLowerCase()}-${jurisdiction.toLowerCase()}`;
  return MOCK_BUILDING_CODES[key] || null;
}

/**
 * Get pricing data for a specific trade and region.
 */
export function getPricingData(trade: string, region: string): PricingData | null {
  const key = `${trade.toLowerCase()}-${region.toLowerCase()}`;
  return MOCK_PRICING[key] || null;
}

/**
 * Get trade guide for a specific trade.
 */
export function getTradeGuide(trade: string): TradeGuideData | null {
  const key = trade.toLowerCase();
  return MOCK_TRADE_GUIDES[key] || null;
}

/**
 * Get local guide for a specific county and state.
 */
export function getLocalGuide(county: string, state: string): LocalGuideData | null {
  const key = `${county.toLowerCase()}-${state.toLowerCase()}`;
  return MOCK_LOCAL_GUIDES[key] || null;
}

/**
 * Format building code data as readable text for inclusion in prompts.
 */
export function formatBuildingCodeText(data: BuildingCodeData): string {
  return `
**${data.trade} - ${data.jurisdiction}**

Permit Required: ${data.permitRequired ? "Yes" : "No"}

Requirements:
${data.requirements.map((r) => `- ${r}`).join("\n")}

Inspection Points:
${data.inspectionPoints.map((p) => `- ${p}`).join("\n")}

References:
${data.references.map((r) => `- ${r}`).join("\n")}
`.trim();
}

/**
 * Format pricing data as readable text for inclusion in prompts.
 */
export function formatPricingText(data: PricingData): string {
  return `
**${data.trade} - ${data.region}**

Labor: $${data.laborCostPerHour.min}-$${data.laborCostPerHour.max}/hour
Material: $${data.materialCostPerUnit.min}-$${data.materialCostPerUnit.max} per unit
Typical Project: $${data.typicalProjectCost.min.toLocaleString()}-$${data.typicalProjectCost.max.toLocaleString()}

Cost Factors:
${data.factors.map((f) => `- ${f}`).join("\n")}

Last Updated: ${data.lastUpdated}
`.trim();
}

/**
 * Format trade guide as readable text for inclusion in prompts.
 */
export function formatTradeGuideText(data: TradeGuideData): string {
  return `
**${data.trade} Guide**

${data.overview}

Steps:
${data.steps.join("\n")}

Tools Needed:
${data.tools.map((t) => `- ${t}`).join("\n")}

Safety Tips:
${data.safetyTips.map((s) => `- ${s}`).join("\n")}

Common Mistakes to Avoid:
${data.commonMistakes.map((m) => `- ${m}`).join("\n")}
`.trim();
}

/**
 * Format local guide as readable text for inclusion in prompts.
 */
export function formatLocalGuideText(data: LocalGuideData): string {
  return `
**${data.county} County, ${data.state}**

Population Trend: ${data.populationTrend}
Average Home Value: $${data.averageHomeValue.toLocaleString()}

Common Issues:
${data.commonIssues.map((i) => `- ${i}`).join("\n")}

Local Resources:
${data.localResources
  .map((r) => `- ${r.name} (${r.type})${r.url ? ` - ${r.url}` : ""}`)
  .join("\n")}
`.trim();
}
