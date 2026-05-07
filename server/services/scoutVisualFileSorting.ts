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
  private assignments: Map<string, FileAssignment> = new Map();
  private unassignedFiles: Map<string, UnassignedFile> = new Map();
  private countyOrganization: Map<string, CountyFileOrganization> = new Map();
  private assignmentHistory: FileAssignment[] = [];
  private batches: Map<string, FileAssignmentBatch> = new Map();

  /**
   * Assign a file to a county
   */
  async assignFileToCounty(
    fileId: string,
    countyFips: string,
    assignedBy: string,
    notes?: string
  ): Promise<FileAssignment> {
    const assignment: FileAssignment = {
      id: `assign-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      fileId,
      countyFips,
      assignedAt: new Date(),
      assignedBy,
      notes,
    };

    this.assignments.set(assignment.id, assignment);
    this.assignmentHistory.push(assignment);

    // Remove from unassigned
    this.unassignedFiles.delete(fileId);

    // Update county organization
    this.updateCountyOrganization(countyFips, fileId);

    console.log(`[Visual Sorting] Assigned file ${fileId} to county ${countyFips}`);

    return assignment;
  }

  /**
   * Batch assign multiple files to a county
   */
  async batchAssignFiles(
    fileIds: string[],
    countyFips: string,
    assignedBy: string
  ): Promise<FileAssignmentBatch> {
    const batchId = `batch-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const batch: FileAssignmentBatch = {
      id: batchId,
      fileIds,
      countyFips,
      status: "processing",
      createdAt: new Date(),
    };

    this.batches.set(batchId, batch);

    let successful = 0;
    let failed = 0;
    const errors: string[] = [];

    for (const fileId of fileIds) {
      try {
        await this.assignFileToCounty(fileId, countyFips, assignedBy);
        successful++;
      } catch (error) {
        failed++;
        errors.push(`Failed to assign ${fileId}: ${String(error)}`);
      }
    }

    batch.status = "completed";
    batch.completedAt = new Date();
    batch.results = { successful, failed, errors: errors.length > 0 ? errors : undefined };

    console.log(
      `[Visual Sorting] Batch assignment completed: ${successful}/${fileIds.length} successful`
    );

    return batch;
  }

  /**
   * Unassign a file from a county
   */
  async unassignFile(assignmentId: string): Promise<boolean> {
    const assignment = this.assignments.get(assignmentId);
    if (!assignment) return false;

    this.assignments.delete(assignmentId);
    this.unassignedFiles.set(assignment.fileId, {
      id: assignment.fileId,
      name: `file-${assignment.fileId}`,
      type: "unknown",
      size: 0,
      uploadedAt: new Date(),
      uploadedBy: assignment.assignedBy,
    });

    console.log(`[Visual Sorting] Unassigned file ${assignment.fileId}`);

    return true;
  }

  /**
   * Get unassigned files
   */
  getUnassignedFiles(): UnassignedFile[] {
    return Array.from(this.unassignedFiles.values()).sort(
      (a, b) => b.uploadedAt.getTime() - a.uploadedAt.getTime()
    );
  }

  /**
   * Get files for a county
   */
  getCountyFiles(countyFips: string): CountyFileOrganization | null {
    return this.countyOrganization.get(countyFips) || null;
  }

  /**
   * Get all county organizations
   */
  getAllCountyOrganizations(): CountyFileOrganization[] {
    return Array.from(this.countyOrganization.values());
  }

  /**
   * Move file between counties
   */
  async moveFileBetweenCounties(
    fileId: string,
    fromCountyFips: string,
    toCountyFips: string,
    movedBy: string
  ): Promise<FileAssignment> {
    // Find existing assignment
    let assignment: FileAssignment | null = null;
    for (const [, assign] of this.assignments) {
      if (assign.fileId === fileId && assign.countyFips === fromCountyFips) {
        assignment = assign;
        break;
      }
    }

    if (!assignment) {
      throw new Error(`File ${fileId} not found in county ${fromCountyFips}`);
    }

    // Unassign from old county
    await this.unassignFile(assignment.id);

    // Assign to new county
    return this.assignFileToCounty(fileId, toCountyFips, movedBy);
  }

  /**
   * Get suggested counties for a file based on content
   */
  getSuggestedCounties(
    fileId: string,
    limit: number = 3
  ): { fips: string; county: string; confidence: number }[] {
    // In production, this would use ML to analyze file content
    // For now, return empty
    return [];
  }

  /**
   * Get assignment history
   */
  getAssignmentHistory(limit: number = 100, countyFips?: string): FileAssignment[] {
    let history = this.assignmentHistory;

    if (countyFips) {
      history = history.filter((a) => a.countyFips === countyFips);
    }

    return history.slice(-limit);
  }

  /**
   * Get batch status
   */
  getBatchStatus(batchId: string): FileAssignmentBatch | null {
    return this.batches.get(batchId) || null;
  }

  /**
   * Get statistics
   */
  getStatistics() {
    const totalAssignments = this.assignments.size;
    const totalUnassigned = this.unassignedFiles.size;
    const totalCounties = this.countyOrganization.size;

    const assignmentsByType: Record<string, number> = {};
    const assignmentsByCounty: Record<string, number> = {};

    for (const [, org] of this.countyOrganization) {
      assignmentsByCounty[org.county] = org.files.length;
      Object.entries(org.filesByType).forEach(([type, count]) => {
        assignmentsByType[type] = (assignmentsByType[type] || 0) + count;
      });
    }

    return {
      totalAssignments,
      totalUnassigned,
      totalCounties,
      assignmentsByType,
      assignmentsByCounty,
      totalSize: Array.from(this.countyOrganization.values()).reduce(
        (sum, org) => sum + org.totalSize,
        0
      ),
    };
  }

  /**
   * Update county organization
   */
  private updateCountyOrganization(countyFips: string, fileId: string): void {
    let org = this.countyOrganization.get(countyFips);

    if (!org) {
      org = {
        countyFips,
        county: this.getCountyName(countyFips),
        state: this.getStateName(countyFips),
        files: [],
        filesByType: {},
        totalSize: 0,
        lastModified: new Date(),
      };
      this.countyOrganization.set(countyFips, org);
    }

    // Add file (in production, fetch real file data)
    const file = {
      id: fileId,
      name: `file-${fileId}`,
      type: "unknown",
      size: 0,
      assignedAt: new Date(),
    };

    org.files.push(file);
    org.filesByType[file.type] = (org.filesByType[file.type] || 0) + 1;
    org.totalSize += file.size;
    org.lastModified = new Date();
  }

  /**
   * Helper: Get county name from FIPS
   */
  private getCountyName(fips: string): string {
    const fipsMap: Record<string, string> = {
      "48453": "Travis",
      "48201": "Harris",
      "48439": "Tarrant",
      "48113": "Dallas",
    };
    return fipsMap[fips] || "Unknown";
  }

  /**
   * Helper: Get state name from FIPS
   */
  private getStateName(fips: string): string {
    const stateCode = fips.substring(0, 2);
    const stateMap: Record<string, string> = {
      "48": "TX",
      "06": "CA",
      "36": "NY",
    };
    return stateMap[stateCode] || "US";
  }
}

// Singleton instance
export const scoutVisualFileSorting = new ScoutVisualFileSorting();
