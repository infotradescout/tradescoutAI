/**
 * Scout Intelligence Export/Import
 *
 * Tools for bulk exporting and importing Scout intelligence.
 *
 * Features:
 * - Export to JSON, CSV, Excel
 * - Import from external sources
 * - Batch operations
 * - Data validation
 * - Backup and restore
 */

import { EventEmitter } from "events";

export type ExportFormat = "json" | "csv" | "excel" | "markdown";

export interface ExportOptions {
  format: ExportFormat;
  includeMetadata: boolean;
  includeHistory: boolean;
  dateRange?: {
    start: Date;
    end: Date;
  };
  filters?: {
    brand?: string;
    jurisdiction?: string;
    type?: string;
    confidence?: "high" | "medium" | "low";
  };
}

export interface ImportOptions {
  format: ExportFormat;
  validateBeforeImport: boolean;
  overwriteExisting: boolean;
  skipErrors: boolean;
  brand?: string;
}

export interface ExportResult {
  id: string;
  format: ExportFormat;
  filename: string;
  recordCount: number;
  fileSize: number;
  createdAt: Date;
  expiresAt: Date;
  url?: string;
}

export interface ImportResult {
  id: string;
  filename: string;
  recordsProcessed: number;
  recordsSuccessful: number;
  recordsFailed: number;
  errors: ImportError[];
  warnings: string[];
  createdAt: Date;
}

export interface ImportError {
  recordIndex: number;
  field?: string;
  error: string;
  value?: any;
}

class ScoutIntelligenceExportImport extends EventEmitter {
  private exports: Map<string, ExportResult> = new Map();
  private imports: Map<string, ImportResult> = new Map();
  private exportHistory: ExportResult[] = [];
  private importHistory: ImportResult[] = [];

