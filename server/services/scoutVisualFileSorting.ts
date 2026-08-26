/**
 * Durable Scout verification-document assignment.
 *
 * Assignments are private admin metadata. The service never returns file_url.
 * All writes are serialized per document and protected by a database unique index.
 */
import { pool } from "../db";

export const MAX_SCOUT_BATCH_SIZE = 100;
export const MAX_SCOUT_PAGE_SIZE = 200;
export const MAX_SCOUT_COUNTIES = 25;

type QueryResult = { rows: any[]; rowCount?: number | null };
type SqlClient = {
  query(text: string, params?: unknown[]): Promise<QueryResult>;
  release?: () => void;
};
type SqlPool = SqlClient & { connect(): Promise<SqlClient> };

export type AssignmentEventType = "assigned" | "moved" | "unassigned";

export interface FileAssignment {
  id: string;
  fileId: string;
  countyFips: string;
  assignedAt: Date;
  updatedAt: Date;
  assignedBy: string;
  notes?: string;
  active: boolean;
  version: number;
}

export interface UnassignedFile {
  id: string;
  name: string;
  type: string;
  status: string | null;
  uploadedAt: Date | null;
}

export interface CountyFile {
  id: string;
  name: string;
  type: string;
  status: string | null;
  assignedAt: Date;
  updatedAt: Date;
}

export interface CountyFileOrganization {
  countyFips: string;
  county: string;
  state: string;
  files: CountyFile[];
  filesByType: Record<string, number>;
  totalFiles: number;
  lastModified: Date | null;
}

export interface Paginated<T> {
  items: T[];
  total: number;
  limit: number;
  offset: number;
}

export interface FileAssignmentBatch {
  id: string;
  fileIds: string[];
  countyFips: string;
  status: "completed";
  createdAt: Date;
  completedAt: Date;
  results: { successful: number; failed: 0 };
}

export class ScoutFileAssignmentError extends Error {
  constructor(
    message: string,
    readonly statusCode: number,
    readonly code: string
  ) {
    super(message);
    this.name = new.target.name;
  }
}
export class ScoutFileAssignmentInputError extends ScoutFileAssignmentError {
  constructor(message: string) {
    super(message, 400, "SCOUT_FILE_ASSIGNMENT_INVALID_INPUT");
  }
}
export class ScoutFileBatchTooLargeError extends ScoutFileAssignmentError {
  constructor(max = MAX_SCOUT_BATCH_SIZE) {
    super(
      `A maximum of ${max} files can be assigned in one batch`,
      413,
      "SCOUT_FILE_ASSIGNMENT_BATCH_TOO_LARGE"
    );
  }
}
export class ScoutFileAssignmentNotFoundError extends ScoutFileAssignmentError {
  constructor(message: string) {
    super(message, 404, "SCOUT_FILE_ASSIGNMENT_NOT_FOUND");
  }
}
export class ScoutFileAssignmentConflictError extends ScoutFileAssignmentError {
  constructor(message: string) {
    super(message, 409, "SCOUT_FILE_ASSIGNMENT_CONFLICT");
  }
}
export class ScoutFileStorageUnavailableError extends ScoutFileAssignmentError {
  constructor() {
    super(
      "Scout file assignment storage is unavailable",
      503,
      "SCOUT_FILE_ASSIGNMENT_STORAGE_UNAVAILABLE"
    );
  }
}

function dbCode(error: unknown): string {
  return String((error as any)?.code || "");
}

export function isScoutFileStorageUnavailable(error: unknown): boolean {
  return (
    error instanceof ScoutFileStorageUnavailableError ||
    ["42P01", "42703", "57P01", "08000", "08003", "08006"].includes(dbCode(error)) ||
    /missing (test_)?database_url/i.test(String((error as any)?.message || ""))
  );
}

function normalizeFips(value: unknown): string {
  const fips = String(value || "").trim();
  if (!/^\d{5}$/.test(fips)) {
    throw new ScoutFileAssignmentInputError("A valid five-digit county FIPS is required");
  }
  return fips;
}

