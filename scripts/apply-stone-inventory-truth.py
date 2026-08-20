from pathlib import Path


def replace_once(path: str, old: str, new: str) -> None:
    file = Path(path)
    text = file.read_text(encoding="utf-8")
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"{path}: expected one match, found {count}: {old[:100]!r}")
    file.write_text(text.replace(old, new), encoding="utf-8")


def replace_all(path: str, old: str, new: str, minimum: int = 1) -> None:
    file = Path(path)
    text = file.read_text(encoding="utf-8")
    count = text.count(old)
    if count < minimum:
        raise SystemExit(f"{path}: expected at least {minimum} matches, found {count}: {old!r}")
    file.write_text(text.replace(old, new), encoding="utf-8")


# The static JW collection is a material library, not a physical-stock ledger.
presentation = "client/src/data/jwStoneProfilePresentation.ts"
replace_once(presentation, 'eyebrow: "Amazonic Green · current inventory",', 'eyebrow: "Amazonic Green · material library",')
replace_once(presentation, 'inventoryTitle: "Current Inventory",', 'inventoryTitle: "Material Library",')
replace_once(presentation, 'browseCtaEyebrow: "White Rhino · current inventory",', 'browseCtaEyebrow: "White Rhino · material library",')
replace_all(presentation, "Explore JW Stone's current ", "Explore JW Stone's ", minimum=4)
replace_all(
    presentation,
    " inventory, compare named slabs and photographs, and request current pricing or availability for a selected material.",
    " material library, compare named stone photographs, and request current physical availability for a selected material.",
    minimum=4,
)
replace_all(
    presentation,
    " currently published in JW Stone's inventory, review the exact material photographs, and request current pricing or availability.",
    " in JW Stone's material library, review the exact material photographs, and request current physical availability.",
    minimum=3,
)

# Marketplace collection language and exact current-stock section.
marketplace = "client/src/features/jw-stone/JWStoneMarketplace.tsx"
replace_once(
    marketplace,
    'import { useLayoutEffect, useMemo, useState } from "react";',
    'import { useLayoutEffect, useState } from "react";',
)
replace_once(
    marketplace,
    'import type { DirectConnectMaterialTarget } from "@/pages/profile-sites/directConnectMaterial";',
    'import type { DirectConnectMaterialTarget } from "@/pages/profile-sites/directConnectMaterial";\nimport type { PublicStoneInventoryItem } from "@shared/stoneInventory";',
)
replace_once(
    marketplace,
    'import { ColorPaletteRail, type ColorSwatchSelection } from "./ColorPaletteRail";',
    'import { ColorPaletteRail, type ColorSwatchSelection } from "./ColorPaletteRail";\nimport { CurrentInventorySection } from "./CurrentInventorySection";',
)
replace_once(
    marketplace,
    '  "Browse JW Stone\'s stone collection, open full photo galleries, save selections, and ask about a material when you are ready.";',
    '  "Browse JW Stone\'s material library, review recently confirmed physical stock, save selections, and start a request when you are ready.";',
)
replace_once(
    marketplace,
    '  const [requestContext, setRequestContext] = useState<readonly JwStoneCatalogItem[] | null>(null);',
    '  const [requestTargets, setRequestTargets] = useState<readonly DirectConnectMaterialTarget[] | null>(null);',
)
replace_once(
    marketplace,
    '''  const requestTargets = useMemo<readonly DirectConnectMaterialTarget[]>(
    () =>
      (requestContext || []).flatMap((stone) =>
        stone.wishlistEligible && !stone.anonymous && stone.displayName
          ? [{ itemId: stone.id, itemName: stone.displayName }]
          : []
      ),
    [requestContext]
  );

''',
    "",
)
replace_once(
    marketplace,
    '''  const startRequest = (stones: readonly JwStoneCatalogItem[]) => {
    closeStone();
    setWishlistOpen(false);
    setRequestContext(stones);
  };

  const askAboutStone = (stone: JwStoneCatalogItem) => {
    startRequest(stone.wishlistEligible && !stone.anonymous ? [stone] : []);
  };
''',
    '''  const startRequest = (stones: readonly JwStoneCatalogItem[]) => {
    closeStone();
    setWishlistOpen(false);
    setRequestTargets(
      stones.flatMap((stone) =>
        stone.wishlistEligible && !stone.anonymous && stone.displayName
          ? [{ itemId: stone.id, itemName: stone.displayName }]
          : []
      )
    );
  };

  const askAboutStone = (stone: JwStoneCatalogItem) => {
    startRequest(stone.wishlistEligible && !stone.anonymous ? [stone] : []);
  };

  const askAboutCurrentInventory = (item: PublicStoneInventoryItem) => {
    closeStone();
    setWishlistOpen(false);
    setRequestTargets([
      {
        itemId: `stone-stock:${item.id}`,
        itemName: `${item.materialName} — ${item.sourceAssetRef}`,
      },
    ]);
  };
''',
)
replace_once(
    marketplace,
    '''      <MarketplaceIntroduction />
      <FirstCutSection onOpen={openStone} />
      <StoneCollection
''',
    '''      <MarketplaceIntroduction />
      <FirstCutSection onOpen={openStone} />
      <CurrentInventorySection
        onAsk={askAboutCurrentInventory}
        onStartRequest={() => startRequest([])}
      />
      <StoneCollection
''',
)
replace_once(marketplace, '        open={requestContext !== null}', '        open={requestTargets !== null}')
replace_once(marketplace, '        onClose={() => setRequestContext(null)}', '        onClose={() => setRequestTargets(null)}')
replace_once(marketplace, '        initialStoneSelections={requestTargets}', '        initialStoneSelections={requestTargets || []}')

