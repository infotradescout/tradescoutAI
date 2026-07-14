import { Router } from "express";
import { z } from "zod";
import { and, desc, eq, inArray } from "drizzle-orm";
import { isAuthenticated } from "../auth";
import { db } from "../db";
import {
  propertyDocuments,
  propertyLifecycleEvents,
  propertyParticipants,
  propertyPrograms,
  userHomes,
  users,
} from "@shared/schema";
import {
  PROPERTY_PARTICIPANT_ROLES,
  isPropertyParticipantRole,
} from "@shared/propertyParticipantRoles";
import {
  acceptParticipantInvite,
  addPropertyDocument,
  addPropertyLifecycleEvent,
  createPropertyProgram,
  getLatestPropertyHomefaxSnapshot,
  getLatestPropertyReadinessSnapshot,
  inviteParticipant,
  listParticipants,
  recomputePropertyHomefaxSnapshot,
  recomputePropertyReadinessSnapshot,
  removeParticipant,
  requirePropertyProgramAccess,
  transferPrimary,
} from "../services/propertyLifecycleService";
import { emailService } from "../services/emailService";

const router = Router();

function getUserId(req: any): string {
  return String((req.user as any)?.claims?.sub || (req.user as any)?.id || "").trim();
}

function escapeHtml(value: string): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

const createPropertyProgramSchema = z.object({
  mode: z.enum(["build", "existing"]).default("existing"),
  countyFips: z
    .string()
    .trim()
    .regex(/^[0-9]{5}$/)
    .optional(),
  stateCode: z.string().trim().length(2).optional(),
  status: z.enum(["draft", "active", "paused", "completed"]).optional(),
  addressJson: z.record(z.any()).optional(),
  parcelId: z.string().trim().max(240).optional(),
  propertyType: z.string().trim().min(1).max(64).optional(),
  yearBuilt: z.number().int().min(1600).max(2100).optional(),
  metadata: z.record(z.any()).optional(),
  homeId: z.string().trim().optional(), // link to private Home Vault home
});

const inviteParticipantSchema = z.object({
  email: z.string().trim().email(),
  role: z.string().trim().min(1).max(64),
  permissions: z.record(z.any()).optional(),
});

const acceptInviteSchema = z.object({
  invitationCode: z.string().trim().min(1),
});

const transferPrimarySchema = z.object({
  newPrimaryUserId: z.string().trim().min(1),
});

const createDocumentSchema = z.object({
  documentType: z.string().trim().min(1).max(80),
  objectKey: z.string().trim().min(3).max(600),
  lifecycleEventId: z.string().trim().optional(),
  metadata: z.record(z.any()).optional(),
});

const createEventSchema = z.object({
  actionType: z.string().trim().min(2).max(80),
  phase: z.string().trim().max(80).optional(),
  title: z.string().trim().min(2).max(220),
  description: z.string().trim().max(20_000).optional(),
  occurredAt: z.string().trim().optional(), // ISO string
  source: z.enum(["user", "scout", "integration", "system"]).optional(),
  status: z.enum(["planned", "in_progress", "done", "blocked"]).optional(),
  costAmount: z.union([z.number(), z.string()]).optional(),
  metadata: z.record(z.any()).optional(),
  sourceSurface: z.string().trim().max(80).optional(),
  idempotencyKey: z.string().trim().max(180).optional(),
});

router.get("/api/property-programs", isAuthenticated, async (req: any, res) => {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Authentication required" });

    const participantRows = await db
      .select({ propertyProgramId: propertyParticipants.propertyProgramId })
      .from(propertyParticipants)
      .where(
        and(eq(propertyParticipants.userId, userId), eq(propertyParticipants.status, "active"))
      )
      .limit(500);

    const ids: string[] = Array.from(
      new Set(participantRows.map((r) => String(r.propertyProgramId)).filter(Boolean))
    );

    const programs = ids.length
      ? await db
          .select()
          .from(propertyPrograms)
          .where(inArray(propertyPrograms.id, ids))
          .orderBy(desc(propertyPrograms.updatedAt))
          .limit(100)
      : [];

    return res.json({ programs });
  } catch (err) {
    console.error("[property-programs] list failed:", err);
    return res.status(500).json({ message: "Failed to load property programs" });
  }
});

