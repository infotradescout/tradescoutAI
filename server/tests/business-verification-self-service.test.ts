import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { LocalStorageService } from "../localStorage";
import { computeVerificationRequirements } from "../services/profileVerificationService";
import {
  adminBusinessVerificationDecisionSchema,
  buildVerificationFieldReviewState,
  deriveOverallBusinessVerificationStatus,
  isOwnedPrivateObjectKey,
  mergeVerificationSubmission,
  profileVerificationSubmissionSchema,
  recordVerificationDecision,
  sanitizeVerificationSubmissions,
} from "../services/businessVerificationWorkflow";

const USER_ID = "owner-1";
const OWNED_KEY = "private/owner-1/123e4567-e89b-12d3-a456-426614174000";

describe("business verification self service", () => {
  it("requires tax ID and registration for generic business profiles", async () => {
    const missingType = await computeVerificationRequirements("business");
    const genericType = await computeVerificationRequirements("business", "generic");
    const serviceProvider = await computeVerificationRequirements("business", "service_provider", [
      "plumber",
    ]);

    expect(missingType.tax_id).toBe(true);
    expect(missingType.business_registration).toBe(true);
    expect(genericType.tax_id).toBe(true);
    expect(genericType.business_registration).toBe(true);
    expect(serviceProvider.license).toBe(true);
    expect(serviceProvider.insurance).toBe(true);
    expect(serviceProvider.tax_id).toBe(false);
    expect(serviceProvider.business_registration).toBe(false);
  });

  it("accepts only user-owned private object keys", () => {
    expect(isOwnedPrivateObjectKey(OWNED_KEY, USER_ID)).toBe(true);
    expect(
      isOwnedPrivateObjectKey("private/other-user/123e4567-e89b-12d3-a456-426614174000", USER_ID)
    ).toBe(false);
    expect(isOwnedPrivateObjectKey("private/123e4567-e89b-12d3-a456-426614174000", USER_ID)).toBe(
      false
    );
    expect(isOwnedPrivateObjectKey("private/owner-1/../../secret", USER_ID)).toBe(false);
  });

  it("generates user-scoped local private upload keys and routes", async () => {
    const storage = new LocalStorageService();
    const upload = await storage.getPrivateUploadURL("owner|1");

    expect(upload.objectKey).toMatch(
      /^private\/owner1\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    );
    expect(upload.uploadURL).toBe(`/api/objects/upload-private/${upload.objectKey.slice(8)}`);
    expect(isOwnedPrivateObjectKey(upload.objectKey, "owner|1")).toBe(true);
  });

  it("rejects raw tax IDs and never returns a legacy raw tax ID", () => {
    expect(profileVerificationSubmissionSchema.safeParse({ taxId: "12-3456789" }).success).toBe(
      false
    );
    expect(profileVerificationSubmissionSchema.safeParse({ taxIdLast4: "6789" }).success).toBe(
      true
    );

    const sanitized = sanitizeVerificationSubmissions({
      taxId: "12-3456789",
      taxDocumentObjectKey: OWNED_KEY,
    });
    expect(sanitized.taxIdLast4).toBe("6789");
    expect(sanitized).not.toHaveProperty("taxId");
    expect(sanitized).not.toHaveProperty("taxDocumentObjectKey");
    expect(sanitized.evidence.taxDocument).toBe(true);
  });

  it("records submitted and rejected field transitions with a reason", () => {
    const submitted = mergeVerificationSubmission(
      {},
      { taxIdLast4: "6789", taxDocumentObjectKey: OWNED_KEY },
      "2026-08-22T12:00:00.000Z"
    );
    expect(submitted.fieldReview?.tax_id?.status).toBe("submitted");

    const rejected = recordVerificationDecision({
      submissions: submitted,
      field: "tax_id",
      decision: "rejected",
      reviewerId: "admin-1",
      reviewedAt: "2026-08-22T13:00:00.000Z",
      rejectionReason: "The submitted document does not match the business name.",
    });
    expect(rejected.fieldReview?.tax_id).toMatchObject({
      status: "rejected",
      reviewedBy: "admin-1",
      rejectionReason: "The submitted document does not match the business name.",
    });
    expect(
      adminBusinessVerificationDecisionSchema.safeParse({
        field: "tax_id",
        decision: "rejected",
        rejectionReason: "Too short",
      }).success
    ).toBe(false);
  });

  it("derives pending, approved, and rejected deterministically", () => {
    const requirements = {
      email: true,
      address: true,
      license: false,
      insurance: false,
      tax_id: true,
      business_registration: true,
    };
    const baseStatus = {
      email: true,
      address: true,
      license: false,
      insurance: false,
      tax_id: true,
      business_registration: false,
    };
    const submittedRegistration = mergeVerificationSubmission(
      {},
      { businessRegistrationDocObjectKey: OWNED_KEY },
      "2026-08-22T12:00:00.000Z"
    );
    const pendingFields = buildVerificationFieldReviewState({
      requirements,
      status: baseStatus,
      submissions: submittedRegistration,
    });
    expect(
      deriveOverallBusinessVerificationStatus({ requirements, fieldReviewState: pendingFields })
    ).toBe("pending");

    const approvedFields = buildVerificationFieldReviewState({
      requirements,
      status: { ...baseStatus, business_registration: true },
      submissions: submittedRegistration,
    });
    expect(
      deriveOverallBusinessVerificationStatus({ requirements, fieldReviewState: approvedFields })
    ).toBe("approved");

    const rejectedRegistration = recordVerificationDecision({
      submissions: submittedRegistration,
      field: "business_registration",
      decision: "rejected",
      reviewerId: "admin-1",
      reviewedAt: "2026-08-22T13:00:00.000Z",
      rejectionReason: "The registration document is expired and cannot be accepted.",
    });
    const rejectedFields = buildVerificationFieldReviewState({
      requirements,
      status: baseStatus,
      submissions: rejectedRegistration,
    });
    expect(
      deriveOverallBusinessVerificationStatus({ requirements, fieldReviewState: rejectedFields })
    ).toBe("rejected");
  });
});

describe("business verification impersonation bypass wiring", () => {
  it("uses the request-aware bypass in both owner verification routes", () => {
    const source = fs.readFileSync(path.resolve(process.cwd(), "server/routes.ts"), "utf8");

    expect(source.match(/hasRequestPrivilegedVerificationBypass\(req\)/g)).toHaveLength(2);
    expect(source).not.toContain("hasBusinessVerificationBypass(req.user)");
  });
});
