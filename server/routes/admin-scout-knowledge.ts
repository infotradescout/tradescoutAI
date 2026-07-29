/**
 * Admin Scout Knowledge Management Routes
 *
 * Endpoints for managing Scout's knowledge index:
 * - Index new files
 * - Search the knowledge base
 * - View indexing status
 * - Clear/rebuild index
 */

import { Router, Request, Response } from "express";
import { readFileSync } from "node:fs";
import multer from "multer";
import { requireAdmin } from "../auth";
import {
  indexDocument,
  indexDirectory,
  searchKnowledge,
  searchByCategory,
  searchByTag,
  getDocument,
  getAllDocuments,
  getIndexStats,
  clearIndex,
  getIndexSummary,
  exportIndexAsJson,
  importIndexFromJson,
} from "../services/scoutKnowledgeIndexService";

const router = Router();
const upload = multer({ dest: "uploads/scout-knowledge/" });

/**
 * GET /admin/scout-knowledge/status
 * Get the current status of Scout's knowledge index
 */
router.get("/status", requireAdmin, (req: Request, res: Response) => {
  try {
    const stats = getIndexStats();
    const summary = getIndexSummary();

    res.json({
      success: true,
      status: "indexed",
      stats: {
        totalDocuments: stats.totalDocuments,
        totalWords: stats.totalWords,
        categories: stats.categories,
        lastUpdated: new Date(stats.lastUpdated).toISOString(),
      },
      summary,
    });
  } catch (error) {
    res.status(500).json({ error: "Failed to get index status", details: String(error) });
  }
});

/**
 * POST /admin/scout-knowledge/index-file
 * Index a single uploaded file
 */
router.post(
  "/index-file",
  requireAdmin,
  upload.single("file"),
  async (req: Request, res: Response) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: "No file uploaded" });
      }

      const title = req.body.title || req.file.originalname;
      const doc = indexDocument(req.file.path, title);

      if (!doc) {
        return res.status(400).json({ error: "Failed to extract content from file" });
      }

      res.json({
        success: true,
        document: {
          id: doc.id,
          title: doc.title,
          category: doc.category,
          wordCount: doc.wordCount,
          tags: doc.tags,
          extractedAt: new Date(doc.extractedAt).toISOString(),
        },
      });
    } catch (error) {
      res.status(500).json({ error: "Failed to index file", details: String(error) });
    }
  }
);

/**
 * POST /admin/scout-knowledge/index-directory
 * Index all files in a directory
 */
router.post("/index-directory", requireAdmin, async (req: Request, res: Response) => {
  try {
    const { dirPath } = req.body;

    if (!dirPath) {
      return res.status(400).json({ error: "Directory path required" });
    }

    const indexed = indexDirectory(dirPath);

    res.json({
      success: true,
      indexed: indexed.length,
      documents: indexed.map((doc) => ({
        id: doc.id,
        title: doc.title,
        category: doc.category,
        wordCount: doc.wordCount,
        tags: doc.tags,
      })),
    });
  } catch (error) {
    res.status(500).json({ error: "Failed to index directory", details: String(error) });
  }
});

/**
 * GET /admin/scout-knowledge/search
 * Search the knowledge index
 */
router.get("/search", requireAdmin, (req: Request, res: Response) => {
  try {
    const { q, limit = 10 } = req.query;

    if (!q) {
      return res.status(400).json({ error: "Search query required" });
    }

    const results = searchKnowledge(String(q), parseInt(String(limit), 10));

    res.json({
      success: true,
      query: q,
      results: results.map((doc) => ({
        id: doc.id,
        title: doc.title,
        category: doc.category,
        tags: doc.tags,
        wordCount: doc.wordCount,
        preview: doc.content.substring(0, 200) + "...",
      })),
    });
  } catch (error) {
    res.status(500).json({ error: "Search failed", details: String(error) });
  }
});

/**
 * GET /admin/scout-knowledge/category/:category
 * Get all documents in a category
 */
