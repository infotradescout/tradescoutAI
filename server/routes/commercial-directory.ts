import type { Express, Request, Response } from "express";
import path from "path";
import fs from "fs";
import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { z } from "zod";
import { isAdmin, isAuthenticated } from "../auth";
import { db } from "../db";
import { storage } from "../storage";
import {
  commercialProjectBids,
  commercialProjectDocuments,
  commercialProjects,
  contractors,
  type CommercialProject,
} from "@shared/schema";

type AuthedRequest = Request & {
  user?: { id?: string; claims?: { sub?: string }; role?: string; [key: string]: any };
};

const createCommercialProjectSchema = z.object({
  title: z.string().min(3).max(220),
  summary: z.string().min(10),
  scopeOfWork: z.string().min(10),
  requirements: z.string().min(10),
  countyFips: z.string().length(5),
  stateCode: z.string().length(2),
  budgetMin: z.coerce.number().positive().optional(),
  budgetMax: z.coerce.number().positive().optional(),
  bidDueAt: z.string().datetime().optional(),
  projectStartAt: z.string().datetime().optional(),
  campaignEnabled: z.coerce.boolean().optional().default(false),
  campaignHeadline: z.string().max(220).optional(),
  campaignBody: z.string().optional(),
  heroImageUrl: z.string().max(500).optional(),
  status: z.enum(["draft", "open", "closed", "awarded", "archived"]).optional().default("open"),
});

const updateCommercialProjectSchema = z.object({
  title: z.string().min(3).max(220).optional(),
  summary: z.string().min(10).optional(),
  scopeOfWork: z.string().min(10).optional(),
  requirements: z.string().min(10).optional(),
  bidDueAt: z.string().datetime().optional().nullable(),
  projectStartAt: z.string().datetime().optional().nullable(),
  campaignEnabled: z.coerce.boolean().optional(),
  campaignHeadline: z.string().max(220).optional().nullable(),
  campaignBody: z.string().optional().nullable(),
  heroImageUrl: z.string().max(500).optional().nullable(),
  status: z.enum(["draft", "open", "closed", "awarded", "archived"]).optional(),
  winningBidId: z.string().optional().nullable(),
});

const createBidSchema = z.object({
  amount: z.coerce.number().positive(),
  timelineDays: z.coerce.number().int().positive().max(3650).optional(),
  proposal: z.string().min(20),
});

const adminBidActionSchema = z.object({
  action: z.enum(["shortlist", "reject", "accept"]),
});

function ensureDir(dir: string) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function toUserId(req: AuthedRequest): string | null {
  const id = req.user?.id || req.user?.claims?.sub;
  return id ? String(id) : null;
}

function slugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 200);
}

async function ensureUniqueProjectSlug(baseTitle: string): Promise<string> {
  const base = slugify(baseTitle) || "commercial-project";
  let candidate = base;
  let i = 1;

  while (true) {
    const [existing] = await db
      .select({ id: commercialProjects.id })
      .from(commercialProjects)
      .where(eq(commercialProjects.slug, candidate))
      .limit(1);
    if (!existing) return candidate;
    i += 1;
    candidate = `${base}-${i}`;
  }
}

async function getVerifiedContractorForUser(userId: string) {
  const contractor = await storage.getContractorByUserId(userId);
  if (!contractor || !contractor.id) return null;

  // Exposure gate routes through verification summary (Trust/CVS-adjacent policy path).
  const summary = await storage.getUserVerificationSummary([userId]);
  const verification = summary[userId] || {
    hasLicense: false,
    hasInsurance: false,
    hasEin: false,
  };

  const hasLicense = verification.hasLicense || Boolean((contractor as any).verifiedLicensed);
  const hasInsurance = verification.hasInsurance || Boolean((contractor as any).verifiedInsured);
  const isActive = (contractor as any).isActive !== false;

  if (!hasLicense || !hasInsurance || !isActive) {
    return null;
  }
  return contractor;
}

async function attachProjectDocuments(
  projectId: string,
  uploadedByUserId: string,
  files: Express.Multer.File[]
) {
  if (!files.length) return;

  await db.insert(commercialProjectDocuments).values(
    files.map((file) => ({
      projectId,
      uploadedByUserId,
      fileName: file.originalname || file.filename,
      fileUrl: `/uploads/commercial-projects/${file.filename}`,
      mimeType: file.mimetype,
      fileSizeBytes: file.size,
    }))
  );
}