collection = "client/src/features/jw-stone/StoneCollection.tsx"
replace_once(collection, "/** Called when Full inventory opens — parent clears browse-rail URL tags. */", "/** Called when Material Library opens — parent clears browse-rail URL tags. */")
replace_once(collection, '        id="current-inventory"', '        id="material-library"')
replace_once(collection, '        headingId="jw-inventory-heading"', '        headingId="jw-material-library-heading"')
replace_once(collection, '        title="Full inventory"', '        title="Material Library"')
replace_once(collection, '          aria-label="Stone inventory"', '          aria-label="Stone material library"')
replace_all(collection, 'label: "Slab count known"', 'label: "Source count recorded"')
replace_once(collection, '<option value="any">Availability</option>', '<option value="any">Source evidence</option>')
replace_once(collection, '<option value="with-count">Slab count known</option>', '<option value="with-count">Source count recorded</option>')

# Manager chrome gets an operator-facing confirmation tool without exposing raw database work.
manager_chrome = "client/src/components/profile/ProfileSiteManageChrome.tsx"
replace_once(
    manager_chrome,
    'import { JW_STONE_INVENTORY_CATEGORIES } from "@/data/jwStoneInventory";',
    'import { JW_STONE_INVENTORY_CATEGORIES } from "@/data/jwStoneInventory";\nimport JwStoneCurrentInventoryManager from "./JwStoneCurrentInventoryManager";',
)
replace_once(
    manager_chrome,
    '  const [leadPickerOpen, setLeadPickerOpen] = useState(false);',
    '  const [leadPickerOpen, setLeadPickerOpen] = useState(false);\n  const [stockManagerOpen, setStockManagerOpen] = useState(false);',
)
replace_once(
    manager_chrome,
    '''              {leadPickerOpen ? "Hide lead photos" : "Pick lead photos"}
            </Button>
          ) : null}
          <Button
''',
    '''              {leadPickerOpen ? "Hide lead photos" : "Pick lead photos"}
            </Button>
          ) : null}
          {isJwStone ? (
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="shrink-0 border-amber-300/40 bg-amber-400/10 text-amber-100"
              onClick={() => setStockManagerOpen((open) => !open)}
              data-testid="profile-manage-current-inventory"
            >
              {stockManagerOpen ? "Hide current stock" : "Confirm current stock"}
            </Button>
          ) : null}
          <Button
''',
)
replace_once(
    manager_chrome,
    '''        {editMode ? (
          <div className="grid gap-3 rounded-xl border border-white/10 bg-black/30 p-3 md:grid-cols-2">
''',
    '''        {isJwStone ? (
          <JwStoneCurrentInventoryManager
            open={stockManagerOpen}
            profileSlug={profileSlug}
            onClose={() => setStockManagerOpen(false)}
          />
        ) : null}

        {editMode ? (
          <div className="grid gap-3 rounded-xl border border-white/10 bg-black/30 p-3 md:grid-cols-2">
''',
)

