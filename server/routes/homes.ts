import { Router } from "express";
import { z } from "zod";
import { and, desc, eq, inArray } from "drizzle-orm";
import { isAuthenticated } from "../auth";
import { db } from "../db";
import {
  USER_HOME_DOCUMENT_TYPES,
  USER_HOME_RECORD_TYPES,
  businesses,
  homeReportShares,
  homeProjectPlans,
  homeProjects,
  homeMaintenanceSchedules,
  propertyPrograms,
  userHomeAppliances,
  userHomeDocuments,
  userHomeRecords,
  userHomes,
} from "../../shared/schema";
import { addPropertyLifecycleEvent } from "../services/propertyLifecycleService";
import { parseHomeIdPersistenceGraph } from "@shared/homeIdPacketAuthority";

const router = Router();
const HOMEID_DASHBOARD_SECTION_TIMEOUT_MS = 2500;
type HomeIdServerPropertyDetail = {
  id: string;
  category: string;
  note: string;
  status: "known" | "needs_review";
  createdAt: string;
  savedAt: string;
};

type HomeIdServerRequestPacket = {
  id: string;
  requestType: string;
  selectedDetailIds: string[];
  missingHelpfulInfo: string[];
  missingHelpfulInfoCount: number;
  status: "draft" | "ready_for_handoff" | "needs_info";
  createdAt: string;
  savedAt: string;
};
type HomeIdComponentSource =
  | "user_added"
  | "direct_connect_request"
  | "direct_connect_completed_work"
  | "homeid_packet";

type HomeIdServerComponent = {
  id: string;
  homeId: string;
  type: string;
  label: string;
  status: "known" | "needs_review" | "unknown";
  source: HomeIdComponentSource;
  linkedDirectConnectRequestIds?: string[];
  linkedHomePacketIds?: string[];
  createdAt: string;
  updatedAt: string;
};
type HomeIdEvidenceSource =
  | "user_uploaded"
  | "direct_connect_request"
  | "direct_connect_completed_work"
  | "homeid_packet";

type HomeIdEvidenceType =
  | "photo"
  | "document"
  | "receipt"
  | "invoice"
  | "inspection_report"
  | "warranty"
  | "manual"
  | "model_plate"
  | "other";

type HomeIdEvidenceStatus = "pending" | "verified" | "needs_review";

type HomeIdServerEvidence = {
  id: string;
  homeId: string;
  componentId?: string;
  directConnectRequestId?: string;
  homePacketId?: string;
  selectedDetailIds?: string[];
  evidenceType: HomeIdEvidenceType;
  title: string;
  description?: string;
  source: HomeIdEvidenceSource;
  status: HomeIdEvidenceStatus;
  fileUrl?: string;
  fileName?: string;
  mimeType?: string;
  createdAt: string;
  updatedAt: string;
};
type HomeIdServerPersistenceState = {
  propertyDetails: HomeIdServerPropertyDetail[];
  requestPackets: HomeIdServerRequestPacket[];
  components: HomeIdServerComponent[];
  evidence: HomeIdServerEvidence[];
  updatedAt: string;
};

const HOMEID_PERSISTENCE_PROPERTY_DETAILS_TITLE = "homeid:persistence:property_details";
const HOMEID_PERSISTENCE_REQUEST_PACKETS_TITLE = "homeid:persistence:request_packets";
const HOMEID_PERSISTENCE_COMPONENTS_TITLE = "homeid:persistence:components";
const HOMEID_PERSISTENCE_EVIDENCE_TITLE = "homeid:persistence:evidence";

const HOME_TYPES = [
  "single_family",
  "townhome",
  "condo",
  "duplex",
  "triplex_fourplex",
  "multi_family",
  "manufactured_home",
  "mobile_home",
  "new_build",
  "land_lot",
  "commercial_residential_mixed",
  "rental_unit",
  "other",
] as const;

const HOME_AUTHORITY_ROLES = [
  "owner",
  "pending_owner",
  "builder_of_record",
  "agent_delegate",
  "property_manager",
  "admin",
] as const;

const HOME_CREATOR_ROLES = [
  "homeowner",
  "builder",
  "realtor",
  "property_manager",
  "admin",
  "homescout_sale_flow",
] as const;

const HOMEID_CORE_REQUIREMENTS: Record<(typeof HOME_TYPES)[number], string[]> = {
  single_family: ["roof", "hvac", "water_heater", "foundation", "permits", "appliances"],
  townhome: ["roof", "hvac", "water_heater", "hoa_docs", "appliances"],
  condo: ["hoa_docs", "unit_systems", "shared_systems", "insurance_docs", "appliances"],
  duplex: ["roof", "hvac", "water_heater", "electrical_panel", "permits"],
  triplex_fourplex: ["roof", "hvac", "water_heater", "electrical_panel", "permits"],
  multi_family: ["roof", "hvac", "water_heater", "electrical_panel", "permits"],
  manufactured_home: ["vin_or_serial", "title_docs", "lot_land_relationship", "tie_downs"],
  mobile_home: ["vin_or_serial", "title_docs", "lot_land_relationship", "skirting", "tie_downs"],
  new_build: ["builder_record", "permits", "warranties", "subcontractors", "inspection_milestones"],
  land_lot: ["parcel_apn", "county_context", "zoning_context"],
  commercial_residential_mixed: ["permits", "inspection_milestones", "occupancy_docs"],
  rental_unit: ["property_manager_authority", "tenant_safe_visibility", "service_history"],
  other: ["custom_core_facts"],
};

const createHomeSchema = z.object({
  nickname: z.string().trim().min(1).max(160).optional(),
  propertyType: z.string().trim().min(1).max(64).optional(),
  yearBuilt: z.number().int().min(1600).max(2100).optional(),
  address1: z.string().trim().min(1).max(180).optional(),
  address2: z.string().trim().min(1).max(180).optional(),
  city: z.string().trim().min(1).max(120).optional(),
  stateCode: z.string().trim().length(2).optional(),
  countyFips: z
    .string()
    .trim()
    .regex(/^[0-9]{5}$/)
    .optional(),
  zipCode: z.string().trim().min(3).max(12).optional(),
});

const createHomeIdSchema = z.object({
  nickname: z.string().trim().min(1).max(160).optional(),
  address1: z.string().trim().min(1).max(180).optional(),
  address2: z.string().trim().min(1).max(180).optional(),
  city: z.string().trim().min(1).max(120).optional(),
  stateCode: z.string().trim().length(2).optional(),
  countyFips: z
    .string()
    .trim()
    .regex(/^[0-9]{5}$/)
    .optional(),
  zipCode: z.string().trim().min(3).max(12).optional(),
  yearBuilt: z.number().int().min(1600).max(2100).optional(),
  homeType: z.enum(HOME_TYPES),
  creatorRole: z.enum(HOME_CREATOR_ROLES).default("homeowner"),
  creatorSubjectId: z.string().trim().min(1).max(120).optional(),
});

const addHomeIdAuthoritySchema = z.object({
  subjectId: z.string().trim().min(1).max(120),
  role: z.enum(HOME_AUTHORITY_ROLES),
  status: z.enum(["active", "closed"]).default("active"),
  endedAt: z.string().trim().optional(),
  note: z.string().trim().max(2000).optional(),
});

const createRequestPacketSchema = z.object({
  requestType: z.string().trim().min(2).max(80),
  selectedFields: z.array(z.string().trim().min(1).max(80)).max(120),
});

const proposeRequestEvidenceSchema = z.object({
  requestId: z.string().trim().min(1).max(120),
  title: z.string().trim().min(2).max(220),
  details: z.string().trim().max(20_000).optional(),
  documentType: z.enum(USER_HOME_DOCUMENT_TYPES).optional(),
  objectKey: z.string().trim().min(3).max(600).optional(),
  originalName: z.string().trim().max(260).optional(),
});

const homeIdPropertyDetailSchema = z.object({
  id: z.string().trim().min(1).max(120),
  category: z.string().trim().min(1).max(120),
  note: z.string().trim().min(1).max(20_000),
  status: z.enum(["known", "needs_review"]),
  createdAt: z.string().trim().min(1).max(80),
  savedAt: z.string().trim().min(1).max(80),
});

const homeIdRequestPacketSchema = z.object({
  id: z.string().trim().min(1).max(120),
  requestType: z.string().trim().min(1).max(120),
  selectedDetailIds: z.array(z.string().trim().min(1).max(120)).max(200),
  missingHelpfulInfo: z.array(z.string().trim().min(1).max(200)).max(200),
  missingHelpfulInfoCount: z.number().int().nonnegative(),
  status: z.enum(["draft", "needs_info", "ready_for_handoff"]),
  createdAt: z.string().trim().min(1).max(80),
  savedAt: z.string().trim().min(1).max(80),
});

const upsertHomeIdPropertyDetailsSchema = z.object({
  propertyDetails: z.array(homeIdPropertyDetailSchema).max(500),
});

const upsertHomeIdRequestPacketsSchema = z.object({
  requestPackets: z.array(homeIdRequestPacketSchema).max(500),
});

const homeIdComponentSchema = z.object({
  id: z.string().trim().min(1).max(120),
  homeId: z.string().trim().min(1).max(120),
  type: z.string().trim().min(1).max(80),
  label: z.string().trim().min(1).max(220),
  status: z.enum(["known", "needs_review", "unknown"]),
  source: z.enum([
    "user_added",
    "direct_connect_request",
    "direct_connect_completed_work",
    "homeid_packet",
  ]),
  linkedDirectConnectRequestIds: z.array(z.string().trim().min(1).max(120)).max(200).optional(),
  linkedHomePacketIds: z.array(z.string().trim().min(1).max(120)).max(200).optional(),
  createdAt: z.string().trim().min(1).max(80),
  updatedAt: z.string().trim().min(1).max(80),
});

const upsertHomeIdComponentsSchema = z.object({
  components: z.array(homeIdComponentSchema).max(800),
});

