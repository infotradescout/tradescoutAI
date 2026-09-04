import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { resolveConversationContactGate } from "../social-features";

describe("social conversation durable contact gate", () => {
  it.each([
    ["accepted", "accepted"],
    ["pending", "pending"],
    ["declined", "denied"],
    ["blocked", "denied"],
    [null, "request_required"],
    ["unknown", "request_required"],
  ] as const)("maps permission state %s to %s", (status, expected) => {
    expect(resolveConversationContactGate(status)).toBe(expected);
  });

  it("checks durable permission before an old thread and never lets the requester self-accept", () => {
    const source = fs.readFileSync(
      path.resolve(process.cwd(), "server/social-features.ts"),
      "utf8"
    );
    const start = source.indexOf('"/api/social/conversations/start"');
    const end = source.indexOf('"/api/social/conversations/requests/incoming"', start);
    const route = source.slice(start, end);
    const permissionRead = route.indexOf(
      "const permission = await getContactPermission(userId, targetUserId)"
    );
    const existingRead = route.indexOf("const [existing] = await db");

    expect(permissionRead).toBeGreaterThanOrEqual(0);
    expect(existingRead).toBeGreaterThan(permissionRead);
    expect(route).toContain('permissionGate === "pending"');
    expect(route).toContain('permissionGate === "denied"');
    expect(route).toContain('existing && permissionGate === "accepted"');
    expect(route).toContain('ensure.status !== "accepted"');
    expect(route).not.toContain("auto_accepted_existing_conversation");
    expect(route).not.toContain('responseReason: "conversation_started"');
    expect(route).not.toContain("respondedBy: userId");
  });
});
