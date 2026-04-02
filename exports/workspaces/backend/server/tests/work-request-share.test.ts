import { describe, expect, it } from "vitest";
import {
  buildWorkRequestPreviewTitle,
  buildWorkRequestScopeSummary,
  redactContactDetails,
} from "../utils/workRequestShare";

describe("work request share redaction", () => {
  it("redacts email and phone from free text", () => {
    const input = "Call me at (555) 123-9876 or email me at owner@example.com";
    const redacted = redactContactDetails(input);
    expect(redacted).not.toContain("555");
    expect(redacted).not.toContain("owner@example.com");
    expect(redacted).toContain("[hidden]");
  });

  it("builds a redacted scope summary", () => {
    const input =
      "Kitchen remodel in Tangipahoa. Contact: 985-555-0000 and demo@tradescout.test for access.";
    const summary = buildWorkRequestScopeSummary(input);
    expect(summary).toContain("Kitchen remodel");
    expect(summary).not.toContain("985-555-0000");
    expect(summary).not.toContain("demo@tradescout.test");
  });

  it("builds a redacted preview title", () => {
    const title = "Roof leak - text me at 225-555-1212";
    const previewTitle = buildWorkRequestPreviewTitle(title, "Shared request");
    expect(previewTitle).toContain("Roof leak");
    expect(previewTitle).not.toContain("225-555-1212");
  });
});
