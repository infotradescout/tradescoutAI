import { and, asc, eq } from "drizzle-orm";
import { db } from "../db";
import { storage } from "../storage";
import {
  marketplaceCategories,
  marketplaceConversations,
  marketplaceListings,
  users,
} from "../../shared/schema";

type SupportInboxConfig = {
  supportUserId: string | null;
  supportListingId: string | null;
};

let cachedConfig: SupportInboxConfig | null = null;
let inFlight: Promise<SupportInboxConfig> | null = null;

function normalizeId(raw: unknown): string | null {
  const value = String(raw || "").trim();
  return value ? value : null;
}

async function resolveSupportUserId(): Promise<string | null> {
  const explicit = normalizeId(process.env.PLATFORM_SUPPORT_USER_ID);
  if (explicit) return explicit;

  try {
    const head = await storage.getUserByRole("head_admin");
    return normalizeId((head as any)?.id);
  } catch {
    return null;
  }
}

async function resolveCategoryIdFallback(): Promise<string | null> {
  const rows = await db
    .select({ id: marketplaceCategories.id })
    .from(marketplaceCategories)
    .orderBy(asc(marketplaceCategories.createdAt))
    .limit(1);
  return rows[0]?.id ? String(rows[0].id) : null;
}

async function getOrCreateSupportListingId(supportUserId: string): Promise<string | null> {
  const existing = await db
    .select({ id: marketplaceListings.id })
    .from(marketplaceListings)
    .where(
      and(
        eq(marketplaceListings.sellerId, supportUserId),
        eq(marketplaceListings.title, "TradeScout Support")
      )
    )
    .limit(1);
  if (existing[0]?.id) return String(existing[0].id);

  const categoryId = await resolveCategoryIdFallback();
  if (!categoryId) return null;

  const supportUser = await db
    .select({
      state: users.state,
      city: users.city,
    })
    .from(users)
    .where(eq(users.id, supportUserId))
    .limit(1);

  const fallbackState = String(supportUser[0]?.state || "TX").trim() || "TX";
  const fallbackCity = supportUser[0]?.city ? String(supportUser[0].city) : null;

  const [created] = await db
    .insert(marketplaceListings)
    .values({
      sellerId: supportUserId,
      categoryId,
      title: "TradeScout Support",
      description:
        "Official TradeScout support channel. Message us any time—this thread is for help, safety, and platform announcements.",
      price: "0.00",
      priceType: "fixed",
      county: "Platform",
      state: fallbackState,
      city: fallbackCity,
      zipCode: null,
      locationVisibility: "exact",
      latitude: null,
      longitude: null,
      isLocalPickupOnly: false,
      willShip: false,
      shippingCost: null,
      condition: "new",
      brand: "TradeScout",
      model: null,
      year: null,
      mileage: null,
      hours: null,
      specifications: { platformSupport: true } as any,
      images: [],
      primaryImageIndex: 0,
      videoUrl: null,
      requiresBuyerVerification: false,
      isSellerVerified: true,
      verificationStatus: "none_required",
      verificationNotes: null,
      verifiedAt: null,
      status: "removed",
      isPromoted: false,
      promotedUntil: null,
      approvedBy: null,
      approvedAt: null,
      rejectedBy: null,
      rejectedAt: null,
      rejectionReason: null,
      moderationNotes: null,
      viewCount: 0,
      favoriteCount: 0,
      contactCount: 0,
      slug: null,
      metaDescription: null,
      tags: ["platform_support"] as any,
      expiresAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    } as any)
    .returning({ id: marketplaceListings.id });

  return created?.id ? String(created.id) : null;
}

async function computeConfig(): Promise<SupportInboxConfig> {
  const supportUserId = await resolveSupportUserId();
  if (!supportUserId) return { supportUserId: null, supportListingId: null };

  const supportListingId = await getOrCreateSupportListingId(supportUserId);
  return { supportUserId, supportListingId };
}

export async function getPlatformSupportInboxConfig(): Promise<SupportInboxConfig> {
  if (cachedConfig) return cachedConfig;
  if (!inFlight) {
    inFlight = computeConfig()
      .catch((err) => {
        console.error("[platform-support-inbox] failed to resolve config", err);
        return { supportUserId: null, supportListingId: null };
      })
      .finally(() => {
        inFlight = null;
      });
  }
  cachedConfig = await inFlight;
  return cachedConfig;
}

export async function ensurePlatformSupportThreadForUser(userId: string): Promise<string | null> {
  const cfg = await getPlatformSupportInboxConfig();
  if (!cfg.supportUserId || !cfg.supportListingId) return null;
  if (cfg.supportUserId === userId) return null;

  const existing = await storage.getMarketplaceConversationByParticipants(
    cfg.supportListingId,
    userId,
    cfg.supportUserId
  );
  if (existing?.id) return String(existing.id);

  const created = await storage.createMarketplaceConversation({
    listingId: cfg.supportListingId,
    buyerId: userId,
    sellerId: cfg.supportUserId,
    status: "active",
    lastMessageAt: new Date(),
    buyerRating: null,
    sellerRating: null,
    buyerFeedback: null,
    sellerFeedback: null,
    isReadByBuyer: true,
    isReadBySeller: true,
    intent: null,
    authorityGate: null,
    sourceDecisionCardId: null,
    sourceScoutRecommendationId: null,
    confidenceScore: null,
    decisionScope: "platform_support_inbox",
    createdAt: new Date(),
    updatedAt: new Date(),
  } as any);

  // Mark as read to avoid "phantom unread" counters for first load.
  try {
    await db
      .update(marketplaceConversations)
      .set({ isReadByBuyer: true, isReadBySeller: true })
      .where(eq(marketplaceConversations.id, created.id));
  } catch {
    // ignore
  }

  return created?.id ? String(created.id) : null;
}