# Server-side share and crawler language must match the product distinction.
server_html = "server/publicJwStoneMarketplaceHtml.ts"
replace_once(
    server_html,
    '  "Browse JW Stone\'s stone collection, open full photo galleries, save selections, and ask about a material when you are ready.";',
    '  "Browse JW Stone\'s material library, review recently confirmed physical stock, save selections, and start a request when you are ready.";',
)
replace_once(server_html, 'itemShare.itemName : "Current stone selection"', 'itemShare.itemName : "Stone material selection"')
replace_once(
    server_html,
    '''    <h2>Current Inventory</h2>
    <p>Browse current selections by photo. Filter by aesthetic or color, then ask JW Stone to confirm what is on hand for your project.</p>
    <p>Browse the collection, save stones, and ask JW Stone when you are ready. Saving never starts a request.</p>
''',
    '''    <h2>Current Inventory</h2>
    <p>Only physical stock confirmed inside its active recheck window is presented as current inventory.</p>
    <h2>Material Library</h2>
    <p>Browse stone photographs and material examples without assuming a slab, bundle, block, container, or A-frame is physically on hand.</p>
    <p>Save materials and start a request when you are ready. JW Stone confirms the exact item, quantity, dimensions, finish, location, and timing before treating it as available.</p>
''',
)

seo = "client/src/features/jw-stone/JwStoneProfileSeo.tsx"
replace_once(
    seo,
    '''        hasPart: {
          "@type": "CollectionPage",
          name: "JW Stone current inventory",
          url: `${canonicalUrl}#current-inventory`,
        },
''',
    '''        hasPart: [
          {
            "@type": "CollectionPage",
            name: "JW Stone current inventory",
            url: `${canonicalUrl}#current-inventory`,
          },
          {
            "@type": "CollectionPage",
            name: "JW Stone material library",
            url: `${canonicalUrl}#material-library`,
          },
        ],
''',
)

canonical = "server/jwStoneCanonicalInventory.ts"
replace_once(
    canonical,
    '''  shareImageOrder?: number[];
};
''',
    '''  shareImageOrder?: number[];
  publicSummary: string;
  publicKind: "offering";
};
''',
)
replace_once(
    canonical,
    '''    images: stone.images,
    shareImageOrder: stone.shareImageOrder,
  };
''',
    '''    images: stone.images,
    shareImageOrder: stone.shareImageOrder,
    publicSummary: `${namePresentation.displayName || stone.name} is part of JW Stone's material library. Ask JW Stone to confirm current physical stock, quantity, dimensions, finish, location, and timing.`,
    publicKind: "offering",
  };
''',
)

legacy = "client/src/pages/profile-sites/WholesalerProfileThemeLegacy.tsx"
replace_once(legacy, 'const UNKNOWN_STONE_AVAILABILITY_COPY = "Call for availability";', 'const UNKNOWN_STONE_AVAILABILITY_COPY = "Request current availability";')

