/**
 * Scout Knowledge Index Service
 *
 * Automatically extracts text content from uploaded files and indexes it
 * for fast, searchable access by Scout.
 *
 * Flow:
 * 1. File uploaded → Extract text content
 * 2. Content indexed → Stored in searchable format
 * 3. Scout queries → Search the index (not the files)
 * 4. Files can be deleted → Knowledge persists
 */

import fs from "fs";
import path from "path";
import { execSync } from "child_process";

export interface IndexedKnowledge {
  id: string;
  title: string;
  content: string;
  category: "building_codes" | "pricing" | "trade_guides" | "general";
  tags: string[];
  sourceFile: string;
  extractedAt: number;
  wordCount: number;
  searchableText: string; // Lowercase, normalized for searching
}

export interface IndexStats {
  totalDocuments: number;
  totalWords: number;
  categories: Record<string, number>;
  lastUpdated: number;
  searchableIndex: Map<string, IndexedKnowledge[]>; // word -> documents
}

/**
 * In-memory knowledge index
 * In production, this would be a database (PostgreSQL, Elasticsearch, etc.)
 */
const knowledgeIndex = new Map<string, IndexedKnowledge>();
const wordIndex = new Map<string, Set<string>>(); // word -> document IDs
const stats: IndexStats = {
  totalDocuments: 0,
  totalWords: 0,
  categories: {},
  lastUpdated: 0,
  searchableIndex: new Map(),
};

/**
 * Extract text from a file using available tools
 */
export function extractTextFromFile(filePath: string): string | null {
  try {
    // Try docx2txt first
    try {
      const result = execSync(`docx2txt.pl "${filePath}" 2>/dev/null || docx2txt "${filePath}" 2>/dev/null`, {
        encoding: "utf-8",
        stdio: ["pipe", "pipe", "ignore"],
        timeout: 5000,
      });
      return result.trim();
    } catch (e) {
      // Try python-docx
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
        // Try pdftotext for PDFs
        if (filePath.endsWith(".pdf")) {
          try {
            const result = execSync(`pdftotext "${filePath}" - 2>/dev/null`, {
              encoding: "utf-8",
              timeout: 5000,
            });
            return result.trim();
          } catch (e) {
            return null;
          }
        }
        return null;
      }
    }
  } catch (error) {
    console.warn(`[Knowledge Index] Failed to extract ${filePath}:`, error);
    return null;
  }
}

/**
 * Categorize content based on keywords
 */
export function categorizeContent(
  content: string,
  fileName: string
): "building_codes" | "pricing" | "trade_guides" | "general" {
  const lowerContent = content.toLowerCase();
  const lowerFileName = fileName.toLowerCase();

  if (
    lowerContent.includes("code") ||
    lowerContent.includes("permit") ||
    lowerContent.includes("inspection") ||
    lowerFileName.includes("code") ||
    lowerFileName.includes("building")
  ) {
    return "building_codes";
  }

  if (
    lowerContent.includes("price") ||
    lowerContent.includes("cost") ||
    lowerContent.includes("$") ||
    lowerFileName.includes("pricing") ||
    lowerFileName.includes("price")
  ) {
    return "pricing";
  }

  if (
    lowerContent.includes("step") ||
    lowerContent.includes("how to") ||
    lowerContent.includes("guide") ||
    lowerFileName.includes("guide") ||
    lowerFileName.includes("how")
  ) {
    return "trade_guides";
  }

  return "general";
}

/**
 * Extract keywords/tags from content
 */
export function extractTags(content: string): string[] {
  const commonTags = [
    "roofing",
    "electrical",
    "plumbing",
    "hvac",
    "carpentry",
    "masonry",
    "landscaping",
    "painting",
    "flooring",
    "windows",
    "doors",
    "deck",
    "patio",
    "foundation",
    "insulation",
    "drywall",
  ];

  const tags: string[] = [];
  const lowerContent = content.toLowerCase();

  for (const tag of commonTags) {
    if (lowerContent.includes(tag)) {
      tags.push(tag);
    }
  }

  return tags;
}

/**
 * Index a single document
 */