const homeIdEvidenceSchema = z.object({
  id: z.string().trim().min(1).max(120),
  homeId: z.string().trim().min(1).max(120),
  componentId: z.string().trim().min(1).max(120).optional(),
  directConnectRequestId: z.string().trim().min(1).max(120).optional(),
  homePacketId: z.string().trim().min(1).max(120).optional(),
  selectedDetailIds: z.array(z.string().trim().min(1).max(120)).max(200).optional(),
  evidenceType: z.enum([
    "photo",
    "document",
    "receipt",
    "invoice",
    "inspection_report",
    "warranty",
    "manual",
    "model_plate",
    "other",
  ]),
  title: z.string().trim().min(1).max(220),
  description: z.string().trim().max(2000).optional(),
  source: z.enum([
    "user_uploaded",
    "direct_connect_request",
    "direct_connect_completed_work",
    "homeid_packet",
  ]),
  status: z.enum(["pending", "verified", "needs_review"]),
  fileUrl: z.string().trim().min(1).max(1000).optional(),
  fileName: z.string().trim().min(1).max(260).optional(),
  mimeType: z.string().trim().min(1).max(120).optional(),
  createdAt: z.string().trim().min(1).max(80),
  updatedAt: z.string().trim().min(1).max(80),
});

const upsertHomeIdEvidenceSchema = z.object({
  evidence: z.array(homeIdEvidenceSchema).max(1200),
});

const createRecordSchema = z.object({
  recordType: z.enum(USER_HOME_RECORD_TYPES),
  occurredAt: z.string().trim().optional(), // YYYY-MM-DD
  title: z.string().trim().min(2).max(220),
  details: z.string().trim().max(20_000).optional(),
  cost: z.number().finite().nonnegative().optional(),
  tags: z.array(z.string().trim().min(1).max(40)).max(24).optional(),
});

const createApplianceSchema = z.object({
  category: z.string().trim().min(2).max(64),
  brand: z.string().trim().max(120).optional(),
  model: z.string().trim().max(160).optional(),
  serial: z.string().trim().max(160).optional(),
  installedAt: z.string().trim().optional(), // YYYY-MM-DD
  notes: z.string().trim().max(20_000).optional(),
});

const addDocumentSchema = z.object({
  documentType: z.enum(USER_HOME_DOCUMENT_TYPES).optional(),
  objectKey: z.string().trim().min(3).max(600),
  originalName: z.string().trim().max(260).optional(),
  contentType: z.string().trim().max(160).optional(),
  bytes: z.number().int().nonnegative().optional(),
  recordId: z.string().trim().optional(),
});

const createMaintenanceScheduleSchema = z.object({
  title: z.string().trim().min(2).max(220),
  description: z.string().trim().max(20_000).optional(),
  category: z.string().trim().max(64).optional(),
  cadenceDays: z.number().int().min(1).max(3650).default(90),
  nextDueAt: z.string().trim().optional(), // ISO date
  assignedBusinessSlug: z.string().trim().min(2).max(140).optional(),
  shareWithAssignedProvider: z.boolean().optional(),
  shareAddress: z.boolean().optional(),
});

const updateMaintenanceScheduleSchema = z.object({
  title: z.string().trim().min(2).max(220).optional(),
  description: z.string().trim().max(20_000).optional(),
  category: z.string().trim().max(64).optional(),
  cadenceDays: z.number().int().min(1).max(3650).optional(),
  nextDueAt: z.string().trim().optional(), // ISO date
  status: z.enum(["active", "paused", "archived"]).optional(),
  assignedBusinessSlug: z.string().trim().min(0).max(140).optional(), // empty string clears assignment
  shareWithAssignedProvider: z.boolean().optional(),
  shareAddress: z.boolean().optional(),
});

const completeMaintenanceScheduleSchema = z.object({
  occurredAt: z.string().trim().optional(), // YYYY-MM-DD
  notes: z.string().trim().max(20_000).optional(),
  cost: z.number().finite().nonnegative().optional(),
});

const createHomeProjectSchema = z.object({
  title: z.string().trim().min(2).max(220),
  description: z.string().trim().max(20_000).optional(),
  projectType: z.string().trim().max(80).optional(),
  estimatedCost: z.number().finite().nonnegative().optional(),
  desiredStartAt: z.string().trim().optional(), // YYYY-MM-DD

  hasBudgetNow: z.boolean().optional(),
  monthlySavings: z.number().finite().nonnegative().optional(),
  targetBy: z.string().trim().optional(), // YYYY-MM-DD
  fundingSources: z.array(z.string().trim().min(1).max(80)).max(12).optional(),
  planNotes: z.string().trim().max(20_000).optional(),
});

const updateHomeProjectSchema = z.object({
  title: z.string().trim().min(2).max(220).optional(),
  description: z.string().trim().max(20_000).optional(),
  projectType: z.string().trim().max(80).optional(),
  estimatedCost: z.number().finite().nonnegative().optional(),
  desiredStartAt: z.string().trim().optional(), // YYYY-MM-DD
  status: z
    .enum(["planning", "saving", "ready", "in_progress", "completed", "paused", "canceled"])
    .optional(),
});

const upsertHomeProjectPlanSchema = z.object({
  planType: z.enum(["savings", "funding"]).optional(),
  targetAmount: z.number().finite().positive(),
  currentSaved: z.number().finite().nonnegative().optional(),
  targetBy: z.string().trim().optional(), // YYYY-MM-DD
  monthlyContribution: z.number().finite().nonnegative().optional(),
  fundingSources: z.array(z.string().trim().min(1).max(80)).max(12).optional(),
  notes: z.string().trim().max(20_000).optional(),
});

function getUserId(req: any): string {
  return String((req.user as any)?.claims?.sub || (req.user as any)?.id || "").trim();
}

async function runDashboardSection<T>(args: {
  section: string;
  homeId: string;
  userId: string;
  run: () => Promise<T>;
  fallback: T;
  timeoutMs?: number;
  warnings: string[];
}): Promise<T> {
  const timeoutMs = args.timeoutMs ?? HOMEID_DASHBOARD_SECTION_TIMEOUT_MS;
  const started = Date.now();
  const timeoutPromise = new Promise<T>((resolve) => {
    setTimeout(() => resolve(args.fallback), timeoutMs);
  });
  try {
    const result = await Promise.race([args.run(), timeoutPromise]);
    const elapsed = Date.now() - started;
    if (result === args.fallback && elapsed >= timeoutMs) {
      const warning = `section_timeout:${args.section}`;
      args.warnings.push(warning);
      console.warn("[homeid-dashboard] section timed out", {
        section: args.section,
        homeId: args.homeId,
        userId: args.userId,
        elapsedMs: elapsed,
      });
    } else {
      console.info("[homeid-dashboard] section completed", {
        section: args.section,
        homeId: args.homeId,
        userId: args.userId,
        elapsedMs: elapsed,
      });
    }
    return result;
  } catch (error: any) {
    const warning = `section_error:${args.section}`;
    args.warnings.push(warning);
    console.error("[homeid-dashboard] section failed", {
      section: args.section,
      homeId: args.homeId,
      userId: args.userId,
      error: error?.message || String(error),
    });
    return args.fallback;
  }
}

async function requireHomeOwner(userId: string, homeId: string) {
  const [home] = await db
    .select()
    .from(userHomes)
    .where(and(eq(userHomes.id, homeId), eq(userHomes.ownerUserId, userId)))
    .limit(1);
  return home ?? null;
}

async function getLinkedPropertyProgramIdsForHome(homeId: string): Promise<string[]> {
  const rows = await db
    .select({ id: propertyPrograms.id })
    .from(propertyPrograms)
    .where(eq(propertyPrograms.userHomeId, homeId))
    .orderBy(desc(propertyPrograms.updatedAt))
    .limit(5);
  return rows.map((r) => String(r.id)).filter(Boolean);
}

function dateToNoonUtc(value: string): Date {
  // Stored as YYYY-MM-DD in the Home Vault. Convert to a stable timestamp.
  return new Date(`${value}T12:00:00.000Z`);
}

function parseIsoDateOrNull(value: string | undefined): Date | null {
  if (!value) return null;
  const d = new Date(value);
  if (!Number.isFinite(d.getTime())) return null;
  return d;
}

function parseYmdOrNull(value: string | undefined): string | null {
  if (!value) return null;
  const v = String(value).trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) return null;
  return v;
}

function addDays(d: Date, days: number): Date {
  const next = new Date(d.getTime());
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

function parseJsonObjectSafe(input: unknown): Record<string, any> | null {
  if (typeof input !== "string") return null;
  try {
    const parsed = JSON.parse(input);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) return parsed;
    return null;
  } catch {
    return null;
  }
}