# Canonical current-stock API and operator mutations.
profiles = "server/routes/profiles.ts"
replace_once(
    profiles,
    'import { buildOptInProfileSitemapUrls } from "../profileSitemapDiscovery";',
    '''import { buildOptInProfileSitemapUrls } from "../profileSitemapDiscovery";
import { ensureStoneCoreTables } from "../services/stoneCoreProvisioning";
import {
  STONE_CURRENT_INVENTORY_AVAILABLE_STATUS,
  STONE_CURRENT_INVENTORY_FRESHNESS_DAYS,
  STONE_CURRENT_INVENTORY_MAX_CONFIRMATION_DAYS,
  STONE_CURRENT_INVENTORY_PUBLIC_STATUS,
  STONE_CURRENT_INVENTORY_VERIFIED_STATUS,
  isStoneInventoryConfirmationFresh,
  normalizePublicStoneInventoryImageUrls,
  type PublicStoneInventoryItem,
  type StoneInventoryDimensions,
} from "../../shared/stoneInventory";''',
)
replace_once(
    profiles,
    '''type PublicProfileTrustContext = {
  profileId: string;
  profileSlug: string;
  ownerUserId: string;
''',
    '''type PublicProfileTrustContext = {
  profileId: string;
  profileSlug: string;
  businessId: string | null;
  ownerUserId: string;
''',
)
replace_once(
    profiles,
    '''    profileId: String(profile.id),
    profileSlug: String(profile.slug),
    ownerUserId,
''',
    '''    profileId: String(profile.id),
    profileSlug: String(profile.slug),
    businessId: String(profile.businessId || "").trim() || null,
    ownerUserId,
''',
)