router.post("/api/property-programs", isAuthenticated, async (req: any, res) => {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Authentication required" });

    const body = createPropertyProgramSchema.parse(req.body ?? {});

    let countyFips = body.countyFips || "";
    let stateCode = body.stateCode || "";
    let addressJson = body.addressJson || {};
    let propertyType = body.propertyType || null;
    let yearBuilt = body.yearBuilt ?? null;
    let userHomeId: string | null = null;

    if (body.homeId) {
      const homeId = String(body.homeId || "").trim();
      const [home] = await db
        .select()
        .from(userHomes)
        .where(and(eq(userHomes.id, homeId), eq(userHomes.ownerUserId, userId)))
        .limit(1);
      if (!home) return res.status(404).json({ message: "Home not found" });

      userHomeId = homeId;
      countyFips = countyFips || String((home as any).countyFips || "");
      stateCode = stateCode || String((home as any).stateCode || "");
      propertyType = propertyType || ((home as any).propertyType ?? null);
      yearBuilt = yearBuilt ?? (home as any).yearBuilt ?? null;
      addressJson = {
        ...(addressJson || {}),
        address1: (home as any).address1 ?? null,
        address2: (home as any).address2 ?? null,
        city: (home as any).city ?? null,
        stateCode: (home as any).stateCode ?? null,
        countyFips: (home as any).countyFips ?? null,
        zipCode: (home as any).zipCode ?? null,
        nickname: (home as any).nickname ?? null,
      };
    }

    if (!countyFips || !/^[0-9]{5}$/.test(countyFips)) {
      return res.status(400).json({ message: "countyFips (5 digits) required" });
    }
    if (!stateCode || String(stateCode).length !== 2) {
      return res.status(400).json({ message: "stateCode (2 letters) required" });
    }

    const program = await createPropertyProgram({
      ownerUserId: userId,
      primaryUserId: userId, // safe default; transfer is a separate audited action
      countyFips,
      stateCode,
      mode: body.mode,
      status: body.status,
      addressJson,
      userHomeId,
      parcelId: body.parcelId ?? null,
      propertyType,
      yearBuilt,
      metadata: body.metadata || {},
    });

    return res.status(201).json({ program });
  } catch (err: any) {
    if (err?.name === "ZodError") return res.status(400).json({ message: "Invalid payload" });
    console.error("[property-programs] create failed:", err);
    return res.status(500).json({ message: "Failed to create property program" });
  }
});

router.get("/api/property-programs/:id", isAuthenticated, async (req: any, res) => {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Authentication required" });

    const id = String(req.params.id || "").trim();
    if (!id) return res.status(400).json({ message: "id required" });

    const { program, participant, isOwnerLike } = await requirePropertyProgramAccess({
      propertyProgramId: id,
      userId,
    });
    return res.json({
      program,
      callerRole: isOwnerLike
        ? userId === program.ownerUserId
          ? "owner"
          : "primary"
        : (participant?.participantRole ?? null),
      callerPermissions: participant?.permissions ?? null,
    });
  } catch (err: any) {
    if (String(err?.message || "").includes("Not allowed"))
      return res.status(403).json({ message: "Not allowed" });
    if (String(err?.message || "").includes("not found"))
      return res.status(404).json({ message: "Not found" });
    console.error("[property-programs] get failed:", err);
    return res.status(500).json({ message: "Failed to load property program" });
  }
});

router.get("/api/property-programs/:id/events", isAuthenticated, async (req: any, res) => {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Authentication required" });

    const id = String(req.params.id || "").trim();
    if (!id) return res.status(400).json({ message: "id required" });

    await requirePropertyProgramAccess({ propertyProgramId: id, userId });

    const events = await db
      .select()
      .from(propertyLifecycleEvents)
      .where(eq(propertyLifecycleEvents.propertyProgramId, id))
      .orderBy(desc(propertyLifecycleEvents.occurredAt), desc(propertyLifecycleEvents.createdAt))
      .limit(200);

    return res.json({ events });
  } catch (err: any) {
    if (String(err?.message || "").includes("Not allowed"))
      return res.status(403).json({ message: "Not allowed" });
    if (String(err?.message || "").includes("not found"))
      return res.status(404).json({ message: "Not found" });
    console.error("[property-programs] events list failed:", err);
    return res.status(500).json({ message: "Failed to load events" });
  }
});