async function loadHomeIdPersistenceFromDb(
  homeId: string,
  userId: string
): Promise<HomeIdServerPersistenceState> {
  const rows = await db
    .select({
      id: userHomeRecords.id,
      title: userHomeRecords.title,
      details: userHomeRecords.details,
      updatedAt: userHomeRecords.updatedAt,
      createdAt: userHomeRecords.createdAt,
    })
    .from(userHomeRecords)
    .where(
      and(
        eq(userHomeRecords.homeId, homeId),
        eq(userHomeRecords.createdByUserId, userId),
        inArray(userHomeRecords.title, [
          HOMEID_PERSISTENCE_PROPERTY_DETAILS_TITLE,
          HOMEID_PERSISTENCE_REQUEST_PACKETS_TITLE,
          HOMEID_PERSISTENCE_COMPONENTS_TITLE,
          HOMEID_PERSISTENCE_EVIDENCE_TITLE,
        ])
      )
    );

  const propertyDetailsRecord = rows.find(
    (row) => String(row.title || "").trim() === HOMEID_PERSISTENCE_PROPERTY_DETAILS_TITLE
  );
  const requestPacketsRecord = rows.find(
    (row) => String(row.title || "").trim() === HOMEID_PERSISTENCE_REQUEST_PACKETS_TITLE
  );
  const componentsRecord = rows.find(
    (row) => String(row.title || "").trim() === HOMEID_PERSISTENCE_COMPONENTS_TITLE
  );
  const evidenceRecord = rows.find(
    (row) => String(row.title || "").trim() === HOMEID_PERSISTENCE_EVIDENCE_TITLE
  );

  const propertyDetailsPayload = parseJsonObjectSafe(propertyDetailsRecord?.details);
  const requestPacketsPayload = parseJsonObjectSafe(requestPacketsRecord?.details);
  const componentsPayload = parseJsonObjectSafe(componentsRecord?.details);
  const evidencePayload = parseJsonObjectSafe(evidenceRecord?.details);

  const rawPropertyDetails = Array.isArray(propertyDetailsPayload?.propertyDetails)
    ? (propertyDetailsPayload?.propertyDetails as HomeIdServerPropertyDetail[])
    : [];
  const rawRequestPackets = Array.isArray(requestPacketsPayload?.requestPackets)
    ? (requestPacketsPayload?.requestPackets as HomeIdServerRequestPacket[])
    : [];
  const persistenceGraph = parseHomeIdPersistenceGraph({
    propertyDetails: rawPropertyDetails,
    requestPackets: rawRequestPackets,
  });
  if (!persistenceGraph) throw new Error("Stored HomeID detail/request-packet graph is invalid");
  const components = Array.isArray(componentsPayload?.components)
    ? (componentsPayload?.components as HomeIdServerComponent[])
    : [];
  const evidence = Array.isArray(evidencePayload?.evidence)
    ? (evidencePayload?.evidence as HomeIdServerEvidence[])
    : [];

  const updatedAtCandidates = [
    String(propertyDetailsPayload?.updatedAt || "").trim(),
    String(requestPacketsPayload?.updatedAt || "").trim(),
    String(componentsPayload?.updatedAt || "").trim(),
    String(evidencePayload?.updatedAt || "").trim(),
    propertyDetailsRecord?.updatedAt?.toISOString?.() || "",
    requestPacketsRecord?.updatedAt?.toISOString?.() || "",
    componentsRecord?.updatedAt?.toISOString?.() || "",
    evidenceRecord?.updatedAt?.toISOString?.() || "",
  ].filter(Boolean);

  return {
    propertyDetails: persistenceGraph.propertyDetails,
    requestPackets: persistenceGraph.requestPackets,
    components,
    evidence,
    updatedAt: updatedAtCandidates[0] || new Date().toISOString(),
  };
}

async function upsertHomeIdPersistenceRecord(args: {
  homeId: string;
  userId: string;
  title: string;
  payload: Record<string, unknown>;
}) {
  const [existing] = await db
    .select({ id: userHomeRecords.id })
    .from(userHomeRecords)
    .where(
      and(
        eq(userHomeRecords.homeId, args.homeId),
        eq(userHomeRecords.createdByUserId, args.userId),
        eq(userHomeRecords.title, args.title)
      )
    )
    .limit(1);

  const details = JSON.stringify(args.payload);
  if (existing?.id) {
    await db
      .update(userHomeRecords)
      .set({
        details,
        updatedAt: new Date(),
      } as any)
      .where(eq(userHomeRecords.id, existing.id));
    return;
  }

  await db.insert(userHomeRecords).values({
    homeId: args.homeId,
    createdByUserId: args.userId,
    recordType: "note",
    title: args.title,
    details,
    tags: ["homeid", "persistence"],
    updatedAt: new Date(),
  } as any);
}

function homeIdRoleFromCreator(creatorRole: (typeof HOME_CREATOR_ROLES)[number]) {
  switch (creatorRole) {
    case "builder":
      return "builder_of_record";
    case "realtor":
      return "agent_delegate";
    case "property_manager":
      return "property_manager";
    case "admin":
      return "admin";
    case "homeowner":
    case "homescout_sale_flow":
    default:
      return "pending_owner";
  }
}

function completionStateFromScore(score: number): string {
  if (score <= 24) return "Started";
  if (score <= 49) return "Basic HomeID";
  if (score <= 74) return "Useful HomeID";
  if (score <= 94) return "Verified HomeID";
  return "Transfer-ready HomeID";
}

function personaMessage(args: {
  score: number;
  state: string;
  persona: "homeowner" | "realtor" | "builder" | "property_manager" | "admin" | "other";
  missingHints: string[];
}) {
  const topHints = args.missingHints.slice(0, 3).join(", ") || "key records";
  if (args.persona === "realtor") {
    return `This HomeID is ${args.score}% listing-ready. Add ${topHints} to improve buyer confidence.`;
  }
  if (args.persona === "builder") {
    return `This HomeID is ${args.score}% handoff-ready. Add ${topHints} to complete closeout.`;
  }
  return `Your HomeID is ${args.score}% complete (${args.state}). Add ${topHints} to move forward.`;
}

function monthsBetweenInclusive(from: Date, to: Date): number {
  const f = new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), 1));
  const t = new Date(Date.UTC(to.getUTCFullYear(), to.getUTCMonth(), 1));
  const months =
    (t.getUTCFullYear() - f.getUTCFullYear()) * 12 + (t.getUTCMonth() - f.getUTCMonth());
  return Math.max(1, months + 1);
}

router.get("/api/homes", isAuthenticated, async (req: any, res) => {
  const userId = getUserId(req);
  if (!userId) return res.status(401).json({ message: "Authentication required" });

  const homes = await db
    .select()
    .from(userHomes)
    .where(eq(userHomes.ownerUserId, userId))
    .orderBy(desc(userHomes.updatedAt))
    .limit(50);

  res.json({ homes });
});

router.post("/api/homes", isAuthenticated, async (req: any, res) => {
  const userId = getUserId(req);
  if (!userId) return res.status(401).json({ message: "Authentication required" });

  const body = createHomeSchema.parse(req.body ?? {});
  const [created] = await db
    .insert(userHomes)
    .values({
      ownerUserId: userId,
      nickname: body.nickname || null,
      propertyType: body.propertyType || null,
      yearBuilt: body.yearBuilt ?? null,
      address1: body.address1 || null,
      address2: body.address2 || null,
      city: body.city || null,
      stateCode: body.stateCode || null,
      countyFips: body.countyFips || null,
      zipCode: body.zipCode || null,
      updatedAt: new Date(),
    })
    .returning();

  res.status(201).json({ home: created });
});

router.post("/api/homeid/create", isAuthenticated, async (req: any, res) => {
  const userId = getUserId(req);
  if (!userId) return res.status(401).json({ message: "Authentication required" });

  const body = createHomeIdSchema.parse(req.body ?? {});
  const [created] = await db
    .insert(userHomes)
    .values({
      ownerUserId: userId,
      nickname: body.nickname || null,
      propertyType: body.homeType,
      yearBuilt: body.yearBuilt ?? null,
      address1: body.address1 || null,
      address2: body.address2 || null,
      city: body.city || null,
      stateCode: body.stateCode || null,
      countyFips: body.countyFips || null,
      zipCode: body.zipCode || null,
      updatedAt: new Date(),
    })
    .returning();

  if (!created) return res.status(500).json({ message: "Failed to create HomeID" });

  const authoritySubjectId = body.creatorSubjectId || userId;
  await db.insert(userHomeRecords).values({
    homeId: created.id,
    createdByUserId: userId,
    recordType: "note",
    title: "homeid:authority",
    details: JSON.stringify({
      subjectId: authoritySubjectId,
      role: homeIdRoleFromCreator(body.creatorRole),
      status: "active",
      source: "homeid_create",
      creatorRole: body.creatorRole,
      createdAt: new Date().toISOString(),
    }),
    tags: ["homeid", "authority"],
    updatedAt: new Date(),
  } as any);

  await db.insert(userHomeRecords).values({
    homeId: created.id,
    createdByUserId: userId,
    recordType: "note",
    title: "homeid:creation",
    details: JSON.stringify({
      homeType: body.homeType,
      creatorRole: body.creatorRole,
      requiredCoreFacts: HOMEID_CORE_REQUIREMENTS[body.homeType],
      createdAt: new Date().toISOString(),
    }),
    tags: ["homeid", "creation"],
    updatedAt: new Date(),
  } as any);

  res.status(201).json({
    home: created,
    homeType: body.homeType,
    requiredCoreFacts: HOMEID_CORE_REQUIREMENTS[body.homeType],
  });
});

router.get("/api/homeid/:homeId/persistence", isAuthenticated, async (req: any, res) => {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Authentication required" });

    const homeId = String(req.params.homeId || "").trim();
    if (!homeId) return res.status(400).json({ message: "homeId required" });

    const home = await requireHomeOwner(userId, homeId);
    if (!home) return res.status(404).json({ message: "Home not found" });

    const persistence = await loadHomeIdPersistenceFromDb(homeId, userId);
    return res.json({ ok: true, persistence });
  } catch (error: any) {
    return res.status(500).json({ message: error?.message || "Could not load HomeID persistence" });
  }
});

router.put("/api/homeid/:homeId/property-details", isAuthenticated, async (req: any, res) => {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Authentication required" });

    const homeId = String(req.params.homeId || "").trim();
    if (!homeId) return res.status(400).json({ message: "homeId required" });

    const home = await requireHomeOwner(userId, homeId);
    if (!home) return res.status(404).json({ message: "Home not found" });

    const parsed = upsertHomeIdPropertyDetailsSchema.safeParse(req.body ?? {});
    if (!parsed.success) {
      return res
        .status(400)
        .json({ message: "Invalid property details payload", issues: parsed.error.issues });
    }

    const existing = await loadHomeIdPersistenceFromDb(homeId, userId);
    const persistence = {
      propertyDetails: parsed.data.propertyDetails,
      requestPackets: existing?.requestPackets || [],
      components: existing?.components || [],
      evidence: existing?.evidence || [],
      updatedAt: new Date().toISOString(),
    };
    await upsertHomeIdPersistenceRecord({
      homeId,
      userId,
      title: HOMEID_PERSISTENCE_PROPERTY_DETAILS_TITLE,
      payload: {
        propertyDetails: persistence.propertyDetails,
        updatedAt: persistence.updatedAt,
      },
    });
    return res.json({ ok: true, persistence });
  } catch (error: any) {
    return res.status(500).json({ message: error?.message || "Could not save property details" });
  }
});