route_anchor = '''// Owner-only: total and recent real page-view counts for their own profile.
'''
route_block = r'''const stoneInventoryMutationSchema = z
  .object({
    materialSlug: z.string().trim().min(1).max(120).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
    materialName: z.string().trim().min(1).max(160),
    materialFamily: z.string().trim().min(1).max(80),
    materialClass: z.enum(["natural_stone", "engineered_stone"]),
    assetKind: z.enum(["slab", "bundle", "block", "container", "a_frame", "piece"]),
    sourceAssetRef: z.string().trim().min(1).max(160),
    quantity: z.number().positive().max(100000),
    unit: z.string().trim().min(1).max(40),
    dimensions: z
      .object({
        width: z.number().positive().max(100000).nullable().optional(),
        height: z.number().positive().max(100000).nullable().optional(),
        thickness: z.number().positive().max(100000).nullable().optional(),
        unit: z.enum(["in", "mm"]).default("in"),
      })
      .default({ unit: "in" }),
    finish: z.string().trim().max(120).nullable().optional(),
    locationRef: z.string().trim().max(200).nullable().optional(),
    imageUrls: z.array(z.string().max(2000)).max(12).default([]),
    sourceUrl: z.string().url().max(2000).nullable().optional(),
    lastConfirmedAt: z.string().datetime(),
    confirmationExpiresAt: z.string().datetime(),
    publish: z.boolean().default(true),
  })
  .superRefine((value, context) => {
    const confirmed = new Date(value.lastConfirmedAt);
    const expires = new Date(value.confirmationExpiresAt);
    const duration = expires.getTime() - confirmed.getTime();
    if (expires.getTime() <= confirmed.getTime()) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["confirmationExpiresAt"],
        message: "Recheck date must be after the confirmation date",
      });
    }
    if (duration > STONE_CURRENT_INVENTORY_MAX_CONFIRMATION_DAYS * 24 * 60 * 60 * 1000) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["confirmationExpiresAt"],
        message: `Recheck date cannot exceed ${STONE_CURRENT_INVENTORY_MAX_CONFIRMATION_DAYS} days`,
      });
    }
  });

let stoneCoreReadyPromise: Promise<void> | null = null;
function ensureStoneCoreReady(): Promise<void> {
  if (!stoneCoreReadyPromise) {
    stoneCoreReadyPromise = ensureStoneCoreTables().catch((error) => {
      stoneCoreReadyPromise = null;
      throw error;
    });
  }
  return stoneCoreReadyPromise;
}

function stoneInventoryRecord(value: unknown): Record<string, any> {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, any>;
  }
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
    } catch {
      return {};
    }
  }
  return {};
}

function stoneInventoryNumber(value: unknown): number | null {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function normalizeStonePassportCode(...parts: string[]): string {
  return parts
    .join(":")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9:._-]+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 220);
}

async function resolveStoneInventoryManagerUserId(
  req: any,
  context: PublicProfileTrustContext
): Promise<string | null> {
  const candidates = new Set<string>();
  const authenticated = getAuthedUserId(req);
  if (authenticated) candidates.add(authenticated);

  const bridgeToken =
    typeof req.query?.admin_token === "string"
      ? req.query.admin_token
      : readRawCookie(req, PROFILE_MANAGE_BRIDGE_COOKIE);
  const bridged = verifyManageBridgeToken(bridgeToken);
  if (bridged && bridged.profileId === context.profileId) candidates.add(String(bridged.uid));

  for (const userId of candidates) {
    const [viewer] = await db
      .select({ id: users.id, role: users.role, roles: users.roles })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);
    if (!viewer) continue;
    const roles = new Set([
      String(viewer.role || "").trim().toLowerCase(),
      ...(Array.isArray(viewer.roles)
        ? viewer.roles.map((role) => String(role || "").trim().toLowerCase())
        : []),
    ]);
    if (
      userId === context.ownerUserId ||
      roles.has("super_admin") ||
      roles.has("head_admin")
    ) {
      return userId;
    }
  }
  return null;
}

async function listPublicCurrentStoneInventory(
  context: PublicProfileTrustContext
): Promise<PublicStoneInventoryItem[]> {
  if (!context.businessId) return [];
  await ensureStoneCoreReady();
  const result = await pool.query(
    `SELECT ap.id,
            ap.passport_code,
            ap.asset_kind,
            ap.source_asset_ref,
            ap.dimensions_json,
            ap.condition_json,
            m.slug AS material_slug,
            m.canonical_name AS material_name,
            m.material_family,
            m.primary_image_url,
            ip.quantity,
            ip.unit,
            ip.location_ref,
            ip.updated_at
       FROM stone_inventory_positions ip
       INNER JOIN stone_asset_passports ap ON ap.id = ip.asset_passport_id
       INNER JOIN stone_materials m ON m.id = ap.material_id
      WHERE ip.holder_business_id = $1::uuid
        AND ip.lifecycle_status = $2
        AND ip.public_availability_status = $3
        AND ap.passport_status = $4
      ORDER BY ip.updated_at DESC, ap.updated_at DESC
      LIMIT 500`,
    [
      context.businessId,
      STONE_CURRENT_INVENTORY_AVAILABLE_STATUS,
      STONE_CURRENT_INVENTORY_PUBLIC_STATUS,
      STONE_CURRENT_INVENTORY_VERIFIED_STATUS,
    ]
  );

  const allowedAssetKinds = new Set(["slab", "bundle", "block", "container", "a_frame", "piece"]);
  const items: PublicStoneInventoryItem[] = [];
  for (const row of result.rows) {
    const condition = stoneInventoryRecord(row.condition_json);
    if (
      !isStoneInventoryConfirmationFresh({
        lastConfirmedAt: condition.lastConfirmedAt,
        confirmationExpiresAt: condition.confirmationExpiresAt,
      })
    ) {
      continue;
    }
    const quantity = stoneInventoryNumber(row.quantity);
    const assetKind = String(row.asset_kind || "").trim();
    const sourceAssetRef = String(row.source_asset_ref || "").trim();
    const materialSlug = String(row.material_slug || "").trim();
    const materialName = String(row.material_name || "").trim();
    if (!quantity || !allowedAssetKinds.has(assetKind) || !sourceAssetRef || !materialSlug || !materialName) {
      continue;
    }
    const rawDimensions = stoneInventoryRecord(row.dimensions_json);
    const dimensions: StoneInventoryDimensions | null = [
      rawDimensions.width,
      rawDimensions.height,
      rawDimensions.thickness,
    ].some((value) => stoneInventoryNumber(value) != null)
      ? {
          width: stoneInventoryNumber(rawDimensions.width),
          height: stoneInventoryNumber(rawDimensions.height),
          thickness: stoneInventoryNumber(rawDimensions.thickness),
          unit: rawDimensions.unit === "mm" ? "mm" : "in",
        }
      : null;
    const imageUrls = normalizePublicStoneInventoryImageUrls([
      ...(Array.isArray(condition.imageUrls) ? condition.imageUrls : []),
      row.primary_image_url,
    ]);
    items.push({
      id: String(row.id),
      passportCode: String(row.passport_code),
      materialSlug,
      materialName,
      materialFamily: String(row.material_family || "").trim() || null,
      assetKind: assetKind as PublicStoneInventoryItem["assetKind"],
      sourceAssetRef,
      quantity,
      unit: String(row.unit || "pieces").trim() || "pieces",
      dimensions,
      finish: String(condition.finish || "").trim() || null,
      locationLabel: String(row.location_ref || "").trim() || null,
      imageUrls,
      lastConfirmedAt: new Date(String(condition.lastConfirmedAt)).toISOString(),
      confirmationExpiresAt: new Date(String(condition.confirmationExpiresAt)).toISOString(),
    });
  }
  return items;
}

router.get("/api/u/:slug/stone-inventory/current", async (req, res) => {
  try {
    const context = await getPublicProfileTrustContext(String(req.params.slug || ""));
    if (!context) return res.status(404).json({ message: "Profile not found" });
    const items = await listPublicCurrentStoneInventory(context);
    res.setHeader("Cache-Control", "public, max-age=30, stale-while-revalidate=120");
    return res.json({
      profileSlug: context.profileSlug,
      freshnessDays: STONE_CURRENT_INVENTORY_FRESHNESS_DAYS,
      generatedAt: new Date().toISOString(),
      items,
    });
  } catch (error: any) {
    if (error?.code === "42P01") {
      return res.json({
        profileSlug: String(req.params.slug || ""),
        freshnessDays: STONE_CURRENT_INVENTORY_FRESHNESS_DAYS,
        generatedAt: new Date().toISOString(),
        items: [],
      });
    }
    console.error("[profiles] Failed loading current stone inventory:", error);
    return res.status(500).json({ message: "Failed to load current inventory" });
  }
});

router.post("/api/u/:slug/stone-inventory/current", async (req: any, res) => {
  const context = await getPublicProfileTrustContext(String(req.params.slug || ""));
  if (!context) return res.status(404).json({ message: "Profile not found" });
  if (!context.businessId) return res.status(400).json({ message: "A linked business is required" });
  const managerUserId = await resolveStoneInventoryManagerUserId(req, context);
  if (!managerUserId) return res.status(403).json({ message: "Profile management access required" });

  let payload: z.infer<typeof stoneInventoryMutationSchema>;
  try {
    payload = stoneInventoryMutationSchema.parse(req.body || {});
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: error.issues[0]?.message || "Invalid stock details" });
    }
    throw error;
  }

  await ensureStoneCoreReady();
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const imageUrls = normalizePublicStoneInventoryImageUrls(payload.imageUrls);
    const material = await client.query(
      `INSERT INTO stone_materials (
         slug, canonical_name, material_class, material_family,
         source_business_id, source_profile_slug, source_url, primary_image_url,
         source_status, source_metadata, updated_at
       ) VALUES ($1,$2,$3,$4,$5::uuid,$6,$7,$8,'operator_confirmed',$9::jsonb,now())
       ON CONFLICT (slug) DO UPDATE SET
         canonical_name = EXCLUDED.canonical_name,
         material_class = EXCLUDED.material_class,
         material_family = EXCLUDED.material_family,
         source_business_id = EXCLUDED.source_business_id,
         source_profile_slug = EXCLUDED.source_profile_slug,
         source_url = COALESCE(EXCLUDED.source_url, stone_materials.source_url),
         primary_image_url = COALESCE(EXCLUDED.primary_image_url, stone_materials.primary_image_url),
         source_status = 'operator_confirmed',
         source_metadata = stone_materials.source_metadata || EXCLUDED.source_metadata,
         updated_at = now()
       RETURNING id`,
      [
        payload.materialSlug,
        payload.materialName,
        payload.materialClass,
        payload.materialFamily,
        context.businessId,
        context.profileSlug,
        payload.sourceUrl || null,
        imageUrls[0] || null,
        JSON.stringify({ evidenceType: "operator_confirmed_physical_stock" }),
      ]
    );
    const materialId = String(material.rows[0]?.id || "");
    if (!materialId) throw new Error("Material record was not created");

    const passportCode = normalizeStonePassportCode(
      context.profileSlug,
      payload.materialSlug,
      payload.sourceAssetRef
    );
    const dimensions = {
      width: payload.dimensions.width ?? null,
      height: payload.dimensions.height ?? null,
      thickness: payload.dimensions.thickness ?? null,
      unit: payload.dimensions.unit,
    };
    const condition = {
      finish: payload.finish || null,
      imageUrls,
      sourceUrl: payload.sourceUrl || null,
      lastConfirmedAt: payload.lastConfirmedAt,
      confirmationExpiresAt: payload.confirmationExpiresAt,
      evidenceType: "operator_confirmed_physical_stock",
      confirmedByUserId: managerUserId,
    };
    const passport = await client.query(
      `INSERT INTO stone_asset_passports (
         passport_code, material_id, asset_kind, source_business_id,
         custody_business_id, source_asset_ref, dimensions_json,
         condition_json, passport_status, updated_at
       ) VALUES ($1,$2::uuid,$3,$4::uuid,$4::uuid,$5,$6::jsonb,$7::jsonb,$8,now())
       ON CONFLICT (passport_code) DO UPDATE SET
         material_id = EXCLUDED.material_id,
         asset_kind = EXCLUDED.asset_kind,
         source_business_id = EXCLUDED.source_business_id,
         custody_business_id = EXCLUDED.custody_business_id,
         source_asset_ref = EXCLUDED.source_asset_ref,
         dimensions_json = EXCLUDED.dimensions_json,
         condition_json = EXCLUDED.condition_json,
         passport_status = EXCLUDED.passport_status,
         updated_at = now()
       RETURNING id`,
      [
        passportCode,
        materialId,
        payload.assetKind,
        context.businessId,
        payload.sourceAssetRef,
        JSON.stringify(dimensions),
        JSON.stringify(condition),
        STONE_CURRENT_INVENTORY_VERIFIED_STATUS,
      ]
    );
    const passportId = String(passport.rows[0]?.id || "");
    if (!passportId) throw new Error("Stone passport was not created");

    const existing = await client.query(
      `SELECT id
         FROM stone_inventory_positions
        WHERE asset_passport_id = $1::uuid
          AND holder_business_id = $2::uuid
        ORDER BY updated_at DESC
        LIMIT 1
        FOR UPDATE`,
      [passportId, context.businessId]
    );
    const publicStatus = payload.publish
      ? STONE_CURRENT_INVENTORY_PUBLIC_STATUS
      : "not_published";
    if (existing.rows[0]?.id) {
      await client.query(
        `UPDATE stone_inventory_positions
            SET location_ref = $3,
                lifecycle_status = $4,
                quantity = $5,
                unit = $6,
                public_availability_status = $7,
                received_at = COALESCE(received_at, $8::timestamptz),
                released_at = NULL,
                updated_at = now()
          WHERE id = $1::uuid
            AND holder_business_id = $2::uuid`,
        [
          existing.rows[0].id,
          context.businessId,
          payload.locationRef || null,
          STONE_CURRENT_INVENTORY_AVAILABLE_STATUS,
          payload.quantity,
          payload.unit,
          publicStatus,
          payload.lastConfirmedAt,
        ]
      );
    } else {
      await client.query(
        `INSERT INTO stone_inventory_positions (
           asset_passport_id, holder_business_id, location_ref, lifecycle_status,
           quantity, unit, public_availability_status, received_at, updated_at
         ) VALUES ($1::uuid,$2::uuid,$3,$4,$5,$6,$7,$8::timestamptz,now())`,
        [
          passportId,
          context.businessId,
          payload.locationRef || null,
          STONE_CURRENT_INVENTORY_AVAILABLE_STATUS,
          payload.quantity,
          payload.unit,
          publicStatus,
          payload.lastConfirmedAt,
        ]
      );
    }
    await client.query("COMMIT");

    const items = await listPublicCurrentStoneInventory(context);
    return res.status(201).json({
      profileSlug: context.profileSlug,
      freshnessDays: STONE_CURRENT_INVENTORY_FRESHNESS_DAYS,
      generatedAt: new Date().toISOString(),
      item: items.find((item) => item.id === passportId) || null,
      items,
    });
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("[profiles] Failed confirming current stone inventory:", error);
    return res.status(500).json({ message: "Failed to confirm current stock" });
  } finally {
    client.release();
  }
});

router.delete("/api/u/:slug/stone-inventory/current/:passportId", async (req: any, res) => {
  try {
    const context = await getPublicProfileTrustContext(String(req.params.slug || ""));
    if (!context) return res.status(404).json({ message: "Profile not found" });
    if (!context.businessId) return res.status(400).json({ message: "A linked business is required" });
    const managerUserId = await resolveStoneInventoryManagerUserId(req, context);
    if (!managerUserId) return res.status(403).json({ message: "Profile management access required" });
    const passportId = z.string().uuid().parse(req.params.passportId);
    await ensureStoneCoreReady();
    await pool.query(
      `UPDATE stone_inventory_positions
          SET lifecycle_status = 'released',
              public_availability_status = 'not_published',
              released_at = now(),
              updated_at = now()
        WHERE asset_passport_id = $1::uuid
          AND holder_business_id = $2::uuid`,
      [passportId, context.businessId]
    );
    await pool.query(
      `UPDATE stone_asset_passports
          SET passport_status = 'retired', updated_at = now()
        WHERE id = $1::uuid
          AND custody_business_id = $2::uuid`,
      [passportId, context.businessId]
    );
    return res.status(204).send();
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: "Invalid stock identifier" });
    }
    console.error("[profiles] Failed retiring current stone inventory:", error);
    return res.status(500).json({ message: "Failed to remove current stock" });
  }
});

'''
replace_once(profiles, route_anchor, route_block + route_anchor)

# Document the now-enforced implementation boundary.
docs = "docs/architecture/STONE_CORE.md"
text = Path(docs).read_text(encoding="utf-8")
append = '''

## Public inventory truth implementation

JW Stone's photo catalog is a **Material Library**. It preserves names, categories,
photos, confirmed finish evidence, and historical source evidence without claiming
that a physical slab, bundle, block, container, or A-frame is currently on hand.

**Current Inventory** is a separate projection of verified `stone_asset_passports`
and `stone_inventory_positions`. A public item must have:

- a stable passport and source reference;
- verified passport status;
- an available inventory position held by the profile's linked business;
- positive quantity and unit;
- explicit `published_current` public status;
- an operator confirmation date;
- an unexpired recheck date; and
- confirmation no older than the platform freshness window.

When confirmation expires, the physical item disappears from Current Inventory
without deleting its passport, position history, material identity, photographs, or
request history. R.E.D. Graniti source materials never become JW Stone inventory
merely because a distribution right or publication target exists.
'''
if "## Public inventory truth implementation" not in text:
    Path(docs).write_text(text.rstrip() + append, encoding="utf-8")

print("STONE_INVENTORY_TRUTH_PATCH_READY")