router.post("/api/property-programs/:id/events", isAuthenticated, async (req: any, res) => {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Authentication required" });

    const id = String(req.params.id || "").trim();
    if (!id) return res.status(400).json({ message: "id required" });

    await requirePropertyProgramAccess({ propertyProgramId: id, userId });

    const body = createEventSchema.parse(req.body ?? {});
    const occurredAt = body.occurredAt ? new Date(body.occurredAt) : new Date();
    if (!Number.isFinite(occurredAt.getTime())) {
      return res.status(400).json({ message: "occurredAt must be a valid ISO date" });
    }

    const created = await addPropertyLifecycleEvent({
      propertyProgramId: id,
      actionType: body.actionType,
      phase: body.phase || null,
      title: body.title,
      description: body.description || null,
      occurredAt,
      source: body.source || "user",
      status: body.status || "done",
      costAmount: body.costAmount ?? null,
      metadata: body.metadata || {},
      createdByUserId: userId,
      sourceSurface: body.sourceSurface || null,
      idempotencyKey: body.idempotencyKey || null,
    });

    return res.status(201).json({ event: created });
  } catch (err: any) {
    if (err?.name === "ZodError") return res.status(400).json({ message: "Invalid payload" });
    if (String(err?.message || "").includes("Not allowed"))
      return res.status(403).json({ message: "Not allowed" });
    if (String(err?.message || "").includes("not found"))
      return res.status(404).json({ message: "Not found" });
    console.error("[property-programs] event create failed:", err);
    return res.status(500).json({ message: "Failed to create event" });
  }
});

router.get("/api/property-programs/:id/homefax", isAuthenticated, async (req: any, res) => {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Authentication required" });

    const id = String(req.params.id || "").trim();
    if (!id) return res.status(400).json({ message: "id required" });

    await requirePropertyProgramAccess({ propertyProgramId: id, userId });

    const existing = await getLatestPropertyHomefaxSnapshot({ propertyProgramId: id });
    const snapshot =
      existing || (await recomputePropertyHomefaxSnapshot({ propertyProgramId: id }));

    return res.json({ snapshot });
  } catch (err: any) {
    if (String(err?.message || "").includes("Not allowed"))
      return res.status(403).json({ message: "Not allowed" });
    if (String(err?.message || "").includes("not found"))
      return res.status(404).json({ message: "Not found" });
    console.error("[property-programs] homefax failed:", err);
    return res.status(500).json({ message: "Failed to load homefax snapshot" });
  }
});

router.get("/api/property-programs/:id/readiness", isAuthenticated, async (req: any, res) => {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Authentication required" });

    const id = String(req.params.id || "").trim();
    if (!id) return res.status(400).json({ message: "id required" });

    await requirePropertyProgramAccess({ propertyProgramId: id, userId });

    const existing = await getLatestPropertyReadinessSnapshot({ propertyProgramId: id });
    const snapshot =
      existing || (await recomputePropertyReadinessSnapshot({ propertyProgramId: id }));

    return res.json({ snapshot });
  } catch (err: any) {
    if (String(err?.message || "").includes("Not allowed"))
      return res.status(403).json({ message: "Not allowed" });
    if (String(err?.message || "").includes("not found"))
      return res.status(404).json({ message: "Not found" });
    console.error("[property-programs] readiness failed:", err);
    return res.status(500).json({ message: "Failed to load readiness snapshot" });
  }
});

router.get("/api/property-programs/:id/participants", isAuthenticated, async (req: any, res) => {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Authentication required" });

    const id = String(req.params.id || "").trim();
    if (!id) return res.status(400).json({ message: "id required" });

    await requirePropertyProgramAccess({ propertyProgramId: id, userId });

    const { participants, pendingInvites } = await listParticipants({ propertyProgramId: id });
    return res.json({ participants, pendingInvites });
  } catch (err: any) {
    if (String(err?.message || "").includes("Not allowed"))
      return res.status(403).json({ message: "Not allowed" });
    if (String(err?.message || "").includes("not found"))
      return res.status(404).json({ message: "Not found" });
    console.error("[property-programs] participants list failed:", err);
    return res.status(500).json({ message: "Failed to load participants" });
  }
});

