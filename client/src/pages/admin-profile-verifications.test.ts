// @vitest-environment jsdom

import { describe, expect, it } from "vitest";
import { businessFieldsFor } from "./admin-profile-verifications";

describe("business verification queue field mapping", () => {
  it("uses the server's snake-case requirement and document keys", () => {
    const fields = businessFieldsFor({
      verificationRequirements: {
        business_registration: true,
        tax_id: true,
      },
      fieldReview: {
        business_registration: { required: true, status: "submitted" },
        tax_id: { required: true, status: "submitted" },
      },
      verificationSubmissions: { taxId: "****1234" },
      documentUrls: {
        business_registration:
          "/api/admin/profile-verifications/profile_1/documents/business_registration",
      },
    });

    expect(fields.map((field) => field.key)).toEqual(["business_registration", "tax_id"]);
    expect(fields[0]).toMatchObject({
      hasEvidence: true,
      canReview: true,
      status: "pending",
    });
    expect(fields[1]).toMatchObject({
      hasEvidence: true,
      canReview: true,
      status: "pending",
    });
  });

  it("does not enable a required field that has no submitted evidence", () => {
    expect(
      businessFieldsFor({
        verificationRequirements: { insurance: true },
        fieldReview: { insurance: { required: true, status: "pending" } },
        documentUrls: {},
      })
    ).toContainEqual(
      expect.objectContaining({
        key: "insurance",
        hasEvidence: false,
        canReview: false,
      })
    );
  });

  it("keeps prior field-specific rejections visible", () => {
    expect(
      businessFieldsFor({
        fieldReview: {
          license: {
            required: true,
            status: "rejected",
            rejectionReason: "Upload a current license document.",
          },
        },
      })
    ).toContainEqual(
      expect.objectContaining({
        key: "license",
        status: "rejected",
        rejectionReason: "Upload a current license document.",
      })
    );
  });
});
