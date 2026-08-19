import {
  getManagedPartnerProfileDefinition,
  MANAGED_PARTNER_PROFILE_DEFINITIONS,
  type ManagedPartnerArchetype,
  type ManagedPartnerContactMode,
  type ManagedPartnerControlMode,
  type ManagedPartnerExposureMode,
  type ManagedPartnerProfileDefinition,
  type ManagedPartnerRequestMode,
} from "@shared/managedPartnerProfileRegistry";
import {
  MANAGED_PARTNER_ARCHETYPES,
  MANAGED_PARTNER_CONTACT_MODES,
  MANAGED_PARTNER_CONTROL_MODES,
  MANAGED_PARTNER_EXPOSURE_MODES,
  MANAGED_PARTNER_INTAKE_PRIORITIES,
  MANAGED_PARTNER_INTAKE_STAGES,
  MANAGED_PARTNER_REQUEST_MODES,
  slugifyManagedPartnerName,
  type ManagedPartnerIntakeCreateInput,
  type ManagedPartnerIntakePriority,
  type ManagedPartnerIntakeRecord,
  type ManagedPartnerIntakeReport,
  type ManagedPartnerIntakeStage,
  type ManagedPartnerIntakeUpdateInput,
} from "@shared/managedPartnerIntake";
import { TRADESCOUT_MANAGED_CONTACT } from "@shared/tradeScoutManagedContact";
import { pool } from "../db";
import { ensureManagedPartnerOpsTables } from "../db/ensureManagedPartnerOpsTables";

type ManagedPartnerIntakeRow = {
  id: string;
  display_name: string;
  slug: string | null;
  source_urls: unknown;
  archetype: ManagedPartnerArchetype;
  control_mode: ManagedPartnerControlMode;
  contact_mode: ManagedPartnerContactMode;
  exposure_mode: ManagedPartnerExposureMode;
  request_mode: ManagedPartnerRequestMode;
  request_recipient_slug: string | null;
  expected_primary_cta: string | null;
  expected_phone: string | null;
  expected_email: string | null;
  expected_notification_email: string | null;
  relationship_label: string | null;
  notes: string;
  stage: ManagedPartnerIntakeStage;
  priority: ManagedPartnerIntakePriority;
  latest_action: string | null;
  blocker_note: string | null;
  created_by_user_id: string;
  assigned_to_user_id: string | null;
  created_at: Date | string;
  updated_at: Date | string;
  archived_at: Date | string | null;
};

type NormalizedManagedPartnerIntake = {
  displayName: string;
  slug: string;
  sourceUrls: string[];
  archetype: ManagedPartnerArchetype;
  controlMode: ManagedPartnerControlMode;
  contactMode: ManagedPartnerContactMode;
  exposureMode: ManagedPartnerExposureMode;
  requestMode: ManagedPartnerRequestMode;
  requestRecipientSlug: string;
  expectedPrimaryCta: string | null;
  expectedPhone: string | null;
  expectedEmail: string | null;
  expectedNotificationEmail: string | null;
  relationshipLabel: string | null;
  notes: string;
  stage: ManagedPartnerIntakeStage;
  priority: ManagedPartnerIntakePriority;
  latestAction: string | null;
  blockerNote: string | null;
  assignedToUserId: string | null;
};

function text(value: unknown, maxLength = 500): string {
  return String(value || "").trim().slice(0, maxLength);
}

function nullableText(value: unknown, maxLength = 500): string | null {
  const normalized = text(value, maxLength);
  return normalized || null;
}

function enumValue<T extends string>(
  value: unknown,
  allowed: readonly T[],
  fallback: T,
  fieldName: string
): T {
  const normalized = String(value || "").trim() as T;
  if (!normalized) return fallback;
  if (!allowed.includes(normalized)) {
    throw new Error(`${fieldName} is not supported`);
  }
  return normalized;
}

function normalizeSourceUrls(value: unknown): string[] {
  const candidates = Array.isArray(value)
    ? value
    : String(value || "")
        .split(/[\n,]+/)
        .map((entry) => entry.trim());
  const urls: string[] = [];

  for (const candidate of candidates) {
    const raw = text(candidate, 1_000);
    if (!raw) continue;
    let parsed: URL;
    try {
      parsed = new URL(raw);
    } catch {
      throw new Error(`Source URL is invalid: ${raw}`);
    }
    if (!/^https?:$/.test(parsed.protocol)) {
      throw new Error(`Source URL must use http or https: ${raw}`);
    }
    urls.push(parsed.toString());
  }

  return Array.from(new Set(urls)).slice(0, 20);
}

