import type { Express, Request } from "express";
import path from "path";
import fs from "fs";
import rateLimit from "express-rate-limit";
import { pool } from "../db";
import { createPostgresRateLimitStore } from "../utils/postgresRateLimitStore";
import { z } from "zod";
import { emailService } from "../services/emailService";
import { isStaff } from "../auth";
import { storage } from "../storage";
import { PRIMARY_SUPPORT_EMAIL } from "@shared/supportInbox";
import { runtimePaths } from "../runtimePaths";

const hardrockApplyLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 25,
  standardHeaders: true,
  legacyHeaders: false,
  store: createPostgresRateLimitStore({
    pool,
    prefix: "rl:hardrock_apply",
    cleanupIntervalMs: Number(process.env.RATE_LIMIT_CLEANUP_INTERVAL_MS || 10 * 60 * 1000),
  }),
});

export const hardrockApplySchema = z.object({
  companyName: z.string().min(2),
  contactName: z.string().min(2),
  email: z.string().email(),
  phone: z.string().min(10),
  website: z.string().optional(),
  primaryState: z.string().min(1),
  primaryCounty: z.string().min(1),
  serviceRadius: z.string().min(1).optional().default("commercial"),
  yearsInBusiness: z.coerce.number().int().min(0).optional().default(0),
  licenseNumber: z.string().min(1),
  insuranceProvider: z.string().min(1),
  primaryTrade: z.string().min(1),
  specialties: z
    .string()
    .optional()
    .default("")
    .transform((value) =>
      Array.from(
        new Set(
          String(value || "")
            .split(",")
            .map((v) => v.trim())
            .filter(Boolean)
        )
      )
    ),
  about: z.string().min(20),
  preferredContact: z.enum(["phone", "email", "both"]).default("both"),
  agreeToTerms: z
    .preprocess((v) => v === true || v === "true" || v === "1" || v === "on", z.boolean())
    .refine((val) => val === true),
  agreeToVerification: z
    .preprocess((v) => v === true || v === "true" || v === "1" || v === "on", z.boolean())
    .refine((val) => val === true),
  // Honeypot
  companyFax: z.string().optional(),
});

function ensureDir(dir: string) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

