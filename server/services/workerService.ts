import { db } from "../../src/db/drizzle-mock";
import { and, eq, ilike } from "drizzle-orm";
import { workers, tasks, taskApplications, type Worker as DbWorker, type Task as DbTask } from "@shared/schema";

// Re-export schema-derived types for consumers of this service
export type WorkerProfile = DbWorker;
export type Task = DbTask;

// ============================================================================
// WORKER MANAGEMENT
// ============================================================================

export async function registerWorker(
  userId: string,
  name: string,
  skills: string[],
  hourlyRate: number,
  availability: string,
  bio?: string
): Promise<WorkerProfile | null> {
  try {
    const trimmedName = name.trim();
    if (!userId || !trimmedName) {
      throw new Error("userId and name are required to register a worker");
    }

    // Split name into first/last where possible
    const [firstName, ...rest] = trimmedName.split(" ");
    const lastName = rest.join(" ").trim() || "";

    const [worker] = await db
      .insert(workers)
      .values({
        userId,
        firstName,
        lastName,
        phone: "", // Can be updated later via profile flows
        email: "",
        bio,
        skills,
        hourlyRate: String(hourlyRate),
        availableHours: availability ? { notes: availability } : null,
        verificationStatus: "pending",
      } as any)
      .returning();

    return worker ?? null;
  } catch (error) {
    console.error("Error registering worker:", error);
    return null;
  }
}

export async function searchWorkers(options: {
  skills?: string[];
  county?: string;
  state?: string;
  verified?: boolean;
  limit?: number;
}): Promise<WorkerProfile[]> {
  try {
    const { skills, county, state, verified, limit } = options;

    const conditions: any[] = [];

    if (Array.isArray(skills) && skills.length) {
      const firstSkill = skills[0];
      conditions.push(ilike(workers.skills as any, `%${firstSkill}%`));
    }

    // Location-based filtering will be wired up once worker records
    // carry structured location fields that match the schema. For now,
    // we ignore county/state filters to avoid querying non-existent
    // columns.

    if (verified !== undefined) {
      conditions.push(eq(workers.isBackgroundChecked, verified));
    }

    const whereClause = conditions.length
      ? conditions.length === 1
        ? conditions[0]
        : and(...conditions)
      : undefined;

    const query = db.select().from(workers);
    const rows = whereClause
      ? await query.where(whereClause).limit(limit ?? 20)
      : await query.limit(limit ?? 20);

    return rows;
  } catch (error) {
    console.error("Error searching workers:", error);
    return [];
  }
}

export async function getWorkerProfile(workerId: string): Promise<WorkerProfile | null> {
  try {
    if (!workerId) return null;

    const rows = await db
      .select()
      .from(workers)
      .where(eq(workers.id, workerId))
      .limit(1);

    return rows[0] ?? null;
  } catch (error) {
    console.error("Error getting worker profile:", error);
    return null;
  }
}

export async function verifyWorker(workerId: string, verified: boolean): Promise<boolean> {
  try {
    if (!workerId) return false;

    await db
      .update(workers)
      .set({
        isBackgroundChecked: verified,
        verificationStatus: verified ? "approved" : "rejected",
      } as any)
      .where(eq(workers.id, workerId));

    return true;
  } catch (error) {
    console.error("Error verifying worker:", error);
    return false;
  }
}

// ============================================================================
// TASK MANAGEMENT
// ============================================================================

export async function postTask(
  userId: string,
  title: string,
  description: string,
  budget: number,
  location: string,
  skillsNeeded: string[],
  deadline?: Date
): Promise<Task | null> {
  try {
    if (!userId || !title || !description || !Number.isFinite(budget) || budget <= 0) {
      throw new Error("Invalid task parameters");
    }

    const [task] = await db
      .insert(tasks)
      .values({
        posterId: userId,
        posterType: "homeowner",
        title,
        description,
        payType: "fixed",
        payAmount: String(budget),
        address: location,
        requiredSkills: skillsNeeded,
        status: "open",
        endDate: deadline ?? undefined,
      } as any)
      .returning();

    return task ?? null;
  } catch (error) {
    console.error("Error posting task:", error);
    return null;
  }
}

export async function applyToTask(
  taskId: string,
  workerId: string,
  proposal: string,
  estimatedHours: number
): Promise<boolean> {
  try {
    if (!taskId || !workerId) return false;

    await db
      .insert(taskApplications)
      .values({
        taskId,
        workerId,
        message: proposal,
        estimatedDuration: estimatedHours ? String(estimatedHours) : undefined,
        status: "pending",
      } as any);

    return true;
  } catch (error) {
    console.error("Error applying to task:", error);
    return false;
  }
}

export async function getTaskApplications(
  taskId: string
): Promise<Array<{ workerId: string; proposal: string; estimatedHours: number }>> {
  try {
    if (!taskId) return [];

    const rows = await db
      .select()
      .from(taskApplications)
      .where(eq(taskApplications.taskId, taskId));

    return rows.map((row) => ({
      workerId: row.workerId,
      proposal: row.message ?? "",
      estimatedHours: row.estimatedDuration ? Number(row.estimatedDuration) : 0,
    }));
  } catch (error) {
    console.error("Error getting task applications:", error);
    return [];
  }
}
