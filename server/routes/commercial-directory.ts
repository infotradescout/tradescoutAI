import type { Express, Request, Response } from "express";
import path from "path";
import fs from "fs";
import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { z } from "zod";
import { isAdmin, isAuthenticated } from "../auth";
import { db } from "../db";
import { storage } from "../storage";
import { runtimePaths } from "../runtimePaths";
import {
  commercialProjectBids,
  commercialProjectDocuments,
  commercialProjects,
  contractors,
  verificationDocuments,
  type CommercialProject,
} from "@shared/schema";

type AuthedRequest = Request & {
  user?: { id?: string; claims?: { sub?: string }; role?: string | null; [key: string]: any };
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

const reviewVerificationDocumentSchema = z.object({
  approved: z.coerce.boolean(),
  notes: z.string().max(1000).optional(),
});

const updateCommercialContractorStatusSchema = z.object({
  isActive: z.coerce.boolean(),
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

const COMMERCIAL_FORBIDDEN_TEXT_PATTERN = /\b(mock|demo|sample|test|placeholder)\b/i;

function containsForbiddenCommercialSeedText(...values: Array<string | null | undefined>): boolean {
  return values.some((value) => {
    if (!value) return false;
    return COMMERCIAL_FORBIDDEN_TEXT_PATTERN.test(String(value));
  });
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
  const docs = await getContractorVerificationDocumentState(String((contractor as any).id));

  const hasApprovedLicenseDoc = docs.hasApprovedLicenseDoc;
  const hasApprovedInsuranceDoc = docs.hasApprovedInsuranceDoc;

  if (
    !hasLicense ||
    !hasInsurance ||
    !isActive ||
    !hasApprovedLicenseDoc ||
    !hasApprovedInsuranceDoc
  ) {
    return null;
  }
  return contractor;
}

type BidEligibilitySnapshot = {
  isEligible: boolean;
  reason: "ok" | "missing_contractor" | "inactive" | "missing_license" | "missing_insurance";
  hasLicense: boolean;
  hasInsurance: boolean;
  isActive: boolean;
};

function toBidEligibilitySnapshot(input: {
  contractor: any | null;
  verification: { hasLicense?: boolean; hasInsurance?: boolean } | null | undefined;
  hasApprovedLicenseDoc?: boolean;
  hasApprovedInsuranceDoc?: boolean;
}): BidEligibilitySnapshot {
  const contractor = input.contractor;
  if (!contractor) {
    return {
      isEligible: false,
      reason: "missing_contractor",
      hasLicense: false,
      hasInsurance: false,
      isActive: false,
    };
  }

  const hasLicense =
    (Boolean(input.verification?.hasLicense) || Boolean((contractor as any).verifiedLicensed)) &&
    (input.hasApprovedLicenseDoc ?? true);
  const hasInsurance =
    (Boolean(input.verification?.hasInsurance) || Boolean((contractor as any).verifiedInsured)) &&
    (input.hasApprovedInsuranceDoc ?? true);
  const isActive = (contractor as any).isActive !== false;

  if (!isActive) {
    return { isEligible: false, reason: "inactive", hasLicense, hasInsurance, isActive };
  }
  if (!hasLicense) {
    return { isEligible: false, reason: "missing_license", hasLicense, hasInsurance, isActive };
  }
  if (!hasInsurance) {
    return { isEligible: false, reason: "missing_insurance", hasLicense, hasInsurance, isActive };
  }

  return { isEligible: true, reason: "ok", hasLicense, hasInsurance, isActive };
}

async function getContractorVerificationDocumentState(contractorId: string) {
  const docs = await db
    .select({
      id: verificationDocuments.id,
      type: verificationDocuments.type,
      status: verificationDocuments.status,
      expiresAt: verificationDocuments.expiresAt,
      createdAt: verificationDocuments.createdAt,
      fileName: verificationDocuments.fileName,
      fileUrl: verificationDocuments.fileUrl,
      reviewNotes: verificationDocuments.reviewNotes,
      reviewedBy: verificationDocuments.reviewedBy,
      reviewedAt: verificationDocuments.reviewedAt,
    })
    .from(verificationDocuments)
    .where(eq(verificationDocuments.contractorId, contractorId))
    .orderBy(desc(verificationDocuments.createdAt));

  const now = Date.now();
  const hasApprovedLicenseDoc = docs.some(
    (doc) =>
      doc.type === "license" &&
      doc.status === "approved" &&
      (!doc.expiresAt || new Date(doc.expiresAt).getTime() > now)
  );
  const hasApprovedInsuranceDoc = docs.some(
    (doc) =>
      doc.type === "insurance" &&
      doc.status === "approved" &&
      (!doc.expiresAt || new Date(doc.expiresAt).getTime() > now)
  );

  return {
    docs,
    hasApprovedLicenseDoc,
    hasApprovedInsuranceDoc,
  };
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
    "/api/commercial-directory/verification/status",
    isAuthenticated,
    async (req: AuthedRequest, res: Response) => {
      try {
        const userId = toUserId(req);
        if (!userId) return res.status(401).json({ message: "Unauthorized" });

        const contractor = await storage.getContractorByUserId(userId);
        if (!contractor || !contractor.id) {
          return res.json({
            contractorId: null,
            verifiedLicensed: false,
            verifiedInsured: false,
            hasApprovedLicenseDoc: false,
            hasApprovedInsuranceDoc: false,
            isEligible: false,
            requires: ["contractor_profile"],
            documents: [],
            reason: "missing_contractor_profile",
            message: "Contractor profile not found.",
          });
        }

        const docsState = await getContractorVerificationDocumentState(String(contractor.id));
        const requires: string[] = [];
        if (!docsState.hasApprovedLicenseDoc) requires.push("approved_license");
        if (!docsState.hasApprovedInsuranceDoc) requires.push("approved_insurance");

        return res.json({
          contractorId: contractor.id,
          verifiedLicensed: Boolean((contractor as any).verifiedLicensed),
          verifiedInsured: Boolean((contractor as any).verifiedInsured),
          hasApprovedLicenseDoc: docsState.hasApprovedLicenseDoc,
          hasApprovedInsuranceDoc: docsState.hasApprovedInsuranceDoc,
          isEligible: requires.length === 0,
          requires,
          documents: docsState.docs,
        });
      } catch (error: any) {
        console.error("Error fetching contractor verification status:", error);
        return res.status(500).json({ message: "Failed to load verification status" });
      }
    }
  );

  app.post(
    "/api/commercial-directory/verification/documents",
    isAuthenticated,
    async (req: AuthedRequest, res: Response) => {
      try {
        const userId = toUserId(req);
        if (!userId) return res.status(401).json({ message: "Unauthorized" });
        const contractor = await storage.getContractorByUserId(userId);
        if (!contractor || !contractor.id) {
          return res.status(404).json({ message: "Contractor profile not found." });
        }

        const multer = (await import("multer")).default;
        const crypto = await import("crypto");
        const uploadRoot = runtimePaths.publicUploads;
        const verificationRoot = path.join(uploadRoot, "contractor-verification");
        ensureDir(verificationRoot);

        const upload = multer({
          storage: multer.diskStorage({
            destination: (_req, _file, cb) => cb(null, verificationRoot),
            filename: (_req, file, cb) => {
              const ext = path.extname(file.originalname || "").slice(0, 16);
              const hash = crypto.randomBytes(8).toString("hex");
              cb(null, `cv_${Date.now()}_${hash}${ext}`);
            },
          }),
          limits: {
            files: 2,
            fileSize:
              Number.parseInt(process.env.MAX_CONTRACTOR_VERIFICATION_UPLOAD_BYTES || "", 10) ||
              20 * 1024 * 1024,
          },
        }).fields([
          { name: "licenseFile", maxCount: 1 },
          { name: "insuranceFile", maxCount: 1 },
        ]);

        upload(req as any, res as any, async (err) => {
          if (err) {
            return res.status(400).json({ message: err?.message || "Upload failed" });
          }

          try {
            const files = ((req as any).files || {}) as Record<string, Express.Multer.File[]>;
            const licenseFile = Array.isArray(files.licenseFile) ? files.licenseFile[0] : null;
            const insuranceFile = Array.isArray(files.insuranceFile)
              ? files.insuranceFile[0]
              : null;

            if (!licenseFile || !insuranceFile) {
              return res.status(400).json({
                message:
                  "Both license and insurance documents are required for commercial contractor verification.",
              });
            }

            const rawLicenseExpiry = String((req.body?.licenseExpiresAt || "") as string).trim();
            const rawInsuranceExpiry = String(
              (req.body?.insuranceExpiresAt || "") as string
            ).trim();
            const licenseExpiresAt =
              rawLicenseExpiry.length > 0 && !Number.isNaN(Date.parse(rawLicenseExpiry))
                ? new Date(rawLicenseExpiry)
                : null;
            const insuranceExpiresAt =
              rawInsuranceExpiry.length > 0 && !Number.isNaN(Date.parse(rawInsuranceExpiry))
                ? new Date(rawInsuranceExpiry)
                : null;

            await db.insert(verificationDocuments).values([
              {
                contractorId: String(contractor.id),
                type: "license",
                fileName: licenseFile.originalname || licenseFile.filename,
                fileUrl: `/uploads/contractor-verification/${licenseFile.filename}`,
                status: "pending",
                expiresAt: licenseExpiresAt,
              },
              {
                contractorId: String(contractor.id),
                type: "insurance",
                fileName: insuranceFile.originalname || insuranceFile.filename,
                fileUrl: `/uploads/contractor-verification/${insuranceFile.filename}`,
                status: "pending",
                expiresAt: insuranceExpiresAt,
              },
            ]);

            await db
              .update(contractors)
              .set({
                verifiedLicensed: false,
                verifiedInsured: false,
                insuranceDocUrl: `/uploads/contractor-verification/${insuranceFile.filename}`,
                updatedAt: new Date(),
              })
              .where(eq(contractors.id, String(contractor.id)));

            return res.status(201).json({
              message:
                "Verification documents submitted. Human review is required before commercial access is granted.",
            });
          } catch (inner: any) {
            console.error("Error submitting contractor verification documents:", inner);
            return res.status(500).json({ message: "Failed to submit verification documents" });
          }
        });
      } catch (error: any) {
        console.error("Error submitting contractor verification documents:", error);
        return res.status(500).json({ message: "Failed to submit verification documents" });
      }
    }
  );

  app.get(
    "/api/admin/commercial-directory/verification/pending",
    isAuthenticated,
    isAdmin,
    async (_req: AuthedRequest, res: Response) => {
      try {
        const rows = await db
          .select({
            document: verificationDocuments,
            contractor: {
              id: contractors.id,
              companyName: contractors.companyName,
              slug: contractors.slug,
              verifiedLicensed: contractors.verifiedLicensed,
              verifiedInsured: contractors.verifiedInsured,
            },
          })
          .from(verificationDocuments)
          .leftJoin(contractors, eq(contractors.id, verificationDocuments.contractorId))
          .where(
            and(
              eq(verificationDocuments.status, "pending"),
              inArray(verificationDocuments.type, ["license", "insurance"] as any)
            )
          )
          .orderBy(desc(verificationDocuments.createdAt));

        return res.json(rows);
      } catch (error: any) {
        console.error("Error loading pending contractor verification docs:", error);
        return res.status(500).json({ message: "Failed to load pending verification docs" });
      }
    }
  );

  app.post(
    "/api/admin/commercial-directory/verification/documents/:id/review",
    isAuthenticated,
    isAdmin,
    async (req: AuthedRequest, res: Response) => {
      try {
        const adminId = toUserId(req);
        if (!adminId) return res.status(401).json({ message: "Unauthorized" });
        const documentId = String(req.params.id || "");
        if (!documentId) return res.status(400).json({ message: "Document ID required" });
        const payload = reviewVerificationDocumentSchema.parse(req.body ?? {});

        const [doc] = await db
          .select()
          .from(verificationDocuments)
          .where(eq(verificationDocuments.id, documentId))
          .limit(1);
        if (!doc) return res.status(404).json({ message: "Verification document not found" });

        const [updatedDoc] = await db
          .update(verificationDocuments)
          .set({
            status: payload.approved ? "approved" : "rejected",
            reviewNotes: payload.notes || null,
            reviewedBy: adminId,
            reviewedAt: new Date(),
          })
          .where(eq(verificationDocuments.id, documentId))
          .returning();

        const contractorId = String(doc.contractorId || "");
        if (contractorId) {
          const docsState = await getContractorVerificationDocumentState(contractorId);
          await db
            .update(contractors)
            .set({
              verifiedLicensed: docsState.hasApprovedLicenseDoc,
              verifiedInsured: docsState.hasApprovedInsuranceDoc,
              lastVerified:
                docsState.hasApprovedLicenseDoc && docsState.hasApprovedInsuranceDoc
                  ? new Date()
                  : null,
              updatedAt: new Date(),
            })
            .where(eq(contractors.id, contractorId));
        }

        return res.json({ document: updatedDoc });
      } catch (error: any) {
        if (error instanceof z.ZodError) {
          return res
            .status(400)
            .json({ message: "Invalid review payload", errors: error.flatten() });
        }
        console.error("Error reviewing contractor verification doc:", error);
        return res.status(500).json({ message: "Failed to review verification document" });
      }
    }
  );

  app.get(
    "/api/admin/commercial-directory/contractors",
    isAuthenticated,
    isAdmin,
    async (req: AuthedRequest, res: Response) => {
      try {
        const search = String(req.query.search || "")
          .trim()
          .toLowerCase();
        const statusFilter = String(req.query.status || "all")
          .trim()
          .toLowerCase();

        const allContractors = await db
          .select({
            id: contractors.id,
            userId: contractors.userId,
            companyName: contractors.companyName,
            slug: contractors.slug,
            email: contractors.email,
            phone: contractors.phone,
            isActive: contractors.isActive,
            verifiedLicensed: contractors.verifiedLicensed,
            verifiedInsured: contractors.verifiedInsured,
            createdAt: contractors.createdAt,
            updatedAt: contractors.updatedAt,
          })
          .from(contractors)
          .orderBy(desc(contractors.createdAt));

        const filteredBySearch =
          search.length > 0
            ? allContractors.filter((c) => {
                const haystack = `${c.companyName || ""} ${c.email || ""} ${c.phone || ""} ${
                  c.slug || ""
                }`.toLowerCase();
                return haystack.includes(search);
              })
            : allContractors;

        const userIds: string[] = Array.from(
          new Set(
            filteredBySearch
              .map((c) => String(c.userId || "").trim())
              .filter((value): value is string => value.length > 0)
          )
        );
        const verificationSummary =
          userIds.length > 0 ? await storage.getUserVerificationSummary(userIds) : {};

        const rows = await Promise.all(
          filteredBySearch.map(async (c) => {
            const docsState = await getContractorVerificationDocumentState(String(c.id));
            const verification = c.userId
              ? verificationSummary[String(c.userId)] || {
                  hasLicense: false,
                  hasInsurance: false,
                  hasEin: false,
                }
              : { hasLicense: false, hasInsurance: false, hasEin: false };

            const hasLicense =
              (verification?.hasLicense || Boolean(c.verifiedLicensed)) &&
              docsState.hasApprovedLicenseDoc;
            const hasInsurance =
              (verification?.hasInsurance || Boolean(c.verifiedInsured)) &&
              docsState.hasApprovedInsuranceDoc;
            const isActive = c.isActive !== false;
            const eligibleForCommercial = hasLicense && hasInsurance && isActive;

            const pendingDocs = docsState.docs.filter((d) => d.status === "pending").length;
            const rejectedDocs = docsState.docs.filter((d) => d.status === "rejected").length;

            return {
              contractor: c,
              verification: {
                hasLicense,
                hasInsurance,
                hasApprovedLicenseDoc: docsState.hasApprovedLicenseDoc,
                hasApprovedInsuranceDoc: docsState.hasApprovedInsuranceDoc,
                isActive,
                eligibleForCommercial,
                pendingDocs,
                rejectedDocs,
              },
              documents: docsState.docs.filter(
                (d) => d.type === "license" || d.type === "insurance"
              ),
            };
          })
        );

        const filteredByStatus =
          statusFilter === "all"
            ? rows
            : rows.filter((row) => {
                if (statusFilter === "eligible") return row.verification.eligibleForCommercial;
                if (statusFilter === "ineligible") return !row.verification.eligibleForCommercial;
                if (statusFilter === "pending") return row.verification.pendingDocs > 0;
                if (statusFilter === "suspended") return !row.verification.isActive;
                return true;
              });

        return res.json(filteredByStatus);
      } catch (error: any) {
        console.error("Error loading commercial contractors:", error);
        return res.status(500).json({ message: "Failed to load commercial contractors" });
      }
    }
  );

  app.patch(
    "/api/admin/commercial-directory/contractors/:id/status",
    isAuthenticated,
    isAdmin,
    async (req: AuthedRequest, res: Response) => {
      try {
        const contractorId = String(req.params.id || "");
        if (!contractorId) return res.status(400).json({ message: "Contractor ID required" });
        const payload = updateCommercialContractorStatusSchema.parse(req.body ?? {});

        const [updated] = await db
          .update(contractors)
          .set({
            isActive: payload.isActive,
            updatedAt: new Date(),
          })
          .where(eq(contractors.id, contractorId))
          .returning();

        if (!updated) return res.status(404).json({ message: "Contractor not found" });
        return res.json(updated);
      } catch (error: any) {
        if (error instanceof z.ZodError) {
          return res.status(400).json({ message: "Invalid payload", errors: error.flatten() });
        }
        console.error("Error updating commercial contractor status:", error);
        return res.status(500).json({ message: "Failed to update contractor status" });
      }
    }
  );

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
          .where(
            sql`NOT (
              ${commercialProjects.title} ~* '(mock|demo|sample|test|placeholder)'
              OR ${commercialProjects.summary} ~* '(mock|demo|sample|test|placeholder)'
              OR ${commercialProjects.slug} ~* '(mock|demo|sample|test|placeholder)'
            )`
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

        const uploadRoot = runtimePaths.publicUploads;
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
            if (
              containsForbiddenCommercialSeedText(
                parsed.title,
                parsed.summary,
                parsed.scopeOfWork,
                parsed.requirements,
                parsed.campaignHeadline,
                parsed.campaignBody
              )
            ) {
              return res.status(400).json({
                message:
                  "Mock/demo/sample/test content is not allowed in commercial project records.",
              });
            }
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
        const uploadRoot = runtimePaths.publicUploads;
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
              userId: contractors.userId,
              companyName: contractors.companyName,
              slug: contractors.slug,
              isActive: contractors.isActive,
              verifiedLicensed: contractors.verifiedLicensed,
              verifiedInsured: contractors.verifiedInsured,
            },
          })
          .from(commercialProjectBids)
          .leftJoin(contractors, eq(contractors.id, commercialProjectBids.contractorId))
          .where(eq(commercialProjectBids.projectId, id))
          .orderBy(desc(commercialProjectBids.createdAt));

        const bidderUserIds: string[] = Array.from(
          new Set(
            bids
              .map((row) => String((row.bid as any).bidderUserId || "").trim())
              .filter((value): value is string => value.length > 0)
          )
        );
        const verificationSummary =
          bidderUserIds.length > 0 ? await storage.getUserVerificationSummary(bidderUserIds) : {};

        const contractorIds: string[] = Array.from(
          new Set(
            bids
              .map((row) => String((row.contractor as any)?.id || "").trim())
              .filter((value): value is string => value.length > 0)
          )
        );
        const docsStateByContractorId = new Map<
          string,
          { hasApprovedLicenseDoc: boolean; hasApprovedInsuranceDoc: boolean }
        >();
        for (const contractorId of contractorIds) {
          const state = await getContractorVerificationDocumentState(contractorId);
          docsStateByContractorId.set(contractorId, {
            hasApprovedLicenseDoc: state.hasApprovedLicenseDoc,
            hasApprovedInsuranceDoc: state.hasApprovedInsuranceDoc,
          });
        }

        const withEligibility = bids.map((row) => {
          const bidderUserId = String((row.bid as any).bidderUserId || "").trim();
          const verification =
            bidderUserId.length > 0
              ? verificationSummary[bidderUserId] || {
                  hasLicense: false,
                  hasInsurance: false,
                  hasEin: false,
                }
              : null;
          const contractorId = String((row.contractor as any)?.id || "").trim();
          const docState = contractorId ? docsStateByContractorId.get(contractorId) : null;
          const eligibility = toBidEligibilitySnapshot({
            contractor: row.contractor,
            verification,
            hasApprovedLicenseDoc: docState?.hasApprovedLicenseDoc,
            hasApprovedInsuranceDoc: docState?.hasApprovedInsuranceDoc,
          });

          return {
            ...row,
            eligibility,
          };
        });

        res.json(withEligibility);
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

          if (action !== "reject") {
            const bidderUserId = String((bid as any).bidderUserId || "");
            const contractorId = String((bid as any).contractorId || "");
            const activeContractor = bidderUserId
              ? await getVerifiedContractorForUser(bidderUserId)
              : null;
            if (!activeContractor || String((activeContractor as any).id) !== contractorId) {
              return {
                status: 400 as const,
                body: {
                  message: "Contractor is no longer verified and cannot be shortlisted or awarded.",
                },
              };
            }
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

        const countyFips =
          typeof req.query.countyFips === "string" && req.query.countyFips.length === 5
            ? req.query.countyFips
            : null;

        const whereClause = countyFips
          ? and(
              eq(commercialProjects.status, "open"),
              eq(commercialProjects.countyFips, countyFips),
              sql`NOT (
                ${commercialProjects.title} ~* '(mock|demo|sample|test|placeholder)'
                OR ${commercialProjects.summary} ~* '(mock|demo|sample|test|placeholder)'
                OR ${commercialProjects.slug} ~* '(mock|demo|sample|test|placeholder)'
              )`
            )
          : and(
              eq(commercialProjects.status, "open"),
              sql`NOT (
                ${commercialProjects.title} ~* '(mock|demo|sample|test|placeholder)'
                OR ${commercialProjects.summary} ~* '(mock|demo|sample|test|placeholder)'
                OR ${commercialProjects.slug} ~* '(mock|demo|sample|test|placeholder)'
              )`
            );

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

        let contractorId: string | null = null;
        let submissionAccess = {
          canBid: false,
          hasContractorProfile: false,
          isVerifiedForCommercial: false,
          requires: ["contractor_profile", "approved_license", "approved_insurance"] as string[],
          message:
            "You can review this opportunity now. Create or complete your contractor verification to bid.",
        };

        const contractorProfile = await storage.getContractorByUserId(userId);
        if (contractorProfile?.id) {
          contractorId = String((contractorProfile as any).id);
          const docsState = await getContractorVerificationDocumentState(contractorId);
          const requires: string[] = [];
          if (!docsState.hasApprovedLicenseDoc) requires.push("approved_license");
          if (!docsState.hasApprovedInsuranceDoc) requires.push("approved_insurance");

          submissionAccess = {
            canBid: requires.length === 0,
            hasContractorProfile: true,
            isVerifiedForCommercial: requires.length === 0,
            requires,
            message:
              requires.length === 0
                ? "Commercial verification is complete for bid submission."
                : "Review this opportunity now. Approval of the required verification documents is still needed before bid submission.",
          };
        }

        const [project] = await db
          .select()
          .from(commercialProjects)
          .where(eq(commercialProjects.id, projectId))
          .limit(1);
        if (!project) return res.status(404).json({ message: "Project not found" });
        if (
          containsForbiddenCommercialSeedText(
            (project as any).title,
            (project as any).summary,
            (project as any).slug
          )
        ) {
          return res.status(404).json({ message: "Project not found" });
        }

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
          submissionAccess,
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
      if (
        containsForbiddenCommercialSeedText(
          (project as any).title,
          (project as any).summary,
          (project as any).slug
        )
      ) {
        return res.status(404).json({ message: "Not found" });
      }

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
