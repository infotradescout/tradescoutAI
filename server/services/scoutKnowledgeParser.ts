/**
 * Scout Knowledge Parser
 *
 * Extracts and indexes real content from .docx files in the knowledge base.
 * Uses a simple text extraction approach without external dependencies.
 *
 * .docx files are ZIP archives with XML inside. We extract the text content
 * from document.xml and make it searchable.
 */

import fs from "fs";
import path from "path";
import { execSync } from "child_process";

const KNOWLEDGE_BASE_PATH = path.join(process.cwd(), "data", "TradeScout Brain", "40_KNOWLEDGE");

export interface ParsedKnowledge {
  file: string;
  type: "building_codes" | "trade_guides" | "pricing";
  title: string;
  content: string;
  extracted: boolean;
  error?: string;
}

/**
 * Extract text from a .docx file using command-line tools
 * Falls back to returning file metadata if extraction fails
 */
export function extractDocxContent(filePath: string): string | null {
  try {
    // Try using `docx2txt` if available (common on Linux)
    try {
      const result = execSync(`docx2txt.pl "${filePath}" 2>/dev/null || docx2txt "${filePath}" 2>/dev/null`, {
        encoding: "utf-8",
        stdio: ["pipe", "pipe", "ignore"],
        timeout: 5000,
      });
      return result.trim();
    } catch (e) {
      // Fallback: try using `python-docx` via Python if available
      try {
        const pythonScript = `
import sys
try:
    from docx import Document
    doc = Document('${filePath}')
    text = '\\n'.join([p.text for p in doc.paragraphs])
    print(text)
except Exception as e:
    print(f'Error: {e}', file=sys.stderr)
`;
        const result = execSync(`python3 -c "${pythonScript.replace(/"/g, '\\"')}" 2>/dev/null`, {
          encoding: "utf-8",
          timeout: 5000,
        });
        return result.trim();
      } catch (e) {
        // If no tools available, return null
        return null;
      }
    }
  } catch (error) {
    console.warn(`[Knowledge Parser] Failed to extract ${filePath}:`, error);
    return null;
  }
}

/**
 * Parse a single knowledge file
 */
export function parseKnowledgeFile(filePath: string, type: "building_codes" | "trade_guides" | "pricing"): ParsedKnowledge {
  const fileName = path.basename(filePath);
  const title = fileName.replace(/\.docx$/, "").replace(/_/g, " ");

  // Try to extract content
  const content = extractDocxContent(filePath);

  if (content) {
    return {
      file: fileName,
      type,
      title,
      content,
      extracted: true,
    };
  }

  // If extraction failed, return metadata
  return {
    file: fileName,
    type,
    title,
    content: `[Content not yet extracted from ${fileName}. File exists but extraction tools are not available.]`,
    extracted: false,
    error: "Extraction tools not available",
  };
}

/**
 * Parse all knowledge files in a directory
 */
export function parseKnowledgeDirectory(
  dirPath: string,
  type: "building_codes" | "trade_guides" | "pricing"
): ParsedKnowledge[] {
  const results: ParsedKnowledge[] = [];

  if (!fs.existsSync(dirPath)) {
    return results;
  }

  const walkDir = (dir: string) => {
    const entries = fs.readdirSync(dir);
    entries.forEach((entry) => {
      const fullPath = path.join(dir, entry);
      const stat = fs.statSync(fullPath);

      if (stat.isDirectory()) {
        walkDir(fullPath);
      } else if (entry.endsWith(".docx")) {
        const parsed = parseKnowledgeFile(fullPath, type);
        results.push(parsed);
      }
    });
  };

  walkDir(dirPath);
  return results;
}

/**
 * Load and index all knowledge from the knowledge base
 */
export function indexAllKnowledge(): {
  buildingCodes: ParsedKnowledge[];
  tradeGuides: ParsedKnowledge[];
  pricing: ParsedKnowledge[];
  totalFiles: number;
  successfulExtractions: number;
} {
  const buildingCodesDir = path.join(KNOWLEDGE_BASE_PATH, "41_BUILDING_CODES");
  const tradeGuidesDir = path.join(KNOWLEDGE_BASE_PATH, "42_TRADE_GUIDES");
  const pricingDir = path.join(KNOWLEDGE_BASE_PATH, "43_MARKETS_PRICING");

  const buildingCodes = parseKnowledgeDirectory(buildingCodesDir, "building_codes");
  const tradeGuides = parseKnowledgeDirectory(tradeGuidesDir, "trade_guides");
  const pricing = parseKnowledgeDirectory(pricingDir, "pricing");

  const totalFiles = buildingCodes.length + tradeGuides.length + pricing.length;
  const successfulExtractions = [
    ...buildingCodes,
    ...tradeGuides,
    ...pricing,
  ].filter((k) => k.extracted).length;

  return {
    buildingCodes,
    tradeGuides,
    pricing,
    totalFiles,
    successfulExtractions,
  };
}

/**
 * Search knowledge base for relevant content
 */
export function searchKnowledge(
  query: string,
  type?: "building_codes" | "trade_guides" | "pricing"
): ParsedKnowledge[] {
  const allKnowledge = indexAllKnowledge();
  const searchTerm = query.toLowerCase();

  let searchSpace: ParsedKnowledge[] = [];
  if (type === "building_codes") {
    searchSpace = allKnowledge.buildingCodes;
  } else if (type === "trade_guides") {
    searchSpace = allKnowledge.tradeGuides;
  } else if (type === "pricing") {
    searchSpace = allKnowledge.pricing;
  } else {
    searchSpace = [
      ...allKnowledge.buildingCodes,
      ...allKnowledge.tradeGuides,
      ...allKnowledge.pricing,
    ];
  }

  return searchSpace.filter((knowledge) => {
    const titleMatch = knowledge.title.toLowerCase().includes(searchTerm);
    const contentMatch = knowledge.content.toLowerCase().includes(searchTerm);
    return titleMatch || contentMatch;
  });
}

/**
 * Get knowledge base status and extraction stats
 */
export function getKnowledgeIndexStatus(): {
  available: boolean;
  totalFiles: number;
  successfulExtractions: number;
  failedExtractions: number;
  extractionRate: string;
  details: {
    buildingCodes: number;
    tradeGuides: number;
    pricing: number;
  };
} {
  const index = indexAllKnowledge();

  return {
    available: index.totalFiles > 0,
    totalFiles: index.totalFiles,
    successfulExtractions: index.successfulExtractions,
    failedExtractions: index.totalFiles - index.successfulExtractions,
    extractionRate: `${((index.successfulExtractions / index.totalFiles) * 100).toFixed(1)}%`,
    details: {
      buildingCodes: index.buildingCodes.length,
      tradeGuides: index.tradeGuides.length,
      pricing: index.pricing.length,
    },
  };
}

/**
 * Get a formatted summary of indexed knowledge
 */
export function getKnowledgeSummary(): string {
  const status = getKnowledgeIndexStatus();

  if (!status.available) {
    return "Knowledge base is empty or not found.";
  }

  const lines = [
    "Scout Knowledge Base Index:",
    `- Total Files: ${status.totalFiles}`,
    `- Successfully Extracted: ${status.successfulExtractions}`,
    `- Extraction Rate: ${status.extractionRate}`,
    `- Building Codes: ${status.details.buildingCodes} files`,
    `- Trade Guides: ${status.details.tradeGuides} files`,
    `- Pricing Data: ${status.details.pricing} files`,
  ];

  return lines.join("\n");
}
