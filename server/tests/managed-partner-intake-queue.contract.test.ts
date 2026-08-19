import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  isManagedPartnerIntakePriority,
  isManagedPartnerIntakeStage,
  MANAGED_PARTNER_INTAKE_PRIORITIES,
  MANAGED_PARTNER_INTAKE_STAGES,
  slugifyManagedPartnerName,
} from "@shared/managedPartnerIntake";

const read = (relativePath: string) =>
  fs.readFileSync(path.resolve(process.cwd(), relativePath), "utf8");

describe("managed partner intake queue", () => {
  it("defines the full concurrent intake lifecycle in shared truth", () => {
    expect(MANAGED_PARTNER_INTAKE_STAGES).toEqual([
      "incoming",
      "source_review",
      "profile_build",
      "routing_review",
      "ready_to_publish",
      "live",
      "blocked",
      "archived",
    ]);
    expect(MANAGED_PARTNER_INTAKE_PRIORITIES).toEqual([
      "urgent",
      "high",
      "normal",
      "low",
    ]);
    expect(isManagedPartnerIntakeStage("routing_review")).toBe(true);
    expect(isManagedPartnerIntakeStage("waiting_for_architecture")).toBe(false);
    expect(isManagedPartnerIntakePriority("urgent")).toBe(true);
    expect(isManagedPartnerIntakePriority("someday")).toBe(false);
    expect(slugifyManagedPartnerName("  R.E.D. & New Stone Co.  ")).toBe(
      "r-e-d-and-new-stone-co"
    );
  });

  it("creates a durable queue without changing existing company tables", () => {
    const ddl = read("server/db/ensureManagedPartnerOpsTables.ts");

    expect(ddl).toContain("CREATE TABLE IF NOT EXISTS managed_partner_intakes");
    expect(ddl).toContain("display_name TEXT NOT NULL");
    expect(ddl).toContain("source_urls JSONB NOT NULL");
    expect(ddl).toContain("created_by_user_id TEXT NOT NULL");
    expect(ddl).toContain("assigned_to_user_id TEXT");
    expect(ddl).toContain("'incoming'");
    expect(ddl).toContain("'source_review'");
    expect(ddl).toContain("'profile_build'");
    expect(ddl).toContain("'routing_review'");
    expect(ddl).toContain("'ready_to_publish'");
    expect(ddl).toContain("'live'");
    expect(ddl).toContain("'blocked'");
    expect(ddl).toContain("'archived'");
    expect(ddl).toContain("idx_managed_partner_intakes_slug_unique");
    expect(ddl).toContain("idx_managed_partner_intakes_active_queue");
    expect(ddl).not.toContain("ALTER TABLE businesses");
    expect(ddl).not.toContain("ALTER TABLE profiles");
    expect(ddl).not.toContain("ALTER TABLE users");
  });

  it("validates sources, blockers, live readiness, and duplicate profile slugs", () => {
    const service = read("server/services/managedPartnerIntake.ts");

    expect(service).toContain("normalizeSourceUrls");
    expect(service).toContain("Source URL must use http or https");
    expect(service).toContain("A blocker note is required when the intake is blocked");
    expect(service).toContain("getManagedPartnerProfileDefinition(slug)");
    expect(service).toContain("The managed partner slug ${slug} is already in use");
    expect(service).toContain("assertLiveProfileReady");
    expect(service).toContain("The canonical business and profile must exist");
    expect(service).toContain("The business must be active and the profile published");
    expect(service).toContain("Business and profile ownership must agree");
    expect(service).toContain("stage === \"live\"");
  });

  it("supports create, update, archive, prioritization, and live runtime promotion", () => {
    const service = read("server/services/managedPartnerIntake.ts");

    expect(service).toContain("export async function listManagedPartnerIntakes");
    expect(service).toContain("export async function createManagedPartnerIntake");
    expect(service).toContain("export async function updateManagedPartnerIntake");
    expect(service).toContain("export async function getRuntimeManagedPartnerProfileDefinitions");
    expect(service).toContain("INSERT INTO managed_partner_intakes");
    expect(service).toContain("UPDATE managed_partner_intakes");
    expect(service).toContain("archived_at = CASE WHEN $17 = 'archived'");
    expect(service).toContain("WHEN 'urgent' THEN 1");
    expect(service).toContain("WHERE stage = 'live'");
    expect(service).toContain("MANAGED_PARTNER_PROFILE_DEFINITIONS");
    expect(service).toContain("definitionBySlug.has(slug)");
    expect(service).toContain("TRADESCOUT_MANAGED_CONTACT.phone");
    expect(service).toContain("TRADESCOUT_MANAGED_CONTACT.email");
    expect(service).not.toContain("UPDATE businesses");
    expect(service).not.toContain("UPDATE profiles");
    expect(service).not.toContain("UPDATE users");
  });

  it("keeps the intake API admin-only and normalizes contact only after live promotion", () => {
    const routes = read("server/routes/professional-partnerships.ts");

    expect(routes).toContain('"/api/admin/managed-partner-intakes"');
    expect(routes).toContain('"/api/admin/managed-partner-intakes/:id"');
    expect(routes).toContain("listManagedPartnerIntakes");
    expect(routes).toContain("createManagedPartnerIntake");
    expect(routes).toContain("updateManagedPartnerIntake");
    expect(routes).toContain("isAuthenticated");
    expect(routes).toContain("requireAdmin");
    expect(routes).toContain("authenticatedUserId");
    expect(routes).toContain("normalizePromotedManagedContact");
    expect(routes).toContain('record.stage !== "live"');
    expect(routes).toContain('record.contactMode !== "tradescout_managed"');
    expect(routes).toContain("normalizeManagedPartnerContact(definition)");
    expect(routes).toContain('res.setHeader("Cache-Control", "no-store")');
  });

  it("adds live intake partners to contact normalization and health auditing", () => {
    const contact = read("server/services/jwStoneManagedContactProvisioning.ts");
    const health = read("server/services/runtimeManagedPartnerProfileHealth.ts");

    expect(contact).toContain("getRuntimeManagedPartnerProfileDefinitions");
    expect(contact).toContain("const runtimeDefinitions = await");
    expect(contact).toContain('definition.contactMode === "tradescout_managed"');
    expect(contact).toContain("normalizeManagedPartnerContact(definition)");

    expect(health).toContain("getManagedPartnerProfileHealth()");
    expect(health).toContain("getRuntimeManagedPartnerProfileDefinitions()");
    expect(health).toContain("dynamicDefinitions");
    expect(health).toContain("auditRuntimeDefinition");
    expect(health).toContain("request_recipient_unavailable");
    expect(health).toContain("managed_phone_mismatch");
    expect(health).toContain("ownership_mismatch");
  });

  it("provides a complete admin editor instead of requiring source-code changes", () => {
    const queue = read("client/src/pages/admin-managed-partner-intakes.tsx");
    const portal = read("client/src/pages/admin-tradepartner-ops.tsx");

    expect(queue).toContain('data-testid="managed-partner-intake-queue"');
    expect(queue).toContain('data-testid="managed-partner-intake-editor"');
    expect(queue).toContain("Add partner");
    expect(queue).toContain("Partner name");
    expect(queue).toContain("Existing website and source links");
    expect(queue).toContain("Profile control");
    expect(queue).toContain("Contact handling");
    expect(queue).toContain("Operating request recipient slug");
    expect(queue).toContain("Verified relationship");
    expect(queue).toContain("What is known and what must be preserved");
    expect(queue).toContain("Add the blocker before saving");
    expect(queue).toContain("Moving an intake to");
    expect(queue).toContain("Open live profile");
    expect(queue).toContain('queryKey: ["/api/admin/managed-partner-intakes"]');
    expect(queue).toContain("refetchInterval: 30_000");
    expect(queue).toContain('"POST",');
    expect(queue).toContain('"PATCH",');

    expect(portal).toContain('defaultValue="partner-intake"');
    expect(portal).toContain("Partner Intake");
    expect(portal).toContain("Live Profiles");
    expect(portal).toContain("<AdminManagedPartnerIntakesPage />");
    expect(portal).toContain("<AdminManagedPartnerProfilesPage />");
  });

  it("records the no-wait operating law and completion boundaries", () => {
    const evidence = read(
      ".selective-intelligence/builds/managed-partner-intake-queue/evidence.md"
    );
    const architecture = read(
      "docs/architecture/MANAGED_PARTNER_PROFILE_OPERATIONS.md"
    );

    expect(evidence).toContain("No partner waits for architecture");
    expect(evidence).toContain("No architecture waits for a partner");
    expect(evidence).toContain("active business");
    expect(evidence).toContain("published profile");
    expect(evidence).toContain("matching ownership");
    expect(evidence).toContain("does not create the partner profile by itself");

    expect(architecture).toContain("Partner intake queue");
    expect(architecture).toContain("ready_to_publish");
    expect(architecture).toContain("promoted to live");
    expect(architecture).toContain("company-specific profile build continues independently");
  });
});
