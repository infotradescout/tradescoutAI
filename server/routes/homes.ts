import { Router } from "express";
import { z } from "zod";
import { and, desc, eq } from "drizzle-orm";
import { isAuthenticated } from "../auth";
import { db } from "../db";
import {
  USER_HOME_DOCUMENT_TYPES,
  USER_HOME_RECORD_TYPES,
  propertyPrograms,
  userHomeAppliances,
  userHomeDocuments,
  userHomeRecords,
  userHomes,
} from "../../shared/schema";
import { addPropertyLifecycleEvent } from "../services/propertyLifecycleService";

const router = Router();

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

function getUserId(req: any): string {
  return String((req.user as any)?.claims?.sub || (req.user as any)?.id || "").trim();
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

export const homesRouter = router;
