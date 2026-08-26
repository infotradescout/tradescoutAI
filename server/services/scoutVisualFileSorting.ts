/**
 * Scout Visual File Sorting
 *
 * Handles visual file assignment and organization by county.
 * Manages the drag-and-drop file assignment workflow.
 *
 * Features:
 * - Assign files to counties
 * - Batch file operations
 * - File organization by region
 * - Unassigned file tracking
 * - Assignment history
 */

import { unavailableRuntimeCapability } from "./runtimeCapability";

export interface FileAssignment {
  id: string;
  fileId: string;
  countyFips: string;
  assignedAt: Date;
  assignedBy: string;
  notes?: string;
}

export interface UnassignedFile {
  id: string;
  name: string;
  type: string;
  size: number;
  uploadedAt: Date;
  uploadedBy: string;
  relevanceScore?: number;
  suggestedCounties?: {
    fips: string;
    county: string;
    confidence: number;
  }[];
}

export interface CountyFileOrganization {
  countyFips: string;
  county: string;
  state: string;
  files: {
    id: string;
    name: string;
    type: string;
    size: number;
    assignedAt: Date;
  }[];
  filesByType: Record<string, number>;
  totalSize: number;
  lastModified: Date;
}

export interface FileAssignmentBatch {
  id: string;
  fileIds: string[];
  countyFips: string;
  status: "pending" | "processing" | "completed" | "failed";
  createdAt: Date;
  completedAt?: Date;
  results?: {
    successful: number;
    failed: number;
    errors?: string[];
  };
}

class ScoutVisualFileSorting {
  async assignFileToCounty(
    _fileId: string,
    _countyFips: string,
    _assignedBy: string,
    _notes?: string
  ): Promise<FileAssignment> {
    return unavailableRuntimeCapability(
      "visual file assignment",
      "a durable file assignment repository is not configured"
    );
  }

  async batchAssignFiles(
    _fileIds: string[],
    _countyFips: string,
    _assignedBy: string
  ): Promise<FileAssignmentBatch> {
    return unavailableRuntimeCapability(
      "visual file batch assignment",
      "a durable file assignment repository is not configured"
    );
  }

  async unassignFile(_assignmentId: string): Promise<boolean> {
    return unavailableRuntimeCapability(
      "visual file unassignment",
      "a durable file assignment repository is not configured"
    );
  }

  getUnassignedFiles(): UnassignedFile[] {
    return unavailableRuntimeCapability(
      "unassigned file listing",
      "a durable file assignment repository is not configured"
    );
  }

  getCountyFiles(_countyFips: string): CountyFileOrganization | null {
    return unavailableRuntimeCapability(
      "county file listing",
      "a durable file assignment repository is not configured"
    );
  }

  getAllCountyOrganizations(): CountyFileOrganization[] {
    return unavailableRuntimeCapability(
      "county file organization",
      "a durable file assignment repository is not configured"
    );
  }

  async moveFileBetweenCounties(
    _fileId: string,
    _fromCountyFips: string,
    _toCountyFips: string,
    _movedBy: string
  ): Promise<FileAssignment> {
    return unavailableRuntimeCapability(
      "visual file move",
      "a durable file assignment repository is not configured"
    );
  }

  getSuggestedCounties(
    _fileId: string,
    _limit: number = 3
  ): { fips: string; county: string; confidence: number }[] {
    return unavailableRuntimeCapability(
      "file county suggestions",
      "a source-backed file classifier is not configured"
    );
  }

  getAssignmentHistory(
    _limit: number = 100,
    _countyFips?: string
  ): FileAssignment[] {
    return unavailableRuntimeCapability(
      "file assignment history",
      "a durable file assignment repository is not configured"
    );
  }

  getBatchStatus(_batchId: string): FileAssignmentBatch | null {
    return unavailableRuntimeCapability(
      "file assignment batch status",
      "a durable file assignment repository is not configured"
    );
  }

  getStatistics() {
    return {
      available: false as const,
      durable: false as const,
      reason: "durable file assignment repository is not configured",
      totalAssignments: 0,
      totalUnassigned: 0,
      totalCounties: 0,
      assignmentsByType: {} as Record<string, number>,
      assignmentsByCounty: {} as Record<string, number>,
      totalSize: 0,
    };
  }
}

// Singleton instance
export const scoutVisualFileSorting = new ScoutVisualFileSorting();