function normalizeId(value: unknown, label: string): string {
  const id = String(value || "").trim();
  if (!id || id.length > 255) {
    throw new ScoutFileAssignmentInputError(`${label} is required`);
  }
  return id;
}

function normalizePage(limit?: number, offset?: number): { limit: number; offset: number } {
  const safeLimit = Math.min(
    MAX_SCOUT_PAGE_SIZE,
    Math.max(1, Number.isFinite(limit) ? Math.trunc(limit as number) : 50)
  );
  const safeOffset = Math.max(0, Number.isFinite(offset) ? Math.trunc(offset as number) : 0);
  return { limit: safeLimit, offset: safeOffset };
}

function mapAssignment(row: any): FileAssignment {
  return {
    id: String(row.id),
    fileId: String(row.verification_document_id),
    countyFips: String(row.county_fips),
    assignedAt: new Date(row.assigned_at),
    updatedAt: new Date(row.updated_at),
    assignedBy: String(row.assigned_by),
    notes: row.notes == null ? undefined : String(row.notes),
    active: Boolean(row.active),
    version: Number(row.version),
  };
}

function mapWriteError(error: unknown): never {
  if (error instanceof ScoutFileAssignmentError) throw error;
  if (dbCode(error) === "23505") {
    throw new ScoutFileAssignmentConflictError(
      "This verification document already has an active county assignment"
    );
  }
  if (dbCode(error) === "23503") {
    throw new ScoutFileAssignmentNotFoundError("County, document, or actor was not found");
  }
  if (isScoutFileStorageUnavailable(error)) {
    throw new ScoutFileStorageUnavailableError();
  }
  throw error;
}

export class ScoutVisualFileSorting {
  constructor(private readonly database: SqlPool = pool as unknown as SqlPool) {}

  private async withTransaction<T>(run: (client: SqlClient) => Promise<T>): Promise<T> {
    const client = await this.database.connect();
    try {
      await client.query("BEGIN");
      const value = await run(client);
      await client.query("COMMIT");
      return value;
    } catch (error) {
      try {
        await client.query("ROLLBACK");
      } catch {
        // Preserve the original error.
      }
      return mapWriteError(error);
    } finally {
      client.release?.();
    }
  }

  private async lockDocument(client: SqlClient, fileId: string): Promise<void> {
    await client.query(
      "SELECT pg_advisory_xact_lock(hashtextextended($1::text, 0))",
      [`scout-file-assignment:${fileId}`]
    );
  }

  private async requireCounty(client: SqlClient, countyFips: string): Promise<void> {
    const result = await client.query("SELECT fips FROM counties WHERE fips = $1 LIMIT 1", [
      countyFips,
    ]);
    if (!result.rows[0]) {
      throw new ScoutFileAssignmentNotFoundError(`County ${countyFips} was not found`);
    }
  }

  private async requireDocument(client: SqlClient, fileId: string): Promise<void> {
    const result = await client.query(
      "SELECT id FROM verification_documents WHERE id = $1 LIMIT 1",
      [fileId]
    );
    if (!result.rows[0]) {
      throw new ScoutFileAssignmentNotFoundError(
        `Verification document ${fileId} was not found`
      );
    }
  }