function rowUrls(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map((entry) => String(entry || "").trim()).filter(Boolean);
  }
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed)
        ? parsed.map((entry) => String(entry || "").trim()).filter(Boolean)
        : [];
    } catch {
      return [];
    }
  }
  return [];
}

function iso(value: Date | string | null): string | null {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isFinite(date.getTime()) ? date.toISOString() : String(value);
}

function mapRow(row: ManagedPartnerIntakeRow): ManagedPartnerIntakeRecord {
  return {
    id: row.id,
    displayName: row.display_name,
    slug: row.slug,
    sourceUrls: rowUrls(row.source_urls),
    archetype: row.archetype,
    controlMode: row.control_mode,
    contactMode: row.contact_mode,
    exposureMode: row.exposure_mode,
    requestMode: row.request_mode,
    requestRecipientSlug: row.request_recipient_slug,
    expectedPrimaryCta: row.expected_primary_cta,
    expectedPhone: row.expected_phone,
    expectedEmail: row.expected_email,
    expectedNotificationEmail: row.expected_notification_email,
    relationshipLabel: row.relationship_label,
    notes: row.notes || "",
    stage: row.stage,
    priority: row.priority,
    latestAction: row.latest_action,
    blockerNote: row.blocker_note,
    createdByUserId: row.created_by_user_id,
    assignedToUserId: row.assigned_to_user_id,
    createdAt: iso(row.created_at) || new Date().toISOString(),
    updatedAt: iso(row.updated_at) || new Date().toISOString(),
    archivedAt: iso(row.archived_at),
  };
}

function normalizeInput(
  input: ManagedPartnerIntakeCreateInput | ManagedPartnerIntakeUpdateInput,
  existing?: ManagedPartnerIntakeRecord
): NormalizedManagedPartnerIntake {
  const displayName = text(input.displayName ?? existing?.displayName, 160);
  if (displayName.length < 2) {
    throw new Error("Partner name is required");
  }

  const proposedSlug = text(input.slug ?? existing?.slug, 100);
  const slug = slugifyManagedPartnerName(proposedSlug || displayName);
  if (!slug) {
    throw new Error("A usable profile slug could not be created");
  }

  const sourceUrls = normalizeSourceUrls(input.sourceUrls ?? existing?.sourceUrls ?? []);
  const archetype = enumValue(
    input.archetype ?? existing?.archetype,
    MANAGED_PARTNER_ARCHETYPES,
    "contractor",
    "Profile type"
  );
  const controlMode = enumValue(
    input.controlMode ?? existing?.controlMode,
    MANAGED_PARTNER_CONTROL_MODES,
    "tradescout_admin_controlled",
    "Control mode"
  );
  const contactMode = enumValue(
    input.contactMode ?? existing?.contactMode,
    MANAGED_PARTNER_CONTACT_MODES,
    "tradescout_managed",
    "Contact mode"
  );
  const exposureMode = enumValue(
    input.exposureMode ?? existing?.exposureMode,
    MANAGED_PARTNER_EXPOSURE_MODES,
    "public",
    "Exposure mode"
  );
  const requestMode = enumValue(
    input.requestMode ?? existing?.requestMode,
    MANAGED_PARTNER_REQUEST_MODES,
    "profile_request_flow",
    "Request mode"
  );
  const stage = enumValue(
    input.stage ?? existing?.stage,
    MANAGED_PARTNER_INTAKE_STAGES,
    "incoming",
    "Stage"
  );
  const priority = enumValue(
    input.priority ?? existing?.priority,
    MANAGED_PARTNER_INTAKE_PRIORITIES,
    "normal",
    "Priority"
  );
  const requestRecipientSlug =
    slugifyManagedPartnerName(input.requestRecipientSlug ?? existing?.requestRecipientSlug) || slug;
  const expectedPrimaryCta = nullableText(
    input.expectedPrimaryCta ?? existing?.expectedPrimaryCta ?? "Start a Request",
    80
  );

  let expectedPhone = nullableText(input.expectedPhone ?? existing?.expectedPhone, 80);
  let expectedEmail = nullableText(input.expectedEmail ?? existing?.expectedEmail, 200);
  let expectedNotificationEmail = nullableText(
    input.expectedNotificationEmail ?? existing?.expectedNotificationEmail,
    200
  );

  if (contactMode === "tradescout_managed") {
    expectedPhone = expectedPhone || TRADESCOUT_MANAGED_CONTACT.phone;
    expectedEmail = expectedEmail || TRADESCOUT_MANAGED_CONTACT.email;
    expectedNotificationEmail =
      expectedNotificationEmail || TRADESCOUT_MANAGED_CONTACT.email;
  } else if (contactMode === "business_phone_tradescout_email") {
    expectedEmail = expectedEmail || TRADESCOUT_MANAGED_CONTACT.email;
    expectedNotificationEmail =
      expectedNotificationEmail || TRADESCOUT_MANAGED_CONTACT.email;
  } else {
    expectedPhone = null;
    expectedEmail = null;
    expectedNotificationEmail = null;
  }

  const blockerNote = nullableText(input.blockerNote ?? existing?.blockerNote, 2_000);
  if (stage === "blocked" && !blockerNote) {
    throw new Error("A blocker note is required when the intake is blocked");
  }

  return {
    displayName,
    slug,
    sourceUrls,
    archetype,
    controlMode,
    contactMode,
    exposureMode,
    requestMode,
    requestRecipientSlug,
    expectedPrimaryCta,
    expectedPhone,
    expectedEmail,
    expectedNotificationEmail,
    relationshipLabel: nullableText(
      input.relationshipLabel ?? existing?.relationshipLabel,
      500
    ),
    notes: text(input.notes ?? existing?.notes, 5_000),
    stage,
    priority,
    latestAction: nullableText(input.latestAction ?? existing?.latestAction, 1_000),
    blockerNote: stage === "blocked" ? blockerNote : null,
    assignedToUserId: nullableText(input.assignedToUserId ?? existing?.assignedToUserId, 200),
  };
}

