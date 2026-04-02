import { Router } from "express";
import { z } from "zod";
import { and, desc, eq, ilike } from "drizzle-orm";
import { isAuthenticated } from "../auth";
import { db } from "../db";
import {
  USER_VEHICLE_DOCUMENT_TYPES,
  USER_VEHICLE_RECORD_TYPES,
  marketplaceCategories,
  userVehicleDocuments,
  userVehicleRecords,
  userVehicles,
} from "../../shared/schema";

const router = Router();

const createVehicleSchema = z.object({
  nickname: z.string().trim().min(1).max(160).optional(),
  year: z.number().int().min(1900).max(2100).optional(),
  make: z.string().trim().min(1).max(80).optional(),
  model: z.string().trim().min(1).max(120).optional(),
  trim: z.string().trim().max(120).optional(),
  vin: z.string().trim().max(32).optional(),
  mileage: z.number().int().nonnegative().optional(),
});

const createRecordSchema = z.object({
  recordType: z.enum(USER_VEHICLE_RECORD_TYPES),
  occurredAt: z.string().trim().optional(), // YYYY-MM-DD
  title: z.string().trim().min(2).max(220),
  details: z.string().trim().max(20_000).optional(),
  cost: z.number().finite().nonnegative().optional(),
  mileage: z.number().int().nonnegative().optional(),
  tags: z.array(z.string().trim().min(1).max(40)).max(24).optional(),
});

const addDocumentSchema = z.object({
  documentType: z.enum(USER_VEHICLE_DOCUMENT_TYPES).optional(),
  objectKey: z.string().trim().min(3).max(600),
  originalName: z.string().trim().max(260).optional(),
  contentType: z.string().trim().max(160).optional(),
  bytes: z.number().int().nonnegative().optional(),
  recordId: z.string().trim().optional(),
});

function getUserId(req: any): string {
  return String((req.user as any)?.claims?.sub || (req.user as any)?.id || "").trim();
}

async function requireVehicleOwner(userId: string, vehicleId: string) {
  const [vehicle] = await db
    .select()
    .from(userVehicles)
    .where(and(eq(userVehicles.id, vehicleId), eq(userVehicles.ownerUserId, userId)))
    .limit(1);
  return vehicle ?? null;
}

router.get("/api/vehicles", isAuthenticated, async (req: any, res) => {
  const userId = getUserId(req);
  if (!userId) return res.status(401).json({ message: "Authentication required" });

  const vehicles = await db
    .select()
    .from(userVehicles)
    .where(eq(userVehicles.ownerUserId, userId))
    .orderBy(desc(userVehicles.updatedAt))
    .limit(50);

  res.json({ vehicles });
});

router.post("/api/vehicles", isAuthenticated, async (req: any, res) => {
  const userId = getUserId(req);
  if (!userId) return res.status(401).json({ message: "Authentication required" });

  const body = createVehicleSchema.parse(req.body ?? {});
  const [created] = await db
    .insert(userVehicles)
    .values({
      ownerUserId: userId,
      nickname: body.nickname || null,
      year: body.year ?? null,
      make: body.make || null,
      model: body.model || null,
      trim: body.trim || null,
      vin: body.vin || null,
      mileage: body.mileage ?? null,
      updatedAt: new Date(),
    })
    .returning();

  res.status(201).json({ vehicle: created });
});

router.get("/api/vehicles/:vehicleId", isAuthenticated, async (req: any, res) => {
  const userId = getUserId(req);
  if (!userId) return res.status(401).json({ message: "Authentication required" });

  const vehicleId = String(req.params.vehicleId || "").trim();
  if (!vehicleId) return res.status(400).json({ message: "vehicleId required" });

  const vehicle = await requireVehicleOwner(userId, vehicleId);
  if (!vehicle) return res.status(404).json({ message: "Vehicle not found" });

  const records = await db
    .select()
    .from(userVehicleRecords)
    .where(eq(userVehicleRecords.vehicleId, vehicleId))
    .orderBy(desc(userVehicleRecords.occurredAt), desc(userVehicleRecords.createdAt))
    .limit(200);

  const documents = await db
    .select()
    .from(userVehicleDocuments)
    .where(eq(userVehicleDocuments.vehicleId, vehicleId))
    .orderBy(desc(userVehicleDocuments.createdAt))
    .limit(200);

  res.json({ vehicle, records, documents });
});

router.post("/api/vehicles/:vehicleId/records", isAuthenticated, async (req: any, res) => {
  const userId = getUserId(req);
  if (!userId) return res.status(401).json({ message: "Authentication required" });

  const vehicleId = String(req.params.vehicleId || "").trim();
  if (!vehicleId) return res.status(400).json({ message: "vehicleId required" });

  const vehicle = await requireVehicleOwner(userId, vehicleId);
  if (!vehicle) return res.status(404).json({ message: "Vehicle not found" });

  const body = createRecordSchema.parse(req.body ?? {});
  const occurredAt =
    body.occurredAt && /^\d{4}-\d{2}-\d{2}$/.test(body.occurredAt) ? body.occurredAt : null;

  const [created] = await db
    .insert(userVehicleRecords)
    .values({
      vehicleId,
      createdByUserId: userId,
      recordType: body.recordType,
      occurredAt,
      title: body.title,
      details: body.details || null,
      cost: body.cost != null ? String(body.cost) : null,
      mileage: body.mileage ?? null,
      tags: body.tags ?? [],
      updatedAt: new Date(),
    })
    .returning();

  await db
    .update(userVehicles)
    .set({ updatedAt: new Date() })
    .where(eq(userVehicles.id, vehicleId));

  res.status(201).json({ record: created });
});