  async assignFileToCounty(
    rawFileId: string,
    rawCountyFips: string,
    rawAssignedBy: string,
    notes?: string
  ): Promise<FileAssignment> {
    const fileId = normalizeId(rawFileId, "fileId");
    const countyFips = normalizeFips(rawCountyFips);
    const assignedBy = normalizeId(rawAssignedBy, "assignedBy");
    const safeNotes = typeof notes === "string" && notes.trim() ? notes.trim().slice(0, 4000) : null;

    return this.withTransaction(async (client) => {
      await this.lockDocument(client, fileId);
      await this.requireCounty(client, countyFips);
      await this.requireDocument(client, fileId);

      const existing = await client.query(
        `SELECT id
           FROM scout_file_assignments
          WHERE verification_document_id = $1 AND active = true
          FOR UPDATE`,
        [fileId]
      );
      if (existing.rows[0]) {
        throw new ScoutFileAssignmentConflictError(
          "This verification document already has an active county assignment"
        );
      }

      const inserted = await client.query(
        `INSERT INTO scout_file_assignments
           (verification_document_id, county_fips, assigned_by, notes, active)
         VALUES ($1, $2, $3, $4, true)
         RETURNING *`,
        [fileId, countyFips, assignedBy, safeNotes]
      );
      const row = inserted.rows[0];

      await client.query(
        `INSERT INTO scout_file_assignment_events
           (assignment_id, verification_document_id, event_type,
            from_county_fips, to_county_fips, actor_user_id, notes)
         VALUES ($1, $2, 'assigned', NULL, $3, $4, $5)`,
        [row.id, fileId, countyFips, assignedBy, safeNotes]
      );
      return mapAssignment(row);
    });
  }

  async batchAssignFiles(
    rawFileIds: string[],
    rawCountyFips: string,
    rawAssignedBy: string
  ): Promise<FileAssignmentBatch> {
    if (!Array.isArray(rawFileIds) || rawFileIds.length === 0) {
      throw new ScoutFileAssignmentInputError("fileIds must be a non-empty array");
    }
    if (rawFileIds.length > MAX_SCOUT_BATCH_SIZE) {
      throw new ScoutFileBatchTooLargeError();
    }

    const fileIds = Array.from(
      new Set(rawFileIds.map((id) => normalizeId(id, "fileId")))
    );
    const countyFips = normalizeFips(rawCountyFips);
    const assignedBy = normalizeId(rawAssignedBy, "assignedBy");

    return this.withTransaction(async (client) => {
      for (const fileId of [...fileIds].sort()) {
        await this.lockDocument(client, fileId);
      }
      await this.requireCounty(client, countyFips);

      const documents = await client.query(
        `SELECT id
           FROM verification_documents
          WHERE id = ANY($1::varchar[])`,
        [fileIds]
      );
      const found = new Set(documents.rows.map((row) => String(row.id)));
      const missing = fileIds.filter((id) => !found.has(id));
      if (missing.length > 0) {
        throw new ScoutFileAssignmentNotFoundError(
          `Verification document not found: ${missing[0]}`
        );
      }

      const conflicts = await client.query(
        `SELECT verification_document_id
           FROM scout_file_assignments
          WHERE active = true
            AND verification_document_id = ANY($1::varchar[])
          FOR UPDATE`,
        [fileIds]
      );
      if (conflicts.rows[0]) {
        throw new ScoutFileAssignmentConflictError(
          `Verification document ${conflicts.rows[0].verification_document_id} is already assigned`
        );
      }

      const inserted = await client.query(
        `INSERT INTO scout_file_assignments
           (verification_document_id, county_fips, assigned_by, active)
         SELECT file_id, $2, $3, true
           FROM unnest($1::varchar[]) AS file_id
         RETURNING id, verification_document_id`,
        [fileIds, countyFips, assignedBy]
      );

      await client.query(
        `INSERT INTO scout_file_assignment_events
           (assignment_id, verification_document_id, event_type,
            from_county_fips, to_county_fips, actor_user_id)
         SELECT assignment_id, document_id, 'assigned', NULL, $3, $4
           FROM unnest($1::varchar[], $2::varchar[])
                AS inserted_rows(assignment_id, document_id)`,
        [
          inserted.rows.map((row) => String(row.id)),
          inserted.rows.map((row) => String(row.verification_document_id)),
          countyFips,
          assignedBy,
        ]
      );

      const batchResult = await client.query(
        `INSERT INTO scout_file_assignment_batches
           (county_fips, assigned_by, file_ids, status, results, completed_at)
         VALUES ($1, $2, $3::jsonb, 'completed', $4::jsonb, now())
         RETURNING *`,
        [
          countyFips,
          assignedBy,
          JSON.stringify(fileIds),
          JSON.stringify({ successful: fileIds.length, failed: 0 }),
        ]
      );
      const row = batchResult.rows[0];
      return {
        id: String(row.id),
        fileIds,
        countyFips,
        status: "completed",
        createdAt: new Date(row.created_at),
        completedAt: new Date(row.completed_at),
        results: { successful: fileIds.length, failed: 0 },
      };
    });
  }