export function indexDocument(
  filePath: string,
  title?: string
): IndexedKnowledge | null {
  // Extract content
  const content = extractTextFromFile(filePath);
  if (!content) {
    console.warn(`[Knowledge Index] Could not extract content from ${filePath}`);
    return null;
  }

  // Create indexed document
  const fileName = path.basename(filePath);
  const docTitle = title || fileName.replace(/\.[^/.]+$/, "");
  const category = categorizeContent(content, fileName);
  const tags = extractTags(content);
  const wordCount = content.split(/\s+/).length;

  const doc: IndexedKnowledge = {
    id: `doc_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    title: docTitle,
    content,
    category,
    tags,
    sourceFile: fileName,
    extractedAt: Date.now(),
    wordCount,
    searchableText: content.toLowerCase().replace(/[^\w\s]/g, " "),
  };

  // Add to index
  knowledgeIndex.set(doc.id, doc);

  // Update word index for full-text search
  const words = doc.searchableText.split(/\s+/).filter((w) => w.length > 2);
  for (const word of words) {
    if (!wordIndex.has(word)) {
      wordIndex.set(word, new Set());
    }
    wordIndex.get(word)!.add(doc.id);
  }

  // Update stats
  stats.totalDocuments++;
  stats.totalWords += wordCount;
  stats.categories[category] = (stats.categories[category] || 0) + 1;
  stats.lastUpdated = Date.now();

  return doc;
}

/**
 * Index multiple documents from a directory
 */
export function indexDirectory(dirPath: string): IndexedKnowledge[] {
  const indexed: IndexedKnowledge[] = [];

  if (!fs.existsSync(dirPath)) {
    console.warn(`[Knowledge Index] Directory not found: ${dirPath}`);
    return indexed;
  }

  const walkDir = (dir: string) => {
    const entries = fs.readdirSync(dir);
    for (const entry of entries) {
      const fullPath = path.join(dir, entry);
      const stat = fs.statSync(fullPath);

      if (stat.isDirectory()) {
        walkDir(fullPath);
      } else if (entry.endsWith(".docx") || entry.endsWith(".pdf")) {
        const doc = indexDocument(fullPath);
        if (doc) {
          indexed.push(doc);
        }
      }
    }
  };

  walkDir(dirPath);
  return indexed;
}

/**
 * Search the knowledge index
 */
export function searchKnowledge(query: string, limit: number = 10): IndexedKnowledge[] {
  const queryWords = query
    .toLowerCase()
    .replace(/[^\w\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 2);

  if (queryWords.length === 0) {
    return [];
  }

  // Find documents that match query words
  const matches = new Map<string, number>(); // docId -> score

  for (const word of queryWords) {
    const docIds = wordIndex.get(word) || new Set();
    for (const docId of docIds) {
      matches.set(docId, (matches.get(docId) || 0) + 1);
    }
  }

  // Sort by score and return
  return Array.from(matches.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([docId]) => knowledgeIndex.get(docId)!)
    .filter((doc) => doc !== undefined);
}

/**
 * Search by category
 */
export function searchByCategory(
  category: "building_codes" | "pricing" | "trade_guides" | "general",
  limit: number = 10
): IndexedKnowledge[] {
  return Array.from(knowledgeIndex.values())
    .filter((doc) => doc.category === category)
    .slice(0, limit);
}

/**
 * Search by tag
 */
export function searchByTag(tag: string, limit: number = 10): IndexedKnowledge[] {
  return Array.from(knowledgeIndex.values())
    .filter((doc) => doc.tags.includes(tag.toLowerCase()))
    .slice(0, limit);
}

/**
 * Get a document by ID
 */
export function getDocument(docId: string): IndexedKnowledge | null {
  return knowledgeIndex.get(docId) || null;
}

/**
 * Get all documents
 */
export function getAllDocuments(): IndexedKnowledge[] {
  return Array.from(knowledgeIndex.values());
}

/**
 * Get index statistics
 */
export function getIndexStats(): IndexStats {
  return {
    ...stats,
    searchableIndex: wordIndex,
  };
}

/**
 * Clear the index
 */
export function clearIndex(): void {
  knowledgeIndex.clear();
  wordIndex.clear();
  stats.totalDocuments = 0;
  stats.totalWords = 0;
  stats.categories = {};
  stats.lastUpdated = 0;
}

/**
 * Get a summary of indexed knowledge
 */
export function getIndexSummary(): string {
  const lines = [
    "Scout Knowledge Index Summary:",
    `- Total Documents: ${stats.totalDocuments}`,
    `- Total Words: ${stats.totalWords.toLocaleString()}`,
    `- Last Updated: ${new Date(stats.lastUpdated).toLocaleString()}`,
    "",
    "By Category:",
  ];

  for (const [category, count] of Object.entries(stats.categories)) {
    lines.push(`  - ${category}: ${count}`);
  }

  return lines.join("\n");
}

/**
 * Export index as JSON (for backup/transfer)
 */
export function exportIndexAsJson(): string {
  const data = {
    documents: Array.from(knowledgeIndex.values()),
    stats,
    exportedAt: new Date().toISOString(),
  };
  return JSON.stringify(data, null, 2);
}

/**
 * Import index from JSON
 */
export function importIndexFromJson(jsonData: string): void {
  try {
    const data = JSON.parse(jsonData);
    clearIndex();

    for (const doc of data.documents) {
      knowledgeIndex.set(doc.id, doc);

      // Rebuild word index
      const words = doc.searchableText.split(/\s+/).filter((w: string) => w.length > 2);
      for (const word of words) {
        if (!wordIndex.has(word)) {
          wordIndex.set(word, new Set());
        }
        wordIndex.get(word)!.add(doc.id);
      }

      // Update stats
      stats.totalDocuments++;
      stats.totalWords += doc.wordCount;
      stats.categories[doc.category] = (stats.categories[doc.category] || 0) + 1;
    }

    stats.lastUpdated = Date.now();
  } catch (error) {
    console.error("[Knowledge Index] Failed to import:", error);
  }
}