export function registerCommercialDirectoryRoutes(app: Express) {
  app.get(
    "/api/admin/commercial-directory/projects",
    isAuthenticated,
    isAdmin,
    async (_req, res) => {
      try {
        const rows = await db
          .select({
            project: commercialProjects,
            bidsCount: sql<number>`count(distinct ${commercialProjectBids.id})::int`,
            docsCount: sql<number>`count(distinct ${commercialProjectDocuments.id})::int`,
          })
          .from(commercialProjects)
          .leftJoin(
            commercialProjectBids,
            eq(commercialProjectBids.projectId, commercialProjects.id)
          )
          .leftJoin(
            commercialProjectDocuments,
            eq(commercialProjectDocuments.projectId, commercialProjects.id)
          )
          .groupBy(commercialProjects.id)
          .orderBy(desc(commercialProjects.createdAt));

        res.json(rows);
      } catch (error: any) {
        console.error("Error fetching admin commercial projects:", error);
        res.status(500).json({ message: "Failed to load commercial projects" });
      }
    }
  );

  app.post(
    "/api/admin/commercial-directory/projects",
    isAuthenticated,
    isAdmin,
    async (req: AuthedRequest, res: Response) => {
      try {
        const userId = toUserId(req);
        if (!userId) return res.status(401).json({ message: "Unauthorized" });

        const multer = (await import("multer")).default;
        const crypto = await import("crypto");

        const uploadRoot = path.resolve(process.env.UPLOAD_DIR || "./public/uploads");
        const projectRoot = path.join(uploadRoot, "commercial-projects");
        ensureDir(projectRoot);

        const upload = multer({
          storage: multer.diskStorage({
            destination: (_req, _file, cb) => cb(null, projectRoot),
            filename: (_req, file, cb) => {
              const ext = path.extname(file.originalname || "").slice(0, 16);
              const hash = crypto.randomBytes(8).toString("hex");
              cb(null, `cp_${Date.now()}_${hash}${ext}`);
            },
          }),
          limits: {
            files: 12,
            fileSize:
              Number.parseInt(process.env.MAX_COMMERCIAL_PROJECT_UPLOAD_BYTES || "", 10) ||
              20 * 1024 * 1024,
          },
        }).array("files", 12);

        upload(req as any, res as any, async (err) => {
          if (err) {
            return res.status(400).json({ message: err?.message || "Upload failed" });
          }

          try {
            const parsed = createCommercialProjectSchema.parse(req.body ?? {});
            const slug = await ensureUniqueProjectSlug(parsed.title);
            const now = new Date();
            const publishedAt = parsed.campaignEnabled ? now : null;

            const [created] = await db
              .insert(commercialProjects)
              .values({
                createdByUserId: userId,
                countyFips: parsed.countyFips,
                stateCode: parsed.stateCode.toUpperCase(),
                title: parsed.title,
                slug,
                summary: parsed.summary,
                scopeOfWork: parsed.scopeOfWork,
                requirements: parsed.requirements,
                budgetMin:
                  typeof parsed.budgetMin === "number" ? String(parsed.budgetMin) : undefined,
                budgetMax:
                  typeof parsed.budgetMax === "number" ? String(parsed.budgetMax) : undefined,
                bidDueAt: parsed.bidDueAt ? new Date(parsed.bidDueAt) : null,
                projectStartAt: parsed.projectStartAt ? new Date(parsed.projectStartAt) : null,
                status: parsed.status,
                campaignEnabled: parsed.campaignEnabled,
                campaignHeadline: parsed.campaignHeadline || null,
                campaignBody: parsed.campaignBody || null,
                heroImageUrl: parsed.heroImageUrl || null,
                publishedAt,
              })
              .returning();

            const files = Array.isArray((req as any).files)
              ? ((req as any).files as Express.Multer.File[])
              : [];
            if (created && files.length) {
              await attachProjectDocuments(created.id, userId, files);
            }

            res.status(201).json({
              project: created,
              landingUrl: created ? `/commercial/p/${created.slug}` : null,
            });
          } catch (inner: any) {
            if (inner instanceof z.ZodError) {
              return res
                .status(400)
                .json({ message: "Invalid project payload", errors: inner.flatten() });
            }
            console.error("Error creating commercial project:", inner);
            return res.status(500).json({ message: "Failed to create commercial project" });
          }
        });
      } catch (error: any) {
        console.error("Error creating commercial project:", error);
        res.status(500).json({ message: "Failed to create commercial project" });
      }
    }
  );

  app.post(
    "/api/admin/commercial-directory/projects/:id/documents",
    isAuthenticated,
    isAdmin,
    async (req: AuthedRequest, res: Response) => {
      try {
        const userId = toUserId(req);
        if (!userId) return res.status(401).json({ message: "Unauthorized" });
        const projectId = String(req.params.id || "");
        if (!projectId) return res.status(400).json({ message: "Project ID required" });

        const [project] = await db
          .select({ id: commercialProjects.id })
          .from(commercialProjects)
          .where(eq(commercialProjects.id, projectId))
          .limit(1);
        if (!project) return res.status(404).json({ message: "Project not found" });

        const multer = (await import("multer")).default;
        const crypto = await import("crypto");
        const uploadRoot = path.resolve(process.env.UPLOAD_DIR || "./public/uploads");
        const projectRoot = path.join(uploadRoot, "commercial-projects");
        ensureDir(projectRoot);

        const upload = multer({
          storage: multer.diskStorage({
            destination: (_req, _file, cb) => cb(null, projectRoot),
            filename: (_req, file, cb) => {
              const ext = path.extname(file.originalname || "").slice(0, 16);
              const hash = crypto.randomBytes(8).toString("hex");
              cb(null, `cp_${Date.now()}_${hash}${ext}`);
            },
          }),
          limits: {
            files: 12,
            fileSize:
              Number.parseInt(process.env.MAX_COMMERCIAL_PROJECT_UPLOAD_BYTES || "", 10) ||
              20 * 1024 * 1024,
          },
        }).array("files", 12);

        upload(req as any, res as any, async (err) => {
          if (err) {
            return res.status(400).json({ message: err?.message || "Upload failed" });
          }
          try {
            const files = Array.isArray((req as any).files)
              ? ((req as any).files as Express.Multer.File[])
              : [];
            if (!files.length) return res.status(400).json({ message: "No files uploaded" });

            await attachProjectDocuments(projectId, userId, files);
            await db
              .update(commercialProjects)
              .set({ updatedAt: new Date() })
              .where(eq(commercialProjects.id, projectId));

            const docs = await db
              .select()
              .from(commercialProjectDocuments)
              .where(eq(commercialProjectDocuments.projectId, projectId))
              .orderBy(desc(commercialProjectDocuments.createdAt));
            return res.status(201).json({ documents: docs });
          } catch (inner: any) {
            console.error("Error attaching project docs:", inner);
            return res.status(500).json({ message: "Failed to attach documents" });
          }
        });
      } catch (error: any) {
        console.error("Error attaching project docs:", error);
        res.status(500).json({ message: "Failed to attach documents" });
      }
    }
  );

  app.put(
    "/api/admin/commercial-directory/projects/:id",
    isAuthenticated,
    isAdmin,
    async (req: AuthedRequest, res: Response) => {
      try {
        const id = String(req.params.id || "");
        const updates = updateCommercialProjectSchema.parse(req.body ?? {});
        const patch: Partial<CommercialProject> = {
          ...(updates.title ? { title: updates.title } : {}),
          ...(updates.summary ? { summary: updates.summary } : {}),
          ...(updates.scopeOfWork ? { scopeOfWork: updates.scopeOfWork } : {}),
          ...(updates.requirements ? { requirements: updates.requirements } : {}),
          ...(updates.bidDueAt !== undefined
            ? { bidDueAt: updates.bidDueAt ? new Date(updates.bidDueAt) : null }
            : {}),
          ...(updates.projectStartAt !== undefined
            ? { projectStartAt: updates.projectStartAt ? new Date(updates.projectStartAt) : null }
            : {}),
          ...(updates.status ? { status: updates.status } : {}),
          ...(updates.winningBidId !== undefined
            ? { winningBidId: updates.winningBidId || null }
            : {}),
          ...(updates.campaignEnabled !== undefined
            ? { campaignEnabled: updates.campaignEnabled }
            : {}),
          ...(updates.campaignHeadline !== undefined
            ? { campaignHeadline: updates.campaignHeadline || null }
            : {}),
          ...(updates.campaignBody !== undefined
            ? { campaignBody: updates.campaignBody || null }
            : {}),
          ...(updates.heroImageUrl !== undefined
            ? { heroImageUrl: updates.heroImageUrl || null }
            : {}),
          updatedAt: new Date(),
        };

        if (updates.campaignEnabled === true) {
          (patch as any).publishedAt = new Date();
        }
        if (updates.campaignEnabled === false) {
          (patch as any).publishedAt = null;
        }

        const [saved] = await db
          .update(commercialProjects)
          .set(patch as any)
          .where(eq(commercialProjects.id, id))
          .returning();

        if (!saved) return res.status(404).json({ message: "Project not found" });
        res.json(saved);
      } catch (error: any) {
        if (error instanceof z.ZodError) {
          return res.status(400).json({ message: "Invalid payload", errors: error.flatten() });
        }
        console.error("Error updating commercial project:", error);
        res.status(500).json({ message: "Failed to update commercial project" });
      }
    }
  );

  app.get(
    "/api/admin/commercial-directory/projects/:id/bids",
    isAuthenticated,
    isAdmin,
    async (req: AuthedRequest, res: Response) => {
      try {
        const id = String(req.params.id || "");
        const bids = await db
          .select({
            bid: commercialProjectBids,
            contractor: {
              id: contractors.id,
              companyName: contractors.companyName,
              slug: contractors.slug,
              verifiedLicensed: contractors.verifiedLicensed,
              verifiedInsured: contractors.verifiedInsured,
            },
          })
          .from(commercialProjectBids)
          .leftJoin(contractors, eq(contractors.id, commercialProjectBids.contractorId))
          .where(eq(commercialProjectBids.projectId, id))
          .orderBy(desc(commercialProjectBids.createdAt));
        res.json(bids);
      } catch (error: any) {
        console.error("Error fetching commercial project bids:", error);
        res.status(500).json({ message: "Failed to load project bids" });
      }
    }
  );

  app.put(
    "/api/admin/commercial-directory/projects/:projectId/bids/:bidId",
    isAuthenticated,
    isAdmin,
    async (req: AuthedRequest, res: Response) => {
      try {
        const projectId = String(req.params.projectId || "");
        const bidId = String(req.params.bidId || "");
        const { action } = adminBidActionSchema.parse(req.body ?? {});

        const result = await db.transaction(async (tx) => {
          const [project] = await tx
            .select()
            .from(commercialProjects)
            .where(eq(commercialProjects.id, projectId))
            .limit(1);
          if (!project) {
            return { status: 404 as const, body: { message: "Project not found" } };
          }

          const [bid] = await tx
            .select()
            .from(commercialProjectBids)
            .where(
              and(
                eq(commercialProjectBids.id, bidId),
                eq(commercialProjectBids.projectId, projectId)
              )
            )
            .limit(1);
          if (!bid) {
            return { status: 404 as const, body: { message: "Bid not found" } };
          }

          const now = new Date();
          if (action === "shortlist") {
            const [updated] = await tx
              .update(commercialProjectBids)
              .set({ status: "shortlisted", updatedAt: now })
              .where(eq(commercialProjectBids.id, bidId))
              .returning();
            return { status: 200 as const, body: { bid: updated, project } };
          }

          if (action === "reject") {
            const [updated] = await tx
              .update(commercialProjectBids)
              .set({ status: "rejected", updatedAt: now })
              .where(eq(commercialProjectBids.id, bidId))
              .returning();
            return { status: 200 as const, body: { bid: updated, project } };
          }

          // action === "accept"
          await tx
            .update(commercialProjectBids)
            .set({ status: "rejected", updatedAt: now })
            .where(
              and(
                eq(commercialProjectBids.projectId, projectId),
                inArray(commercialProjectBids.status, ["submitted", "shortlisted"] as any)
              )
            );

          const [accepted] = await tx
            .update(commercialProjectBids)
            .set({ status: "accepted", updatedAt: now })
            .where(eq(commercialProjectBids.id, bidId))
            .returning();

          const [updatedProject] = await tx
            .update(commercialProjects)
            .set({
              status: "awarded",
              winningBidId: bidId,
              updatedAt: now,
            })
            .where(eq(commercialProjects.id, projectId))
            .returning();

          return { status: 200 as const, body: { bid: accepted, project: updatedProject } };
        });

        return res.status(result.status).json(result.body);
      } catch (error: any) {
        if (error instanceof z.ZodError) {
          return res.status(400).json({ message: "Invalid payload", errors: error.flatten() });
        }
        console.error("Error updating commercial bid status:", error);
        return res.status(500).json({ message: "Failed to update bid status" });
      }
    }
  );

  // Verified-contractor board (admins can also view)
  app.get(
    "/api/commercial-directory/projects",
    isAuthenticated,
    async (req: AuthedRequest, res: Response) => {
      try {
        const userId = toUserId(req);
        if (!userId) return res.status(401).json({ message: "Unauthorized" });

        const role = String(req.user?.role || "");
        const isAdminRole = role === "ops_admin" || role === "super_admin" || role === "head_admin";

        if (!isAdminRole) {
          const contractor = await getVerifiedContractorForUser(userId);
          if (!contractor) {
            return res.status(403).json({
              message:
                "Commercial directory access requires verified contractor status (license + insurance).",
            });
          }
        }

        const countyFips =
          typeof req.query.countyFips === "string" && req.query.countyFips.length === 5
            ? req.query.countyFips
            : null;

        const whereClause = countyFips
          ? and(
              eq(commercialProjects.status, "open"),
              eq(commercialProjects.countyFips, countyFips)
            )
          : eq(commercialProjects.status, "open");

        const rows = await db
          .select({
            project: commercialProjects,
            bidsCount: sql<number>`count(distinct ${commercialProjectBids.id})::int`,
            docsCount: sql<number>`count(distinct ${commercialProjectDocuments.id})::int`,
          })
          .from(commercialProjects)
          .leftJoin(
            commercialProjectBids,
            eq(commercialProjectBids.projectId, commercialProjects.id)
          )
          .leftJoin(
            commercialProjectDocuments,
            eq(commercialProjectDocuments.projectId, commercialProjects.id)
          )
          .where(whereClause)
          .groupBy(commercialProjects.id)
          .orderBy(desc(commercialProjects.createdAt));

        res.json(rows);
      } catch (error: any) {
        console.error("Error fetching commercial directory board:", error);
        res.status(500).json({ message: "Failed to load commercial board" });
      }
    }
  );

  app.get(
    "/api/commercial-directory/projects/:id",
    isAuthenticated,
    async (req: AuthedRequest, res: Response) => {
      try {
        const userId = toUserId(req);
        if (!userId) return res.status(401).json({ message: "Unauthorized" });
        const projectId = String(req.params.id || "");
        if (!projectId) return res.status(400).json({ message: "Project ID required" });

        const role = String(req.user?.role || "");
        const isAdminRole = role === "ops_admin" || role === "super_admin" || role === "head_admin";

        let contractorId: string | null = null;
        if (!isAdminRole) {
          const contractor = await getVerifiedContractorForUser(userId);
          if (!contractor) {
            return res.status(403).json({
              message:
                "Commercial directory access requires verified contractor status (license + insurance).",
            });
          }
          contractorId = String((contractor as any).id);
        }

        const [project] = await db
          .select()
          .from(commercialProjects)
          .where(eq(commercialProjects.id, projectId))
          .limit(1);
        if (!project) return res.status(404).json({ message: "Project not found" });

        const docs = await db
          .select({
            id: commercialProjectDocuments.id,
            fileName: commercialProjectDocuments.fileName,
            fileUrl: commercialProjectDocuments.fileUrl,
            mimeType: commercialProjectDocuments.mimeType,
            fileSizeBytes: commercialProjectDocuments.fileSizeBytes,
            createdAt: commercialProjectDocuments.createdAt,
          })
          .from(commercialProjectDocuments)
          .where(eq(commercialProjectDocuments.projectId, projectId))
          .orderBy(desc(commercialProjectDocuments.createdAt));

        const [stats] = await db
          .select({ bidsCount: sql<number>`count(*)::int` })
          .from(commercialProjectBids)
          .where(eq(commercialProjectBids.projectId, projectId));

        const myBid =
          contractorId != null
            ? (
                await db
                  .select()
                  .from(commercialProjectBids)
                  .where(
                    and(
                      eq(commercialProjectBids.projectId, projectId),
                      eq(commercialProjectBids.contractorId, contractorId)
                    )
                  )
                  .limit(1)
              )[0] || null
            : null;

        return res.json({
          project,
          documents: docs,
          bidsCount: stats?.bidsCount || 0,
          myBid,
        });
      } catch (error: any) {
        console.error("Error fetching commercial project details:", error);
        return res.status(500).json({ message: "Failed to load project details" });
      }
    }
  );

  app.post(
    "/api/commercial-directory/projects/:id/bids",
    isAuthenticated,
    async (req: AuthedRequest, res: Response) => {
      try {
        const userId = toUserId(req);
        if (!userId) return res.status(401).json({ message: "Unauthorized" });

        const contractor = await getVerifiedContractorForUser(userId);
        if (!contractor) {
          return res.status(403).json({
            message: "Only verified contractors can submit bids in the commercial directory.",
          });
        }

        const projectId = String(req.params.id || "");
        const payload = createBidSchema.parse(req.body ?? {});

        const [project] = await db
          .select()
          .from(commercialProjects)
          .where(eq(commercialProjects.id, projectId))
          .limit(1);
        if (!project || project.status !== "open") {
          return res.status(404).json({ message: "Open project not found" });
        }

        const [existing] = await db
          .select()
          .from(commercialProjectBids)
          .where(
            and(
              eq(commercialProjectBids.projectId, projectId),
              eq(commercialProjectBids.contractorId, String((contractor as any).id))
            )
          )
          .limit(1);

        if (existing) {
          const [updated] = await db
            .update(commercialProjectBids)
            .set({
              amount: String(payload.amount),
              timelineDays: payload.timelineDays ?? null,
              proposal: payload.proposal,
              status: "submitted",
              updatedAt: new Date(),
            })
            .where(eq(commercialProjectBids.id, existing.id))
            .returning();
          return res.json(updated);
        }

        const [created] = await db
          .insert(commercialProjectBids)
          .values({
            projectId,
            contractorId: String((contractor as any).id),
            bidderUserId: userId,
            amount: String(payload.amount),
            timelineDays: payload.timelineDays ?? null,
            proposal: payload.proposal,
            status: "submitted",
          })
          .returning();

        res.status(201).json(created);
      } catch (error: any) {
        if (error instanceof z.ZodError) {
          return res.status(400).json({ message: "Invalid bid payload", errors: error.flatten() });
        }
        console.error("Error creating commercial bid:", error);
        res.status(500).json({ message: "Failed to submit bid" });
      }
    }
  );

  // Campaign landing page payload
  app.get("/api/commercial-directory/landing/:slug", async (req: Request, res: Response) => {
    try {
      const slug = String(req.params.slug || "");
      if (!slug) return res.status(404).json({ message: "Not found" });

      const [project] = await db
        .select()
        .from(commercialProjects)
        .where(and(eq(commercialProjects.slug, slug), eq(commercialProjects.campaignEnabled, true)))
        .limit(1);
      if (!project) return res.status(404).json({ message: "Not found" });

      const docs = await db
        .select({
          id: commercialProjectDocuments.id,
          fileName: commercialProjectDocuments.fileName,
          fileUrl: commercialProjectDocuments.fileUrl,
          mimeType: commercialProjectDocuments.mimeType,
        })
        .from(commercialProjectDocuments)
        .where(eq(commercialProjectDocuments.projectId, project.id))
        .orderBy(desc(commercialProjectDocuments.createdAt));

      const [stats] = await db
        .select({ bidsCount: sql<number>`count(*)::int` })
        .from(commercialProjectBids)
        .where(eq(commercialProjectBids.projectId, project.id));

      res.json({
        project,
        documents: docs,
        bidsCount: stats?.bidsCount || 0,
      });
    } catch (error: any) {
      console.error("Error fetching commercial landing:", error);
      res.status(500).json({ message: "Failed to load campaign page" });
    }
  });
}