export function registerHardrockRoutes(app: Express) {
  // Public landing: accept application without requiring an account.
  app.post("/api/hardrock/apply", hardrockApplyLimiter, async (req, res) => {
    try {
      const multer = (await import("multer")).default;
      const crypto = await import("crypto");

      const uploadRoot = runtimePaths.publicUploads;
      const hardrockRoot = path.join(uploadRoot, "hardrock");
      ensureDir(hardrockRoot);

      const upload = multer({
        storage: multer.diskStorage({
          destination: (_req, _file, cb) => cb(null, hardrockRoot),
          filename: (_req, file, cb) => {
            const ext = path.extname(file.originalname || "").slice(0, 16);
            const name = crypto.randomBytes(16).toString("hex");
            cb(null, `hardrock_${Date.now()}_${name}${ext}`);
          },
        }),
        limits: {
          files: 5,
          fileSize:
            Number.parseInt(process.env.MAX_HARDROCK_UPLOAD_BYTES || "", 10) || 10 * 1024 * 1024,
        },
        fileFilter: (_req, file, cb) => {
          const allowed = new Set(["application/pdf", "image/jpeg", "image/png", "image/webp"]);
          if (!allowed.has(file.mimetype)) {
            return cb(new Error("Unsupported file type"));
          }
          cb(null, true);
        },
      }).array("files", 5);

      upload(req, res, async (err) => {
        if (err) {
          const message = err instanceof Error ? err.message : "Upload failed";
          return res.status(400).json({ success: false, message });
        }

        const validated = hardrockApplySchema.parse(req.body || {});

        if (validated.companyFax && validated.companyFax.trim().length > 0) {
          // Honeypot hit
          return res.status(200).json({ success: true, message: "Received" });
        }

        if (!validated.specialties || validated.specialties.length === 0) {
          return res
            .status(400)
            .json({ success: false, message: "Please add at least one specialty." });
        }

        const application = await storage.createContractorApplication({
          userId: null,
          companyName: validated.companyName,
          email: validated.email.trim().toLowerCase(),
          phone: validated.phone,
          website: validated.website,
          primaryState: validated.primaryState,
          primaryCounty: validated.primaryCounty,
          serviceRadius: validated.serviceRadius || "commercial",
          yearsInBusiness: validated.yearsInBusiness ?? 0,
          licenseNumber: validated.licenseNumber,
          insuranceProvider: validated.insuranceProvider,
          primaryTrade: validated.primaryTrade,
          specialties: validated.specialties,
          about: validated.about,
          preferredContact: validated.preferredContact,
          agreeToTerms: true,
          agreeToVerification: true,
          status: "hardrock_pending",
          starterPath: true,
          verificationStatus: "pending",
        });

        const requestFiles = (req as Request & { files?: unknown }).files;
        const files: Express.Multer.File[] = Array.isArray(requestFiles) ? requestFiles : [];
        const fileUrls = files.map((f) => ({
          filename: f.filename,
          originalName: f.originalname,
          mimeType: f.mimetype,
          bytes: f.size,
          url: `/uploads/hardrock/${f.filename}`,
        }));

        if (fileUrls.length > 0) {
          const existingNotes = application.reviewNotes ? String(application.reviewNotes) : "";
          const meta = {
            source: "hardrock",
            createdAt: new Date().toISOString(),
            contactName: validated.contactName,
            files: fileUrls,
          };
          await storage.updateContractorApplication(application.id, {
            reviewNotes: existingNotes
              ? `${existingNotes}\n\n${JSON.stringify(meta, null, 2)}`
              : JSON.stringify(meta, null, 2),
          });
        }

        const inbox = process.env.HARDROCK_INBOX_EMAIL || PRIMARY_SUPPORT_EMAIL;

        // Notify internal inbox (best-effort)
        try {
          await emailService.sendEmail({
            to: inbox,
            subject: `Hardrock commercial signup: ${validated.companyName}`,
            replyTo: validated.email,
            html: `
              <h2>New Hardrock commercial tradesman signup</h2>
              <p><b>Company</b>: ${validated.companyName}</p>
              <p><b>Contact</b>: ${validated.contactName}</p>
              <p><b>Email</b>: ${validated.email}</p>
              <p><b>Phone</b>: ${validated.phone}</p>
              <p><b>Website</b>: ${validated.website || "(none)"}</p>
              <p><b>Primary trade</b>: ${validated.primaryTrade}</p>
              <p><b>Specialties</b>: ${(validated.specialties || []).join(", ")}</p>
              <p><b>Primary area</b>: ${validated.primaryCounty}, ${validated.primaryState}</p>
              <p><b>Years in business</b>: ${validated.yearsInBusiness ?? 0}</p>
              <p><b>License</b>: ${validated.licenseNumber}</p>
              <p><b>Insurance</b>: ${validated.insuranceProvider}</p>
              <p><b>Preferred contact</b>: ${validated.preferredContact}</p>
              <p><b>About</b>:<br/>${validated.about.replace(/\n/g, "<br/>")}</p>
              ${
                fileUrls.length > 0
                  ? `<p><b>Uploads</b>:</p><ul>${fileUrls
                      .map(
                        (f) =>
                          `<li>${f.originalName} (${f.mimeType}, ${f.bytes} bytes) — ${f.url}</li>`
                      )
                      .join("")}</ul>`
                  : "<p><b>Uploads</b>: (none)</p>"
              }
              <p><b>Application ID</b>: ${application.id}</p>
            `,
            purpose: "hardrock_internal",
          });
        } catch (emailErr) {
          console.error("[hardrock] Failed to email internal inbox", emailErr);
        }

        // Confirmation (best-effort)
        try {
          await emailService.sendEmail({
            to: validated.email,
            subject: "We received your Hardrock commercial signup",
            purpose: "hardrock_confirmation",
            html: `
              <p>Hi ${validated.contactName},</p>
              <p>Thanks for signing up for commercial jobs. We received your info and will follow up shortly.</p>
              <p>If you’d like, you can also create a TradeScout account anytime at /create-account.</p>
              <p>— TradeScout</p>
            `,
          });
        } catch (emailErr) {
          console.error("[hardrock] Failed to email applicant", emailErr);
        }

        return res.status(201).json({
          success: true,
          message: "Submitted successfully",
          applicationId: application.id,
        });
      });
    } catch (error: unknown) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          success: false,
          message: "Invalid form data",
          errors: error.errors,
        });
      }
      console.error("[hardrock] apply error", error);
      return res.status(500).json({ success: false, message: "Submission failed" });
    }
  });

  // Staff/admin directory (read-only-ish for now)
  app.get("/api/staff/hardrock/applications", isStaff, async (req: Request, res) => {
    try {
      const statusParam = req.query["status"];
      const limitParam = req.query["limit"];

      const status = typeof statusParam === "string" ? statusParam : undefined;
      const limit = Number.parseInt(typeof limitParam === "string" ? limitParam : "100", 10);

      const rows = await storage.getContractorApplications({
        statusPrefix: "hardrock_",
        status: status && status.startsWith("hardrock_") ? status : undefined,
        limit: Number.isFinite(limit) ? Math.min(Math.max(limit, 1), 500) : 100,
      });

      res.json(rows);
    } catch (error) {
      console.error("[hardrock] list error", error);
      res.status(500).json({ message: "Failed to load applications" });
    }
  });

  app.put("/api/staff/hardrock/applications/:id", isStaff, async (req: Request, res) => {
    try {
      const id = String(req.params.id || "");
      if (!id) return res.status(400).json({ message: "Missing id" });

      const schema = z.object({
        status: z.string().optional(),
        reviewNotes: z.string().optional(),
        verificationStatus: z.string().optional(),
      });
      const updates = schema.parse(req.body || {});

      if (updates.status && !updates.status.startsWith("hardrock_")) {
        return res.status(400).json({ message: "Invalid status" });
      }

      await storage.updateContractorApplication(id, updates);
      const refreshed = await storage.getContractorApplication(id);
      res.json(refreshed);
    } catch (error: unknown) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid payload", errors: error.errors });
      }
      console.error("[hardrock] update error", error);
      res.status(500).json({ message: "Failed to update application" });
    }
  });
}
