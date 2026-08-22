/**
 * Contract tests: Direct Connect universal provider routing + Employment apply flow
 *
 * These are static source-code contracts — they verify that the key structural
 * properties of the routing engine, inbox, respond endpoint, employment apply API,
 * and EmploymentBoard UI are in place without requiring a live DB.
 */
import fs from "fs";
import path from "path";
import { describe, expect, it } from "vitest";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.join(__dirname, "..", "..");

function readRepoFile(relativePath: string): string {
  return fs.readFileSync(path.join(repoRoot, relativePath), "utf8");
}

function readProviderSearchRoute(): string {
  const extractedPath = path.join(repoRoot, "server/routes/provider-search.ts");
  if (fs.existsSync(extractedPath)) return fs.readFileSync(extractedPath, "utf8");
  const routes = readRepoFile("server/routes.ts");
  return routes.slice(routes.indexOf('"/api/business-providers/search"'));
}

// ---------------------------------------------------------------------------
// 1. DB migration: responder_user_id column
// ---------------------------------------------------------------------------
describe("DC universal provider — DB migration", () => {
  it("migration file adds responder_user_id to work_request_assignments", () => {
    const migrationDir = path.join(repoRoot, "migrations");
    const files = fs.readdirSync(migrationDir).filter((f) => f.endsWith(".sql"));
    const universalMigration = files.find((f) => f.includes("dc_universal_provider"));
    expect(universalMigration).toBeDefined();
    const content = fs.readFileSync(path.join(migrationDir, universalMigration!), "utf8");
    expect(content).toContain("responder_user_id");
    expect(content).toContain("work_request_assignments");
  });

  it("schema.ts defines responderUserId on workRequestAssignments", () => {
    const schema = readRepoFile("shared/schema.ts");
    expect(schema).toContain("responderUserId");
    expect(schema).toContain("workRequestAssignments");
  });

  it("schema.ts defines employmentPostApplications table", () => {
    const schema = readRepoFile("shared/schema.ts");
    expect(schema).toContain("employment_post_applications");
    expect(schema).toContain("employmentPostApplications");
    expect(schema).toContain("applicantUserId");
    expect(schema).toContain("uq_epa_post_applicant");
  });
});

// ---------------------------------------------------------------------------
// 2. Storage: universal provider query
// ---------------------------------------------------------------------------
describe("DC universal provider — storage layer", () => {
  it("storage interface declares getProvidersByCountyAndCategory", () => {
    const storage = readRepoFile("server/storage.ts");
    expect(storage).toContain("getProvidersByCountyAndCategory");
  });

  it("storage interface declares getActiveBusinessForUser", () => {
    const storage = readRepoFile("server/storage.ts");
    expect(storage).toContain("getActiveBusinessForUser");
  });

  it("getProvidersByCountyAndCategory queries businesses table by countyId", () => {
    const storage = readRepoFile("server/storage.ts");
    // Find the async implementation (not the interface declaration)
    const implIndex = storage.indexOf("async getProvidersByCountyAndCategory");
    expect(implIndex).toBeGreaterThan(-1);
    const fnBody = storage.slice(implIndex, implIndex + 1200);
    expect(fnBody).toContain("businesses");
    expect(fnBody).toContain("countyId");
  });
});

// ---------------------------------------------------------------------------
// 3. Routing engine: business candidates merged into ranked array
// ---------------------------------------------------------------------------
describe("DC universal provider — routing engine", () => {
  it("routing engine queries businesses for non-trade categories", () => {
    const dc = readRepoFile("server/routes/direct-connect.ts");
    expect(dc).toContain("businessCandidates");
    expect(dc).toContain("getProvidersByCountyAndCategory");
  });

  it("routing engine skips compliance gate for odd-job and employment categories", () => {
    const dc = readRepoFile("server/routes/direct-connect.ts");
    // isOpenDirectConnectCategory controls which categories bypass the license/insurance gate.
    expect(dc).toContain("isOpenDirectConnectCategory");
    expect(dc).toContain('"employment"');
    expect(dc).toContain('"odd_job"');
  });

  it("routing engine merges business candidates into ranked array", () => {
    const dc = readRepoFile("server/routes/direct-connect.ts");
    expect(dc).toContain("businessCandidates");
    // Dedup by userId to avoid notifying the same person twice
    expect(dc).toContain("seenUserIds");
  });

  it("assignment payload sets responderUserId for business providers", () => {
    const dc = readRepoFile("server/routes/direct-connect.ts");
    expect(dc).toContain("responderUserId");
  });

  it("notification block notifies business providers by userId", () => {
    const dc = readRepoFile("server/routes/direct-connect.ts");
    expect(dc).toContain("responderUserId");
    expect(dc).toContain("notificationService.createNotification");
  });
});

