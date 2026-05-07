/**
 * Scout Structured Output Formatter
 *
 * Converts Scout responses into structured JSON formats for:
 * - Pricing data (tables, ranges, breakdowns)
 * - Building codes (requirements, specifications, jurisdictions)
 * - Trade guides (steps, tools, safety)
 *
 * Enables clean UI rendering without parsing text responses.
 */

export interface PricingData {
  type: "pricing";
  trade: string;
  location?: string;
  currency: string;
  estimates: {
    low: number;
    high: number;
    average?: number;
  };
  breakdown?: {
    category: string;
    low: number;
    high: number;
  }[];
  factors?: string[];
  lastUpdated?: string;
  source: string;
}

export interface BuildingCodeData {
  type: "building_code";
  trade: string;
  jurisdiction: string;
  requirements: {
    requirement: string;
    description: string;
    reference?: string;
  }[];
  permits?: {
    required: boolean;
    types?: string[];
    estimatedCost?: { low: number; high: number };
  };
  inspections?: {
    required: boolean;
    stages?: string[];
  };
  lastUpdated?: string;
  source: string;
}

export interface TradeGuideData {
  type: "trade_guide";
  trade: string;
  title: string;
  steps: {
    number: number;
    title: string;
    description: string;
    duration?: string;
  }[];
  tools?: string[];
  materials?: string[];
  safetyTips?: string[];
  estimatedTime?: string;
  difficulty?: "beginner" | "intermediate" | "advanced";
  source: string;
}

export interface LocalDataPoint {
  type: "local_data";
  location: string;
  category: string;
  data: Record<string, any>;
  source: string;
}

export type StructuredData = PricingData | BuildingCodeData | TradeGuideData | LocalDataPoint;

/**
 * Parse pricing information from text response
 */
export function extractPricingStructure(
  text: string,
  trade: string,
  location?: string
): PricingData | null {
  // Simple pattern matching for pricing ranges
  const pricePattern = /\$?([\d,]+)\s*-\s*\$?([\d,]+)/;
  const match = text.match(pricePattern);

  if (!match) {
    return null;
  }

  const low = parseInt(match[1].replace(/,/g, ""), 10);
  const high = parseInt(match[2].replace(/,/g, ""), 10);

  return {
    type: "pricing",
    trade,
    location,
    currency: "USD",
    estimates: {
      low,
      high,
      average: Math.round((low + high) / 2),
    },
    lastUpdated: new Date().toISOString(),
    source: "Scout 2.0",
  };
}

/**
 * Parse building code requirements from text response
 */
export function extractBuildingCodeStructure(
  text: string,
  trade: string,
  jurisdiction: string
): BuildingCodeData | null {
  const requirements: BuildingCodeData["requirements"] = [];

  // Simple pattern matching for requirements (lines starting with bullets or numbers)
  const lines = text.split("\n");
  let inRequirements = false;

  for (const line of lines) {
    if (line.toLowerCase().includes("requirement")) {
      inRequirements = true;
      continue;
    }

    if (inRequirements && (line.match(/^[\d•\-*]\s/) || line.match(/^\s+[\d•\-*]\s/))) {
      const cleaned = line.replace(/^[\s\d•\-*]+/, "").trim();
      if (cleaned) {
        requirements.push({
          requirement: cleaned,
          description: cleaned,
        });
      }
    }
  }

  if (requirements.length === 0) {
    return null;
  }

  return {
    type: "building_code",
    trade,
    jurisdiction,
    requirements,
    permits: {
      required: text.toLowerCase().includes("permit"),
    },
    inspections: {
      required: text.toLowerCase().includes("inspection"),
    },
    lastUpdated: new Date().toISOString(),
    source: "Scout 2.0",
  };
}

/**
 * Parse trade guide steps from text response
 */