router.post(
  "/api/property-programs/:id/participants/invite",
  isAuthenticated,
  async (req: any, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) return res.status(401).json({ message: "Authentication required" });

      const id = String(req.params.id || "").trim();
      if (!id) return res.status(400).json({ message: "id required" });

      const { isOwnerLike, program } = await requirePropertyProgramAccess({
        propertyProgramId: id,
        userId,
      });
      if (!isOwnerLike) return res.status(403).json({ message: "Not allowed" });

      const body = inviteParticipantSchema.parse(req.body ?? {});
      if (!isPropertyParticipantRole(body.role)) {
        return res.status(400).json({
          message: `role must be one of: ${PROPERTY_PARTICIPANT_ROLES.map((r) => r.value).join(", ")}`,
        });
      }

      const invite = await inviteParticipant({
        propertyProgramId: id,
        inviterUserId: userId,
        inviteeEmail: body.email,
        participantRole: body.role,
        permissions: body.permissions,
      });

      if (emailService.isConfigured()) {
        const publicBase = String(
          process.env.APP_BASE_URL || "https://www.thetradescout.com"
        ).replace(/\/$/, "");
        const acceptUrl = `${publicBase}/homes/build?invite=${encodeURIComponent(invite.invitationCode)}`;
        const address = String(
          (program.addressJson as any)?.address1 ||
            (program.addressJson as any)?.nickname ||
            "this property"
        );
        void emailService
          .sendEmail({
            to: body.email,
            subject: `You've been invited to a TradeScout property build`,
            html: [
              `<p>You've been invited as a <strong>${escapeHtml(body.role)}</strong> on ${escapeHtml(address)}.</p>`,
              `<p><a href="${acceptUrl}">Accept the invite</a> to view the build timeline and share updates.</p>`,
            ].join("\n"),
            text: [
              `You've been invited as a ${body.role} on ${address}.`,
              `Accept the invite: ${acceptUrl}`,
            ].join("\n"),
            purpose: "property_participant_invite",
          })
          .catch((error) =>
            console.warn("[property-programs] invite email failed", { inviteId: invite.id, error })
          );
      }

      return res.status(201).json({ invite });
    } catch (err: any) {
      if (err?.name === "ZodError") return res.status(400).json({ message: "Invalid payload" });
      if (String(err?.message || "").includes("Not allowed"))
        return res.status(403).json({ message: "Not allowed" });
      if (String(err?.message || "").includes("not found"))
        return res.status(404).json({ message: "Not found" });
      console.error("[property-programs] invite failed:", err);
      return res.status(500).json({ message: "Failed to invite participant" });
    }
  }
);

router.post(
  "/api/property-programs/invites/:code/accept",
  isAuthenticated,
  async (req: any, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) return res.status(401).json({ message: "Authentication required" });

      const code = String(req.params.code || "").trim();
      if (!code) return res.status(400).json({ message: "code required" });
      acceptInviteSchema.parse({ invitationCode: code });

      const [me] = await db
        .select({ email: users.email })
        .from(users)
        .where(eq(users.id, userId))
        .limit(1);
      if (!me?.email) return res.status(400).json({ message: "Account email not found" });

      const participant = await acceptParticipantInvite({
        invitationCode: code,
        userId,
        userEmail: me.email,
      });

      return res.json({ participant });
    } catch (err: any) {
      if (err?.name === "ZodError") return res.status(400).json({ message: "Invalid payload" });
      const message = String(err?.message || "");
      if (message.includes("Sign in with the email")) return res.status(403).json({ message });
      if (message.includes("expired") || message.includes("already used"))
        return res.status(400).json({ message });
      if (message.includes("not found"))
        return res.status(404).json({ message: "Invite not found" });
      console.error("[property-programs] invite accept failed:", err);
      return res.status(500).json({ message: "Failed to accept invite" });
    }
  }
);

router.delete(
  "/api/property-programs/:id/participants/:participantId",
  isAuthenticated,
  async (req: any, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) return res.status(401).json({ message: "Authentication required" });

      const id = String(req.params.id || "").trim();
      const participantId = String(req.params.participantId || "").trim();
      if (!id || !participantId)
        return res.status(400).json({ message: "id and participantId required" });

      await removeParticipant({ propertyProgramId: id, participantId, actingUserId: userId });
      return res.status(204).send();
    } catch (err: any) {
      const message = String(err?.message || "");
      if (message.includes("Not allowed")) return res.status(403).json({ message: "Not allowed" });
      if (message.includes("Cannot remove the owner")) return res.status(400).json({ message });
      if (message.includes("not found")) return res.status(404).json({ message: "Not found" });
      console.error("[property-programs] remove participant failed:", err);
      return res.status(500).json({ message: "Failed to remove participant" });
    }
  }
);

router.post(
  "/api/property-programs/:id/transfer-primary",
  isAuthenticated,
  async (req: any, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) return res.status(401).json({ message: "Authentication required" });

      const id = String(req.params.id || "").trim();
      if (!id) return res.status(400).json({ message: "id required" });

      const body = transferPrimarySchema.parse(req.body ?? {});
      const program = await transferPrimary({
        propertyProgramId: id,
        newPrimaryUserId: body.newPrimaryUserId,
        actingUserId: userId,
      });

      return res.json({ program });
    } catch (err: any) {
      if (err?.name === "ZodError") return res.status(400).json({ message: "Invalid payload" });
      const message = String(err?.message || "");
      if (message.includes("Only the owner")) return res.status(403).json({ message });
      if (message.includes("must already be an active participant"))
        return res.status(400).json({ message });
      if (message.includes("not found")) return res.status(404).json({ message: "Not found" });
      console.error("[property-programs] transfer primary failed:", err);
      return res.status(500).json({ message: "Failed to transfer primary" });
    }
  }
);