  async moveFileBetweenCounties(
    rawFileId: string,
    rawFromCountyFips: string,
    rawToCountyFips: string,
    rawMovedBy: string,
    expectedVersion?: number
  ): Promise<FileAssignment> {
    const fileId = normalizeId(rawFileId, "fileId");
    const fromCountyFips = normalizeFips(rawFromCountyFips);
    const toCountyFips = normalizeFips(rawToCountyFips);
    const movedBy = normalizeId(rawMovedBy, "movedBy");
    if (fromCountyFips === toCountyFips) {
      throw new ScoutFileAssignmentInputError("Source and target counties must differ");
    }

    return this.withTransaction(async (client) => {
      await this.lockDocument(client, fileId);
      await this.requireCounty(client, toCountyFips);

      const current = await client.query(
        `SELECT *
           FROM scout_file_assignments
          WHERE verification_document_id = $1
            AND county_fips = $2
            AND active = true
          FOR UPDATE`,
        [fileId, fromCountyFips]
      );
      const row = current.rows[0];
      if (!row) {
        const active = await client.query(
          `SELECT county_fips
             FROM scout_file_assignments
            WHERE verification_document_id = $1 AND active = true
            LIMIT 1`,
          [fileId]
        );
        if (active.rows[0]) {
          throw new ScoutFileAssignmentConflictError(
            `File ${fileId} is now assigned to county ${active.rows[0].county_fips}`
          );
        }
        throw new ScoutFileAssignmentNotFoundError(
          `File ${fileId} is not actively assigned to county ${fromCountyFips}`
        );
      }
      if (
        Number.isInteger(expectedVersion) &&
        Number(expectedVersion) !== Number(row.version)
      ) {
        throw new ScoutFileAssignmentConflictError(
          "The assignment changed before this move was applied"
        );
      }

      const updated = await client.query(
        `UPDATE scout_file_assignments
            SET county_fips = $1,
                assigned_by = $2,
                updated_at = now(),
                version = version + 1
          WHERE id = $3 AND version = $4
          RETURNING *`,
        [toCountyFips, movedBy, row.id, row.version]
      );
      if (!updated.rows[0]) {
        throw new ScoutFileAssignmentConflictError(
          "The assignment changed before this move was applied"
        );
      }

      await client.query(
        `INSERT INTO scout_file_assignment_events
           (assignment_id, verification_document_id, event_type,
            from_county_fips, to_county_fips, actor_user_id)
         VALUES ($1, $2, 'moved', $3, $4, $5)`,
        [row.id, fileId, fromCountyFips, toCountyFips, movedBy]
      );
      return mapAssignment(updated.rows[0]);
    });
  }

  async unassignFile(rawAssignmentId: string, rawActorUserId?: string): Promise<boolean> {
    const assignmentId = normalizeId(rawAssignmentId, "assignmentId");
    const actorUserId = rawActorUserId
      ? normalizeId(rawActorUserId, "actorUserId")
      : undefined;

    return this.withTransaction(async (client) => {
      const current = await client.query(
        `SELECT *
           FROM scout_file_assignments
          WHERE id = $1 AND active = true
          FOR UPDATE`,
        [assignmentId]
      );
      const row = current.rows[0];
      if (!row) return false;
      const actor = actorUserId || String(row.assigned_by);
      await this.lockDocument(client, String(row.verification_document_id));
      await client.query(
        `UPDATE scout_file_assignments
            SET active = false, assigned_by = $2, updated_at = now(), version = version + 1
          WHERE id = $1 AND active = true`,
        [assignmentId, actor]
      );
      await client.query(
        `INSERT INTO scout_file_assignment_events
           (assignment_id, verification_document_id, event_type,
            from_county_fips, to_county_fips, actor_user_id)
         VALUES ($1, $2, 'unassigned', $3, NULL, $4)`,
        [assignmentId, row.verification_document_id, row.county_fips, actor]
      );
      return true;
    });
  }