function duplicateSlugError(slug: string): Error {
  return new Error(`The managed partner slug ${slug} is already in use`);
}

async function assertSlugAvailable(slug: string, intakeId?: string): Promise<void> {
  if (getManagedPartnerProfileDefinition(slug)) {
    throw duplicateSlugError(slug);
  }

  const result = await pool.query<{ id: string }>(
    `SELECT id
       FROM managed_partner_intakes
      WHERE lower(slug) = lower($1)
        AND archived_at IS NULL
        AND ($2::uuid IS NULL OR id <> $2::uuid)
      LIMIT 1`,
    [slug, intakeId || null]
  );
  if (result.rows.length > 0) {
    throw duplicateSlugError(slug);
  }
}

async function assertLiveProfileReady(slug: string): Promise<void> {
  const result = await pool.query<{
    business_status: string;
    profile_status: string;
    ownership_consistent: boolean;
  }>(
    `SELECT
       b.status AS business_status,
       p.status AS profile_status,
       (p.business_id = b.id AND p.owner_user_id = b.owner_user_id) AS ownership_consistent
     FROM businesses b
     JOIN profiles p ON p.slug = b.slug AND p.business_id = b.id
     WHERE b.slug = $1
     LIMIT 1`,
    [slug]
  );
  const row = result.rows[0];
  if (!row) {
    throw new Error("The canonical business and profile must exist before the intake can be marked live");
  }
  if (row.business_status !== "active" || row.profile_status !== "published") {
    throw new Error("The business must be active and the profile published before the intake can be marked live");
  }
  if (!row.ownership_consistent) {
    throw new Error("Business and profile ownership must agree before the intake can be marked live");
  }
}

async function getIntakeById(id: string): Promise<ManagedPartnerIntakeRecord | null> {
  await ensureManagedPartnerOpsTables();
  const result = await pool.query<ManagedPartnerIntakeRow>(
    `SELECT * FROM managed_partner_intakes WHERE id = $1 LIMIT 1`,
    [id]
  );
  return result.rows[0] ? mapRow(result.rows[0]) : null;
}

