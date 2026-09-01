/* eslint-disable @typescript-eslint/no-explicit-any -- Storage contracts include legacy JSON payloads; implementation hardening is tracked separately. */
import {
  affiliateAccounts,
  affiliateReferrals,
  affiliatePayouts,
  type HomeScoutListing,
  type InsertHomeScoutListing,
  type HomeScoutSource,
  type InsertHomeScoutSource,
  type HomeScoutIngestRun,
  type InsertHomeScoutIngestRun,
  type HomeScoutListingEvent,
  type InsertHomeScoutListingEvent,
  type HomeScoutMarketBucket,
  type InsertHomeScoutMarketBucket,
  type HomeScoutListingReport,
  type InsertHomeScoutListingReport,
  type HomeScoutInspectionRequest,
  type InsertHomeScoutInspectionRequest,
  type HomeScoutInspectionReport,
  type InsertHomeScoutInspectionReport,
  type HomeScoutInspectionServiceRequest,
  type InsertHomeScoutInspectionServiceRequest,
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
  type AdEvent,
  type InsertAdEvent,
  type MarketplaceCategory,
  type InsertMarketplaceCategory,
  type MarketplaceListing,
  type InsertMarketplaceListing,
  type MarketplaceInquiry,
  type InsertMarketplaceInquiry,
  type MarketplaceFavorite,
  type InsertMarketplaceFavorite,
  type MarketplaceReport,
  type InsertMarketplaceReport,
  type VendorVerification,
  type InsertVendorVerification,
  type BuyerVerification,
  type InsertBuyerVerification,
  type AddressVerification,
  type InsertAddressVerification,
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
  type AdFeedback,
  type InsertAdFeedback,
  type ProviderDeclaration,
  type ProviderEligibility,
  type InsertProviderEligibility,
  type ProviderLocalStat,
  type BusinessVerification,
  type TradeRequirement,
  type CommunityPost,
  type InsertCommunityPost,
  type PostComment,
  type InsertPostComment,
  type CommunityGroup,
  type Region,
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
  type Invitation,
  type InsertInvitation,
  type ReferralStats,
  type InsertReferralStats,
  type RealtorProfile,
  type InsertRealtorProfile,
  type CarSalesmanProfile,
  type InsertCarSalesmanProfile,
  type CountyMetric,
  type CountyEntity,
  type InsertCountyEntity,
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
  type PaymentConfiguration,
  type InsertPaymentConfiguration,
  type ContractorPayment,
  type InsertContractorPayment,
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
  type CommunityBuilderProfile,
  type BuilderContribution,
  type InsertBuilderContribution,
  type BuilderAuditLog,
  type BuilderPayout,
  type InsertBuilderPayout,
  type BuilderLeaderboard,
  type BuilderReferral,
  type BuilderNotification,
  type CrmContact,
  type InsertCrmContact,
  type CrmDeal,
  type InsertCrmDeal,
  type CrmActivity,
  type InsertCrmActivity,
  type CrmEmailTemplate,
  type InsertCrmEmailTemplate,
  type CrmPipeline,
  type InsertCrmPipeline,
  type RecommendationInsight,
  type InsertRecommendationInsight,
  type RecommendationGoal,
  type InsertRecommendationGoal,
  type RecommendationCampaign,
  type InsertRecommendationCampaign,
  type DailyDeal,
  type InsertDailyDeal,
  type UserAffiliate,
  type InsertUserAffiliate,
  type AffiliateTracking,
  type InsertAffiliateTracking,
  type DealEngagement,
  type InsertDealEngagement,
  type WorkRequest,
  type CountyNote,
  type InsertCountyNote,
} from "@shared/schema";
import type { PublicBusinessRecord } from "../repositories/businessRepository";
import type { PublicProfileRecord } from "../repositories/profileRepository";
import type {
  AtomicBusinessOutcomeArgs,
  AtomicExpressOutcomeArgs,
} from "../services/onboardingService";

export type ProfessionalRole = "realtor" | "car_dealer";

export type ProfessionalApplicationSubmissionResult<TProfile> =
  | { outcome: "created"; profile: TProfile }
  | { outcome: "duplicate"; profile: TProfile };

export type ProfessionalApplicationDecision = {
  profileId: string;
  approved: boolean;
  reviewedBy: string;
  reviewedAt: Date;
  reviewNotes: string;
};

export type ProfessionalApplicationDecisionResult<TProfile> =
  | { outcome: "decided"; profile: TProfile }
  | { outcome: "already_decided"; profile: TProfile }
  | { outcome: "not_found" };

export type ProfessionalProfileEditable<TProfile> = Partial<
  Omit<
    TProfile,
    | "id"
    | "userId"
    | "verificationStatus"
    | "isActive"
    | "reviewedBy"
    | "reviewedAt"
    | "reviewNotes"
    | "createdAt"
    | "updatedAt"
  >
>;

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

