import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  evaluateImportedDirectoryArchiveAuthority,
  evaluateImportedDirectoryArchiveVerificationState,
  evaluateImportedDirectoryBusinessCardinality,
} from "../services/importedDirectoryArchivePolicy";

const routes = fs
  .readFileSync(path.resolve(process.cwd(), "server/routes.ts"), "utf8")
  .replace(/\r\n/g, "\n");

function section(startMarker: string, endMarker: string): string {
  const start = routes.indexOf(startMarker);
  const end = routes.indexOf(endMarker, start + startMarker.length);
  expect(start, `${startMarker} should exist`).toBeGreaterThan(-1);
  expect(end, `${endMarker} should follow ${startMarker}`).toBeGreaterThan(start);
  return routes.slice(start, end);
}

describe("import-created directory account archive authority", () => {
  const predicate = section(
    "const importedDirectoryUserArchiveCandidatePredicate = and(",
    "const archiveImportedDirectoryUserToDirectory"
  );
  const archive = section(
    "const archiveImportedDirectoryUserToDirectory",
    'app.get(\n    "/api/admin/imported-directory-users"'
  );
  const listRoute = section(
    'app.get(\n    "/api/admin/imported-directory-users"',
    "// Admin: archive an import-created directory owner account"
  );
  const singleRoute = section(
    'app.post(\n    "/api/admin/imported-directory-users/:userId/archive-to-directory"',
    "// Admin: bulk archive import-created directory owner accounts"
  );
  const bulkRoute = section(
    'app.post(\n    "/api/admin/imported-directory-users/archive-all"',
    "// Admin: list import batches"
  );

  it("requires exact import provenance and excludes identity, authority, profiles, and activity", () => {
    const projection = fs.readFileSync(
      path.resolve(process.cwd(), "server/services/adminBusinessOwnerImportProjection.ts"),
      "utf8"
    );
    expect(routes).toContain('from "./services/adminBusinessOwnerImportProjection"');
    expect(projection).toContain('kind: "admin_directory_owner_import"');
    expect(projection).toContain("version: 1");
    expect(predicate).toContain("IMPORTED_DIRECTORY_USER_PROVENANCE_KIND");
    expect(predicate).toContain("-> 'importProvenance' ->> 'version'");
    expect(predicate).toContain('eq(users.provider, "local")');
    expect(predicate).toContain("isNull(users.providerId)");
    expect(predicate).toContain("isNull(users.facebookId)");
    expect(predicate).toContain("isNull(users.googleId)");
    for (const table of [
      "realtor_profiles",
      "car_salesman_profiles",
      "contractors",
      "address_verifications",
      "identity_verifications",
      "trusted_devices",
      "sessions",
      "user_profiles",
      "profiles",
      "contact_permissions",
      "contact_permission_events",
      "decision_cards",
      "work_request_assignments",
      "work_request_events",
      "provider_declarations",
      "provider_eligibilities",
      "events",
      "claim_events",
      "messages",
      "conversations",
      "marketplace_conversations",
      "profile_booking_requests",
      "work_requests",
      "professional_partnerships",
      "partnership_referrals",
      "marketplace_listings",
      "community_posts",
      "recommendations",
    ]) {
      expect(predicate).toContain(`from ${table}`);
    }
    expect(predicate).toContain("select count(*)::int from businesses");
    expect(predicate).toContain(") = 1");
    expect(predicate).toContain('eq(users.verificationStatus, "pending")');
    expect(predicate).toContain("eq(users.addressVerified, false)");
    expect(predicate).toContain("eq(users.verifiedBadge, false)");
    expect(predicate).toContain('eq(users.role, "business_owner")');
    expect(predicate).toContain('eq(users.activeRole, "business_owner")');
    expect(predicate).toContain("cardinality(coalesce(${users.roles}, array[]::text[])) = 1");
    expect(predicate).toContain("cardinality(${users.capabilityBundles}) = 0");
    expect(predicate).toContain("cardinality(${users.participationModes}) = 0");
  });

  it("locks and rechecks the target with the shared predicate before destructive changes", () => {
    expect(archive.indexOf("db.transaction(async (tx)")).toBeLessThan(
      archive.indexOf(".from(users)")
    );
    expect(archive).toContain('.for("update")');
    expect(archive).toContain(
      ".where(and(eq(users.id, id), importedDirectoryUserArchiveCandidatePredicate))"
    );
    expect(archive).toContain("IMPORT_ARCHIVE_TARGET_INELIGIBLE");
    expect(archive).toContain("evaluateImportedDirectoryArchiveAuthority({");
    expect(archive).toContain("evaluateImportedDirectoryArchiveVerificationState(user)");
    expect(archive).toContain("evaluateImportedDirectoryBusinessCardinality(");
    expect(archive).toContain("ownedBizRows.length");
    expect(archive).toContain("database: tx");
    expect(archive).not.toContain("Fallback: create a directory business");
    expect(archive).not.toContain("isMissingClaimStatusColumn");
    expect(archive).toContain("delete from public.auth_action_tokens where user_id = ${id}");
    expect(archive).toContain("delete from sessions");
    expect(archive).toContain("delete from trusted_devices where user_id = ${id}");
    expect(archive).toContain('roles: ["homeowner"]');
    expect(archive).toContain("capabilityBundles: []");
    expect(archive).toContain("participationModes: []");
    expect(archive).toContain('verificationStatus: "pending" as any');
    expect(archive).toContain("addressVerified: false");
    expect(archive).toContain("verifiedBadge: false");
    expect(archive).not.toContain("const nextRoles = roles.filter");
    const eligibilityIndex = archive.indexOf(
      ".where(and(eq(users.id, id), importedDirectoryUserArchiveCandidatePredicate))"
    );
    expect(archive.indexOf("delete from sessions", eligibilityIndex)).toBeGreaterThan(
      eligibilityIndex
    );
    expect(archive.indexOf("delete from public.auth_action_tokens")).toBeLessThan(
      archive.indexOf(".update(users)")
    );
    expect(archive).not.toContain("import-cleanup heuristics");
  });

  it("fails closed in executable policy checks for protected targets and ambiguous businesses", () => {
    const actor = { id: "ops", roles: ["ops_admin"] };
    for (const target of [
      { id: "target", roles: ["super_admin"], email: "person@example.com" },
      { id: "target", roles: ["hoa_admin"], email: "person@example.com" },
      { id: "target", roles: ["realtor"], email: "person@example.com" },
      { id: "target", roles: ["homeowner"], email: "contact@thetradescout.com" },
    ]) {
      expect(
        evaluateImportedDirectoryArchiveAuthority({
          actor,
          actorId: actor.id,
          target,
          targetUserId: target.id,
          originalOrCurrentEmail: target.email,
        })
      ).toMatchObject({ outcome: "denied", code: "IMPORT_ARCHIVE_TARGET_PROTECTED" });
    }

    expect(evaluateImportedDirectoryBusinessCardinality(0)).toMatchObject({
      outcome: "denied",
    });
    expect(evaluateImportedDirectoryBusinessCardinality(2)).toMatchObject({
      outcome: "denied",
    });
    expect(evaluateImportedDirectoryBusinessCardinality(1)).toEqual({ outcome: "allowed" });

    expect(
      evaluateImportedDirectoryArchiveVerificationState({
        verificationStatus: "pending",
        addressVerified: false,
        verifiedBadge: false,
      })
    ).toEqual({ outcome: "allowed" });
    for (const verificationState of [
      { verificationStatus: "approved", addressVerified: false, verifiedBadge: false },
      { verificationStatus: "pending", addressVerified: true, verifiedBadge: false },
      { verificationStatus: "pending", addressVerified: false, verifiedBadge: true },
      { verificationStatus: null, addressVerified: false, verifiedBadge: false },
      { verificationStatus: "pending", addressVerified: null, verifiedBadge: false },
    ]) {
      expect(evaluateImportedDirectoryArchiveVerificationState(verificationState)).toMatchObject({
        outcome: "denied",
        code: "IMPORT_ARCHIVE_VERIFICATION_STATE_PRESENT",
      });
    }
  });

  it("uses one fail-closed candidate predicate for listing, single recheck, and bulk", () => {
    expect(listRoute).toContain(".where(importedDirectoryUserArchiveCandidatePredicate)");
    expect(bulkRoute).toContain(".where(importedDirectoryUserArchiveCandidatePredicate)");
    expect(archive).toContain("importedDirectoryUserArchiveCandidatePredicate");
    expect(listRoute).not.toContain("u.onboarding_completed = false");
    expect(bulkRoute).not.toContain("u.onboarding_completed = false");
  });

  it("requires ops/super authority plus bounded reason and explicit confirmation, then audits", () => {
    for (const route of [listRoute, singleRoute, bulkRoute]) {
      expect(route).toContain('actorHasPrivilegedCapability(actor, ["ops_admin", "super_admin"])');
      expect(route).not.toContain("\n    isAdmin,");
    }
    for (const route of [singleRoute, bulkRoute]) {
      expect(route).toContain("normalizePrivilegedReason(");
      expect(route).toContain("reason,");
    }
    expect(archive).toContain("auditPrivilegedAction({");
    expect(archive).toContain('outcome: "completed"');
    expect(archive).toContain("database: tx");
    expect(singleRoute).toContain('confirmation !== "ARCHIVE_IMPORTED_DIRECTORY_USER"');
    expect(bulkRoute).toContain('confirm !== "ARCHIVE_ALL"');
    expect(bulkRoute).toContain("runBestEffortPrivilegedSummaryAudit({");
    expect(bulkRoute).toContain("auditWarning");
  });
});
