/* eslint-disable @typescript-eslint/no-explicit-any -- Storage layer interfaces with dynamic JSON blobs + 3rd-party SDKs; incremental hardening tracked separately. */
import {
  users,
  profiles,
  contractors,
  recommendations,
  leads,
  counties,
  states,
  trades,
  tradeRequirements,
  growthPackDownloads,
  acceleratorMemberships,
  pricingData,
  events,
  contractorCounties,
  leadAssignments,
  conversations,
  messages,
  quotes,
  schedules,
  profileBookingRequests,
  materialLists,
  siteSettings,
  prizeConfigurations,
  advertisements,
  contractorSettings,
  savedAds,
  notifications,
  errorReports,
  contractorPromos,
  promoInteractions,
  marketplaceCategories,
  marketplaceListings,
  contractorApplications,
  // Handmade marketplace
  handmadeCategories,
  handmadeProducts,
  productFavorites,
  productOrders,
  productReviews,
  sellerProfiles,
  // Social features
  communityPosts,
  communityGroups,
  groupMembers,
  // Community moderation
  moderationReports,
  moderationVotes,
  userModerationReputation,
  moderationActions,
  moderationAppeals,
  moderationSettings,
  // Invitation system
  invitations,
  referralStats,
  // Professional profiles
  realtorProfiles,
  carSalesmanProfiles,
  // Feature flags
  featureFlags,
  // New marketplace features
  marketplaceTransactions,
  transactionDisputes,
  userReviews,
  realTimeNotifications,
  savedSearches,
  searchAnalytics,
  platformAnalytics,
  marketplaceConversations,
  marketplaceMessages,
  // Foundation system
  foundationCauses,
  foundationDonations,
  userDonationPreferences,
  foundationImpactReports,
  countyVaults,
  vaultLedgerEntries,
  communityVaults,
  communityVaultLedgerEntries,
  communityCauses,
  communityCauseVotes,
  platformSupportLedgerEntries,
  walletAccounts,
  walletTransactions,
  promotions,
  // Affiliate accounts
  affiliateAccounts,
  affiliateReferrals,
  affiliatePayouts,
  // Affiliate system (advanced program temporarily disabled for MVP)
  // HOA Management
  homeownerAssociations,
  hoaFinancialRecords,
  hoaVendors,
  hoaVotes,
  hoaVoteResponses,
  hoaVoteBoardTransfers,
  hoaServiceRequests,
  hoaMembers,
  hoaMembershipDepartures,
  hoaGovernance,
  // Community Builder System
  communityBuilderProfiles,
  builderContributions,
  builderAuditLogs,
  builderPayouts,
  builderLeaderboard,
  builderReferrals,
  builderNotifications,
  type TrustedDevice,
  type User,
  type InsertUser,
  type UpsertUser,
  type Business,
  type InsertBusiness,
  type Profile,
  type InsertProfile,
  type Contractor,
  type InsertContractor,
  type Recommendation,
  type InsertRecommendation,
  type Lead,
  type InsertLead,
  type County,
  type InsertCounty,
  type Trade,
  type InsertTrade,
  type GrowthPackDownload,
  type InsertGrowthPackDownload,
  type AcceleratorMembership,
  type InsertAcceleratorMembership,
  type PricingData,
  type InsertPricingData,
  type Conversation,
  type InsertConversation,
  type Message,
  type InsertMessage,
  type Quote,
  type InsertQuote,
  type Schedule,
  type InsertSchedule,
  type ProfileBookingRequest,
  type InsertProfileBookingRequest,
  type MaterialList,
  type InsertMaterialList,
  type SiteSetting,
  type InsertSiteSetting,
  type PrizeConfiguration,
  type InsertPrizeConfiguration,
  type Advertisement,
  type InsertAdvertisement,
  type ContractorSetting,
  type InsertContractorSetting,
  type SavedAd,
  type Notification,
  type InsertNotification,
  type ContractorPromo,
  type InsertContractorPromo,
  type PromoInteraction,
  type InsertPromoInteraction,
  adEvents,
  type AdEvent,
  type InsertAdEvent,
  // Handmade marketplace
  type HandmadeCategory,
  type InsertHandmadeCategory,
  type HandmadeProduct,
  type InsertHandmadeProduct,
  type ProductOrder,
  type InsertProductOrder,
  type ProductReview,
  type InsertProductReview,
  type SellerProfile,
  type InsertSellerProfile,
  adFeedback,
  type AdFeedback,
  type InsertAdFeedback,
  providerDeclarations,
  providerEligibilities,
  providerLocalStats,
  businessVerifications,
  type ProviderDeclaration,
  type ProviderEligibility,
  type InsertProviderEligibility,
  type ProviderLocalStat,
  type BusinessVerification,
  type TradeRequirement,
  // Social features
  type CommunityGroup,
  // Community moderation types
  type ModerationReport,
  type InsertModerationReport,
  type ModerationVote,
  type InsertModerationVote,
  type UserModerationReputation,
  type InsertUserModerationReputation,
  type ModerationAction,
  type InsertModerationAction,
  type ModerationAppeal,
  type InsertModerationAppeal,
  type ModerationSettings,
  type InsertModerationSettings,
  // Invitation types
  type Invitation,
  type InsertInvitation,
  type ReferralStats,
  type InsertReferralStats,
  // Professional profile types
  type RealtorProfile,
  type InsertRealtorProfile,
  type CarSalesmanProfile,
  type InsertCarSalesmanProfile,
  countyMetrics,
  countyEntities,
  type CountyMetric,
  type CountyEntity,
  type InsertCountyEntity,
  // New marketplace features types
  type MarketplaceTransaction,
  type InsertMarketplaceTransaction,
  type TransactionDispute,
  type InsertTransactionDispute,
  type UserReview,
  type InsertUserReview,
  type ListingBoost,
  type InsertListingBoost,
  type RealTimeNotification,
  type InsertRealTimeNotification,
  paymentConfigurations,
  contractorPayments,
  type SavedSearch,
  type InsertSavedSearch,
  type SearchAnalytics,
  type InsertSearchAnalytics,
  type PlatformAnalytics,
  type InsertPlatformAnalytics,
  type MarketplaceConversation,
  type InsertMarketplaceConversation,
  type MarketplaceMessage,
  type InsertMarketplaceMessage,
  listingBoosts,
  // Payment system types
  type PaymentConfiguration,
  type InsertPaymentConfiguration,
  type ContractorPayment,
  type InsertContractorPayment,
  // Foundation system types
  type FoundationCause,
  type InsertFoundationCause,
  type FoundationDonation,
  type InsertFoundationDonation,
  type UserDonationPreferences,
  type InsertUserDonationPreferences,
  type FoundationImpactReport,
  type InsertFoundationImpactReport,
  type CountyVault,
  type VaultLedgerEntry,
  type CommunityVault,
  type CommunityVaultLedgerEntry,
  type CommunityCause,
  type CommunityCauseVote,
  type PlatformSupportLedgerEntry,
  type InsertPlatformSupportLedgerEntry,
  type WalletAccount,
  type InsertWalletAccount,
  type WalletTransaction,
  type InsertWalletTransaction,
  type AffiliateAccount,
  type AffiliateReferral as DbAffiliateReferral,
  type AffiliatePayout as DbAffiliatePayout,
  type Promotion,
  type InsertPromotion,
  // Community Builder types
  type CommunityBuilderProfile,
  type BuilderContribution,
  type InsertBuilderContribution,
  type BuilderAuditLog,
  type BuilderPayout,
  type InsertBuilderPayout,
  type BuilderLeaderboard,
  type BuilderReferral,
  type BuilderNotification,
  // Smart Recommendation Generator types
  type RecommendationInsight,
  type InsertRecommendationInsight,
  type RecommendationGoal,
  type InsertRecommendationGoal,
  type RecommendationCampaign,
  type InsertRecommendationCampaign,
  // Smart Recommendation Generator
  recommendationInsights,
  recommendationGoals,
  recommendationCampaigns,
  // Phase 1: Daily Deals System
  dailyDeals,
  userAffiliates,
  type UserAffiliate,
  type InsertUserAffiliate,
  affiliateTracking,
  type AffiliateTracking,
  type InsertAffiliateTracking,
  dealEngagements,
  type DealEngagement,
  type InsertDealEngagement,
  countyNotes,
  type CountyNote,
  type InsertCountyNote,
  employmentPostApplications,
} from "@shared/schema";
import { db, pool as neonPool } from "./db";
import { UserSecurityRepository } from "./repositories/userSecurityRepository";
import { SitemapRepository } from "./repositories/sitemapRepository";
import { BusinessRepository, type PublicBusinessRecord } from "./repositories/businessRepository";
import { ProfileRepository, type PublicProfileRecord } from "./repositories/profileRepository";
import { OutcomeOnboardingRepository } from "./repositories/outcomeOnboardingRepository";
import { CrmAndDealsStorageRepository } from "./storage/repositories/crm-and-deals";
import type {
  AtomicBusinessOutcomeArgs,
  AtomicExpressOutcomeArgs,
} from "./services/onboardingService";
import {
  eq,
  and,
  desc,
  asc,
  sql,
  inArray,
  like,
  ilike,
  gt,
  or,
  lt,
  isNull,
  isNotNull,
  ne,
  gte,
  lte,
  notInArray,
  count,
  sum,
  type SQL,
} from "drizzle-orm";
import { getTableColumns } from "drizzle-orm/utils";
import bcrypt from "bcrypt";
import { applyPrivilegedVerificationBypass } from "./utils/privilegedVerification";
import { computeAllocationShares } from "./utils/communityCauseAllocation";
import { ensureSuperAdminConnectionForUser } from "./utils/superAdminConnection";
import type { IStorage } from "./storage/contracts";
export type { IStorage } from "./storage/contracts";

// Helper to safely convert strings/numbers to Decimal format
const decimal = (value: any): string => {
  if (!value) return "0";
  const num = typeof value === "string" ? parseFloat(value) : Number(value);
  return isNaN(num) ? "0" : num.toFixed(2);
};

// Local aliases for affiliate insert types (not exported from schema)
type InsertAffiliateAccount = typeof affiliateAccounts.$inferInsert;
type InsertAffiliateReferral = typeof affiliateReferrals.$inferInsert;
type InsertAffiliatePayout = typeof affiliatePayouts.$inferInsert;
type AffiliateProgram = AffiliateAccount;
type InsertAffiliateProgram = InsertAffiliateAccount;
type AffiliateReferral = DbAffiliateReferral;
type AffiliatePayout = DbAffiliatePayout;

// Minimal commission shape mapped onto affiliate referral records.
type AffiliateCommission = {
  id: string;
  affiliateProgramId: string;
  status: string;
  commissionAmount?: string;
  revenueAmount?: string;
  referralId?: string;
  transactionId?: string;
  description?: string;
  createdAt: Date;
  approvedAt?: Date | null;
  paidAt?: Date | null;
};

type InsertAffiliateCommission = Omit<AffiliateCommission, "id" | "createdAt"> & {
  id?: string;
  createdAt?: Date;
};

export class DatabaseStorage extends CrmAndDealsStorageRepository implements IStorage {
  private readonly userSecurityRepository = new UserSecurityRepository();
  private readonly sitemapRepository = new SitemapRepository();
  private readonly businessRepository = new BusinessRepository();
  private readonly profileRepository = new ProfileRepository();
  private readonly outcomeOnboardingRepository = new OutcomeOnboardingRepository();

  private normalizeLegacyAdminUser(user: User | undefined): User | undefined {
    if (!user) return user;

    const rawRole =
      typeof (user as any).role === "string"
        ? String((user as any).role)
            .trim()
            .toLowerCase()
        : "";
    if (rawRole !== "owner") {
      return applyPrivilegedVerificationBypass(user);
    }

    const existingRoles = Array.isArray((user as any).roles)
      ? (user as any).roles.map((r: any) => String(r))
      : [];
    const normalizedRoles = Array.from(new Set(["super_admin", ...existingRoles]));

    const normalizedUser = {
      ...user,
      role: "super_admin" as any,
      roles: normalizedRoles as any,
      isAdmin: true as any,
      isSuperAdmin: true as any,
    } as User;

    return applyPrivilegedVerificationBypass(normalizedUser);
  }

  private countiesCache = new Map<
    string,
    { expiresAt: number; rows: (County & { state?: { name: string; code: string } })[] }
  >();
  async listBusinessesByOwner(ownerUserId: string): Promise<Business[]> {
    return this.businessRepository.listBusinessesByOwner(ownerUserId);
  }

  async getBusinessByIdForOwner(
    ownerUserId: string,
    businessId: string
  ): Promise<Business | undefined> {
    return this.businessRepository.getBusinessByIdForOwner(ownerUserId, businessId);
  }

  async getBusinessBySlugPublic(slug: string): Promise<Business | undefined> {
    return this.businessRepository.getBusinessBySlugPublic(slug);
  }

  async getBusinessPublicById(businessId: string): Promise<PublicBusinessRecord | undefined> {
    return this.businessRepository.getBusinessPublicById(businessId);
  }

  async getBusinessCountyIds(businessId: string): Promise<string[]> {
    return this.businessRepository.getBusinessCountyIds(businessId);
  }

  async getProvidersByCountyAndCategory(args: {
    countyId: string;
    roleContexts?: string[];
    tradeSlug?: string;
    query?: string;
    limit?: number;
    offset?: number;
  }): Promise<
    Array<{
      businessId: string;
      ownerUserId: string | null;
      name: string;
      roleContext: string;
      slug: string;
    }>
  > {
    // businesses + countyId query lives in BusinessRepository.
    return this.businessRepository.getProvidersByCountyAndCategory(args);
  }

  async getProvidersByStateAndCategory(args: {
    stateCode: string;
    roleContexts?: string[];
    tradeSlug?: string;
    query?: string;
    limit?: number;
    offset?: number;
  }): Promise<
    Array<{
      businessId: string;
      ownerUserId: string | null;
      name: string;
      roleContext: string;
      slug: string;
    }>
  > {
    // State scope is derived from canonical business-to-county assignments.
    return this.businessRepository.getProvidersByStateAndCategory(args);
  }

  async getActiveBusinessForUser(userId: string): Promise<Business | undefined> {
    return this.businessRepository.getActiveBusinessForUser(userId);
  }

  async completeOutcomeBusinessProfile(
    args: AtomicBusinessOutcomeArgs
  ): Promise<{ business: Business; profile: Profile }> {
    return this.outcomeOnboardingRepository.completeBusinessProfile(args);
  }

  async preflightOutcomeBusinessProfile(
    args: Pick<AtomicBusinessOutcomeArgs, "userId" | "evidence">
  ): Promise<void> {
    return this.outcomeOnboardingRepository.preflightBusinessProfile(args);
  }

  async completeOutcomeExpressResult(args: AtomicExpressOutcomeArgs): Promise<void> {
    return this.outcomeOnboardingRepository.completeExpressResult(args);
  }

  async getWorkersByCountyAndSkills(args: {
    countyFips: string;
    skills?: string[];
    limit?: number;
  }): Promise<
    Array<{
      workerId: string;
      userId: string;
      firstName: string;
      lastName: string;
      skills: string[];
      hourlyRate: string | null;
      isAvailable: boolean;
    }>
  > {
    // workers query lives in BusinessRepository.
    return this.businessRepository.getWorkersByCountyAndSkills(args);
  }

  async createBusinessForOwner(
    ownerUserId: string,
    data: Omit<InsertBusiness, "id" | "ownerUserId" | "createdAt" | "updatedAt"> & {
      countyIds?: string[];
    }
  ): Promise<Business> {
    return this.businessRepository.createBusinessForOwner(ownerUserId, data);
  }

  async createUnclaimedBusiness(
    data: Omit<InsertBusiness, "id" | "ownerUserId" | "createdAt" | "updatedAt"> & {
      countyIds?: string[];
    }
  ): Promise<Business> {
    return this.businessRepository.createUnclaimedBusiness(data);
  }

  async claimUnclaimedBusinessForUser(businessId: string, userId: string): Promise<Business> {
    return this.businessRepository.claimUnclaimedBusinessForUser(businessId, userId);
  }

  async updateBusinessForOwner(
    ownerUserId: string,
    businessId: string,
    updates: Partial<Omit<InsertBusiness, "id" | "ownerUserId" | "createdAt" | "updatedAt">> & {
      countyIds?: string[];
    }
  ): Promise<Business> {
    return this.businessRepository.updateBusinessForOwner(ownerUserId, businessId, updates);
  }

  async softDeleteBusinessForOwner(ownerUserId: string, businessId: string): Promise<Business> {
    return this.businessRepository.softDeleteBusinessForOwner(ownerUserId, businessId);
  }

  async setUserActiveBusiness(userId: string, businessId: string | null): Promise<User> {
    return this.businessRepository.setUserActiveBusiness(userId, businessId);
  }

  async listProfilesByOwner(ownerUserId: string): Promise<Profile[]> {
    return this.profileRepository.listProfilesByOwner(ownerUserId);
  }

  async getProfileByIdForOwner(
    ownerUserId: string,
    profileId: string
  ): Promise<Profile | undefined> {
    return this.profileRepository.getProfileByIdForOwner(ownerUserId, profileId);
  }

  async getProfileBySlugPublic(slug: string): Promise<PublicProfileRecord | undefined> {
    return this.profileRepository.getProfileBySlugPublic(slug);
  }

  async getProfileBySlugForManagement(slug: string): Promise<PublicProfileRecord | undefined> {
    return this.profileRepository.getProfileBySlugForManagement(slug);
  }

  async getProfileBySlugPublished(slug: string): Promise<PublicProfileRecord | undefined> {
    return this.profileRepository.getProfileBySlugPublished(slug);
  }

  async listPublicProfilesForSitemap(): Promise<Array<{ slug: string; updatedAt: Date | null }>> {
    return this.sitemapRepository.listPublicProfilesForSitemap();
  }

  async listBusinessProfilesForSitemap(): Promise<Array<{ slug: string; updatedAt: Date | null }>> {
    return this.sitemapRepository.listBusinessProfilesForSitemap();
  }

  async countActiveDirectoryBusinessesForSitemap(): Promise<number> {
    return this.sitemapRepository.countActiveDirectoryBusinessesForSitemap();
  }

  async listActiveDirectoryBusinessesForSitemap(args?: {
    limit?: number;
    offset?: number;
  }): Promise<Array<{ slug: string; updatedAt: Date | null }>> {
    return this.sitemapRepository.listActiveDirectoryBusinessesForSitemap(args);
  }

  async countDirectoryCountiesForSitemap(): Promise<number> {
    return this.sitemapRepository.countDirectoryCountiesForSitemap();
  }

  async listDirectoryCountiesForSitemap(args?: {
    limit?: number;
    offset?: number;
  }): Promise<Array<{ fips: string; name: string; stateCode: string; updatedAt: Date | null }>> {
    return this.sitemapRepository.listDirectoryCountiesForSitemap(args);
  }

  async countDirectoryCitiesForSitemap(): Promise<number> {
    return this.sitemapRepository.countDirectoryCitiesForSitemap();
  }

  async listDirectoryCitiesForSitemap(args?: {
    limit?: number;
    offset?: number;
  }): Promise<Array<{ stateCode: string; citySlug: string; updatedAt: Date | null }>> {
    return this.sitemapRepository.listDirectoryCitiesForSitemap(args);
  }

  async listActiveHomeScoutListingsForSitemap(args?: {
    limit?: number;
  }): Promise<Array<{ id: string; updatedAt: Date | null }>> {
    return this.sitemapRepository.listActiveHomeScoutListingsForSitemap(args);
  }

  async listHomeScoutCountiesForSitemap(args?: {
    limit?: number;
  }): Promise<Array<{ countyFips: string; stateCode: string; updatedAt: Date | null }>> {
    return this.sitemapRepository.listHomeScoutCountiesForSitemap(args);
  }

  async listTradePartnerCountiesForSitemap(args?: {
    limit?: number;
  }): Promise<Array<{ countySlug: string; updatedAt: Date | null; allowedCategories: string[] }>> {
    return this.sitemapRepository.listTradePartnerCountiesForSitemap(args);
  }

  async listActiveExchangeListingsForSitemap(args?: {
    limit?: number;
  }): Promise<
    Array<{ id: string; sellerUserId: string; categoryName: string; updatedAt: Date | null }>
  > {
    return this.sitemapRepository.listActiveExchangeListingsForSitemap(args);
  }

  async searchProfilesPublic(args: { query: string; limit?: number }): Promise<
    Array<{
      id: string;
      slug: string;
      displayName: string;
      headline: string | null;
      roleContext: any;
    }>
  > {
    return this.profileRepository.searchProfilesPublic(args);
  }

  async createProfileForOwner(
    ownerUserId: string,
    data: Omit<InsertProfile, "id" | "ownerUserId" | "createdAt" | "updatedAt">
  ): Promise<Profile> {
    return this.profileRepository.createProfileForOwner(ownerUserId, data);
  }

  async updateProfileForOwner(
    ownerUserId: string,
    profileId: string,
    updates: Partial<Omit<InsertProfile, "id" | "ownerUserId" | "createdAt" | "updatedAt">>
  ): Promise<Profile> {
    return this.profileRepository.updateProfileForOwner(ownerUserId, profileId, updates);
  }

  async updateProfileById(
    profileId: string,
    updates: Partial<Omit<InsertProfile, "id" | "ownerUserId" | "createdAt" | "updatedAt">>
  ): Promise<Profile> {
    return this.profileRepository.updateProfileById(profileId, updates);
  }

  async getProfileById(profileId: string): Promise<Profile | undefined> {
    return this.profileRepository.getProfileById(profileId);
  }

  async setUserActiveProfile(userId: string, profileId: string | null): Promise<User> {
    return this.profileRepository.setUserActiveProfile(userId, profileId);
  }

  async getProfileOwnerUserId(profileId: string): Promise<string | null> {
    return this.profileRepository.getProfileOwnerUserId(profileId);
  }

  async createProfileBookingRequest(
    input: Omit<InsertProfileBookingRequest, "id" | "createdAt" | "updatedAt">
  ): Promise<ProfileBookingRequest> {
    const [row] = await db
      .insert(profileBookingRequests)
      .values({
        ...input,
        updatedAt: new Date(),
      } as any)
      .returning();
    if (!row) throw new Error("Failed to create profile booking request");
    return row as ProfileBookingRequest;
  }

  async getProfileBookingRequestById(id: string): Promise<ProfileBookingRequest | undefined> {
    const [row] = await db
      .select()
      .from(profileBookingRequests)
      .where(eq(profileBookingRequests.id, id));
    return row as ProfileBookingRequest | undefined;
  }

  async listProfileBookingRequestsForOwner(ownerUserId: string): Promise<ProfileBookingRequest[]> {
    return (await db
      .select()
      .from(profileBookingRequests)
      .where(eq(profileBookingRequests.ownerUserId, ownerUserId))
      .orderBy(desc(profileBookingRequests.createdAt))) as ProfileBookingRequest[];
  }

  async listProfileBookingRequestsForRequester(
    requesterUserId: string
  ): Promise<ProfileBookingRequest[]> {
    return (await db
      .select()
      .from(profileBookingRequests)
      .where(eq(profileBookingRequests.requesterUserId, requesterUserId))
      .orderBy(desc(profileBookingRequests.createdAt))) as ProfileBookingRequest[];
  }

  async updateProfileBookingRequest(
    id: string,
    patch: Partial<Omit<InsertProfileBookingRequest, "id" | "ownerUserId" | "requesterUserId">>
  ): Promise<ProfileBookingRequest> {
    const [row] = await db
      .update(profileBookingRequests)
      .set({ ...(patch as any), updatedAt: new Date() })
      .where(eq(profileBookingRequests.id, id))
      .returning();
    if (!row) throw new Error("Profile booking request not found");
    return row as ProfileBookingRequest;
  }

  private normalizeDecimal(value: any): number {
    if (value === null || value === undefined) return 0;
    const numeric = typeof value === "string" ? parseFloat(value) : Number(value);
    return Number.isFinite(numeric) ? numeric : 0;
  }

  private normalizeDecimalString(value: any): string {
    return this.normalizeDecimal(value).toFixed(2);
  }

  private coerceContractorMilestones(value: any):
    | {
        description: string;
        amount: number;
        dueDate?: string;
        completed?: boolean;
        completedAt?: string;
      }[]
    | null
    | undefined {
    if (value === null || value === undefined) return value;
    if (!Array.isArray(value)) return undefined;
    return value
      .filter((m) => m && typeof m === "object")
      .map((m) => ({
        description: String((m as any).description ?? ""),
        amount: Number((m as any).amount ?? 0),
        dueDate: (m as any).dueDate != null ? String((m as any).dueDate) : undefined,
        completed: (m as any).completed != null ? Boolean((m as any).completed) : undefined,
        completedAt: (m as any).completedAt != null ? String((m as any).completedAt) : undefined,
      }));
  }

  private coerceRecommendationGoalMilestones(value: any):
    | {
        target: number;
        achievedAt?: string;
        reward?: string;
      }[]
    | null
    | undefined {
    if (value === null || value === undefined) return value;
    if (!Array.isArray(value)) return undefined;
    return value
      .filter((m) => m && typeof m === "object")
      .map((m) => ({
        target: Number((m as any).target ?? 0),
        achievedAt: (m as any).achievedAt != null ? String((m as any).achievedAt) : undefined,
        reward: (m as any).reward != null ? String((m as any).reward) : undefined,
      }));
  }

  private coerceRecommendationCampaignTargets(value: any):
    | {
        projectType?: string;
        projectValue?: number;
        completionDate?: string;
        email?: string;
        phone?: string;
      }[]
    | null
    | undefined {
    if (value === null || value === undefined) return value;
    if (!Array.isArray(value)) return undefined;
    return value
      .filter((t) => t && typeof t === "object")
      .map((t) => ({
        projectType: (t as any).projectType != null ? String((t as any).projectType) : undefined,
        projectValue: (t as any).projectValue != null ? Number((t as any).projectValue) : undefined,
        completionDate:
          (t as any).completionDate != null ? String((t as any).completionDate) : undefined,
        email: (t as any).email != null ? String((t as any).email) : undefined,
        phone: (t as any).phone != null ? String((t as any).phone) : undefined,
      }));
  }

  // User operations
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return this.normalizeLegacyAdminUser(user);
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const normalized = String(email || "")
      .trim()
      .toLowerCase();
    if (!normalized) return undefined;