router.put("/api/homeid/:homeId/request-packets", isAuthenticated, async (req: any, res) => {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Authentication required" });

    const homeId = String(req.params.homeId || "").trim();
    if (!homeId) return res.status(400).json({ message: "homeId required" });

    const home = await requireHomeOwner(userId, homeId);
    if (!home) return res.status(404).json({ message: "Home not found" });

    const parsed = upsertHomeIdRequestPacketsSchema.safeParse(req.body ?? {});
    if (!parsed.success) {
      return res
        .status(400)
        .json({ message: "Invalid request packets payload", issues: parsed.error.issues });
    }

    const existing = await loadHomeIdPersistenceFromDb(homeId, userId);
    const persistence = {
      propertyDetails: existing?.propertyDetails || [],
      requestPackets: parsed.data.requestPackets,
      components: existing?.components || [],
      evidence: existing?.evidence || [],
      updatedAt: new Date().toISOString(),
    };
    await upsertHomeIdPersistenceRecord({
      homeId,
      userId,
      title: HOMEID_PERSISTENCE_REQUEST_PACKETS_TITLE,
      payload: {
        requestPackets: persistence.requestPackets,
        updatedAt: persistence.updatedAt,
      },
    });
    return res.json({ ok: true, persistence });
  } catch (error: any) {
    return res.status(500).json({ message: error?.message || "Could not save request packets" });
  }
});

router.put("/api/homeid/:homeId/components", isAuthenticated, async (req: any, res) => {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Authentication required" });

    const homeId = String(req.params.homeId || "").trim();
    if (!homeId) return res.status(400).json({ message: "homeId required" });

    const home = await requireHomeOwner(userId, homeId);
    if (!home) return res.status(404).json({ message: "Home not found" });

    const parsed = upsertHomeIdComponentsSchema.safeParse(req.body ?? {});
    if (!parsed.success) {
      return res
        .status(400)
        .json({ message: "Invalid components payload", issues: parsed.error.issues });
    }

    const existing = await loadHomeIdPersistenceFromDb(homeId, userId);
    const persistence = {
      propertyDetails: existing?.propertyDetails || [],
      requestPackets: existing?.requestPackets || [],
      components: parsed.data.components,
      evidence: existing?.evidence || [],
      updatedAt: new Date().toISOString(),
    };
    await upsertHomeIdPersistenceRecord({
      homeId,
      userId,
      title: HOMEID_PERSISTENCE_COMPONENTS_TITLE,
      payload: {
        components: persistence.components,
        updatedAt: persistence.updatedAt,
      },
    });
    return res.json({ ok: true, persistence });
  } catch (error: any) {
    return res.status(500).json({ message: error?.message || "Could not save HomeID components" });
  }
});

router.put("/api/homeid/:homeId/evidence", isAuthenticated, async (req: any, res) => {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Authentication required" });

    const homeId = String(req.params.homeId || "").trim();
    if (!homeId) return res.status(400).json({ message: "homeId required" });

    const home = await requireHomeOwner(userId, homeId);
    if (!home) return res.status(404).json({ message: "Home not found" });

    const parsed = upsertHomeIdEvidenceSchema.safeParse(req.body ?? {});
    if (!parsed.success) {
      return res
        .status(400)
        .json({ message: "Invalid evidence payload", issues: parsed.error.issues });
    }

    const existing = await loadHomeIdPersistenceFromDb(homeId, userId);
    const persistence = {
      propertyDetails: existing?.propertyDetails || [],
      requestPackets: existing?.requestPackets || [],
      components: existing?.components || [],
      evidence: parsed.data.evidence,
      updatedAt: new Date().toISOString(),
    };
    await upsertHomeIdPersistenceRecord({
      homeId,
      userId,
      title: HOMEID_PERSISTENCE_EVIDENCE_TITLE,
      payload: {
        evidence: persistence.evidence,
        updatedAt: persistence.updatedAt,
      },
    });
    return res.json({ ok: true, persistence });
  } catch (error: any) {
    return res.status(500).json({ message: error?.message || "Could not save HomeID evidence" });
  }
});

router.get("/api/homes/:homeId", isAuthenticated, async (req: any, res) => {
  const userId = getUserId(req);
  if (!userId) return res.status(401).json({ message: "Authentication required" });

  const homeId = String(req.params.homeId || "").trim();
  if (!homeId) return res.status(400).json({ message: "homeId required" });

  const home = await requireHomeOwner(userId, homeId);
  if (!home) return res.status(404).json({ message: "Home not found" });

  const records = await db
    .select()
    .from(userHomeRecords)
    .where(eq(userHomeRecords.homeId, homeId))
    .orderBy(desc(userHomeRecords.occurredAt), desc(userHomeRecords.createdAt))
    .limit(100);

  const appliances = await db
    .select()
    .from(userHomeAppliances)
    .where(eq(userHomeAppliances.homeId, homeId))
    .orderBy(desc(userHomeAppliances.updatedAt))
    .limit(200);

  const documents = await db
    .select()
    .from(userHomeDocuments)
    .where(eq(userHomeDocuments.homeId, homeId))
    .orderBy(desc(userHomeDocuments.createdAt))
    .limit(200);

  res.json({ home, records, appliances, documents });
});

router.get("/api/homes/:homeId/homeid-dashboard", isAuthenticated, async (req: any, res) => {
  const userId = getUserId(req);
  if (!userId) return res.status(401).json({ message: "Authentication required" });

  const homeId = String(req.params.homeId || "").trim();
  if (!homeId) return res.status(400).json({ message: "homeId required" });

  const dashboardStarted = Date.now();
  const home = await requireHomeOwner(userId, homeId);
  if (!home) return res.status(404).json({ message: "Home not found" });

  const warnings: string[] = [];
  const [records, appliances, documents, schedules, shares] = await Promise.all([
    runDashboardSection({
      section: "records",
      homeId,
      userId,
      warnings,
      fallback: [] as any[],
      run: () =>
        db
          .select()
          .from(userHomeRecords)
          .where(eq(userHomeRecords.homeId, homeId))
          .orderBy(desc(userHomeRecords.createdAt))
          .limit(500),
    }),
    runDashboardSection({
      section: "appliances",
      homeId,
      userId,
      warnings,
      fallback: [] as any[],
      run: () =>
        db
          .select()
          .from(userHomeAppliances)
          .where(eq(userHomeAppliances.homeId, homeId))
          .limit(500),
    }),
    runDashboardSection({
      section: "documents",
      homeId,
      userId,
      warnings,
      fallback: [] as any[],
      run: () =>
        db.select().from(userHomeDocuments).where(eq(userHomeDocuments.homeId, homeId)).limit(500),
    }),
    runDashboardSection({
      section: "maintenance_schedules",
      homeId,
      userId,
      warnings,
      fallback: [] as any[],
      run: () =>
        db
          .select()
          .from(homeMaintenanceSchedules)
          .where(
            and(
              eq(homeMaintenanceSchedules.userHomeId, homeId),
              eq(homeMaintenanceSchedules.ownerUserId, userId)
            )
          )
          .limit(500),
    }),
    runDashboardSection({
      section: "report_shares",
      homeId,
      userId,
      warnings,
      fallback: [] as any[],
      run: () =>
        db
          .select()
          .from(homeReportShares)
          .where(
            and(eq(homeReportShares.userHomeId, homeId), eq(homeReportShares.ownerUserId, userId))
          )
          .limit(500),
    }),
  ]);

  const homeType = (String((home as any).propertyType || "other").trim() ||
    "other") as (typeof HOME_TYPES)[number];
  const requiredCoreFacts = HOMEID_CORE_REQUIREMENTS[homeType] || HOMEID_CORE_REQUIREMENTS.other;
  const authorityRecords = records
    .filter((r: any) => String(r.title || "").trim() === "homeid:authority")
    .map((r: any) => parseJsonObjectSafe(r.details))
    .filter(Boolean) as Array<Record<string, any>>;

  const identityComplete = Boolean(
    (home as any).address1 &&
    (home as any).city &&
    (home as any).stateCode &&
    (home as any).countyFips &&
    (home as any).zipCode &&
    (home as any).propertyType &&
    (home as any).yearBuilt
  );
  const authorityComplete = authorityRecords.some((a) => a.status === "active");
  const coreFactsComplete = requiredCoreFacts.every((fact) =>
    records.some((r: any) => {
      const text =
        `${String(r.title || "")} ${String(r.details || "")} ${(Array.isArray(r.tags) ? r.tags : []).join(" ")}`.toLowerCase();
      return text.includes(String(fact).toLowerCase());
    })
  );
  const systemsComplete = appliances.length > 0;
  const maintenanceComplete =
    schedules.length > 0 || records.some((r: any) => r.recordType === "maintenance");
  const evidenceComplete = documents.length > 0;
  const visibilityComplete = shares.length > 0;
  const transferComplete = records.some((r: any) => {
    const title = String(r.title || "").toLowerCase();
    const details = String(r.details || "").toLowerCase();
    return (
      title.includes("handoff") || title.includes("transfer") || details.includes("handoff_ready")
    );
  });

  const sections = {
    identity: { complete: identityComplete, weight: 15 },
    authority: { complete: authorityComplete, weight: 15 },
    coreFacts: { complete: coreFactsComplete, weight: 15 },
    systems: { complete: systemsComplete, weight: 15 },
    maintenance: { complete: maintenanceComplete, weight: 10 },
    evidence: { complete: evidenceComplete, weight: 10 },
    visibility: { complete: visibilityComplete, weight: 10 },
    transfer: { complete: transferComplete, weight: 10 },
  };

  const completionScore = Object.values(sections).reduce(
    (sum, section) => sum + (section.complete ? section.weight : 0),
    0
  );
  const completionState = completionStateFromScore(completionScore);
  const missingHints: string[] = [];
  if (!identityComplete) missingHints.push("identity and address");
  if (!authorityComplete) missingHints.push("authority and claim status");
  if (!coreFactsComplete) missingHints.push("home-type core facts");
  if (!systemsComplete) missingHints.push("systems and appliance details");
  if (!maintenanceComplete) missingHints.push("maintenance history");
  if (!evidenceComplete) missingHints.push("documents and evidence");
  if (!visibilityComplete) missingHints.push("visibility and sharing settings");
  if (!transferComplete) missingHints.push("transfer and handoff readiness");

  const persona = (String(req.query.persona || "homeowner").trim() || "homeowner") as
    | "homeowner"
    | "realtor"
    | "builder"
    | "property_manager"
    | "admin"
    | "other";

  const requestPrompts = missingHints.slice(0, 6).map((reason) => ({
    promptType:
      reason.includes("maintenance") || reason.includes("history")
        ? "request_service"
        : reason.includes("documents")
          ? "upload_evidence"
          : "add_record",
    reason,
    suggestedIntent: reason.includes("maintenance")
      ? "maintain"
      : reason.includes("core facts")
        ? "inspect"
        : "document",
  }));

  const buyerPacketReadiness = visibilityComplete && transferComplete && evidenceComplete;
  const handoffReady = completionScore >= 95 && authorityComplete;

  console.info("[homeid-dashboard] completed", {
    homeId,
    userId,
    totalElapsedMs: Date.now() - dashboardStarted,
    warningsCount: warnings.length,
  });

  res.json({
    homeId,
    homeType,
    completionScore,
    completionState,
    sections,
    requiredCoreFacts,
    authority: authorityRecords,
    requestPrompts,
    buyerPacketReadiness,
    handoffReady,
    personaMessage: personaMessage({
      score: completionScore,
      state: completionState,
      persona,
      missingHints,
    }),
    overview: {
      homeType,
      claimAuthorityStatus: authorityComplete ? "active" : "missing",
      lastUpdatedAt: (home as any).updatedAt,
      nextMaintenanceDue:
        schedules
          .map((s: any) => s.nextDueAt)
          .filter(Boolean)
          .sort((a: any, b: any) => new Date(a).getTime() - new Date(b).getTime())[0] || null,
      openFindingsCount: records.filter((r: any) => {
        const t = String(r.title || "").toLowerCase();
        return t.includes("finding") || t.includes("remediation");
      }).length,
      recentEvents: records.slice(0, 5).map((r: any) => ({
        id: r.id,
        recordType: r.recordType,
        title: r.title,
        createdAt: r.createdAt,
      })),
      linkedRequestShares: shares.length,
    },
    warnings,
  });
});