export async function listManagedPartnerIntakes(options?: {
  includeArchived?: boolean;
}): Promise<ManagedPartnerIntakeReport> {
  await ensureManagedPartnerOpsTables();
  const includeArchived = options?.includeArchived === true;
  const result = await pool.query<ManagedPartnerIntakeRow>(
    `SELECT *
       FROM managed_partner_intakes
      WHERE ($1::boolean = TRUE OR archived_at IS NULL)
      ORDER BY
        CASE priority
          WHEN 'urgent' THEN 1
          WHEN 'high' THEN 2
          WHEN 'normal' THEN 3
          ELSE 4
        END,
        CASE stage
          WHEN 'blocked' THEN 1
          WHEN 'ready_to_publish' THEN 2
          WHEN 'routing_review' THEN 3
          WHEN 'profile_build' THEN 4
          WHEN 'source_review' THEN 5
          WHEN 'incoming' THEN 6
          WHEN 'live' THEN 7
          ELSE 8
        END,
        updated_at DESC`,
    [includeArchived]
  );
  const items = result.rows.map(mapRow);
  return {
    generatedAt: new Date().toISOString(),
    summary: {
      total: items.filter((item) => item.stage !== "archived").length,
      incoming: items.filter((item) => item.stage === "incoming").length,
      activeBuilds: items.filter((item) =>
        ["source_review", "profile_build", "routing_review"].includes(item.stage)
      ).length,
      readyToPublish: items.filter((item) => item.stage === "ready_to_publish").length,
      live: items.filter((item) => item.stage === "live").length,
      blocked: items.filter((item) => item.stage === "blocked").length,
    },
    items,
  };
}

export async function createManagedPartnerIntake(args: {
  input: ManagedPartnerIntakeCreateInput;
  actorUserId: string;
}): Promise<ManagedPartnerIntakeRecord> {
  await ensureManagedPartnerOpsTables();
  const actorUserId = text(args.actorUserId, 200);
  if (!actorUserId) throw new Error("A verified admin actor is required");

  const normalized = normalizeInput(args.input);
  await assertSlugAvailable(normalized.slug);
  if (normalized.stage === "live") {
    await assertLiveProfileReady(normalized.slug);
  }

  try {
    const result = await pool.query<ManagedPartnerIntakeRow>(
      `INSERT INTO managed_partner_intakes (
        display_name,
        slug,
        source_urls,
        archetype,
        control_mode,
        contact_mode,
        exposure_mode,
        request_mode,
        request_recipient_slug,
        expected_primary_cta,
        expected_phone,
        expected_email,
        expected_notification_email,
        relationship_label,
        notes,
        stage,
        priority,
        latest_action,
        blocker_note,
        created_by_user_id,
        assigned_to_user_id,
        archived_at,
        updated_at
      ) VALUES (
        $1, $2, $3::jsonb, $4, $5, $6, $7, $8, $9, $10,
        $11, $12, $13, $14, $15, $16, $17, $18, $19, $20,
        $21, $22, NOW()
      )
      RETURNING *`,
      [
        normalized.displayName,
        normalized.slug,
        JSON.stringify(normalized.sourceUrls),
        normalized.archetype,
        normalized.controlMode,
        normalized.contactMode,
        normalized.exposureMode,
        normalized.requestMode,
        normalized.requestRecipientSlug,
        normalized.expectedPrimaryCta,
        normalized.expectedPhone,
        normalized.expectedEmail,
        normalized.expectedNotificationEmail,
        normalized.relationshipLabel,
        normalized.notes,
        normalized.stage,
        normalized.priority,
        normalized.latestAction || "Partner intake created",
        normalized.blockerNote,
        actorUserId,
        normalized.assignedToUserId,
        normalized.stage === "archived" ? new Date() : null,
      ]
    );
    return mapRow(result.rows[0]);
  } catch (error: any) {
    if (error?.code === "23505") throw duplicateSlugError(normalized.slug);
    throw error;
  }
}

