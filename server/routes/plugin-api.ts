import { Router } from "express";
import { randomUUID, timingSafeEqual } from "crypto";
import { z } from "zod";
import { storage } from "../storage";
import { pool } from "../db";

const router = Router();

function serviceAuth(req: any, res: any, next: any) {
  const expected = Buffer.from(String(process.env.TRADESCOUT_PLUGIN_SERVICE_TOKEN || ""));
  const supplied = Buffer.from(String(req.get("authorization") || "").replace(/^Bearer\s+/i, ""));
  if (
    !expected.length ||
    expected.length !== supplied.length ||
    !timingSafeEqual(expected, supplied)
  ) {
    return res.status(401).json({ error: "invalid_service_token" });
  }
  const subject = String(req.get("x-tradescout-oauth-subject") || "").trim();
  const tenant = String(req.get("x-tradescout-tenant-id") || "").trim();
  if (!subject || tenant !== `tradescout:${subject}`) {
    return res.status(403).json({ error: "subject_tenant_mismatch" });
  }
  req.pluginOwnerId = subject;
  req.pluginTenantId = tenant;
  next();
}

router.use("/api/plugin/v1", serviceAuth);

router.get("/api/plugin/v1/businesses", async (req: any, res) => {
  const records = await storage.listBusinessesByOwner(req.pluginOwnerId);
  res.json(
    records.map((business) => ({
      id: business.id,
      tenantId: req.pluginTenantId,
      name: business.name,
      slug: business.slug,
      role: "owner",
      profileVersion: versionOf(business.updatedAt),
    }))
  );
});

router.get("/api/plugin/v1/businesses/:id/hub", async (req: any, res) => {
  const business = await storage.getBusinessByIdForOwner(req.pluginOwnerId, String(req.params.id));
  if (!business) return res.status(404).json({ error: "business_not_found" });
  const profile = (business.profileData || {}) as Record<string, unknown>;
  const version = versionOf(business.updatedAt);
  res.json({
    business: {
      id: business.id,
      tenantId: req.pluginTenantId,
      name: business.name,
      slug: business.slug,
      role: "owner",
      profileVersion: version,
    },
    profile,
    services: Array.isArray(profile.services)
      ? profile.services.map((name, index) => ({ id: `service-${index}`, name }))
      : [],
    products: [],
    inventory: [],
    portfolio: [],
    directConnect: { path: `/direct-connect?businessId=${encodeURIComponent(business.id)}` },
    connections: [],
    versions: { profile: version, services: version },
  });
});

const actionSchema = z.object({
  id: z.string().min(1),
  kind: z.enum(["profile.update", "services.upsert", "artifact.flyer_pdf"]),
  input: z.record(z.unknown()),
});

const publishSchema = z.object({
  proposal: z.object({
    id: z.string().min(1),
    businessId: z.string().min(1),
    expectedProfileVersion: z.string().min(1),
  }),
  selectedActions: z.array(actionSchema).min(1),
  publishAt: z.literal("now"),
  authorizedTargetConnectionIds: z.array(z.string()),
});

router.post("/api/plugin/v1/change-sets/publish", async (req: any, res) => {
  const idempotencyKey = String(req.get("idempotency-key") || "").trim();
  if (!idempotencyKey || idempotencyKey.length > 200) {
    return res.status(400).json({ error: "idempotency_key_required" });
  }
  const parsed = publishSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "invalid_change_set" });
  const input = parsed.data;
  if (input.authorizedTargetConnectionIds.length) {
    return res.status(400).json({ error: "external_connections_not_available" });
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const existingReceipt = await client.query(
      `SELECT receipt FROM plugin_change_receipts
       WHERE owner_user_id=$1 AND idempotency_key=$2 FOR UPDATE`,
      [req.pluginOwnerId, idempotencyKey]
    );
    if (existingReceipt.rows[0]) {
      await client.query("COMMIT");
      return res.json(existingReceipt.rows[0].receipt);
    }

    const locked = await client.query(
      `SELECT id, name, slug, profile_data, updated_at
       FROM businesses
       WHERE id=$1 AND owner_user_id=$2
       FOR UPDATE`,
      [input.proposal.businessId, req.pluginOwnerId]
    );
    const business = locked.rows[0];
    if (!business) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "business_not_found" });
    }
    const previousVersion = versionOf(business.updated_at);
    if (previousVersion !== input.proposal.expectedProfileVersion) {
      await client.query("ROLLBACK");
      return res.status(409).json({ error: "profile_version_conflict" });
    }

    const profileData = { ...((business.profile_data || {}) as Record<string, unknown>) };
    let name = business.name;
    const applied: string[] = [];
    const failed: Array<{ actionId: string; error: string }> = [];

    for (const action of input.selectedActions) {
      if (action.kind === "artifact.flyer_pdf") {
        failed.push({ actionId: action.id, error: "pdf_renderer_not_connected" });
        continue;
      }
      if (action.kind === "profile.update") {
        const allowed = ["tagline", "description", "category", "website"] as const;
        for (const key of allowed) {
          if (typeof action.input[key] === "string") profileData[key] = action.input[key];
        }
        if (typeof action.input.name === "string" && action.input.name.trim()) {
          name = action.input.name.trim().slice(0, 120);
        }
      }
      if (action.kind === "services.upsert") {
        const services = Array.isArray(action.input.services)
          ? action.input.services
              .map(String)
              .map((value) => value.trim())
              .filter(Boolean)
              .slice(0, 24)
          : [];
        profileData.services = Array.from(
          new Set([
            ...(Array.isArray(profileData.services) ? profileData.services.map(String) : []),
            ...services,
          ])
        );
      }
      applied.push(action.id);
    }

    let resultingVersion = previousVersion;
    if (applied.length) {
      const updated = await client.query(
        `UPDATE businesses
         SET name=$1, profile_data=$2, updated_at=NOW()
         WHERE id=$3 AND owner_user_id=$4
         RETURNING updated_at`,
        [name, profileData, business.id, req.pluginOwnerId]
      );
      resultingVersion = versionOf(updated.rows[0].updated_at);
    }
    const receipt = {
      id: randomUUID(),
      proposalId: input.proposal.id,
      businessId: business.id,
      status: failed.length ? (applied.length ? "partial" : "failed") : "completed",
      appliedActionIds: applied,
      failedActions: failed,
      previousProfileVersion: previousVersion,
      resultingProfileVersion,
      artifactUrls: [],
      liveUrls: [`/r/${business.slug}`],
      createdAt: new Date().toISOString(),
    };
    await client.query(
      `INSERT INTO plugin_change_receipts
       (owner_user_id, idempotency_key, business_id, proposal_id, receipt)
       VALUES ($1,$2,$3,$4,$5)`,
      [req.pluginOwnerId, idempotencyKey, business.id, input.proposal.id, receipt]
    );
    await client.query("COMMIT");
    res.status(failed.length && !applied.length ? 422 : 200).json(receipt);
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Plugin change-set publish failed:", error);
    res.status(500).json({ error: "publish_failed" });
  } finally {
    client.release();
  }
});

function versionOf(value: Date | string | null | undefined) {
  return value ? new Date(value).toISOString() : "1970-01-01T00:00:00.000Z";
}

export { router as pluginApiRouter };