router.post("/api/homes/:homeId/homeid-authority", isAuthenticated, async (req: any, res) => {
  const userId = getUserId(req);
  if (!userId) return res.status(401).json({ message: "Authentication required" });
  const homeId = String(req.params.homeId || "").trim();
  if (!homeId) return res.status(400).json({ message: "homeId required" });
  const home = await requireHomeOwner(userId, homeId);
  if (!home) return res.status(404).json({ message: "Home not found" });

  const body = addHomeIdAuthoritySchema.parse(req.body ?? {});
  const payload = {
    subjectId: body.subjectId,
    role: body.role,
    status: body.status,
    endedAt: body.endedAt || null,
    note: body.note || null,
    changedAt: new Date().toISOString(),
  };

  const [record] = await db
    .insert(userHomeRecords)
    .values({
      homeId,
      createdByUserId: userId,
      recordType: "note",
      title: "homeid:authority",
      details: JSON.stringify(payload),
      tags: ["homeid", "authority"],
      updatedAt: new Date(),
    } as any)
    .returning();
  await db.update(userHomes).set({ updatedAt: new Date() }).where(eq(userHomes.id, homeId));

  res.status(201).json({ authority: payload, recordId: record?.id || null });
});

router.post("/api/homes/:homeId/homeid/request-packet", isAuthenticated, async (req: any, res) => {
  const userId = getUserId(req);
  if (!userId) return res.status(401).json({ message: "Authentication required" });
  const homeId = String(req.params.homeId || "").trim();
  if (!homeId) return res.status(400).json({ message: "homeId required" });
  const home = await requireHomeOwner(userId, homeId);
  if (!home) return res.status(404).json({ message: "Home not found" });

  const body = createRequestPacketSchema.parse(req.body ?? {});
  const sanitizedFields = Array.from(
    new Set(body.selectedFields.map((v) => v.trim()).filter(Boolean))
  );

  const packet = {
    requestType: body.requestType,
    selectedFields: sanitizedFields,
    createdAt: new Date().toISOString(),
    createdByUserId: userId,
  };

  const [record] = await db
    .insert(userHomeRecords)
    .values({
      homeId,
      createdByUserId: userId,
      recordType: "note",
      title: "homeid:request_packet",
      details: JSON.stringify(packet),
      tags: ["homeid", "request_packet"],
      updatedAt: new Date(),
    } as any)
    .returning();

  await db.update(userHomes).set({ updatedAt: new Date() }).where(eq(userHomes.id, homeId));
  res.status(201).json({ packet, recordId: record?.id || null });
});

router.post(
  "/api/homes/:homeId/homeid/request-evidence-proposal",
  isAuthenticated,
  async (req: any, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Authentication required" });
    const homeId = String(req.params.homeId || "").trim();
    if (!homeId) return res.status(400).json({ message: "homeId required" });
    const home = await requireHomeOwner(userId, homeId);
    if (!home) return res.status(404).json({ message: "Home not found" });

    const body = proposeRequestEvidenceSchema.parse(req.body ?? {});
    const [proposalRecord] = await db
      .insert(userHomeRecords)
      .values({
        homeId,
        createdByUserId: userId,
        recordType: "maintenance",
        title: body.title,
        details: JSON.stringify({
          requestId: body.requestId,
          verificationStatus: "proposed",
          details: body.details || null,
          proposedAt: new Date().toISOString(),
        }),
        tags: ["homeid", "request_completed", "evidence_proposed"],
        updatedAt: new Date(),
      } as any)
      .returning();

    let document: any = null;
    if (body.objectKey) {
      const [createdDoc] = await db
        .insert(userHomeDocuments)
        .values({
          homeId,
          recordId: proposalRecord?.id || null,
          uploadedByUserId: userId,
          documentType: body.documentType || "other",
          objectKey: body.objectKey,
          originalName: body.originalName || null,
        } as any)
        .returning();
      document = createdDoc ?? null;
    }

    await db.update(userHomes).set({ updatedAt: new Date() }).where(eq(userHomes.id, homeId));
    res.status(201).json({
      proposal: {
        homeId,
        requestId: body.requestId,
        verificationStatus: "proposed",
        recordId: proposalRecord?.id || null,
      },
      document,
    });
  }
);

router.get("/api/homes/:homeId/maintenance-schedules", isAuthenticated, async (req: any, res) => {
  const userId = getUserId(req);
  if (!userId) return res.status(401).json({ message: "Authentication required" });

  const homeId = String(req.params.homeId || "").trim();
  if (!homeId) return res.status(400).json({ message: "homeId required" });

  const home = await requireHomeOwner(userId, homeId);
  if (!home) return res.status(404).json({ message: "Home not found" });

  const rows = await db
    .select({
      schedule: homeMaintenanceSchedules,
      businessName: businesses.name,
      businessSlug: businesses.slug,
    })
    .from(homeMaintenanceSchedules)
    .leftJoin(businesses, eq(businesses.id, homeMaintenanceSchedules.assignedBusinessId))
    .where(
      and(
        eq(homeMaintenanceSchedules.userHomeId, homeId),
        eq(homeMaintenanceSchedules.ownerUserId, userId)
      )
    )
    .orderBy(desc(homeMaintenanceSchedules.updatedAt))
    .limit(200);

  res.json({
    schedules: rows.map((row) => ({
      ...row.schedule,
      assignedBusiness: row.businessSlug
        ? { name: row.businessName, slug: row.businessSlug }
        : null,
    })),
  });
});

// ---------------------------------------------------------------------------
// Home Projects (Home Vault)
// ---------------------------------------------------------------------------

router.get("/api/homes/:homeId/projects", isAuthenticated, async (req: any, res) => {
  const userId = getUserId(req);
  if (!userId) return res.status(401).json({ message: "Authentication required" });

  const homeId = String(req.params.homeId || "").trim();
  if (!homeId) return res.status(400).json({ message: "homeId required" });

  const home = await requireHomeOwner(userId, homeId);
  if (!home) return res.status(404).json({ message: "Home not found" });

  const projects = await db
    .select()
    .from(homeProjects)
    .where(and(eq(homeProjects.userHomeId, homeId), eq(homeProjects.ownerUserId, userId)))
    .orderBy(desc(homeProjects.updatedAt))
    .limit(200);

  const projectIds = projects.map((p) => String((p as any).id)).filter(Boolean);
  const plans = projectIds.length
    ? await db
        .select()
        .from(homeProjectPlans)
        .where(
          and(
            eq(homeProjectPlans.ownerUserId, userId),
            inArray(homeProjectPlans.homeProjectId, projectIds)
          )
        )
        .orderBy(desc(homeProjectPlans.updatedAt))
    : [];

  const plansByProject = new Map<string, any>();
  for (const plan of plans) {
    const pid = String((plan as any).homeProjectId || "");
    if (pid && !plansByProject.has(pid)) plansByProject.set(pid, plan);
  }

  res.json({
    projects: projects.map((p: any) => ({ ...p, plan: plansByProject.get(String(p.id)) || null })),
  });
});

