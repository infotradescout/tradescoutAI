import fs from "node:fs";
import path from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  MANAGED_PARTNER_CONTACT_MODES,
  type ManagedPartnerIntakeCreateInput,
} from "@shared/managedPartnerIntake";
import type { ManagedPartnerProfileDefinition } from "@shared/managedPartnerProfileRegistry";
import { TRADESCOUT_MANAGED_CONTACT } from "@shared/tradeScoutManagedContact";

const mocks = vi.hoisted(() => ({ query: vi.fn() }));

vi.mock("../db", () => ({
  pool: { query: mocks.query },
  db: {
    select: () => ({ from: () => ({ where: async () => [] }) }),
  },
}));

import {
  createManagedPartnerIntake,
  updateManagedPartnerIntake,
} from "../services/managedPartnerIntake";
import { getBusinessManagedContactIssues } from "../services/managedPartnerProfileHealth";
import { getRuntimeManagedPartnerProfileHealth } from "../services/runtimeManagedPartnerProfileHealth";

const businessEmail = "office@business.example";
const notificationEmail = "requests@business.example";
const slug = "business-routing-fixture";

const definition: ManagedPartnerProfileDefinition = {
  slug,
  displayName: "Business Routing Fixture",
  archetype: "contractor",
  controlMode: "owner_controlled_tradescout_managed_contact",
  contactMode: "business_managed",
  exposureMode: "direct_only",
  requestMode: "profile_request_flow",
  requestRecipientSlug: slug,
  expectedEmail: businessEmail,
  expectedNotificationEmail: notificationEmail,
  notes: "Synthetic business-owned request fixture.",
};

function intakeRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "00000000-0000-4000-8000-000000000128",
    display_name: definition.displayName,
    slug,
    source_urls: [],
    archetype: definition.archetype,
    control_mode: definition.controlMode,
    contact_mode: definition.contactMode,
    exposure_mode: definition.exposureMode,
    request_mode: definition.requestMode,
    request_recipient_slug: slug,
    expected_primary_cta: null,
    expected_phone: null,
    expected_email: businessEmail,
    expected_notification_email: notificationEmail,
    relationship_label: null,
    notes: "",
    stage: "incoming",
    priority: "normal",
    latest_action: null,
    blocker_note: null,
    created_by_user_id: "admin-fixture",
    assigned_to_user_id: null,
    created_at: "2026-09-05T00:00:00.000Z",
    updated_at: "2026-09-05T00:00:00.000Z",
    archived_at: null,
    ...overrides,
  };
}

async function createAndReadContact(input: Partial<ManagedPartnerIntakeCreateInput> = {}) {
  mocks.query.mockResolvedValueOnce({ rows: [] }).mockResolvedValueOnce({ rows: [intakeRow()] });
  await createManagedPartnerIntake({
    actorUserId: "admin-fixture",
    input: { displayName: definition.displayName, contactMode: "business_managed", ...input },
  });
  const insert = mocks.query.mock.calls.find(([sql]) =>
    sql.includes("INSERT INTO managed_partner_intakes")
  );
  return insert?.[1].slice(10, 13);
}

function healthInput(
  overrides: Partial<Parameters<typeof getBusinessManagedContactIssues>[0]> = {}
) {
  return {
    definition,
    phone: null,
    email: businessEmail,
    notificationEmail,
    contactManagement: "business_managed",
    claimStatus: "claimed",
    ownerUserId: "business-owner-fixture",
    ownerProvider: "local",
    ownerEmailVerified: true,
    ...overrides,
  };
}

beforeEach(() => {
  mocks.query.mockReset();
});

