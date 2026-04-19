/**
 * Contract tests: Worker/Helper integration as first-class DC responders
 *
 * Verifies that:
 * 1. DB migration adds worker_id to work_request_assignments
 * 2. Storage layer exposes getWorkersByCountyAndSkills
 * 3. Routing engine fetches workers as a third candidate pool
 * 4. Inbox endpoint handles worker assignments
 * 5. Respond endpoint authorizes workers
 * 6. Employment routes expose /my-applications and availability PATCH
 * 7. Public worker profile endpoint strips PII
 * 8. Helper dashboard has the required testids and API calls
 * 9. HelperPublicProfile page has the required testids
 * 10. AppRoutes registers /helpers/:id
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

// ---------------------------------------------------------------------------
// 1. DB migration: worker_id column
// ---------------------------------------------------------------------------
describe("DC worker integration — DB migration", () => {
  it("migration file adds worker_id to work_request_assignments", () => {
    const migrationDir = path.join(repoRoot, "migrations");
    const files = fs.readdirSync(migrationDir).filter((f) => f.endsWith(".sql"));
    const workerMigration = files.find((f) => f.includes("dc_worker_assignments"));
    expect(workerMigration).toBeDefined();
    const content = fs.readFileSync(path.join(migrationDir, workerMigration!), "utf8");
    expect(content).toContain("worker_id");
    expect(content).toContain("work_request_assignments");
  });

  it("schema.ts defines workerId on workRequestAssignments", () => {
    const schema = readRepoFile("shared/schema.ts");
    expect(schema).toContain("workerId");
    expect(schema).toContain("workRequestAssignments");
  });
});

// ---------------------------------------------------------------------------
// 2. Storage: worker query
// ---------------------------------------------------------------------------
describe("DC worker integration — storage layer", () => {
  it("storage interface declares getWorkersByCountyAndSkills", () => {
    const storage = readRepoFile("server/storage.ts");
    expect(storage).toContain("getWorkersByCountyAndSkills");
  });

  it("getWorkersByCountyAndSkills implementation queries workers table", () => {
    const storage = readRepoFile("server/storage.ts");
    // Use lastIndexOf to find the async implementation (not the interface declaration)
    const fnIdx = storage.lastIndexOf("getWorkersByCountyAndSkills");
    expect(fnIdx).toBeGreaterThan(-1);
    const body = storage.slice(fnIdx, fnIdx + 2000);
    expect(body).toContain("workers");
  });
});

// ---------------------------------------------------------------------------
// 3. Routing engine: workers as third candidate pool
// ---------------------------------------------------------------------------
describe("DC worker integration — routing engine", () => {
  it("routing engine fetches workerCandidates", () => {
    const dc = readRepoFile("server/routes/direct-connect.ts");
    expect(dc).toContain("workerCandidates");
  });

  it("routing engine merges worker candidates into ranked array", () => {
    const dc = readRepoFile("server/routes/direct-connect.ts");
    expect(dc).toContain("workerCandidates");
    // Workers are pushed into the ranked array
    const rankIdx = dc.indexOf("ranked.push");
    expect(rankIdx).toBeGreaterThan(-1);
  });

  it("routing engine sets workerId on assignment payload for worker providers", () => {
    const dc = readRepoFile("server/routes/direct-connect.ts");
    expect(dc).toContain("workerId");
    expect(dc).toContain("isWorkerAssignment");
  });

  it("routing engine uses providerType: worker in suggested events", () => {
    const dc = readRepoFile("server/routes/direct-connect.ts");
    expect(dc).toContain('"worker"');
  });
});

// ---------------------------------------------------------------------------
// 4. Inbox endpoint: worker assignments
// ---------------------------------------------------------------------------
describe("DC worker integration — inbox endpoint", () => {
  it("inbox endpoint fetches assignments by workerId for worker providers", () => {
    const dc = readRepoFile("server/routes/direct-connect.ts");
    const inboxIdx = dc.indexOf("/api/direct-connect/inbox");
    expect(inboxIdx).toBeGreaterThan(-1);
    const inboxSection = dc.slice(inboxIdx, inboxIdx + 8000);
    expect(inboxSection).toContain("workerId");
  });
});

// ---------------------------------------------------------------------------
// 5. Respond endpoint: worker authorization
// ---------------------------------------------------------------------------
describe("DC worker integration — respond endpoint", () => {
  it("respond endpoint authorizes workers by workerId", () => {
    const dc = readRepoFile("server/routes/direct-connect.ts");
    const respondIdx = dc.indexOf("/api/direct-connect/assignments/");
    expect(respondIdx).toBeGreaterThan(-1);
    const respondSection = dc.slice(respondIdx, respondIdx + 6000);
    expect(respondSection).toContain("isWorkerAssignment");
  });
});

// ---------------------------------------------------------------------------
// 6. Employment routes: my-applications + availability toggle
// ---------------------------------------------------------------------------
describe("DC worker integration — employment routes", () => {
  it("employment routes expose GET /api/employment/my-applications", () => {
    const emp = readRepoFile("server/routes/employment.ts");
    expect(emp).toContain("/api/employment/my-applications");
  });

  it("my-applications endpoint joins employmentPosts for post details", () => {
    const emp = readRepoFile("server/routes/employment.ts");
    const idx = emp.indexOf("/api/employment/my-applications");
    const body = emp.slice(idx, idx + 1500);
    expect(body).toContain("employmentPosts");
    expect(body).toContain("applicantUserId");
  });

  it("routes.ts exposes PATCH /api/workers/profile/availability", () => {
    const routes = readRepoFile("server/routes.ts");
    expect(routes).toContain("/api/workers/profile/availability");
    expect(routes).toContain("isAvailable");
  });
});

// ---------------------------------------------------------------------------
// 7. Public worker profile endpoint
// ---------------------------------------------------------------------------
describe("DC worker integration — public worker profile API", () => {
  it("routes.ts exposes GET /api/workers/:workerId/public", () => {
    const routes = readRepoFile("server/routes.ts");
    expect(routes).toContain("/api/workers/:workerId/public");
  });

  it("public endpoint strips PII fields (phone, email, totalEarnings)", () => {
    const routes = readRepoFile("server/routes.ts");
    const idx = routes.indexOf("/api/workers/:workerId/public");
    const body = routes.slice(idx, idx + 1500);
    expect(body).toContain("_phone");
    expect(body).toContain("_email");
    expect(body).toContain("_earnings");
  });
});

// ---------------------------------------------------------------------------
// 8. Helper dashboard UI
// ---------------------------------------------------------------------------
describe("DC worker integration — helper dashboard", () => {
  it("helper-dashboard has availability toggle testid", () => {
    const dashboard = readRepoFile("client/src/pages/helper-dashboard.tsx");
    expect(dashboard).toContain("helper-availability-toggle");
  });

  it("helper-dashboard has accept button testid", () => {
    const dashboard = readRepoFile("client/src/pages/helper-dashboard.tsx");
    expect(dashboard).toContain("helper-dc-accept-btn");
  });

  it("helper-dashboard calls /api/direct-connect/inbox", () => {
    const dashboard = readRepoFile("client/src/pages/helper-dashboard.tsx");
    expect(dashboard).toContain("/api/direct-connect/inbox");
  });

  it("helper-dashboard calls /api/employment/my-applications", () => {
    const dashboard = readRepoFile("client/src/pages/helper-dashboard.tsx");
    expect(dashboard).toContain("/api/employment/my-applications");
  });

  it("helper-dashboard calls /api/workers/profile/availability", () => {
    const dashboard = readRepoFile("client/src/pages/helper-dashboard.tsx");
    expect(dashboard).toContain("/api/workers/profile/availability");
  });

  it("helper-dashboard shows profile completeness score", () => {
    const dashboard = readRepoFile("client/src/pages/helper-dashboard.tsx");
    expect(dashboard).toContain("profileCompleteness");
    expect(dashboard).toContain("Profile Completeness");
  });
});

// ---------------------------------------------------------------------------
// 9. HelperPublicProfile page
// ---------------------------------------------------------------------------
describe("DC worker integration — HelperPublicProfile page", () => {
  it("HelperPublicProfile page exists", () => {
    const exists = fs.existsSync(path.join(repoRoot, "client/src/pages/HelperPublicProfile.tsx"));
    expect(exists).toBe(true);
  });

  it("HelperPublicProfile calls /api/workers/:id/public", () => {
    const page = readRepoFile("client/src/pages/HelperPublicProfile.tsx");
    expect(page).toContain("/api/workers/");
    expect(page).toContain("/public");
  });

  it("HelperPublicProfile has helper-profile-name testid", () => {
    const page = readRepoFile("client/src/pages/HelperPublicProfile.tsx");
    expect(page).toContain("helper-profile-name");
  });

  it("HelperPublicProfile has helper-contact-cta testid", () => {
    const page = readRepoFile("client/src/pages/HelperPublicProfile.tsx");
    expect(page).toContain("helper-contact-cta");
  });

  it("HelperPublicProfile has helper-skills-list testid", () => {
    const page = readRepoFile("client/src/pages/HelperPublicProfile.tsx");
    expect(page).toContain("helper-skills-list");
  });

  it("HelperPublicProfile has helper-portfolio-grid testid", () => {
    const page = readRepoFile("client/src/pages/HelperPublicProfile.tsx");
    expect(page).toContain("helper-portfolio-grid");
  });

  it("HelperPublicProfile strips PII — does not render phone or email", () => {
    const page = readRepoFile("client/src/pages/HelperPublicProfile.tsx");
    // The page should not render raw phone/email fields from the API response
    expect(page).not.toContain("profile.phone");
    expect(page).not.toContain("profile.email");
  });
});

// ---------------------------------------------------------------------------
// 10. AppRoutes: /helpers/:id route
// ---------------------------------------------------------------------------
describe("DC worker integration — AppRoutes", () => {
  it("AppRoutes registers /helpers/:id route", () => {
    const appRoutes = readRepoFile("client/src/AppRoutes.tsx");
    expect(appRoutes).toContain("/helpers/:id");
    expect(appRoutes).toContain("HelperPublicProfile");
  });

  it("AppRoutes lazy-imports HelperPublicProfile", () => {
    const appRoutes = readRepoFile("client/src/AppRoutes.tsx");
    expect(appRoutes).toContain('import("./pages/HelperPublicProfile")');
  });
});