router.post("/api/homes/:homeId/projects", isAuthenticated, async (req: any, res) => {
  const userId = getUserId(req);
  if (!userId) return res.status(401).json({ message: "Authentication required" });

  const homeId = String(req.params.homeId || "").trim();
  if (!homeId) return res.status(400).json({ message: "homeId required" });

  const home = await requireHomeOwner(userId, homeId);
  if (!home) return res.status(404).json({ message: "Home not found" });

  const body = createHomeProjectSchema.parse(req.body ?? {});

  const desiredStartAt = parseYmdOrNull(body.desiredStartAt);
  const targetBy = parseYmdOrNull(body.targetBy);

  const hasBudgetNow = body.hasBudgetNow === true;
  const estimatedCost = body.estimatedCost != null ? Number(body.estimatedCost) : null;

  const status: any = hasBudgetNow ? "planning" : "saving";

  const [createdProject] = await db
    .insert(homeProjects)
    .values({
      ownerUserId: userId,
      userHomeId: homeId,
      title: body.title,
      description: body.description || null,
      projectType: body.projectType || null,
      status,
      estimatedCost: estimatedCost != null ? String(estimatedCost) : null,
      desiredStartAt,
      metadata: {},
      updatedAt: new Date(),
    } as any)
    .returning();

  if (!createdProject) return res.status(500).json({ message: "Failed to create project" });

  let createdPlan: any = null;

  if (!hasBudgetNow && estimatedCost != null && estimatedCost > 0) {
    let monthlyContribution: number | null = null;

    if (body.monthlySavings != null && Number(body.monthlySavings) > 0) {
      monthlyContribution = Number(body.monthlySavings);
    } else {
      const targetDate = targetBy
        ? dateToNoonUtc(targetBy)
        : desiredStartAt
          ? dateToNoonUtc(desiredStartAt)
          : null;
      if (targetDate) {
        const months = monthsBetweenInclusive(new Date(), targetDate);
        monthlyContribution = Math.ceil((estimatedCost / months) * 100) / 100;
      }
    }

    const [plan] = await db
      .insert(homeProjectPlans)
      .values({
        ownerUserId: userId,
        homeProjectId: String((createdProject as any).id),
        planType: (body.fundingSources && body.fundingSources.length
          ? "funding"
          : "savings") as any,
        targetAmount: String(estimatedCost),
        currentSaved: "0",
        targetBy: targetBy || null,
        monthlyContribution: monthlyContribution != null ? String(monthlyContribution) : null,
        fundingSources: body.fundingSources ?? [],
        notes: body.planNotes || null,
        updatedAt: new Date(),
      } as any)
      .returning();

    createdPlan = plan ?? null;
  }

  await db.update(userHomes).set({ updatedAt: new Date() }).where(eq(userHomes.id, homeId));

  try {
    const propertyProgramIds = await getLinkedPropertyProgramIdsForHome(homeId);
    for (const propertyProgramId of propertyProgramIds) {
      await addPropertyLifecycleEvent({
        propertyProgramId,
        actionType: "home_project_created",
        phase: "plan",
        title: body.title,
        description: body.description || null,
        occurredAt: new Date(),
        source: "user",
        status: hasBudgetNow ? "planned" : "blocked",
        costAmount: estimatedCost,
        metadata: {
          homeId,
          homeProjectId: createdProject.id,
          projectType: body.projectType || null,
          desiredStartAt,
          hasBudgetNow,
          plan: createdPlan ? { id: createdPlan.id, planType: createdPlan.planType } : null,
        },
        createdByUserId: userId,
        sourceSurface: "home_vault",
        idempotencyKey: `home:${homeId}:project:${createdProject.id}:created`,
      });
    }
  } catch (err) {
    console.error("[homes] Failed to sync project creation into property program:", err);
  }

  res.status(201).json({ project: createdProject, plan: createdPlan });
});

router.put("/api/homes/:homeId/projects/:projectId", isAuthenticated, async (req: any, res) => {
  const userId = getUserId(req);
  if (!userId) return res.status(401).json({ message: "Authentication required" });

  const homeId = String(req.params.homeId || "").trim();
  const projectId = String(req.params.projectId || "").trim();
  if (!homeId) return res.status(400).json({ message: "homeId required" });
  if (!projectId) return res.status(400).json({ message: "projectId required" });

  const home = await requireHomeOwner(userId, homeId);
  if (!home) return res.status(404).json({ message: "Home not found" });

  const updates = updateHomeProjectSchema.parse(req.body ?? {});
  const desiredStartAt = parseYmdOrNull(updates.desiredStartAt);

  const patch: any = {
    updatedAt: new Date(),
  };
  if (updates.title !== undefined) patch.title = updates.title;
  if (updates.description !== undefined) patch.description = updates.description || null;
  if (updates.projectType !== undefined) patch.projectType = updates.projectType || null;
  if (updates.status !== undefined) patch.status = updates.status;
  if (updates.estimatedCost !== undefined)
    patch.estimatedCost = updates.estimatedCost != null ? String(updates.estimatedCost) : null;
  if (updates.desiredStartAt !== undefined) patch.desiredStartAt = desiredStartAt;

  const rows = await db
    .update(homeProjects)
    .set(patch)
    .where(
      and(
        eq(homeProjects.id, projectId),
        eq(homeProjects.userHomeId, homeId),
        eq(homeProjects.ownerUserId, userId)
      )
    )
    .returning();

  const updated = rows[0];
  if (!updated) return res.status(404).json({ message: "Project not found" });

  await db.update(userHomes).set({ updatedAt: new Date() }).where(eq(userHomes.id, homeId));
  res.json({ project: updated });
});

router.post(
  "/api/homes/:homeId/projects/:projectId/plan",
  isAuthenticated,
  async (req: any, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Authentication required" });

    const homeId = String(req.params.homeId || "").trim();
    const projectId = String(req.params.projectId || "").trim();
    if (!homeId) return res.status(400).json({ message: "homeId required" });
    if (!projectId) return res.status(400).json({ message: "projectId required" });

    const home = await requireHomeOwner(userId, homeId);
    if (!home) return res.status(404).json({ message: "Home not found" });

    const [project] = await db
      .select()
      .from(homeProjects)
      .where(
        and(
          eq(homeProjects.id, projectId),
          eq(homeProjects.userHomeId, homeId),
          eq(homeProjects.ownerUserId, userId)
        )
      )
      .limit(1);
    if (!project) return res.status(404).json({ message: "Project not found" });

    const body = upsertHomeProjectPlanSchema.parse(req.body ?? {});
    const targetBy = parseYmdOrNull(body.targetBy);

    const [existing] = await db
      .select()
      .from(homeProjectPlans)
      .where(
        and(eq(homeProjectPlans.homeProjectId, projectId), eq(homeProjectPlans.ownerUserId, userId))
      )
      .orderBy(desc(homeProjectPlans.updatedAt))
      .limit(1);

    const values: any = {
      ownerUserId: userId,
      homeProjectId: projectId,
      planType: body.planType || (existing as any)?.planType || "savings",
      targetAmount: String(body.targetAmount),
      currentSaved:
        body.currentSaved != null
          ? String(body.currentSaved)
          : (existing as any)?.currentSaved || "0",
      targetBy: targetBy || null,
      monthlyContribution:
        body.monthlyContribution != null
          ? String(body.monthlyContribution)
          : (existing as any)?.monthlyContribution || null,
      fundingSources: body.fundingSources ?? (existing as any)?.fundingSources ?? [],
      notes: body.notes ?? (existing as any)?.notes ?? null,
      updatedAt: new Date(),
    };

    let saved: any = null;
    if (existing?.id) {
      const [row] = await db
        .update(homeProjectPlans)
        .set(values)
        .where(eq(homeProjectPlans.id, (existing as any).id))
        .returning();
      saved = row ?? null;
    } else {
      const [row] = await db.insert(homeProjectPlans).values(values).returning();
      saved = row ?? null;
    }

    await db.update(userHomes).set({ updatedAt: new Date() }).where(eq(userHomes.id, homeId));

    res.status(201).json({ plan: saved });
  }
);

router.post("/api/homes/:homeId/maintenance-schedules", isAuthenticated, async (req: any, res) => {
  const userId = getUserId(req);
  if (!userId) return res.status(401).json({ message: "Authentication required" });

  const homeId = String(req.params.homeId || "").trim();
  if (!homeId) return res.status(400).json({ message: "homeId required" });

  const home = await requireHomeOwner(userId, homeId);
  if (!home) return res.status(404).json({ message: "Home not found" });

  const body = createMaintenanceScheduleSchema.parse(req.body ?? {});
  const nextDueAt = parseIsoDateOrNull(body.nextDueAt) || addDays(new Date(), body.cadenceDays);

  let assignedBusinessId: string | null = null;
  if (body.assignedBusinessSlug) {
    const [biz] = await db
      .select({ id: businesses.id })
      .from(businesses)
      .where(
        and(eq(businesses.slug, body.assignedBusinessSlug), eq(businesses.status, "active" as any))
      )
      .limit(1);
    assignedBusinessId = biz?.id ?? null;
  }

  const [created] = await db
    .insert(homeMaintenanceSchedules)
    .values({
      ownerUserId: userId,
      userHomeId: homeId,
      title: body.title,
      description: body.description || null,
      category: body.category || null,
      cadenceDays: body.cadenceDays,
      nextDueAt,
      status: "active",
      assignedBusinessId,
      shareWithAssignedProvider: body.shareWithAssignedProvider === true,
      shareAddress: body.shareAddress === true,
      metadata: {},
      updatedAt: new Date(),
    } as any)
    .returning();

  await db.update(userHomes).set({ updatedAt: new Date() }).where(eq(userHomes.id, homeId));

  // Optional: log schedule creation to any linked property programs.
  try {
    const propertyProgramIds = await getLinkedPropertyProgramIdsForHome(homeId);
    for (const propertyProgramId of propertyProgramIds) {
      await addPropertyLifecycleEvent({
        propertyProgramId,
        actionType: "maintenance_schedule_created",
        phase: "operate",
        title: `Maintenance scheduled: ${body.title}`,
        description: body.description || null,
        occurredAt: new Date(),
        source: "user",
        status: "done",
        metadata: {
          homeId,
          maintenanceScheduleId: created?.id ?? null,
          cadenceDays: body.cadenceDays,
          nextDueAt: nextDueAt.toISOString(),
        },
        createdByUserId: userId,
        sourceSurface: "home_vault",
        idempotencyKey: `home:${homeId}:maint_sched:create:${created?.id ?? "missing"}`,
      });
    }
  } catch (err) {
    console.error("[homes] Failed to sync maintenance schedule create into property program:", err);
  }

  res.status(201).json({ schedule: created });
});