export interface IStorage {
  // User operations
  getUser(id: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  getUserByRole(role: string): Promise<User | undefined>;
  getUserByFacebookId(facebookId: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  createMasterAdmin(
    email: string,
    password: string,
    firstName: string,
    lastName: string
  ): Promise<User>;
  updateUser(id: string, updates: Partial<User>): Promise<User>;
  upsertUser(user: UpsertUser): Promise<User>;
  deleteUser(userId: string): Promise<void>;
  getAllUsers(): Promise<User[]>;
  suspendUser(userId: string): Promise<void>;
  unsuspendUser(userId: string): Promise<void>;
  verifyUser(userId: string): Promise<void>;
  revokeVerifyUser(userId: string): Promise<void>;
  changeUserRole(userId: string, newRole: string): Promise<void>;

  // Account security and management operations
  getUserTrustedDevices(userId: string): Promise<TrustedDevice[]>;
  removeTrustedDevice(userId: string, deviceId: string): Promise<void>;
  getUserLoginHistory(userId: string, limit: number, offset: number): Promise<any>;
  exportUserData(userId: string): Promise<any>;
  deactivateUser(userId: string): Promise<void>;
  updateUserPrivacySettings(userId: string, settings: any): Promise<any>;

  // Contractor operations
  getContractors(filters?: {
    countyId?: string;
    stateCode?: string;
    tradeIds?: string[];
    query?: string;
    sortBy?: "recommended" | "rating" | "years" | "verified";
    limit?: number;
    offset?: number;
  }): Promise<Contractor[]>;
  getContractorBySlug(slug: string): Promise<Contractor | undefined>;
  getContractorById(id: string): Promise<Contractor | undefined>;
  createContractor(contractor: InsertContractor): Promise<Contractor>;
  updateContractor(id: string, updates: Partial<InsertContractor>): Promise<Contractor>;
  getContractorServiceAreaCounts(contractorIds: string[]): Promise<Record<string, number>>;
  getUserVerificationSummary(userIds: string[]): Promise<
    Record<
      string,
      {
        hasLicense: boolean;
        hasInsurance: boolean;
        hasEin: boolean;
      }
    >
  >;

  // Business operations (first-class public profiles)
  listBusinessesByOwner(ownerUserId: string): Promise<Business[]>;
  getBusinessByIdForOwner(ownerUserId: string, businessId: string): Promise<Business | undefined>;
  getBusinessBySlugPublic(slug: string): Promise<Business | undefined>;
  getBusinessPublicById(businessId: string): Promise<PublicBusinessRecord | undefined>;
  createBusinessForOwner(
    ownerUserId: string,
    data: Omit<InsertBusiness, "id" | "ownerUserId" | "createdAt" | "updatedAt"> & {
      countyIds?: string[];
    }
  ): Promise<Business>;
  updateBusinessForOwner(
    ownerUserId: string,
    businessId: string,
    updates: Partial<Omit<InsertBusiness, "id" | "ownerUserId" | "createdAt" | "updatedAt">> & {
      countyIds?: string[];
    }
  ): Promise<Business>;
  softDeleteBusinessForOwner(ownerUserId: string, businessId: string): Promise<Business>;
  setUserActiveBusiness(userId: string, businessId: string | null): Promise<User>;
  getBusinessCountyIds(businessId: string): Promise<string[]>;
  /**
   * Universal provider lookup for Direct Connect routing.
   * Returns active businesses in the given county, optionally filtered by roleContext.
   * Used to route requests to any business type, not just contractors.
   */
  getProvidersByCountyAndCategory(args: {
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
  >;
  getProvidersByStateAndCategory(args: {
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
  >;
  /** Get the active business for a user (by activeBusinessId or first owned business). */
  getActiveBusinessForUser(userId: string): Promise<Business | undefined>;
  completeOutcomeBusinessProfile(
    args: AtomicBusinessOutcomeArgs
  ): Promise<{ business: Business; profile: Profile }>;
  preflightOutcomeBusinessProfile(
    args: Pick<AtomicBusinessOutcomeArgs, "userId" | "evidence">
  ): Promise<void>;
  completeOutcomeExpressResult(args: AtomicExpressOutcomeArgs): Promise<void>;
  /**
   * Find active, available workers (helpers) whose home county matches the given FIPS code.
   * Optionally filter by required skills (any overlap is sufficient).
   */
  getWorkersByCountyAndSkills(args: {
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
  >;
  // Profile operations (public website pages))
  listProfilesByOwner(ownerUserId: string): Promise<Profile[]>;
  getProfileByIdForOwner(ownerUserId: string, profileId: string): Promise<Profile | undefined>;
  /** Return the owner user id for a given profile id, or null if missing. */
  getProfileOwnerUserId(profileId: string): Promise<string | null>;
  getProfileBySlugForManagement(slug: string): Promise<PublicProfileRecord | undefined>;
  getProfileBySlugPublished(slug: string): Promise<PublicProfileRecord | undefined>;
  getProfileBySlugPublic(slug: string): Promise<PublicProfileRecord | undefined>;
  listPublicProfilesForSitemap(): Promise<Array<{ slug: string; updatedAt: Date | null }>>;
  listBusinessProfilesForSitemap(): Promise<Array<{ slug: string; updatedAt: Date | null }>>;
  countActiveDirectoryBusinessesForSitemap(): Promise<number>;
  listActiveDirectoryBusinessesForSitemap(args?: {
    limit?: number;
    offset?: number;
  }): Promise<Array<{ slug: string; updatedAt: Date | null }>>;
  countDirectoryCountiesForSitemap(): Promise<number>;
  listDirectoryCountiesForSitemap(args?: {
    limit?: number;
    offset?: number;
  }): Promise<Array<{ fips: string; name: string; stateCode: string; updatedAt: Date | null }>>;
  countDirectoryCitiesForSitemap(): Promise<number>;
  listDirectoryCitiesForSitemap(args?: {
    limit?: number;
    offset?: number;
  }): Promise<Array<{ stateCode: string; citySlug: string; updatedAt: Date | null }>>;
  listActiveHomeScoutListingsForSitemap(args?: {
    limit?: number;
  }): Promise<Array<{ id: string; updatedAt: Date | null }>>;
  listHomeScoutCountiesForSitemap(args?: {
    limit?: number;
  }): Promise<Array<{ countyFips: string; stateCode: string; updatedAt: Date | null }>>;
  listTradePartnerCountiesForSitemap(args?: {
    limit?: number;
  }): Promise<Array<{ countySlug: string; updatedAt: Date | null; allowedCategories: string[] }>>;
  listActiveExchangeListingsForSitemap(args?: {
    limit?: number;
  }): Promise<
    Array<{ id: string; sellerUserId: string; categoryName: string; updatedAt: Date | null }>
  >;
  searchProfilesPublic(args: { query: string; limit?: number }): Promise<
    Array<{
      id: string;
      slug: string;
      displayName: string;
      headline: string | null;
      roleContext: any;
    }>
  >;
  createProfileForOwner(
    ownerUserId: string,
    data: Omit<InsertProfile, "id" | "ownerUserId" | "createdAt" | "updatedAt">
  ): Promise<Profile>;
  updateProfileForOwner(
    ownerUserId: string,
    profileId: string,
    updates: Partial<Omit<InsertProfile, "id" | "ownerUserId" | "createdAt" | "updatedAt">>
  ): Promise<Profile>;
  updateProfileById(
    profileId: string,
    updates: Partial<Omit<InsertProfile, "id" | "ownerUserId" | "createdAt" | "updatedAt">>
  ): Promise<Profile>;
  getProfileById(profileId: string): Promise<Profile | undefined>;
  setUserActiveProfile(userId: string, profileId: string | null): Promise<User>;
  createProfileBookingRequest(
    input: Omit<InsertProfileBookingRequest, "id" | "createdAt" | "updatedAt">
  ): Promise<ProfileBookingRequest>;
  getProfileBookingRequestById(id: string): Promise<ProfileBookingRequest | undefined>;
  listProfileBookingRequestsForOwner(ownerUserId: string): Promise<ProfileBookingRequest[]>;
  listProfileBookingRequestsForRequester(requesterUserId: string): Promise<ProfileBookingRequest[]>;
  updateProfileBookingRequest(
    id: string,
    patch: Partial<
      Omit<
        InsertProfileBookingRequest,
        "id" | "ownerUserId" | "requesterUserId" | "profileId" | "lineageKind"
      >
    >
  ): Promise<ProfileBookingRequest>;
  transitionProfileBookingPaymentStatus(args: {
    id: string;
    paymentIntentId: string;
    from: Array<"requires_payment" | "processing" | "failed">;
    to: "failed" | "paid";
  }): Promise<ProfileBookingRequest | undefined>;

  // County operations
  getCounties(stateCode?: string): Promise<County[]>;
  getCountyByFips(fips: string): Promise<County | undefined>;
  upsertCounty(county: InsertCounty): Promise<County>;

  // Trade operations
  getTrades(parentId?: string): Promise<Trade[]>;
  getTradeBySlug(slug: string): Promise<Trade | undefined>;
  createTrade(trade: InsertTrade): Promise<Trade>;

  // Provider declaration & requirements operations
  upsertProviderDeclarationForUser(params: {
    userId: string;
    tradeIds: string[];
    serviceAreas: { countyFips: string }[];
    availabilityFlags?: {
      emergency?: boolean;
      weekends?: boolean;
      evenings?: boolean;
    };
  }): Promise<ProviderDeclaration>;
  getProviderDeclarationForUser(userId: string): Promise<ProviderDeclaration | undefined>;
  getProviderEligibilitiesForUser(userId: string): Promise<ProviderEligibility[]>;
  replaceProviderEligibilitiesForUser(
    userId: string,
    eligibilities: Array<
      Omit<
        InsertProviderEligibility,
        "id" | "providerUserId" | "createdAt" | "updatedAt" | "verifiedAt"
      >
    >
  ): Promise<ProviderEligibility[]>;
  getProviderLocalStatsForUserInCounty(
    userId: string,
    countyFips: string
  ): Promise<ProviderLocalStat | undefined>;

  // Recommendation operations
  getRecommendations(contractorId: string): Promise<Recommendation[]>;
  createRecommendation(recommendation: InsertRecommendation): Promise<Recommendation>;
  getContractorRatings(contractorId: string): Promise<{ count: number; average: number }>;

  // Leaderboard operations
  updateContractorLeaderboardStats(contractorId: string, rating: number): Promise<void>;
  getMonthlyLeaderboard(
    month: number,
    year: number,
    limit: number,
    state?: string,
    county?: string
  ): Promise<any>;
  getLifetimeLeaderboard(limit: number, state?: string, county?: string): Promise<any>;
  getContractorLeaderboardPosition(contractorId: string): Promise<any>;
  getAllStates(): Promise<{ code: string; name: string }[]>;
  getCountiesByState(stateCode: string): Promise<{ id: string; name: string; stateCode: string }[]>;

  // Lead operations
  createLead(lead: InsertLead): Promise<Lead>;
  getLeads(contractorId?: string, status?: string): Promise<Lead[]>;
  updateLeadStatus(id: string, status: string): Promise<Lead>;
  assignLeadToContractors(leadId: string, contractorIds: string[]): Promise<void>;

  // Growth Pack operations
  createGrowthPackDownload(download: InsertGrowthPackDownload): Promise<GrowthPackDownload>;
  getGrowthPackDownload(token: string): Promise<GrowthPackDownload | undefined>;

  // Accelerator operations
  createAcceleratorMembership(
    membership: InsertAcceleratorMembership
  ): Promise<AcceleratorMembership>;
  getAcceleratorMembership(contractorId: string): Promise<AcceleratorMembership | undefined>;

  // Pricing operations
  getPricingData(service: string, fips?: string): Promise<PricingData[]>;
  upsertPricingData(data: InsertPricingData): Promise<PricingData>;

  // Analytics operations
  logEvent(eventType: string, data: any): Promise<void>;
  getEventStats(eventType: string, dateRange?: { from: Date; to: Date }): Promise<number>;
  getUserCredibilityStats(userId: string): Promise<{
    jobsCompleted: number;
    peopleHelped: number;
    activeWeeks: number;
  }>;

  // Chat system operations
  // Conversations
  createConversation(conversation: InsertConversation): Promise<Conversation>;
  getConversation(id: string): Promise<Conversation | undefined>;
  getConversationsByUser(
    userId: string,
    userType: "homeowner" | "contractor"
  ): Promise<Conversation[]>;
  updateConversation(id: string, updates: Partial<Conversation>): Promise<Conversation>;
  rateConversation(
    id: string,
    rating: number,
    feedback: string,
    raterType: "homeowner" | "contractor"
  ): Promise<Conversation>;

  // Messages
  createMessage(message: InsertMessage): Promise<Message>;
  getMessagesByConversation(conversationId: string): Promise<Message[]>;
  getThreadsForUser(
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
  >;
  markMessageAsRead(messageId: string): Promise<Message>;

  // Quotes
  createQuote(quote: InsertQuote): Promise<Quote>;
  getQuote(id: string): Promise<Quote | undefined>;
  getQuotesByConversation(conversationId: string): Promise<Quote[]>;
  updateQuote(id: string, updates: Partial<Quote>): Promise<Quote>;

  // Schedules
  createSchedule(schedule: InsertSchedule): Promise<Schedule>;
  getSchedule(id: string): Promise<Schedule | undefined>;
  getSchedulesByConversation(conversationId: string): Promise<Schedule[]>;
  updateSchedule(id: string, updates: Partial<Schedule>): Promise<Schedule>;

  // Material Lists
  createMaterialList(materialList: InsertMaterialList): Promise<MaterialList>;
  getMaterialList(id: string): Promise<MaterialList | undefined>;
  getMaterialListsByConversation(conversationId: string): Promise<MaterialList[]>;
  updateMaterialList(id: string, updates: Partial<MaterialList>): Promise<MaterialList>;

  // Advertisement operations
  getAdvertisements(placement?: string): Promise<Advertisement[]>;
  createAdvertisement(ad: InsertAdvertisement): Promise<Advertisement>;
  updateAdvertisement(id: string, updates: Partial<Advertisement>): Promise<Advertisement>;
  deleteAdvertisement(id: string): Promise<void>;
  getTargetedAd(criteria: {
    audience: string;
    state?: string;
    county?: string;
    regionSlug?: string;
    placement?: string;
    excludeAdIds?: string[];
    preferAffiliate?: boolean;
    minCommunityScore?: number;
  }): Promise<Advertisement | null>;
  incrementAdImpressions(adId: string): Promise<void>;
  incrementAdClicks(adId: string): Promise<void>;
  saveAdForUser(userId: string, adId: string): Promise<SavedAd>;
  getSavedAdsForUser(userId: string): Promise<Advertisement[]>;
  removeSavedAd(userId: string, adId: string): Promise<void>;
  normalizeAdLinkForUser(params: {
    linkUrl?: string | null;
    isAffiliate?: boolean | null;
    userId?: string | null;
  }): Promise<string | null>;
  trackAdEvent(params: {
    adId: string;
    eventType: "impression" | "click";
    source?: string | null;
    userId?: string | null;
  }): Promise<void>;

  // Community Value Score (CVS) operations
  submitAdFeedback(params: {
    adId: string;
    userId: string;
    rating: "helpful" | "not_relevant" | "spam";
    source: "scout" | "site_visit" | "saved";
  }): Promise<void>;
  recomputeAdCommunityScores(params?: { sinceDays?: number }): Promise<void>;

  // Notification operations
  createNotification(notification: InsertNotification): Promise<Notification>;
  getUserNotifications(userId: string, unreadOnly?: boolean): Promise<Notification[]>;
  markNotificationAsRead(notificationId: string): Promise<void>;
  markAllNotificationsAsRead(userId: string): Promise<void>;
  getSavedAdsForReminders(): Promise<Array<SavedAd & { user: User; ad: Advertisement }>>;
  updateSavedAdReminderStatus(savedAdId: string, reminderCount: number): Promise<void>;
  getNotificationsSummary(userId: string): Promise<{
    unreadThreads: number;
    openHoaVotes: number;
  }>;

  // Error Report operations
  createErrorReport(report: any): Promise<any>;
  updateErrorReport(id: string, updates: any): Promise<any>;
  getErrorReports(): Promise<any>;
  deleteErrorReport(id: string): Promise<void>;

  // Heatmap operations
  getLocalityHeatmapData(days: number): Promise<
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
  >;

  // Contractor Promo operations
  createContractorPromo(
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
  ): Promise<ContractorPromo>;
  getContractorPromo(id: string): Promise<ContractorPromo | undefined>;
  getContractorPromoBySlug(slug: string): Promise<ContractorPromo | undefined>;
  getContractorPromos(contractorId: string): Promise<ContractorPromo[]>;
  updateContractorPromo(id: string, updates: Partial<ContractorPromo>): Promise<ContractorPromo>;
  deleteContractorPromo(id: string): Promise<void>;
  generatePromoSlug(title: string): Promise<string>;

  // Promo analytics
  recordPromoInteraction(interaction: InsertPromoInteraction): Promise<PromoInteraction>;
  getPromoAnalytics(promoId: string): Promise<{
    totalViews: number;
    totalClicks: number;
    totalLeads: number;
    recentInteractions: PromoInteraction[];
  }>;
  incrementPromoView(promoId: string): Promise<void>;
  incrementPromoClick(promoId: string): Promise<void>;
  getActivePromosInArea(countyFips: string): Promise<ContractorPromo[]>;

  // Marketplace operations
  // Categories
  getMarketplaceCategories(): Promise<MarketplaceCategory[]>;
  createMarketplaceCategory(category: InsertMarketplaceCategory): Promise<MarketplaceCategory>;
  updateMarketplaceCategory(
    id: string,
    updates: Partial<MarketplaceCategory>
  ): Promise<MarketplaceCategory>;
  deleteMarketplaceCategory(id: string): Promise<void>;

  // Listings
  getMarketplaceListings(filters?: {
    categoryId?: string;
    county?: string;
    state?: string;
    preferredCountyFips?: string;
    preferredCountyName?: string;
    preferredStateCode?: string;
    priceMin?: number;
    priceMax?: number;
    condition?: string;
    searchQuery?: string;
    sortBy?: "price_asc" | "price_desc" | "date_desc" | "date_asc";
    limit?: number;
    offset?: number;
    status?: string;
    sellerId?: string;
    /** Vehicles: min year (inclusive) */
    yearMin?: number;
    /** Vehicles: max year (inclusive) */
    yearMax?: number;
    /** Vehicles: max mileage (inclusive) */
    mileageMax?: number;
    /** Vehicles: title status stored in specifications JSONB */
    titleStatus?: string;
    /** Collectibles: authenticated flag stored in specifications JSONB */
    authenticated?: string;
    /** Collectibles: graded flag stored in specifications JSONB */
    graded?: string;
    /** Business: business type stored in specifications JSONB */
    businessType?: string;
    /** Business: annual revenue range stored in specifications JSONB */
    annualRevenueRange?: string;
    /** Business: owner financing stored in specifications JSONB */
    ownerFinancing?: string;
    /** Construction / Farm: max machine/engine hours */
    hoursMax?: number;
    /** Furniture: material stored in specifications JSONB */
    material?: string;
    /** Furniture: assembly status stored in specifications JSONB */
    assemblyStatus?: string;
    /** Business Equipment: power requirements stored in specifications JSONB */
    powerRequirements?: string;
    /** Electronics: storage capacity stored in specifications JSONB */
    storage?: string;
    /** Sports: sport/activity stored in specifications JSONB */
    sport?: string;
    /** Jewelry: metal type stored in specifications JSONB */
    metal?: string;
    /** Jewelry: handoff method stored in specifications JSONB */
    handoff?: string;
    /** Local Food: fulfillment method stored in specifications JSONB */
    pickupOrDelivery?: string;
    /** Local Food: lead time stored in specifications JSONB */
    leadTime?: string;
    /** Other / Construction: inspection available stored in specifications JSONB */
    inspectionAvailable?: string;
    /** Construction: inspection ready stored in specifications JSONB */
    inspectionReady?: string;
    /** Farm: field ready stored in specifications JSONB */
    fieldReady?: string;
    /** Tools: includes batteries stored in specifications JSONB */
    includesBatteries?: string;
    /** Tools: includes chargers stored in specifications JSONB */
    includesChargers?: string;
    /** Tools: includes case stored in specifications JSONB */
    includesCase?: string;
    /** Electronics: powers on stored in specifications JSONB */
    powersOn?: string;
    /** Electronics: carrier status stored in specifications JSONB */
    carrierStatus?: string;
    /** Sports: competition ready stored in specifications JSONB */
    competitionReady?: string;
    /** Business Equipment: install required stored in specifications JSONB */
    installRequired?: string;
  }): Promise<MarketplaceListing[]>;
  getMarketplaceListing(id: string): Promise<MarketplaceListing | undefined>;
  getMarketplaceListingBySlug(slug: string): Promise<MarketplaceListing | undefined>;
  createMarketplaceListing(listing: InsertMarketplaceListing): Promise<MarketplaceListing>;
  updateMarketplaceListing(
    id: string,
    updates: Partial<MarketplaceListing>
  ): Promise<MarketplaceListing>;
  deleteMarketplaceListing(id: string): Promise<void>;
  getUserListings(userId: string): Promise<MarketplaceListing[]>;
  incrementListingView(listingId: string): Promise<void>;
  generateListingSlug(title: string): Promise<string>;

  // Inquiries
  createMarketplaceInquiry(inquiry: InsertMarketplaceInquiry): Promise<MarketplaceInquiry>;
  getMarketplaceInquiry(id: string): Promise<MarketplaceInquiry | undefined>;
  getListingInquiries(listingId: string): Promise<MarketplaceInquiry[]>;
  getUserInquiries(userId: string, type: "sent" | "received"): Promise<MarketplaceInquiry[]>;
  updateMarketplaceInquiry(
    id: string,
    updates: Partial<MarketplaceInquiry>
  ): Promise<MarketplaceInquiry>;

  // Favorites
  createMarketplaceFavorite(favorite: InsertMarketplaceFavorite): Promise<MarketplaceFavorite>;
  removeMarketplaceFavorite(userId: string, listingId: string): Promise<void>;
  getUserFavorites(userId: string): Promise<MarketplaceListing[]>;

  // Reports
  createMarketplaceReport(report: InsertMarketplaceReport): Promise<MarketplaceReport>;
  getMarketplaceReports(): Promise<MarketplaceReport[]>;
  updateMarketplaceReport(
    id: string,
    updates: Partial<MarketplaceReport>
  ): Promise<MarketplaceReport>;

  // Marketplace Conversation operations
  createMarketplaceConversation(
    data: InsertMarketplaceConversation
  ): Promise<MarketplaceConversation>;
  getMarketplaceConversation(id: string): Promise<MarketplaceConversation | undefined>;
  getMarketplaceConversationByParticipants(
    listingId: string,
    buyerId: string,
    sellerId: string
  ): Promise<MarketplaceConversation | undefined>;
  getUserMarketplaceConversations(userId: string): Promise<any>;
  createMarketplaceMessage(data: InsertMarketplaceMessage): Promise<MarketplaceMessage>;
  getMarketplaceMessages(conversationId: string): Promise<MarketplaceMessage[]>;
  markMarketplaceMessagesAsRead(conversationId: string, userId: string): Promise<void>;

  // Marketplace Verification
  createVendorVerification(verification: InsertVendorVerification): Promise<VendorVerification>;
  createBuyerVerification(verification: InsertBuyerVerification): Promise<BuyerVerification>;
  getVendorVerificationByUserId(userId: string): Promise<VendorVerification | undefined>;
  getBuyerVerificationByUserId(userId: string): Promise<BuyerVerification | undefined>;
  getVerifications(filters: {
    type: string;
    status: string;
  }): Promise<(VendorVerification | BuyerVerification)[]>;
  updateVerification(id: string, updates: any): Promise<VendorVerification | BuyerVerification>;

  // Address Verification
  createAddressVerification(verification: InsertAddressVerification): Promise<AddressVerification>;
  getAddressVerificationByUserId(userId: string): Promise<AddressVerification | undefined>;
  updateAddressVerification(
    id: string,
    updates: Partial<AddressVerification>
  ): Promise<AddressVerification>;
  getAddressVerificationsNeedingReminders(): Promise<AddressVerification[]>;
  getExpiredAddressVerifications(): Promise<AddressVerification[]>;
  sendAddressVerificationPostcard(userId: string, code: string): Promise<void>;
  verifyAddressWithPostcard(userId: string, code: string): Promise<boolean>;

  // Community Moderation operations
  // Reports
  createModerationReport(report: InsertModerationReport): Promise<ModerationReport>;
  getModerationReport(id: string): Promise<ModerationReport | undefined>;
  getModerationReports(filters?: {
    status?: string;
    contentType?: string;
    county?: string;
    state?: string;
    reporterId?: string;
    limit?: number;
    offset?: number;
  }): Promise<ModerationReport[]>;
  updateModerationReport(id: string, updates: Partial<ModerationReport>): Promise<ModerationReport>;

  // Votes
  createModerationVote(vote: InsertModerationVote): Promise<ModerationVote>;
  getModerationVote(reportId: string, voterId: string): Promise<ModerationVote | undefined>;
  getReportVotes(reportId: string): Promise<ModerationVote[]>;
  updateVoteCounts(reportId: string): Promise<void>;

  // User reputation
  getUserModerationReputation(userId: string): Promise<UserModerationReputation | undefined>;
  createUserModerationReputation(
    reputation: InsertUserModerationReputation
  ): Promise<UserModerationReputation>;
  updateUserModerationReputation(
    userId: string,
    updates: Partial<UserModerationReputation>
  ): Promise<UserModerationReputation>;

  // Actions
  createModerationAction(action: InsertModerationAction): Promise<ModerationAction>;
  getModerationActions(contentType: string, contentId: string): Promise<ModerationAction[]>;

  // Appeals
  createModerationAppeal(appeal: InsertModerationAppeal): Promise<ModerationAppeal>;
  getModerationAppeal(id: string): Promise<ModerationAppeal | undefined>;
  getAppealsByUser(userId: string): Promise<ModerationAppeal[]>;
  updateModerationAppeal(id: string, updates: Partial<ModerationAppeal>): Promise<ModerationAppeal>;

  // Settings
  getModerationSettings(county?: string, state?: string): Promise<ModerationSettings | undefined>;
  createModerationSettings(settings: InsertModerationSettings): Promise<ModerationSettings>;
  updateModerationSettings(
    id: string,
    updates: Partial<ModerationSettings>
  ): Promise<ModerationSettings>;

  // Utility methods
  canUserVoteOnReport(userId: string, reportId: string): Promise<boolean>;
  calculateLocalVoterWeight(
    voterCounty: string,
    voterState: string,
    contentCounty: string,
    contentState: string
  ): Promise<number>;
  processVoteResult(reportId: string): Promise<void>;

  // Smart Recommendation Generator operations
  // Insights
  createRecommendationInsight(insight: InsertRecommendationInsight): Promise<RecommendationInsight>;
  getRecommendationInsight(contractorId: string): Promise<RecommendationInsight | undefined>;
  updateRecommendationInsight(
    contractorId: string,
    updates: Partial<RecommendationInsight>
  ): Promise<RecommendationInsight>;
  analyzeContractorPerformance(contractorId: string): Promise<RecommendationInsight>;

  // Goals
  createRecommendationGoal(goal: InsertRecommendationGoal): Promise<RecommendationGoal>;
  getContractorGoals(contractorId: string): Promise<RecommendationGoal[]>;
  updateRecommendationGoal(
    goalId: string,
    updates: Partial<RecommendationGoal>
  ): Promise<RecommendationGoal>;
  updateGoalProgress(contractorId: string): Promise<void>;

  // Campaigns
  createRecommendationCampaign(
    campaign: InsertRecommendationCampaign
  ): Promise<RecommendationCampaign>;
  getContractorCampaigns(contractorId: string): Promise<RecommendationCampaign[]>;
  updateRecommendationCampaign(
    contractorId: string,
    campaignId: string,
    updates: Partial<RecommendationCampaign>
  ): Promise<RecommendationCampaign | undefined>;
  deleteRecommendationCampaign(contractorId: string, campaignId: string): Promise<boolean>;
  getActiveCampaigns(): Promise<RecommendationCampaign[]>;

  // Invitation system operations
  // Invitations
  createInvitation(invitation: InsertInvitation): Promise<Invitation>;
  getInvitation(id: string): Promise<Invitation | undefined>;
  getInvitationByCode(code: string): Promise<Invitation | undefined>;
  getUserInvitations(userId: string): Promise<Invitation[]>;
  updateInvitation(id: string, updates: Partial<Invitation>): Promise<Invitation>;
  acceptInvitation(code: string, userId: string): Promise<Invitation>;
  expireOldInvitations(): Promise<void>;
  generateInvitationCode(): Promise<string>;
  generateUserReferralCode(userId: string): Promise<string>;

  // Referral stats
  getReferralStats(userId: string): Promise<ReferralStats | undefined>;
  createReferralStats(stats: InsertReferralStats): Promise<ReferralStats>;
  updateReferralStats(userId: string, updates: Partial<ReferralStats>): Promise<ReferralStats>;
  incrementInvitationsSent(userId: string): Promise<void>;
  incrementInvitationsAccepted(
    userId: string,
    targetRole: "homeowner" | "contractor"
  ): Promise<void>;
  getTopReferrers(limit: number): Promise<(ReferralStats & { user: User })[]>;

  // Professional profile operations
  submitRealtorApplication(
    profile: InsertRealtorProfile
  ): Promise<ProfessionalApplicationSubmissionResult<RealtorProfile>>;
  getRealtorProfile(id: string): Promise<RealtorProfile | undefined>;
  getRealtorProfileByUserId(userId: string): Promise<RealtorProfile | undefined>;
  updateRealtorProfile(
    id: string,
    profileData: ProfessionalProfileEditable<RealtorProfile>
  ): Promise<RealtorProfile>;

  submitCarSalesmanApplication(
    profile: InsertCarSalesmanProfile
  ): Promise<ProfessionalApplicationSubmissionResult<CarSalesmanProfile>>;
  getCarSalesmanProfile(id: string): Promise<CarSalesmanProfile | undefined>;
  getCarSalesmanProfileByUserId(userId: string): Promise<CarSalesmanProfile | undefined>;
  updateCarSalesmanProfile(
    id: string,
    profileData: ProfessionalProfileEditable<CarSalesmanProfile>
  ): Promise<CarSalesmanProfile>;

  // Professional verification methods
  getPendingRealtorApplications(): Promise<RealtorProfile[]>;
  getPendingCarSalesmanApplications(): Promise<CarSalesmanProfile[]>;
  decideRealtorApplication(
    decision: ProfessionalApplicationDecision
  ): Promise<ProfessionalApplicationDecisionResult<RealtorProfile>>;
  decideCarSalesmanApplication(
    decision: ProfessionalApplicationDecision
  ): Promise<ProfessionalApplicationDecisionResult<CarSalesmanProfile>>;

  // Advanced marketplace transaction operations
  createMarketplaceTransaction(
    transaction: InsertMarketplaceTransaction
  ): Promise<MarketplaceTransaction>;
  getMarketplaceTransaction(id: string): Promise<MarketplaceTransaction | undefined>;
  getMarketplaceTransactionsByUser(
    userId: string,
    role: "buyer" | "seller"
  ): Promise<MarketplaceTransaction[]>;
  updateMarketplaceTransaction(
    id: string,
    updates: Partial<MarketplaceTransaction>
  ): Promise<MarketplaceTransaction>;

  // Transaction dispute operations
  createTransactionDispute(dispute: InsertTransactionDispute): Promise<TransactionDispute>;
  getTransactionDispute(id: string): Promise<TransactionDispute | undefined>;
  getTransactionDisputes(transactionId?: string): Promise<TransactionDispute[]>;
  updateTransactionDispute(
    id: string,
    updates: Partial<TransactionDispute>
  ): Promise<TransactionDispute>;

  // User review operations
  createUserReview(review: InsertUserReview): Promise<UserReview>;
  getUserReviews(userId: string, role: "reviewer" | "reviewee"): Promise<UserReview[]>;
  getUserRatings(userId: string): Promise<{ count: number; average: number }>;

  // Search and discovery operations
  createSavedSearch(search: InsertSavedSearch): Promise<SavedSearch>;
  getUserSavedSearches(userId: string): Promise<SavedSearch[]>;
  deleteSavedSearch(id: string): Promise<void>;
  logSearchAnalytics(analytics: InsertSearchAnalytics): Promise<SearchAnalytics>;

  // Platform analytics operations
  updatePlatformAnalytics(
    date: Date,
    updates: Partial<InsertPlatformAnalytics>
  ): Promise<PlatformAnalytics>;
  getPlatformAnalytics(fromDate: Date, toDate: Date): Promise<PlatformAnalytics[]>;

  // Payment system operations
  createPaymentConfiguration(config: InsertPaymentConfiguration): Promise<PaymentConfiguration>;
  getPaymentConfiguration(configType: string): Promise<PaymentConfiguration | undefined>;
  updatePaymentConfiguration(
    id: string,
    updates: Partial<InsertPaymentConfiguration>
  ): Promise<PaymentConfiguration>;

  // Contractor payment operations
  createContractorPayment(payment: InsertContractorPayment): Promise<ContractorPayment>;
  getContractorPayment(id: string): Promise<ContractorPayment | undefined>;
  getContractorPaymentsByHomeowner(homeownerId: string): Promise<ContractorPayment[]>;
  getContractorPaymentsByContractor(contractorId: string): Promise<ContractorPayment[]>;
  updateContractorPayment(
    id: string,
    updates: Partial<ContractorPayment>
  ): Promise<ContractorPayment>;

  // Enhanced marketplace transaction operations
  updateMarketplaceTransactionPayment(
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
  ): Promise<MarketplaceTransaction>;

  // Enhanced marketplace conversation operations
  getMarketplaceConversationByListing(
    listingId: string,
    buyerId: string
  ): Promise<MarketplaceConversation | undefined>;
  markMarketplaceMessageAsRead(id: string): Promise<MarketplaceMessage>;

  // Affiliate system methods
  // Affiliate program management
  getAffiliateProgram(userId: string): Promise<AffiliateProgram | undefined>;
  getAffiliateProgramByAccountId(id: string): Promise<AffiliateAccount | undefined>;
  createAffiliateProgram(
    program: InsertAffiliateProgram | { userId: string; referralCode?: string }
  ): Promise<AffiliateProgram>;
  updateAffiliateProgram(
    id: string,
    updates: Partial<InsertAffiliateProgram>
  ): Promise<AffiliateProgram>;
  generateAffiliateCode(userId: string): Promise<string>;

  // Wallet & on-platform balance
  getWalletTransactionsForUser(userId: string, limit?: number): Promise<WalletTransaction[]>;
  getWalletBalance(userId: string): Promise<string>;
  creditWallet(
    userId: string,
    amount: number,
    options?: {
      type?: string;
      referenceType?: string;
      referenceId?: string;
      memo?: string;
      counterpartyUserId?: string;
    }
  ): Promise<void>;
  debitWallet(
    userId: string,
    amount: number,
    options?: {
      type?: string;
      referenceType?: string;
      referenceId?: string;
      memo?: string;
      counterpartyUserId?: string;
    }
  ): Promise<void>;

  // Affiliate earnings synchronization
  incrementAffiliateEarnings(affiliateProgramId: string, amount: number): Promise<void>;

  // Referral tracking
  trackReferralClick(data: InsertAffiliateReferral): Promise<AffiliateReferral>;
  convertReferral(affiliateCode: string, userId: string): Promise<void>;
  getReferralsByAffiliate(affiliateProgramId: string): Promise<AffiliateReferral[]>;
  getReferralByReferredUserId(userId: string): Promise<AffiliateReferral | undefined>;

  // Commission management
  createCommission(commission: InsertAffiliateCommission): Promise<AffiliateCommission>;
  getCommissionsForAffiliate(affiliateProgramId: string): Promise<AffiliateCommission[]>;
  approveCommission(commissionId: string): Promise<void>;
  getUnpaidCommissions(affiliateProgramId: string): Promise<AffiliateCommission[]>;

  // Payout management
  createPayout(
    payout:
      | InsertAffiliatePayout
      | {
          affiliateProgramId: string;
          totalAmount: string;
          payoutMethod?: string;
          status?: string;
          notes?: string;
        }
  ): Promise<AffiliatePayout>;
  getPayoutsForAffiliate(affiliateProgramId: string): Promise<AffiliatePayout[]>;
  updatePayoutStatus(payoutId: string, status: string): Promise<void>;

  // Analytics
  getAffiliateStats(affiliateProgramId: string): Promise<{
    totalReferrals: number;
    convertedReferrals: number;
    totalCommissionEarned: string;
    totalCommissionPaid: string;
    conversionRate: number;
  }>;

  // CRM operations
  createCrmContact(contact: InsertCrmContact): Promise<CrmContact>;
  updateCrmContact(id: string, updates: Partial<CrmContact>): Promise<CrmContact>;
  deleteCrmContact(id: string): Promise<void>;
  getCrmContact(id: string): Promise<CrmContact | undefined>;
  getCrmContactByEmail(email: string): Promise<CrmContact | undefined>;
  getAllCrmContacts(filters?: {
    status?: string;
    assignedTo?: string;
    search?: string;
  }): Promise<Array<CrmContact & { assignedTo?: User }>>;

  createCrmDeal(deal: InsertCrmDeal): Promise<CrmDeal>;
  updateCrmDeal(id: string, updates: Partial<CrmDeal>): Promise<CrmDeal>;
  deleteCrmDeal(id: string): Promise<void>;
  getCrmDeal(id: string): Promise<CrmDeal | undefined>;
  getAllCrmDeals(filters?: {
    stage?: string;
    assignedTo?: string;
    contactId?: string;
  }): Promise<Array<CrmDeal & { contact?: CrmContact; assignedTo?: User }>>;

  createCrmActivity(activity: InsertCrmActivity): Promise<CrmActivity>;
  updateCrmActivity(id: string, updates: Partial<CrmActivity>): Promise<CrmActivity>;
  deleteCrmActivity(id: string): Promise<void>;
  getCrmActivity(id: string): Promise<CrmActivity | undefined>;
  getCrmActivitiesByContact(contactId: string): Promise<Array<CrmActivity & { createdBy?: User }>>;
  getCrmActivitiesByDeal(dealId: string): Promise<Array<CrmActivity & { createdBy?: User }>>;
  getAllCrmActivities(filters?: {
    type?: string;
    contactId?: string;
    dealId?: string;
  }): Promise<Array<CrmActivity & { contact?: CrmContact; deal?: CrmDeal; createdBy?: User }>>;

  createCrmEmailTemplate(template: InsertCrmEmailTemplate): Promise<CrmEmailTemplate>;
  updateCrmEmailTemplate(id: string, updates: Partial<CrmEmailTemplate>): Promise<CrmEmailTemplate>;
  deleteCrmEmailTemplate(id: string): Promise<void>;
  getCrmEmailTemplate(id: string): Promise<CrmEmailTemplate | undefined>;
  getAllCrmEmailTemplates(
    category?: string
  ): Promise<Array<CrmEmailTemplate & { createdBy?: User }>>;

  createCrmPipeline(pipeline: InsertCrmPipeline): Promise<CrmPipeline>;
  updateCrmPipeline(id: string, updates: Partial<CrmPipeline>): Promise<CrmPipeline>;
  deleteCrmPipeline(id: string): Promise<void>;
  getCrmPipeline(id: string): Promise<CrmPipeline | undefined>;
  getAllCrmPipelines(): Promise<Array<CrmPipeline & { createdBy?: User }>>;
  getDefaultCrmPipeline(): Promise<CrmPipeline | undefined>;

  // HOA Management operations
  getHoaForUser(userId: string): Promise<
    {
      hoaId: string;
      hoaName: string;
      role: string;
      status: string;
      stateCode: string | null;
      countyFips: string | null;
    }[]
  >;
  getHOAById(hoaId: string): Promise<any>;
  searchHOAs(filters: {
    countyFips?: string;
    zip?: string;
    city?: string;
    state?: string;
  }): Promise<any[]>;
  getHOAFinances(hoaId: string): Promise<any>;
  getHOAVendors(hoaId: string): Promise<any[]>;
  getHOAVotes(hoaId: string): Promise<any[]>;
  submitHOAVote(userId: string, voteId: string, decision: string): Promise<any>;
  createVendorServiceRequest(request: {
    userId: string;
    vendorId: string;
    serviceType: string;
    description: string;
    urgency: string;
    contactPreference: string;
  }): Promise<any>;

  // Groups/Community operations
  getGroups(filters: {
    countyFips?: string;
    type?: string;
    search?: string;
    limit: number;
  }): Promise<any[]>;
  getGroupById(groupId: string): Promise<any>;
  joinGroup(userId: string, groupId: string): Promise<any>;
  leaveGroup(userId: string, groupId: string): Promise<void>;
  getGroupPosts(groupId: string): Promise<any[]>;
  createGroupPost(post: {
    groupId: string;
    authorId: string;
    content: string;
    images?: string[];
  }): Promise<any>;

  // Boosts/Promotions operations
  getBoostsByRole(userRole: string): Promise<any[]>;
  purchaseBoost(data: { userId: string; boostId: string; paymentMethodId?: string }): Promise<any>;
  getUserBoosts(userId: string): Promise<any[]>;
  getBoostAnalytics(boostId: string, userId: string): Promise<any>;

  // Nationwide Dashboard operations
  getNationwideMetrics(): Promise<{
    totalUsers: number;
    totalContractors: number;
    totalProjects: number;
    totalRevenue: string;
  }>;
  getTopPerformingCounties(limit: number): Promise<any[]>;
  getExpansionPipeline(): Promise<any[]>;
  getGeographicDistribution(): Promise<any>;

  // Platform statistics
  getPlatformStatistics(): Promise<{
    totalContractors: number;
    totalHomeowners: number;
    totalProjectsCompleted: number;
    successRate: number;
    totalProjectValue: number;
  }>;

  // County vaults (community reinvestment)
  getCountyVaultSnapshot(params: {
    countyId?: string;
    countyName?: string;
    stateCode?: string;
  }): Promise<{
    county?: County;
    vault: CountyVault | null;
    last30dInflow: number;
    ledger: VaultLedgerEntry[];
    sourcesBreakdown: Record<string, number>;
  }>;
  recordVaultLedgerEntry(data: {
    countyId: string;
    amount: number;
    sourceType: string;
    sourceId?: string;
    memo?: string;
  }): Promise<{ vault: CountyVault; entry: VaultLedgerEntry }>;
  getVaultLedgerEntries(vaultId: string, limit?: number): Promise<VaultLedgerEntry[]>;

  // Community Profile Vault (MVP)
  getCommunityVaultSnapshot(params: { profileId: string; limit?: number }): Promise<{
    profile: { id: string; slug: string; displayName: string; roleContext: string } | null;
    vault: CommunityVault | null;
    ledger: CommunityVaultLedgerEntry[];
  }>;
  recordCommunityVaultLedgerEntry(data: {
    profileId: string;
    amount: number;
    sourceType: string;
    sourceId?: string;
    externalKey?: string;
    memo?: string;
    causeId?: string;
  }): Promise<{ vault: CommunityVault; entry: CommunityVaultLedgerEntry }>;
  getCommunityVaultLedgerEntries(
    vaultId: string,
    limit?: number
  ): Promise<CommunityVaultLedgerEntry[]>;

  // Causes + voting intent (MVP)
  listCommunityCausesByProfile(
    profileId: string
  ): Promise<
    Array<
      CommunityCause & { voteCount: number; weightedVoteTotal: number; allocationShare: number }
    >
  >;
  createCommunityCauseForOwner(
    ownerUserId: string,
    data: { profileId: string; title: string; description?: string | null }
  ): Promise<CommunityCause>;
  voteForCommunityCause(
    userId: string,
    causeId: string
  ): Promise<{
    vote: CommunityCauseVote;
    voteCount: number;
    weightedVoteTotal: number;
    allocationShare: number;
    voteWeight: number;
  }>;

  // Platform Support ledger (MVP)
  insertPlatformSupportLedgerEntry(
    data: InsertPlatformSupportLedgerEntry
  ): Promise<PlatformSupportLedgerEntry>;
  getPlatformSupportLedgerEntries(params: {
    originatingProfileId?: string;
    limit?: number;
  }): Promise<PlatformSupportLedgerEntry[]>;

  // Business Profile v1 operations (PHASE 3d-C)
  getBusinessProfileBySlug(
    slug: string
  ): Promise<import("../../shared/businessProfile").BusinessProfile | undefined>;
  getBusinessProfileByUserId(
    userId: string
  ): Promise<import("../../shared/businessProfile").BusinessProfile | undefined>;
  saveBusinessProfile(
    profile: import("../../shared/businessProfile").BusinessProfile
  ): Promise<import("../../shared/businessProfile").BusinessProfile>;

  // HOA operations
  recordHoaFeeCollection(params: {
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
  }>;
  createHOABoardTransferVote(params: {
    hoaId: string;
    initiatedByUserId: string;
    targetRole: "president" | "vice_president";
    nomineeUserId: string;
    reason: string;
    durationHours: number;
  }): Promise<{ voteId: string }>;
  leaveHOA(userId: string, hoaId: string): Promise<void>;
  leaveHOAWithReason(params: {
    userId: string;
    hoaId: string;
    reason: string;
    membershipRole?: string | null;
    actorUserId?: string | null;
  }): Promise<void>;
}
