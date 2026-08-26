import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  MAX_SCOUT_BATCH_SIZE,
  ScoutFileAssignmentConflictError,
  ScoutFileAssignmentNotFoundError,
  ScoutFileBatchTooLargeError,
  ScoutVisualFileSorting,
} from "../services/scoutVisualFileSorting";

type AssignmentRow = {
  id: string;
  verification_document_id: string;
  county_fips: string;
  assigned_by: string;
  notes: string | null;
  active: boolean;
  assigned_at: Date;
  updated_at: Date;
  version: number;
};

class FakeAssignmentPool {
  readonly counties = new Set(["48453", "48201", "48113"]);
  readonly documents = new Set(["doc-1", "doc-2", "doc-3"]);
  readonly assignments = new Map<string, AssignmentRow>();
  batchWrites = 0;
  connectCount = 0;
  private sequence = 0;
  private tails = new Map<string, Promise<void>>();

  private async acquire(key: string): Promise<() => void> {
    const prior = this.tails.get(key) || Promise.resolve();
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    this.tails.set(key, prior.then(() => gate));
    await prior;
    return release;
  }

  async query(): Promise<{ rows: any[] }> {
    return { rows: [] };
  }

  async connect() {
    this.connectCount += 1;
    const releases: Array<() => void> = [];
    return {
      query: async (sql: string, params: any[] = []) => {
        const query = sql.replace(/\s+/g, " ").trim().toLowerCase();
        if (query === "begin") return { rows: [] };
        if (query === "commit" || query === "rollback") {
          while (releases.length) releases.pop()?.();
          return { rows: [] };
        }
        if (query.includes("pg_advisory_xact_lock")) {
          releases.push(await this.acquire(String(params[0])));
          return { rows: [] };
        }
        if (query.startsWith("select fips from counties")) {
          return { rows: this.counties.has(String(params[0])) ? [{ fips: params[0] }] : [] };
        }
        if (
          query.startsWith("select id from verification_documents") &&
          query.includes("where id = $1")
        ) {
          return {
            rows: this.documents.has(String(params[0])) ? [{ id: params[0] }] : [],
          };
        }
        if (
          query.startsWith("select id from verification_documents") &&
          query.includes("any($1::varchar[])")
        ) {
          return {
            rows: (params[0] as string[])
              .filter((id) => this.documents.has(id))
              .map((id) => ({ id })),
          };
        }
        if (
          query.startsWith("select id from scout_file_assignments") &&
          query.includes("verification_document_id = $1")
        ) {
          const row = this.assignments.get(String(params[0]));
          return { rows: row?.active ? [{ id: row.id }] : [] };
        }
        if (
          query.startsWith("select verification_document_id") &&
          query.includes("any($1::varchar[])")
        ) {
          const rows = (params[0] as string[])
            .map((id) => this.assignments.get(id))
            .filter((row): row is AssignmentRow => Boolean(row?.active))
            .map((row) => ({ verification_document_id: row.verification_document_id }));
          return { rows };
        }
        if (
          query.startsWith("insert into scout_file_assignments") &&
          query.includes("from unnest")
        ) {
          const rows = (params[0] as string[]).map((fileId) => {
            const row = this.makeAssignment(fileId, params[1], params[2], null);
            this.assignments.set(fileId, row);
            return { id: row.id, verification_document_id: fileId };
          });
          return { rows };
        }
        if (query.startsWith("insert into scout_file_assignments")) {
          const row = this.makeAssignment(params[0], params[1], params[2], params[3]);
          if (this.assignments.get(String(params[0]))?.active) {
            const error: any = new Error("duplicate");
            error.code = "23505";
            throw error;
          }
          this.assignments.set(String(params[0]), row);
          return { rows: [row] };
        }
        if (query.startsWith("insert into scout_file_assignment_events")) {
          return { rows: [] };
        }
        if (query.startsWith("insert into scout_file_assignment_batches")) {
          this.batchWrites += 1;
          const now = new Date();
          return {
            rows: [
              {
                id: "batch-1",
                county_fips: params[0],
                file_ids: JSON.parse(params[2]),
                created_at: now,
                completed_at: now,
                results: JSON.parse(params[3]),
              },
            ],
          };
        }
        if (
          query.startsWith("select * from scout_file_assignments") &&
          query.includes("county_fips = $2")
        ) {
          const row = this.assignments.get(String(params[0]));
          return {
            rows:
              row?.active && row.county_fips === String(params[1])
                ? [{ ...row }]
                : [],
          };
        }
        if (
          query.startsWith("select county_fips from scout_file_assignments") &&
          query.includes("verification_document_id = $1")
        ) {
          const row = this.assignments.get(String(params[0]));
          return { rows: row?.active ? [{ county_fips: row.county_fips }] : [] };
        }
        if (query.startsWith("update scout_file_assignments")) {
          const id = String(params[2]);
          const row = Array.from(this.assignments.values()).find((item) => item.id === id);
          if (!row || row.version !== Number(params[3])) return { rows: [] };
          row.county_fips = String(params[0]);
          row.assigned_by = String(params[1]);
          row.updated_at = new Date();
          row.version += 1;
          return { rows: [{ ...row }] };
        }
        throw new Error(`Unhandled fake query: ${query}`);
      },
      release: () => {
        while (releases.length) releases.pop()?.();
      },
    };
  }

