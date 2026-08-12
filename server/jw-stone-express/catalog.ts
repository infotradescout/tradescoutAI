import type { Pool, PoolClient } from "pg";

import { JW_STONE_CANONICAL_INVENTORY_CATEGORIES } from "../jwStoneCanonicalInventory";
import { deterministicStonePublicRef } from "./security";
import { formatJwStoneUsdFromCents, type JwStonePublicTarget } from "@shared/jwStoneExpress";

type Queryable = Pick<Pool | PoolClient, "query">;

export type JwStoneInventoryTarget = {
  sourceRef: string;
  publicRef: string;
  shareSlug: string | null;
  label: string;
  imageUrl: string | null;
  description: string;
  anonymous: boolean;
};

function primaryImage(stone: { images: string[]; shareImageOrder?: number[] }): string | null {
  const orderedIndex = stone.shareImageOrder?.[0];
  const candidate = Number.isInteger(orderedIndex)
    ? stone.images[Number(orderedIndex)]
    : stone.images[0];
  return candidate ? String(candidate).trim() : null;
}

export const JW_STONE_OFFER_INVENTORY: readonly JwStoneInventoryTarget[] = Object.freeze(
  JW_STONE_CANONICAL_INVENTORY_CATEGORIES.flatMap((category) =>
    category.stones.map((stone) => {
      const anonymous = stone.nameStatus === "placeholder" || !stone.displayName;
      const sourceRef = String(stone.slug);
      return Object.freeze({
        sourceRef,
        publicRef: deterministicStonePublicRef(sourceRef),
        shareSlug: anonymous ? null : sourceRef,
        label: anonymous ? "JW Stone selection" : String(stone.displayName),
        imageUrl: primaryImage(stone),
        description: anonymous
          ? `${category.category} selection from current JW Stone inventory.`
          : `${String(stone.displayName)} from JW Stone's current ${category.category} inventory.`,
        anonymous,
      });
    })
  )
);

const byPublicRef = new Map(JW_STONE_OFFER_INVENTORY.map((stone) => [stone.publicRef, stone]));
const byShareSlug = new Map(
  JW_STONE_OFFER_INVENTORY.filter((stone) => stone.shareSlug).map((stone) => [
    stone.shareSlug!,
    stone,
  ])
);
const byImageUrl = new Map(
  JW_STONE_OFFER_INVENTORY.filter((stone) => stone.imageUrl).map((stone) => [
    stone.imageUrl!,
    stone,
  ])
);
const bySourceRef = new Map(JW_STONE_OFFER_INVENTORY.map((stone) => [stone.sourceRef, stone]));

export function resolvePublicStoneInput(input: {
  shareSlug?: string | null;
  imageUrl?: string | null;
}): JwStoneInventoryTarget | null {
  const shareSlug = String(input.shareSlug || "")
    .trim()
    .toLowerCase();
  const imageUrl = String(input.imageUrl || "").trim();
  if (shareSlug && imageUrl) return null;
  if (shareSlug) return byShareSlug.get(shareSlug) ?? null;
  if (imageUrl) return byImageUrl.get(imageUrl) ?? null;
  return null;
}

export function getStoneByPublicRef(ref: string): JwStoneInventoryTarget | null {
  return byPublicRef.get(String(ref)) ?? null;
}

export function getStoneBySourceRef(ref: string): JwStoneInventoryTarget | null {
  return bySourceRef.get(String(ref)) ?? null;
}

export async function getStonePublicTarget(
  queryable: Queryable,
  stone: JwStoneInventoryTarget
): Promise<JwStonePublicTarget> {
  const settings = await queryable.query(
    `select accepting_offers, minimum_offer_cents
     from jw_stone_offer_settings where stone_source_ref = $1`,
    [stone.sourceRef]
  );
  const row = settings.rows[0];
  const minimum =
    row?.minimum_offer_cents == null
      ? null
      : formatJwStoneUsdFromCents(Number(row.minimum_offer_cents));
  return {
    kind: "stone",
    ref: stone.publicRef,
    label: stone.label,
    imageUrl: stone.imageUrl,
    description: stone.description,
    acceptingOffers: row ? Boolean(row.accepting_offers) : true,
    minimumAmount: minimum,
  };
}