router.get("/category/:category", requireAdmin, (req: Request, res: Response) => {
  try {
    const { category } = req.params;
    const { limit = 10 } = req.query;

    const results = searchByCategory(category as any, parseInt(String(limit), 10));

    res.json({
      success: true,
      category,
      results: results.map((doc) => ({
        id: doc.id,
        title: doc.title,
        wordCount: doc.wordCount,
        tags: doc.tags,
        preview: doc.content.substring(0, 200) + "...",
      })),
    });
  } catch (error) {
    res.status(500).json({ error: "Failed to get category", details: String(error) });
  }
});

/**
 * GET /admin/scout-knowledge/tag/:tag
 * Get all documents with a specific tag
 */
router.get("/tag/:tag", requireAdmin, (req: Request, res: Response) => {
  try {
    const { tag } = req.params;
    const { limit = 10 } = req.query;

    const results = searchByTag(tag, parseInt(String(limit), 10));

    res.json({
      success: true,
      tag,
      results: results.map((doc) => ({
        id: doc.id,
        title: doc.title,
        category: doc.category,
        wordCount: doc.wordCount,
        preview: doc.content.substring(0, 200) + "...",
      })),
    });
  } catch (error) {
    res.status(500).json({ error: "Failed to get tag", details: String(error) });
  }
});

/**
 * GET /admin/scout-knowledge/document/:id
 * Get a full document by ID
 */
router.get("/document/:id", requireAdmin, (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const doc = getDocument(id);

    if (!doc) {
      return res.status(404).json({ error: "Document not found" });
    }

    res.json({
      success: true,
      document: {
        id: doc.id,
        title: doc.title,
        content: doc.content,
        category: doc.category,
        tags: doc.tags,
        wordCount: doc.wordCount,
        sourceFile: doc.sourceFile,
        extractedAt: new Date(doc.extractedAt).toISOString(),
      },
    });
  } catch (error) {
    res.status(500).json({ error: "Failed to get document", details: String(error) });
  }
});

/**
 * GET /admin/scout-knowledge/all
 * Get all indexed documents (with preview)
 */
router.get("/all", requireAdmin, (req: Request, res: Response) => {
  try {
    const docs = getAllDocuments();

    res.json({
      success: true,
      total: docs.length,
      documents: docs.map((doc) => ({
        id: doc.id,
        title: doc.title,
        category: doc.category,
        tags: doc.tags,
        wordCount: doc.wordCount,
        preview: doc.content.substring(0, 150) + "...",
      })),
    });
  } catch (error) {
    res.status(500).json({ error: "Failed to get documents", details: String(error) });
  }
});

/**
 * POST /admin/scout-knowledge/clear
 * Clear the entire index (requires confirmation)
 */
router.post("/clear", requireAdmin, (req: Request, res: Response) => {
  try {
    const { confirm } = req.body;

    if (confirm !== true) {
      return res.status(400).json({ error: "Confirmation required to clear index" });
    }

    clearIndex();

    res.json({
      success: true,
      message: "Knowledge index cleared",
    });
  } catch (error) {
    res.status(500).json({ error: "Failed to clear index", details: String(error) });
  }
});

/**
 * GET /admin/scout-knowledge/export
 * Export the entire index as JSON
 */
router.get("/export", requireAdmin, (req: Request, res: Response) => {
  try {
    const json = exportIndexAsJson();

    res.setHeader("Content-Type", "application/json");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="scout-knowledge-${Date.now()}.json"`
    );
    res.send(json);
  } catch (error) {
    res.status(500).json({ error: "Failed to export index", details: String(error) });
  }
});

/**
 * POST /admin/scout-knowledge/import
 * Import index from JSON
 */
router.post("/import", requireAdmin, upload.single("file"), async (req: Request, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No file uploaded" });
    }

    const jsonData = readFileSync(req.file.path, "utf-8");
    importIndexFromJson(jsonData);

    res.json({
      success: true,
      message: "Knowledge index imported",
    });
  } catch (error) {
    res.status(500).json({ error: "Failed to import index", details: String(error) });
  }
});

export default router;
