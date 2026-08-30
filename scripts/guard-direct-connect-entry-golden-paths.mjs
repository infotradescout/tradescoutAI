import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), "utf8");
const shell = read("client/src/pages/direct-connect/DirectConnectShell.tsx");
const workspace = read("client/src/pages/direct-connect/directConnectWorkspaceState.ts");
const entry = read("client/src/pages/direct-connect/directConnectEntryContext.ts");
const route = read("server/routes/direct-connect.ts");
const profileRouting = read("server/services/directConnectProfileTargetingService.ts");
const profileRepository = read("server/repositories/profileRepository.ts");

const failures = [];
let checks = 0;
const requireText = (source, value, label) => {
  checks += 1;
  if (!source.includes(value)) failures.push(`${label}: missing ${JSON.stringify(value)}`);
};
const requireOrder = (source, first, second, label) => {
  checks += 1;
  const firstIndex = source.indexOf(first);
  const secondIndex = source.indexOf(second);
  if (firstIndex < 0 || secondIndex <= firstIndex) {
    failures.push(`${label}: expected ordered anchors`);
  }
};

requireText(workspace, "export function buildDirectConnectAuthHandoffHref", "auth helper");
requireText(workspace, "parsed.origin === baseOrigin", "same-origin auth return");
requireText(workspace, 'getDirectConnectWorkspaceTask(parsed.pathname) === "start"', "composer-only return");
requireText(workspace, "canonicalizeDirectConnectWorkspacePathname(parsed.pathname)", "canonical return");
requireText(shell, "authHandoff: !user?.id", "anonymous draft marker");
requireText(shell, "submissionKey,", "stable submission key");
requireText(shell, "entrySignature: currentEntrySignature() || undefined", "entry identity snapshot");
requireText(shell, "navigate(buildDirectConnectAuthHandoffHref(currentReturnPath()))", "bounded auth redirect");
requireText(shell, 'prefillContextType === "profile"', "profile composer");
requireText(shell, "payload.targetProfileSlug = targetProfileSlug", "profile payload");
requireText(shell, "payload.autoRoute = false", "no profile fanout");
requireText(route, "storage.getProfileBySlugPublic(body.targetProfileSlug)", "public target");
requireText(route, "storage.getProfileOwnerUserId(targetProfile.id)", "canonical owner");
requireText(route, 'code: "TARGET_PROFILE_IS_REQUESTER"', "self-target denial");
requireText(profileRepository, "canServePublishedProfileAtDirectRoute({", "publication authority");
requireText(profileRouting, "FOR UPDATE", "serialized profile routing");
requireText(profileRouting, "eq(workRequestAssignments.responderUserId, args.targetProfileOwnerUserId)", "exact responder");
requireText(profileRouting, 'reasons: ["requester_selected_published_profile"]', "routing reason");
requireText(profileRouting, 'eq(workRequests.status, "open")', "non-regressive status update");
requireOrder(route, "await ensureDirectConnectProfileInvitation({", "if (creation.replayed)", "replay repair order");
requireText(entry, '| "vehicle_service"', "car-sales lane");
requireText(entry, 'vehicle_service: "vehicle_service"', "car-sales mapping");
requireText(entry, '| "property_real_estate"', "realtor lane");
requireText(entry, 'property_real_estate: "property_real_estate"', "realtor mapping");

if (failures.length) {
  console.error("Direct Connect entry golden-path guard failed:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}
console.log(`Direct Connect entry golden-path guard passed (${checks} checks).`);