describe("business-managed intake contact", () => {
  it("saves explicitly configured business inboxes without inventing a phone", async () => {
    expect(
      await createAndReadContact({
        expectedEmail: businessEmail,
        expectedNotificationEmail: notificationEmail,
      })
    ).toEqual([null, businessEmail, notificationEmail]);
  });

  it("leaves unknown business contact empty instead of substituting TradeScout destinations", async () => {
    expect(await createAndReadContact()).toEqual([null, null, null]);
  });

  it("retains business contact on a metadata-only update and allows explicit clearing", async () => {
    for (const input of [
      { notes: "Source reviewed" },
      { expectedPhone: null, expectedEmail: null, expectedNotificationEmail: null },
    ]) {
      mocks.query.mockReset();
      mocks.query
        .mockResolvedValueOnce({ rows: [intakeRow({ expected_phone: "555-0100" })] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [intakeRow()] });
      await updateManagedPartnerIntake({ id: intakeRow().id, input, actorUserId: "admin-fixture" });
      const update = mocks.query.mock.calls.find(([sql]) =>
        sql.includes("UPDATE managed_partner_intakes")
      );
      expect(update?.[1].slice(11, 14)).toEqual(
        "notes" in input ? ["555-0100", businessEmail, notificationEmail] : [null, null, null]
      );
    }
  });

  it("does not carry TradeScout destinations into a business-managed mode change", async () => {
    mocks.query
      .mockResolvedValueOnce({
        rows: [
          intakeRow({
            contact_mode: "tradescout_managed",
            expected_phone: TRADESCOUT_MANAGED_CONTACT.phone,
            expected_email: TRADESCOUT_MANAGED_CONTACT.email,
            expected_notification_email: TRADESCOUT_MANAGED_CONTACT.email,
          }),
        ],
      })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [intakeRow()] });
    await updateManagedPartnerIntake({
      id: intakeRow().id,
      actorUserId: "admin-fixture",
      input: {
        contactMode: "business_managed",
        expectedEmail: businessEmail,
        expectedNotificationEmail: notificationEmail,
      },
    });
    const update = mocks.query.mock.calls.find(([sql]) =>
      sql.includes("UPDATE managed_partner_intakes")
    );
    expect(update?.[1].slice(11, 14)).toEqual([null, businessEmail, notificationEmail]);
  });

  it.each([
    [
      "tradescout_managed",
      undefined,
      TRADESCOUT_MANAGED_CONTACT.phone,
      TRADESCOUT_MANAGED_CONTACT.email,
    ],
    ["business_phone_tradescout_email", "555-0100", "555-0100", TRADESCOUT_MANAGED_CONTACT.email],
    ["pending_owner_contact", "555-0100", null, null],
  ] as const)(
    "preserves existing %s normalization",
    async (contactMode, expectedPhone, phone, email) => {
      expect(await createAndReadContact({ contactMode, expectedPhone })).toEqual([
        phone,
        email,
        email,
      ]);
    }
  );
});