  private makeAssignment(
    fileId: string,
    countyFips: string,
    assignedBy: string,
    notes: string | null
  ): AssignmentRow {
    const now = new Date();
    return {
      id: `assignment-${++this.sequence}`,
      verification_document_id: String(fileId),
      county_fips: String(countyFips),
      assigned_by: String(assignedBy),
      notes,
      active: true,
      assigned_at: now,
      updated_at: now,
      version: 1,
    };
  }
}

describe("Scout file assignment atomicity", () => {
  it("allows exactly one concurrent assignment for a document", async () => {
    const database = new FakeAssignmentPool();
    const service = new ScoutVisualFileSorting(database as any);
    const results = await Promise.allSettled([
      service.assignFileToCounty("doc-1", "48453", "admin-1"),
      service.assignFileToCounty("doc-1", "48201", "admin-2"),
    ]);

    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    const rejected = results.find((result) => result.status === "rejected") as PromiseRejectedResult;
    expect(rejected.reason).toBeInstanceOf(ScoutFileAssignmentConflictError);
    expect(Array.from(database.assignments.values()).filter((row) => row.active)).toHaveLength(1);
  });

  it("serializes concurrent moves and rejects the stale move", async () => {
    const database = new FakeAssignmentPool();
    const service = new ScoutVisualFileSorting(database as any);
    await service.assignFileToCounty("doc-1", "48453", "admin-1");

    const results = await Promise.allSettled([
      service.moveFileBetweenCounties("doc-1", "48453", "48201", "admin-1", 1),
      service.moveFileBetweenCounties("doc-1", "48453", "48113", "admin-2", 1),
    ]);
    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    const rejected = results.find((result) => result.status === "rejected") as PromiseRejectedResult;
    expect(rejected.reason).toBeInstanceOf(ScoutFileAssignmentConflictError);
    expect(["48201", "48113"]).toContain(database.assignments.get("doc-1")?.county_fips);
  });

  it("does not persist a batch for an invalid county or missing document", async () => {
    const database = new FakeAssignmentPool();
    const service = new ScoutVisualFileSorting(database as any);

    await expect(
      service.batchAssignFiles(["doc-1"], "99999", "admin-1")
    ).rejects.toBeInstanceOf(ScoutFileAssignmentNotFoundError);
    await expect(
      service.batchAssignFiles(["doc-1", "missing"], "48453", "admin-1")
    ).rejects.toBeInstanceOf(ScoutFileAssignmentNotFoundError);

    expect(database.batchWrites).toBe(0);
    expect(database.assignments.size).toBe(0);
  });

  it("rejects oversized batches before opening a transaction", async () => {
    const database = new FakeAssignmentPool();
    const service = new ScoutVisualFileSorting(database as any);
    const fileIds = Array.from(
      { length: MAX_SCOUT_BATCH_SIZE + 1 },
      (_, index) => `doc-${index}`
    );
    await expect(
      service.batchAssignFiles(fileIds, "48453", "admin-1")
    ).rejects.toBeInstanceOf(ScoutFileBatchTooLargeError);
    expect(database.connectCount).toBe(0);
  });
});

describe("Scout heatmap route truth contract", () => {
  it("keeps verification-document operations admin-only and propagates non-200 errors", () => {
    const source = readFileSync("server/routes/scout-heatmap.ts", "utf8");
    expect(source).toContain("router.use(requireAuth, requireAdmin)");
    expect(source).toContain("res.status(error.statusCode)");
    expect(source).toContain("res.status(503)");
    expect(source).not.toContain("triggerCountyUpdate");
    expect(source).not.toContain("monitorMission");
  });
});