router.get("/api/property-programs/:id/documents", isAuthenticated, async (req: any, res) => {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Authentication required" });

    const id = String(req.params.id || "").trim();
    if (!id) return res.status(400).json({ message: "id required" });

    await requirePropertyProgramAccess({ propertyProgramId: id, userId });

    const documents = await db
      .select()
      .from(propertyDocuments)
      .where(eq(propertyDocuments.propertyProgramId, id))
      .orderBy(desc(propertyDocuments.createdAt))
      .limit(200);

    return res.json({ documents });
  } catch (err: any) {
    if (String(err?.message || "").includes("Not allowed"))
      return res.status(403).json({ message: "Not allowed" });
    if (String(err?.message || "").includes("not found"))
      return res.status(404).json({ message: "Not found" });
    console.error("[property-programs] documents list failed:", err);
    return res.status(500).json({ message: "Failed to load documents" });
  }
});

router.post("/api/property-programs/:id/documents", isAuthenticated, async (req: any, res) => {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Authentication required" });

    const id = String(req.params.id || "").trim();
    if (!id) return res.status(400).json({ message: "id required" });

    const { participant, isOwnerLike } = await requirePropertyProgramAccess({
      propertyProgramId: id,
      userId,
    });
    const canAddDocuments =
      isOwnerLike || Boolean((participant?.permissions as any)?.canAddDocuments);
    if (!canAddDocuments) return res.status(403).json({ message: "Not allowed" });

    const body = createDocumentSchema.parse(req.body ?? {});
    const document = await addPropertyDocument({
      propertyProgramId: id,
      lifecycleEventId: body.lifecycleEventId || null,
      documentType: body.documentType,
      fileUrl: body.objectKey,
      uploadedByUserId: userId,
      metadata: body.metadata || {},
    });

    return res.status(201).json({ document });
  } catch (err: any) {
    if (err?.name === "ZodError") return res.status(400).json({ message: "Invalid payload" });
    if (String(err?.message || "").includes("Not allowed"))
      return res.status(403).json({ message: "Not allowed" });
    if (String(err?.message || "").includes("not found"))
      return res.status(404).json({ message: "Not found" });
    console.error("[property-programs] document create failed:", err);
    return res.status(500).json({ message: "Failed to add document" });
  }
});

router.get(
  "/api/property-programs/:id/documents/:docId/download",
  isAuthenticated,
  async (req: any, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) return res.status(401).json({ message: "Authentication required" });

      const id = String(req.params.id || "").trim();
      const docId = String(req.params.docId || "").trim();
      if (!id || !docId) return res.status(400).json({ message: "id and docId required" });

      await requirePropertyProgramAccess({ propertyProgramId: id, userId });

      const [doc] = await db
        .select()
        .from(propertyDocuments)
        .where(and(eq(propertyDocuments.id, docId), eq(propertyDocuments.propertyProgramId, id)))
        .limit(1);
      if (!doc) return res.status(404).json({ message: "Document not found" });

      const objectKey = String(doc.fileUrl || "");
      if (!objectKey) return res.status(400).json({ message: "Document is missing a file" });

      if (/^https?:\/\//i.test(objectKey)) {
        return res.redirect(302, objectKey);
      }

      const useR2 = Boolean(process.env.R2_BUCKET_NAME && process.env.R2_ACCESS_KEY_ID);

      if (useR2) {
        const { R2StorageService } = await import("../localStorage");
        const storageService = new R2StorageService();
        const url = await storageService.getDownloadURL(objectKey, {});
        return res.redirect(302, url);
      }

      const { LocalStorageService } = await import("../localStorage");
      const storageService = new LocalStorageService();
      const filePath = await storageService.getPrivateFilePathFromObjectKey(objectKey);
      if (!filePath) return res.status(404).json({ message: "File not found" });

      return res.download(filePath, "document");
    } catch (err: any) {
      if (String(err?.message || "").includes("Not allowed"))
        return res.status(403).json({ message: "Not allowed" });
      if (String(err?.message || "").includes("not found"))
        return res.status(404).json({ message: "Not found" });
      console.error("[property-programs] document download failed:", err);
      return res.status(500).json({ message: "Failed to download document" });
    }
  }
);

export const propertyProgramsRouter = router;
