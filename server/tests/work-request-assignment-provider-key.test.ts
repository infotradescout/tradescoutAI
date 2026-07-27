import { describe, expect, it } from "vitest";
import { buildWorkRequestAssignmentProviderKey } from "../utils/workRequestAssignmentProviderKey";

describe("work request assignment provider key", () => {
  it("keeps businesses owned by the same user distinct", () => {
    expect(buildWorkRequestAssignmentProviderKey("business", "business-a")).toBe(
      "business:business-a"
    );
    expect(buildWorkRequestAssignmentProviderKey("business", "business-b")).toBe(
      "business:business-b"
    );
  });

  it("keeps provider namespaces distinct", () => {
    expect(buildWorkRequestAssignmentProviderKey("contractor", "shared-id")).not.toBe(
      buildWorkRequestAssignmentProviderKey("worker", "shared-id")
    );
  });

  it("rejects missing provider identities", () => {
    expect(() => buildWorkRequestAssignmentProviderKey("responder", " ")).toThrow(
      "without a provider id"
    );
  });
});