  async getUnassignedFiles(
    limit = 50,
    offset = 0
  ): Promise<Paginated<UnassignedFile>> {
    const page = normalizePage(limit, offset);
    try {
      const result = await this.database.query(
        `SELECT vd.id, vd.file_name, vd.type, vd.status, vd.created_at,
                count(*) OVER()::int AS total_count
           FROM verification_documents vd
          WHERE NOT EXISTS (
            SELECT 1
              FROM scout_file_assignments sfa
             WHERE sfa.verification_document_id = vd.id
               AND sfa.active = true
          )
          ORDER BY vd.created_at DESC NULLS LAST, vd.id
          LIMIT $1 OFFSET $2`,
        [page.limit, page.offset]
      );
      return {
        items: result.rows.map((row) => ({
          id: String(row.id),
          name: String(row.file_name),
          type: String(row.type),
          status: row.status == null ? null : String(row.status),
          uploadedAt: row.created_at ? new Date(row.created_at) : null,
        })),
        total: Number(result.rows[0]?.total_count || 0),
        ...page,
      };
    } catch (error) {
      if (isScoutFileStorageUnavailable(error)) throw new ScoutFileStorageUnavailableError();
      throw error;
    }
  }

  async getCountyFiles(
    rawCountyFips: string,
    options?: { type?: string; sortBy?: "recent" | "type"; limit?: number; offset?: number }
  ): Promise<CountyFileOrganization | null> {
    const countyFips = normalizeFips(rawCountyFips);
    const page = normalizePage(options?.limit, options?.offset);
    const [countyResult, fileResult, typeResult] = await Promise.all([
      this.database.query(
        "SELECT fips, name, state_code FROM counties WHERE fips = $1 LIMIT 1",
        [countyFips]
      ),
      this.database.query(
        `SELECT vd.id, vd.file_name, vd.type, vd.status,
                sfa.assigned_at, sfa.updated_at,
                count(*) OVER()::int AS total_count
           FROM scout_file_assignments sfa
           JOIN verification_documents vd ON vd.id = sfa.verification_document_id
          WHERE sfa.county_fips = $1
            AND sfa.active = true
            AND ($2::text IS NULL OR vd.type = $2)
          ORDER BY
            CASE WHEN $3 = 'type' THEN vd.type END ASC,
            sfa.updated_at DESC,
            vd.id
          LIMIT $4 OFFSET $5`,
        [countyFips, options?.type || null, options?.sortBy || "recent", page.limit, page.offset]
      ),
      this.database.query(
        `SELECT vd.type, count(*)::int AS count
           FROM scout_file_assignments sfa
           JOIN verification_documents vd ON vd.id = sfa.verification_document_id
          WHERE sfa.county_fips = $1 AND sfa.active = true
          GROUP BY vd.type`,
        [countyFips]
      ),
    ]);
    const county = countyResult.rows[0];
    if (!county) return null;
    const files = fileResult.rows.map((row) => ({
      id: String(row.id),
      name: String(row.file_name),
      type: String(row.type),
      status: row.status == null ? null : String(row.status),
      assignedAt: new Date(row.assigned_at),
      updatedAt: new Date(row.updated_at),
    }));
    return {
      countyFips,
      county: String(county.name),
      state: String(county.state_code),
      files,
      filesByType: Object.fromEntries(
        typeResult.rows.map((row) => [String(row.type), Number(row.count)])
      ),
      totalFiles: Number(fileResult.rows[0]?.total_count || 0),
      lastModified: files[0]?.updatedAt || null,
    };
  }