  /**
   * Export intelligence
   */
  async exportIntelligence(intelligence: any[], options: ExportOptions): Promise<ExportResult> {
    const exportId = `export-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const filename = `scout-intelligence-${new Date().toISOString().split("T")[0]}.${options.format}`;

    let content = "";
    let fileSize = 0;

    switch (options.format) {
      case "json":
        content = this.exportAsJSON(intelligence, options);
        break;
      case "csv":
        content = this.exportAsCSV(intelligence, options);
        break;
      case "excel":
        content = this.exportAsExcel(intelligence, options);
        break;
      case "markdown":
        content = this.exportAsMarkdown(intelligence, options);
        break;
    }

    fileSize = Buffer.byteLength(content, "utf8");

    const result: ExportResult = {
      id: exportId,
      format: options.format,
      filename,
      recordCount: intelligence.length,
      fileSize,
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
    };

    this.exports.set(exportId, result);
    this.exportHistory.push(result);

    console.log(`[Export/Import] Exported ${intelligence.length} records as ${options.format}`);
    this.emit("export-complete", result);

    return result;
  }

  /**
   * Export as JSON
   */
  private exportAsJSON(intelligence: any[], options: ExportOptions): string {
    const data: any = {
      exportDate: new Date().toISOString(),
      recordCount: intelligence.length,
      format: "json",
      records: intelligence,
    };

    if (options.includeMetadata) {
      data.metadata = {
        filters: options.filters,
        dateRange: options.dateRange,
      };
    }

    return JSON.stringify(data, null, 2);
  }

  /**
   * Export as CSV
   */
  private exportAsCSV(intelligence: any[], options: ExportOptions): string {
    if (intelligence.length === 0) return "";

    // Get all unique keys
    const keys = new Set<string>();
    intelligence.forEach((record) => {
      Object.keys(record).forEach((key) => keys.add(key));
    });

    const headers = Array.from(keys);
    const rows: string[] = [];

    // Add header row
    rows.push(headers.map((h) => `"${h}"`).join(","));

    // Add data rows
    intelligence.forEach((record) => {
      const values = headers.map((header) => {
        const value = record[header];
        if (value === null || value === undefined) return "";
        if (typeof value === "string" && value.includes(",")) {
          return `"${value.replace(/"/g, '""')}"`;
        }
        return String(value);
      });
      rows.push(values.join(","));
    });

    return rows.join(
      "\
"
    );
  }

  /**
   * Export as Excel (placeholder - would use xlsx library)
   */
  private exportAsExcel(intelligence: any[], options: ExportOptions): string {
    // In production, use xlsx library
    return this.exportAsCSV(intelligence, options);
  }

  /**
   * Export as Markdown
   */
  private exportAsMarkdown(intelligence: any[], options: ExportOptions): string {
    const lines: string[] = [];

    lines.push("# Scout Intelligence Export");
    lines.push(`Generated: ${new Date().toISOString()}`);
    lines.push(`Records: ${intelligence.length}`);
    lines.push("");

    if (options.includeMetadata && options.filters) {
      lines.push("## Filters Applied");
      Object.entries(options.filters).forEach(([key, value]) => {
        if (value) lines.push(`- ${key}: ${value}`);
      });
      lines.push("");
    }

    lines.push("## Records");
    lines.push("");

    intelligence.forEach((record, index) => {
      lines.push(`### Record ${index + 1}`);
      Object.entries(record).forEach(([key, value]) => {
        lines.push(`- **${key}**: ${value}`);
      });
      lines.push("");
    });

    return lines.join(
      "\
"
    );
  }

  /**
   * Import intelligence
   */
  async importIntelligence(fileContent: string, options: ImportOptions): Promise<ImportResult> {
    const importId = `import-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const errors: ImportError[] = [];
    const warnings: string[] = [];
    let records: any[] = [];

    try {
      // Parse based on format
      switch (options.format) {
        case "json":
          const jsonData = JSON.parse(fileContent);
          records = jsonData.records || jsonData;
          break;
        case "csv":
          records = this.parseCSV(fileContent);
          break;
        case "markdown":
          records = this.parseMarkdown(fileContent);
          break;
      }
    } catch (error) {
      errors.push({
        recordIndex: 0,
        error: `Failed to parse ${options.format}: ${String(error)}`,
      });
    }

    // Validate records
    let successCount = 0;
    records.forEach((record, index) => {
      const validation = this.validateRecord(record);
      if (!validation.valid) {
        if (!options.skipErrors) {
          errors.push({
            recordIndex: index,
            error: validation.errors.join("; "),
          });
        } else {
          warnings.push(`Record ${index}: ${validation.errors.join("; ")}`);
        }
      } else {
        successCount++;
      }
    });

    const result: ImportResult = {
      id: importId,
      filename: "imported-intelligence",
      recordsProcessed: records.length,
      recordsSuccessful: successCount,
      recordsFailed: records.length - successCount,
      errors,
      warnings,
      createdAt: new Date(),
    };

    this.imports.set(importId, result);
    this.importHistory.push(result);

    console.log(
      `[Export/Import] Imported ${successCount}/${records.length} records from ${options.format}`
    );
    this.emit("import-complete", result);

    return result;
  }

  /**
   * Parse CSV content
   */
  private parseCSV(content: string): any[] {
    const lines = content
      .split(
        "\
"
      )
      .filter((line) => line.trim());
    if (lines.length < 2) return [];

    const headers = lines[0].split(",").map((h) => h.trim().replace(/^"|"$/g, ""));
    const records: any[] = [];

    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(",").map((v) => v.trim().replace(/^"|"$/g, ""));
      const record: any = {};
      headers.forEach((header, index) => {
        record[header] = values[index] || "";
      });
      records.push(record);
    }

    return records;
  }

  /**
   * Parse Markdown content
   */
  private parseMarkdown(content: string): any[] {
    // Simple markdown parser for records
    const records: any[] = [];
    const lines =
      content.split(
        "\
"
      );
    let currentRecord: any = {};

    lines.forEach((line) => {
      if (line.startsWith("### Record")) {
        if (Object.keys(currentRecord).length > 0) {
          records.push(currentRecord);
        }
        currentRecord = {};
      } else if (line.startsWith("- **")) {
        const match = line.match(/- \\*\\*(.+?)\\*\\*: (.+)/);
        if (match) {
          currentRecord[match[1]] = match[2];
        }
      }
    });

    if (Object.keys(currentRecord).length > 0) {
      records.push(currentRecord);
    }

    return records;
  }

  /**
   * Validate a record
   */
  private validateRecord(record: any): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Check required fields
    if (!record.id) errors.push("Missing required field: id");
    if (!record.content) errors.push("Missing required field: content");
    if (!record.type) errors.push("Missing required field: type");

    // Check data types
    if (record.timestamp && isNaN(new Date(record.timestamp).getTime())) {
      errors.push("Invalid timestamp format");
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * Get export history
   */
  getExportHistory(limit: number = 50): ExportResult[] {
    return this.exportHistory.slice(-limit);
  }

  /**
   * Get import history
   */
  getImportHistory(limit: number = 50): ImportResult[] {
    return this.importHistory.slice(-limit);
  }

  /**
   * Get export statistics
   */
  getExportStats() {
    return {
      totalExports: this.exportHistory.length,
      exportsByFormat: this.groupBy(this.exportHistory, (e) => e.format),
      totalRecordsExported: this.exportHistory.reduce((sum, e) => sum + e.recordCount, 0),
      totalDataExported: this.exportHistory.reduce((sum, e) => sum + e.fileSize, 0),
    };
  }

  /**
   * Get import statistics
   */
  getImportStats() {
    return {
      totalImports: this.importHistory.length,
      totalRecordsImported: this.importHistory.reduce((sum, i) => sum + i.recordsSuccessful, 0),
      totalRecordsFailed: this.importHistory.reduce((sum, i) => sum + i.recordsFailed, 0),
      successRate:
        this.importHistory.length > 0
          ? (
              (this.importHistory.reduce((sum, i) => sum + i.recordsSuccessful, 0) /
                this.importHistory.reduce((sum, i) => sum + i.recordsProcessed, 0)) *
              100
            ).toFixed(2) + "%"
          : "N/A",
    };
  }

  /**
   * Helper: group array by key
   */
  private groupBy<T>(arr: T[], keyFn: (item: T) => string): Record<string, number> {
    return arr.reduce(
      (acc, item) => {
        const key = keyFn(item);
        acc[key] = (acc[key] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>
    );
  }
}

// Singleton instance
export const scoutIntelligenceExportImport = new ScoutIntelligenceExportImport();
