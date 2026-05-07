/**
 * Scout Knowledge Loader
 *
 * Loads real knowledge from the TradeScout Brain knowledge base.
 * Reads from actual .docx files in data/TradeScout Brain/40_KNOWLEDGE/
 *
 * NO MOCK DATA. Only real, verified content from your knowledge base.
 * If data is not indexed yet, reports honestly as "not yet indexed".
 */

import fs from "fs";
import path from "path";

const KNOWLEDGE_BASE_PATH = path.join(process.cwd(), "data", "TradeScout Brain", "40_KNOWLEDGE");

export interface KnowledgeSource {
  type: "building_codes" | "trade_guides" | "pricing" | "local_data";
  file: string;
  indexed: boolean;
  content?: string;
  error?: string;
}

/**
 * Get all available knowledge files from the knowledge base
 */
export function getAvailableKnowledgeFiles(): KnowledgeSource[] {
  const sources: KnowledgeSource[] = [];

  try {
    // Building codes
    const buildingCodesDir = path.join(KNOWLEDGE_BASE_PATH, "41_BUILDING_CODES");
    if (fs.existsSync(buildingCodesDir)) {
      const files = fs.readdirSync(buildingCodesDir).filter((f) => f.endsWith(".docx"));
      files.forEach((file) => {
        sources.push({
          type: "building_codes",
          file,
          indexed: false, // Would be true if we had parsed and indexed it
        });
      });
    }

    // Trade guides
    const tradeGuidesDir = path.join(KNOWLEDGE_BASE_PATH, "42_TRADE_GUIDES");
    if (fs.existsSync(tradeGuidesDir)) {
      const walkDir = (dir: string) => {
        const files = fs.readdirSync(dir);
        files.forEach((file) => {
          const fullPath = path.join(dir, file);
          const stat = fs.statSync(fullPath);
          if (stat.isDirectory()) {
            walkDir(fullPath);
          } else if (file.endsWith(".docx")) {
            sources.push({
              type: "trade_guides",
              file: path.relative(tradeGuidesDir, fullPath),
              indexed: false,
            });
          }
        });
      };
      walkDir(tradeGuidesDir);
    }

    // Pricing
    const pricingDir = path.join(KNOWLEDGE_BASE_PATH, "43_MARKETS_PRICING");
    if (fs.existsSync(pricingDir)) {
      const files = fs.readdirSync(pricingDir).filter((f) => f.endsWith(".docx"));
      files.forEach((file) => {
        sources.push({
          type: "pricing",
          file,
          indexed: false,
        });
      });
    }
  } catch (error) {
    console.error("[Knowledge Loader] Error scanning knowledge base:", error);
  }

  return sources;
}

/**
 * Get building code files available
 */
export function getBuildingCodeFiles(): string[] {
  const buildingCodesDir = path.join(KNOWLEDGE_BASE_PATH, "41_BUILDING_CODES");
  if (!fs.existsSync(buildingCodesDir)) {
    return [];
  }
  return fs.readdirSync(buildingCodesDir).filter((f) => f.endsWith(".docx"));
}

/**
 * Get trade guide files available
 */
export function getTradeGuideFiles(): string[] {
  const tradeGuidesDir = path.join(KNOWLEDGE_BASE_PATH, "42_TRADE_GUIDES");
  if (!fs.existsSync(tradeGuidesDir)) {
    return [];
  }

  const files: string[] = [];
  const walkDir = (dir: string) => {
    const entries = fs.readdirSync(dir);
    entries.forEach((entry) => {
      const fullPath = path.join(dir, entry);
      const stat = fs.statSync(fullPath);
      if (stat.isDirectory()) {
        walkDir(fullPath);
      } else if (entry.endsWith(".docx")) {
        files.push(path.relative(tradeGuidesDir, fullPath));
      }
    });
  };
  walkDir(tradeGuidesDir);
  return files;
}

/**
 * Get pricing files available
 */
export function getPricingFiles(): string[] {
  const pricingDir = path.join(KNOWLEDGE_BASE_PATH, "43_MARKETS_PRICING");
  if (!fs.existsSync(pricingDir)) {
    return [];
  }
  return fs.readdirSync(pricingDir).filter((f) => f.endsWith(".docx"));
}

/**
 * Check if knowledge base is available
 */
export function isKnowledgeBaseAvailable(): boolean {
  return fs.existsSync(KNOWLEDGE_BASE_PATH);
}

/**
 * Get knowledge base status
 */
export function getKnowledgeBaseStatus(): {
  available: boolean;
  path: string;
  buildingCodesCount: number;
  tradeGuidesCount: number;
  pricingCount: number;
  totalFiles: number;
} {
  const buildingCodes = getBuildingCodeFiles();
  const tradeGuides = getTradeGuideFiles();
  const pricing = getPricingFiles();

  return {
    available: isKnowledgeBaseAvailable(),
    path: KNOWLEDGE_BASE_PATH,
    buildingCodesCount: buildingCodes.length,
    tradeGuidesCount: tradeGuides.length,
    pricingCount: pricing.length,
    totalFiles: buildingCodes.length + tradeGuides.length + pricing.length,
  };
}

/**
 * Format knowledge availability message
 */
export function formatKnowledgeAvailability(): string {
  const status = getKnowledgeBaseStatus();

  if (!status.available) {
    return "Knowledge base not found at: " + status.path;
  }

  const lines = [
    "TradeScout Knowledge Base Status:",
    `- Building Codes: ${status.buildingCodesCount} files`,
    `- Trade Guides: ${status.tradeGuidesCount} files`,
    `- Pricing Data: ${status.pricingCount} files`,
    `- Total: ${status.totalFiles} files`,
  ];

  return lines.join("\n");
}

/**
 * Get honest response when data is not yet indexed
 */
export function getNotIndexedResponse(dataType: string, context?: string): string {
  const contextStr = context ? ` for ${context}` : "";
  return `I don't have ${dataType}${contextStr} indexed yet in the TradeScout knowledge base. The files exist but haven't been processed into a searchable format. Please check the raw documents in the knowledge base or ask your team to index this data.`;
}

/**
 * Get knowledge base summary for debugging
 */
export function getKnowledgeSummary(): {
  status: string;
  files: KnowledgeSource[];
  summary: string;
} {
  const files = getAvailableKnowledgeFiles();
  const status = getKnowledgeBaseStatus();

  const summary = `
Knowledge Base Summary:
- Location: ${status.path}
- Available: ${status.available}
- Building Codes: ${status.buildingCodesCount} files
- Trade Guides: ${status.tradeGuidesCount} files
- Pricing: ${status.pricingCount} files
- Total: ${status.totalFiles} files

Note: These are the raw .docx files available. To use them in Scout,
they need to be indexed and parsed. Currently, Scout will report
"not yet indexed" for queries until indexing is complete.
  `.trim();

  return {
    status: status.available ? "ready" : "not_found",
    files,
    summary,
  };
}