export async function getContainerPublicTarget(
  queryable: Queryable,
  ref: string,
  options: { includeNonPublic?: boolean } = {}
): Promise<(JwStonePublicTarget & { containerId: string; status: string }) | null> {
  const result = await queryable.query(
    `
      select id, public_ref, title, description, image_url, status,
             accepting_offers, minimum_offer_cents
      from jw_stone_containers
      where public_ref = $1
        ${options.includeNonPublic ? "" : "and status = 'published'"}
      limit 1
    `,
    [ref]
  );
  const row = result.rows[0];
  if (!row) return null;
  return {
    kind: "container",
    ref: String(row.public_ref),
    label: String(row.title),
    imageUrl: row.image_url ? String(row.image_url) : null,
    description: row.description ? String(row.description) : null,
    acceptingOffers: row.status === "published" && Boolean(row.accepting_offers),
    minimumAmount:
      row.minimum_offer_cents == null
        ? null
        : formatJwStoneUsdFromCents(Number(row.minimum_offer_cents)),
    containerId: String(row.id),
    status: String(row.status),
  };
}

export async function listPublishedContainers(
  queryable: Queryable
): Promise<JwStonePublicTarget[]> {
  const result = await queryable.query(
    `
      select public_ref, title, description, image_url, accepting_offers, minimum_offer_cents
      from jw_stone_containers
      where status = 'published'
      order by published_at asc nulls last, created_at asc, id asc
    `
  );
  return result.rows.map((row) => ({
    kind: "container" as const,
    ref: String(row.public_ref),
    label: String(row.title),
    imageUrl: row.image_url ? String(row.image_url) : null,
    description: row.description ? String(row.description) : null,
    acceptingOffers: Boolean(row.accepting_offers),
    minimumAmount:
      row.minimum_offer_cents == null
        ? null
        : formatJwStoneUsdFromCents(Number(row.minimum_offer_cents)),
  }));
}

export async function resolveOfferTarget(
  queryable: Queryable,
  target: { kind: "stone" | "container"; ref: string },
  options: { includeNonPublicContainer?: boolean } = {}
): Promise<{
  publicTarget: JwStonePublicTarget;
  stoneSourceRef: string | null;
  containerId: string | null;
}> {
  if (target.kind === "stone") {
    const stone = getStoneByPublicRef(target.ref);
    if (!stone)
      throw Object.assign(new Error("That JW Stone selection is unavailable."), { status: 404 });
    return {
      publicTarget: await getStonePublicTarget(queryable, stone),
      stoneSourceRef: stone.sourceRef,
      containerId: null,
    };
  }
  const container = await getContainerPublicTarget(queryable, target.ref, {
    includeNonPublic: options.includeNonPublicContainer,
  });
  if (!container)
    throw Object.assign(new Error("That JW Stone container is unavailable."), { status: 404 });
  const { containerId, status: _status, ...publicTarget } = container;
  return { publicTarget, stoneSourceRef: null, containerId };
}

export function ensureTargetAcceptsAmount(target: JwStonePublicTarget, amountCents: number): void {
  if (!target.acceptingOffers) {
    throw Object.assign(new Error("JW Stone is not accepting offers for this selection."), {
      status: 409,
    });
  }
  if (target.minimumAmount) {
    const minimumCents = Math.round(Number(target.minimumAmount) * 100);
    if (amountCents < minimumCents) {
      throw Object.assign(new Error(`The posted minimum offer is $${target.minimumAmount}.`), {
        status: 422,
      });
    }
  }
}