  async getCountyFilesBatch(
    rawCountyFips: string[],
    limitPerCounty = 10
  ): Promise<Map<string, CountyFileOrganization>> {
    const fips = Array.from(new Set(rawCountyFips.map(normalizeFips)));
    if (fips.length > MAX_SCOUT_COUNTIES) {
      throw new ScoutFileAssignmentInputError(
        `A maximum of ${MAX_SCOUT_COUNTIES} counties can be requested`
      );
    }
    if (fips.length === 0) return new Map();
    const limit = Math.min(20, Math.max(1, Math.trunc(limitPerCounty)));

    const [countyResult, fileResult, typeResult] = await Promise.all([
      this.database.query(
        "SELECT fips, name, state_code FROM counties WHERE fips = ANY($1::varchar[])",
        [fips]
      ),
      this.database.query(
        `WITH ranked AS (
           SELECT sfa.county_fips, vd.id, vd.file_name, vd.type, vd.status,
                  sfa.assigned_at, sfa.updated_at,
                  row_number() OVER (
                    PARTITION BY sfa.county_fips
                    ORDER BY sfa.updated_at DESC, vd.id
                  ) AS rn,
                  count(*) OVER (PARTITION BY sfa.county_fips)::int AS total_count
             FROM scout_file_assignments sfa
             JOIN verification_documents vd ON vd.id = sfa.verification_document_id
            WHERE sfa.active = true
              AND sfa.county_fips = ANY($1::varchar[])
         )
         SELECT * FROM ranked WHERE rn <= $2 ORDER BY county_fips, rn`,
        [fips, limit]
      ),
      this.database.query(
        `SELECT sfa.county_fips, vd.type, count(*)::int AS count
           FROM scout_file_assignments sfa
           JOIN verification_documents vd ON vd.id = sfa.verification_document_id
          WHERE sfa.active = true
            AND sfa.county_fips = ANY($1::varchar[])
          GROUP BY sfa.county_fips, vd.type`,
        [fips]
      ),
    ]);

    const rowsByCounty = new Map<string, any[]>();
    for (const row of fileResult.rows) {
      const key = String(row.county_fips);
      const rows = rowsByCounty.get(key) || [];
      rows.push(row);
      rowsByCounty.set(key, rows);
    }
    const typesByCounty = new Map<string, Record<string, number>>();
    for (const row of typeResult.rows) {
      const key = String(row.county_fips);
      const counts = typesByCounty.get(key) || {};
      counts[String(row.type)] = Number(row.count);
      typesByCounty.set(key, counts);
    }

    const result = new Map<string, CountyFileOrganization>();
    for (const county of countyResult.rows) {
      const key = String(county.fips);
      const rows = rowsByCounty.get(key) || [];
      const files = rows.map((row) => ({
        id: String(row.id),
        name: String(row.file_name),
        type: String(row.type),
        status: row.status == null ? null : String(row.status),
        assignedAt: new Date(row.assigned_at),
        updatedAt: new Date(row.updated_at),
      }));
      result.set(key, {
        countyFips: key,
        county: String(county.name),
        state: String(county.state_code),
        files,
        filesByType: typesByCounty.get(key) || {},
        totalFiles: Number(rows[0]?.total_count || 0),
        lastModified: files[0]?.updatedAt || null,
      });
    }
    return result;
  }

  async getAllCountyOrganizations(limit = 100): Promise<CountyFileOrganization[]> {
    const safeLimit = Math.min(100, Math.max(1, Math.trunc(limit)));
    const counties = await this.database.query(
      `SELECT DISTINCT county_fips
         FROM scout_file_assignments
        WHERE active = true
        ORDER BY county_fips
        LIMIT $1`,
      [safeLimit]
    );
    const map = await this.getCountyFilesBatch(
      counties.rows.map((row) => String(row.county_fips)),
      10
    );
    return Array.from(map.values());
  }

  getSuggestedCounties(): [] {
    return [];
  }