export async function updateManagedPartnerIntake(args: {
  id: string;
  input: ManagedPartnerIntakeUpdateInput;
  actorUserId: string;
}): Promise<ManagedPartnerIntakeRecord> {
  await ensureManagedPartnerOpsTables();
  const id = text(args.id, 100);
  const actorUserId = text(args.actorUserId, 200);
  if (!id) throw new Error("Intake ID is required");
  if (!actorUserId) throw new Error("A verified admin actor is required");

  const existing = await getIntakeById(id);
  if (!existing) throw new Error("Managed partner intake was not found");

  const normalized = normalizeInput(args.input, existing);
  await assertSlugAvailable(normalized.slug, existing.id);
  if (normalized.stage === "live" && existing.stage !== "live") {
    await assertLiveProfileReady(normalized.slug);
  }

  const latestAction =
    normalized.latestAction ||
    (normalized.stage !== existing.stage
      ? `Stage changed from ${existing.stage} to ${normalized.stage}`
      : `Intake updated by ${actorUserId}`);

  try {
    const result = await pool.query<ManagedPartnerIntakeRow>(
      `UPDATE managed_partner_intakes
          SET display_name = $2,
              slug = $3,
              source_urls = $4::jsonb,
              archetype = $5,
              control_mode = $6,
              contact_mode = $7,
              exposure_mode = $8,
              request_mode = $9,
              request_recipient_slug = $10,
              expected_primary_cta = $11,
              expected_phone = $12,
              expected_email = $13,
              expected_notification_email = $14,
              relationship_label = $15,
              notes = $16,
              stage = $17,
              priority = $18,
              latest_action = $19,
              blocker_note = $20,
              assigned_to_user_id = $21,
              archived_at = CASE WHEN $17 = 'archived' THEN COALESCE(archived_at, NOW()) ELSE NULL END,
              updated_at = NOW()
        WHERE id = $1
        RETURNING *`,
      [
        existing.id,
        normalized.displayName,
        normalized.slug,
        JSON.stringify(normalized.sourceUrls),
        normalized.archetype,
        normalized.controlMode,
        normalized.contactMode,
        normalized.exposureMode,
        normalized.requestMode,
        normalized.requestRecipientSlug,
        normalized.expectedPrimaryCta,
        normalized.expectedPhone,
        normalized.expectedEmail,
        normalized.expectedNotificationEmail,
        normalized.relationshipLabel,
        normalized.notes,
        normalized.stage,
        normalized.priority,
        latestAction,
        normalized.blockerNote,
        normalized.assignedToUserId,
      ]
    );
    return mapRow(result.rows[0]);
  } catch (error: any) {
    if (error?.code === "23505") throw duplicateSlugError(normalized.slug);
    throw error;
  }
}

export async function getRuntimeManagedPartnerProfileDefinitions(): Promise<
  ManagedPartnerProfileDefinition[]
> {
  await ensureManagedPartnerOpsTables();
  const result = await pool.query<ManagedPartnerIntakeRow>(
    `SELECT *
       FROM managed_partner_intakes
      WHERE stage = 'live'
        AND archived_at IS NULL
        AND slug IS NOT NULL
        AND length(trim(slug)) > 0
      ORDER BY updated_at DESC`
  );

  const definitionBySlug = new Map<string, ManagedPartnerProfileDefinition>();
  for (const definition of MANAGED_PARTNER_PROFILE_DEFINITIONS) {
    definitionBySlug.set(definition.slug, { ...definition });
  }

  for (const row of result.rows) {
    const intake = mapRow(row);
    const slug = slugifyManagedPartnerName(intake.slug);
    if (!slug || definitionBySlug.has(slug)) continue;
    definitionBySlug.set(slug, {
      slug,
      displayName: intake.displayName,
      archetype: intake.archetype,
      controlMode: intake.controlMode,
      contactMode: intake.contactMode,
      exposureMode: intake.exposureMode,
      requestMode: intake.requestMode,
      requestRecipientSlug:
        slugifyManagedPartnerName(intake.requestRecipientSlug) || slug,
      expectedPrimaryCta: intake.expectedPrimaryCta || undefined,
      expectedPhone: intake.expectedPhone || undefined,
      expectedEmail: intake.expectedEmail || undefined,
      expectedNotificationEmail: intake.expectedNotificationEmail || undefined,
      sourceWebsite: intake.sourceUrls[0],
      relationshipLabel: intake.relationshipLabel || undefined,
      notes:
        intake.notes ||
        "Managed partner promoted from the live intake queue and audited with the shared operating rules.",
    });
  }

  return Array.from(definitionBySlug.values());
}