// ---------------------------------------------------------------------------
// 4. Inbox: business provider items included
// ---------------------------------------------------------------------------
describe("DC universal provider — inbox endpoint", () => {
  it("inbox fetches assignments by responderUserId for business providers", () => {
    const dc = readRepoFile("server/routes/direct-connect.ts");
    expect(dc).toContain("responderUserId");
    // The inbox should have a block that queries by responderUserId
    const inboxIndex = dc.indexOf("/api/direct-connect/inbox");
    expect(inboxIndex).toBeGreaterThan(-1);
    // The inbox section spans ~5000 chars; business provider block is within it
    const inboxSection = dc.slice(inboxIndex, inboxIndex + 8000);
    expect(inboxSection).toContain("responderUserId");
    // The comment explaining why contractor profile is not required for business providers
    expect(inboxSection).toContain("Business provider inbox");
  });
});

// ---------------------------------------------------------------------------
// 5. Respond endpoint: business providers can accept/decline
// ---------------------------------------------------------------------------
describe("DC universal provider — respond endpoint", () => {
  it("respond endpoint no longer requires a contractor profile", () => {
    const dc = readRepoFile("server/routes/direct-connect.ts");
    // The old hard gate was: if (!contractor) return 403
    // It should now be: contractor is looked up but not required
    expect(dc).toContain("Business providers don't need a contractor profile");
  });

  it("respond endpoint authorizes by contractorId OR responderUserId", () => {
    const dc = readRepoFile("server/routes/direct-connect.ts");
    expect(dc).toContain("isContractorAssignment");
    expect(dc).toContain("isBusinessAssignment");
    expect(dc).toContain("!isContractorAssignment && !isBusinessAssignment");
  });

  it("respond endpoint uses providerContractorId for conversation creation", () => {
    const dc = readRepoFile("server/routes/direct-connect.ts");
    expect(dc).toContain("providerContractorId");
    expect(dc).toContain("isContractorAssignment ? contractor!.id : String(userId)");
  });

  it("provider_accepted event records both contractorId and responderUserId", () => {
    const dc = readRepoFile("server/routes/direct-connect.ts");
    expect(dc).toContain("responderUserId: isBusinessAssignment ? String(userId) : null");
  });
});

// ---------------------------------------------------------------------------
// 6. Board endpoint: business counties included in allowedCountyFips
// ---------------------------------------------------------------------------
describe("DC universal provider — board endpoint", () => {
  it("board endpoint adds business service counties to allowedCountyFips", () => {
    const dc = readRepoFile("server/routes/direct-connect.ts");
    expect(dc).toContain("getActiveBusinessForUser");
    expect(dc).toContain(
      "This allows any business type (not just licensed contractors) to see the board."
    );
  });
});

// ---------------------------------------------------------------------------
// 7. Employment apply API
// ---------------------------------------------------------------------------
describe("Employment apply flow — server routes", () => {
  it("POST /api/employment/posts/:id/apply endpoint exists", () => {
    const employment = readRepoFile("server/routes/employment.ts");
    expect(employment).toContain('"/api/employment/posts/:id/apply"');
  });

  it("apply endpoint prevents self-application", () => {
    const employment = readRepoFile("server/routes/employment.ts");
    expect(employment).toContain("You cannot apply to your own post");
  });

  it("apply endpoint prevents duplicate applications", () => {
    const employment = readRepoFile("server/routes/employment.ts");
    expect(employment).toContain("You have already applied to this post");
  });

  it("apply endpoint rejects applications to closed posts", () => {
    const employment = readRepoFile("server/routes/employment.ts");
    expect(employment).toContain("no longer accepting applications");
  });

  it("GET /api/employment/posts/:id/applications endpoint exists", () => {
    const employment = readRepoFile("server/routes/employment.ts");
    expect(employment).toContain('"/api/employment/posts/:id/applications"');
  });

  it("applications endpoint returns applicant decision context without raw contact", () => {
    const employment = readRepoFile("server/routes/employment.ts");
    expect(employment).toContain("isOwner");
    expect(employment).toContain("applicantName");
    expect(employment).toContain("redactContactDetails");
    expect(employment).toContain("redactContactDetails(req.body.message)");
    expect(employment).toContain("redactContactDetails(application.message)");
    expect(employment).toContain("redactContactDetails(own.message)");
    expect(employment).not.toContain("applicantEmail: users.email");
    expect(employment).toContain("sanitizePublicListingText(payload.title, 140)");
    expect(employment).toContain("sanitizePublicListingText(payload.body, 6000)");
    expect(employment).toContain("sanitizePublicListingText(safe.title, 140)");
    expect(employment).toContain("sanitizePublicListingText(safe.body, 6000)");
    expect(employment).toContain("sanitizePublicListingText(row.post.title, 140)");
  });

  it("applications endpoint returns only own application to non-owner", () => {
    const employment = readRepoFile("server/routes/employment.ts");
    expect(employment).toContain("Non-owner: return only their own application status");
  });

  it("PATCH /api/employment/applications/:id endpoint exists", () => {
    const employment = readRepoFile("server/routes/employment.ts");
    expect(employment).toContain('"/api/employment/applications/:id"');
  });

  it("PATCH endpoint allows owner to shortlist or reject", () => {
    const employment = readRepoFile("server/routes/employment.ts");
    expect(employment).toContain("shortlisted");
    expect(employment).toContain("rejected");
  });

  it("PATCH endpoint allows applicant to withdraw only", () => {
    const employment = readRepoFile("server/routes/employment.ts");
    expect(employment).toContain("Applicants can only withdraw their own application");
  });
});