    // Emails are case-insensitive in practice; enforce that behavior here so
    // login/register don't break on casing differences.
    const [user] = await db
      .select()
      .from(users)
      .where(sql`lower(${users.email}) = ${normalized}`)
      .limit(1);
    return this.normalizeLegacyAdminUser(user);
  }

  async getUserByRole(role: string): Promise<User | undefined> {
    let normalizedRole = String(role || "")
      .trim()
      .toLowerCase();
    if (!normalizedRole) return undefined;

    // Backward-compat: treat "super_admin" as "super_admin" (super_admin is the highest).
    if (normalizedRole === "super_admin") normalizedRole = "super_admin";

    const [user] =
      normalizedRole === "super_admin"
        ? await db
            .select()
            .from(users)
            .where(
              sql`${users.role}::text = ${normalizedRole} OR lower(${users.role}::text) in ('owner','head_admin','super_admin')`
            )
            .limit(1)
        : await db
            .select()
            .from(users)
            .where(sql`${users.role}::text = ${normalizedRole}`)
            .limit(1);
    return this.normalizeLegacyAdminUser(user);
  }

  async getUserByFacebookId(facebookId: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.facebookId, facebookId));
    return this.normalizeLegacyAdminUser(user);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    // Backward-compat: older callers treated username as email.
    const normalized = String(username || "")
      .trim()
      .toLowerCase();
    if (!normalized) return undefined;
    const [user] = await db
      .select()
      .from(users)
      .where(sql`lower(${users.email}) = ${normalized}`)
      .limit(1);
    return this.normalizeLegacyAdminUser(user);
  }

  async createUser(userData: InsertUser): Promise<User> {
    const normalizedEmail = userData?.email
      ? String(userData.email).trim().toLowerCase()
      : userData?.email;
    const values = normalizedEmail ? { ...userData, email: normalizedEmail } : userData;
    const [user] = await db.insert(users).values(values).returning();

    try {
      await ensureSuperAdminConnectionForUser(String(user.id));
    } catch (error) {
      console.error("[auth] Failed to ensure super admin auto-connection on user create", {
        userId: user.id,
        error,
      });
    }

    return user;
  }

  async updateUser(id: string, updates: Partial<User>): Promise<User> {
    const [user] = await db
      .update(users)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(users.id, id))
      .returning();
    return user;
  }

  async upsertUser(userData: UpsertUser): Promise<User> {
    const [user] = await db
      .insert(users)
      .values(userData)
      .onConflictDoUpdate({
        target: users.id,
        set: {
          ...userData,
          updatedAt: new Date(),
        },
      })
      .returning();
    return user;
  }

  async deleteUser(userId: string): Promise<void> {
    await db.delete(users).where(eq(users.id, userId));
  }

  async getAllUsers(): Promise<User[]> {
    return await db.select().from(users).orderBy(desc(users.createdAt));
  }

  async getUsersByIds(ids: string[]): Promise<User[]> {
    if (!ids.length) return [];
    const uniqueIds = Array.from(new Set(ids));
    const rows = await db.select().from(users).where(inArray(users.id, uniqueIds));
    return rows;
  }

  // Account security and management operations
  async getUserTrustedDevices(userId: string): Promise<TrustedDevice[]> {
    return this.userSecurityRepository.getUserTrustedDevices(userId);
  }

  async removeTrustedDevice(userId: string, deviceId: string): Promise<void> {
    await this.userSecurityRepository.removeTrustedDevice(userId, deviceId);
  }

  async getUserLoginHistory(_userId: string, _limit: number, _offset: number): Promise<any> {
    // Simple mock implementation - in a real app you'd track login sessions
    return [
      {
        id: "1",
        timestamp: new Date(),
        ipAddress: "192.168.1.1",
        userAgent: "Chrome on Windows",
        success: true,
        location: "United States",
      },
    ];
  }

  async exportUserData(userId: string): Promise<any> {
    const user = await this.getUser(userId);
    if (!user) throw new Error("User not found");

    // Export user data including related records
    const data = {
      user,
      profile: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        createdAt: user.createdAt,
        preferences: user.preferences,
      },
      exportDate: new Date().toISOString(),
      dataPolicy: "This export contains all personal data associated with your TradeScout account.",
    };

    return data;
  }

  async deactivateUser(userId: string): Promise<void> {
    // Note: isActive field not in users schema; consider adding or using verificationStatus
    await this.updateUser(userId, {
      updatedAt: new Date(),
    });
  }

  async updateUserPrivacySettings(userId: string, settings: any): Promise<any> {
    const user = await this.getUser(userId);
    if (!user) throw new Error("User not found");

    const currentPrefs = user.preferences || {};
    const updatedPreferences = {
      ...currentPrefs,
      privacy: {
        ...currentPrefs.privacy,
        ...settings,
      },
    };

    const updatedUser = await this.updateUser(userId, {
      preferences: updatedPreferences,
    });

    return updatedUser.preferences?.privacy;
  }

  async createMasterAdmin(
    email: string,
    password: string,
    firstName: string,
    lastName: string
  ): Promise<User> {
    const hashedPassword = await bcrypt.hash(password, 10);
    const [user] = await db
      .insert(users)
      .values({
        email,
        password: hashedPassword,
        firstName,
        lastName,
        role: "super_admin",
        emailVerified: true, // Master admin is pre-verified
        addressVerified: true,
        address: "Platform Administrator", // Default address for master admin
      })
      .returning();
    return user;
  }

  // Service area summary per contractor (used for reach tier classification)
  async getContractorServiceAreaCounts(contractorIds: string[]): Promise<Record<string, number>> {
    if (!contractorIds.length) {
      return {};
    }

    const rows = await db
      .select({
        contractorId: contractorCounties.contractorId,
        countyCount: sql<number>`count(distinct ${contractorCounties.countyId})::int`,
      })
      .from(contractorCounties)
      .where(inArray(contractorCounties.contractorId, contractorIds))
      .groupBy(contractorCounties.contractorId);

    const map: Record<string, number> = {};
    for (const row of rows) {
      map[row.contractorId] = row.countyCount ?? 0;
    }
    return map;
  }

  async getContractorBySlug(slug: string): Promise<Contractor | undefined> {
    const [contractor] = await db
      .select()
      .from(contractors)
      .where(and(eq(contractors.slug, slug), eq(contractors.isActive, true)));
    return contractor;
  }

  async getContractorById(id: string): Promise<Contractor | undefined> {
    const [contractor] = await db.select().from(contractors).where(eq(contractors.id, id));
    return contractor;
  }

  async getContractorByUserId(userId: string): Promise<Contractor | undefined> {
    const [contractor] = await db.select().from(contractors).where(eq(contractors.userId, userId));
    return contractor;
  }

  async getContractor(id: string): Promise<Contractor | undefined> {
    return this.getContractorById(id);
  }

  async createContractor(contractor: InsertContractor): Promise<Contractor> {
    const [newContractor] = await db.insert(contractors).values(contractor).returning();
    return newContractor;
  }

  async updateContractor(id: string, updates: Partial<InsertContractor>): Promise<Contractor> {
    const [updatedContractor] = await db
      .update(contractors)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(contractors.id, id))
      .returning();
    return updatedContractor;
  }

  // County operations
  async getCounties(
    stateCode?: string
  ): Promise<(County & { state?: { name: string; code: string } })[]> {
    const ttlMs = Number(process.env.COUNTIES_CACHE_TTL_MS || 60 * 60 * 1000);
    const cacheKey = stateCode ? `state:${stateCode}` : "all";
    const now = Date.now();
    const cached = this.countiesCache.get(cacheKey);
    if (cached && cached.expiresAt > now) {
      return cached.rows;
    }

    const query = db
      .select({
        id: counties.id,
        name: counties.name,
        fips: counties.fips,
        stateCode: counties.stateCode,
        population: counties.population,
        createdAt: counties.createdAt,
        updatedAt: counties.updatedAt,
        state: {
          name: states.name,
          code: states.code,
        },
      })
      .from(counties)
      .leftJoin(states, eq(counties.stateCode, states.code));

    const normalize = (rows: Array<any>) =>
      rows.map((row) => ({
        ...row,
        state: row?.state?.code ? row.state : undefined,
      }));

    if (stateCode) {
      const rows = await query.where(eq(counties.stateCode, stateCode)).orderBy(asc(counties.name));
      const normalized = normalize(rows);
      this.countiesCache.set(cacheKey, { expiresAt: now + ttlMs, rows: normalized });
      return normalized;
    }

    const rows = await query.orderBy(asc(counties.name));
    const normalized = normalize(rows);
    this.countiesCache.set(cacheKey, { expiresAt: now + ttlMs, rows: normalized });
    return normalized;
  }

  async getCountyById(id: string): Promise<County | undefined> {
    const [county] = await db.select().from(counties).where(eq(counties.id, id));
    return county;
  }

  async getCountyByFips(fips: string): Promise<County | undefined> {
    const [county] = await db.select().from(counties).where(eq(counties.fips, fips));
    return county;
  }

  async findCountyByNameOrFips(params: {
    query: string;
    stateCode?: string;
  }): Promise<County | undefined> {
    const raw = String(params.query || "").trim();
    if (!raw) {
      return undefined;
    }

    // Prefer FIPS if it looks like one.
    if (/^\d{5}$/.test(raw)) {
      return await this.getCountyByFips(raw);
    }

    const escapeLike = (value: string) => value.replace(/[\\%_]/g, "\\$&");
    const exact = raw.toLowerCase();

    const base = db.select().from(counties);
    const statePredicate = params.stateCode ? eq(counties.stateCode, params.stateCode) : undefined;

    // Exact (case-insensitive) match first.
    const [exactMatch] = await base
      .where(and(statePredicate, sql`lower(${counties.name}) = ${exact}`))
      .limit(1);
    if (exactMatch) {
      return exactMatch;
    }

    const pattern = `%${escapeLike(raw)}%`;
    const [partialMatch] = await base
      .where(and(statePredicate, ilike(counties.name, pattern)))
      .orderBy(asc(counties.name))
      .limit(1);

    return partialMatch;
  }

  async upsertCounty(county: InsertCounty): Promise<County> {
    const [upsertedCounty] = await db
      .insert(counties)
      .values(county)
      .onConflictDoUpdate({
        target: counties.fips,
        set: { ...county, updatedAt: new Date() },
      })
      .returning();
    return upsertedCounty;
  }

  // Trade operations
  async getTrades(parentId?: string): Promise<Trade[]> {
    if (parentId) {
      return await db
        .select()
        .from(trades)
        .where(eq(trades.parentId, parentId))
        .orderBy(asc(trades.name));
    }

    return await db
      .select()
      .from(trades)
      .where(sql`${trades.parentId} IS NULL`)
      .orderBy(asc(trades.name));
  }

  async getTradeBySlug(slug: string): Promise<Trade | undefined> {
    const [trade] = await db.select().from(trades).where(eq(trades.slug, slug));
    return trade;
  }

  async createTrade(trade: InsertTrade): Promise<Trade> {
    const [newTrade] = await db.insert(trades).values(trade).returning();
    return newTrade;
  }

  async upsertProviderDeclarationForUser(params: {
    userId: string;
    tradeIds: string[];
    serviceAreas: { countyFips: string }[];
    availabilityFlags?: {
      emergency?: boolean;
      weekends?: boolean;
      evenings?: boolean;
    };
  }): Promise<ProviderDeclaration> {
    const { userId, tradeIds, serviceAreas, availabilityFlags } = params;

    const [existing] = await db
      .select()
      .from(providerDeclarations)
      .where(eq(providerDeclarations.providerUserId, userId));

    if (existing) {
      const [updated] = await db
        .update(providerDeclarations)
        .set({
          tradeIds,
          serviceAreas,
          availabilityFlags,
          updatedAt: new Date(),
        })
        .where(eq(providerDeclarations.id, existing.id))
        .returning();
      return updated;
    }

    const [inserted] = await db
      .insert(providerDeclarations)
      .values({
        providerUserId: userId,
        tradeIds,
        serviceAreas,
        availabilityFlags,
      })
      .returning();

    return inserted;
  }

  async getProviderDeclarationForUser(userId: string): Promise<ProviderDeclaration | undefined> {
    const [existing] = await db
      .select()
      .from(providerDeclarations)
      .where(eq(providerDeclarations.providerUserId, userId));
    return existing;
  }

  async getProviderEligibilitiesForUser(userId: string): Promise<ProviderEligibility[]> {
    return db
      .select()
      .from(providerEligibilities)
      .where(eq(providerEligibilities.providerUserId, userId));
  }

  async replaceProviderEligibilitiesForUser(
    userId: string,
    eligibilities: Array<
      Omit<
        InsertProviderEligibility,
        "id" | "providerUserId" | "createdAt" | "updatedAt" | "verifiedAt"
      >
    >
  ): Promise<ProviderEligibility[]> {
    await db.delete(providerEligibilities).where(eq(providerEligibilities.providerUserId, userId));

    if (!eligibilities.length) {
      return [];
    }

    return db
      .insert(providerEligibilities)
      .values(
        eligibilities.map((eligibility) => ({
          ...eligibility,
          providerUserId: userId,
          verifiedAt: new Date(),
          updatedAt: new Date(),
        }))
      )
      .returning();
  }

  async getProviderLocalStatsForUserInCounty(
    userId: string,
    countyFips: string
  ): Promise<ProviderLocalStat | undefined> {
    const [row] = await db
      .select()
      .from(providerLocalStats)
      .where(
        and(
          eq(providerLocalStats.providerUserId, userId),
          eq(providerLocalStats.countyFips, countyFips)
        )
      );
    return row;
  }

  // Recommendation operations
  async getRecommendations(contractorId: string): Promise<Recommendation[]> {
    return db
      .select()
      .from(recommendations)
      .where(eq(recommendations.contractorId, contractorId))
      .orderBy(desc(recommendations.createdAt));
  }

  async createBasicRecommendation(recommendation: InsertRecommendation): Promise<Recommendation> {
    const [newRecommendation] = await db.insert(recommendations).values(recommendation).returning();
    return newRecommendation;
  }

  async getContractorRatings(contractorId: string): Promise<{ count: number; average: number }> {
    const [result] = await db
      .select({
        count: sql<number>`count(*)`,
        average: sql<number>`avg(5.0)`, // Default to 5.0 since recommendations don't have ratings
      })
      .from(recommendations)
      .where(eq(recommendations.contractorId, contractorId));

    return {
      count: result?.count || 0,
      average: result?.average || 0,
    };
  }

  // Lead operations
  async createLead(lead: InsertLead): Promise<Lead> {
    const [newLead] = await db.insert(leads).values(lead).returning();
    return newLead;
  }

  async getLeadById(id: string): Promise<Lead | null> {
    const [lead] = await db.select().from(leads).where(eq(leads.id, id));
    return lead ?? null;
  }

  async getLeads(contractorId?: string, status?: string): Promise<Lead[]> {
    const conditions: SQL[] = [];
    if (contractorId) {
      conditions.push(eq(leads.contractorId, contractorId));
    }
    if (status) {
      conditions.push(eq(leads.status, status));
    }

    const baseQuery = db.select().from(leads);

    if (conditions.length > 0) {
      return await baseQuery.where(and(...conditions)).orderBy(desc(leads.createdAt));
    }

    return await baseQuery.orderBy(desc(leads.createdAt));
  }

  async updateLeadStatus(id: string, status: string): Promise<Lead> {
    const [updatedLead] = await db
      .update(leads)
      .set({ status, updatedAt: new Date() })
      .where(eq(leads.id, id))
      .returning();
    return updatedLead;
  }

  async assignLeadToContractors(leadId: string, contractorIds: string[]): Promise<void> {
    const assignments = contractorIds.map((contractorId) => ({
      leadId,
      contractorId,
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
    }));

    await db.insert(leadAssignments).values(assignments);
  }

  // Growth Pack operations
  async createGrowthPackDownload(download: InsertGrowthPackDownload): Promise<GrowthPackDownload> {
    const [newDownload] = await db.insert(growthPackDownloads).values(download).returning();
    return newDownload;
  }

  async getGrowthPackDownload(token: string): Promise<GrowthPackDownload | undefined> {
    const [download] = await db
      .select()
      .from(growthPackDownloads)
      .where(eq(growthPackDownloads.downloadToken, token));
    return download;
  }

  // Accelerator operations
  async createAcceleratorMembership(
    membership: InsertAcceleratorMembership
  ): Promise<AcceleratorMembership> {
    const [newMembership] = await db.insert(acceleratorMemberships).values(membership).returning();
    return newMembership;
  }

  async getAcceleratorMembership(contractorId: string): Promise<AcceleratorMembership | undefined> {
    const [membership] = await db
      .select()
      .from(acceleratorMemberships)
      .where(eq(acceleratorMemberships.contractorId, contractorId));
    return membership;
  }

  // Pricing operations
  async getPricingData(service: string, fips?: string): Promise<PricingData[]> {
    if (fips) {
      return await db
        .select()
        .from(pricingData)
        .where(and(eq(pricingData.service, service), eq(pricingData.fips, fips)));
    }

    return await db.select().from(pricingData).where(eq(pricingData.service, service));
  }

  async upsertPricingData(data: InsertPricingData): Promise<PricingData> {
    const [upsertedData] = await db
      .insert(pricingData)
      .values(data)
      .onConflictDoUpdate({
        target: [pricingData.service, pricingData.fips, pricingData.serviceCode],
        set: { ...data, updatedAt: new Date() },
      })
      .returning();
    return upsertedData;
  }

  // Analytics operations
  async logEvent(eventType: string, data: any): Promise<void> {
    const [inserted] = await db
      .insert(events)
      .values({
        eventType,
        data,
        ipAddress: data.ipAddress,
        userAgent: data.userAgent,
        userId: data.userId,
        contractorId: data.contractorId,
      })
      .returning();

    // Best-effort XP and badge processing; never block core event logging.
    try {
      const { processXpForEvent } = await import("./xp/xpEngine");
      const { evaluateBadgesForEvent } = await import("./badges/badgeEngine");

      const loggedEvent: any = {
        id: inserted.id,
        eventType: inserted.eventType,
        createdAt: inserted.createdAt ?? new Date(),
        data: inserted.data,
      };

      await processXpForEvent({ pool: neonPool }, loggedEvent);
      await evaluateBadgesForEvent({ pool: neonPool }, loggedEvent);
    } catch (err) {
      console.error("XP/Badge processing failed for event", eventType, err);
    }
  }

  async getEventStats(eventType: string, dateRange?: { from: Date; to: Date }): Promise<number> {
    const baseQuery = db.select({ count: sql<number>`count(*)` }).from(events);

    if (dateRange) {
      const [result] = await baseQuery.where(
        and(
          eq(events.eventType, eventType),
          gt(events.createdAt, dateRange.from),
          sql`${events.createdAt} < ${dateRange.to}`
        )
      );
      return result?.count || 0;
    }

    const [result] = await baseQuery.where(eq(events.eventType, eventType));
    return result?.count || 0;
  }

  async getScoutDraftAnalyticsSummary(
    fromDate: Date,
    toDate: Date
  ): Promise<{
    from: string;
    to: string;
    artifacts: Array<{
      draftKind: "promo" | "community";
      created: number;
      viewed: number;
      published: number;
      medianTimeToPublishMs: number | null;
      topCountiesByPublishRate: Array<{
        stateCode: string | null;
        countyFips: string | null;
        created: number;
        published: number;
        publishRate: number;
      }>;
    }>;
  }> {
    const from = new Date(fromDate);
    const to = new Date(toDate);

    const rowsResult = await neonPool.query(
      `
      SELECT
        event_type,
        (data->>'draftKind') AS draft_kind,
        (data->>'timeToPublishMs') AS time_to_publish_ms,
        (data->>'stateCode') AS state_code,
        (data->>'countyFips') AS county_fips
      FROM events
      WHERE event_type IN ('scout_draft_created','scout_draft_viewed','scout_draft_published')
        AND created_at >= $1
        AND created_at < $2
      `,
      [from, to]
    );

    type DraftKind = "promo" | "community";

    type ArtifactAccumulator = {
      draftKind: DraftKind;
      created: number;
      viewed: number;
      published: number;
      publishDurations: number[];
      counties: Map<
        string,
        { stateCode: string | null; countyFips: string | null; created: number; published: number }
      >;
    };

    const artifactKinds: DraftKind[] = ["promo", "community"];
    const byKind = new Map<DraftKind, ArtifactAccumulator>();

    for (const kind of artifactKinds) {
      byKind.set(kind, {
        draftKind: kind,
        created: 0,
        viewed: 0,
        published: 0,
        publishDurations: [],
        counties: new Map(),
      });
    }

    const rows: any[] = rowsResult.rows || [];

    for (const row of rows) {
      const eventType: string = String(row.event_type || "");
      const draftKindRaw = row.draft_kind;
      const draftKind: DraftKind | null =
        draftKindRaw === "promo" || draftKindRaw === "community" ? draftKindRaw : null;
      if (!draftKind) continue;

      const acc = byKind.get(draftKind);
      if (!acc) continue;

      const stateCode = row.state_code != null ? String(row.state_code) : null;
      const countyFips = row.county_fips != null ? String(row.county_fips) : null;
      const hasCounty = !!stateCode && !!countyFips;

      if (eventType === "scout_draft_created") {
        acc.created += 1;
        if (hasCounty) {
          const key = `${stateCode}:${countyFips}`;
          const existing = acc.counties.get(key) ?? {
            stateCode,
            countyFips,
            created: 0,
            published: 0,
          };
          existing.created += 1;
          acc.counties.set(key, existing);
        }
      } else if (eventType === "scout_draft_viewed") {
        acc.viewed += 1;
      } else if (eventType === "scout_draft_published") {
        acc.published += 1;

        const rawDuration = row.time_to_publish_ms;
        if (rawDuration != null) {
          const n = typeof rawDuration === "number" ? rawDuration : Number(rawDuration);
          if (Number.isFinite(n) && n >= 0) {
            acc.publishDurations.push(n);
          }
        }

        if (hasCounty) {
          const key = `${stateCode}:${countyFips}`;
          const existing = acc.counties.get(key) ?? {
            stateCode,
            countyFips,
            created: 0,
            published: 0,
          };
          existing.published += 1;
          acc.counties.set(key, existing);
        }
      }
    }

    const computeMedian = (values: number[]): number | null => {
      if (!values.length) return null;
      const sorted = [...values].sort((a, b) => a - b);
      const mid = Math.floor(sorted.length / 2);
      if (sorted.length % 2 === 0) {
        return (sorted[mid - 1] + sorted[mid]) / 2;
      }
      return sorted[mid];
    };

    const artifacts = artifactKinds.map((kind) => {
      const acc = byKind.get(kind);
      if (!acc) {
        throw new Error(`Missing draft accumulator for kind: ${kind}`);
      }
      const median = computeMedian(acc.publishDurations);

      const countyArray = Array.from(acc.counties.values())
        .filter((c) => c.created > 0 && c.published > 0)
        .map((c) => ({
          stateCode: c.stateCode,
          countyFips: c.countyFips,
          created: c.created,
          published: c.published,
          publishRate: c.created > 0 ? c.published / c.created : 0,
        }))
        .sort((a, b) => {
          if (b.publishRate !== a.publishRate) {
            return b.publishRate - a.publishRate;
          }
          return b.published - a.published;
        })
        .slice(0, 5);

      return {
        draftKind: acc.draftKind,
        created: acc.created,
        viewed: acc.viewed,
        published: acc.published,
        medianTimeToPublishMs: median,
        topCountiesByPublishRate: countyArray,
      };
    });

    return {
      from: from.toISOString(),
      to: to.toISOString(),
      artifacts,
    };
  }

  async getOutcomeAnalyticsSummary(
    fromDate: Date,
    toDate: Date
  ): Promise<{
    from: string;
    to: string;
    byActionType: Array<{
      actionType: "community_notice" | "provider_coordination" | "promotion";
      initiated: number;
      success: number;
      pending: number;
      failed: number;
      medianTimeToOutcomeMs: number | null;
      topCountiesByConfirmationRate: Array<{
        stateCode: string | null;
        countyFips: string | null;
        initiated: number;
        confirmed: number;
        confirmationRate: number;
      }>;
    }>;
  }> {
    const from = new Date(fromDate);
    const to = new Date(toDate);

    const rowsResult = await neonPool.query(
      `
      SELECT
        (data->>'actionType') AS action_type,
        (data->>'result') AS result,
        (data->>'timeToOutcomeMs') AS time_to_outcome_ms,
        (data->>'stateCode') AS state_code,
        (data->>'countyFips') AS county_fips
      FROM events
      WHERE event_type = 'local_action_outcome'
        AND created_at >= $1
        AND created_at < $2
      `,
      [from, to]
    );

    type ActionType = "community_notice" | "provider_coordination" | "promotion";
    type OutcomeResult = "success" | "pending" | "failed";

    type OutcomeAccumulator = {
      actionType: ActionType;
      initiated: number;
      success: number;
      pending: number;
      failed: number;
      outcomeDurations: number[];
      counties: Map<
        string,
        {
          stateCode: string | null;
          countyFips: string | null;
          initiated: number;
          confirmed: number;
        }
      >;
    };

    const actionTypes: ActionType[] = ["community_notice", "provider_coordination", "promotion"];
    const byType = new Map<ActionType, OutcomeAccumulator>();

    for (const type of actionTypes) {
      byType.set(type, {
        actionType: type,
        initiated: 0,
        success: 0,
        pending: 0,
        failed: 0,
        outcomeDurations: [],
        counties: new Map(),
      });
    }

    const rows: any[] = rowsResult.rows || [];

    for (const row of rows) {
      const rawType = row.action_type;
      const actionType: ActionType | null =
        rawType === "community_notice" ||
        rawType === "provider_coordination" ||
        rawType === "promotion"
          ? rawType
          : null;
      if (!actionType) continue;

      const acc = byType.get(actionType);
      if (!acc) continue;

      const rawResult = row.result;
      const result: OutcomeResult | null =
        rawResult === "success" || rawResult === "pending" || rawResult === "failed"
          ? rawResult
          : null;
      if (!result) continue;

      acc.initiated += 1;
      acc[result] += 1;

      const stateCode = row.state_code != null ? String(row.state_code) : null;
      const countyFips = row.county_fips != null ? String(row.county_fips) : null;
      const hasCounty = !!stateCode && !!countyFips;

      if (result === "success") {
        const rawDuration = row.time_to_outcome_ms;
        if (rawDuration != null) {
          const n = typeof rawDuration === "number" ? rawDuration : Number(rawDuration);
          if (Number.isFinite(n) && n >= 0) {
            acc.outcomeDurations.push(n);
          }
        }
      }

      if (hasCounty) {
        const key = `${stateCode}:${countyFips}`;
        const existing = acc.counties.get(key) ?? {
          stateCode,
          countyFips,
          initiated: 0,
          confirmed: 0,
        };
        existing.initiated += 1;
        if (result === "success") {
          existing.confirmed += 1;
        }
        acc.counties.set(key, existing);
      }
    }

    const computeMedian = (values: number[]): number | null => {
      if (!values.length) return null;
      const sorted = [...values].sort((a, b) => a - b);
      const mid = Math.floor(sorted.length / 2);
      if (sorted.length % 2 === 0) {
        return (sorted[mid - 1] + sorted[mid]) / 2;
      }
      return sorted[mid];
    };

    const byActionType = actionTypes.map((type) => {
      const acc = byType.get(type);
      if (!acc) {
        throw new Error(`Missing action accumulator for type: ${type}`);
      }
      const median = computeMedian(acc.outcomeDurations);

      const countyArray = Array.from(acc.counties.values())
        .filter((c) => c.initiated > 0 && c.confirmed > 0)
        .map((c) => ({
          stateCode: c.stateCode,
          countyFips: c.countyFips,
          initiated: c.initiated,
          confirmed: c.confirmed,
          confirmationRate: c.initiated > 0 ? c.confirmed / c.initiated : 0,
        }))
        .sort((a, b) => {
          if (b.confirmationRate !== a.confirmationRate) {
            return b.confirmationRate - a.confirmationRate;
          }
          return b.confirmed - a.confirmed;
        })
        .slice(0, 5);

      return {
        actionType: acc.actionType,
        initiated: acc.initiated,
        success: acc.success,
        pending: acc.pending,
        failed: acc.failed,
        medianTimeToOutcomeMs: median,
        topCountiesByConfirmationRate: countyArray,
      };
    });

    return {
      from: from.toISOString(),
      to: to.toISOString(),
      byActionType,
    };
  }

  async getUserCredibilityStats(userId: string): Promise<{
    jobsCompleted: number;
    peopleHelped: number;
    activeWeeks: number;
  }> {
    if (!userId) {
      return { jobsCompleted: 0, peopleHelped: 0, activeWeeks: 0 };
    }

    const [jobsRes, helpedRes, weeksRes] = await Promise.all([
      neonPool.query(
        `
        SELECT COUNT(*) AS c
        FROM events
        WHERE (data->>'userId')::text = $1
          AND event_type = 'job.completed';
        `,
        [userId]
      ),
      neonPool.query(
        `
        SELECT COUNT(DISTINCT (data->>'targetUserId')) AS c
        FROM events
        WHERE (data->>'userId')::text = $1
          AND event_type IN ('reaction.marked_helpful','user.thanked')
          AND COALESCE(data->>'targetUserId','') <> '';
        `,
        [userId]
      ),
      neonPool.query(
        `
        SELECT COUNT(DISTINCT date_trunc('week', created_at)) AS weeks
        FROM events
        WHERE (data->>'userId')::text = $1
          AND event_type IN ('user.session_started','community.viewed_scope')
          AND created_at >= now() - INTERVAL '365 days';
        `,
        [userId]
      ),
    ]);

    const jobsCompleted = Number(jobsRes.rows?.[0]?.c ?? 0) || 0;
    const peopleHelped = Number(helpedRes.rows?.[0]?.c ?? 0) || 0;
    const activeWeeks = Number(weeksRes.rows?.[0]?.weeks ?? 0) || 0;

    return { jobsCompleted, peopleHelped, activeWeeks };
  }

  async getTradeRequirementsByTradeId(tradeId: string): Promise<TradeRequirement | undefined> {
    const [row] = await db
      .select()
      .from(tradeRequirements)
      .where(eq(tradeRequirements.tradeId, tradeId));
    return row;
  }

  async getUserVerificationSummary(userIds: string[]): Promise<
    Record<
      string,
      {
        hasLicense: boolean;
        hasInsurance: boolean;
        hasEin: boolean;
      }
    >
  > {
    const summary: Record<string, { hasLicense: boolean; hasInsurance: boolean; hasEin: boolean }> =
      {};

    if (!userIds.length) {
      return summary;
    }

    const now = new Date();
    const rows: BusinessVerification[] = await db
      .select()
      .from(businessVerifications)
      .where(
        and(
          inArray(businessVerifications.providerUserId, userIds),
          eq(businessVerifications.status, "approved")
        )
      );

    for (const userId of userIds) {
      summary[userId] = { hasLicense: false, hasInsurance: false, hasEin: false };
    }

    for (const row of rows) {
      if (row.expiresAt && row.expiresAt <= now) continue;
      const existing = summary[row.providerUserId] ?? {
        hasLicense: false,
        hasInsurance: false,
        hasEin: false,
      };
      if (row.verificationType === "license") existing.hasLicense = true;
      if (row.verificationType === "insurance") existing.hasInsurance = true;
      if (row.verificationType === "ein") existing.hasEin = true;
      summary[row.providerUserId] = existing;
    }

    return summary;
  }

  // XP & badges read helpers (debug + user-facing)
  async getUserXpTotal(userId: string): Promise<number> {
    const res = await neonPool.query(`SELECT xp_total FROM user_xp WHERE user_id = $1`, [userId]);
    const raw = res.rows?.[0]?.xp_total;
    const n = typeof raw === "number" ? raw : raw != null ? Number(raw) : 0;
    return Number.isFinite(n) ? n : 0;
  }

  async getUserXpLedger(
    userId: string,
    limit = 50
  ): Promise<
    Array<{
      id: string;
      delta: number;
      reason: string;
      dayKeyUtc: string;
      createdAt: string;
    }>
  > {
    const safeLimit = Math.max(1, Math.min(200, limit));
    const res = await neonPool.query(
      `
      SELECT id, delta, reason, day_key_utc, created_at
      FROM xp_ledger
      WHERE user_id = $1
      ORDER BY created_at DESC
      LIMIT $2
      `,
      [userId, safeLimit]
    );
    return (res.rows || []).map((row: any) => ({
      id: String(row.id),
      delta: Number(row.delta) || 0,
      reason: String(row.reason || ""),
      dayKeyUtc: String(row.day_key_utc || ""),
      createdAt: new Date(row.created_at).toISOString(),
    }));
  }

  async getUserAwardedBadges(
    userId: string
  ): Promise<Array<{ badgeId: string; awardedAt: string; source: string }>> {
    const res = await neonPool.query(
      `
      SELECT badge_id, awarded_at, source
      FROM user_badges
      WHERE user_id = $1
      ORDER BY awarded_at DESC
      `,
      [userId]
    );
    return (res.rows || []).map((row: any) => ({
      badgeId: String(row.badge_id),
      awardedAt: new Date(row.awarded_at).toISOString(),
      source: String(row.source || "engine"),
    }));
  }

  // Chat system implementations
  // Conversations
  async createConversation(conversationData: InsertConversation): Promise<Conversation> {
    const [conversation] = await db.insert(conversations).values(conversationData).returning();
    return conversation;
  }

  async getConversation(id: string): Promise<Conversation | undefined> {
    const [conversation] = await db.select().from(conversations).where(eq(conversations.id, id));
    return conversation;
  }

  async getConversationsByUser(
    userId: string,
    userType: "homeowner" | "contractor"
  ): Promise<Conversation[]> {
    const userField =
      userType === "homeowner" ? conversations.homeownerId : conversations.contractorId;
    return await db
      .select()
      .from(conversations)
      .where(eq(userField, userId))
      .orderBy(desc(conversations.lastMessageAt));
  }

  async updateConversation(id: string, updates: Partial<Conversation>): Promise<Conversation> {
    const [conversation] = await db
      .update(conversations)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(conversations.id, id))
      .returning();
    return conversation;
  }

  async rateConversation(
    id: string,
    rating: number,
    feedback: string,
    raterType: "homeowner" | "contractor"
  ): Promise<Conversation> {
    const updateData =
      raterType === "homeowner"
        ? { homeownerRating: rating, homeownerFeedback: feedback }
        : { contractorRating: rating, contractorFeedback: feedback };

    const [conversation] = await db
      .update(conversations)
      .set({ ...updateData, updatedAt: new Date() })
      .where(eq(conversations.id, id))
      .returning();
    return conversation;
  }

  // Messages
  async createMessage(messageData: InsertMessage): Promise<Message> {
    const [message] = await db.insert(messages).values(messageData).returning();

    // Update conversation last message timestamp
    await db
      .update(conversations)
      .set({ lastMessageAt: new Date() })
      .where(eq(conversations.id, messageData.conversationId));

    return message;
  }

  async getMessagesByConversation(conversationId: string): Promise<Message[]> {
    return await db
      .select()
      .from(messages)
      .where(eq(messages.conversationId, conversationId))
      .orderBy(asc(messages.createdAt));
  }

  async getThreadsForUser(
    userId: string,
    options: { limit: number; offset: number }
  ): Promise<
    {
      id: string;
      subject: string | null;
      lastMessageSnippet: string | null;
      lastMessageAt: Date | null;
      unreadCount: number;
      participantCount: number;
    }[]
  > {
    const { limit, offset } = options;

    const convoRows = await db
      .select()
      .from(conversations)
      .where(
        sql`${conversations.homeownerId} = ${userId} OR ${conversations.contractorId} = ${userId}`
      )
      .orderBy(desc(conversations.lastMessageAt))
      .limit(limit)
      .offset(offset);

    if (convoRows.length === 0) {
      return [];
    }

    const convoIds = convoRows.map((c) => c.id);

    const convoMessages = await db
      .select()
      .from(messages)
      .where(inArray(messages.conversationId, convoIds));

    return convoRows.map((conv) => {
      const convMsgs = convoMessages.filter((m) => m.conversationId === conv.id);

      let lastMessage: Message | undefined;
      for (const msg of convMsgs) {
        // Prefer the chronologically latest message; if timestamps are equal,
        // fall back to the last one in iteration order to match user expectations.
        if (!lastMessage) {
          lastMessage = msg;
        } else if (
          msg.createdAt &&
          lastMessage.createdAt &&
          msg.createdAt >= lastMessage.createdAt
        ) {
          lastMessage = msg;
        }
      }

      const lastMessageSnippet = lastMessage ? (lastMessage.content ?? "").slice(0, 160) : null;

      const unreadCount = convMsgs.filter((m) => m.senderId !== userId && !m.readAt).length;

      return {
        id: conv.id,
        subject: null,
        lastMessageSnippet,
        lastMessageAt: (conv.lastMessageAt as any) ?? null,
        unreadCount,
        participantCount: 2,
      };
    });
  }

  async markMessageAsRead(messageId: string): Promise<Message> {
    const [message] = await db
      .update(messages)
      .set({ readAt: new Date() })
      .where(eq(messages.id, messageId))
      .returning();
    return message;
  }

  // Quotes
  async createQuote(quoteData: InsertQuote): Promise<Quote> {
    const [quote] = await db.insert(quotes).values(quoteData).returning();
    return quote;
  }

  async getQuote(id: string): Promise<Quote | undefined> {
    const [quote] = await db.select().from(quotes).where(eq(quotes.id, id));
    return quote;
  }

  async getQuotesByConversation(conversationId: string): Promise<Quote[]> {
    return await db
      .select()
      .from(quotes)
      .where(eq(quotes.conversationId, conversationId))
      .orderBy(desc(quotes.createdAt));
  }

  async updateQuote(id: string, updates: Partial<Quote>): Promise<Quote> {
    const [quote] = await db
      .update(quotes)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(quotes.id, id))
      .returning();
    return quote;
  }

  // Schedules
  async createSchedule(scheduleData: InsertSchedule): Promise<Schedule> {
    const [schedule] = await db.insert(schedules).values(scheduleData).returning();
    return schedule;
  }

  async getSchedule(id: string): Promise<Schedule | undefined> {
    const [schedule] = await db.select().from(schedules).where(eq(schedules.id, id));
    return schedule;
  }

  async getSchedulesByConversation(conversationId: string): Promise<Schedule[]> {
    return await db
      .select()
      .from(schedules)
      .where(eq(schedules.conversationId, conversationId))
      .orderBy(desc(schedules.createdAt));
  }

  async updateSchedule(id: string, updates: Partial<Schedule>): Promise<Schedule> {
    const [schedule] = await db
      .update(schedules)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(schedules.id, id))
      .returning();
    return schedule;
  }

  // Material Lists
  async createMaterialList(materialListData: InsertMaterialList): Promise<MaterialList> {
    const [materialList] = await db.insert(materialLists).values(materialListData).returning();
    return materialList;
  }

  async getMaterialList(id: string): Promise<MaterialList | undefined> {
    const [materialList] = await db.select().from(materialLists).where(eq(materialLists.id, id));
    return materialList;
  }

  async getMaterialListsByConversation(conversationId: string): Promise<MaterialList[]> {
    return await db
      .select()
      .from(materialLists)
      .where(eq(materialLists.conversationId, conversationId))
      .orderBy(desc(materialLists.createdAt));
  }

  async updateMaterialList(id: string, updates: Partial<MaterialList>): Promise<MaterialList> {
    const [materialList] = await db
      .update(materialLists)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(materialLists.id, id))
      .returning();
    return materialList;
  }

  // Update material list item status (approve/deny suggestions)
  async updateMaterialListItemStatus(
    materialListId: string,
    itemId: string,
    status: "approved" | "denied",
    denialReason?: string
  ): Promise<MaterialList> {
    const [existingList] = await db
      .select()
      .from(materialLists)
      .where(eq(materialLists.id, materialListId));
    if (!existingList) {
      throw new Error("Material list not found");
    }

    const items = existingList.items as any[];
    const updatedItems = items.map((item) => {
      if (item.id === itemId) {
        return {
          ...item,
          status,
          denialReason: status === "denied" ? denialReason : undefined,
        };
      }
      return item;
    });

    const [updatedList] = await db
      .update(materialLists)
      .set({
        items: updatedItems,
        updatedAt: new Date(),
      })
      .where(eq(materialLists.id, materialListId))
      .returning();

    return updatedList;
  }

  // Add item suggestion to material list
  async addMaterialListItemSuggestion(
    materialListId: string,
    suggestion: {
      id: string;
      name: string;
      quantity: number;
      estimatedCost: number;
      vendor?: string;
      sku?: string;
      suggestedBy: "homeowner" | "contractor";
      notes?: string;
    }
  ): Promise<MaterialList> {
    const [existingList] = await db
      .select()
      .from(materialLists)
      .where(eq(materialLists.id, materialListId));
    if (!existingList) {
      throw new Error("Material list not found");
    }

    const items = existingList.items as any[];
    const newItem = {
      ...suggestion,
      status: "pending" as const,
    };

    const updatedItems = [...items, newItem];

    const [updatedList] = await db
      .update(materialLists)
      .set({
        items: updatedItems,
        updatedAt: new Date(),
      })
      .where(eq(materialLists.id, materialListId))
      .returning();

    return updatedList;
  }

  // Admin configuration operations
  async getSiteSettings(category?: string): Promise<SiteSetting[]> {
    if (category) {
      return await db.select().from(siteSettings).where(eq(siteSettings.category, category));
    }
    return await db.select().from(siteSettings).orderBy(siteSettings.category, siteSettings.key);
  }

  async updateSiteSetting(id: string, updates: Partial<InsertSiteSetting>): Promise<SiteSetting> {
    const [setting] = await db
      .update(siteSettings)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(siteSettings.id, id))
      .returning();
    return setting;
  }

  async createSiteSetting(setting: InsertSiteSetting): Promise<SiteSetting> {
    const [newSetting] = await db.insert(siteSettings).values(setting).returning();
    return newSetting;
  }

  async deleteSiteSetting(id: string): Promise<void> {
    await db.delete(siteSettings).where(eq(siteSettings.id, id));
  }

  async getPrizeConfigurations(): Promise<PrizeConfiguration[]> {
    return await db.select().from(prizeConfigurations).orderBy(desc(prizeConfigurations.createdAt));
  }

  async updatePrizeConfiguration(
    id: string,
    updates: Partial<InsertPrizeConfiguration>
  ): Promise<PrizeConfiguration> {
    const [prize] = await db
      .update(prizeConfigurations)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(prizeConfigurations.id, id))
      .returning();
    return prize;
  }

  async createPrizeConfiguration(prize: InsertPrizeConfiguration): Promise<PrizeConfiguration> {
    const [newPrize] = await db.insert(prizeConfigurations).values(prize).returning();
    return newPrize;
  }

  async deletePrizeConfiguration(id: string): Promise<void> {
    await db.delete(prizeConfigurations).where(eq(prizeConfigurations.id, id));
  }

  async getAdvertisements(placement?: string): Promise<Advertisement[]> {
    if (placement) {
      return await db.select().from(advertisements).where(eq(advertisements.placement, placement));
    }
    return await db.select().from(advertisements).orderBy(desc(advertisements.createdAt));
  }

  async updateAdvertisement(
    id: string,
    updates: Partial<InsertAdvertisement>
  ): Promise<Advertisement> {
    const [ad] = await db
      .update(advertisements)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(advertisements.id, id))
      .returning();
    return ad;
  }

  async createAdvertisement(ad: InsertAdvertisement): Promise<Advertisement> {
    const [newAd] = await db.insert(advertisements).values(ad).returning();
    return newAd;
  }

  async deleteAdvertisement(id: string): Promise<void> {
    await db.delete(advertisements).where(eq(advertisements.id, id));
  }

  async normalizeAdLinkForUser(params: {
    linkUrl?: string | null;
    isAffiliate?: boolean | null;
    userId?: string | null;
  }): Promise<string | null> {
    const { linkUrl, isAffiliate, userId } = params;

    if (!linkUrl) return null;
    if (!isAffiliate) return linkUrl;
    if (!userId) return linkUrl;

    try {
      let program = await this.getAffiliateProgram(userId);
      if (!program) {
        program = await this.createAffiliateProgram({ userId });
      }

      const referralCode: unknown = (program as any).referralCode;
      const code =
        typeof referralCode === "string" && referralCode.length > 0 ? referralCode : null;
      if (!code) return linkUrl;

      const baseOrigin =
        process.env.PUBLIC_WEB_URL || process.env.APP_URL || "https://www.thetradescout.com";

      try {
        const url = new URL(linkUrl, baseOrigin);
        if (!url.searchParams.has("ref")) {
          url.searchParams.set("ref", code);
        }
        return url.toString();
      } catch {
        return linkUrl;
      }
    } catch {
      return linkUrl;
    }
  }

  async trackAdEvent(params: {
    adId: string;
    eventType: "impression" | "click";
    source?: string | null;
    userId?: string | null;
  }): Promise<void> {
    const { adId, eventType, source, userId } = params;
    if (!adId || !eventType) return;

    const safeSource = typeof source === "string" && source.length > 0 ? source : "unknown";

    try {
      await db.insert(adEvents).values({
        adId,
        eventType,
        source: safeSource,
        userId: userId || null,
      } as InsertAdEvent);
    } catch (error) {
      console.error("Failed to track ad event", { adId, eventType, safeSource, error });
    }
  }

  /**
   * Recompute Community Value Score (CVS) for ads.
   * Uses a rolling window (default 30 days) over adEvents and adFeedback.
   */
  async recomputeAdCommunityScores(params?: { sinceDays?: number }): Promise<void> {
    const sinceDays =
      typeof params?.sinceDays === "number" && params.sinceDays > 0 ? params.sinceDays : 30;
    const sinceDate = new Date(Date.now() - sinceDays * 24 * 60 * 60 * 1000);

    // Load all active ads
    const allAds = await db.select().from(advertisements).where(eq(advertisements.isActive, true));
    if (!allAds.length) return;

    // Load recent events and feedback for these ads
    const adIds = allAds.map((a: any) => a.id);

    const recentEvents = await db
      .select()
      .from(adEvents)
      .where(and(inArray(adEvents.adId, adIds), gte(adEvents.createdAt, sinceDate)));

    const recentFeedback = await db
      .select()
      .from(adFeedback)
      .where(and(inArray(adFeedback.adId, adIds), gte(adFeedback.createdAt, sinceDate)));

    const eventsByAd = new Map<string, AdEvent[]>();
    for (const ev of recentEvents as AdEvent[]) {
      const list = eventsByAd.get(ev.adId) ?? [];
      list.push(ev);
      eventsByAd.set(ev.adId, list);
    }

    const feedbackByAd = new Map<string, AdFeedback[]>();
    for (const fb of recentFeedback as AdFeedback[]) {
      const list = feedbackByAd.get(fb.adId) ?? [];
      list.push(fb);
      feedbackByAd.set(fb.adId, list);
    }

    const updates: Array<{ id: string; communityScore: number }> = [];

    for (const ad of allAds as Advertisement[]) {
      let score = 50; // base

      const feedback = feedbackByAd.get(ad.id) ?? [];
      for (const fb of feedback) {
        if (fb.rating === "helpful") score += 5;
        else if (fb.rating === "not_relevant") score -= 5;
        else if (fb.rating === "spam") score -= 15;
      }

      const events = (eventsByAd.get(ad.id) ?? []).sort(
        (a, b) => (a.createdAt?.getTime?.() ?? 0) - (b.createdAt?.getTime?.() ?? 0)
      );

      let impressionCount = 0;
      let clickCount = 0;

      for (const ev of events) {
        if (ev.eventType === "impression") impressionCount++;
        if (ev.eventType === "click") clickCount++;
      }

      // Simple CTR-based adjustment: impressions with no clicks slightly negative
      if (impressionCount > 0 && clickCount === 0) {
        score -= 1;
      }

      // Clamp to [0, 100]
      const clamped = Math.max(0, Math.min(100, score));
      updates.push({ id: ad.id, communityScore: clamped });
    }

    if (!updates.length) return;

    await db.transaction(async (tx) => {
      for (const u of updates) {
        await tx
          .update(advertisements)
          .set({ communityScore: u.communityScore })
          .where(eq(advertisements.id, u.id));
      }
    });
  }

  // Get targeted ad based on audience and location
  async getTargetedAd(criteria: {
    audience: string;
    state?: string;
    county?: string;
    regionSlug?: string;
    placement?: string;
    excludeAdIds?: string[];
    preferAffiliate?: boolean;
    minCommunityScore?: number;
  }): Promise<Advertisement | null> {
    // Build location targeting filters
    const locationFilters = ["national"];

    if (criteria.state) {
      locationFilters.push(`state:${criteria.state}`);
    }

    if (criteria.county) {
      locationFilters.push(`county:${criteria.county}`);
    }

    if (criteria.regionSlug) {
      locationFilters.push(`region:${criteria.regionSlug}`);
    }

    const placement = criteria.placement || "site_visit";
    const excludeAdIds = Array.isArray(criteria.excludeAdIds)
      ? criteria.excludeAdIds.filter(Boolean)
      : [];
    const preferAffiliate = Boolean(criteria.preferAffiliate);
    const minCommunityScore =
      typeof criteria.minCommunityScore === "number"
        ? Math.max(0, Math.min(100, criteria.minCommunityScore))
        : 0;

    // Query for active ads matching audience and location
    const ads = await db
      .select()
      .from(advertisements)
      .where(
        and(
          eq(advertisements.isActive, true),
          eq(advertisements.placement, placement),
          inArray(advertisements.targetLocation, locationFilters),
          excludeAdIds.length > 0 ? notInArray(advertisements.id, excludeAdIds) : sql`1=1`,
          criteria.audience !== "all"
            ? eq(advertisements.targetAudience, criteria.audience)
            : sql`1=1`,
          minCommunityScore > 0 ? gte(advertisements.communityScore, minCommunityScore) : sql`1=1`
        )
      )
      .orderBy(
        desc(advertisements.communityScore),
        desc(advertisements.priority),
        preferAffiliate ? desc(advertisements.isAffiliate) : sql`0`,
        sql`RANDOM()`
      )
      .limit(1);

    return ads[0] || null;
  }

  async incrementAdImpressions(adId: string): Promise<void> {
    await db
      .update(advertisements)
      .set({
        impressions: sql`${advertisements.impressions} + 1`,
        viewCount: sql`${advertisements.viewCount} + 1`,
      })
      .where(eq(advertisements.id, adId));
  }

  async incrementAdClicks(adId: string): Promise<void> {
    await db
      .update(advertisements)
      .set({
        clickCount: sql`${advertisements.clickCount} + 1`,
      })
      .where(eq(advertisements.id, adId));
  }

  async submitAdFeedback(params: {
    adId: string;
    userId: string;
    rating: "helpful" | "not_relevant" | "spam";
    source: "scout" | "site_visit" | "saved";
  }): Promise<void> {
    const { adId, userId, rating, source } = params;
    if (!adId || !userId) return;

    // Upsert-like behavior: ensure one feedback per user per ad
    const [existing] = await db
      .select()
      .from(adFeedback)
      .where(and(eq(adFeedback.adId, adId), eq(adFeedback.userId, userId)))
      .limit(1);

    if (existing) {
      await db
        .update(adFeedback)
        .set({ rating, source, createdAt: new Date() })
        .where(eq(adFeedback.id, existing.id));
    } else {
      await db.insert(adFeedback).values({ adId, userId, rating, source } as InsertAdFeedback);
    }
  }

  // Saved ads functionality
  async saveAdForUser(userId: string, adId: string): Promise<SavedAd> {
    // Check if already saved
    const [existing] = await db
      .select()
      .from(savedAds)
      .where(and(eq(savedAds.userId, userId), eq(savedAds.adId, adId)));

    if (existing) {
      return existing;
    }

    const [savedAd] = await db.insert(savedAds).values({ userId, adId }).returning();
    return savedAd;
  }

  async getSavedAdsForUser(userId: string): Promise<Advertisement[]> {
    const results = await db
      .select({
        id: advertisements.id,
        title: advertisements.title,
        content: advertisements.content,
        imageUrl: advertisements.imageUrl,
        linkUrl: advertisements.linkUrl,
        placement: advertisements.placement,
        targetAudience: advertisements.targetAudience,
        targetLocation: advertisements.targetLocation,
        priority: advertisements.priority,
        isActive: advertisements.isActive,
        isAffiliate: advertisements.isAffiliate,
        startDate: advertisements.startDate,
        endDate: advertisements.endDate,
        clickCount: advertisements.clickCount,
        viewCount: advertisements.viewCount,
        impressions: advertisements.impressions,
        communityScore: advertisements.communityScore,
        createdAt: advertisements.createdAt,
        updatedAt: advertisements.updatedAt,
      })
      .from(savedAds)
      .innerJoin(advertisements, eq(savedAds.adId, advertisements.id))
      .where(eq(savedAds.userId, userId))
      .orderBy(desc(savedAds.savedAt));

    return results;
  }

  async removeSavedAd(userId: string, adId: string): Promise<void> {
    await db.delete(savedAds).where(and(eq(savedAds.userId, userId), eq(savedAds.adId, adId)));
  }

  // Notification system operations
  async createNotification(notification: InsertNotification): Promise<Notification> {
    const normalizedNotification: InsertNotification = {
      ...notification,
      deliveryMethods: this.coerceStringArray((notification as any).deliveryMethods) as any,
    };
    const [newNotification] = await db
      .insert(notifications)
      .values(normalizedNotification as any)
      .returning();
    return newNotification;
  }

  async getUserNotifications(userId: string, unreadOnly: boolean = false): Promise<Notification[]> {
    if (unreadOnly) {
      return await db
        .select()
        .from(notifications)
        .where(and(eq(notifications.userId, userId), eq(notifications.isRead, false)))
        .orderBy(desc(notifications.createdAt));
    }

    return await db
      .select()
      .from(notifications)
      .where(eq(notifications.userId, userId))
      .orderBy(desc(notifications.createdAt));
  }

  async markNotificationAsRead(notificationId: string): Promise<void> {
    await db
      .update(notifications)
      .set({ isRead: true })
      .where(eq(notifications.id, notificationId));
  }

  async markAllNotificationsAsRead(userId: string): Promise<void> {
    await db.update(notifications).set({ isRead: true }).where(eq(notifications.userId, userId));
  }

  async getSavedAdsForReminders(): Promise<Array<SavedAd & { user: User; ad: Advertisement }>> {
    const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const results = await db
      .select({
        id: savedAds.id,
        userId: savedAds.userId,
        adId: savedAds.adId,
        savedAt: savedAds.savedAt,
        lastReminderSent: savedAds.lastReminderSent,
        reminderCount: savedAds.reminderCount,
        isActive: savedAds.isActive,
        user: {
          id: users.id,
          email: users.email,
          firstName: users.firstName,
          lastName: users.lastName,
        },
        ad: {
          id: advertisements.id,
          title: advertisements.title,
          content: advertisements.content,
          linkUrl: advertisements.linkUrl,
          isAffiliate: advertisements.isAffiliate,
          endDate: advertisements.endDate,
        },
      })
      .from(savedAds)
      .innerJoin(users, eq(savedAds.userId, users.id))
      .innerJoin(advertisements, eq(savedAds.adId, advertisements.id))
      .where(
        and(
          eq(savedAds.isActive, true),
          eq(advertisements.isActive, true),
          or(isNull(advertisements.endDate), gt(advertisements.endDate, new Date())),
          or(
            // First reminder: 3 days after saving
            and(isNull(savedAds.lastReminderSent), lt(savedAds.savedAt, threeDaysAgo)),
            // Subsequent reminders: every 24 hours (max 3 total)
            and(
              isNotNull(savedAds.lastReminderSent),
              lt(savedAds.lastReminderSent, oneDayAgo),
              lt(savedAds.reminderCount, 3)
            )
          )
        )
      );

    return results as Array<SavedAd & { user: User; ad: Advertisement }>;
  }

  async updateSavedAdReminderStatus(savedAdId: string, reminderCount: number): Promise<void> {
    await db
      .update(savedAds)
      .set({
        lastReminderSent: new Date(),
        reminderCount: reminderCount,
      })
      .where(eq(savedAds.id, savedAdId));
  }

  async incrementAdViews(id: string): Promise<void> {
    await db
      .update(advertisements)
      .set({ viewCount: sql`${advertisements.viewCount} + 1` })
      .where(eq(advertisements.id, id));
  }

  async getContractorSettings(category?: string): Promise<ContractorSetting[]> {
    if (category) {
      return await db
        .select()
        .from(contractorSettings)
        .where(eq(contractorSettings.category, category));
    }
    return await db
      .select()
      .from(contractorSettings)
      .orderBy(contractorSettings.category, contractorSettings.setting);
  }

  async updateContractorSetting(
    id: string,
    updates: Partial<InsertContractorSetting>
  ): Promise<ContractorSetting> {
    const [setting] = await db
      .update(contractorSettings)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(contractorSettings.id, id))
      .returning();
    return setting;
  }

  async createContractorSetting(setting: InsertContractorSetting): Promise<ContractorSetting> {
    const [newSetting] = await db.insert(contractorSettings).values(setting).returning();
    return newSetting;
  }

  async deleteContractorSetting(id: string): Promise<void> {
    await db.delete(contractorSettings).where(eq(contractorSettings.id, id));
  }

  // Error Report operations
  async createErrorReport(report: any): Promise<any> {
    const [errorReport] = await db
      .insert(errorReports)
      .values({
        id: report.id,
        userId: report.userId,
        userEmail: report.userEmail,
        title: report.title,
        description: report.description,
        errorType: report.errorType,
        currentUrl: report.currentUrl,
        userAgent: report.userAgent,
        browserInfo: report.browserInfo,
        attachments: report.attachments,
        status: report.status,
        priority: report.priority,
      })
      .returning();
    return errorReport;
  }

  async updateErrorReport(id: string, updates: any): Promise<any> {
    const [errorReport] = await db
      .update(errorReports)
      .set({
        ...updates,
        updatedAt: new Date(),
      })
      .where(eq(errorReports.id, id))
      .returning();
    return errorReport;
  }

  async getErrorReports(): Promise<any> {
    return await db.select().from(errorReports).orderBy(desc(errorReports.createdAt));
  }

  async deleteErrorReport(id: string): Promise<void> {
    await db.delete(errorReports).where(eq(errorReports.id, id));
  }

  // Heatmap operations
  async getLocalityHeatmapData(days: number): Promise<
    Array<{
      state: string;
      county: string;
      interactions: number;
      users: number;
      contractors: number;
      homeowners: number;
      latitude: number;
      longitude: number;
    }>
  > {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    // Aggregate real user data by canonical location
    const rows = await db
      .select({
        stateCode: users.stateCode,
        countyName: users.countyName,
        latitude: users.latitude,
        longitude: users.longitude,
        userCount: sql<number>`COUNT(*)`,
        contractorCount: sql<number>`SUM(CASE WHEN ${users.role} IN ('contractor','handyman','service_provider','specialty_tradesperson','inspector','realtor','mortgage_broker','insurance_agent','car_dealer','auto_service') THEN 1 ELSE 0 END)`,
        homeownerCount: sql<number>`SUM(CASE WHEN ${users.role} IN ('homeowner','renter','landlord','hoa_member','property_manager') THEN 1 ELSE 0 END)`,
      })
      .from(users)
      .where(
        and(
          gte(users.createdAt, startDate),
          isNotNull(users.stateCode),
          isNotNull(users.countyName)
        )
      )
      .groupBy(users.stateCode, users.countyName, users.latitude, users.longitude);

    return rows
      .map((row) => ({
        state: row.stateCode || "",
        county: row.countyName || "",
        // For now, treat interactions as the count of active users in the timeframe
        interactions: Number(row.userCount || 0),
        users: Number(row.userCount || 0),
        contractors: Number(row.contractorCount || 0),
        homeowners: Number(row.homeownerCount || 0),
        latitude: row.latitude ? Number(row.latitude) : 0,
        longitude: row.longitude ? Number(row.longitude) : 0,
      }))
      .filter((row) => row.state && row.county);
  }

  async getUserCountsByCounty(days: number): Promise<
    Array<{
      countyFips: string;
      stateCode: string | null;
      countyName: string | null;
      userCount: number;
    }>
  > {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const rows = await db
      .select({
        countyFips: users.countyFips,
        stateCode: users.stateCode,
        countyName: users.countyName,
        userCount: sql<number>`COUNT(*)`,
      })
      .from(users)
      .where(and(gte(users.createdAt, startDate), isNotNull(users.countyFips)))
      .groupBy(users.countyFips, users.stateCode, users.countyName);

    return rows
      .filter((row) => !!row.countyFips)
      .map((row) => ({
        countyFips: row.countyFips as string,
        stateCode: row.stateCode ?? null,
        countyName: row.countyName ?? null,
        userCount: Number(row.userCount || 0),
      }));
  }

  async getCountyNotes(countyFips: string): Promise<CountyNote[]> {
    return await db
      .select()
      .from(countyNotes)
      .where(eq(countyNotes.countyFips, countyFips))
      .orderBy(desc(countyNotes.createdAt));
  }

  async getCountyNoteById(id: string): Promise<CountyNote | undefined> {
    const [note] = await db.select().from(countyNotes).where(eq(countyNotes.id, id));
    return note;
  }

  async createCountyNote(input: InsertCountyNote): Promise<CountyNote> {
    const [note] = await db
      .insert(countyNotes)
      .values({ ...input, updatedAt: new Date() })
      .returning();
    return note;
  }

  async updateCountyNote(
    id: string,
    update: Partial<Pick<InsertCountyNote, "category" | "content">>
  ): Promise<CountyNote | undefined> {
    const [note] = await db
      .update(countyNotes)
      .set({ ...update, updatedAt: new Date() })
      .where(eq(countyNotes.id, id))
      .returning();
    return note;
  }

  async deleteCountyNote(id: string): Promise<void> {
    await db.delete(countyNotes).where(eq(countyNotes.id, id));
  }

  async getCountyEntities(countyFips: string): Promise<CountyEntity[]> {
    return await db
      .select()
      .from(countyEntities)
      .where(eq(countyEntities.countyFips, countyFips))
      .orderBy(desc(countyEntities.createdAt));
  }

  async getCountyEntityById(id: string): Promise<CountyEntity | undefined> {
    const [entity] = await db.select().from(countyEntities).where(eq(countyEntities.id, id));
    return entity;
  }

  async createCountyEntity(input: InsertCountyEntity): Promise<CountyEntity> {
    const [entity] = await db
      .insert(countyEntities)
      .values({ ...input, updatedAt: new Date() })
      .returning();
    return entity;
  }

  async updateCountyEntity(
    id: string,
    update: Partial<
      Pick<InsertCountyEntity, "label" | "status" | "metadata" | "entityId" | "entityType">
    >
  ): Promise<CountyEntity | undefined> {
    const [entity] = await db
      .update(countyEntities)
      .set({ ...update, updatedAt: new Date() })
      .where(eq(countyEntities.id, id))
      .returning();
    return entity;
  }

  async deleteCountyEntity(id: string): Promise<void> {
    await db.delete(countyEntities).where(eq(countyEntities.id, id));
  }

  async getCountyMetricsByKey(metricKey: string): Promise<CountyMetric[]> {
    return await db.select().from(countyMetrics).where(eq(countyMetrics.metricKey, metricKey));
  }

  async getCountyMetricsForCounty(params: {
    countyFips: string;
    metricKeys?: string[];
  }): Promise<CountyMetric[]> {
    const fips = String(params.countyFips || "");
    if (!/^\d{5}$/.test(fips)) return [];
    const keys = Array.isArray(params.metricKeys)
      ? params.metricKeys.filter((k): k is string => typeof k === "string" && k.trim().length > 0)
      : [];

    const predicates: (SQL | undefined)[] = [eq(countyMetrics.countyFips, fips)];
    if (keys.length) predicates.push(inArray(countyMetrics.metricKey, Array.from(new Set(keys))));
    return await db
      .select()
      .from(countyMetrics)
      .where(and(...predicates));
  }

  // Contractor Promo Operations
  async createContractorPromo(
    promo: Omit<
      InsertContractorPromo,
      | "slug"
      | "viewCount"
      | "clickCount"
      | "projectRequestCount"
      | "currentUses"
      | "createdAt"
      | "updatedAt"
    >
  ): Promise<ContractorPromo> {
    const slug = await this.generatePromoSlug(promo.title);
    const [newPromo] = await db
      .insert(contractorPromos)
      .values({ ...promo, slug })
      .returning();
    return newPromo;
  }

  async getContractorPromo(id: string): Promise<ContractorPromo | undefined> {
    const [promo] = await db.select().from(contractorPromos).where(eq(contractorPromos.id, id));
    return promo;
  }

  async getContractorPromoBySlug(slug: string): Promise<ContractorPromo | undefined> {
    const [promo] = await db.select().from(contractorPromos).where(eq(contractorPromos.slug, slug));
    return promo;
  }

  async getContractorPromos(contractorId: string): Promise<ContractorPromo[]> {
    return await db
      .select()
      .from(contractorPromos)
      .where(eq(contractorPromos.contractorId, contractorId))
      .orderBy(desc(contractorPromos.createdAt));
  }

  async updateContractorPromo(
    id: string,
    updates: Partial<ContractorPromo>
  ): Promise<ContractorPromo> {
    const [updatedPromo] = await db
      .update(contractorPromos)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(contractorPromos.id, id))
      .returning();
    return updatedPromo;
  }

  async deleteContractorPromo(id: string): Promise<void> {
    await db.delete(contractorPromos).where(eq(contractorPromos.id, id));
  }

  async generatePromoSlug(title: string): Promise<string> {
    const baseSlug = title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .substring(0, 50);

    let slug = baseSlug;
    let counter = 1;

    while (true) {
      const existing = await db
        .select({ id: contractorPromos.id })
        .from(contractorPromos)
        .where(eq(contractorPromos.slug, slug))
        .limit(1);

      if (existing.length === 0) {
        return slug;
      }

      slug = `${baseSlug}-${counter}`;
      counter++;
    }
  }

  // Promo Analytics
  async recordPromoInteraction(interaction: InsertPromoInteraction): Promise<PromoInteraction> {
    const [newInteraction] = await db.insert(promoInteractions).values(interaction).returning();
    return newInteraction;
  }

  async getPromoAnalytics(promoId: string): Promise<{
    totalViews: number;
    totalClicks: number;
    totalLeads: number;
    recentInteractions: PromoInteraction[];
  }> {
    const [stats] = await db
      .select({
        totalViews: sql<number>`count(case when ${promoInteractions.interactionType} = 'view' then 1 end)`,
        totalClicks: sql<number>`count(case when ${promoInteractions.interactionType} = 'click' then 1 end)`,
        totalLeads: sql<number>`count(case when ${promoInteractions.interactionType} = 'lead_generated' then 1 end)`,
      })
      .from(promoInteractions)
      .where(eq(promoInteractions.promoId, promoId));

    const recentInteractions = await db
      .select()
      .from(promoInteractions)
      .where(eq(promoInteractions.promoId, promoId))
      .orderBy(desc(promoInteractions.createdAt))
      .limit(50);

    return {
      totalViews: stats.totalViews || 0,
      totalClicks: stats.totalClicks || 0,
      totalLeads: stats.totalLeads || 0,
      recentInteractions,
    };
  }

  async incrementPromoView(promoId: string): Promise<void> {
    await db
      .update(contractorPromos)
      .set({
        viewCount: sql`${contractorPromos.viewCount} + 1`,
        updatedAt: new Date(),
      })
      .where(eq(contractorPromos.id, promoId));
  }

  async incrementPromoClick(promoId: string): Promise<void> {
    await db
      .update(contractorPromos)
      .set({
        clickCount: sql`${contractorPromos.clickCount} + 1`,
        updatedAt: new Date(),
      })
      .where(eq(contractorPromos.id, promoId));
  }

  async getActivePromosInArea(countyFips: string): Promise<ContractorPromo[]> {
    const now = new Date();
    return await db
      .select()
      .from(contractorPromos)
      .where(
        and(
          eq(contractorPromos.isActive, true),
          or(
            sql`${contractorPromos.serviceAreas} ? ${countyFips}`,
            sql`${contractorPromos.serviceAreas} is null`
          ),
          or(isNull(contractorPromos.expiresAt), gt(contractorPromos.expiresAt, now)),
          or(
            isNull(contractorPromos.maxUses),
            sql`${contractorPromos.currentUses} < ${contractorPromos.maxUses}`
          )
        )
      )
      .orderBy(desc(contractorPromos.createdAt));
  }

  // Handmade Marketplace Methods

  // Categories
  async getHandmadeCategories(): Promise<HandmadeCategory[]> {
    return await db
      .select()
      .from(handmadeCategories)
      .where(eq(handmadeCategories.isActive, true))
      .orderBy(asc(handmadeCategories.sortOrder), asc(handmadeCategories.name));
  }

  async createHandmadeCategory(categoryData: InsertHandmadeCategory): Promise<HandmadeCategory> {
    const [category] = await db.insert(handmadeCategories).values(categoryData).returning();
    return category;
  }

  // Products
  async getHandmadeProducts(filters?: {
    categoryId?: string;
    sellerId?: string;
    featured?: boolean;
    location?: { state?: string; county?: string };
    priceRange?: { min?: number; max?: number };
    materials?: string[];
    inStock?: boolean;
    search?: string;
    limit?: number;
    offset?: number;
  }): Promise<HandmadeProduct[]> {
    const query = db.select().from(handmadeProducts);

    const conditions = [eq(handmadeProducts.status, "active")];

    if (filters?.categoryId) {
      conditions.push(eq(handmadeProducts.categoryId, filters.categoryId));
    }
    if (filters?.sellerId) {
      conditions.push(eq(handmadeProducts.sellerId, filters.sellerId));
    }
    if (filters?.featured) {
      conditions.push(eq(handmadeProducts.featured, true));
    }
    if (filters?.location?.state) {
      conditions.push(eq(handmadeProducts.stateCode, filters.location.state));
    }
    if (filters?.location?.county) {
      conditions.push(eq(handmadeProducts.countyFips, filters.location.county));
    }
    if (filters?.inStock !== undefined) {
      conditions.push(eq(handmadeProducts.inStock, filters.inStock));
    }
    if (filters?.priceRange?.min) {
      conditions.push(sql`${handmadeProducts.price} >= ${filters.priceRange.min}`);
    }
    if (filters?.priceRange?.max) {
      conditions.push(sql`${handmadeProducts.price} <= ${filters.priceRange.max}`);
    }
    if (filters?.search) {
      conditions.push(
        sql`(${handmadeProducts.title} ILIKE ${`%${filters.search}%`} OR ${handmadeProducts.description} ILIKE ${`%${filters.search}%`})`
      );
    }
    if (filters?.materials && filters.materials.length > 0) {
      conditions.push(sql`${handmadeProducts.materials} @> ${JSON.stringify(filters.materials)}`);
    }

    return await query
      .where(and(...conditions))
      .orderBy(desc(handmadeProducts.featured), desc(handmadeProducts.createdAt))
      .limit(filters?.limit || 20)
      .offset(filters?.offset || 0);
  }

  async getHandmadeProduct(id: string): Promise<HandmadeProduct | undefined> {
    const [product] = await db.select().from(handmadeProducts).where(eq(handmadeProducts.id, id));
    return product;
  }

  async createHandmadeProduct(productData: InsertHandmadeProduct): Promise<HandmadeProduct> {
    const [product] = await db.insert(handmadeProducts).values(productData).returning();
    return product;
  }

  async updateHandmadeProduct(
    id: string,
    updates: Partial<HandmadeProduct>
  ): Promise<HandmadeProduct> {
    const [product] = await db
      .update(handmadeProducts)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(handmadeProducts.id, id))
      .returning();
    return product;
  }

  async incrementProductViews(id: string): Promise<void> {
    await db
      .update(handmadeProducts)
      .set({ viewCount: sql`${handmadeProducts.viewCount} + 1` })
      .where(eq(handmadeProducts.id, id));
  }

  // Product Favorites
  async toggleProductFavorite(
    userId: string,
    productId: string
  ): Promise<{ action: "added" | "removed" }> {
    const existing = await db
      .select()
      .from(productFavorites)
      .where(and(eq(productFavorites.userId, userId), eq(productFavorites.productId, productId)));

    if (existing.length > 0) {
      await db
        .delete(productFavorites)
        .where(and(eq(productFavorites.userId, userId), eq(productFavorites.productId, productId)));

      // Decrement favorite count
      await db
        .update(handmadeProducts)
        .set({ favoriteCount: sql`${handmadeProducts.favoriteCount} - 1` })
        .where(eq(handmadeProducts.id, productId));

      return { action: "removed" };
    } else {
      await db.insert(productFavorites).values({ userId, productId });

      // Increment favorite count
      await db
        .update(handmadeProducts)
        .set({ favoriteCount: sql`${handmadeProducts.favoriteCount} + 1` })
        .where(eq(handmadeProducts.id, productId));

      return { action: "added" };
    }
  }

  async getUserFavoriteProducts(userId: string): Promise<HandmadeProduct[]> {
    return await db
      .select({
        id: handmadeProducts.id,
        sellerId: handmadeProducts.sellerId,
        title: handmadeProducts.title,
        description: handmadeProducts.description,
        categoryId: handmadeProducts.categoryId,
        tags: handmadeProducts.tags,
        price: handmadeProducts.price,
        compareAtPrice: handmadeProducts.compareAtPrice,
        currency: handmadeProducts.currency,
        materials: handmadeProducts.materials,
        dimensions: handmadeProducts.dimensions,
        colors: handmadeProducts.colors,
        customizable: handmadeProducts.customizable,
        customizationOptions: handmadeProducts.customizationOptions,
        inStock: handmadeProducts.inStock,
        quantityAvailable: handmadeProducts.quantityAvailable,
        madeToOrder: handmadeProducts.madeToOrder,
        processingTime: handmadeProducts.processingTime,
        primaryImageUrl: handmadeProducts.primaryImageUrl,
        images: handmadeProducts.images,
        city: handmadeProducts.city,
        stateCode: handmadeProducts.stateCode,
        countyFips: handmadeProducts.countyFips,
        shippingFrom: handmadeProducts.shippingFrom,
        freeShipping: handmadeProducts.freeShipping,
        shippingCost: handmadeProducts.shippingCost,
        localPickupAvailable: handmadeProducts.localPickupAvailable,
        shipsNationwide: handmadeProducts.shipsNationwide,
        shippingRegions: handmadeProducts.shippingRegions,
        status: handmadeProducts.status,
        featured: handmadeProducts.featured,
        viewCount: handmadeProducts.viewCount,
        favoriteCount: handmadeProducts.favoriteCount,
        seoTitle: handmadeProducts.seoTitle,
        seoDescription: handmadeProducts.seoDescription,
        createdAt: handmadeProducts.createdAt,
        updatedAt: handmadeProducts.updatedAt,
      })
      .from(handmadeProducts)
      .innerJoin(productFavorites, eq(productFavorites.productId, handmadeProducts.id))
      .where(eq(productFavorites.userId, userId))
      .orderBy(desc(productFavorites.createdAt));
  }

  // Product Orders
  async createProductOrder(orderData: InsertProductOrder): Promise<ProductOrder> {
    const [order] = await db.insert(productOrders).values(orderData).returning();
    return order;
  }

  async getProductOrder(id: string): Promise<ProductOrder | undefined> {
    const [order] = await db.select().from(productOrders).where(eq(productOrders.id, id));
    return order;
  }

  async getUserOrders(userId: string, type: "buyer" | "seller"): Promise<ProductOrder[]> {
    const field = type === "buyer" ? productOrders.buyerId : productOrders.sellerId;
    return await db
      .select()
      .from(productOrders)
      .where(eq(field, userId))
      .orderBy(desc(productOrders.createdAt));
  }

  async updateProductOrder(id: string, updates: Partial<ProductOrder>): Promise<ProductOrder> {
    const [order] = await db
      .update(productOrders)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(productOrders.id, id))
      .returning();
    return order;
  }

  // Product Reviews
  async createProductReview(reviewData: InsertProductReview): Promise<ProductReview> {
    const [review] = await db.insert(productReviews).values(reviewData).returning();

    // Update product and seller ratings
    await this.updateProductRatings(reviewData.productId);
    await this.updateSellerRatings(reviewData.sellerId);

    return review;
  }

  async getProductReviews(productId: string): Promise<ProductReview[]> {
    return await db
      .select()
      .from(productReviews)
      .where(and(eq(productReviews.productId, productId), eq(productReviews.isPublic, true)))
      .orderBy(desc(productReviews.createdAt));
  }

  async getProductRatingSummary(productId: string): Promise<{ average: number; count: number }> {
    const [result] = await db
      .select({
        count: sql<number>`count(*)`,
        average: sql<number>`avg(${productReviews.rating})`,
      })
      .from(productReviews)
      .where(and(eq(productReviews.productId, productId), eq(productReviews.isPublic, true)));

    return {
      count: result?.count || 0,
      average: result?.average || 0,
    };
  }

  private async updateProductRatings(productId: string): Promise<void> {
    await this.getProductRatingSummary(productId);
    // Products don't have rating fields, but we could add them if needed
  }

  // Seller Profiles
  async getSellerProfile(userId: string): Promise<SellerProfile | undefined> {
    const [profile] = await db
      .select()
      .from(sellerProfiles)
      .where(eq(sellerProfiles.userId, userId));
    return profile;
  }

  async createSellerProfile(profileData: InsertSellerProfile): Promise<SellerProfile> {
    const [profile] = await db.insert(sellerProfiles).values(profileData).returning();
    return profile;
  }

  async updateSellerProfile(
    userId: string,
    updates: Partial<SellerProfile>
  ): Promise<SellerProfile> {
    const [profile] = await db
      .update(sellerProfiles)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(sellerProfiles.userId, userId))
      .returning();
    return profile;
  }

  async getSellerRatings(userId: string): Promise<{ average: number; count: number }> {
    const [result] = await db
      .select({
        count: sql<number>`count(*)`,
        average: sql<number>`avg(${productReviews.rating})`,
      })
      .from(productReviews)
      .where(and(eq(productReviews.sellerId, userId), eq(productReviews.isPublic, true)));

    return {
      count: result?.count || 0,
      average: result?.average || 0,
    };
  }

  private async updateSellerRatings(sellerId: string): Promise<void> {
    const ratings = await this.getSellerRatings(sellerId);
    await db
      .update(sellerProfiles)
      .set({
        averageRating: ratings.average.toString(),
        totalReviews: ratings.count,
        updatedAt: new Date(),
      })
      .where(eq(sellerProfiles.userId, sellerId));
  }

  async getSellerProducts(sellerId: string): Promise<HandmadeProduct[]> {
    return await db
      .select()
      .from(handmadeProducts)
      .where(eq(handmadeProducts.sellerId, sellerId))
      .orderBy(desc(handmadeProducts.featured), desc(handmadeProducts.createdAt));
  }

  // Contractor application methods
  async createContractorApplication(data: typeof contractorApplications.$inferInsert) {
    const result = await db.insert(contractorApplications).values(data).returning();
    return result[0];
  }

  async getContractorApplications(filters?: {
    status?: string;
    statusPrefix?: string;
    limit?: number;
  }) {
    const conditions: SQL[] = [];

    if (filters?.status) {
      conditions.push(eq(contractorApplications.status, filters.status));
    }

    if (filters?.statusPrefix && typeof filters.statusPrefix === "string") {
      conditions.push(like(contractorApplications.status, `${filters.statusPrefix}%`));
    }

    const whereClause: SQL = and(...conditions) ?? sql`true`;
    const limit = filters?.limit ?? 50;

    return await db
      .select()
      .from(contractorApplications)
      .where(whereClause)
      .orderBy(desc(contractorApplications.submittedAt))
      .limit(limit);
  }

  async getContractorApplication(id: string) {
    return await db
      .select()
      .from(contractorApplications)
      .where(eq(contractorApplications.id, id))
      .limit(1)
      .then((rows: any[]) => rows[0]);
  }

  async updateContractorApplication(
    id: string,
    data: Partial<typeof contractorApplications.$inferInsert>
  ) {
    await db
      .update(contractorApplications)
      .set({
        ...data,
        updatedAt: new Date(),
      })
      .where(eq(contractorApplications.id, id));
  }

  // Recommendation system methods with anti-abuse protection
  async createRecommendation(
    data: typeof recommendations.$inferInsert & {
      ipAddress?: string;
      userAgent?: string;
    }
  ) {
    // Check for duplicate recommendations from same USER for this contractor within 30 days
    const existingRecommendation = await db
      .select()
      .from(recommendations)
      .where(
        and(
          eq(recommendations.contractorId, data.contractorId),
          eq(recommendations.userId, data.userId),
          gte(recommendations.createdAt, new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)) // 30 days
        )
      )
      .limit(1);

    if (existingRecommendation.length > 0) {
      throw new Error("You can only submit one recommendation per contractor every 30 days");
    }

    // Also check by email as additional protection
    const existingByEmail = await db
      .select()
      .from(recommendations)
      .where(
        and(
          eq(recommendations.contractorId, data.contractorId),
          eq(recommendations.customerEmail, data.customerEmail),
          gte(recommendations.createdAt, new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)) // 30 days
        )
      )
      .limit(1);

    if (existingByEmail.length > 0) {
      throw new Error(
        "This email address has already submitted a recommendation for this contractor recently"
      );
    }

    // Check for too many recommendations from same IP in 24 hours
    if (data.ipAddress) {
      const recentFromIp = await db
        .select({ count: sql<number>`count(*)` })
        .from(recommendations)
        .where(
          and(
            eq(recommendations.ipAddress, data.ipAddress),
            gte(recommendations.createdAt, new Date(Date.now() - 24 * 60 * 60 * 1000)) // 24 hours
          )
        );

      if (recentFromIp[0]?.count >= 5) {
        throw new Error("Too many recommendations from this location. Please try again tomorrow.");
      }
    }

    const result = await db
      .insert(recommendations)
      .values({
        ...data,
        moderationStatus: "pending", // All recommendations require moderation
        isPublic: false,
      })
      .returning();

    return result[0];
  }

  async getContractorRecommendations(
    contractorId: string,
    options?: { limit?: number; type?: "positive" | "negative" | "all" }
  ) {
    const conditions: SQL[] = [
      eq(recommendations.contractorId, contractorId),
      eq(recommendations.isPublic, true),
      eq(recommendations.moderationStatus, "approved"),
    ];

    if (options?.type && options.type !== "all") {
      conditions.push(eq(recommendations.recommendationType, options.type));
    }

    const limit = options?.limit ?? 50;

    return await db
      .select()
      .from(recommendations)
      .where(and(...conditions))
      .orderBy(desc(recommendations.createdAt))
      .limit(limit);
  }

  async updateContractorRecommendationStats(contractorId: string) {
    // Get all approved recommendations for this contractor
    const stats = await db
      .select({
        positive: sql<number>`count(*) filter (where recommendation_type = 'positive')`,
        negative: sql<number>`count(*) filter (where recommendation_type = 'negative')`,
        total: sql<number>`count(*)`,
      })
      .from(recommendations)
      .where(
        and(
          eq(recommendations.contractorId, contractorId),
          eq(recommendations.moderationStatus, "approved")
        )
      );

    const { positive, negative, total } = stats[0] || { positive: 0, negative: 0, total: 0 };
    const netScore = positive - negative; // Net recommendation score for leaderboard
    const percentage = total > 0 ? (positive / total) * 100 : 0;

    // Update contractor recommendation stats
    await db
      .update(contractors)
      .set({
        positiveRecommendations: positive,
        negativeRecommendations: negative,
        totalRecommendations: total,
        recommendationScore: netScore.toString(), // Net score (positive - negative)
        recommendationPercentage: percentage.toFixed(2), // Percentage
        updatedAt: new Date(),
      })
      .where(eq(contractors.id, contractorId));
  }

  // ===== COMMUNITY MODERATION IMPLEMENTATIONS =====

  // Reports
  async createModerationReport(reportData: InsertModerationReport): Promise<ModerationReport> {
    const [report] = await db.insert(moderationReports).values(reportData).returning();
    return report;
  }

  async getModerationReport(id: string): Promise<ModerationReport | undefined> {
    const [report] = await db.select().from(moderationReports).where(eq(moderationReports.id, id));
    return report;
  }

  async getModerationReports(filters?: {
    status?: string;
    contentType?: string;
    county?: string;
    state?: string;
    reporterId?: string;
    limit?: number;
    offset?: number;
  }): Promise<ModerationReport[]> {
    const conditions: SQL[] = [];
    const statusValues = moderationReports.status.enumValues ?? [];
    const contentTypeValues = moderationReports.contentType.enumValues ?? [];

    if (filters?.status && statusValues.includes(filters.status as any)) {
      conditions.push(
        eq(moderationReports.status, filters.status as (typeof statusValues)[number])
      );
    }
    if (filters?.contentType && contentTypeValues.includes(filters.contentType as any)) {
      conditions.push(
        eq(moderationReports.contentType, filters.contentType as (typeof contentTypeValues)[number])
      );
    }
    if (filters?.county) {
      conditions.push(eq(moderationReports.contentCounty, filters.county));
    }
    if (filters?.state) {
      conditions.push(eq(moderationReports.contentState, filters.state));
    }
    if (filters?.reporterId) {
      conditions.push(eq(moderationReports.reporterId, filters.reporterId));
    }

    const whereClause: SQL = and(...conditions) ?? sql`true`;
    const limit = filters?.limit ?? 50;
    const offset = filters?.offset ?? 0;

    return await db
      .select()
      .from(moderationReports)
      .where(whereClause)
      .orderBy(desc(moderationReports.createdAt))
      .limit(limit)
      .offset(offset);
  }

  async updateModerationReport(
    id: string,
    updates: Partial<ModerationReport>
  ): Promise<ModerationReport> {
    const [report] = await db
      .update(moderationReports)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(moderationReports.id, id))
      .returning();
    return report;
  }

  // Votes
  async createModerationVote(voteData: InsertModerationVote): Promise<ModerationVote> {
    const reportId = voteData.targetId;

    // Check if user already voted on this report
    const existingVote = await this.getModerationVote(reportId, voteData.voterId);
    if (existingVote) {
      throw new Error("User has already voted on this report");
    }

    // Calculate vote weight based on location
    const report = await this.getModerationReport(reportId);
    if (!report) {
      throw new Error("Report not found");
    }

    const voteWeight = await this.calculateLocalVoterWeight(
      "",
      "",
      report.contentCounty || "",
      report.contentState || ""
    );

    const [vote] = await db
      .insert(moderationVotes)
      .values({
        ...voteData,
        targetType: voteData.targetType ?? "report",
        targetId: reportId,
        weight: Math.round(voteWeight),
      })
      .returning();

    // Update vote counts
    await this.updateVoteCounts(reportId);

    return vote;
  }

  async getModerationVote(reportId: string, voterId: string): Promise<ModerationVote | undefined> {
    const [vote] = await db
      .select()
      .from(moderationVotes)
      .where(and(eq(moderationVotes.targetId, reportId), eq(moderationVotes.voterId, voterId)));
    return vote;
  }

  async getReportVotes(reportId: string): Promise<ModerationVote[]> {
    return await db
      .select()
      .from(moderationVotes)
      .where(eq(moderationVotes.targetId, reportId))
      .orderBy(desc(moderationVotes.createdAt));
  }

  async updateVoteCounts(reportId: string): Promise<void> {
    const votes = await this.getReportVotes(reportId);

    let totalVotes = 0;
    let removeVotes = 0;
    let keepVotes = 0;
    let reviewVotes = 0;

    votes.forEach((vote) => {
      const weight = Number(vote.weight ?? 1);
      totalVotes += weight;

      switch (vote.voteType) {
        case "remove":
          removeVotes += weight;
          break;
        case "keep":
          keepVotes += weight;
          break;
        case "needs_review":
          reviewVotes += weight;
          break;
      }
    });

    await db
      .update(moderationReports)
      .set({
        totalVotes: Math.round(totalVotes),
        removeVotes: Math.round(removeVotes),
        keepVotes: Math.round(keepVotes),
        reviewVotes: Math.round(reviewVotes),
        updatedAt: new Date(),
      })
      .where(eq(moderationReports.id, reportId));

    // Check if voting threshold reached and process result
    await this.processVoteResult(reportId);
  }

  // User reputation
  async getUserModerationReputation(userId: string): Promise<UserModerationReputation | undefined> {
    const [reputation] = await db
      .select()
      .from(userModerationReputation)
      .where(eq(userModerationReputation.userId, userId));
    return reputation;
  }

  async createUserModerationReputation(
    reputationData: InsertUserModerationReputation
  ): Promise<UserModerationReputation> {
    const [reputation] = await db
      .insert(userModerationReputation)
      .values(reputationData)
      .returning();
    return reputation;
  }

  async updateUserModerationReputation(
    userId: string,
    updates: Partial<UserModerationReputation>
  ): Promise<UserModerationReputation> {
    const [reputation] = await db
      .update(userModerationReputation)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(userModerationReputation.userId, userId))
      .returning();
    return reputation;
  }

  async suspendUser(userId: string): Promise<void> {
    const existing = await this.getUserModerationReputation(userId);
    if (existing) {
      await this.updateUserModerationReputation(userId, {
        isSuspended: true,
        suspendedUntil: null,
        suspensionReason: existing.suspensionReason || "Admin suspension",
      } as any);
    } else {
      await this.createUserModerationReputation({
        userId,
        canVote: true,
        votingPower: "1.0" as any,
        primaryCounty: null,
        primaryState: null,
      } as any);
      await this.updateUserModerationReputation(userId, {
        isSuspended: true,
        suspendedUntil: null,
        suspensionReason: "Admin suspension",
      } as any);
    }
  }

  async unsuspendUser(userId: string): Promise<void> {
    const existing = await this.getUserModerationReputation(userId);
    if (!existing) return;
    await this.updateUserModerationReputation(userId, {
      isSuspended: false,
      suspendedUntil: null,
      suspensionReason: null as any,
    } as any);
  }

  async verifyUser(userId: string): Promise<void> {
    await db
      .update(users)
      .set({ verificationStatus: "approved" as any, addressVerified: true })
      .where(eq(users.id, userId));
  }

  async revokeVerifyUser(userId: string): Promise<void> {
    await db
      .update(users)
      .set({ verificationStatus: "pending" as any })
      .where(eq(users.id, userId));
  }

  async changeUserRole(userId: string, newRole: string): Promise<void> {
    await db
      .update(users)
      .set({ role: newRole as any, activeRole: newRole })
      .where(eq(users.id, userId));
  }

  // Actions
  async createModerationAction(actionData: InsertModerationAction): Promise<ModerationAction> {
    const [action] = await db.insert(moderationActions).values(actionData).returning();
    return action;
  }

  async getModerationActions(contentType: string, contentId: string): Promise<ModerationAction[]> {
    const contentTypes = moderationActions.contentType.enumValues ?? [];
    if (!contentTypes.includes(contentType as any)) {
      return [];
    }

    return await db
      .select()
      .from(moderationActions)
      .where(
        and(
          eq(moderationActions.contentType, contentType as (typeof contentTypes)[number]),
          eq(moderationActions.contentId, contentId)
        )
      )
      .orderBy(desc(moderationActions.createdAt));
  }

  // Appeals
  async createModerationAppeal(appealData: InsertModerationAppeal): Promise<ModerationAppeal> {
    const [appeal] = await db.insert(moderationAppeals).values(appealData).returning();
    return appeal;
  }

  async getModerationAppeal(id: string): Promise<ModerationAppeal | undefined> {
    const [appeal] = await db.select().from(moderationAppeals).where(eq(moderationAppeals.id, id));
    return appeal;
  }

  async getAppealsByUser(userId: string): Promise<ModerationAppeal[]> {
    return await db
      .select()
      .from(moderationAppeals)
      .where(eq(moderationAppeals.appellantId, userId))
      .orderBy(desc(moderationAppeals.createdAt));
  }

  async updateModerationAppeal(
    id: string,
    updates: Partial<ModerationAppeal>
  ): Promise<ModerationAppeal> {
    const [appeal] = await db
      .update(moderationAppeals)
      .set(updates)
      .where(eq(moderationAppeals.id, id))
      .returning();
    return appeal;
  }

  // Settings
  async getModerationSettings(
    county?: string,
    state?: string
  ): Promise<ModerationSettings | undefined> {
    let whereClause: SQL = sql`true`;

    if (county && state) {
      whereClause =
        and(
          eq(moderationSettings.county, county),
          eq(moderationSettings.state, state),
          eq(moderationSettings.isActive, true)
        ) ?? sql`true`;
    } else if (state) {
      whereClause =
        and(
          eq(moderationSettings.state, state),
          eq(moderationSettings.isStatewide, true),
          eq(moderationSettings.isActive, true)
        ) ?? sql`true`;
    } else {
      whereClause =
        and(
          isNull(moderationSettings.county),
          isNull(moderationSettings.state),
          eq(moderationSettings.isActive, true)
        ) ?? sql`true`;
    }

    const [settings] = await db.select().from(moderationSettings).where(whereClause).limit(1);

    return settings;
  }

  async createModerationSettings(
    settingsData: InsertModerationSettings
  ): Promise<ModerationSettings> {
    const [settings] = await db.insert(moderationSettings).values(settingsData).returning();
    return settings;
  }

  async updateModerationSettings(
    id: string,
    updates: Partial<ModerationSettings>
  ): Promise<ModerationSettings> {
    const [settings] = await db
      .update(moderationSettings)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(moderationSettings.id, id))
      .returning();
    return settings;
  }

  // Utility methods
  async canUserVoteOnReport(userId: string, reportId: string): Promise<boolean> {
    // Check if user already voted
    const existingVote = await this.getModerationVote(reportId, userId);
    if (existingVote) {
      return false;
    }

    // Check user's moderation reputation
    const reputation = await this.getUserModerationReputation(userId);
    if (!reputation || !reputation.canVote || reputation.isSuspended) {
      return false;
    }

    // Check if user is the content owner or reporter
    const report = await this.getModerationReport(reportId);
    if (!report) {
      return false;
    }

    if (report.contentOwnerId === userId || report.reporterId === userId) {
      return false;
    }

    // Check account age and verification requirements
    const user = await this.getUser(userId);
    if (!user) {
      return false;
    }

    const settings = await this.getModerationSettings(
      report.contentCounty || undefined,
      report.contentState || undefined
    );

    if (settings?.requiresAddressVerification && !user.addressVerified) {
      return false;
    }

    // Check account age (minimum days)
    const createdAt = user.createdAt ?? new Date();
    const accountAgeDays = Math.floor(
      (Date.now() - new Date(createdAt).getTime()) / (1000 * 60 * 60 * 24)
    );

    if (accountAgeDays < (settings?.minAccountAge || 30)) {
      return false;
    }

    return true;
  }

  async calculateLocalVoterWeight(
    voterCounty: string,
    voterState: string,
    contentCounty: string,
    contentState: string
  ): Promise<number> {
    // Same county gets highest weight
    if (voterCounty === contentCounty && voterState === contentState) {
      return 1.5;
    }

    // Same state gets moderate weight
    if (voterState === contentState) {
      return 1.2;
    }

    // Different state gets base weight
    return 1.0;
  }

  async processVoteResult(reportId: string): Promise<void> {
    const report = await this.getModerationReport(reportId);
    if (!report || report.status !== "pending") {
      return;
    }

    // Check if minimum votes reached
    const totalVotes = report.totalVotes ?? 0;
    const votesRequired = report.votesRequired ?? 0;

    if (totalVotes < votesRequired) {
      return;
    }

    const removalThreshold = parseFloat(report.removalThreshold || "0.60");
    const removalPercentage = totalVotes > 0 ? (report.removeVotes ?? 0) / totalVotes : 0;

    let finalAction: ModerationReport["finalAction"] | undefined;
    const actionTakenBy = "community_vote";

    if (removalPercentage >= removalThreshold) {
      finalAction = "content_removed";

      // Create moderation action
      await this.createModerationAction({
        reportId: report.id,
        contentType: report.contentType,
        contentId: report.contentId,
        contentOwnerId: report.contentOwnerId,
        action: "removed",
        actionBy: "community_vote",
        reason: `Content removed by community vote (${Math.round(removalPercentage * 100)}% removal votes)`,
        isReversible: true,
        canAppeal: true,
        appealDeadline: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
      });
    } else if (totalVotes > 0 && (report.reviewVotes ?? 0) / totalVotes >= 0.3) {
      // If 30% or more votes are "needs review", escalate to moderators
      finalAction = "content_flagged";
      await this.updateModerationReport(reportId, {
        status: "escalated",
      });
      return;
    } else {
      finalAction = "no_action";
    }

    // Update report with final result
    await this.updateModerationReport(reportId, {
      status: "resolved",
      finalAction: finalAction || "no_action",
      actionTakenBy,
      actionReason: `Community vote completed: ${report.removeVotes ?? 0}/${totalVotes} removal votes (${Math.round(removalPercentage * 100)}%)`,
      resolvedAt: new Date(),
    });
  }

  // Invitation system implementation
  async createInvitation(invitationData: InsertInvitation): Promise<Invitation> {
    const [invitation] = await db.insert(invitations).values(invitationData).returning();
    return invitation;
  }

  async getInvitation(id: string): Promise<Invitation | undefined> {
    const [invitation] = await db.select().from(invitations).where(eq(invitations.id, id));
    return invitation;
  }

  async getInvitationByCode(code: string): Promise<Invitation | undefined> {
    const [invitation] = await db
      .select()
      .from(invitations)
      .where(eq(invitations.invitationCode, code));
    return invitation;
  }

  async getUserInvitations(userId: string): Promise<Invitation[]> {
    return await db
      .select()
      .from(invitations)
      .where(eq(invitations.inviterId, userId))
      .orderBy(desc(invitations.createdAt));
  }

  async updateInvitation(id: string, updates: Partial<Invitation>): Promise<Invitation> {
    const [invitation] = await db
      .update(invitations)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(invitations.id, id))
      .returning();
    return invitation;
  }

  async acceptInvitation(code: string, userId: string): Promise<Invitation> {
    const [invitation] = await db
      .update(invitations)
      .set({
        status: "accepted",
        inviteeId: userId,
        acceptedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(invitations.invitationCode, code))
      .returning();
    return invitation;
  }

  async expireOldInvitations(): Promise<void> {
    const expiryDate = new Date();
    expiryDate.setDate(expiryDate.getDate() - 30); // Expire after 30 days

    await db
      .update(invitations)
      .set({ status: "expired", updatedAt: new Date() })
      .where(and(eq(invitations.status, "pending"), lt(invitations.createdAt, expiryDate)));
  }

  async generateInvitationCode(): Promise<string> {
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    let code = "";
    let exists = true;

    while (exists) {
      code = "";
      for (let i = 0; i < 8; i++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length));
      }

      const existingInvitation = await this.getInvitationByCode(code);
      exists = !!existingInvitation;
    }

    return code;
  }

  async generateUserReferralCode(userId: string): Promise<string> {
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    let code = "";
    let exists = true;

    while (exists) {
      code = "";
      for (let i = 0; i < 6; i++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length));
      }

      const [existingUser] = await db.select().from(users).where(eq(users.referralCode, code));
      exists = !!existingUser;
    }

    // Update user with referral code
    await this.updateUser(userId, { referralCode: code });
    return code;
  }

  // Referral stats implementation
  async getReferralStats(userId: string): Promise<ReferralStats | undefined> {
    const [stats] = await db.select().from(referralStats).where(eq(referralStats.userId, userId));
    return stats;
  }

  async createReferralStats(statsData: InsertReferralStats): Promise<ReferralStats> {
    const [stats] = await db.insert(referralStats).values(statsData).returning();
    return stats;
  }

  async updateReferralStats(
    userId: string,
    updates: Partial<ReferralStats>
  ): Promise<ReferralStats> {
    const [stats] = await db
      .update(referralStats)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(referralStats.userId, userId))
      .returning();
    return stats;
  }

  async incrementInvitationsSent(userId: string): Promise<void> {
    const existingStats = await this.getReferralStats(userId);

    if (existingStats) {
      await this.updateReferralStats(userId, {
        totalInvitationsSent: (existingStats.totalInvitationsSent || 0) + 1,
      });
    } else {
      await this.createReferralStats({
        userId,
        totalInvitationsSent: 1,
        totalInvitationsAccepted: 0,
        contractorsReferred: 0,
        homeownersReferred: 0,
      });
    }
  }

  async incrementInvitationsAccepted(
    userId: string,
    targetRole: "homeowner" | "contractor"
  ): Promise<void> {
    const existingStats = await this.getReferralStats(userId);

    if (existingStats) {
      const updates: Partial<ReferralStats> = {
        totalInvitationsAccepted: (existingStats.totalInvitationsAccepted || 0) + 1,
      };

      if (targetRole === "contractor") {
        updates.contractorsReferred = (existingStats.contractorsReferred || 0) + 1;
      } else {
        updates.homeownersReferred = (existingStats.homeownersReferred || 0) + 1;
      }

      await this.updateReferralStats(userId, updates);
    } else {
      await this.createReferralStats({
        userId,
        totalInvitationsSent: 0,
        totalInvitationsAccepted: 1,
        contractorsReferred: targetRole === "contractor" ? 1 : 0,
        homeownersReferred: targetRole === "homeowner" ? 1 : 0,
      });
    }
  }

  async getTopReferrers(limit: number): Promise<(ReferralStats & { user: User })[]> {
    const result = await db
      .select({
        ...getTableColumns(referralStats),
        user: {
          id: users.id,
          email: users.email,
          firstName: users.firstName,
          lastName: users.lastName,
          profileImageUrl: users.profileImageUrl,
          role: users.role,
          createdAt: users.createdAt,
          updatedAt: users.updatedAt,
        },
      })
      .from(referralStats)
      .innerJoin(users, eq(referralStats.userId, users.id))
      .orderBy(desc(referralStats.totalInvitationsAccepted))
      .limit(limit);

    return result.map((row: any) => ({
      ...(row as ReferralStats),
      user: row.user as User,
    }));
  }

  // Professional Profile Methods

  async createRealtorProfile(profile: InsertRealtorProfile): Promise<RealtorProfile> {
    const normalizedProfile: InsertRealtorProfile = {
      ...profile,
      specializations: this.coerceStringArray((profile as any).specializations) as any,
    };
    const [newProfile] = await db
      .insert(realtorProfiles)
      .values(normalizedProfile as any)
      .returning();
    return newProfile;
  }

  async getRealtorProfile(id: string): Promise<RealtorProfile | undefined> {
    const [profile] = await db.select().from(realtorProfiles).where(eq(realtorProfiles.id, id));
    return profile;
  }

  async getRealtorProfileByUserId(userId: string): Promise<RealtorProfile | undefined> {
    const [profile] = await db
      .select()
      .from(realtorProfiles)
      .where(eq(realtorProfiles.userId, userId));
    return profile;
  }

  async updateRealtorProfile(
    id: string,
    profileData: Partial<RealtorProfile>
  ): Promise<RealtorProfile> {
    const [updated] = await db
      .update(realtorProfiles)
      .set({ ...profileData, updatedAt: new Date() })
      .where(eq(realtorProfiles.id, id))
      .returning();
    return updated;
  }

  async createCarSalesmanProfile(profile: InsertCarSalesmanProfile): Promise<CarSalesmanProfile> {
    const normalizedProfile: InsertCarSalesmanProfile = {
      ...profile,
      specializations: this.coerceStringArray((profile as any).specializations) as any,
      brandsSpecialty: this.coerceStringArray((profile as any).brandsSpecialty) as any,
    };
    const [newProfile] = await db
      .insert(carSalesmanProfiles)
      .values(normalizedProfile as any)
      .returning();
    return newProfile;
  }

  async getCarSalesmanProfile(id: string): Promise<CarSalesmanProfile | undefined> {
    const [profile] = await db
      .select()
      .from(carSalesmanProfiles)
      .where(eq(carSalesmanProfiles.id, id));
    return profile;
  }

  async getCarSalesmanProfileByUserId(userId: string): Promise<CarSalesmanProfile | undefined> {
    const [profile] = await db
      .select()
      .from(carSalesmanProfiles)
      .where(eq(carSalesmanProfiles.userId, userId));
    return profile;
  }

  async updateCarSalesmanProfile(
    id: string,
    profileData: Partial<CarSalesmanProfile>
  ): Promise<CarSalesmanProfile> {
    const [updated] = await db
      .update(carSalesmanProfiles)
      .set({ ...profileData, updatedAt: new Date() })
      .where(eq(carSalesmanProfiles.id, id))
      .returning();
    return updated;
  }

  async updateUserRole(userId: string, role: "realtor" | "car_dealer"): Promise<void> {
    await db.update(users).set({ role, updatedAt: new Date() }).where(eq(users.id, userId));
  }

  async getPendingRealtorApplications(): Promise<(RealtorProfile & { user: User })[]> {
    const result = await db
      .select({
        id: realtorProfiles.id,
        userId: realtorProfiles.userId,
        licenseNumber: realtorProfiles.licenseNumber,
        brokerageName: realtorProfiles.brokerageName,
        mlsId: realtorProfiles.mlsId,
        specializations: realtorProfiles.specializations,
        yearsExperience: realtorProfiles.yearsExperience,
        transactionsCompleted: realtorProfiles.transactionsCompleted,
        averageTransactionValue: realtorProfiles.averageTransactionValue,
        serviceAreas: realtorProfiles.serviceAreas,
        licenseState: realtorProfiles.licenseState,
        licenseExpiration: realtorProfiles.licenseExpiration,
        verificationStatus: realtorProfiles.verificationStatus,
        verificationDocuments: realtorProfiles.verificationDocuments,
        isActive: realtorProfiles.isActive,
        createdAt: realtorProfiles.createdAt,
        updatedAt: realtorProfiles.updatedAt,
        user: {
          id: users.id,
          email: users.email,
          firstName: users.firstName,
          lastName: users.lastName,
          profileImageUrl: users.profileImageUrl,
          role: users.role,
          createdAt: users.createdAt,
        },
      })
      .from(realtorProfiles)
      .innerJoin(users, eq(realtorProfiles.userId, users.id))
      .where(eq(realtorProfiles.verificationStatus, "pending"));

    return result.map((row: any) => ({
      ...row,
      user: row.user as User,
    }));
  }

  async getPendingCarSalesmanApplications(): Promise<(CarSalesmanProfile & { user: User })[]> {
    const result = await db
      .select({
        id: carSalesmanProfiles.id,
        userId: carSalesmanProfiles.userId,
        dealershipName: carSalesmanProfiles.dealershipName,
        dealerLicense: carSalesmanProfiles.dealerLicense,
        salesmanLicense: carSalesmanProfiles.salesmanLicense,
        specializations: carSalesmanProfiles.specializations,
        yearsExperience: carSalesmanProfiles.yearsExperience,
        vehiclesSold: carSalesmanProfiles.vehiclesSold,
        averageVehicleValue: carSalesmanProfiles.averageVehicleValue,
        brandsSpecialty: carSalesmanProfiles.brandsSpecialty,
        serviceAreas: carSalesmanProfiles.serviceAreas,
        licenseState: carSalesmanProfiles.licenseState,
        licenseExpiration: carSalesmanProfiles.licenseExpiration,
        verificationStatus: carSalesmanProfiles.verificationStatus,
        verificationDocuments: carSalesmanProfiles.verificationDocuments,
        isActive: carSalesmanProfiles.isActive,
        createdAt: carSalesmanProfiles.createdAt,
        updatedAt: carSalesmanProfiles.updatedAt,
        user: {
          id: users.id,
          email: users.email,
          firstName: users.firstName,
          lastName: users.lastName,
          profileImageUrl: users.profileImageUrl,
          role: users.role,
          createdAt: users.createdAt,
        },
      })
      .from(carSalesmanProfiles)
      .innerJoin(users, eq(carSalesmanProfiles.userId, users.id))
      .where(eq(carSalesmanProfiles.verificationStatus, "pending"));

    return result.map((row: any) => ({
      ...row,
      user: row.user as User,
    }));
  }

  async updateRealtorVerificationStatus(
    profileId: string,
    verificationData: {
      approved: boolean;
      notes: string;
      reviewedBy: string;
      reviewedAt: Date;
    }
  ): Promise<RealtorProfile> {
    const [updatedProfile] = await db
      .update(realtorProfiles)
      .set({
        verificationStatus: verificationData.approved ? "approved" : "rejected",
        updatedAt: new Date(),
      })
      .where(eq(realtorProfiles.id, profileId))
      .returning();
    return updatedProfile;
  }

  async updateCarSalesmanVerificationStatus(
    profileId: string,
    verificationData: {
      approved: boolean;
      notes: string;
      reviewedBy: string;
      reviewedAt: Date;
    }
  ): Promise<CarSalesmanProfile> {
    const [updatedProfile] = await db
      .update(carSalesmanProfiles)
      .set({
        verificationStatus: verificationData.approved ? "approved" : "rejected",
        updatedAt: new Date(),
      })
      .where(eq(carSalesmanProfiles.id, profileId))
      .returning();
    return updatedProfile;
  }

  // Marketplace conversation operations
  async createMarketplaceConversation(
    data: InsertMarketplaceConversation
  ): Promise<MarketplaceConversation> {
    const [conversation] = await db.insert(marketplaceConversations).values(data).returning();
    return conversation;
  }

  async getMarketplaceConversation(id: string): Promise<MarketplaceConversation | undefined> {
    const [conversation] = await db
      .select()
      .from(marketplaceConversations)
      .where(eq(marketplaceConversations.id, id));
    return conversation;
  }

  async getMarketplaceConversationByParticipants(
    listingId: string,
    buyerId: string,
    sellerId: string
  ): Promise<MarketplaceConversation | undefined> {
    const [conversation] = await db
      .select()
      .from(marketplaceConversations)
      .where(
        and(
          eq(marketplaceConversations.listingId, listingId),
          eq(marketplaceConversations.buyerId, buyerId),
          eq(marketplaceConversations.sellerId, sellerId)
        )
      );
    return conversation;
  }

  async getUserMarketplaceConversations(userId: string): Promise<any> {
    const conversationsData = await db
      .select({
        conversation: marketplaceConversations,
        listing: {
          id: marketplaceListings.id,
          title: marketplaceListings.title,
          price: marketplaceListings.price,
          images: marketplaceListings.images,
          status: marketplaceListings.status,
          categoryName: marketplaceCategories.name,
        },
      })
      .from(marketplaceConversations)
      .leftJoin(marketplaceListings, eq(marketplaceConversations.listingId, marketplaceListings.id))
      .leftJoin(marketplaceCategories, eq(marketplaceListings.categoryId, marketplaceCategories.id))
      .where(
        or(
          eq(marketplaceConversations.buyerId, userId),
          eq(marketplaceConversations.sellerId, userId)
        )
      )
      .orderBy(desc(marketplaceConversations.lastMessageAt));

    const userIds: string[] = Array.from(
      new Set<string>(
        conversationsData.flatMap(({ conversation }: any) => [
          String(conversation.buyerId || ""),
          String(conversation.sellerId || ""),
        ])
      )
    ).filter((value): value is string => value.length > 0);
    const usersLookup = userIds.length
      ? await db
          .select()
          .from(users)
          .where(inArray(users.id, userIds as string[]))
      : [];
    const userMap = new Map<string, any>(usersLookup.map((u: any) => [String(u.id), u]));
    const toParticipant = (participantUserId: string) => {
      const raw = userMap.get(participantUserId);
      if (!raw) {
        return {
          id: participantUserId,
          firstName: "TradeScout",
          lastName: "Member",
          profileImageUrl: null,
        };
      }

      return {
        id: raw.id,
        firstName: raw.firstName || null,
        lastName: raw.lastName || null,
        profileImageUrl: raw.profileImageUrl || null,
      };
    };

    // Get last message and unread count for each conversation
    const conversationsWithDetails = await Promise.all(
      conversationsData.map(async (conv: any) => {
        const [lastMessage] = await db
          .select()
          .from(marketplaceMessages)
          .where(eq(marketplaceMessages.conversationId, conv.conversation.id))
          .orderBy(desc(marketplaceMessages.createdAt))
          .limit(1);

        const [unreadCount] = await db
          .select({ count: sql<number>`count(*)` })
          .from(marketplaceMessages)
          .where(
            and(
              eq(marketplaceMessages.conversationId, conv.conversation.id),
              ne(marketplaceMessages.senderId, userId),
              isNull(marketplaceMessages.readAt)
            )
          );

        return {
          ...conv.conversation,
          listing: conv.listing,
          buyer: toParticipant(conv.conversation.buyerId),
          seller: toParticipant(conv.conversation.sellerId),
          lastMessage,
          unreadCount: unreadCount?.count || 0,
        };
      })
    );

    return conversationsWithDetails;
  }

  async createMarketplaceMessage(data: InsertMarketplaceMessage): Promise<MarketplaceMessage> {
    const [message] = await db.insert(marketplaceMessages).values(data).returning();

    // Update conversation's lastMessageAt
    await db
      .update(marketplaceConversations)
      .set({
        lastMessageAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(marketplaceConversations.id, data.conversationId));

    return message;
  }

  async getMarketplaceMessages(conversationId: string): Promise<MarketplaceMessage[]> {
    const messages = await db
      .select()
      .from(marketplaceMessages)
      .where(eq(marketplaceMessages.conversationId, conversationId))
      .orderBy(asc(marketplaceMessages.createdAt));

    return messages;
  }

  async markMarketplaceMessagesAsRead(conversationId: string, userId: string): Promise<void> {
    await db
      .update(marketplaceMessages)
      .set({ readAt: new Date() })
      .where(
        and(
          eq(marketplaceMessages.conversationId, conversationId),
          ne(marketplaceMessages.senderId, userId),
          isNull(marketplaceMessages.readAt)
        )
      );

    // Update read status in conversation
    const conversation = await this.getMarketplaceConversation(conversationId);
    if (conversation) {
      const updateData: any = { updatedAt: new Date() };
      if (conversation.buyerId === userId) {
        updateData.isReadByBuyer = true;
      } else if (conversation.sellerId === userId) {
        updateData.isReadBySeller = true;
      }

      await db
        .update(marketplaceConversations)
        .set(updateData)
        .where(eq(marketplaceConversations.id, conversationId));
    }
  }

  // Advanced marketplace transaction operations
  async createMarketplaceTransaction(
    transaction: InsertMarketplaceTransaction
  ): Promise<MarketplaceTransaction> {
    const [newTransaction] = await db
      .insert(marketplaceTransactions)
      .values(transaction)
      .returning();
    return newTransaction;
  }

  async getMarketplaceTransaction(id: string): Promise<MarketplaceTransaction | undefined> {
    const [transaction] = await db
      .select()
      .from(marketplaceTransactions)
      .where(eq(marketplaceTransactions.id, id));
    return transaction;
  }

  async getMarketplaceTransactionsByUser(
    userId: string,
    role: "buyer" | "seller"
  ): Promise<MarketplaceTransaction[]> {
    const column =
      role === "buyer" ? marketplaceTransactions.buyerId : marketplaceTransactions.sellerId;
    return await db
      .select()
      .from(marketplaceTransactions)
      .where(eq(column, userId))
      .orderBy(desc(marketplaceTransactions.createdAt));
  }

  async updateMarketplaceTransaction(
    id: string,
    updates: Partial<MarketplaceTransaction>
  ): Promise<MarketplaceTransaction> {
    const [transaction] = await db
      .update(marketplaceTransactions)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(marketplaceTransactions.id, id))
      .returning();
    return transaction;
  }

  // Listing boost operations
  async createListingBoost(boost: InsertListingBoost): Promise<ListingBoost> {
    const [newBoost] = await db
      .insert(listingBoosts)
      .values(boost as any)
      .returning();
    return newBoost as ListingBoost;
  }

  async getListingBoostByTransactionId(transactionId: string): Promise<ListingBoost | undefined> {
    const [boost] = await db
      .select()
      .from(listingBoosts)
      .where(eq(listingBoosts.transactionId, transactionId));
    return boost as ListingBoost | undefined;
  }

  async applyListingBoostForTransaction(transactionId: string): Promise<void> {
    const boost = await this.getListingBoostByTransactionId(transactionId);
    if (!boost) return;

    // If already active and not expired, do nothing
    if (boost.status === "active" && boost.endDate && boost.endDate > new Date()) {
      return;
    }

    const now = new Date();
    const endDate = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

    await db.transaction(async (tx) => {
      await tx
        .update(listingBoosts)
        .set({
          status: "active",
          startDate: now,
          endDate,
          updatedAt: now,
        } as any)
        .where(eq(listingBoosts.id, boost.id));

      await tx
        .update(marketplaceListings)
        .set({
          isPromoted: true,
          promotedUntil: endDate,
          updatedAt: now,
        } as any)
        .where(eq(marketplaceListings.id, boost.listingId));
    });
  }

  // Transaction dispute operations
  async createTransactionDispute(dispute: InsertTransactionDispute): Promise<TransactionDispute> {
    const [newDispute] = await db.insert(transactionDisputes).values(dispute).returning();
    return newDispute;
  }

  async getTransactionDispute(id: string): Promise<TransactionDispute | undefined> {
    const [dispute] = await db
      .select()
      .from(transactionDisputes)
      .where(eq(transactionDisputes.id, id));
    return dispute;
  }

  async getTransactionDisputes(transactionId?: string): Promise<TransactionDispute[]> {
    if (transactionId) {
      return await db
        .select()
        .from(transactionDisputes)
        .where(eq(transactionDisputes.transactionId, transactionId));
    }
    return await db.select().from(transactionDisputes).orderBy(desc(transactionDisputes.createdAt));
  }

  async updateTransactionDispute(
    id: string,
    updates: Partial<TransactionDispute>
  ): Promise<TransactionDispute> {
    const [dispute] = await db
      .update(transactionDisputes)
      .set(updates as any)
      .where(eq(transactionDisputes.id, id))
      .returning();
    return dispute;
  }

  // User review operations
  async createUserReview(review: InsertUserReview): Promise<UserReview> {
    const [newReview] = await db.insert(userReviews).values(review).returning();
    return newReview;
  }

  async getUserReviews(userId: string, role: "reviewer" | "reviewee"): Promise<UserReview[]> {
    const column = role === "reviewer" ? userReviews.reviewerId : userReviews.revieweeId;
    return await db
      .select()
      .from(userReviews)
      .where(eq(column, userId))
      .orderBy(desc(userReviews.createdAt));
  }

  async getUserRatings(userId: string): Promise<{ count: number; average: number }> {
    const result = await db
      .select({
        count: sql<number>`count(*)::int`,
        average: sql<number>`avg(${userReviews.rating})::float`,
      })
      .from(userReviews)
      .where(eq(userReviews.revieweeId, userId));

    return {
      count: result[0]?.count || 0,
      average: result[0]?.average || 0,
    };
  }

  // Real-time notification operations
  async createRealTimeNotification(
    notification: InsertRealTimeNotification
  ): Promise<RealTimeNotification> {
    const [newNotification] = await db
      .insert(realTimeNotifications)
      .values(notification)
      .returning();
    return newNotification;
  }

  async getUserRealTimeNotifications(
    userId: string,
    unreadOnly?: boolean
  ): Promise<RealTimeNotification[]> {
    const conditions: SQL[] = [eq(realTimeNotifications.userId, userId)];
    if (unreadOnly) {
      conditions.push(eq(realTimeNotifications.isRead, false));
    }

    return await db
      .select()
      .from(realTimeNotifications)
      .where(and(...conditions) ?? sql`true`)
      .orderBy(desc(realTimeNotifications.createdAt));
  }

  async markRealTimeNotificationAsRead(id: string): Promise<RealTimeNotification> {
    const [notification] = await db
      .update(realTimeNotifications)
      .set({ isRead: true })
      .where(eq(realTimeNotifications.id, id))
      .returning();
    return notification;
  }

  async markAllRealTimeNotificationsAsRead(userId: string): Promise<void> {
    await db
      .update(realTimeNotifications)
      .set({ isRead: true })
      .where(
        and(eq(realTimeNotifications.userId, userId), eq(realTimeNotifications.isRead, false))
      );
  }

  // Search and discovery operations
  async createSavedSearch(search: InsertSavedSearch): Promise<SavedSearch> {
    const [newSearch] = await db.insert(savedSearches).values(search).returning();
    return newSearch;
  }

  async getUserSavedSearches(userId: string): Promise<SavedSearch[]> {
    return await db
      .select()
      .from(savedSearches)
      .where(eq(savedSearches.userId, userId))
      .orderBy(desc(savedSearches.createdAt));
  }

  async listSavedSearchesForAlerts(params: {
    searchType: string;
    limit?: number;
    offset?: number;
  }): Promise<SavedSearch[]> {
    const limit = Math.max(1, Math.min(500, Number(params.limit ?? 200)));
    const offset = Math.max(0, Number(params.offset ?? 0));
    return await db
      .select()
      .from(savedSearches)
      .where(
        and(eq(savedSearches.searchType, params.searchType), eq(savedSearches.alertsEnabled, true))
      )
      .orderBy(asc(savedSearches.createdAt))
      .limit(limit)
      .offset(offset);
  }

  async touchSavedSearchLastNotified(params: { id: string; at: Date }): Promise<void> {
    await db
      .update(savedSearches)
      .set({ lastNotified: params.at })
      .where(eq(savedSearches.id, params.id));
  }

  async deleteSavedSearch(id: string): Promise<void> {
    await db.delete(savedSearches).where(eq(savedSearches.id, id));
  }

  async logSearchAnalytics(analytics: InsertSearchAnalytics): Promise<SearchAnalytics> {
    const [newAnalytics] = await db.insert(searchAnalytics).values(analytics).returning();
    return newAnalytics;
  }

  // Platform analytics operations
  async updatePlatformAnalytics(
    date: Date,
    updates: Partial<InsertPlatformAnalytics>
  ): Promise<PlatformAnalytics> {
    const { date: _ignored, ...restUpdates } = (updates ?? {}) as any;
    void _ignored;
    const [analytics] = await db
      .insert(platformAnalytics)
      .values({
        ...restUpdates,
        date,
      })
      .onConflictDoUpdate({
        target: platformAnalytics.date,
        set: restUpdates,
      })
      .returning();
    return analytics;
  }

  async getPlatformAnalytics(fromDate: Date, toDate: Date): Promise<PlatformAnalytics[]> {
    return await db
      .select()
      .from(platformAnalytics)
      .where(and(gte(platformAnalytics.date, fromDate), lte(platformAnalytics.date, toDate)))
      .orderBy(asc(platformAnalytics.date));
  }

  // Enhanced marketplace conversation operations
  async getMarketplaceConversationByListing(
    listingId: string,
    buyerId: string
  ): Promise<MarketplaceConversation | undefined> {
    const [conversation] = await db
      .select()
      .from(marketplaceConversations)
      .where(
        and(
          eq(marketplaceConversations.listingId, listingId),
          eq(marketplaceConversations.buyerId, buyerId)
        )
      );
    return conversation;
  }

  async markMarketplaceMessageAsRead(id: string): Promise<MarketplaceMessage> {
    const [message] = await db
      .update(marketplaceMessages)
      .set({ readAt: new Date() })
      .where(eq(marketplaceMessages.id, id))
      .returning();
    return message;
  }

  // Payment system operations
  async createPaymentConfiguration(
    config: InsertPaymentConfiguration
  ): Promise<PaymentConfiguration> {
    const normalizedConfig: InsertPaymentConfiguration = {
      ...config,
      offPlatformPaymentMethods: this.coerceStringArray(
        (config as any).offPlatformPaymentMethods
      ) as any,
    };
    const [newConfig] = await db
      .insert(paymentConfigurations)
      .values(normalizedConfig as any)
      .returning();
    return newConfig;
  }

  async getPaymentConfiguration(
    configType: typeof paymentConfigurations.configType.enumValues extends readonly (infer T)[]
      ? T
      : string
  ): Promise<PaymentConfiguration | undefined> {
    const configTypes = paymentConfigurations.configType.enumValues ?? [];
    if (!configTypes.includes(configType as any)) {
      return undefined;
    }

    const [config] = await db
      .select()
      .from(paymentConfigurations)
      .where(
        and(
          eq(paymentConfigurations.configType, configType),
          eq(paymentConfigurations.isActive, true)
        )
      )
      .orderBy(desc(paymentConfigurations.createdAt));
    return config;
  }

  async updatePaymentConfiguration(
    id: string,
    updates: Partial<InsertPaymentConfiguration>
  ): Promise<PaymentConfiguration> {
    const normalizedUpdates: Partial<InsertPaymentConfiguration> = {
      ...updates,
      offPlatformPaymentMethods: this.coerceStringArray(
        (updates as any).offPlatformPaymentMethods
      ) as any,
    };
    const [config] = await db
      .update(paymentConfigurations)
      .set({ ...normalizedUpdates, updatedAt: new Date() } as any)
      .where(eq(paymentConfigurations.id, id))
      .returning();
    return config;
  }

  // Contractor payment operations
  async createContractorPayment(payment: InsertContractorPayment): Promise<ContractorPayment> {
    const normalizedPayment: InsertContractorPayment = {
      ...payment,
      milestones: this.coerceContractorMilestones((payment as any).milestones) as any,
      workPhotos: this.coerceStringArray((payment as any).workPhotos) as any,
    };
    const [newPayment] = await db
      .insert(contractorPayments)
      .values(normalizedPayment as any)
      .returning();
    return newPayment;
  }

  async getContractorPayment(id: string): Promise<ContractorPayment | undefined> {
    const [payment] = await db
      .select()
      .from(contractorPayments)
      .where(eq(contractorPayments.id, id));
    return payment;
  }

  async getContractorPaymentsByHomeowner(homeownerId: string): Promise<ContractorPayment[]> {
    return await db
      .select()
      .from(contractorPayments)
      .where(eq(contractorPayments.homeownerId, homeownerId))
      .orderBy(desc(contractorPayments.createdAt));
  }

  async getContractorPaymentsByContractor(contractorId: string): Promise<ContractorPayment[]> {
    return await db
      .select()
      .from(contractorPayments)
      .where(eq(contractorPayments.contractorId, contractorId))
      .orderBy(desc(contractorPayments.createdAt));
  }

  async updateContractorPayment(
    id: string,
    updates: Partial<ContractorPayment>
  ): Promise<ContractorPayment> {
    const [payment] = await db
      .update(contractorPayments)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(contractorPayments.id, id))
      .returning();
    return payment;
  }

  // Enhanced marketplace transaction operations
  async updateMarketplaceTransactionPayment(
    id: string,
    updates: {
      paymentMethod: string;
      isOffPlatform: boolean;
      offPlatformMethod?: string;
      offPlatformNotes?: string;
      processingFee?: string;
      buyerFeeShare?: string;
      sellerFeeShare?: string;
      stripePaymentIntentId?: string;
      status?: string;
    }
  ): Promise<MarketplaceTransaction> {
    const setValues: any = {
      ...updates,
      paymentMethod: updates.paymentMethod as any,
      status: updates.status as any,
      updatedAt: new Date(),
      ...(updates.status === "completed" ? { completedAt: new Date() } : {}),
    };

    const [transaction] = await db
      .update(marketplaceTransactions)
      .set(setValues)
      .where(eq(marketplaceTransactions.id, id))
      .returning();
    return transaction;
  }

  // ==================== FOUNDATION SYSTEM METHODS ====================

  // Foundation causes
  async getFoundationCauses(filters?: {
    category?: string;
    countyId?: string;
    isActive?: boolean;
  }): Promise<FoundationCause[]> {
    const query = db.select().from(foundationCauses);

    const conditions = [eq(foundationCauses.isActive, true)];

    if (filters?.category && filters.category !== "all") {
      conditions.push(eq(foundationCauses.category, filters.category));
    }
    if (filters?.countyId) {
      conditions.push(eq(foundationCauses.countyId, filters.countyId));
    }
    if (filters?.isActive !== undefined) {
      conditions.push(eq(foundationCauses.isActive, filters.isActive));
    }

    return await query.where(and(...conditions)).orderBy(desc(foundationCauses.createdAt));
  }

  async getFoundationCause(id: string): Promise<FoundationCause | undefined> {
    const [cause] = await db.select().from(foundationCauses).where(eq(foundationCauses.id, id));
    return cause;
  }

  async createFoundationCause(data: InsertFoundationCause): Promise<FoundationCause> {
    const [cause] = await db.insert(foundationCauses).values(data).returning();
    return cause;
  }

  // Foundation donations
  async createFoundationDonation(data: InsertFoundationDonation): Promise<FoundationDonation> {
    const [donation] = await db.insert(foundationDonations).values(data).returning();
    return donation;
  }

  async getFoundationDonation(id: string): Promise<FoundationDonation | undefined> {
    const [donation] = await db
      .select()
      .from(foundationDonations)
      .where(eq(foundationDonations.id, id));
    return donation;
  }

  async updateFoundationDonation(
    id: string,
    data: Partial<FoundationDonation>
  ): Promise<FoundationDonation | undefined> {
    const [donation] = await db
      .update(foundationDonations)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(foundationDonations.id, id))
      .returning();
    return donation;
  }

  async getUserDonations(
    userId: string,
    filters?: { status?: string; type?: string }
  ): Promise<any> {
    const conditions: SQL[] = [eq(foundationDonations.userId, userId)];
    if (filters?.status) conditions.push(eq(foundationDonations.status, filters.status as any));
    if (filters?.type) conditions.push(eq(foundationDonations.type, filters.type as any));

    const rows = await db
      .select({
        donationId: foundationDonations.id,
        amount: foundationDonations.amount,
        donationType: foundationDonations.type,
        donationStatus: foundationDonations.status,
        isRoundupDonation: foundationDonations.isRoundupDonation,
        originalAmount: foundationDonations.originalAmount,
        isAnonymous: foundationDonations.isAnonymous,
        donorMessage: foundationDonations.donorMessage,
        createdAt: foundationDonations.createdAt,
        completedAt: foundationDonations.completedAt,
        causeId: foundationCauses.id,
        causeName: foundationCauses.name,
        causeCategory: foundationCauses.category,
        countyName: counties.name,
        countyStateCode: counties.stateCode,
      })
      .from(foundationDonations)
      .leftJoin(foundationCauses, eq(foundationDonations.causeId, foundationCauses.id))
      .leftJoin(counties, eq(foundationCauses.countyId, counties.id))
      .where(and(...conditions) ?? sql`true`)
      .orderBy(desc(foundationDonations.createdAt));

    return rows.map((row: any) => ({
      id: row.donationId,
      amount: row.amount,
      type: row.donationType,
      status: row.donationStatus,
      isRoundupDonation: row.isRoundupDonation,
      originalAmount: row.originalAmount,
      isAnonymous: row.isAnonymous,
      donorMessage: row.donorMessage,
      createdAt: row.createdAt,
      completedAt: row.completedAt,
      cause: row.causeId
        ? {
            id: row.causeId,
            name: row.causeName,
            category: row.causeCategory,
            county: row.countyName
              ? {
                  name: row.countyName,
                  state: row.countyStateCode,
                }
              : null,
          }
        : null,
    }));
  }

  // Update cause raised amount after successful donation
  async updateCauseRaisedAmount(causeId: string, additionalAmount: number): Promise<void> {
    await db
      .update(foundationCauses)
      .set({
        raisedAmount: sql`${foundationCauses.raisedAmount} + ${additionalAmount}`,
        updatedAt: new Date(),
      })
      .where(eq(foundationCauses.id, causeId));
  }

  // User donation preferences
  async getUserDonationPreferences(userId: string): Promise<UserDonationPreferences | undefined> {
    const [preferences] = await db
      .select()
      .from(userDonationPreferences)
      .where(eq(userDonationPreferences.userId, userId));
    return preferences;
  }

  async createUserDonationPreferences(
    data: InsertUserDonationPreferences
  ): Promise<UserDonationPreferences> {
    const [preferences] = await db.insert(userDonationPreferences).values(data).returning();
    return preferences;
  }

  async updateUserDonationPreferences(
    userId: string,
    data: Partial<UserDonationPreferences>
  ): Promise<UserDonationPreferences | undefined> {
    const [preferences] = await db
      .update(userDonationPreferences)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(userDonationPreferences.userId, userId))
      .returning();
    return preferences;
  }

  async upsertUserDonationPreferences(
    userId: string,
    data: Partial<UserDonationPreferences>
  ): Promise<UserDonationPreferences> {
    const [preferences] = await db
      .insert(userDonationPreferences)
      .values({ ...data, userId })
      .onConflictDoUpdate({
        target: userDonationPreferences.userId,
        set: { ...data, updatedAt: new Date() },
      })
      .returning();
    return preferences;
  }

  // Foundation statistics
  async getFoundationStats(): Promise<any> {
    const [stats] = await db
      .select({
        totalRaised: sql<number>`COALESCE(SUM(${foundationDonations.amount}), 0)`,
        totalDonors: sql<number>`COUNT(DISTINCT ${foundationDonations.userId})`,
        activeCauses: sql<number>`COUNT(DISTINCT ${foundationCauses.id})`,
        countiesSupported: sql<number>`COUNT(DISTINCT ${foundationCauses.countyId})`,
      })
      .from(foundationDonations)
      .leftJoin(foundationCauses, eq(foundationDonations.causeId, foundationCauses.id))
      .where(and(eq(foundationDonations.status, "completed"), eq(foundationCauses.isActive, true)));

    return stats;
  }

  // Recent donations (public feed)
  async getRecentDonations(limit: number = 20): Promise<any> {
    const donations = await db
      .select()
      .from(foundationDonations)
      .where(eq(foundationDonations.status, "completed"))
      .orderBy(desc(foundationDonations.createdAt))
      .limit(limit);

    // Fetch related data separately to avoid complex join issues
    const results: any[] = [];
    for (const donation of donations) {
      const cause = await this.getFoundationCause(donation.causeId);
      let county: any = null;
      if (cause && cause.countyId) {
        const [countyResult] = await db
          .select()
          .from(counties)
          .where(eq(counties.id, cause.countyId));
        county = countyResult;
      }

      let donor = null;
      if (donation.userId) {
        const [userResult] = await db
          .select({ firstName: users.firstName, lastName: users.lastName })
          .from(users)
          .where(eq(users.id, donation.userId));
        donor = userResult;
      }

      results.push({
        id: donation.id,
        amount: donation.amount,
        isAnonymous: donation.isAnonymous,
        donorMessage: donation.donorMessage,
        createdAt: donation.createdAt,
        donor,
        cause: cause
          ? {
              name: cause.name,
              category: cause.category,
              county: county
                ? {
                    name: county.name,
                    state: county.stateCode,
                  }
                : null,
            }
          : null,
      });
    }

    return results;
  }

  // Foundation impact reports
  async getFoundationImpactReports(causeId?: string): Promise<any> {
    const conditions: SQL[] = [isNotNull(foundationImpactReports.publishedAt)];
    if (causeId) conditions.push(eq(foundationImpactReports.causeId, causeId));

    const reports = await db
      .select()
      .from(foundationImpactReports)
      .where(and(...conditions) ?? sql`true`)
      .orderBy(desc(foundationImpactReports.publishedAt));

    // Fetch related data separately to avoid complex join issues
    const results: any[] = [];
    for (const report of reports) {
      const cause = await this.getFoundationCause(report.causeId);
      let county: any = null;
      if (cause && cause.countyId) {
        const [countyResult] = await db
          .select()
          .from(counties)
          .where(eq(counties.id, cause.countyId));
        county = countyResult;
      }

      results.push({
        id: report.id,
        reportingPeriod: report.reportingPeriod,
        totalDonationsReceived: report.totalDonationsReceived,
        totalDonorsCount: report.totalDonorsCount,
        totalBeneficiaries: report.totalBeneficiaries,
        impactMetrics: report.impactMetrics,
        storytelling: report.storytelling,
        mediaUrls: report.mediaUrls,
        publishedAt: report.publishedAt,
        createdAt: report.createdAt,
        cause: cause
          ? {
              id: cause.id,
              name: cause.name,
              category: cause.category,
              county: county
                ? {
                    name: county.name,
                    state: county.stateCode,
                  }
                : null,
            }
          : null,
      });
    }

    return results;
  }

  // -------------------- County Vaults --------------------
  private async getOrCreateVaultForCounty(countyId: string): Promise<CountyVault> {
    const [existing] = await db
      .select()
      .from(countyVaults)
      .where(eq(countyVaults.countyId, countyId));

    if (existing) return existing;

    const [created] = await db.insert(countyVaults).values({ countyId }).returning();

    return created;
  }

  // -------------------- Community Profile Vault (MVP) --------------------
  private async getOrCreateCommunityVaultForProfile(profileId: string): Promise<CommunityVault> {
    const [existing] = await db
      .select()
      .from(communityVaults)
      .where(eq(communityVaults.profileId, profileId));

    if (existing) return existing as any;

    const [created] = await db
      .insert(communityVaults)
      .values({ profileId } as any)
      .returning();

    return created as any;
  }

  async recordVaultLedgerEntry(data: {
    countyId: string;
    amount: number;
    sourceType: string;
    sourceId?: string;
    memo?: string;
  }): Promise<{ vault: CountyVault; entry: VaultLedgerEntry }> {
    const vault = await this.getOrCreateVaultForCounty(data.countyId);
    const numericAmount = this.normalizeDecimal(data.amount);
    const amountForDb = this.normalizeDecimalString(data.amount);

    const [entry] = await db
      .insert(vaultLedgerEntries)
      .values({
        vaultId: vault.id,
        sourceType: data.sourceType as any,
        sourceId: data.sourceId,
        amount: amountForDb,
        memo: data.memo,
      })
      .returning();

    const [updatedVault] = await db
      .update(countyVaults)
      .set({
        currentBalance: sql`${countyVaults.currentBalance} + ${numericAmount}`,
        lifetimeInflow:
          numericAmount > 0
            ? sql`${countyVaults.lifetimeInflow} + ${numericAmount}`
            : countyVaults.lifetimeInflow,
        lifetimeOutflow:
          numericAmount < 0
            ? sql`${countyVaults.lifetimeOutflow} + ${Math.abs(numericAmount)}`
            : countyVaults.lifetimeOutflow,
        lastContributionAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(countyVaults.id, vault.id))
      .returning();

    return { vault: updatedVault || vault, entry };
  }

  async getVaultLedgerEntries(vaultId: string, limit: number = 20): Promise<VaultLedgerEntry[]> {
    return await db
      .select()
      .from(vaultLedgerEntries)
      .where(eq(vaultLedgerEntries.vaultId, vaultId))
      .orderBy(desc(vaultLedgerEntries.createdAt))
      .limit(limit);
  }

  async getCommunityVaultSnapshot(params: { profileId: string; limit?: number }): Promise<{
    profile: { id: string; slug: string; displayName: string; roleContext: string } | null;
    vault: CommunityVault | null;
    ledger: CommunityVaultLedgerEntry[];
  }> {
    const limit = params.limit ?? 50;

    const [profile] = await db
      .select({
        id: profiles.id,
        slug: profiles.slug,
        displayName: profiles.displayName,
        roleContext: profiles.roleContext,
      })
      .from(profiles)
      .where(eq(profiles.id, params.profileId))
      .limit(1);

    if (!profile) {
      return { profile: null, vault: null, ledger: [] };
    }

    const vault = await this.getOrCreateCommunityVaultForProfile(params.profileId);
    const ledger = await this.getCommunityVaultLedgerEntries(vault.id, limit);

    return { profile: profile as any, vault: vault as any, ledger: ledger as any };
  }

  async getCommunityVaultLedgerEntries(
    vaultId: string,
    limit: number = 50
  ): Promise<CommunityVaultLedgerEntry[]> {
    return await db
      .select()
      .from(communityVaultLedgerEntries)
      .where(eq(communityVaultLedgerEntries.vaultId, vaultId))
      .orderBy(desc(communityVaultLedgerEntries.createdAt))
      .limit(limit);
  }

  async recordCommunityVaultLedgerEntry(data: {
    profileId: string;
    amount: number;
    sourceType: string;
    sourceId?: string;
    externalKey?: string;
    memo?: string;
    causeId?: string;
  }): Promise<{ vault: CommunityVault; entry: CommunityVaultLedgerEntry }> {
    const vault = await this.getOrCreateCommunityVaultForProfile(data.profileId);
    const numericAmount = this.normalizeDecimal(data.amount);
    const amountForDb = this.normalizeDecimalString(data.amount);

    const [entry] = await db
      .insert(communityVaultLedgerEntries)
      .values({
        vaultId: vault.id,
        externalKey: data.externalKey ?? null,
        sourceType: data.sourceType as any,
        sourceId: data.sourceId ?? null,
        amount: amountForDb,
        memo: data.memo ?? null,
        causeId: data.causeId ?? null,
      } as any)
      .returning();

    const [updatedVault] = await db
      .update(communityVaults)
      .set({
        currentBalance: sql`${communityVaults.currentBalance} + ${numericAmount}`,
        lifetimeInflow:
          numericAmount > 0
            ? sql`${communityVaults.lifetimeInflow} + ${numericAmount}`
            : communityVaults.lifetimeInflow,
        lifetimeOutflow:
          numericAmount < 0
            ? sql`${communityVaults.lifetimeOutflow} + ${Math.abs(numericAmount)}`
            : communityVaults.lifetimeOutflow,
        lastContributionAt: numericAmount > 0 ? new Date() : communityVaults.lastContributionAt,
        lastUpdated: new Date(),
        updatedAt: new Date(),
      } as any)
      .where(eq(communityVaults.id, vault.id))
      .returning();

    return { vault: (updatedVault as any) || (vault as any), entry: entry as any };
  }

  // -------------------- Causes + Voting Intent (MVP) --------------------

  private async computeCommunityCauseVoteWeight(userId: string): Promise<number> {
    const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

    const builderProfile = await this.getBuilderProfile(userId);
    if (!builderProfile) return 1;

    const stats = await this.calculateBuilderStats(builderProfile.id);
    const totalValue = Number(stats.totalValue ?? 0);
    const verificationRate = Number(stats.verificationRate ?? 0);

    const individualImpact =
      1 + clamp(Math.log10(totalValue + 1) / 2, 0, 2) + clamp(verificationRate / 100, 0, 1);

    const countyContributions = await this.getCountyContributions(
      builderProfile.countyId,
      "verified"
    );
    const countyImpact = countyContributions.reduce((sum, contribution) => {
      const value = contribution.actualValue || contribution.estimatedValue || "0";
      return sum + Number(value);
    }, 0);

    const communityMultiplier = 1 + clamp(Math.log10(countyImpact + 1) / 3, 0, 1);
    const hybridWeight = clamp(individualImpact * communityMultiplier, 1, 5);

    return Number(hybridWeight.toFixed(3));
  }

  async listCommunityCausesByProfile(
    profileId: string
  ): Promise<
    Array<
      CommunityCause & { voteCount: number; weightedVoteTotal: number; allocationShare: number }
    >
  > {
    const causes = await db
      .select()
      .from(communityCauses)
      .where(eq(communityCauses.profileId, profileId))
      .orderBy(desc(communityCauses.createdAt));

    if (!causes.length) return [];

    const causeIds = causes.map((cause) => cause.id);

    const votes = await db
      .select({ causeId: communityCauseVotes.causeId, userId: communityCauseVotes.userId })
      .from(communityCauseVotes)
      .where(inArray(communityCauseVotes.causeId, causeIds));

    const voteCountByCause = new Map<string, number>();
    const weightedVoteByCause = new Map<string, number>();
    const weightCache = new Map<string, number>();

    for (const vote of votes) {
      voteCountByCause.set(vote.causeId, (voteCountByCause.get(vote.causeId) ?? 0) + 1);

      const cachedWeight = weightCache.get(vote.userId);
      const voteWeight =
        typeof cachedWeight === "number"
          ? cachedWeight
          : await this.computeCommunityCauseVoteWeight(vote.userId);
      weightCache.set(vote.userId, voteWeight);

      weightedVoteByCause.set(
        vote.causeId,
        (weightedVoteByCause.get(vote.causeId) ?? 0) + voteWeight
      );
    }

    const allocationShareByCause = computeAllocationShares(
      causes.map((cause) => ({
        id: cause.id,
        weightedVoteTotal: Number((weightedVoteByCause.get(cause.id) ?? 0).toFixed(3)),
      }))
    );

    return causes.map((cause) => {
      const weightedVoteTotal = Number((weightedVoteByCause.get(cause.id) ?? 0).toFixed(3));
      const allocationShare = Number(allocationShareByCause[cause.id] ?? 0);

      return {
        ...(cause as any),
        voteCount: voteCountByCause.get(cause.id) ?? 0,
        weightedVoteTotal,
        allocationShare,
      };
    });
  }

  async createCommunityCauseForOwner(
    ownerUserId: string,
    data: { profileId: string; title: string; description?: string | null }
  ): Promise<CommunityCause> {
    const profile = await this.getProfileByIdForOwner(ownerUserId, data.profileId);
    if (!profile) throw new Error("Profile not found or not owned by user");

    const [created] = await db
      .insert(communityCauses)
      .values({
        profileId: data.profileId,
        title: data.title,
        description: data.description ?? null,
        status: "open" as any,
        createdAt: new Date(),
        updatedAt: new Date(),
      } as any)
      .returning();

    return created as any;
  }

  async voteForCommunityCause(
    userId: string,
    causeId: string
  ): Promise<{
    vote: CommunityCauseVote;
    voteCount: number;
    weightedVoteTotal: number;
    allocationShare: number;
    voteWeight: number;
  }> {
    const [cause] = await db
      .select({ id: communityCauses.id, profileId: communityCauses.profileId })
      .from(communityCauses)
      .where(eq(communityCauses.id, causeId))
      .limit(1);
    if (!cause) throw new Error("Cause not found");

    const [existingVote] = await db
      .select()
      .from(communityCauseVotes)
      .where(and(eq(communityCauseVotes.causeId, causeId), eq(communityCauseVotes.userId, userId)))
      .orderBy(asc(communityCauseVotes.createdAt), asc(communityCauseVotes.id))
      .limit(1);

    let vote: CommunityCauseVote | undefined = existingVote as any;

    if (!vote) {
      try {
        const [created] = await db
          .insert(communityCauseVotes)
          .values({
            causeId,
            userId,
            createdAt: new Date(),
          } as any)
          .returning();
        vote = created as any;
      } catch {
        const [fallbackExisting] = await db
          .select()
          .from(communityCauseVotes)
          .where(
            and(eq(communityCauseVotes.causeId, causeId), eq(communityCauseVotes.userId, userId))
          )
          .orderBy(asc(communityCauseVotes.createdAt), asc(communityCauseVotes.id))
          .limit(1);
        vote = fallbackExisting as any;
      }
    }

    const [countRow] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(communityCauseVotes)
      .where(eq(communityCauseVotes.causeId, causeId));

    const voteWeight = await this.computeCommunityCauseVoteWeight(userId);
    const causeTallies = await this.listCommunityCausesByProfile(cause.profileId);
    const selectedCause = causeTallies.find((item) => item.id === causeId);

    return {
      vote: vote as any,
      voteCount: Number(countRow?.count ?? 0),
      weightedVoteTotal: Number(selectedCause?.weightedVoteTotal ?? 0),
      allocationShare: Number(selectedCause?.allocationShare ?? 0),
      voteWeight,
    };
  }

  // -------------------- Platform Support Ledger (MVP) --------------------

  async insertPlatformSupportLedgerEntry(
    data: InsertPlatformSupportLedgerEntry
  ): Promise<PlatformSupportLedgerEntry> {
    const [created] = await db
      .insert(platformSupportLedgerEntries)
      .values(data as any)
      .returning();
    return created as any;
  }

  async getPlatformSupportLedgerEntries(params: {
    originatingProfileId?: string;
    limit?: number;
  }): Promise<PlatformSupportLedgerEntry[]> {
    const limit = params.limit ?? 100;

    if (params.originatingProfileId) {
      return await db
        .select()
        .from(platformSupportLedgerEntries)
        .where(eq(platformSupportLedgerEntries.originatingProfileId, params.originatingProfileId))
        .orderBy(desc(platformSupportLedgerEntries.createdAt))
        .limit(limit);
    }

    return await db
      .select()
      .from(platformSupportLedgerEntries)
      .orderBy(desc(platformSupportLedgerEntries.createdAt))
      .limit(limit);
  }

  async getCountyVaultSnapshot(params: {
    countyId?: string;
    countyName?: string;
    stateCode?: string;
  }): Promise<{
    county?: County;
    vault: CountyVault | null;
    last30dInflow: number;
    ledger: VaultLedgerEntry[];
    sourcesBreakdown: Record<string, number>;
  }> {
    let countyRecord: County | undefined;

    if (params.countyId) {
      [countyRecord] = await db.select().from(counties).where(eq(counties.id, params.countyId));
    } else if (params.countyName && params.stateCode) {
      [countyRecord] = await db
        .select()
        .from(counties)
        .where(and(eq(counties.name, params.countyName), eq(counties.stateCode, params.stateCode)));
    }

    if (!countyRecord) {
      return { county: undefined, vault: null, last30dInflow: 0, ledger: [], sourcesBreakdown: {} };
    }

    const vault = await this.getOrCreateVaultForCounty(countyRecord.id);
    const ledger = await this.getVaultLedgerEntries(vault.id, 10);

    const breakdownRows = await db
      .select({
        sourceType: vaultLedgerEntries.sourceType,
        total: sql<string>`COALESCE(SUM(${vaultLedgerEntries.amount}), '0')`,
      })
      .from(vaultLedgerEntries)
      .where(eq(vaultLedgerEntries.vaultId, vault.id))
      .groupBy(vaultLedgerEntries.sourceType);

    const sourcesBreakdown = (breakdownRows || []).reduce(
      (acc, row) => {
        acc[row.sourceType as string] = this.normalizeDecimal((row as any)?.total);
        return acc;
      },
      {} as Record<string, number>
    );

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const [recentSum] = await db
      .select({ total: sql<string>`COALESCE(SUM(${vaultLedgerEntries.amount}), '0')` })
      .from(vaultLedgerEntries)
      .where(
        and(
          eq(vaultLedgerEntries.vaultId, vault.id),
          gte(vaultLedgerEntries.createdAt, thirtyDaysAgo)
        )
      );

    const last30dInflow = this.normalizeDecimal((recentSum as any)?.total);

    return { county: countyRecord, vault, last30dInflow, ledger, sourcesBreakdown };
  }

  async createFoundationImpactReport(
    data: InsertFoundationImpactReport
  ): Promise<FoundationImpactReport> {
    const [report] = await db.insert(foundationImpactReports).values(data).returning();
    return report;
  }

  // ==================== AFFILIATE SYSTEM IMPLEMENTATION ====================

  // Affiliate program management
  async getAffiliateProgram(userId: string): Promise<AffiliateProgram | undefined> {
    const [program] = await db
      .select()
      .from(affiliateAccounts)
      .where(eq(affiliateAccounts.affiliateId, userId));
    return program;
  }

  async getAffiliateProgramByAccountId(id: string): Promise<AffiliateAccount | undefined> {
    const [program] = await db.select().from(affiliateAccounts).where(eq(affiliateAccounts.id, id));
    return program;
  }

  async createAffiliateProgram(
    data: InsertAffiliateProgram | { userId: string; referralCode?: string }
  ): Promise<AffiliateProgram> {
    const affiliateId = (data as InsertAffiliateProgram).affiliateId || (data as any).userId;
    if (!affiliateId) {
      throw new Error("affiliateId is required to create an affiliate program");
    }

    const [existingProgram] = await db
      .select()
      .from(affiliateAccounts)
      .where(eq(affiliateAccounts.affiliateId, affiliateId))
      .limit(1);
    if (existingProgram) {
      return existingProgram;
    }

    const payload: InsertAffiliateProgram = {
      ...(data as InsertAffiliateProgram),
      affiliateId,
      referralCode:
        (data as any).referralCode ||
        (data as InsertAffiliateProgram).referralCode ||
        (await this.generateAffiliateCode(affiliateId)),
    };

    try {
      const [program] = await db.insert(affiliateAccounts).values(payload).returning();
      if (program) return program;
    } catch (error) {
      const code =
        typeof error === "object" && error && "code" in error
          ? String((error as { code?: string }).code || "")
          : "";
      // Handle duplicate creation race safely even if production indexes differ.
      if (code !== "23505") {
        throw error;
      }
    }

    const [resolved] = await db
      .select()
      .from(affiliateAccounts)
      .where(eq(affiliateAccounts.affiliateId, affiliateId))
      .limit(1);
    if (resolved) return resolved;

    throw new Error("Failed to resolve affiliate program after create conflict");
  }

  async updateAffiliateProgram(
    id: string,
    updates: Partial<InsertAffiliateProgram>
  ): Promise<AffiliateProgram> {
    const [program] = await db
      .update(affiliateAccounts)
      .set({ ...updates })
      .where(eq(affiliateAccounts.id, id))
      .returning();
    return program;
  }

  async generateAffiliateCode(userId: string): Promise<string> {
    // Generate a unique-ish affiliate code (e.g., JOHN2026A1B2C3).
    // Note: schema does not enforce uniqueness, so we proactively avoid collisions.
    const user = await this.getUser(userId);
    if (!user) throw new Error("User not found");

    const year = new Date().getFullYear();
    const baseName = (user.firstName || user.email?.split("@")[0] || "USER")
      .substring(0, 4)
      .toUpperCase();

    for (let attempt = 0; attempt < 25; attempt++) {
      const randomSuffix = Math.random().toString(36).substring(2, 8).toUpperCase();
      const candidate = `${baseName}${year}${randomSuffix}`;
      const [existing] = await db
        .select({ id: affiliateAccounts.id })
        .from(affiliateAccounts)
        .where(eq(affiliateAccounts.referralCode, candidate))
        .limit(1);
      if (!existing?.id) return candidate;
    }

    // Fallback: longer random to avoid worst-case collisions.
    return `TS${year}${Math.random().toString(36).substring(2, 12).toUpperCase()}`;
  }

  async getWalletTransactionsForUser(
    userId: string,
    limit: number = 50
  ): Promise<WalletTransaction[]> {
    const rows = await db
      .select()
      .from(walletTransactions)
      .where(eq(walletTransactions.userId, userId))
      .orderBy(desc(walletTransactions.createdAt))
      .limit(limit);
    return rows as WalletTransaction[];
  }

  // Wallet & on-platform balance
  async getWalletBalance(userId: string): Promise<string> {
    const [account] = await db
      .select()
      .from(walletAccounts)
      .where(eq(walletAccounts.userId, userId));
    return (account?.currentBalance as any) ?? "0";
  }

  private async getOrCreateWalletAccount(userId: string): Promise<WalletAccount> {
    const [existing] = await db
      .select()
      .from(walletAccounts)
      .where(eq(walletAccounts.userId, userId));
    if (existing) return existing;

    const [created] = await db
      .insert(walletAccounts)
      .values({ userId, currentBalance: "0" } as InsertWalletAccount)
      .returning();
    return created;
  }

  async creditWallet(
    userId: string,
    amount: number,
    options?: {
      type?: string;
      referenceType?: string;
      referenceId?: string;
      memo?: string;
      counterpartyUserId?: string;
    }
  ): Promise<void> {
    if (amount <= 0 || !Number.isFinite(amount)) return;

    const account = await this.getOrCreateWalletAccount(userId);
    const current = parseFloat((account.currentBalance as any) ?? "0");
    const next = current + amount;

    await db
      .update(walletAccounts)
      .set({ currentBalance: next.toFixed(2), updatedAt: new Date() })
      .where(eq(walletAccounts.id, account.id));

    await db.insert(walletTransactions).values({
      walletAccountId: account.id,
      userId,
      counterpartyUserId: options?.counterpartyUserId,
      transactionType: (options?.type as any) || "deposit",
      direction: "credit",
      amount: amount.toFixed(2),
      referenceType: options?.referenceType,
      referenceId: options?.referenceId,
      memo: options?.memo,
    } as InsertWalletTransaction);
  }

  async debitWallet(
    userId: string,
    amount: number,
    options?: {
      type?: string;
      referenceType?: string;
      referenceId?: string;
      memo?: string;
      counterpartyUserId?: string;
    }
  ): Promise<void> {
    if (amount <= 0 || !Number.isFinite(amount)) return;

    const account = await this.getOrCreateWalletAccount(userId);
    const current = parseFloat((account.currentBalance as any) ?? "0");
    const next = current - amount;
    if (next < 0) {
      throw new Error("Insufficient wallet balance");
    }

    await db
      .update(walletAccounts)
      .set({ currentBalance: next.toFixed(2), updatedAt: new Date() })
      .where(eq(walletAccounts.id, account.id));

    await db.insert(walletTransactions).values({
      walletAccountId: account.id,
      userId,
      counterpartyUserId: options?.counterpartyUserId,
      transactionType: (options?.type as any) || "withdrawal",
      direction: "debit",
      amount: amount.toFixed(2),
      referenceType: options?.referenceType,
      referenceId: options?.referenceId,
      memo: options?.memo,
    } as InsertWalletTransaction);
  }

  async incrementAffiliateEarnings(affiliateProgramId: string, amount: number): Promise<void> {
    if (amount <= 0 || !Number.isFinite(amount)) return;

    const program = await this.getAffiliateProgramByAccountId(affiliateProgramId);
    if (!program) return;

    const lifetime = parseFloat((program.lifetimeEarned as any) ?? "0");
    const available = parseFloat((program.available as any) ?? "0");

    const [updated] = await db
      .update(affiliateAccounts)
      .set({
        lifetimeEarned: (lifetime + amount).toFixed(2),
        available: (available + amount).toFixed(2),
      })
      .where(eq(affiliateAccounts.id, affiliateProgramId))
      .returning();

    void updated;
  }

  // Referral tracking
  async trackReferralClick(data: InsertAffiliateReferral): Promise<AffiliateReferral> {
    const [referral] = await db.insert(affiliateReferrals).values(data).returning();
    return referral;
  }

  async convertReferral(affiliateCode: string, userId: string): Promise<void> {
    const [alreadyConverted] = await db
      .select({ id: affiliateReferrals.id })
      .from(affiliateReferrals)
      .where(eq(affiliateReferrals.referredUserId, userId))
      .limit(1);
    if (alreadyConverted?.id) return;

    const [account] = await db
      .select()
      .from(affiliateAccounts)
      .where(eq(affiliateAccounts.referralCode, affiliateCode));

    if (!account) return;

    await db
      .update(users)
      .set({
        referredByAffiliateAccountId: account.id,
        referredAt: new Date(),
        updatedAt: new Date(),
      })
      .where(and(eq(users.id, userId), sql`${users.referredByAffiliateAccountId} IS NULL`));

    // Convert only the most recent unconverted referral to avoid
    // attributing multiple historical clicks to a single signup.
    const [latest] = await db
      .select({ id: affiliateReferrals.id })
      .from(affiliateReferrals)
      .where(
        and(
          eq(affiliateReferrals.affiliateId, account.id),
          isNull(affiliateReferrals.referredUserId)
        )
      )
      .orderBy(desc(affiliateReferrals.createdAt))
      .limit(1);

    if (!latest?.id) return;

    await db
      .update(affiliateReferrals)
      .set({ referredUserId: userId })
      .where(eq(affiliateReferrals.id, latest.id));
  }

  async getReferralsByAffiliate(affiliateProgramId: string): Promise<AffiliateReferral[]> {
    return await db
      .select()
      .from(affiliateReferrals)
      .where(eq(affiliateReferrals.affiliateId, affiliateProgramId))
      .orderBy(desc(affiliateReferrals.createdAt));
  }

  async getReferralByReferredUserId(userId: string): Promise<AffiliateReferral | undefined> {
    const [referral] = await db
      .select()
      .from(affiliateReferrals)
      .where(
        and(
          eq(affiliateReferrals.referredUserId, userId),
          isNotNull(affiliateReferrals.referredUserId)
        )
      );
    if (referral) return referral;

    // Lifetime attribution fallback: if the user has a persisted referral owner,
    // ensure we can resolve a referral record for commission tracking.
    const [u] = await db
      .select({ referredByAffiliateAccountId: users.referredByAffiliateAccountId })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    const affiliateAccountId = (u as any)?.referredByAffiliateAccountId
      ? String((u as any).referredByAffiliateAccountId)
      : "";
    if (!affiliateAccountId) return undefined;

    const [existing] = await db
      .select()
      .from(affiliateReferrals)
      .where(
        and(
          eq(affiliateReferrals.affiliateId, affiliateAccountId),
          eq(affiliateReferrals.referredUserId, userId)
        )
      )
      .limit(1);
    if (existing) return existing as any;

    const [created] = await db
      .insert(affiliateReferrals)
      .values({
        affiliateId: affiliateAccountId,
        referredUserId: userId,
        shareLinkId: null,
        customLink: null,
        conversionSource: "lifetime_fallback",
        conversionType: "lifetime",
        couponCode: null,
      } as any)
      .returning();

    return created as any;
  }

  // Commission management
  async createCommission(data: InsertAffiliateCommission): Promise<AffiliateCommission> {
    const commissionAmount = data.commissionAmount || "0";

    if (data.referralId) {
      const [updated] = await db
        .update(affiliateReferrals)
        .set({
          commissionAmount,
        })
        .where(eq(affiliateReferrals.id, data.referralId))
        .returning();

      if (updated) {
        return {
          id: updated.id,
          affiliateProgramId: data.affiliateProgramId,
          status: data.status || "pending",
          commissionAmount,
          revenueAmount: data.revenueAmount,
          referralId: updated.id,
          transactionId: data.transactionId,
          description: data.description,
          createdAt: updated.createdAt || new Date(),
          approvedAt: null,
          paidAt: null,
        };
      }
    }

    const [created] = await db
      .insert(affiliateReferrals)
      .values({
        affiliateId: data.affiliateProgramId,
        referredUserId: null,
        shareLinkId: null,
        customLink: data.transactionId || null,
        commissionAmount,
        discountAmount: "0",
        conversionSource: "commission",
        conversionType: "commission",
        couponCode: null,
      } as any)
      .returning();

    return {
      id: created.id,
      affiliateProgramId: data.affiliateProgramId,
      status: data.status || "pending",
      commissionAmount,
      revenueAmount: data.revenueAmount,
      referralId: created.id,
      transactionId: data.transactionId,
      description: data.description,
      createdAt: created.createdAt || new Date(),
      approvedAt: null,
      paidAt: null,
    };
  }

  async getCommissionsForAffiliate(affiliateProgramId: string): Promise<AffiliateCommission[]> {
    const rows = await db
      .select()
      .from(affiliateReferrals)
      .where(eq(affiliateReferrals.affiliateId, affiliateProgramId))
      .orderBy(desc(affiliateReferrals.createdAt));

    return rows
      .filter((row) => Number(row.commissionAmount || 0) > 0)
      .map((row) => ({
        id: row.id,
        affiliateProgramId,
        status: "pending",
        commissionAmount: row.commissionAmount || "0",
        referralId: row.id,
        transactionId: row.customLink || undefined,
        createdAt: row.createdAt || new Date(),
        approvedAt: null,
        paidAt: null,
      }));
  }

  async approveCommission(commissionId: string): Promise<void> {
    // No-op: commission persistence not available in current schema
    void commissionId;
  }

  async getUnpaidCommissions(affiliateProgramId: string): Promise<AffiliateCommission[]> {
    return this.getCommissionsForAffiliate(affiliateProgramId);
  }

  // Payout management
  async createPayout(
    data:
      | InsertAffiliatePayout
      | {
          affiliateProgramId: string;
          totalAmount: string;
          payoutMethod?: string;
          status?: string;
          notes?: string;
        }
  ): Promise<AffiliatePayout> {
    const affiliateId =
      (data as InsertAffiliatePayout).affiliateId || (data as any).affiliateProgramId;
    if (!affiliateId) {
      throw new Error("affiliateId is required to create a payout");
    }

    const payoutAmount =
      (data as InsertAffiliatePayout).payoutAmount || (data as any).totalAmount || "0";
    const method = (data as InsertAffiliatePayout).method || (data as any).payoutMethod || "manual";
    const note = (data as InsertAffiliatePayout).note ?? (data as any).notes;
    const status = (data as InsertAffiliatePayout).status || (data as any).status || "pending";

    const [payout] = await db
      .insert(affiliatePayouts)
      .values({
        affiliateId,
        payoutAmount,
        status,
        method,
        note,
      })
      .returning();

    return payout;
  }

  async getPayoutsForAffiliate(affiliateProgramId: string): Promise<AffiliatePayout[]> {
    return await db
      .select()
      .from(affiliatePayouts)
      .where(eq(affiliatePayouts.affiliateId, affiliateProgramId))
      .orderBy(desc(affiliatePayouts.createdAt));
  }

  async updatePayoutStatus(payoutId: string, status: string): Promise<void> {
    const updateData: Partial<InsertAffiliatePayout> = { status };

    await db.update(affiliatePayouts).set(updateData).where(eq(affiliatePayouts.id, payoutId));
  }

  // Analytics
  async getAffiliateStats(affiliateProgramId: string): Promise<{
    totalReferrals: number;
    convertedReferrals: number;
    totalCommissionEarned: string;
    totalCommissionPaid: string;
    conversionRate: number;
  }> {
    const [program] = await db
      .select()
      .from(affiliateAccounts)
      .where(eq(affiliateAccounts.id, affiliateProgramId));

    if (!program) {
      throw new Error("Affiliate program not found");
    }

    const [referralStats] = await db
      .select({
        totalReferrals: sql<number>`count(*)`,
        convertedReferrals: sql<number>`count(*) filter (where ${affiliateReferrals.referredUserId} is not null)`,
      })
      .from(affiliateReferrals)
      .where(eq(affiliateReferrals.affiliateId, affiliateProgramId));

    const [commissionTotals] = await db
      .select({
        // Source-of-truth earned total from commission rows.
        earned: sql<string>`coalesce(sum(coalesce(${affiliateReferrals.commissionAmount}, '0')::numeric), 0)::text`,
      })
      .from(affiliateReferrals)
      .where(eq(affiliateReferrals.affiliateId, affiliateProgramId));

    const [payoutTotals] = await db
      .select({
        // "Paid out" should only include settled payout rows.
        paidOut: sql<string>`coalesce(sum(case when lower(coalesce(${affiliatePayouts.status}, '')) in ('paid', 'completed') then coalesce(${affiliatePayouts.payoutAmount}, '0')::numeric else 0 end), 0)::text`,
      })
      .from(affiliatePayouts)
      .where(eq(affiliatePayouts.affiliateId, affiliateProgramId));

    const conversionRate =
      referralStats.totalReferrals > 0
        ? (referralStats.convertedReferrals / referralStats.totalReferrals) * 100
        : 0;

    return {
      totalReferrals: referralStats.totalReferrals || 0,
      convertedReferrals: referralStats.convertedReferrals || 0,
      totalCommissionEarned: commissionTotals?.earned || "0",
      totalCommissionPaid: payoutTotals?.paidOut || "0",
      conversionRate: Math.round(conversionRate * 100) / 100,
    };
  }

  // Canonical promotions helpers
  async createPromotion(input: InsertPromotion): Promise<Promotion> {
    const [row] = await db.insert(promotions).values(input).returning();
    return row;
  }

  async listPromotions(filters?: {
    status?: string;
    countyFips?: string;
    tier?: string;
    type?: "trade_deal" | "sponsor" | "affiliate" | "announcement";
    exclusive?: boolean;
    placementCommunitySnapshot?: boolean;
    activeAt?: Date;
    includeGlobalWhenCounty?: boolean;
    limit?: number;
  }): Promise<Promotion[]> {
    const conditions: SQL[] = [];

    if (filters?.status) {
      conditions.push(eq(promotions.status, filters.status as any));
    }

    if (filters?.countyFips) {
      if (filters.includeGlobalWhenCounty) {
        conditions.push(
          sql`(${promotions.countyFips} @> ARRAY[${filters.countyFips}]::text[] OR coalesce(array_length(${promotions.countyFips}, 1), 0) = 0)`
        );
      } else {
        conditions.push(sql`${promotions.countyFips} @> ARRAY[${filters.countyFips}]::text[]`);
      }
    }

    if (filters?.tier) {
      conditions.push(eq(promotions.tier, filters.tier as any));
    }
    if (filters?.type) {
      conditions.push(eq(promotions.type, filters.type as any));
    }
    if (typeof filters?.exclusive === "boolean") {
      conditions.push(eq(promotions.exclusive, filters.exclusive));
    }
    if (typeof filters?.placementCommunitySnapshot === "boolean") {
      conditions.push(
        eq(promotions.placementCommunitySnapshot, filters.placementCommunitySnapshot)
      );
    }
    if (filters?.activeAt) {
      const at = filters.activeAt;
      conditions.push(
        sql`(promotions.starts_at IS NULL OR promotions.starts_at <= ${at}) AND (promotions.ends_at IS NULL OR promotions.ends_at >= ${at})`
      );
    }

    const query = db
      .select()
      .from(promotions)
      .where(conditions.length ? and(...conditions) : sql`true`)
      .orderBy(desc(promotions.createdAt))
      .limit(filters?.limit || 100);

    return await query;
  }

  async getPromotion(id: string): Promise<Promotion | undefined> {
    const [row] = await db.select().from(promotions).where(eq(promotions.id, id));
    return row;
  }

  async updatePromotion(id: string, updates: Partial<Promotion>): Promise<Promotion> {
    const [row] = await db
      .update(promotions)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(promotions.id, id))
      .returning();
    return row;
  }

  async deletePromotion(id: string): Promise<void> {
    await db.delete(promotions).where(eq(promotions.id, id));
  }

  async updateDealStats(dealId: string, engagementType: string): Promise<void> {
    const updates: any = {};

    switch (engagementType) {
      case "view":
        updates.views = sql`${dailyDeals.views} + 1`;
        break;
      case "click":
        updates.clicks = sql`${dailyDeals.clicks} + 1`;
        break;
      case "save":
        updates.saves = sql`${dailyDeals.saves} + 1`;
        break;
      case "redeem":
        updates.currentRedemptions = sql`${dailyDeals.currentRedemptions} + 1`;
        break;
    }

    if (Object.keys(updates).length > 0) {
      await db.update(dailyDeals).set(updates).where(eq(dailyDeals.id, dealId));
    }
  }

  // Affiliate System Implementation

  async getUserAffiliate(userId: string): Promise<UserAffiliate | undefined> {
    const [affiliate] = await db
      .select()
      .from(userAffiliates)
      .where(eq(userAffiliates.userId, userId));
    return affiliate;
  }

  async createUserAffiliate(affiliateData: InsertUserAffiliate): Promise<UserAffiliate> {
    const [affiliate] = await db.insert(userAffiliates).values(affiliateData).returning();
    return affiliate;
  }

  async trackAffiliateAction(trackingData: InsertAffiliateTracking): Promise<AffiliateTracking> {
    const [tracking] = await db.insert(affiliateTracking).values(trackingData).returning();

    // Update affiliate stats
    if (trackingData.action === "click") {
      await db
        .update(userAffiliates)
        .set({ clicksGenerated: sql`${userAffiliates.clicksGenerated} + 1` })
        .where(eq(userAffiliates.affiliateCode, trackingData.affiliateCode));
    }

    return tracking;
  }

  async createDealEngagement(engagementData: InsertDealEngagement): Promise<DealEngagement> {
    const [engagement] = await db.insert(dealEngagements).values(engagementData).returning();
    return engagement;
  }

  async getAffiliateDashboard(affiliateCode: string): Promise<{
    affiliate: UserAffiliate;
    recentActivity: AffiliateTracking[];
    monthlyStats: any;
    topPerformingLinks: any[];
  }> {
    const affiliate = await db
      .select()
      .from(userAffiliates)
      .where(eq(userAffiliates.affiliateCode, affiliateCode))
      .then((results: any[]) => results[0]);

    if (!affiliate) {
      throw new Error("Affiliate not found");
    }

    const recentActivity = await db
      .select()
      .from(affiliateTracking)
      .where(eq(affiliateTracking.affiliateCode, affiliateCode))
      .orderBy(desc(affiliateTracking.createdAt))
      .limit(20);

    // Real monthly stats: aggregate affiliateTracking rows for the current calendar month
    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);

    const [monthlyRow] = await db
      .select({
        clicks: sql<number>`count(*) filter (where ${affiliateTracking.action} = 'click')`,
        referrals: sql<number>`count(*) filter (where ${affiliateTracking.action} = 'signup')`,
        conversions: sql<number>`count(*) filter (where ${affiliateTracking.action} = 'conversion')`,
        earnings: sum(affiliateTracking.commissionEarned),
      })
      .from(affiliateTracking)
      .where(
        and(
          eq(affiliateTracking.affiliateCode, affiliateCode),
          gte(affiliateTracking.createdAt, monthStart)
        )
      );

    const monthlyClicks = Number(monthlyRow?.clicks ?? 0);
    const monthlyReferrals = Number(monthlyRow?.referrals ?? 0);
    const monthlyEarnings = Number(monthlyRow?.earnings ?? 0);
    const monthlyConversions = Number(monthlyRow?.conversions ?? 0);

    const monthlyStats = {
      clicks: monthlyClicks,
      referrals: monthlyReferrals,
      conversions: monthlyConversions,
      earnings: monthlyEarnings,
      conversionRate: monthlyClicks > 0 ? (monthlyConversions / monthlyClicks) * 100 : 0,
    };

    // Top performing source URLs by total commission earned (last 90 days)
    const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
    const topLinks = await db
      .select({
        sourceUrl: affiliateTracking.sourceUrl,
        clicks: sql<number>`count(*) filter (where ${affiliateTracking.action} = 'click')`,
        conversions: sql<number>`count(*) filter (where ${affiliateTracking.action} = 'conversion')`,
        totalCommission: sum(affiliateTracking.commissionEarned),
      })
      .from(affiliateTracking)
      .where(
        and(
          eq(affiliateTracking.affiliateCode, affiliateCode),
          gte(affiliateTracking.createdAt, ninetyDaysAgo),
          isNotNull(affiliateTracking.sourceUrl)
        )
      )
      .groupBy(affiliateTracking.sourceUrl)
      .orderBy(desc(sum(affiliateTracking.commissionEarned)))
      .limit(5);

    return {
      affiliate,
      recentActivity,
      monthlyStats,
      topPerformingLinks: topLinks.map((l) => ({
        sourceUrl: l.sourceUrl,
        clicks: Number(l.clicks),
        conversions: Number(l.conversions),
        totalCommission: Number(l.totalCommission ?? 0),
      })),
    };
  }

  // Smart Recommendation Generator implementation

  // Insights
  async createRecommendationInsight(
    insight: InsertRecommendationInsight
  ): Promise<RecommendationInsight> {
    const normalizedInsight: InsertRecommendationInsight = {
      ...insight,
      topStrengths: this.coerceStringArray((insight as any).topStrengths) as any,
      improvementAreas: this.coerceStringArray((insight as any).improvementAreas) as any,
    };
    const [newInsight] = await db
      .insert(recommendationInsights)
      .values(normalizedInsight as any)
      .returning();
    return newInsight;
  }

  async getRecommendationInsight(contractorId: string): Promise<RecommendationInsight | undefined> {
    const [insight] = await db
      .select()
      .from(recommendationInsights)
      .where(eq(recommendationInsights.contractorId, contractorId))
      .orderBy(desc(recommendationInsights.lastAnalyzedAt))
      .limit(1);
    return insight;
  }

  async updateRecommendationInsight(
    contractorId: string,
    updates: Partial<RecommendationInsight>
  ): Promise<RecommendationInsight> {
    const [insight] = await db
      .update(recommendationInsights)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(recommendationInsights.contractorId, contractorId))
      .returning();
    return insight;
  }

  async analyzeContractorPerformance(contractorId: string): Promise<RecommendationInsight> {
    // Get contractor's current recommendations
    const contractorRecommendations = await db
      .select()
      .from(recommendations)
      .where(eq(recommendations.contractorId, contractorId));

    const totalRecommendations = contractorRecommendations.length;
    const positiveRecommendations = contractorRecommendations.filter(
      (r: any) => r.recommendationType === "positive"
    ).length;
    const negativeRecommendations = contractorRecommendations.filter(
      (r: any) => r.recommendationType === "negative"
    ).length;

    // Calculate average rating
    const ratingsSum = contractorRecommendations.reduce((sum: number, rec: any) => {
      const workQuality = parseInt(rec.workQuality || "0");
      const timeliness = parseInt(rec.timeliness || "0");
      const communication = parseInt(rec.communication || "0");
      return sum + (workQuality + timeliness + communication) / 3;
    }, 0);

    const averageRating =
      totalRecommendations > 0 ? (ratingsSum / totalRecommendations).toFixed(2) : "0";

    // Analyze strengths and improvement areas
    const topStrengths: string[] = [];
    const improvementAreas: string[] = [];

    if (positiveRecommendations / Math.max(totalRecommendations, 1) > 0.8) {
      topStrengths.push("Consistently positive customer feedback");
    }
    if (negativeRecommendations / Math.max(totalRecommendations, 1) < 0.1) {
      topStrengths.push("Low complaint rate");
    }
    if (parseFloat(averageRating) > 4.0) {
      topStrengths.push("High quality work ratings");
    }

    if (totalRecommendations < 5) {
      improvementAreas.push("Need more customer recommendations");
    }
    if (parseFloat(averageRating) < 3.5) {
      improvementAreas.push("Focus on improving work quality");
    }

    // Generate AI recommendations
    const aiRecommendations = [
      {
        category: "Customer Follow-up",
        suggestion:
          "Set up automated follow-up emails to request recommendations after project completion",
        impact: "high" as const,
        timeframe: "1-2 weeks",
      },
      {
        category: "Profile Optimization",
        suggestion:
          "Complete your contractor profile with detailed service descriptions and photos",
        impact: "medium" as const,
        timeframe: "1 week",
      },
      {
        category: "Quality Improvement",
        suggestion: "Focus on communication and timeliness to boost ratings",
        impact: "high" as const,
        timeframe: "Ongoing",
      },
    ];

    // Get competitive position
    const allContractorsCount = await db.select({ count: sql<number>`count(*)` }).from(contractors);

    const betterContractors = await db
      .select({ count: sql<number>`count(*)` })
      .from(contractors)
      .innerJoin(recommendations, eq(contractors.id, recommendations.contractorId))
      .where(gt(sql<number>`count(${recommendations.id})`, totalRecommendations))
      .groupBy(contractors.id);

    const competitorComparison = {
      totalContractors: allContractorsCount[0]?.count || 0,
      betterThan: Math.max(0, allContractorsCount[0]?.count - betterContractors.length),
      percentile:
        allContractorsCount[0]?.count > 0
          ? Math.round(
              ((allContractorsCount[0].count - betterContractors.length) /
                allContractorsCount[0].count) *
                100
            )
          : 0,
    };

    const marketPosition =
      competitorComparison.percentile >= 75
        ? "top_performer"
        : competitorComparison.percentile >= 50
          ? "above_average"
          : competitorComparison.percentile >= 25
            ? "average"
            : "below_average";

    const insightData = {
      contractorId,
      totalRecommendations,
      positiveRecommendations,
      negativeRecommendations,
      averageRating,
      topStrengths,
      improvementAreas,
      suggestedActions: [
        {
          action: "Follow up with recent customers for recommendations",
          priority: "high" as const,
          impact: "Increase recommendation count by 50%",
          difficulty: "Easy - Use email templates",
        },
        {
          action: "Optimize profile with photos and detailed descriptions",
          priority: "medium" as const,
          impact: "Improve customer trust and inquiry rate",
          difficulty: "Medium - Requires content creation",
        },
      ],
      profileViews: 0, // Would be updated from analytics
      inquiryRate: "0",
      responseRate: "0",
      marketPosition,
      competitorComparison,
      aiRecommendations,
    };

    // Check if insight exists and update or create
    const existingInsight = await this.getRecommendationInsight(contractorId);
    if (existingInsight) {
      return await this.updateRecommendationInsight(contractorId, insightData);
    } else {
      return await this.createRecommendationInsight(insightData);
    }
  }

  // Goals
  async createRecommendationGoal(goal: InsertRecommendationGoal): Promise<RecommendationGoal> {
    const normalizedGoal: InsertRecommendationGoal = {
      ...goal,
      milestones: this.coerceRecommendationGoalMilestones((goal as any).milestones) as any,
    };
    const [newGoal] = await db
      .insert(recommendationGoals)
      .values(normalizedGoal as any)
      .returning();
    return newGoal;
  }

  async getContractorGoals(contractorId: string): Promise<RecommendationGoal[]> {
    return await db
      .select()
      .from(recommendationGoals)
      .where(eq(recommendationGoals.contractorId, contractorId))
      .orderBy(desc(recommendationGoals.createdAt));
  }

  async updateRecommendationGoal(
    goalId: string,
    updates: Partial<RecommendationGoal>
  ): Promise<RecommendationGoal> {
    const [goal] = await db
      .update(recommendationGoals)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(recommendationGoals.id, goalId))
      .returning();
    return goal;
  }

  async updateGoalProgress(contractorId: string): Promise<void> {
    const goals = await this.getContractorGoals(contractorId);
    const currentRecommendations = await db
      .select({ count: sql<number>`count(*)` })
      .from(recommendations)
      .where(eq(recommendations.contractorId, contractorId));

    const currentCount = currentRecommendations[0]?.count || 0;

    for (const goal of goals) {
      if (!goal.isActive) continue;

      const progress = Math.min(
        100,
        ((currentCount - (goal.startingRecommendations || 0)) /
          Math.max(1, goal.targetRecommendations - (goal.startingRecommendations || 0))) *
          100
      );

      await this.updateRecommendationGoal(goal.id, {
        currentProgress: progress.toString(),
      });
    }
  }

  // Campaigns
  async createRecommendationCampaign(
    campaign: InsertRecommendationCampaign
  ): Promise<RecommendationCampaign> {
    const normalizedCampaign: InsertRecommendationCampaign = {
      ...campaign,
      targetCustomers: this.coerceRecommendationCampaignTargets(
        (campaign as any).targetCustomers
      ) as any,
    };
    const [newCampaign] = await db
      .insert(recommendationCampaigns)
      .values(normalizedCampaign as any)
      .returning();
    return newCampaign;
  }

  async getContractorCampaigns(contractorId: string): Promise<RecommendationCampaign[]> {
    return await db
      .select()
      .from(recommendationCampaigns)
      .where(eq(recommendationCampaigns.contractorId, contractorId))
      .orderBy(desc(recommendationCampaigns.createdAt));
  }

  async updateRecommendationCampaign(
    campaignId: string,
    updates: Partial<RecommendationCampaign>
  ): Promise<RecommendationCampaign> {
    const [campaign] = await db
      .update(recommendationCampaigns)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(recommendationCampaigns.id, campaignId))
      .returning();
    return campaign;
  }

  async deleteRecommendationCampaign(campaignId: string): Promise<void> {
    await db.delete(recommendationCampaigns).where(eq(recommendationCampaigns.id, campaignId));
  }

  async getActiveCampaigns(): Promise<RecommendationCampaign[]> {
    return await db
      .select()
      .from(recommendationCampaigns)
      .where(eq(recommendationCampaigns.isActive, true))
      .orderBy(desc(recommendationCampaigns.createdAt));
  }

  // Feature Flags Management
  async getFeatureFlags(): Promise<any> {
    return await db.select().from(featureFlags).orderBy(desc(featureFlags.createdAt));
  }

  async getFeatureFlag(key: string): Promise<any | undefined> {
    const [flag] = await db.select().from(featureFlags).where(eq(featureFlags.key, key));
    return flag;
  }

  async createFeatureFlag(flagData: any): Promise<any> {
    const [flag] = await db
      .insert(featureFlags)
      .values({
        ...flagData,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning();
    return flag;
  }

  async updateFeatureFlag(id: string, updates: any): Promise<any> {
    const [flag] = await db
      .update(featureFlags)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(featureFlags.id, id))
      .returning();
    return flag;
  }

  async deleteFeatureFlag(id: string): Promise<void> {
    await db.delete(featureFlags).where(eq(featureFlags.id, id));
  }

  async isFeatureEnabled(key: string, userRole?: string): Promise<boolean> {
    const flag = await this.getFeatureFlag(key);
    if (!flag || !flag.enabled) return false;

    // Check if user role is allowed
    if (userRole && flag.userRoles && flag.userRoles.length > 0) {
      return flag.userRoles.includes(userRole);
    }

    return flag.enabled;
  }

  // HOA Management operations
  async getHOAById(hoaId: string): Promise<any> {
    const [hoa] = await db
      .select()
      .from(homeownerAssociations)
      .where(eq(homeownerAssociations.id, hoaId));
    return hoa;
  }

  async searchHOAs(filters: {
    countyFips?: string;
    zip?: string;
    city?: string;
    state?: string;
  }): Promise<any[]> {
    const conditions: SQL[] = [eq(homeownerAssociations.isActive, true)];
    if (filters.countyFips)
      conditions.push(eq(homeownerAssociations.countyFips, filters.countyFips));
    if (filters.state) conditions.push(eq(homeownerAssociations.state, filters.state));
    if (filters.city) conditions.push(eq(homeownerAssociations.city, filters.city));
    if (filters.zip) conditions.push(eq(homeownerAssociations.zipCode, filters.zip));

    return await db
      .select()
      .from(homeownerAssociations)
      .where(and(...conditions));
  }

  async getHOAFinances(hoaId: string): Promise<any> {
    const currentYear = new Date().getFullYear();
    const records = await db
      .select()
      .from(hoaFinancialRecords)
      .where(and(eq(hoaFinancialRecords.hoaId, hoaId), eq(hoaFinancialRecords.year, currentYear)))
      .orderBy(desc(hoaFinancialRecords.month));

    if (records.length === 0) return null;

    const totalRevenue = records.reduce(
      (sum: number, r: any) => sum + Number(r.totalRevenue || 0),
      0
    );
    const totalExpenses = records.reduce(
      (sum: number, r: any) => sum + Number(r.totalExpenses || 0),
      0
    );
    const latest = records[0];

    return {
      totalRevenue: totalRevenue.toString(),
      totalExpenses: totalExpenses.toString(),
      reserves: latest.reserves,
      outstandingFees: latest.outstandingFees,
      monthlyBreakdown: records.map((r: any) => ({
        month: `${r.year}-${String(r.month).padStart(2, "0")}`,
        revenue: r.totalRevenue,
        expenses: r.totalExpenses,
      })),
      expenseCategories: latest.expenseCategories || [],
    };
  }

  async recordHoaFeePayment(hoaId: string, amount: number): Promise<void> {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() + 1;

    const [latest] = await db
      .select()
      .from(hoaFinancialRecords)
      .where(
        and(
          eq(hoaFinancialRecords.hoaId, hoaId),
          eq(hoaFinancialRecords.year, year),
          eq(hoaFinancialRecords.month, month)
        )
      )
      .orderBy(desc(hoaFinancialRecords.createdAt));

    const currentRevenue = Number(latest?.totalRevenue || 0);
    const currentOutstanding = Number(latest?.outstandingFees || 0);
    const currentReserves = Number(latest?.reserves || 0);

    const newRevenue = currentRevenue + amount;
    const newOutstanding = Math.max(currentOutstanding - amount, 0);
    const newReserves = currentReserves + amount;

    if (latest) {
      await db
        .update(hoaFinancialRecords)
        .set({
          totalRevenue: newRevenue.toFixed(2),
          outstandingFees: newOutstanding.toFixed(2),
          reserves: newReserves.toFixed(2),
          updatedAt: new Date(),
        })
        .where(eq(hoaFinancialRecords.id, latest.id));
    } else {
      await db.insert(hoaFinancialRecords).values({
        hoaId,
        year,
        month,
        totalRevenue: newRevenue.toFixed(2),
        totalExpenses: "0.00",
        netIncome: newRevenue.toFixed(2),
        reserves: newReserves.toFixed(2),
        outstandingFees: newOutstanding.toFixed(2),
      } as any);
    }
  }

  async recordHoaFeeCollection(params: {
    hoaId: string;
    residentId: string;
    amount: number;
    description?: string;
    collectedByUserId: string;
    paymentMethod?: string;
    externalRef?: string;
  }): Promise<{
    id: string;
    hoaId: string;
    residentId: string;
    amount: string;
    description: string;
    collectedByUserId: string;
    paymentMethod: string;
    externalRef: string | null;
    createdAt: Date;
  }> {
    const amount = Number(params.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      throw new Error("amount must be a positive number");
    }

    const description =
      typeof params.description === "string" && params.description.trim().length > 0
        ? params.description.trim()
        : "Monthly HOA dues";
    const paymentMethod =
      typeof params.paymentMethod === "string" && params.paymentMethod.trim().length > 0
        ? params.paymentMethod.trim().toLowerCase()
        : "manual";
    const externalRef =
      typeof params.externalRef === "string" && params.externalRef.trim().length > 0
        ? params.externalRef.trim()
        : null;

    const insertResult = await neonPool.query<{
      id: string;
      hoa_id: string;
      resident_id: string;
      amount: string;
      description: string;
      collected_by_user_id: string;
      payment_method: string;
      external_ref: string | null;
      created_at: Date;
    }>(
      `
      INSERT INTO hoa_fee_payments (
        hoa_id,
        resident_id,
        amount,
        description,
        collected_by_user_id,
        payment_method,
        external_ref
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING id, hoa_id, resident_id, amount, description, collected_by_user_id, payment_method, external_ref, created_at
      `,
      [
        params.hoaId,
        params.residentId,
        amount.toFixed(2),
        description,
        params.collectedByUserId,
        paymentMethod,
        externalRef,
      ]
    );

    const payment = insertResult.rows[0];
    if (!payment) {
      throw new Error("Failed to record HOA fee payment");
    }

    await this.recordHoaFeePayment(params.hoaId, amount);

    return {
      id: payment.id,
      hoaId: payment.hoa_id,
      residentId: payment.resident_id,
      amount: payment.amount,
      description: payment.description,
      collectedByUserId: payment.collected_by_user_id,
      paymentMethod: payment.payment_method,
      externalRef: payment.external_ref,
      createdAt: new Date(payment.created_at),
    };
  }

  async getHOAVendors(hoaId: string): Promise<any[]> {
    return await db
      .select()
      .from(hoaVendors)
      .where(eq(hoaVendors.hoaId, hoaId))
      .orderBy(hoaVendors.name);
  }

  async getHOAVotes(hoaId: string): Promise<any[]> {
    return await db
      .select()
      .from(hoaVotes)
      .where(and(eq(hoaVotes.hoaId, hoaId), eq(hoaVotes.status, "active")))
      .orderBy(desc(hoaVotes.createdAt));
  }

  private async countHoaEligibleVoters(hoaId: string): Promise<number> {
    const [row] = await db
      .select({ count: sql<number>`count(*)` })
      .from(hoaMembers)
      .where(and(eq(hoaMembers.hoaId, hoaId), eq(hoaMembers.votingRights, true)));

    return Number(row?.count ?? 0);
  }

  async createHOABoardTransferVote(params: {
    hoaId: string;
    initiatedByUserId: string;
    targetRole: "president" | "vice_president";
    nomineeUserId: string;
    reason: string;
    durationHours: number;
  }): Promise<{ voteId: string }> {
    const governance = await this.getHOAGovernance(params.hoaId);
    if (governance?.votingEnabled === false) {
      throw new Error("Voting is disabled for this HOA");
    }

    const quorumPercentage = Number(governance?.quorumPercentage);
    const votePassThreshold = Number(governance?.votePassThreshold);
    if (!Number.isFinite(quorumPercentage) || quorumPercentage <= 0 || quorumPercentage > 100) {
      throw new Error("Invalid HOA quorum percentage");
    }
    if (!Number.isFinite(votePassThreshold) || votePassThreshold <= 0 || votePassThreshold > 100) {
      throw new Error("Invalid HOA vote pass threshold");
    }

    const eligibleVoters = await this.countHoaEligibleVoters(params.hoaId);
    if (eligibleVoters <= 0) {
      throw new Error("No eligible voting members for this HOA");
    }

    // Initiation cooldown: a member cannot initiate more than one board-transfer vote
    // within a 6 month window (scheduled yearly votes should be created via a separate
    // system path, not this user-initiated endpoint).
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
    const recentInitiation = await db
      .select({ voteId: hoaVoteBoardTransfers.voteId })
      .from(hoaVoteBoardTransfers)
      .where(
        and(
          eq(hoaVoteBoardTransfers.hoaId, params.hoaId),
          eq(hoaVoteBoardTransfers.initiatedByUserId, params.initiatedByUserId),
          gte(hoaVoteBoardTransfers.createdAt, sixMonthsAgo)
        )
      )
      .limit(1);

    if (recentInitiation.length > 0) {
      throw new Error("You can only initiate a board transfer vote once every 6 months");
    }

    const requiredQuorum = Math.max(1, Math.ceil((eligibleVoters * quorumPercentage) / 100));
    const now = new Date();
    const durationHours = Number(params.durationHours);
    if (!Number.isFinite(durationHours) || durationHours <= 0 || durationHours > 24 * 30) {
      throw new Error("Invalid vote duration");
    }

    const endDate = new Date(now.getTime() + durationHours * 60 * 60 * 1000);

    const existing = await db
      .select({ id: hoaVotes.id })
      .from(hoaVotes)
      .innerJoin(hoaVoteBoardTransfers, eq(hoaVoteBoardTransfers.voteId, hoaVotes.id))
      .where(
        and(
          eq(hoaVotes.hoaId, params.hoaId),
          eq(hoaVotes.status, "active"),
          eq(hoaVotes.voteType, "board_role_transfer"),
          eq(hoaVoteBoardTransfers.targetRole, params.targetRole)
        )
      )
      .limit(1);

    if (existing.length > 0) {
      throw new Error(`A transfer vote for ${params.targetRole} is already active`);
    }

    const title =
      params.targetRole === "president"
        ? "Board Role Transfer Vote: President"
        : "Board Role Transfer Vote: Vice President";
    const description = `Nominee: ${params.nomineeUserId}\nReason: ${params.reason}`;

    const vote = await db.transaction(async (tx) => {
      const [createdVote] = await tx
        .insert(hoaVotes)
        .values({
          hoaId: params.hoaId,
          title,
          description,
          voteType: "board_role_transfer",
          createdBy: params.initiatedByUserId,
          startDate: now,
          endDate,
          requiredQuorum,
          status: "active",
        } as any)
        .returning();

      await tx.insert(hoaVoteBoardTransfers).values({
        voteId: createdVote.id,
        hoaId: params.hoaId,
        targetRole: params.targetRole,
        nomineeUserId: params.nomineeUserId,
        initiatedByUserId: params.initiatedByUserId,
        initiationReason: params.reason,
      } as any);

      return createdVote as any;
    });

    await this.logEvent("hoa.board_transfer_vote_initiated", {
      hoaId: params.hoaId,
      voteId: vote.id,
      initiatedByUserId: params.initiatedByUserId,
      targetRole: params.targetRole,
      nomineeUserId: params.nomineeUserId,
      reason: params.reason,
      requiredQuorum,
      votePassThreshold,
      quorumPercentage,
      endDate: endDate.toISOString(),
    });

    return { voteId: vote.id };
  }

  async finalizeHOABoardTransferVoteIfEnded(voteId: string): Promise<{ status: string } | null> {
    const [vote] = await db.select().from(hoaVotes).where(eq(hoaVotes.id, voteId));
    if (!vote) return null;
    if (vote.status !== "active") return null;
    if (vote.voteType !== "board_role_transfer") return null;

    const now = new Date();
    const endDate = vote.endDate as Date | null | undefined;
    if (endDate && endDate.getTime() > now.getTime()) return null;

    const currentVotes = Number(vote.currentVotes ?? 0);
    const requiredQuorum = Number(vote.requiredQuorum ?? 0);

    if (currentVotes < requiredQuorum) {
      await db
        .update(hoaVotes)
        .set({ status: "failed", updatedAt: now })
        .where(eq(hoaVotes.id, voteId));

      await this.logEvent("hoa.board_transfer_vote_failed", {
        hoaId: vote.hoaId,
        voteId,
        reason: "quorum_not_met",
        requiredQuorum,
        currentVotes,
      });

      return { status: "failed" };
    }

    const votesFor = Number(vote.votesFor ?? 0);
    const votesAgainst = Number(vote.votesAgainst ?? 0);
    const counted = votesFor + votesAgainst;
    const yesPct = counted > 0 ? (votesFor / counted) * 100 : 0;

    const governance = await this.getHOAGovernance(vote.hoaId);
    const threshold = Number(governance?.votePassThreshold);
    if (!Number.isFinite(threshold) || threshold <= 0 || threshold > 100) {
      throw new Error("Invalid HOA vote pass threshold");
    }

    const passed = yesPct >= threshold;

    if (!passed) {
      await db
        .update(hoaVotes)
        .set({ status: "failed", updatedAt: now })
        .where(eq(hoaVotes.id, voteId));

      await this.logEvent("hoa.board_transfer_vote_failed", {
        hoaId: vote.hoaId,
        voteId,
        reason: "threshold_not_met",
        threshold,
        yesPct,
        votesFor,
        votesAgainst,
      });

      return { status: "failed" };
    }

    const result = await db.transaction(async (tx) => {
      const [transfer] = await tx
        .select()
        .from(hoaVoteBoardTransfers)
        .where(eq(hoaVoteBoardTransfers.voteId, voteId));

      if (!transfer) {
        await tx
          .update(hoaVotes)
          .set({ status: "failed", updatedAt: now })
          .where(eq(hoaVotes.id, voteId));
        return {
          status: "failed",
          failedReason: "missing_transfer_metadata",
          fromUserIds: [] as string[],
          toUserId: null as string | null,
          targetRole: null as string | null,
          initiationReason: null as string | null,
          initiatedByUserId: null as string | null,
        };
      }

      const [nomineeMembership] = await tx
        .select({ userId: hoaMembers.userId })
        .from(hoaMembers)
        .where(and(eq(hoaMembers.hoaId, vote.hoaId), eq(hoaMembers.userId, transfer.nomineeUserId)))
        .limit(1);

      if (!nomineeMembership) {
        await tx
          .update(hoaVotes)
          .set({ status: "failed", updatedAt: now })
          .where(eq(hoaVotes.id, voteId));
        return {
          status: "failed",
          failedReason: "nominee_not_member",
          fromUserIds: [] as string[],
          toUserId: transfer.nomineeUserId as string,
          targetRole: transfer.targetRole as string,
          initiationReason: transfer.initiationReason as string,
          initiatedByUserId: transfer.initiatedByUserId as string,
        };
      }

      const prior = await tx
        .select({ userId: hoaMembers.userId })
        .from(hoaMembers)
        .where(and(eq(hoaMembers.hoaId, vote.hoaId), eq(hoaMembers.role, transfer.targetRole)));
      const fromUserIds = prior.map((p) => p.userId);

      await tx
        .update(hoaMembers)
        .set({ role: "member" })
        .where(and(eq(hoaMembers.hoaId, vote.hoaId), eq(hoaMembers.role, transfer.targetRole)));

      await tx
        .update(hoaMembers)
        .set({ role: transfer.targetRole })
        .where(
          and(eq(hoaMembers.hoaId, vote.hoaId), eq(hoaMembers.userId, transfer.nomineeUserId))
        );

      await tx
        .update(hoaVotes)
        .set({ status: "passed", updatedAt: now })
        .where(eq(hoaVotes.id, voteId));

      return {
        status: "passed",
        failedReason: null as string | null,
        fromUserIds,
        toUserId: transfer.nomineeUserId as string,
        targetRole: transfer.targetRole as string,
        initiationReason: transfer.initiationReason as string,
        initiatedByUserId: transfer.initiatedByUserId as string,
      };
    });

    if (result.status === "passed") {
      await this.logEvent("hoa.board_role_transferred", {
        hoaId: vote.hoaId,
        voteId,
        targetRole: result.targetRole,
        fromUserIds: result.fromUserIds,
        toUserId: result.toUserId,
        initiatedByUserId: result.initiatedByUserId,
        initiationReason: result.initiationReason,
        votesFor,
        votesAgainst,
        yesPct,
      });
    } else {
      await this.logEvent("hoa.board_transfer_vote_failed", {
        hoaId: vote.hoaId,
        voteId,
        reason: result.failedReason,
      });
    }

    return { status: result.status };
  }

  async finalizeExpiredHOABoardTransferVotes(hoaId: string): Promise<void> {
    const now = new Date();
    const expired = await db
      .select({ id: hoaVotes.id })
      .from(hoaVotes)
      .where(
        and(
          eq(hoaVotes.hoaId, hoaId),
          eq(hoaVotes.status, "active"),
          eq(hoaVotes.voteType, "board_role_transfer"),
          lte(hoaVotes.endDate, now)
        )
      );

    for (const v of expired) {
      await this.finalizeHOABoardTransferVoteIfEnded(v.id);
    }
  }

  async getHoaVotesForUser(
    hoaId: string,
    userId: string
  ): Promise<
    {
      id: string;
      title: string;
      description: string | null;
      status: string;
      opensAt: string | null;
      closesAt: string | null;
      yesCount?: number;
      noCount?: number;
      abstainCount?: number;
      hasVoted?: boolean;
    }[]
  > {
    const votes = await db
      .select()
      .from(hoaVotes)
      .where(and(eq(hoaVotes.hoaId, hoaId), eq(hoaVotes.status, "active")))
      .orderBy(desc(hoaVotes.createdAt));

    if (votes.length === 0) return [];

    const voteIds = votes.map((v: any) => v.id);
    const responses = await db
      .select()
      .from(hoaVoteResponses)
      .where(and(inArray(hoaVoteResponses.voteId, voteIds), eq(hoaVoteResponses.userId, userId)));

    return votes.map((v: any) => {
      const userResponse = responses.find((r) => r.voteId === v.id);
      return {
        id: v.id,
        title: v.title,
        description: v.description,
        status: v.status,
        opensAt: v.startDate ? (v.startDate as Date).toISOString() : null,
        closesAt: v.endDate ? (v.endDate as Date).toISOString() : null,
        yesCount: typeof v.votesFor === "number" ? v.votesFor : undefined,
        noCount: typeof v.votesAgainst === "number" ? v.votesAgainst : undefined,
        abstainCount: typeof v.votesAbstain === "number" ? v.votesAbstain : undefined,
        hasVoted: Boolean(userResponse),
      };
    });
  }

  async getNotificationsSummary(userId: string): Promise<{
    unreadThreads: number;
    openHoaVotes: number;
  }> {
    // Messages: sum unreadCount across the user's threads
    const threads = await this.getThreadsForUser(userId, {
      limit: 50,
      offset: 0,
    });

    const unreadThreads = threads.reduce((sum, t) => sum + (t.unreadCount ?? 0), 0);

    // HOA: count active votes for any HOA the user belongs to where they
    // haven't yet responded
    let openHoaVotes = 0;

    const memberships = await (this as any).getHoaForUser?.(userId);
    if (Array.isArray(memberships) && memberships.length > 0) {
      for (const membership of memberships) {
        const hoaId = membership.hoaId as string;
        const votes = await this.getHoaVotesForUser(hoaId, userId);
        openHoaVotes += votes.filter((v) => v.status === "active" && !v.hasVoted).length;
      }
    }

    return {
      unreadThreads,
      openHoaVotes,
    };
  }

  async submitHOAVote(userId: string, voteId: string, decision: string): Promise<any> {
    const [voteResponse] = await db
      .insert(hoaVoteResponses)
      .values({
        voteId,
        userId,
        decision,
        submittedAt: new Date(),
      })
      .returning();

    await db
      .update(hoaVotes)
      .set({
        currentVotes: sql`${hoaVotes.currentVotes} + 1`,
        votesFor: decision === "for" ? sql`${hoaVotes.votesFor} + 1` : hoaVotes.votesFor,
        votesAgainst:
          decision === "against" ? sql`${hoaVotes.votesAgainst} + 1` : hoaVotes.votesAgainst,
        votesAbstain:
          decision === "abstain" ? sql`${hoaVotes.votesAbstain} + 1` : hoaVotes.votesAbstain,
      })
      .where(eq(hoaVotes.id, voteId));

    // Board role transfers finalize automatically when the vote window closes.
    // This keeps authority transfer deterministic and governed by the HOA's voting rules.
    await this.finalizeHOABoardTransferVoteIfEnded(voteId);

    return voteResponse;
  }

  async getHoaForUser(userId: string): Promise<
    {
      hoaId: string;
      hoaName: string;
      role: string;
      status: string;
      stateCode: string | null;
      countyFips: string | null;
      groupType: "hoa";
    }[]
  > {
    const memberships = await db
      .select({
        hoaId: hoaMembers.hoaId,
        role: hoaMembers.role,
        inGoodStanding: hoaMembers.inGoodStanding,
        hoaName: homeownerAssociations.name,
        state: homeownerAssociations.state,
        countyFips: homeownerAssociations.countyFips,
      })
      .from(hoaMembers)
      .innerJoin(homeownerAssociations, eq(hoaMembers.hoaId, homeownerAssociations.id))
      .where(eq(hoaMembers.userId, userId));

    return memberships.map((m) => ({
      hoaId: m.hoaId,
      hoaName: m.hoaName,
      role: m.role,
      status: m.inGoodStanding ? "active" : "not_in_good_standing",
      stateCode: m.state ?? null,
      countyFips: m.countyFips ?? null,
      groupType: "hoa" as const,
    }));
  }

  async getHoaDashboard(hoaId: string): Promise<{
    hoaId: string;
    hoaName: string;
    memberCount: number;
    activeMembers: number;
    openVotesCount: number;
    groupType: "hoa";
    governance?: any;
    recentVotes: {
      id: string;
      title: string;
      status: string;
      closesAt: string | null;
    }[];
    balance?: number;
    recentTransactions?: {
      id: string;
      type: string;
      amount: number;
      occurredAt: string;
    }[];
  } | null> {
    const [hoa] = await db
      .select({
        id: homeownerAssociations.id,
        name: homeownerAssociations.name,
      })
      .from(homeownerAssociations)
      .where(eq(homeownerAssociations.id, hoaId));

    if (!hoa) return null;

    const [members, openVotes, finances, governance] = await Promise.all([
      db
        .select({
          id: hoaMembers.id,
          inGoodStanding: hoaMembers.inGoodStanding,
        })
        .from(hoaMembers)
        .where(eq(hoaMembers.hoaId, hoaId)),
      db
        .select({
          id: hoaVotes.id,
          title: hoaVotes.title,
          status: hoaVotes.status,
          endDate: hoaVotes.endDate,
        })
        .from(hoaVotes)
        .where(and(eq(hoaVotes.hoaId, hoaId), eq(hoaVotes.status, "active")))
        .orderBy(desc(hoaVotes.createdAt))
        .limit(5),
      db
        .select()
        .from(hoaFinancialRecords)
        .where(eq(hoaFinancialRecords.hoaId, hoaId))
        .orderBy(desc(hoaFinancialRecords.year), desc(hoaFinancialRecords.month))
        .limit(6),
      this.getHOAGovernance(hoaId),
    ]);

    const memberCount = members.length;
    const activeMembers = members.filter((m) => m.inGoodStanding).length;
    const openVotesCount = openVotes.length;

    let balance: number | undefined;
    const recentTransactions: { id: string; type: string; amount: number; occurredAt: string }[] =
      [];

    if (finances.length > 0) {
      const latest = finances[0];
      const reserves = Number(latest.reserves || 0);
      const outstandingFees = Number(latest.outstandingFees || 0);
      balance = reserves - outstandingFees;

      finances.forEach((rec: any) => {
        const monthLabel = `${rec.year}-${String(rec.month).padStart(2, "0")}`;
        if (rec.totalRevenue) {
          recentTransactions.push({
            id: `${rec.id}-rev`,
            type: "revenue",
            amount: Number(rec.totalRevenue),
            occurredAt: monthLabel,
          });
        }
        if (rec.totalExpenses) {
          recentTransactions.push({
            id: `${rec.id}-exp`,
            type: "expense",
            amount: Number(rec.totalExpenses),
            occurredAt: monthLabel,
          });
        }
      });
    }

    return {
      hoaId: hoa.id,
      hoaName: hoa.name,
      memberCount,
      activeMembers,
      openVotesCount,
      groupType: "hoa" as const,
      governance,
      recentVotes: openVotes.map((v) => ({
        id: v.id,
        title: v.title,
        status: v.status ?? "open",
        closesAt: v.endDate ? (v.endDate as Date).toISOString() : null,
      })),
      balance,
      recentTransactions,
    };
  }

  async createVendorServiceRequest(request: {
    userId: string;
    vendorId: string;
    serviceType: string;
    description: string;
    urgency: string;
    contactPreference: string;
  }): Promise<any> {
    const vendor = await db
      .select()
      .from(hoaVendors)
      .where(eq(hoaVendors.id, request.vendorId))
      .limit(1);
    if (!vendor[0]) throw new Error("Vendor not found");

    const [serviceRequest] = await db
      .insert(hoaServiceRequests)
      .values({
        hoaId: vendor[0].hoaId,
        vendorId: request.vendorId,
        userId: request.userId,
        serviceType: request.serviceType,
        description: request.description,
        urgency: request.urgency,
        contactPreference: request.contactPreference,
        status: "submitted",
      })
      .returning();

    return serviceRequest;
  }

  // HOA Member Management
  async getHOAMemberByUserId(userId: string, hoaId: string): Promise<any> {
    const [member] = await db
      .select()
      .from(hoaMembers)
      .where(and(eq(hoaMembers.userId, userId), eq(hoaMembers.hoaId, hoaId)));
    return member;
  }

  async leaveHOA(userId: string, hoaId: string): Promise<void> {
    await db
      .delete(hoaMembers)
      .where(and(eq(hoaMembers.userId, userId), eq(hoaMembers.hoaId, hoaId)));
  }

  async leaveHOAWithReason(params: {
    userId: string;
    hoaId: string;
    reason: string;
    membershipRole?: string | null;
    actorUserId?: string | null;
  }): Promise<void> {
    const actorUserId = params.actorUserId || params.userId;
    await db.transaction(async (tx) => {
      await tx.insert(hoaMembershipDepartures).values({
        hoaId: params.hoaId,
        userId: params.userId,
        actorUserId,
        membershipRole: params.membershipRole ?? null,
        reason: params.reason,
      });

      await tx
        .delete(hoaMembers)
        .where(and(eq(hoaMembers.userId, params.userId), eq(hoaMembers.hoaId, params.hoaId)));
    });
  }

  async getHOAMembers(hoaId: string): Promise<any[]> {
    return await db
      .select()
      .from(hoaMembers)
      .where(eq(hoaMembers.hoaId, hoaId))
      .orderBy(hoaMembers.role);
  }

  async addHOAMember(data: {
    hoaId: string;
    userId: string;
    unitNumber?: string;
    role?: string;
    votingRights?: boolean;
  }): Promise<any> {
    const role = data.role || "member";

    // Set permissions based on role
    const permissions = this.getPermissionsByRole(role);

    const [member] = await db
      .insert(hoaMembers)
      .values({
        hoaId: data.hoaId,
        userId: data.userId,
        unitNumber: data.unitNumber,
        role,
        votingRights: data.votingRights ?? true,
        ...permissions,
      })
      .returning();

    return member;
  }

  async updateHOAMemberRole(memberId: string, role: string): Promise<any> {
    const permissions = this.getPermissionsByRole(role);

    const [updated] = await db
      .update(hoaMembers)
      .set({
        role,
        ...permissions,
        updatedAt: new Date(),
      })
      .where(eq(hoaMembers.id, memberId))
      .returning();

    return updated;
  }

  private getPermissionsByRole(role: string) {
    const permissions = {
      canViewFinances: false,
      canEditDocuments: false,
      canManageVendors: false,
      canCreateVotes: false,
    };

    switch (role) {
      case "president":
        return {
          canViewFinances: true,
          canEditDocuments: true,
          canManageVendors: true,
          canCreateVotes: true,
        };
      case "vice_president":
        return {
          canViewFinances: true,
          canEditDocuments: true,
          canManageVendors: true,
          canCreateVotes: true,
        };
      case "treasurer":
        return {
          canViewFinances: true,
          canEditDocuments: true,
          canManageVendors: false,
          canCreateVotes: true,
        };
      case "secretary":
        return {
          canViewFinances: false,
          canEditDocuments: true,
          canManageVendors: false,
          canCreateVotes: true,
        };
      case "board_member":
        return {
          canViewFinances: true,
          canEditDocuments: false,
          canManageVendors: false,
          canCreateVotes: true,
        };
      default: // member
        return permissions;
    }
  }

  // HOA Governance Configuration
  async getHOAGovernance(hoaId: string): Promise<any> {
    const [governance] = await db
      .select()
      .from(hoaGovernance)
      .where(eq(hoaGovernance.hoaId, hoaId));

    // Return defaults if no governance config exists yet
    if (!governance) {
      return {
        hoaId,
        governanceModel: "elected_board",
        votingEnabled: true,
        financialsEnabled: true,
        vendorManagementEnabled: true,
        documentLibraryEnabled: true,
        residentsDirectoryEnabled: true,
        maintenanceRequestsEnabled: true,
        quorumPercentage: 50,
        votePassThreshold: 51,
        allowProxyVoting: false,
      };
    }

    return governance;
  }

  async upsertHOAGovernance(hoaId: string, config: Partial<any>): Promise<any> {
    const existing = await this.getHOAGovernance(hoaId);

    if (!existing.id) {
      // Create new
      const [created] = await db
        .insert(hoaGovernance)
        .values({
          hoaId,
          ...config,
        })
        .returning();
      return created;
    } else {
      // Update existing
      const [updated] = await db
        .update(hoaGovernance)
        .set({
          ...config,
          updatedAt: new Date(),
        })
        .where(eq(hoaGovernance.id, existing.id))
        .returning();
      return updated;
    }
  }

  // Groups/Community operations

  async getGroups(filters: {
    stateCode?: string;
    countyFips?: string;
    limit: number;
    offset: number;
    search?: string;
    userId?: string;
  }): Promise<
    {
      id: string;
      name: string;
      description: string | null;
      category: string | null;
      stateCode: string | null;
      countyFips: string | null;
      memberCount: number;
      isMember: boolean;
      isAdmin: boolean;
    }[]
  > {
    const { stateCode, countyFips, limit, offset, search, userId } = filters;

    // Base query for active groups scoped by geography when provided
    const baseConditions: SQL[] = [eq(communityGroups.isActive, true)];
    if (stateCode) baseConditions.push(eq(communityGroups.stateCode, stateCode));
    if (countyFips) baseConditions.push(eq(communityGroups.countyFips, countyFips));

    const baseQuery = db
      .select()
      .from(communityGroups)
      .where(and(...baseConditions) ?? sql`true`)
      .limit(limit)
      .offset(offset);

    if (!userId) {
      const groups = await baseQuery;

      let filtered = groups as CommunityGroup[];
      if (search) {
        const needle = search.toLowerCase();
        filtered = filtered.filter((g) => g.name.toLowerCase().includes(needle));
      }

      return filtered.map((group) => ({
        id: group.id,
        name: group.name,
        description: group.description ?? null,
        category: (group.groupType as string) ?? null,
        stateCode: group.stateCode ?? null,
        countyFips: group.countyFips ?? null,
        memberCount: group.memberCount ?? 0,
        isMember: false,
        isAdmin: false,
      }));
    }

    // When a user is provided, join membership to compute isMember/isAdmin
    const rows = await db
      .select({ group: communityGroups, membership: groupMembers })
      .from(communityGroups)
      .leftJoin(
        groupMembers,
        and(eq(groupMembers.groupId, communityGroups.id), eq(groupMembers.userId, userId as string))
      )
      .where(
        and(
          eq(communityGroups.isActive, true),
          stateCode ? eq(communityGroups.stateCode, stateCode) : sql`true`,
          countyFips ? eq(communityGroups.countyFips, countyFips) : sql`true`
        ) as any
      )
      .limit(limit)
      .offset(offset);

    let mapped = rows.map(({ group, membership }) => {
      const activeMember = membership && membership.isActive && !membership.isBanned;
      const membershipRole = membership?.role;
      const isAdmin =
        !!activeMember &&
        (membershipRole === "admin" ||
          membershipRole === "owner" ||
          membershipRole === "moderator");

      return {
        id: group.id,
        name: group.name,
        description: group.description ?? null,
        category: (group.groupType as string) ?? null,
        stateCode: group.stateCode ?? null,
        countyFips: group.countyFips ?? null,
        memberCount: group.memberCount ?? 0,
        isMember: !!activeMember,
        isAdmin,
      };
    });

    if (search) {
      const needle = search.toLowerCase();
      mapped = mapped.filter((g) => g.name.toLowerCase().includes(needle));
    }

    return mapped;
  }

  async getGroupById(groupId: string): Promise<any> {
    const [group] = await db.select().from(communityGroups).where(eq(communityGroups.id, groupId));
    return group;
  }

  async joinGroup(userId: string, groupId: string): Promise<any> {
    // Check for existing membership to make this operation idempotent
    const [existing] = await db
      .select()
      .from(groupMembers)
      .where(and(eq(groupMembers.userId, userId), eq(groupMembers.groupId, groupId)))
      .limit(1);

    if (existing && existing.isActive && !existing.isBanned) {
      return existing;
    }

    if (existing && !existing.isActive && !existing.isBanned) {
      const [updated] = await db
        .update(groupMembers)
        .set({ isActive: true, joinedAt: sql`now()` })
        .where(eq(groupMembers.id, existing.id))
        .returning();

      await db
        .update(communityGroups)
        .set({ memberCount: sql`${communityGroups.memberCount} + 1` })
        .where(eq(communityGroups.id, groupId));

      return updated;
    }

    const [membership] = await db
      .insert(groupMembers)
      .values({
        groupId,
        userId,
        role: "member",
        isActive: true,
      })
      .returning();

    await db
      .update(communityGroups)
      .set({ memberCount: sql`${communityGroups.memberCount} + 1` })
      .where(eq(communityGroups.id, groupId));

    return membership;
  }

  async leaveGroup(userId: string, groupId: string): Promise<void> {
    const [activeMembership] = await db
      .select()
      .from(groupMembers)
      .where(
        and(
          eq(groupMembers.userId, userId),
          eq(groupMembers.groupId, groupId),
          eq(groupMembers.isActive, true)
        )
      )
      .limit(1);

    if (!activeMembership) {
      return;
    }

    await db
      .update(groupMembers)
      .set({ isActive: false })
      .where(eq(groupMembers.id, activeMembership.id));

    await db
      .update(communityGroups)
      .set({ memberCount: sql`${communityGroups.memberCount} - 1` })
      .where(eq(communityGroups.id, groupId));
  }

  async getGroupPosts(groupId: string): Promise<any[]> {
    const groupTag = `group:${groupId}`;
    return await db
      .select()
      .from(communityPosts)
      .where(
        and(
          eq(communityPosts.isPublished, true),
          sql`${communityPosts.tags} @> ARRAY[${groupTag}]::text[]`
        ) ?? sql`true`
      )
      .orderBy(desc(communityPosts.createdAt))
      .limit(50);
  }

  async createGroupPost(post: {
    groupId: string;
    authorId: string;
    content: string;
    images?: string[];
  }): Promise<any> {
    const groupTag = `group:${post.groupId}`;
    const [newPost] = await db
      .insert(communityPosts)
      .values({
        authorId: post.authorId,
        content: post.content,
        imageUrls: this.coerceStringArray(post.images) ?? [],
        category: "general",
        tags: [groupTag],
      })
      .returning();

    await db
      .update(communityGroups)
      .set({ postCount: sql`${communityGroups.postCount} + 1` })
      .where(eq(communityGroups.id, post.groupId));

    return newPost;
  }

  // Boosts/Promotions operations
  async getBoostsByRole(_userRole: string): Promise<any[]> {
    return await db
      .select()
      .from(contractorPromos)
      .where(eq(contractorPromos.isActive, true))
      .orderBy(desc(contractorPromos.createdAt))
      .limit(20);
  }

  async purchaseBoost(data: {
    userId: string;
    boostId: string;
    paymentMethodId?: string;
  }): Promise<any> {
    const [promo] = await db
      .select()
      .from(contractorPromos)
      .where(eq(contractorPromos.id, data.boostId));
    if (!promo) throw new Error("Boost not found");

    const [interaction] = await db
      .insert(promoInteractions)
      .values({
        promoId: data.boostId,
        userId: data.userId,
        interactionType: "click",
        metadata: {
          source: "direct",
          campaign: "boost_purchase",
          medium: data.paymentMethodId ? "payment_method" : undefined,
        },
      })
      .returning();

    return {
      id: interaction.id,
      userId: data.userId,
      boostId: data.boostId,
      status: "active",
      startDate: new Date().toISOString(),
      endDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      impressions: 0,
      clicks: 0,
      conversions: 0,
      totalSpent: "49.99",
      createdAt: new Date().toISOString(),
    };
  }

  async getUserBoosts(userId: string): Promise<any[]> {
    return await db
      .select()
      .from(promoInteractions)
      .where(
        and(eq(promoInteractions.userId, userId), eq(promoInteractions.interactionType, "click"))
      )
      .orderBy(desc(promoInteractions.createdAt))
      .limit(50);
  }

  async getBoostAnalytics(boostId: string, userId: string): Promise<any> {
    const interactions = await db
      .select()
      .from(promoInteractions)
      .where(and(eq(promoInteractions.promoId, boostId), eq(promoInteractions.userId, userId)));

    const totalImpressions = interactions.filter((i: any) => i.interactionType === "view").length;
    const totalClicks = interactions.filter((i: any) => i.interactionType === "click").length;
    const conversions = interactions.filter(
      (i: any) => i.interactionType === "contact_made" || i.interactionType === "project_request"
    ).length;

    return {
      impressions: totalImpressions,
      clicks: totalClicks,
      conversions,
      ctr: totalImpressions > 0 ? ((totalClicks / totalImpressions) * 100).toFixed(2) : "0",
    };
  }

  // Nationwide Dashboard operations
  async getNationwideMetrics(): Promise<{
    totalUsers: number;
    totalContractors: number;
    totalProjects: number;
    totalRevenue: string;
  }> {
    const [userCount] = await db.select({ count: sql<number>`count(*)::int` }).from(users);
    const [contractorCount] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(contractors);
    const [projectCount] = await db.select({ count: sql<number>`count(*)::int` }).from(leads);

    return {
      totalUsers: userCount?.count || 0,
      totalContractors: contractorCount?.count || 0,
      totalProjects: projectCount?.count || 0,
      totalRevenue: "0",
    };
  }

  async getTopPerformingCounties(limit: number): Promise<any[]> {
    const results = await db
      .select({
        fips: counties.fips,
        contractorCount: sql<number>`count(distinct ${contractorCounties.contractorId})::int`,
        avgScore: sql<number>`avg(${contractors.recommendationScore})::float`,
      })
      .from(contractorCounties)
      .leftJoin(counties, eq(contractorCounties.countyId, counties.id))
      .leftJoin(contractors, eq(contractorCounties.contractorId, contractors.id))
      .groupBy(counties.fips)
      .orderBy(sql`count(distinct ${contractorCounties.contractorId}) desc`)
      .limit(limit);

    return results.map((r: any) => ({
      fips: r.fips,
      contractorCount: r.contractorCount || 0,
      avgRating: r.avgScore || 0,
      growthRate: 0,
    }));
  }

  async getExpansionPipeline(): Promise<any[]> {
    const countiesWithData = await db
      .select({
        fips: counties.fips,
        name: counties.name,
        state: counties.stateCode,
        population: counties.population,
      })
      .from(counties)
      .limit(100);

    return countiesWithData.map((c: any) => ({
      county: c.name,
      state: c.state,
      population: c.population || 0,
      status: "planning",
      priority: "medium",
      estimatedLaunch: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString(),
    }));
  }

  async getGeographicDistribution(): Promise<any> {
    const distribution = await db
      .select({
        state: users.state,
        userCount: sql<number>`count(*)::int`,
      })
      .from(users)
      .where(sql`${users.state} IS NOT NULL`)
      .groupBy(users.state);

    return distribution.reduce((acc: any, item: any) => {
      if (item.state) {
        acc[item.state] = item.userCount;
      }
      return acc;
    }, {});
  }

  async getPlatformStatistics(): Promise<{
    totalContractors: number;
    totalHomeowners: number;
    totalProjectsCompleted: number;
    successRate: number;
    totalProjectValue: number;
  }> {
    try {
      // Count all active contractors
      const contractorsResult = await db.execute(
        sql`SELECT COUNT(*)::int as count FROM ${contractors} WHERE is_active = true`
      );
      const totalContractors = (contractorsResult.rows[0] as any)?.count || 0;

      // Count homeowners
      const homeownersResult = await db.execute(
        sql`SELECT COUNT(*)::int as count FROM ${users} WHERE role = 'homeowner'`
      );
      const totalHomeowners = (homeownersResult.rows[0] as any)?.count || 0;

      // Count completed projects
      const projectsResult = await db.execute(
        sql`SELECT COUNT(*)::int as count FROM ${leads} WHERE status = 'completed'`
      );
      const totalProjectsCompleted = (projectsResult.rows[0] as any)?.count || 0;

      // Calculate success rate
      const finishedResult = await db.execute(
        sql`SELECT COUNT(*)::int as count FROM ${leads} WHERE status IN ('completed', 'cancelled')`
      );
      const totalFinished = (finishedResult.rows[0] as any)?.count || 0;
      const successRate = totalFinished > 0 ? (totalProjectsCompleted / totalFinished) * 100 : 99.2;

      // Calculate total project value
      const valueResult = await db.execute(
        sql`SELECT COALESCE(SUM(estimated_value::numeric), 0)::numeric as total FROM ${leads} WHERE status = 'completed'`
      );
      const totalProjectValue = Number((valueResult.rows[0] as any)?.total || 0);

      return {
        totalContractors,
        totalHomeowners,
        totalProjectsCompleted,
        successRate: Math.min(successRate, 100),
        totalProjectValue,
      };
    } catch (error) {
      console.error("Error fetching platform statistics:", error);
      // Return default values if query fails
      return {
        totalContractors: 0,
        totalHomeowners: 0,
        totalProjectsCompleted: 0,
        successRate: 99.2,
        totalProjectValue: 0,
      };
    }
  }

  // ==================== COMMUNITY BUILDER METHODS ====================

  async createBuilderProfile(
    userId: string,
    countyId: string,
    data: Partial<CommunityBuilderProfile>
  ): Promise<CommunityBuilderProfile> {
    const [profile] = await db
      .insert(communityBuilderProfiles)
      .values({
        userId,
        countyId,
        businessName: data.businessName,
        description: data.description,
        profileImageUrl: data.profileImageUrl,
        website: data.website,
        payoutEmail: data.payoutEmail,
      })
      .returning();
    return profile;
  }

  async getBuilderProfile(userId: string): Promise<CommunityBuilderProfile | null> {
    const [profile] = await db
      .select()
      .from(communityBuilderProfiles)
      .where(eq(communityBuilderProfiles.userId, userId));
    return profile || null;
  }

  async getBuilderById(builderId: string): Promise<CommunityBuilderProfile | null> {
    const [profile] = await db
      .select()
      .from(communityBuilderProfiles)
      .where(eq(communityBuilderProfiles.id, builderId));
    return profile || null;
  }

  async getBuildersByCounty(countyId: string): Promise<CommunityBuilderProfile[]> {
    return db
      .select()
      .from(communityBuilderProfiles)
      .where(eq(communityBuilderProfiles.countyId, countyId));
  }

  async updateBuilderProfile(
    builderId: string,
    updates: Partial<CommunityBuilderProfile>
  ): Promise<CommunityBuilderProfile> {
    const [updated] = await db
      .update(communityBuilderProfiles)
      .set({
        businessName: updates.businessName,
        description: updates.description,
        profileImageUrl: updates.profileImageUrl,
        website: updates.website,
        payoutEmail: updates.payoutEmail,
        currentRank: updates.currentRank,
        ratingScore: updates.ratingScore,
        status: updates.status,
        updatedAt: new Date(),
      })
      .where(eq(communityBuilderProfiles.id, builderId))
      .returning();
    return updated;
  }

  async proposeContribution(
    builderId: string,
    data: InsertBuilderContribution
  ): Promise<BuilderContribution> {
    const [contribution] = await db
      .insert(builderContributions)
      .values({
        ...data,
        builderId,
        status: "proposed",
      })
      .returning();
    return contribution;
  }

  async getContribution(contributionId: string): Promise<BuilderContribution | null> {
    const [contribution] = await db
      .select()
      .from(builderContributions)
      .where(eq(builderContributions.id, contributionId));
    return contribution || null;
  }

  async updateContributionStatus(
    contributionId: string,
    status: string,
    updates?: Partial<BuilderContribution>
  ): Promise<BuilderContribution> {
    const [updated] = await db
      .update(builderContributions)
      .set({
        status: status as any,
        ...updates,
        updatedAt: new Date(),
      })
      .where(eq(builderContributions.id, contributionId))
      .returning();
    return updated;
  }

  async approveContribution(
    contributionId: string,
    approverUserId: string
  ): Promise<BuilderContribution> {
    return this.updateContributionStatus(contributionId, "approved", {
      approvedBy: approverUserId,
      approvedAt: new Date(),
    });
  }

  async verifyContribution(
    contributionId: string,
    verifierId: string,
    actualValue?: string,
    actualHours?: string
  ): Promise<BuilderContribution> {
    return this.updateContributionStatus(contributionId, "verified", {
      verifiedBy: verifierId,
      verifiedAt: new Date(),
      actualValue: actualValue ? decimal(actualValue) : undefined,
      actualHours: actualHours ? decimal(actualHours) : undefined,
    });
  }

  async getBuilderContributions(builderId: string): Promise<BuilderContribution[]> {
    return db
      .select()
      .from(builderContributions)
      .where(eq(builderContributions.builderId, builderId))
      .orderBy(desc(builderContributions.createdAt));
  }

  async getCountyContributions(countyId: string, status?: string): Promise<BuilderContribution[]> {
    const conditions: SQL[] = [eq(builderContributions.countyId, countyId)];
    if (status) conditions.push(eq(builderContributions.status, status as any));

    return db
      .select()
      .from(builderContributions)
      .where(and(...conditions))
      .orderBy(desc(builderContributions.createdAt));
  }

  async createAuditLog(auditData: Partial<BuilderAuditLog>): Promise<BuilderAuditLog> {
    if (!auditData.action || !auditData.contributionId || !auditData.auditorId) {
      throw new Error("Invalid audit log payload");
    }
    const [log] = await db
      .insert(builderAuditLogs)
      .values(auditData as any)
      .returning();
    return log;
  }

  async getAuditLogs(contributionId: string): Promise<BuilderAuditLog[]> {
    return db
      .select()
      .from(builderAuditLogs)
      .where(eq(builderAuditLogs.contributionId, contributionId))
      .orderBy(desc(builderAuditLogs.createdAt));
  }

  async recordPayout(payoutData: InsertBuilderPayout): Promise<BuilderPayout> {
    const [payout] = await db
      .insert(builderPayouts)
      .values({
        ...payoutData,
        status: "pending",
      })
      .returning();
    return payout;
  }

  async getPayout(payoutId: string): Promise<BuilderPayout | null> {
    const [payout] = await db.select().from(builderPayouts).where(eq(builderPayouts.id, payoutId));
    return payout || null;
  }

  async updateBuilderPayoutStatus(
    payoutId: string,
    status: string,
    updates?: Partial<BuilderPayout>
  ): Promise<BuilderPayout> {
    const [updated] = await db
      .update(builderPayouts)
      .set({
        status,
        processedAt: status === "completed" ? new Date() : undefined,
        ...updates,
        updatedAt: new Date(),
      })
      .where(eq(builderPayouts.id, payoutId))
      .returning();
    return updated;
  }

  async getBuilderPayouts(builderId: string): Promise<BuilderPayout[]> {
    return db
      .select()
      .from(builderPayouts)
      .where(eq(builderPayouts.builderId, builderId))
      .orderBy(desc(builderPayouts.createdAt));
  }

  async updateLeaderboard(
    builderId: string,
    metrics: Partial<BuilderLeaderboard>
  ): Promise<BuilderLeaderboard> {
    const existing = await db
      .select()
      .from(builderLeaderboard)
      .where(eq(builderLeaderboard.builderId, builderId));

    if (existing.length === 0) {
      const builder = await this.getBuilderById(builderId);
      if (!builder?.countyId) throw new Error("Builder countyId is required");
      const [entry] = await db
        .insert(builderLeaderboard)
        .values({ ...metrics, builderId, countyId: builder.countyId } as any)
        .returning();
      return entry;
    }

    const [updated] = await db
      .update(builderLeaderboard)
      .set({
        ...metrics,
        lastUpdated: new Date(),
      })
      .where(eq(builderLeaderboard.builderId, builderId))
      .returning();
    return updated;
  }

  async getLeaderboard(countyId: string): Promise<BuilderLeaderboard[]> {
    return db
      .select()
      .from(builderLeaderboard)
      .where(eq(builderLeaderboard.countyId, countyId))
      .orderBy(desc(builderLeaderboard.overallRank));
  }

  async createReferral(referrerId: string, referredBuilderId: string): Promise<BuilderReferral> {
    const referralCode = `BUILD-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;
    const [referral] = await db
      .insert(builderReferrals)
      .values({
        referrerId,
        referredBuilderId,
        referralCode,
      })
      .returning();
    return referral;
  }

  async sendBuilderNotification(
    builderId: string,
    type: string,
    title: string,
    message: string,
    relatedId?: string,
    actionUrl?: string
  ): Promise<BuilderNotification> {
    const [notification] = await db
      .insert(builderNotifications)
      .values({
        builderId,
        type,
        title,
        message,
        relatedId,
        actionUrl,
      })
      .returning();
    return notification;
  }

  async getBuilderNotifications(
    builderId: string,
    unreadOnly?: boolean
  ): Promise<BuilderNotification[]> {
    const conditions: SQL[] = [eq(builderNotifications.builderId, builderId)];
    if (unreadOnly) conditions.push(eq(builderNotifications.isRead, false));

    return db
      .select()
      .from(builderNotifications)
      .where(and(...conditions))
      .orderBy(desc(builderNotifications.createdAt));
  }

  async markBuilderNotificationAsRead(notificationId: string): Promise<BuilderNotification> {
    const [updated] = await db
      .update(builderNotifications)
      .set({
        isRead: true,
        readAt: new Date(),
      })
      .where(eq(builderNotifications.id, notificationId))
      .returning();
    return updated;
  }

  async calculateBuilderStats(builderId: string): Promise<{
    totalContributions: number;
    totalValue: string;
    totalHours: string;
    completedCount: number;
    verificationRate: number;
  }> {
    const contributions = await this.getBuilderContributions(builderId);
    const completed = contributions.filter((c) => c.status === "verified");
    const verified = contributions.filter((c) => c.verifiedAt);

    const totalValue = contributions.reduce((sum, c) => {
      const value = c.actualValue || c.estimatedValue || "0";
      return sum + Number(value);
    }, 0);

    const totalHours = contributions.reduce((sum, c) => {
      const hours = c.actualHours || c.estimatedHours || "0";
      return sum + Number(hours);
    }, 0);

    return {
      totalContributions: contributions.length,
      totalValue: totalValue.toFixed(2),
      totalHours: totalHours.toFixed(2),
      completedCount: completed.length,
      verificationRate:
        contributions.length > 0 ? (verified.length / contributions.length) * 100 : 100,
    };
  }

  /**
   * PHASE 3d-C: Business Profile v1 Methods
   * Published presence surface for profileDraft → businessProfiles
   */

  async getBusinessProfileBySlug(
    slug: string
  ): Promise<import("../shared/businessProfile").BusinessProfile | undefined> {
    // For now, using user preferences.provisional.profileDraft as temporary storage
    // Until businessProfiles table is added to schema
    const rows = await db.select().from(users).where(eq(users.businessSlug, slug));
    if (rows.length === 0) return undefined;

    const user = rows[0];
    const provisional = (user.preferences as any)?.provisional;
    const profileDraft = provisional?.profileDraft;

    if (!profileDraft) return undefined;

    const createdAt = user.createdAt ? user.createdAt.toISOString() : new Date().toISOString();

    return {
      id: user.id,
      userId: user.id,
      slug,
      name: profileDraft.businessName || `${user.firstName} ${user.lastName}`,
      headline: profileDraft.headline || null,
      description: profileDraft.description || null,
      services: Array.isArray(profileDraft.services) ? profileDraft.services : null,
      countyFips: profileDraft.countyFips,
      countyName: profileDraft.countyName || null,
      city: profileDraft.city || null,
      address: profileDraft.address || null,
      zipCode: profileDraft.zipCode || null,
      stateCode: profileDraft.stateCode,
      serviceAreas: profileDraft.serviceAreas?.map((sa: any) => sa.countyFips || sa) || [
        profileDraft.countyFips,
      ],
      website: profileDraft.website || null,
      seoMeta: profileDraft.seoMeta || null,
      ctaConfig: profileDraft.ctaConfig || null,
      contentBlocks: Array.isArray(profileDraft.contentBlocks) ? profileDraft.contentBlocks : null,
      profileSections: profileDraft.profileSections || null,
      theme: profileDraft.theme || null,
      bookingConfig: profileDraft.bookingConfig || null,
      visibility: profileDraft.visibility === "public" ? "public" : "private",
      customDomain: profileDraft.customDomain || null,
      customDomainVerification: profileDraft.customDomainVerification || null,
      verificationStatus: user.verificationStatus,
      verifiedBadge: user.verifiedBadge === true,
      addressVerified: user.addressVerified ?? undefined,
      cvsScore: (user as any).cvsScore ?? null,
      createdAt,
      updatedAt: user.updatedAt?.toISOString() || createdAt,
      publishedAt: createdAt,
    };
  }

  async getBusinessProfileByUserId(
    userId: string
  ): Promise<import("../shared/businessProfile").BusinessProfile | undefined> {
    const user = await this.getUser(userId);
    if (!user || !user.businessSlug) return undefined;

    return this.getBusinessProfileBySlug(user.businessSlug);
  }

  async saveBusinessProfile(
    profile: import("../shared/businessProfile").BusinessProfile
  ): Promise<import("../shared/businessProfile").BusinessProfile> {
    // Update user record with slug
    const user = await this.getUser(profile.userId);
    if (!user) throw new Error("User not found");

    // Store business profile data in preferences.provisional.profileDraft for now
    const preferences = (user.preferences as any) || {};
    const provisional = preferences.provisional || {};
    const existingDraft = provisional.profileDraft || {};

    const nextDraft: any = {
      ...existingDraft,
      presenceType: "represent_business",
      stateCode: profile.stateCode,
      countyFips: profile.countyFips,
      countyName: profile.countyName,
      city: profile.city,
      address: profile.address ?? null,
      zipCode: profile.zipCode ?? null,
      businessName: profile.name,
      headline: profile.headline ?? null,
      description: profile.description,
      services: Array.isArray(profile.services) ? profile.services : [],
      website: profile.website,
      seoMeta: profile.seoMeta ?? null,
      ctaConfig: profile.ctaConfig ?? null,
      contentBlocks: Array.isArray(profile.contentBlocks) ? profile.contentBlocks : [],
      profileSections: profile.profileSections ?? null,
      theme: profile.theme ?? null,
      bookingConfig: profile.bookingConfig ?? null,
      visibility: profile.visibility === "public" ? "public" : "private",
      serviceAreas: profile.serviceAreas.map((fips: string) => ({ countyFips: fips })),
      capturedAt: new Date().toISOString(),
    };

    if (typeof profile.customDomain !== "undefined") {
      nextDraft.customDomain = profile.customDomain || null;
    }

    if (typeof profile.customDomainVerification !== "undefined") {
      nextDraft.customDomainVerification = profile.customDomainVerification;
    }

    provisional.profileDraft = nextDraft;

    preferences.provisional = provisional;

    await db
      .update(users)
      .set({
        businessSlug: profile.slug,
        preferences: preferences as any,
        updatedAt: new Date(),
      })
      .where(eq(users.id, profile.userId));

    return profile;
  }
}

export const storage = new DatabaseStorage();