router.patch(
  "/api/homes/:homeId/maintenance-schedules/:scheduleId",
  isAuthenticated,
  async (req: any, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Authentication required" });

    const homeId = String(req.params.homeId || "").trim();
    const scheduleId = String(req.params.scheduleId || "").trim();
    if (!homeId) return res.status(400).json({ message: "homeId required" });
    if (!scheduleId) return res.status(400).json({ message: "scheduleId required" });

    const home = await requireHomeOwner(userId, homeId);
    if (!home) return res.status(404).json({ message: "Home not found" });

    const body = updateMaintenanceScheduleSchema.parse(req.body ?? {});
    const nextDueAt = body.nextDueAt ? parseIsoDateOrNull(body.nextDueAt) : null;
    if (body.nextDueAt && !nextDueAt) {
      return res.status(400).json({ message: "nextDueAt must be a valid ISO date" });
    }

    let assignedBusinessId: string | null | undefined = undefined;
    if (body.assignedBusinessSlug != null) {
      if (!body.assignedBusinessSlug) {
        assignedBusinessId = null;
      } else {
        const [biz] = await db
          .select({ id: businesses.id })
          .from(businesses)
          .where(
            and(
              eq(businesses.slug, body.assignedBusinessSlug),
              eq(businesses.status, "active" as any)
            )
          )
          .limit(1);
        assignedBusinessId = biz?.id ?? null;
      }
    }

    const rows = await db
      .update(homeMaintenanceSchedules)
      .set({
        ...(body.title != null ? { title: body.title } : {}),
        ...(body.description != null ? { description: body.description || null } : {}),
        ...(body.category != null ? { category: body.category || null } : {}),
        ...(body.cadenceDays != null ? { cadenceDays: body.cadenceDays } : {}),
        ...(nextDueAt ? { nextDueAt } : {}),
        ...(body.status != null ? { status: body.status } : {}),
        ...(assignedBusinessId !== undefined ? { assignedBusinessId } : {}),
        ...(body.shareWithAssignedProvider != null
          ? { shareWithAssignedProvider: body.shareWithAssignedProvider === true }
          : {}),
        ...(body.shareAddress != null ? { shareAddress: body.shareAddress === true } : {}),
        updatedAt: new Date(),
      } as any)
      .where(
        and(
          eq(homeMaintenanceSchedules.id, scheduleId),
          eq(homeMaintenanceSchedules.userHomeId, homeId),
          eq(homeMaintenanceSchedules.ownerUserId, userId)
        )
      )
      .returning();

    const updated = rows[0];
    if (!updated) return res.status(404).json({ message: "Schedule not found" });

    await db.update(userHomes).set({ updatedAt: new Date() }).where(eq(userHomes.id, homeId));
    res.json({ schedule: updated });
  }
);

router.post(
  "/api/homes/:homeId/maintenance-schedules/:scheduleId/complete",
  isAuthenticated,
  async (req: any, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Authentication required" });

    const homeId = String(req.params.homeId || "").trim();
    const scheduleId = String(req.params.scheduleId || "").trim();
    if (!homeId) return res.status(400).json({ message: "homeId required" });
    if (!scheduleId) return res.status(400).json({ message: "scheduleId required" });

    const home = await requireHomeOwner(userId, homeId);
    if (!home) return res.status(404).json({ message: "Home not found" });

    const body = completeMaintenanceScheduleSchema.parse(req.body ?? {});
    const occurredAt =
      body.occurredAt && /^\d{4}-\d{2}-\d{2}$/.test(body.occurredAt) ? body.occurredAt : null;

    const [schedule] = await db
      .select()
      .from(homeMaintenanceSchedules)
      .where(
        and(
          eq(homeMaintenanceSchedules.id, scheduleId),
          eq(homeMaintenanceSchedules.userHomeId, homeId),
          eq(homeMaintenanceSchedules.ownerUserId, userId)
        )
      )
      .limit(1);
    if (!schedule) return res.status(404).json({ message: "Schedule not found" });

    const completedAt = occurredAt ? dateToNoonUtc(occurredAt) : new Date();
    const nextDueAt = addDays(completedAt, Number(schedule.cadenceDays || 30));

    const [record] = await db
      .insert(userHomeRecords)
      .values({
        homeId,
        createdByUserId: userId,
        recordType: "maintenance",
        occurredAt,
        title: `Maintenance: ${schedule.title}`,
        details: body.notes || null,
        cost: body.cost != null ? String(body.cost) : null,
        tags: ["scheduled"],
        updatedAt: new Date(),
      } as any)
      .returning();

    const [updated] = await db
      .update(homeMaintenanceSchedules)
      .set({
        lastCompletedAt: completedAt,
        nextDueAt,
        updatedAt: new Date(),
      } as any)
      .where(eq(homeMaintenanceSchedules.id, scheduleId))
      .returning();

    await db.update(userHomes).set({ updatedAt: new Date() }).where(eq(userHomes.id, homeId));

    try {
      const propertyProgramIds = await getLinkedPropertyProgramIdsForHome(homeId);
      for (const propertyProgramId of propertyProgramIds) {
        await addPropertyLifecycleEvent({
          propertyProgramId,
          actionType: "home_record_maintenance",
          phase: "operate",
          title: `Maintenance: ${schedule.title}`,
          description: body.notes || null,
          occurredAt: completedAt,
          source: "user",
          status: "done",
          costAmount: body.cost ?? null,
          metadata: {
            homeId,
            homeRecordId: record?.id ?? null,
            maintenanceScheduleId: schedule.id,
            nextDueAt: nextDueAt.toISOString(),
            tags: ["scheduled"],
          },
          createdByUserId: userId,
          sourceSurface: "home_vault",
          idempotencyKey: `home:${homeId}:record:${record?.id ?? "missing"}`,
        });
      }
    } catch (err) {
      console.error("[homes] Failed to sync maintenance completion into property program:", err);
    }

    res.status(201).json({ schedule: updated, record });
  }
);

router.post("/api/homes/:homeId/records", isAuthenticated, async (req: any, res) => {
  const userId = getUserId(req);
  if (!userId) return res.status(401).json({ message: "Authentication required" });

  const homeId = String(req.params.homeId || "").trim();
  if (!homeId) return res.status(400).json({ message: "homeId required" });

  const home = await requireHomeOwner(userId, homeId);
  if (!home) return res.status(404).json({ message: "Home not found" });

  const body = createRecordSchema.parse(req.body ?? {});
  const occurredAt =
    body.occurredAt && /^\d{4}-\d{2}-\d{2}$/.test(body.occurredAt) ? body.occurredAt : null;

  const [created] = await db
    .insert(userHomeRecords)
    .values({
      homeId,
      createdByUserId: userId,
      recordType: body.recordType,
      occurredAt,
      title: body.title,
      details: body.details || null,
      cost: body.cost != null ? String(body.cost) : null,
      tags: body.tags ?? [],
      updatedAt: new Date(),
    })
    .returning();

  await db.update(userHomes).set({ updatedAt: new Date() }).where(eq(userHomes.id, homeId));

  // Auto-sync Home Vault action into any linked Property Program(s) so Scout + lifecycle
  // surfaces stay current without manual duplication.
  try {
    const propertyProgramIds = await getLinkedPropertyProgramIdsForHome(homeId);
    for (const propertyProgramId of propertyProgramIds) {
      await addPropertyLifecycleEvent({
        propertyProgramId,
        actionType: `home_record_${body.recordType}`,
        phase: "operate",
        title: body.title,
        description: body.details || null,
        occurredAt: occurredAt ? dateToNoonUtc(occurredAt) : new Date(),
        source: "user",
        status: "done",
        costAmount: body.cost ?? null,
        metadata: {
          homeId,
          homeRecordId: created?.id ?? null,
          tags: body.tags ?? [],
        },
        createdByUserId: userId,
        sourceSurface: "home_vault",
        idempotencyKey: `home:${homeId}:record:${created?.id ?? "missing"}`,
      });
    }
  } catch (err) {
    console.error("[homes] Failed to sync record into property program:", err);
  }

  res.status(201).json({ record: created });
});

router.post("/api/homes/:homeId/appliances", isAuthenticated, async (req: any, res) => {
  const userId = getUserId(req);
  if (!userId) return res.status(401).json({ message: "Authentication required" });

  const homeId = String(req.params.homeId || "").trim();
  if (!homeId) return res.status(400).json({ message: "homeId required" });

  const home = await requireHomeOwner(userId, homeId);
  if (!home) return res.status(404).json({ message: "Home not found" });

  const body = createApplianceSchema.parse(req.body ?? {});
  const installedAt =
    body.installedAt && /^\d{4}-\d{2}-\d{2}$/.test(body.installedAt) ? body.installedAt : null;

  const [created] = await db
    .insert(userHomeAppliances)
    .values({
      homeId,
      createdByUserId: userId,
      category: body.category,
      brand: body.brand || null,
      model: body.model || null,
      serial: body.serial || null,
      installedAt,
      notes: body.notes || null,
      updatedAt: new Date(),
    })
    .returning();

  await db.update(userHomes).set({ updatedAt: new Date() }).where(eq(userHomes.id, homeId));

  try {
    const propertyProgramIds = await getLinkedPropertyProgramIdsForHome(homeId);
    const label = [body.category, body.brand, body.model].filter(Boolean).join(" ").trim();
    for (const propertyProgramId of propertyProgramIds) {
      await addPropertyLifecycleEvent({
        propertyProgramId,
        actionType: "home_appliance_added",
        phase: "operate",
        title: label ? `Appliance added: ${label}` : `Appliance added: ${body.category}`,
        description: body.notes || null,
        occurredAt: installedAt ? dateToNoonUtc(installedAt) : new Date(),
        source: "user",
        status: "done",
        metadata: {
          homeId,
          applianceId: created?.id ?? null,
          category: body.category,
        },
        createdByUserId: userId,
        sourceSurface: "home_vault",
        idempotencyKey: `home:${homeId}:appliance:${created?.id ?? "missing"}`,
      });
    }
  } catch (err) {
    console.error("[homes] Failed to sync appliance into property program:", err);
  }

  res.status(201).json({ appliance: created });
});