router.post("/api/vehicles/:vehicleId/documents", isAuthenticated, async (req: any, res) => {
  const userId = getUserId(req);
  if (!userId) return res.status(401).json({ message: "Authentication required" });

  const vehicleId = String(req.params.vehicleId || "").trim();
  if (!vehicleId) return res.status(400).json({ message: "vehicleId required" });

  const vehicle = await requireVehicleOwner(userId, vehicleId);
  if (!vehicle) return res.status(404).json({ message: "Vehicle not found" });

  const body = addDocumentSchema.parse(req.body ?? {});

  let recordId: string | null = null;
  if (body.recordId) {
    const [record] = await db
      .select({ id: userVehicleRecords.id })
      .from(userVehicleRecords)
      .where(
        and(eq(userVehicleRecords.id, body.recordId), eq(userVehicleRecords.vehicleId, vehicleId))
      )
      .limit(1);
    if (!record) return res.status(400).json({ message: "Invalid recordId for vehicle" });
    recordId = body.recordId;
  }

  const [created] = await db
    .insert(userVehicleDocuments)
    .values({
      vehicleId,
      recordId,
      uploadedByUserId: userId,
      documentType: body.documentType || "other",
      objectKey: body.objectKey,
      originalName: body.originalName || null,
      contentType: body.contentType || null,
      bytes: body.bytes ?? null,
    })
    .returning();

  await db
    .update(userVehicles)
    .set({ updatedAt: new Date() })
    .where(eq(userVehicles.id, vehicleId));

  res.status(201).json({ document: created });
});

router.get(
  "/api/vehicles/:vehicleId/documents/:docId/download",
  isAuthenticated,
  async (req: any, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Authentication required" });

    const vehicleId = String(req.params.vehicleId || "").trim();
    const docId = String(req.params.docId || "").trim();
    if (!vehicleId || !docId)
      return res.status(400).json({ message: "vehicleId and docId required" });

    const vehicle = await requireVehicleOwner(userId, vehicleId);
    if (!vehicle) return res.status(404).json({ message: "Vehicle not found" });

    const [doc] = await db
      .select()
      .from(userVehicleDocuments)
      .where(and(eq(userVehicleDocuments.id, docId), eq(userVehicleDocuments.vehicleId, vehicleId)))
      .limit(1);
    if (!doc) return res.status(404).json({ message: "Document not found" });

    const objectKey = String((doc as any).objectKey || "");
    if (!objectKey) return res.status(400).json({ message: "Document is missing objectKey" });

    if (/^https?:\/\//i.test(objectKey)) return res.redirect(302, objectKey);

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
        console.error("[vehicles] Failed to sign download URL:", err);
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
      console.error("[vehicles] Failed to download private file:", err);
      return res.status(500).json({ message: "Failed to download file" });
    }
  }
);

router.get(
  "/api/vehicles/:vehicleId/prefill-marketplace",
  isAuthenticated,
  async (req: any, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Authentication required" });

    const vehicleId = String(req.params.vehicleId || "").trim();
    if (!vehicleId) return res.status(400).json({ message: "vehicleId required" });

    const vehicle = await requireVehicleOwner(userId, vehicleId);
    if (!vehicle) return res.status(404).json({ message: "Vehicle not found" });

    const year = (vehicle as any).year ? String((vehicle as any).year) : "";
    const make = String((vehicle as any).make || "").trim();
    const model = String((vehicle as any).model || "").trim();
    const trim = String((vehicle as any).trim || "").trim();
    const mileage = (vehicle as any).mileage != null ? Number((vehicle as any).mileage) : null;

    const titleBits = [year, make, model, trim].filter(Boolean);
    const title = titleBits.join(" ").trim() || "Vehicle for sale";

    const descriptionLines: string[] = [];
    if ((vehicle as any).vin) descriptionLines.push(`VIN: ${String((vehicle as any).vin)}`);
    if (mileage != null && Number.isFinite(mileage))
      descriptionLines.push(`Mileage: ${mileage.toLocaleString()} miles`);
    descriptionLines.push("");
    descriptionLines.push("Service history available on request (records tracked in TradeScout).");

    const [vehicleCategory] = await db
      .select({ id: marketplaceCategories.id })
      .from(marketplaceCategories)
      .where(ilike(marketplaceCategories.name, "%vehicle%"))
      .limit(1);

    res.json({
      title,
      description: descriptionLines.join("\n").trim(),
      categoryId: vehicleCategory?.id || null,
      year: (vehicle as any).year ?? null,
      mileage,
      make,
      model,
      vin: String((vehicle as any).vin || "").trim() || null,
    });
  }
);

export const vehiclesRouter = router;