  async getAssignmentHistory(
    limit = 50,
    countyFips?: string,
    offset = 0
  ): Promise<Paginated<Record<string, unknown>>> {
    const page = normalizePage(limit, offset);
    const fips = countyFips ? normalizeFips(countyFips) : null;
    const result = await this.database.query(
      `SELECT e.id, e.assignment_id, e.verification_document_id, e.event_type,
              e.from_county_fips, e.to_county_fips, e.actor_user_id, e.notes,
              e.created_at, vd.file_name, vd.type,
              count(*) OVER()::int AS total_count
         FROM scout_file_assignment_events e
         JOIN verification_documents vd ON vd.id = e.verification_document_id
        WHERE (
          $1::varchar IS NULL
          OR e.from_county_fips = $1
          OR e.to_county_fips = $1
        )
        ORDER BY e.created_at DESC, e.id
        LIMIT $2 OFFSET $3`,
      [fips, page.limit, page.offset]
    );
    return {
      items: result.rows.map((row) => ({
        id: String(row.id),
        assignmentId: String(row.assignment_id),
        fileId: String(row.verification_document_id),
        fileName: String(row.file_name),
        fileType: String(row.type),
        eventType: String(row.event_type),
        fromCountyFips: row.from_county_fips,
        toCountyFips: row.to_county_fips,
        actorUserId: String(row.actor_user_id),
        notes: row.notes,
        createdAt: new Date(row.created_at),
      })),
      total: Number(result.rows[0]?.total_count || 0),
      ...page,
    };
  }

  async getBatchStatus(batchId: string): Promise<FileAssignmentBatch | null> {
    const id = normalizeId(batchId, "batchId");
    const result = await this.database.query(
      "SELECT * FROM scout_file_assignment_batches WHERE id = $1 LIMIT 1",
      [id]
    );
    const row = result.rows[0];
    if (!row) return null;
    return {
      id: String(row.id),
      fileIds: Array.isArray(row.file_ids) ? row.file_ids.map(String) : [],
      countyFips: String(row.county_fips),
      status: "completed",
      createdAt: new Date(row.created_at),
      completedAt: new Date(row.completed_at),
      results: {
        successful: Number(row.results?.successful || 0),
        failed: 0,
      },
    };
  }

  async getStatistics(): Promise<Record<string, unknown>> {
    const [assignmentResult, countyResult, typeResult, unassignedResult] = await Promise.all([
      this.database.query(
        "SELECT count(*)::int AS count FROM scout_file_assignments WHERE active = true"
      ),
      this.database.query(
        `SELECT county_fips, count(*)::int AS count
           FROM scout_file_assignments
          WHERE active = true
          GROUP BY county_fips
          ORDER BY count DESC, county_fips
          LIMIT 100`
      ),
      this.database.query(
        `SELECT vd.type, count(*)::int AS count
           FROM scout_file_assignments sfa
           JOIN verification_documents vd ON vd.id = sfa.verification_document_id
          WHERE sfa.active = true
          GROUP BY vd.type`
      ),
      this.database.query(
        `SELECT count(*)::int AS count
           FROM verification_documents vd
          WHERE NOT EXISTS (
            SELECT 1 FROM scout_file_assignments sfa
             WHERE sfa.verification_document_id = vd.id AND sfa.active = true
          )`
      ),
    ]);
    return {
      totalAssignments: Number(assignmentResult.rows[0]?.count || 0),
      totalUnassigned: Number(unassignedResult.rows[0]?.count || 0),
      totalCounties: countyResult.rows.length,
      assignmentsByCounty: Object.fromEntries(
        countyResult.rows.map((row) => [String(row.county_fips), Number(row.count)])
      ),
      assignmentsByType: Object.fromEntries(
        typeResult.rows.map((row) => [String(row.type), Number(row.count)])
      ),
      evidence: "database",
    };
  }
}

export const scoutVisualFileSorting = new ScoutVisualFileSorting();