export function extractTradeGuideStructure(
  text: string,
  trade: string,
  title?: string
): TradeGuideData | null {
  const steps: TradeGuideData["steps"] = [];
  const tools: string[] = [];
  const safetyTips: string[] = [];

  // Parse numbered steps
  const stepPattern = /^(\d+)\.\s+(.+?)(?:\n|$)/gm;
  let match;

  while ((match = stepPattern.exec(text)) !== null) {
    steps.push({
      number: parseInt(match[1], 10),
      title: match[2].trim(),
      description: match[2].trim(),
    });
  }

  // Extract tools section
  const toolsMatch = text.match(/tools?:?\s*\n([\s\S]*?)(?:\n\n|$)/i);
  if (toolsMatch) {
    const toolLines = toolsMatch[1].split("\n");
    toolLines.forEach((line) => {
      const cleaned = line.replace(/^[\s\d•\-*]+/, "").trim();
      if (cleaned) {
        tools.push(cleaned);
      }
    });
  }

  // Extract safety tips
  const safetyMatch = text.match(/safety\s+tips?:?\s*\n([\s\S]*?)(?:\n\n|$)/i);
  if (safetyMatch) {
    const safetyLines = safetyMatch[1].split("\n");
    safetyLines.forEach((line) => {
      const cleaned = line.replace(/^[\s\d•\-*]+/, "").trim();
      if (cleaned) {
        safetyTips.push(cleaned);
      }
    });
  }

  if (steps.length === 0) {
    return null;
  }

  return {
    type: "trade_guide",
    trade,
    title: title || `${trade} Guide`,
    steps,
    tools: tools.length > 0 ? tools : undefined,
    safetyTips: safetyTips.length > 0 ? safetyTips : undefined,
    source: "Scout 2.0",
  };
}

/**
 * Format structured data as a clean table (for CLI/text output)
 */
export function formatStructuredAsTable(data: StructuredData): string {
  if (data.type === "pricing") {
    const lines = [
      `Pricing: ${data.trade}`,
      `Location: ${data.location || "General"}`,
      `Range: $${data.estimates.low.toLocaleString()} - $${data.estimates.high.toLocaleString()}`,
      `Average: $${data.estimates.average?.toLocaleString() || "N/A"}`,
    ];

    if (data.breakdown) {
      lines.push("\nBreakdown:");
      data.breakdown.forEach((item) => {
        lines.push(
          `  ${item.category}: $${item.low.toLocaleString()} - $${item.high.toLocaleString()}`
        );
      });
    }

    return lines.join("\n");
  }

  if (data.type === "building_code") {
    const lines = [
      `Building Code: ${data.trade}`,
      `Jurisdiction: ${data.jurisdiction}`,
      "\nRequirements:",
    ];

    data.requirements.forEach((req) => {
      lines.push(`  • ${req.requirement}`);
    });

    if (data.permits?.required) {
      lines.push(`\nPermit Required: Yes`);
    }

    return lines.join("\n");
  }

  if (data.type === "trade_guide") {
    const lines = [
      `Guide: ${data.title}`,
      `Trade: ${data.trade}`,
      "\nSteps:",
    ];

    data.steps.forEach((step) => {
      lines.push(`  ${step.number}. ${step.title}`);
    });

    if (data.tools && data.tools.length > 0) {
      lines.push("\nTools Needed:");
      data.tools.forEach((tool) => {
        lines.push(`  • ${tool}`);
      });
    }

    if (data.safetyTips && data.safetyTips.length > 0) {
      lines.push("\nSafety Tips:");
      data.safetyTips.forEach((tip) => {
        lines.push(`  • ${tip}`);
      });
    }

    return lines.join("\n");
  }

  return JSON.stringify(data, null, 2);
}

/**
 * Extract all structured data from a Scout response
 */
export function extractAllStructuredData(
  text: string,
  context: { trade?: string; location?: string; jurisdiction?: string }
): StructuredData[] {
  const results: StructuredData[] = [];

  // Try to extract pricing
  if (context.trade) {
    const pricing = extractPricingStructure(text, context.trade, context.location);
    if (pricing) {
      results.push(pricing);
    }

    // Try to extract building code
    if (context.jurisdiction) {
      const code = extractBuildingCodeStructure(text, context.trade, context.jurisdiction);
      if (code) {
        results.push(code);
      }
    }

    // Try to extract trade guide
    const guide = extractTradeGuideStructure(text, context.trade);
    if (guide) {
      results.push(guide);
    }
  }

  return results;
}