router.post("/api/homes/:homeId/documents", isAuthenticated, async (req: any, res) => {
  const userId = getUserId(req);
  if (!userId) return res.status(401).json({ message: "Authentication required" });

  const homeId = String(req.params.homeId || "").trim();
  if (!homeId) return res.status(400).json({ message: "homeId required" });

  const home = await requireHomeOwner(userId, homeId);
  if (!home) return res.status(404).json({ message: "Home not found" });

  const body = addDocumentSchema.parse(req.body ?? {});

  // Optional recordId must belong to the same home.
  let recordId: string | null = null;
  if (body.recordId) {
    const [record] = await db
      .select({ id: userHomeRecords.id })
      .from(userHomeRecords)
      .where(and(eq(userHomeRecords.id, body.recordId), eq(userHomeRecords.homeId, homeId)))
      .limit(1);
    if (!record) {
      return res.status(400).json({ message: "Invalid recordId for home" });
    }
    recordId = body.recordId;
  }

  const [created] = await db
    .insert(userHomeDocuments)
    .values({
      homeId,
      recordId,
      uploadedByUserId: userId,
      documentType: body.documentType || "other",
      objectKey: body.objectKey,
      originalName: body.originalName || null,
      contentType: body.contentType || null,
      bytes: body.bytes ?? null,
    })
    .returning();

  await db.update(userHomes).set({ updatedAt: new Date() }).where(eq(userHomes.id, homeId));

  try {
    const propertyProgramIds = await getLinkedPropertyProgramIdsForHome(homeId);
    for (const propertyProgramId of propertyProgramIds) {
      await addPropertyLifecycleEvent({
        propertyProgramId,
        actionType: "home_document_added",
        phase: "operate",
        title: `Document added: ${body.documentType || "other"}`,
        description: body.originalName || null,
        occurredAt: new Date(),
        source: "user",
        status: "done",
        metadata: {
          homeId,
          homeRecordId: recordId,
          homeDocumentId: created?.id ?? null,
          documentType: body.documentType || "other",
          objectKey: body.objectKey,
        },
        createdByUserId: userId,
        sourceSurface: "home_vault",
        idempotencyKey: `home:${homeId}:document:${created?.id ?? "missing"}`,
      });
    }
  } catch (err) {
    console.error("[homes] Failed to sync document into property program:", err);
  }

  res.status(201).json({ document: created });
});

router.get(
  "/api/homes/:homeId/documents/:docId/download",
  isAuthenticated,
  async (req: any, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Authentication required" });

    const homeId = String(req.params.homeId || "").trim();
    const docId = String(req.params.docId || "").trim();
    if (!homeId || !docId) return res.status(400).json({ message: "homeId and docId required" });

    const home = await requireHomeOwner(userId, homeId);
    if (!home) return res.status(404).json({ message: "Home not found" });

    const [doc] = await db
      .select()
      .from(userHomeDocuments)
      .where(and(eq(userHomeDocuments.id, docId), eq(userHomeDocuments.homeId, homeId)))
      .limit(1);
    if (!doc) return res.status(404).json({ message: "Document not found" });

    const objectKey = String((doc as any).objectKey || "");
    if (!objectKey) return res.status(400).json({ message: "Document is missing objectKey" });

    // If the key is already a URL (legacy/dev), redirect directly.
    if (/^https?:\/\//i.test(objectKey)) {
      return res.redirect(302, objectKey);
    }

    const useR2 = Boolean(process.env.R2_BUCKET_NAME && process.env.R2_ACCESS_KEY_ID);

    if (useR2) {
      try {
        const { R2StorageService } = await import("../localStorage");
        const storageService = new R2StorageService();
        const url = await storageService.getDownloadURL(objectKey, {
          filename: typeof (doc as any).originalName === "string" ? (doc as any).originalName : "",
        });
        return res.redirect(302, url);
      } catch (err) {
        console.error("[homes] Failed to sign download URL:", err);
        return res.status(500).json({ message: "Failed to download file" });
      }
    }

    try {
      const { LocalStorageService } = await import("../localStorage");
      const storageService = new LocalStorageService();
      const filePath = await storageService.getPrivateFilePathFromObjectKey(objectKey);
      if (!filePath) return res.status(404).json({ message: "File not found" });

      const filename =
        typeof (doc as any).originalName === "string" && (doc as any).originalName.trim()
          ? (doc as any).originalName.trim()
          : "document";

      return res.download(filePath, filename);
    } catch (err) {
      console.error("[homes] Failed to download private file:", err);
      return res.status(500).json({ message: "Failed to download file" });
    }
  }
);

router.get("/api/homes/:homeId/prefill-homescout", isAuthenticated, async (req: any, res) => {
  const userId = getUserId(req);
  if (!userId) return res.status(401).json({ message: "Authentication required" });

  const homeId = String(req.params.homeId || "").trim();
  if (!homeId) return res.status(400).json({ message: "homeId required" });

  const home = await requireHomeOwner(userId, homeId);
  if (!home) return res.status(404).json({ message: "Home not found" });

  const nickname = typeof (home as any).nickname === "string" ? (home as any).nickname.trim() : "";
  const propertyType =
    typeof (home as any).propertyType === "string" ? (home as any).propertyType.trim() : "";
  const city = typeof (home as any).city === "string" ? (home as any).city.trim() : "";
  const stateCode =
    typeof (home as any).stateCode === "string" ? (home as any).stateCode.trim() : "";
  const countyFips =
    typeof (home as any).countyFips === "string" ? (home as any).countyFips.trim() : "";
  const zipCode = typeof (home as any).zipCode === "string" ? (home as any).zipCode.trim() : "";
  const address1 = typeof (home as any).address1 === "string" ? (home as any).address1.trim() : "";
  const yearBuilt = (home as any).yearBuilt != null ? Number((home as any).yearBuilt) : null;

  const titleBase =
    nickname ||
    (propertyType && city && stateCode
      ? `${propertyType} in ${city}, ${stateCode}`
      : city && stateCode
        ? `Home in ${city}, ${stateCode}`
        : "Home for sale");

  const title = titleBase.length >= 10 ? titleBase : `${titleBase} listing`;

  const descriptionLines: string[] = [];
  if (propertyType) descriptionLines.push(`Property type: ${propertyType}`);
  if (yearBuilt && Number.isFinite(yearBuilt)) descriptionLines.push(`Year built: ${yearBuilt}`);
  descriptionLines.push("");
  descriptionLines.push(
    "Records and inspection documents are tracked privately in TradeScout (Home Vault)."
  );

  return res.json({
    homeId,
    title,
    description: descriptionLines.join("\n").trim(),
    propertyType: propertyType || undefined,
    yearBuilt: yearBuilt && Number.isFinite(yearBuilt) ? yearBuilt : undefined,
    address: address1 || undefined,
    city: city || undefined,
    stateCode: stateCode || undefined,
    countyFips: countyFips || undefined,
    zipCode: zipCode || undefined,
  });
});

// Provider-side view: schedules explicitly shared with a provider's owned business listing(s).
// Intentionally minimal payload: no street address by default; homeowners control sharing.
router.get("/api/provider/maintenance-schedules", isAuthenticated, async (req: any, res) => {
  const userId = getUserId(req);
  if (!userId) return res.status(401).json({ message: "Authentication required" });

  const ownedBusinesses = await db
    .select({ id: businesses.id })
    .from(businesses)
    .where(and(eq(businesses.ownerUserId, userId), eq(businesses.status, "active" as any)))
    .limit(200);

  const ownedIds = ownedBusinesses.map((b) => String(b.id)).filter(Boolean);
  if (ownedIds.length === 0) return res.json({ schedules: [] });

  const results = await db
    .select({
      schedule: homeMaintenanceSchedules,
      homeNickname: userHomes.nickname,
      homeStateCode: userHomes.stateCode,
      homeCountyFips: userHomes.countyFips,
      assignedBusinessSlug: businesses.slug,
      assignedBusinessName: businesses.name,
    })
    .from(homeMaintenanceSchedules)
    .innerJoin(businesses, eq(businesses.id, homeMaintenanceSchedules.assignedBusinessId))
    .innerJoin(userHomes, eq(userHomes.id, homeMaintenanceSchedules.userHomeId))
    .where(
      and(
        inArray(homeMaintenanceSchedules.assignedBusinessId, ownedIds as any),
        eq(homeMaintenanceSchedules.shareWithAssignedProvider, true),
        eq(homeMaintenanceSchedules.status, "active")
      )
    )
    .orderBy(desc(homeMaintenanceSchedules.nextDueAt))
    .limit(500);

  return res.json({
    schedules: results.map((r) => ({
      ...r.schedule,
      home: {
        nickname: r.homeNickname || "Home",
        stateCode: r.homeStateCode,
        countyFips: r.homeCountyFips,
        shareAddress: (r.schedule as any).shareAddress === true,
      },
      assignedBusiness: {
        name: r.assignedBusinessName,
        slug: r.assignedBusinessSlug,
      },
    })),
  });
});

export const homesRouter = router;
