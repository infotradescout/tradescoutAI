import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

const read = (relativePath: string) =>
  fs.readFileSync(path.resolve(process.cwd(), relativePath), "utf8");

const shellSource = read("client/src/pages/direct-connect/DirectConnectShell.tsx");
const entrySource = read("client/src/pages/direct-connect/directConnectEntryContext.ts");
const routeSource = read("server/routes/direct-connect.ts");
const profileRoutingSource = read("server/services/directConnectProfileTargetingService.ts");
const profileRepositorySource = read("server/repositories/profileRepository.ts");

describe("Direct Connect anonymous and profile entry golden paths", () => {
  it("preserves public-profile identity from entry through the create payload", () => {
    expect(entrySource).toContain('const profileSlug = readFirst(params, "profile")');
    expect(entrySource).toContain('contextType = "profile"');
    expect(entrySource).toContain("contextId = profileSlug");
    expect(shellSource).toContain('prefillContextType === "profile"');
    expect(shellSource).toContain("payload.targetProfileSlug = targetProfileSlug");
    expect(shellSource).toContain("payload.autoRoute = false");
  });

  it("targets only a currently public profile and its canonical owner", () => {
    expect(routeSource).toContain("storage.getProfileBySlugPublic(body.targetProfileSlug)");
    expect(routeSource).toContain("storage.getProfileOwnerUserId(targetProfile.id)");
    expect(routeSource).toContain('code: "TARGET_PROFILE_NOT_FOUND"');
    expect(routeSource).toContain('code: "TARGET_PROFILE_IS_REQUESTER"');
    expect(profileRepositorySource).toContain("canServePublishedProfileAtDirectRoute({");
  });

  it("repairs or creates the exact profile invitation before an idempotent replay returns", () => {
    const ensureIndex = routeSource.indexOf("await ensureDirectConnectProfileInvitation({");
    const replayIndex = routeSource.indexOf("if (creation.replayed)");
    expect(ensureIndex).toBeGreaterThan(-1);
    expect(replayIndex).toBeGreaterThan(ensureIndex);
    expect(profileRoutingSource).toContain("FOR UPDATE");
    expect(profileRoutingSource).toContain(
      "eq(workRequestAssignments.responderUserId, args.targetProfileOwnerUserId)"
    );
    expect(profileRoutingSource).toContain(
      'reasons: ["requester_selected_published_profile"]'
    );
    expect(profileRoutingSource).toContain('routingMode: "profile_direct_connect"');
    expect(profileRoutingSource).toContain('eq(workRequests.status, "open")');
  });

  it("keeps the vehicle-service and real-estate intent lanes active", () => {
    expect(entrySource).toContain('| "vehicle_service"');
    expect(entrySource).toContain('| "property_real_estate"');
    expect(entrySource).toContain('vehicle_service: "vehicle_service"');
    expect(entrySource).toContain('property_real_estate: "property_real_estate"');
  });
});