// ---------------------------------------------------------------------------
// 8. Employment Board UI
// ---------------------------------------------------------------------------
describe("Employment Board UI", () => {
  it("EmploymentBoard renders Apply button for job posts", () => {
    const board = readRepoFile("client/src/pages/direct-connect/EmploymentBoard.tsx");
    expect(board).toContain('data-testid="jobs-inspector-apply"');
    expect(board).toContain("Apply");
  });

  it("EmploymentBoard shows application status badge on applied posts", () => {
    const board = readRepoFile("client/src/pages/direct-connect/EmploymentBoard.tsx");
    expect(board).toContain("myApplicationByPostId");
    expect(board).toContain("ApplicationStatusBadge");
  });

  it("EmploymentBoard shows Applicants button for post owners", () => {
    const board = readRepoFile("client/src/pages/direct-connect/EmploymentBoard.tsx");
    expect(board).toContain("onViewApplicants");
    expect(board).toContain("Applicants");
  });

  it("EmploymentBoard has apply mutation calling POST apply endpoint", () => {
    const board = readRepoFile("client/src/pages/direct-connect/EmploymentBoard.tsx");
    expect(board).toContain("applyMutation");
    expect(board).toContain("/api/employment/posts/${postId}/apply");
  });

  it("EmploymentBoard has updateApplicationMutation calling PATCH endpoint", () => {
    const board = readRepoFile("client/src/pages/direct-connect/EmploymentBoard.tsx");
    expect(board).toContain("updateApplicationMutation");
    expect(board).toContain("/api/employment/applications/${appId}");
  });
});

// ---------------------------------------------------------------------------
// 9. Universal provider search endpoint
// ---------------------------------------------------------------------------
describe("Universal provider search — /api/business-providers/search", () => {
  it("routes.ts registers the generic endpoint and legacy alias", () => {
    const routes = readRepoFile("server/routes.ts");
    expect(routes).toContain('"/api/business-providers/search"');
    expect(routes).toContain('"/api/providers/search"');
  });

  it("business-providers/search merges contractors and businesses", () => {
    const section = readProviderSearchRoute();
    expect(section).toContain("contractorResults");
    expect(section).toContain("businessResults");
    expect(section).toContain("merged");
  });

  it("business-providers/search deduplicates results by id", () => {
    const section = readProviderSearchRoute();
    expect(section).toContain("seen");
  });

  it("business-providers/search annotates results with providerType", () => {
    const section = readProviderSearchRoute();
    expect(section).toContain('"contractor"');
    expect(section).toContain('"business"');
  });

  it("business-providers/search computes distanceMiles using viewer + provider coordinates", () => {
    const section = readProviderSearchRoute();
    expect(section).toContain("distanceMiles");
    expect(section).toContain("haversineDistanceMiles");
    expect(section).toContain("homeLocation");
  });

  it("business-providers/search supports distance and recommended sort modes", () => {
    const section = readProviderSearchRoute();
    expect(section).toContain('sortMode === "distance"');
    expect(section).toContain('sortMode === "recommended"');
  });
});
