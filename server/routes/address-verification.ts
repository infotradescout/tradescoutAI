import type { Express } from "express";
import { and, desc, eq } from "drizzle-orm";
import { isAuthenticated, isAdmin } from "../auth";
import { db } from "../db";
import { storage } from "../storage";
import {
  addressVerifications,
  users,
  addressVerificationSubmissionSchema,
  addressVerificationReviewSchema,
} from "@shared/schema";
import { isOwnedPrivateObjectKey } from "../services/businessVerificationWorkflow";
import {
  assertAddressVerificationEvidence,
  getAddressVerificationEvidenceDownload,
  isAddressVerificationEvidenceKey,
} from "../services/addressVerificationEvidence";
import { withAddressEvidenceTransaction } from "../services/addressVerificationEvidenceTransaction";

export function registerAddressVerificationRoutes(app: Express) {
  // Address Verification Endpoints
  app.post("/api/address-verification", isAuthenticated, async (req: any, res: any) => {
    try {
      const userId = String(req.user?.id || "").trim();
      if (!userId) return res.status(401).json({ message: "Sign in to submit verification" });
      if (["postcard", "phone_verification"].includes(req.body?.verificationMethod)) {
        return res.status(503).json({
          code: "ADDRESS_VERIFICATION_METHOD_UNAVAILABLE",
          message: "Postcard and phone verification are unavailable. Submit a document for review.",
        });
      }
      const parsedAddress = addressVerificationSubmissionSchema.safeParse(req.body);
      if (!parsedAddress.success) {
        return res.status(400).json({
          message: "Invalid address verification payload",
          issues: parsedAddress.error.issues,
        });
      }

      if (!isOwnedPrivateObjectKey(parsedAddress.data.documentUrl, userId)) {
        return res
          .status(400)
          .json({ message: "Upload your document using the private upload form" });
      }
      const result = await withAddressEvidenceTransaction(userId, async (tx, snapshotEvidence) => {
        // All submission/review writes lock the account before its verification.
        const [user] = await tx.select().from(users).where(eq(users.id, userId)).for("update");
        if (!user) return { status: 401, body: { message: "Account not found" } };
        if (user.addressVerified) {
          return { status: 409, body: { message: "Your address is already verified" } };
        }
        const [existing] = await tx
          .select()
          .from(addressVerifications)
          .where(eq(addressVerifications.userId, userId))
          .orderBy(desc(addressVerifications.createdAt))
          .limit(1)
          .for("update");
        if (existing) {
          return {
            status: 409,
            body: { message: "Refresh and update your existing verification" },
          };
        }
        const deadline = new Date(user.createdAt!);
        if (!Number.isFinite(deadline.getTime()))
          throw new Error("Account creation date unavailable");
        deadline.setUTCDate(deadline.getUTCDate() + 14);
        const documentUrl = await snapshotEvidence(
          parsedAddress.data.documentUrl,
          parsedAddress.data.documentType
        );
        const [verification] = await tx
          .insert(addressVerifications)
          .values({
            ...parsedAddress.data,
            documentUrl,
            userId,
            deadline,
            status: "submitted",
            submittedAt: new Date(),
          })
          .returning();
        return { status: 201, body: { id: verification.id, status: verification.status } };
      });
      res.status(result.status).json(result.body);
    } catch (error: any) {
      console.error("Error creating address verification:", error);
      res.status(400).json({ message: "Failed to create address verification" });
    }
  });

  app.get("/api/address-verification/status", isAuthenticated, async (req: any, res: any) => {
    try {
      const userId = String(req.user?.id || "").trim();
      if (!userId) return res.status(401).json({ message: "Sign in to view verification" });
      const user = await storage.getUser(userId);
      if (!user) return res.status(401).json({ message: "Account not found" });
      const verification = await storage.getAddressVerificationByUserId(userId);

      // Calculate deadline if no verification exists
      const deadline = new Date(verification?.deadline || user.createdAt!);
      if (!verification) deadline.setUTCDate(deadline.getUTCDate() + 14);
      if (!Number.isFinite(deadline.getTime()))
        throw new Error("Verification deadline unavailable");

      const daysRemaining = Math.max(
        0,
        Math.ceil((deadline.getTime() - Date.now()) / (1000 * 60 * 60 * 24))
      );
      const isExpired = daysRemaining === 0 && !user.addressVerified;

      res.setHeader("Cache-Control", "private, no-store");
      res.json({
        verification: verification
          ? {
              id: verification.id,
              fullAddress: verification.fullAddress,
              city: verification.city,
              state: verification.state,
              zipCode: verification.zipCode,
              verificationMethod: verification.verificationMethod,
              status: verification.status,
              hasDocument: isAddressVerificationEvidenceKey(verification.documentUrl, userId),
              submittedAt: verification.submittedAt,
              rejectionReason: verification.rejectionReason,
            }
          : null,
        isVerified: user.addressVerified || false,
        deadline: deadline.toISOString(),
        daysRemaining,
        isExpired,
        requiresVerification: !user.addressVerified,
      });
    } catch (error: any) {
      console.error("Error fetching address verification status:", error);
      res.status(500).json({ message: "Failed to fetch verification status" });
    }
  });

  app.post(
    "/api/address-verification/postcard/request",
    isAuthenticated,
    async (req: any, res: any) => {
      return res.status(503).json({
        code: "ADDRESS_VERIFICATION_METHOD_UNAVAILABLE",
        message:
          "Postcard verification is unavailable. No postcard was sent. Submit a document for review.",
      });
    }
  );

  app.post(
    "/api/address-verification/postcard/verify",
    isAuthenticated,
    async (req: any, res: any) => {
      return res.status(503).json({
        code: "ADDRESS_VERIFICATION_METHOD_UNAVAILABLE",
        message: "Postcard verification is unavailable. Submit a document for review.",
        verified: false,
      });
    }
  );

  app.put("/api/address-verification/:id", isAuthenticated, async (req: any, res: any) => {
    try {
      const userId = String(req.user?.id || "").trim();
      const id = String(req.params.id || "").trim();
      if (!userId) return res.status(401).json({ message: "Sign in to submit verification" });
      if (["postcard", "phone_verification"].includes(req.body?.verificationMethod)) {
        return res.status(503).json({
          code: "ADDRESS_VERIFICATION_METHOD_UNAVAILABLE",
          message: "Postcard and phone verification are unavailable. Submit a document for review.",
        });
      }
      const parsedAddress = addressVerificationSubmissionSchema.safeParse(req.body);
      if (!parsedAddress.success) {
        return res.status(400).json({
          message: "Invalid address verification payload",
          issues: parsedAddress.error.issues,
        });
      }
      if (!isOwnedPrivateObjectKey(parsedAddress.data.documentUrl, userId)) {
        return res
          .status(400)
          .json({ message: "Upload your document using the private upload form" });
      }
      const result = await withAddressEvidenceTransaction(userId, async (tx, snapshotEvidence) => {
        const [user] = await tx.select().from(users).where(eq(users.id, userId)).for("update");
        if (!user) return { status: 401, body: { message: "Account not found" } };
        const [existing] = await tx
          .select()
          .from(addressVerifications)
          .where(eq(addressVerifications.userId, userId))
          .orderBy(desc(addressVerifications.createdAt))
          .limit(1)
          .for("update");
        if (!existing || existing.id !== id) {
          return { status: 403, body: { message: "Not authorized to update this verification" } };
        }
        if (user.addressVerified || existing.status === "approved") {
          return {
            status: 409,
            body: { message: "An approved verification cannot be replaced here" },
          };
        }
        const documentUrl = await snapshotEvidence(
          parsedAddress.data.documentUrl,
          parsedAddress.data.documentType
        );
        const [verification] = await tx
          .update(addressVerifications)
          .set({
            ...parsedAddress.data,
            documentUrl,
            submittedAt: new Date(),
            updatedAt: new Date(),
            status: "submitted",
            reviewedBy: null,
            reviewedAt: null,
            approvedAt: null,
            rejectionReason: null,
            adminNotes: null,
            postcardCode: null,
            postcardSentAt: null,
            postcardVerifiedAt: null,
            phoneVerificationCode: null,
            phoneVerifiedAt: null,
          })
          .where(and(eq(addressVerifications.id, id), eq(addressVerifications.userId, userId)))
          .returning();
        return { status: 200, body: { id: verification.id, status: verification.status } };
      });
      res.status(result.status).json(result.body);
    } catch (error: any) {
      console.error("Error updating address verification:", error);
      res.status(400).json({ message: "Failed to update verification" });
    }
  });

  // Admin endpoints for address verification
  app.get(
    "/api/admin/address-verifications",
    isAuthenticated,
    isAdmin,
    async (req: any, res: any) => {
      try {
        const status = (req.query.status as string) || "all";

        let query: any = db
          .select({
            verification: addressVerifications,
            user: {
              id: users.id,
              email: users.email,
              firstName: users.firstName,
              lastName: users.lastName,
              addressVerified: users.addressVerified,
            },
          })
          .from(addressVerifications)
          .leftJoin(users, eq(addressVerifications.userId, users.id));

        if (status !== "all") {
          const allowedStatuses = [
            "pending",
            "approved",
            "rejected",
            "expired",
            "submitted",
          ] as const;
          if (allowedStatuses.includes(status as (typeof allowedStatuses)[number])) {
            query = query.where(
              eq(addressVerifications.status, status as (typeof allowedStatuses)[number])
            );
          }
        }

        const results = await query.orderBy(desc(addressVerifications.createdAt));

        res.setHeader("Cache-Control", "private, no-store");
        res.json(
          results.map(({ verification, user }: any) => {
            const { postcardCode, phoneVerificationCode, documentUrl, ...reviewRecord } =
              verification;
            return {
              verification: {
                ...reviewRecord,
                hasDocument: isAddressVerificationEvidenceKey(documentUrl, verification.userId),
              },
              user,
            };
          })
        );
      } catch (error: any) {
        console.error("Error fetching address verifications:", error);
        res.status(500).json({ message: "Failed to fetch verifications" });
      }
    }
  );

  app.put(
    "/api/admin/address-verifications/:id",
    isAuthenticated,
    isAdmin,
    async (req: any, res: any) => {
      try {
        const id = String(req.params.id || "").trim();
        const parsedReview = addressVerificationReviewSchema.safeParse(req.body);
        if (!parsedReview.success) {
          return res
            .status(400)
            .json({ message: "Invalid review decision", issues: parsedReview.error.issues });
        }
        const [located] = await db
          .select()
          .from(addressVerifications)
          .where(eq(addressVerifications.id, id))
          .limit(1);
        if (!located) return res.status(404).json({ message: "Verification not found" });
        const result = await db.transaction(async (tx) => {
          const [user] = await tx
            .select()
            .from(users)
            .where(eq(users.id, located.userId))
            .for("update");
          if (!user) return { status: 404, body: { message: "Account not found" } };
          const [verification] = await tx
            .select()
            .from(addressVerifications)
            .where(eq(addressVerifications.userId, user.id))
            .orderBy(desc(addressVerifications.createdAt))
            .limit(1)
            .for("update");
          if (!verification || verification.id !== id || verification.userId !== user.id) {
            return {
              status: 409,
              body: { message: "Verification changed. Refresh before reviewing." },
            };
          }
          const expected = parsedReview.data.expectedUpdatedAt;
          const current = verification.updatedAt?.toISOString() ?? null;
          if ((expected ? new Date(expected).toISOString() : null) !== current) {
            return {
              status: 409,
              body: {
                message: "This submission changed. Refresh and review the current document.",
              },
            };
          }
          const { status, adminNotes, rejectionReason } = parsedReview.data;
          if (status === "approved") {
            const evidence = addressVerificationSubmissionSchema.safeParse({
              fullAddress: verification.fullAddress,
              city: verification.city,
              state: verification.state,
              zipCode: verification.zipCode,
              verificationMethod: verification.verificationMethod,
              documentUrl: verification.documentUrl,
              documentType: verification.documentType,
            });
            if (
              !evidence.success ||
              !isAddressVerificationEvidenceKey(verification.documentUrl, user.id)
            ) {
              return {
                status: 409,
                body: { message: "A private address document is required before approval" },
              };
            }
            await assertAddressVerificationEvidence(
              verification.documentUrl,
              user.id,
              evidence.data.documentType
            );
          }
          const now = new Date();
          const [updated] = await tx
            .update(addressVerifications)
            .set({
              status,
              adminNotes,
              rejectionReason: status === "rejected" ? rejectionReason : null,
              reviewedBy: req.user.id,
              reviewedAt: now,
              approvedAt: status === "approved" ? now : null,
              updatedAt: now,
            })
            .where(eq(addressVerifications.id, id))
            .returning();
          if (status === "approved" || verification.status === "approved") {
            await tx
              .update(users)
              .set({ addressVerified: status === "approved", updatedAt: now })
              .where(eq(users.id, user.id));
          }
          return { status: 200, body: { id: updated.id, status: updated.status } };
        });
        res.status(result.status).json(result.body);
      } catch (error: any) {
        console.error("Error updating address verification:", error);
        res.status(400).json({ message: "Failed to update verification" });
      }
    }
  );

  app.get(
    "/api/admin/address-verifications/:id/document",
    isAuthenticated,
    isAdmin,
    async (req: any, res: any) => {
      try {
        const id = String(req.params.id || "").trim();
        const [verification] = await db
          .select()
          .from(addressVerifications)
          .where(eq(addressVerifications.id, id))
          .limit(1);
        if (
          !verification ||
          !isAddressVerificationEvidenceKey(verification.documentUrl, verification.userId)
        ) {
          return res.status(404).json({ message: "Verification document not found" });
        }
        const extensions: Record<string, string> = {
          "application/pdf": "pdf",
          "image/jpeg": "jpg",
          "image/png": "png",
        };
        const extension = extensions[verification.documentType || ""];
        if (!extension) return res.status(404).json({ message: "Verification document not found" });
        const filename = `address-verification-document.${extension}`;
        res.setHeader("Cache-Control", "private, no-store");
        res.setHeader("X-Content-Type-Options", "nosniff");
        const document = await getAddressVerificationEvidenceDownload(
          verification.documentUrl,
          verification.userId,
          verification.documentType!,
          filename
        );
        if ("url" in document) return res.redirect(302, document.url);
        return res.download(document.filePath, filename);
      } catch (error) {
        console.error("Error downloading address verification document:", error);
        return res.status(500).json({ message: "Failed to download verification document" });
      }
    }
  );
}