describe("business-managed contact health", () => {
  it("accepts matching inboxes with confirmed account control and no configured phone", () => {
    expect(getBusinessManagedContactIssues(healthInput())).toEqual([]);
  });

  it.each([
    [{ email: "wrong@business.example" }, "business_email_mismatch"],
    [{ notificationEmail: "wrong@business.example" }, "business_notification_mismatch"],
    [{ definition: { ...definition, expectedEmail: undefined } }, "business_email_unconfigured"],
    [
      { definition: { ...definition, expectedNotificationEmail: undefined } },
      "business_notification_unconfigured",
    ],
    [{ definition: { ...definition, expectedPhone: "555-0100" } }, "business_phone_mismatch"],
    [
      { definition: { ...definition, requestRecipientSlug: "another-business" } },
      "business_request_recipient_mismatch",
    ],
    [{ definition: { ...definition, requestMode: "pending" } }, "business_request_mode_pending"],
  ] as const)("blocks mismatched or incomplete business routing %#", (overrides, code) => {
    expect(getBusinessManagedContactIssues(healthInput(overrides))).toEqual(
      expect.arrayContaining([expect.objectContaining({ code, severity: "blocker" })])
    );
  });

  it.each([
    { definition: { ...definition, controlMode: "admin_stewarded_pending_claim" } },
    { definition: { ...definition, controlMode: "admin_stewarded_pending_owner_transfer" } },
    { claimStatus: "unclaimed" },
    { ownerUserId: null },
    { ownerProvider: "admin_provisioned_profile_steward" },
    { ownerEmailVerified: false },
  ] as const)(
    "keeps pending operator access blocked despite matching mailbox configuration %#",
    (overrides) => {
      expect(getBusinessManagedContactIssues(healthInput(overrides))).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ code: "business_operator_pending", severity: "blocker" }),
        ])
      );
    }
  );

  it("reports a missing business marker without applying its rules to existing contact modes", () => {
    expect(getBusinessManagedContactIssues(healthInput({ contactManagement: null }))).toEqual([
      expect.objectContaining({ code: "business_contact_marker_missing", severity: "attention" }),
    ]);
    expect(
      getBusinessManagedContactIssues(
        healthInput({
          definition: { ...definition, contactMode: "tradescout_managed" },
          ownerEmailVerified: false,
        })
      )
    ).toEqual([]);
  });

  it.each([false, true])(
    "audits actual runtime intake definitions with pending owner=%s",
    async (pendingOwner) => {
      const intake = intakeRow({
        stage: "live",
        ...(pendingOwner ? { control_mode: "admin_stewarded_pending_claim" } : {}),
      });
      const row = {
        requested_slug: slug,
        business_id: "business-fixture",
        business_status: "active",
        claim_status: pendingOwner ? "unclaimed" : "claimed",
        public_discovery_enabled: false,
        business_owner_user_id: "business-owner-fixture",
        profile_data: {
          email: businessEmail,
          notificationEmail,
          contactManagement: "business_managed",
        },
        sources: ["admin_provisioned_business_profile"],
        profile_id: "profile-fixture",
        profile_status: "published",
        profile_owner_user_id: "business-owner-fixture",
        profile_business_id: "business-fixture",
        owner_role: "business_owner",
        owner_roles: ["business_owner"],
        verified_badge: false,
        verification_status: "pending",
        owner_provider: pendingOwner ? "admin_provisioned_profile_steward" : "local",
        owner_email_verified: !pendingOwner,
      };
      mocks.query.mockImplementation(async (sql: string) => ({
        rows: sql.includes("WITH requested AS") ? [row] : [intake],
      }));

      const report = await getRuntimeManagedPartnerProfileHealth();
      const item = report.items.find((entry) => entry.slug === slug);
      expect(item?.status).toBe(pendingOwner ? "blocked" : "ready");
      expect(item?.current.ownerVerified).toBe(false);
      expect(item?.current.contactManagement).toBe("business_managed");
      expect(item?.issues.some((issue) => issue.code === "business_operator_pending")).toBe(
        pendingOwner
      );
      expect(item?.issues.some((issue) => /phone/.test(issue.code))).toBe(false);
      expect(
        mocks.query.mock.calls.every(([sql]) => !/\b(?:UPDATE|INSERT|DELETE)\b/.test(sql))
      ).toBe(true);
    }
  );
});

describe("business-managed contact migration contract", () => {
  it("keeps schema, shared options, journal, and readiness marker consistent", () => {
    const read = (file: string) => fs.readFileSync(path.resolve(process.cwd(), file), "utf8");
    const migration = read("migrations/0128_business_managed_partner_contact.sql");
    const modes = [...migration.matchAll(/^\s*'([^']+)'[,]?$/gm)].map((match) => match[1]);
    expect(modes).toEqual([...MANAGED_PARTNER_CONTACT_MODES]);
    expect(JSON.parse(read("migrations/meta/_journal.json")).entries.at(-1).tag).toBe(
      "0128_business_managed_partner_contact"
    );
    expect(migration).toContain("tradescout-schema:0128:v1");
    expect(read("scripts/check-required-production-schema.mjs")).toContain(
      "'managed_partner_intakes_contact_mode_check', 'c', null, null, null, null, 'tradescout-schema:0128:v1'"
    );
    expect(read("migrations/0117_managed_partner_intakes.sql")).not.toContain("'business_managed'");
    expect(migration).not.toMatch(/\b(?:UPDATE|INSERT|DELETE)\b/i);
  });
});
