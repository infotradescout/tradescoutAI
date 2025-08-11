import {
  users,
  contractors,
  recommendations,
  leads,
  counties,
  trades,
  growthPackDownloads,
  acceleratorMemberships,
  pricingData,
  events,
  contractorTrades,
  contractorCounties,
  leadAssignments,
  verificationDocuments,
  conversations,
  messages,
  quotes,
  schedules,
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
  marketplaceInquiries,
  marketplaceFavorites,
  marketplaceReports,
  vendorVerifications,
  buyerVerifications,
  addressVerifications,
  // Handmade marketplace
  handmadeCategories,
  handmadeProducts,
  productFavorites,
  productOrders,
  productReviews,
  sellerProfiles,
  // Social features
  communityPosts,
  postComments,
  postLikes,
  commentLikes,
  userFollows,
  communityGroups,
  groupMembers,
  regions,
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
  type User,
  type InsertUser,
  type UpsertUser,
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
  type InsertSavedAd,
  type Notification,
  type InsertNotification,
  type ContractorPromo,
  type InsertContractorPromo,
  type PromoInteraction,
  type InsertPromoInteraction,
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
  // Handmade marketplace
  type HandmadeCategory,
  type InsertHandmadeCategory,
  type HandmadeProduct,
  type InsertHandmadeProduct,
  type ProductFavorite,
  type InsertProductFavorite,
  type ProductOrder,
  type InsertProductOrder,
  type ProductReview,
  type InsertProductReview,
  type SellerProfile,
  type InsertSellerProfile,
  // Social features
  type CommunityPost,
  type InsertCommunityPost,
  type PostComment,
  type InsertPostComment,
  type PostLike,
  type InsertPostLike,
  type CommentLike,
  type InsertCommentLike,
  type UserFollow,
  type InsertUserFollow,
  type CommunityGroup,
  type InsertCommunityGroup,
  type GroupMember,
  type InsertGroupMember,
  type Region,
  type InsertRegion,
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
  // Leaderboard
  contractorLeaderboardStats,
  type ContractorLeaderboardStats,
  type InsertContractorLeaderboardStats,
  // New marketplace features types
  type MarketplaceTransaction,
  type InsertMarketplaceTransaction,
  type TransactionDispute,
  type InsertTransactionDispute,
  type UserReview,
  type InsertUserReview,
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
} from "@shared/schema";
import { db } from "./db";
import { eq, and, desc, asc, sql, inArray, like, gt, or, lt, isNull, isNotNull, ne, gte, lte } from "drizzle-orm";

export interface IStorage {
  // User operations
  getUser(id: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateUser(id: string, updates: Partial<User>): Promise<User>;
  upsertUser(user: UpsertUser): Promise<User>;
  deleteUser(userId: string): Promise<void>;
  getAllUsers(): Promise<User[]>;
  
  // Contractor operations
  getContractors(filters?: {
    countyId?: string;
    tradeIds?: string[];
    sortBy?: 'recommended' | 'rating' | 'years' | 'verified';
    limit?: number;
    offset?: number;
  }): Promise<Contractor[]>;
  getContractorBySlug(slug: string): Promise<Contractor | undefined>;
  getContractorById(id: string): Promise<Contractor | undefined>;
  createContractor(contractor: InsertContractor): Promise<Contractor>;
  updateContractor(id: string, updates: Partial<InsertContractor>): Promise<Contractor>;
  
  // County operations
  getCounties(stateCode?: string): Promise<County[]>;
  getCountyByFips(fips: string): Promise<County | undefined>;
  upsertCounty(county: InsertCounty): Promise<County>;
  
  // Trade operations
  getTrades(parentId?: string): Promise<Trade[]>;
  getTradeBySlug(slug: string): Promise<Trade | undefined>;
  createTrade(trade: InsertTrade): Promise<Trade>;
  
  // Recommendation operations
  getRecommendations(contractorId: string): Promise<Recommendation[]>;
  createRecommendation(recommendation: InsertRecommendation): Promise<Recommendation>;
  getContractorRatings(contractorId: string): Promise<{ count: number; average: number }>;
  
  // Leaderboard operations
  updateContractorLeaderboardStats(contractorId: string, rating: number): Promise<void>;
  getMonthlyLeaderboard(month: number, year: number, limit: number, state?: string, county?: string): Promise<any[]>;
  getLifetimeLeaderboard(limit: number, state?: string, county?: string): Promise<any[]>;
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
  createAcceleratorMembership(membership: InsertAcceleratorMembership): Promise<AcceleratorMembership>;
  getAcceleratorMembership(contractorId: string): Promise<AcceleratorMembership | undefined>;
  
  // Pricing operations
  getPricingData(service: string, fips?: string): Promise<PricingData[]>;
  upsertPricingData(data: InsertPricingData): Promise<PricingData>;
  
  // Analytics operations
  logEvent(eventType: string, data: any): Promise<void>;
  getEventStats(eventType: string, dateRange?: { from: Date; to: Date }): Promise<number>;

  // Chat system operations
  // Conversations
  createConversation(conversation: InsertConversation): Promise<Conversation>;
  getConversation(id: string): Promise<Conversation | undefined>;
  getConversationsByUser(userId: string, userType: 'homeowner' | 'contractor'): Promise<Conversation[]>;
  updateConversation(id: string, updates: Partial<Conversation>): Promise<Conversation>;
  rateConversation(id: string, rating: number, feedback: string, raterType: 'homeowner' | 'contractor'): Promise<Conversation>;
  
  // Messages
  createMessage(message: InsertMessage): Promise<Message>;
  getMessagesByConversation(conversationId: string): Promise<Message[]>;
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
  getTargetedAd(criteria: { audience: string; state?: string; county?: string; }): Promise<Advertisement | null>;
  incrementAdImpressions(adId: string): Promise<void>;
  incrementAdClicks(adId: string): Promise<void>;
  saveAdForUser(userId: string, adId: string): Promise<SavedAd>;
  getSavedAdsForUser(userId: string): Promise<Advertisement[]>;
  removeSavedAd(userId: string, adId: string): Promise<void>;
  
  // Notification operations
  createNotification(notification: InsertNotification): Promise<Notification>;
  getUserNotifications(userId: string, unreadOnly?: boolean): Promise<Notification[]>;
  markNotificationAsRead(notificationId: string): Promise<void>;
  markAllNotificationsAsRead(userId: string): Promise<void>;
  getSavedAdsForReminders(): Promise<Array<SavedAd & { user: User; ad: Advertisement }>>;
  updateSavedAdReminderStatus(savedAdId: string, reminderCount: number): Promise<void>;
  
  // Error Report operations
  createErrorReport(report: any): Promise<any>;
  updateErrorReport(id: string, updates: any): Promise<any>;
  getErrorReports(): Promise<any[]>;
  
  // Heatmap operations
  getLocalityHeatmapData(days: number): Promise<Array<{
    state: string;
    county: string;
    interactions: number;
    users: number;
    contractors: number;
    homeowners: number;
    latitude: number;
    longitude: number;
  }>>;

  // Contractor Promo operations
  createContractorPromo(promo: InsertContractorPromo): Promise<ContractorPromo>;
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
  updateMarketplaceCategory(id: string, updates: Partial<MarketplaceCategory>): Promise<MarketplaceCategory>;
  deleteMarketplaceCategory(id: string): Promise<void>;
  
  // Listings
  getMarketplaceListings(filters?: {
    categoryId?: string;
    county?: string;
    state?: string;
    priceMin?: number;
    priceMax?: number;
    condition?: string;
    searchQuery?: string;
    sortBy?: 'price_asc' | 'price_desc' | 'date_desc' | 'date_asc';
    limit?: number;
    offset?: number;
  }): Promise<MarketplaceListing[]>;
  getMarketplaceListing(id: string): Promise<MarketplaceListing | undefined>;
  getMarketplaceListingBySlug(slug: string): Promise<MarketplaceListing | undefined>;
  createMarketplaceListing(listing: InsertMarketplaceListing): Promise<MarketplaceListing>;
  updateMarketplaceListing(id: string, updates: Partial<MarketplaceListing>): Promise<MarketplaceListing>;
  deleteMarketplaceListing(id: string): Promise<void>;
  getUserListings(userId: string): Promise<MarketplaceListing[]>;
  incrementListingView(listingId: string): Promise<void>;
  generateListingSlug(title: string): Promise<string>;
  
  // Inquiries
  createMarketplaceInquiry(inquiry: InsertMarketplaceInquiry): Promise<MarketplaceInquiry>;
  getMarketplaceInquiry(id: string): Promise<MarketplaceInquiry | undefined>;
  getListingInquiries(listingId: string): Promise<MarketplaceInquiry[]>;
  getUserInquiries(userId: string, type: 'sent' | 'received'): Promise<MarketplaceInquiry[]>;
  updateMarketplaceInquiry(id: string, updates: Partial<MarketplaceInquiry>): Promise<MarketplaceInquiry>;
  
  // Favorites
  createMarketplaceFavorite(favorite: InsertMarketplaceFavorite): Promise<MarketplaceFavorite>;
  removeMarketplaceFavorite(userId: string, listingId: string): Promise<void>;
  getUserFavorites(userId: string): Promise<MarketplaceListing[]>;
  
  // Reports
  createMarketplaceReport(report: InsertMarketplaceReport): Promise<MarketplaceReport>;
  getMarketplaceReports(): Promise<MarketplaceReport[]>;
  updateMarketplaceReport(id: string, updates: Partial<MarketplaceReport>): Promise<MarketplaceReport>;

  // Marketplace Conversation operations
  createMarketplaceConversation(data: InsertMarketplaceConversation): Promise<MarketplaceConversation>;
  getMarketplaceConversation(id: string): Promise<MarketplaceConversation | undefined>;
  getMarketplaceConversationByParticipants(listingId: string, buyerId: string, sellerId: string): Promise<MarketplaceConversation | undefined>;
  getUserMarketplaceConversations(userId: string): Promise<any[]>;
  createMarketplaceMessage(data: InsertMarketplaceMessage): Promise<MarketplaceMessage>;
  getMarketplaceMessages(conversationId: string): Promise<MarketplaceMessage[]>;
  markMarketplaceMessagesAsRead(conversationId: string, userId: string): Promise<void>;
  
  // Marketplace Verification
  createVendorVerification(verification: InsertVendorVerification): Promise<VendorVerification>;
  createBuyerVerification(verification: InsertBuyerVerification): Promise<BuyerVerification>;
  getVendorVerificationByUserId(userId: string): Promise<VendorVerification | undefined>;
  getBuyerVerificationByUserId(userId: string): Promise<BuyerVerification | undefined>;
  getVerifications(filters: { type: string; status: string }): Promise<(VendorVerification | BuyerVerification)[]>;
  updateVerification(id: string, updates: any): Promise<VendorVerification | BuyerVerification>;
  
  // Address Verification
  createAddressVerification(verification: InsertAddressVerification): Promise<AddressVerification>;
  getAddressVerificationByUserId(userId: string): Promise<AddressVerification | undefined>;
  updateAddressVerification(id: string, updates: Partial<AddressVerification>): Promise<AddressVerification>;
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
  createUserModerationReputation(reputation: InsertUserModerationReputation): Promise<UserModerationReputation>;
  updateUserModerationReputation(userId: string, updates: Partial<UserModerationReputation>): Promise<UserModerationReputation>;
  
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
  updateModerationSettings(id: string, updates: Partial<ModerationSettings>): Promise<ModerationSettings>;
  
  // Utility methods
  canUserVoteOnReport(userId: string, reportId: string): Promise<boolean>;
  calculateLocalVoterWeight(voterCounty: string, voterState: string, contentCounty: string, contentState: string): Promise<number>;
  processVoteResult(reportId: string): Promise<void>;
  
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
  incrementInvitationsAccepted(userId: string, targetRole: 'homeowner' | 'contractor_user'): Promise<void>;
  getTopReferrers(limit: number): Promise<(ReferralStats & { user: User })[]>;
  
  // Professional profile operations
  createRealtorProfile(profile: InsertRealtorProfile): Promise<RealtorProfile>;
  getRealtorProfile(id: string): Promise<RealtorProfile | undefined>;
  getRealtorProfileByUserId(userId: string): Promise<RealtorProfile | undefined>;
  updateRealtorProfile(id: string, profileData: Partial<RealtorProfile>): Promise<RealtorProfile>;
  
  createCarSalesmanProfile(profile: InsertCarSalesmanProfile): Promise<CarSalesmanProfile>;
  getCarSalesmanProfile(id: string): Promise<CarSalesmanProfile | undefined>;
  getCarSalesmanProfileByUserId(userId: string): Promise<CarSalesmanProfile | undefined>;
  updateCarSalesmanProfile(id: string, profileData: Partial<CarSalesmanProfile>): Promise<CarSalesmanProfile>;
  
  // Professional verification methods
  getPendingRealtorApplications(): Promise<RealtorProfile[]>;
  getPendingCarSalesmanApplications(): Promise<CarSalesmanProfile[]>;
  updateRealtorVerificationStatus(profileId: string, verificationData: {
    approved: boolean;
    notes: string;
    reviewedBy: string;
    reviewedAt: Date;
  }): Promise<RealtorProfile>;
  updateCarSalesmanVerificationStatus(profileId: string, verificationData: {
    approved: boolean;
    notes: string;
    reviewedBy: string;
    reviewedAt: Date;
  }): Promise<CarSalesmanProfile>;

  // Advanced marketplace transaction operations
  createMarketplaceTransaction(transaction: InsertMarketplaceTransaction): Promise<MarketplaceTransaction>;
  getMarketplaceTransaction(id: string): Promise<MarketplaceTransaction | undefined>;
  getMarketplaceTransactionsByUser(userId: string, role: 'buyer' | 'seller'): Promise<MarketplaceTransaction[]>;
  updateMarketplaceTransaction(id: string, updates: Partial<MarketplaceTransaction>): Promise<MarketplaceTransaction>;
  
  // Transaction dispute operations
  createTransactionDispute(dispute: InsertTransactionDispute): Promise<TransactionDispute>;
  getTransactionDispute(id: string): Promise<TransactionDispute | undefined>;
  getTransactionDisputes(transactionId?: string): Promise<TransactionDispute[]>;
  updateTransactionDispute(id: string, updates: Partial<TransactionDispute>): Promise<TransactionDispute>;
  
  // User review operations
  createUserReview(review: InsertUserReview): Promise<UserReview>;
  getUserReviews(userId: string, role: 'reviewer' | 'reviewee'): Promise<UserReview[]>;
  getUserRatings(userId: string): Promise<{ count: number; average: number }>;
  
  // Real-time notification operations
  createNotification(notification: InsertRealTimeNotification): Promise<RealTimeNotification>;
  getUserNotifications(userId: string, unreadOnly?: boolean): Promise<RealTimeNotification[]>;
  markNotificationAsRead(id: string): Promise<RealTimeNotification>;
  markAllNotificationsAsRead(userId: string): Promise<void>;
  
  // Search and discovery operations
  createSavedSearch(search: InsertSavedSearch): Promise<SavedSearch>;
  getUserSavedSearches(userId: string): Promise<SavedSearch[]>;
  deleteSavedSearch(id: string): Promise<void>;
  logSearchAnalytics(analytics: InsertSearchAnalytics): Promise<SearchAnalytics>;
  
  // Platform analytics operations
  updatePlatformAnalytics(date: Date, updates: Partial<InsertPlatformAnalytics>): Promise<PlatformAnalytics>;
  getPlatformAnalytics(fromDate: Date, toDate: Date): Promise<PlatformAnalytics[]>;
  
  // Enhanced marketplace conversation operations
  getMarketplaceConversationByListing(listingId: string, buyerId: string): Promise<MarketplaceConversation | undefined>;
  markMarketplaceMessageAsRead(id: string): Promise<MarketplaceMessage>;
}

export class DatabaseStorage implements IStorage {
  // User operations
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.email, email));
    return user;
  }

  async createUser(userData: InsertUser): Promise<User> {
    const [user] = await db.insert(users).values(userData).returning();
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

  // Contractor operations
  async getContractors(filters?: {
    countyId?: string;
    tradeIds?: string[];
    sortBy?: 'recommended' | 'rating' | 'years' | 'verified';
    limit?: number;
    offset?: number;
  }): Promise<Contractor[]> {
    // Start with basic contractor query without ordering for now
    let query = db.select().from(contractors).where(eq(contractors.isActive, true));

    if (filters?.limit) {
      query = query.limit(filters.limit) as any;
    }

    if (filters?.offset) {
      query = query.offset(filters.offset) as any;
    }

    let result = await query;

    // Filter by county if specified
    if (filters?.countyId) {
      const contractorIds = await db.select({
        contractorId: contractorCounties.contractorId
      }).from(contractorCounties).where(eq(contractorCounties.countyId, filters.countyId));
      
      const validIds = contractorIds.map(row => row.contractorId);
      result = result.filter(contractor => validIds.includes(contractor.id));
    }

    // Filter by trade if specified
    if (filters?.tradeIds?.length) {
      const contractorIds = await db.select({
        contractorId: contractorTrades.contractorId
      }).from(contractorTrades).where(inArray(contractorTrades.tradeId, filters.tradeIds));
      
      const validIds = contractorIds.map(row => row.contractorId);
      result = result.filter(contractor => validIds.includes(contractor.id));
    }

    // Apply sorting in memory for now
    if (filters?.sortBy) {
      switch (filters.sortBy) {
        case 'rating':
          result.sort((a, b) => (b.yearsInBusiness || 0) - (a.yearsInBusiness || 0));
          break;
        case 'years':
          result.sort((a, b) => (b.yearsInBusiness || 0) - (a.yearsInBusiness || 0));
          break;
        case 'verified':
          result.sort((a, b) => {
            const aDate = a.lastVerified ? new Date(a.lastVerified).getTime() : 0;
            const bDate = b.lastVerified ? new Date(b.lastVerified).getTime() : 0;
            return bDate - aDate;
          });
          break;
        default:
          // Default to "Most Recommended" - order by rating then reviews
          result.sort((a, b) => {
            // Simplified sorting without avgRating/totalReviews
            return 0;
          });
      }
    }

    return result;
  }

  async getContractorBySlug(slug: string): Promise<Contractor | undefined> {
    const [contractor] = await db
      .select()
      .from(contractors)
      .where(and(eq(contractors.slug, slug), eq(contractors.isActive, true)));
    return contractor;
  }

  async getContractorById(id: string): Promise<Contractor | undefined> {
    const [contractor] = await db
      .select()
      .from(contractors)
      .where(eq(contractors.id, id));
    return contractor;
  }

  async createContractor(contractor: InsertContractor): Promise<Contractor> {
    const [newContractor] = await db
      .insert(contractors)
      .values(contractor)
      .returning();
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
  async getCounties(stateCode?: string): Promise<County[]> {
    let query = db.select().from(counties);
    
    if (stateCode) {
      query = query.where(eq(counties.stateCode, stateCode));
    }
    
    return await query.orderBy(asc(counties.name));
  }

  async getCountyByFips(fips: string): Promise<County | undefined> {
    const [county] = await db.select().from(counties).where(eq(counties.fips, fips));
    return county;
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
    let query = db.select().from(trades);
    
    if (parentId) {
      query = query.where(eq(trades.parentId, parentId));
    } else {
      query = query.where(sql`${trades.parentId} IS NULL`);
    }
    
    return await query.orderBy(asc(trades.name));
  }

  async getTradeBySlug(slug: string): Promise<Trade | undefined> {
    const [trade] = await db.select().from(trades).where(eq(trades.slug, slug));
    return trade;
  }

  async createTrade(trade: InsertTrade): Promise<Trade> {
    const [newTrade] = await db.insert(trades).values(trade).returning();
    return newTrade;
  }

  // Recommendation operations
  async getRecommendations(contractorId: string): Promise<Recommendation[]> {
    return db
      .select()
      .from(recommendations)
      .where(eq(recommendations.contractorId, contractorId))
      .orderBy(desc(recommendations.createdAt));
  }

  async createRecommendation(recommendation: InsertRecommendation): Promise<Recommendation> {
    const [newRecommendation] = await db
      .insert(recommendations)
      .values(recommendation)
      .returning();
    return newRecommendation;
  }

  async getContractorRatings(contractorId: string): Promise<{ count: number; average: number }> {
    const [result] = await db
      .select({
        count: sql<number>`count(*)`,
        average: sql<number>`avg(${recommendations.rating})`,
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

  async getLeads(contractorId?: string, status?: string): Promise<Lead[]> {
    let query = db.select().from(leads);
    
    const conditions = [];
    if (contractorId) {
      conditions.push(eq(leads.contractorId, contractorId));
    }
    if (status) {
      conditions.push(eq(leads.status, status));
    }
    
    if (conditions.length > 0) {
      query = query.where(and(...conditions));
    }
    
    return await query.orderBy(desc(leads.createdAt));
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
    const assignments = contractorIds.map(contractorId => ({
      leadId,
      contractorId,
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
    }));
    
    await db.insert(leadAssignments).values(assignments);
  }

  // Growth Pack operations
  async createGrowthPackDownload(download: InsertGrowthPackDownload): Promise<GrowthPackDownload> {
    const [newDownload] = await db
      .insert(growthPackDownloads)
      .values(download)
      .returning();
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
  async createAcceleratorMembership(membership: InsertAcceleratorMembership): Promise<AcceleratorMembership> {
    const [newMembership] = await db
      .insert(acceleratorMemberships)
      .values(membership)
      .returning();
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
    let query = db
      .select()
      .from(pricingData)
      .where(eq(pricingData.service, service));
    
    if (fips) {
      query = query.where(and(
        eq(pricingData.service, service),
        eq(pricingData.fips, fips)
      ));
    }
    
    return await query;
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
    await db.insert(events).values({
      eventType,
      data,
      ipAddress: data.ipAddress,
      userAgent: data.userAgent,
      userId: data.userId,
      contractorId: data.contractorId,
    });
  }

  async getEventStats(eventType: string, dateRange?: { from: Date; to: Date }): Promise<number> {
    let query = db
      .select({ count: sql<number>`count(*)` })
      .from(events)
      .where(eq(events.eventType, eventType));
    
    if (dateRange) {
      query = query.where(and(
        eq(events.eventType, eventType),
        gt(events.createdAt, dateRange.from),
        sql`${events.createdAt} < ${dateRange.to}`
      ));
    }
    
    const [result] = await query;
    return result?.count || 0;
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

  async getConversationsByUser(userId: string, userType: 'homeowner' | 'contractor'): Promise<Conversation[]> {
    const userField = userType === 'homeowner' ? conversations.homeownerId : conversations.contractorId;
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

  async rateConversation(id: string, rating: number, feedback: string, raterType: 'homeowner' | 'contractor'): Promise<Conversation> {
    const updateData = raterType === 'homeowner' 
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
    status: 'approved' | 'denied', 
    denialReason?: string
  ): Promise<MaterialList> {
    const [existingList] = await db.select().from(materialLists).where(eq(materialLists.id, materialListId));
    if (!existingList) {
      throw new Error("Material list not found");
    }

    const items = existingList.items as any[];
    const updatedItems = items.map(item => {
      if (item.id === itemId) {
        return {
          ...item,
          status,
          denialReason: status === 'denied' ? denialReason : undefined
        };
      }
      return item;
    });

    const [updatedList] = await db
      .update(materialLists)
      .set({ 
        items: updatedItems,
        updatedAt: new Date()
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
      suggestedBy: 'homeowner' | 'contractor';
      notes?: string;
    }
  ): Promise<MaterialList> {
    const [existingList] = await db.select().from(materialLists).where(eq(materialLists.id, materialListId));
    if (!existingList) {
      throw new Error("Material list not found");
    }

    const items = existingList.items as any[];
    const newItem = {
      ...suggestion,
      status: 'pending' as const
    };

    const updatedItems = [...items, newItem];

    const [updatedList] = await db
      .update(materialLists)
      .set({ 
        items: updatedItems,
        updatedAt: new Date()
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

  async updatePrizeConfiguration(id: string, updates: Partial<InsertPrizeConfiguration>): Promise<PrizeConfiguration> {
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

  async updateAdvertisement(id: string, updates: Partial<InsertAdvertisement>): Promise<Advertisement> {
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

  // Get targeted ad based on audience and location
  async getTargetedAd(criteria: { 
    audience: string; 
    state?: string; 
    county?: string; 
  }): Promise<Advertisement | null> {
    // Build location targeting filters
    const locationFilters = ['national'];
    
    if (criteria.state) {
      locationFilters.push(`state:${criteria.state}`);
    }
    
    if (criteria.county) {
      locationFilters.push(`county:${criteria.county}`);
    }

    // Query for active ads matching audience and location
    const ads = await db
      .select()
      .from(advertisements)
      .where(
        and(
          eq(advertisements.isActive, true),
          eq(advertisements.placement, 'site_visit'),
          inArray(advertisements.targetLocation, locationFilters),
          criteria.audience !== 'all' 
            ? eq(advertisements.targetAudience, criteria.audience)
            : sql`1=1`
        )
      )
      .orderBy(desc(advertisements.priority), sql`RANDOM()`)
      .limit(1);

    return ads[0] || null;
  }

  async incrementAdImpressions(adId: string): Promise<void> {
    await db
      .update(advertisements)
      .set({ 
        impressions: sql`${advertisements.impressions} + 1`,
        viewCount: sql`${advertisements.viewCount} + 1`
      })
      .where(eq(advertisements.id, adId));
  }

  async incrementAdClicks(adId: string): Promise<void> {
    await db
      .update(advertisements)
      .set({ 
        clickCount: sql`${advertisements.clickCount} + 1`
      })
      .where(eq(advertisements.id, adId));
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

    const [savedAd] = await db
      .insert(savedAds)
      .values({ userId, adId })
      .returning();
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
    await db
      .delete(savedAds)
      .where(and(eq(savedAds.userId, userId), eq(savedAds.adId, adId)));
  }

  // Notification system operations
  async createNotification(notification: InsertNotification): Promise<Notification> {
    const [newNotification] = await db
      .insert(notifications)
      .values(notification)
      .returning();
    return newNotification;
  }

  async getUserNotifications(userId: string, unreadOnly: boolean = false): Promise<Notification[]> {
    let query = db
      .select()
      .from(notifications)
      .where(eq(notifications.userId, userId))
      .orderBy(desc(notifications.createdAt));

    if (unreadOnly) {
      query = query.where(and(eq(notifications.userId, userId), eq(notifications.isRead, false)));
    }

    return await query;
  }

  async markNotificationAsRead(notificationId: string): Promise<void> {
    await db
      .update(notifications)
      .set({ isRead: true })
      .where(eq(notifications.id, notificationId));
  }

  async markAllNotificationsAsRead(userId: string): Promise<void> {
    await db
      .update(notifications)
      .set({ isRead: true })
      .where(eq(notifications.userId, userId));
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
        }
      })
      .from(savedAds)
      .innerJoin(users, eq(savedAds.userId, users.id))
      .innerJoin(advertisements, eq(savedAds.adId, advertisements.id))
      .where(
        and(
          eq(savedAds.isActive, true),
          eq(advertisements.isActive, true),
          or(
            isNull(advertisements.endDate),
            gt(advertisements.endDate, new Date())
          ),
          or(
            // First reminder: 3 days after saving
            and(
              isNull(savedAds.lastReminderSent),
              lt(savedAds.savedAt, threeDaysAgo)
            ),
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
        reminderCount: reminderCount
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
      return await db.select().from(contractorSettings).where(eq(contractorSettings.category, category));
    }
    return await db.select().from(contractorSettings).orderBy(contractorSettings.category, contractorSettings.setting);
  }

  async updateContractorSetting(id: string, updates: Partial<InsertContractorSetting>): Promise<ContractorSetting> {
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
    const [errorReport] = await db.insert(errorReports).values({
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
    }).returning();
    return errorReport;
  }

  async updateErrorReport(id: string, updates: any): Promise<any> {
    const [errorReport] = await db.update(errorReports)
      .set({
        ...updates,
        updatedAt: new Date(),
      })
      .where(eq(errorReports.id, id))
      .returning();
    return errorReport;
  }

  async getErrorReports(): Promise<any[]> {
    return await db.select().from(errorReports).orderBy(desc(errorReports.createdAt));
  }

  // Heatmap operations
  async getLocalityHeatmapData(days: number): Promise<Array<{
    state: string;
    county: string;
    interactions: number;
    users: number;
    contractors: number;
    homeowners: number;
    latitude: number;
    longitude: number;
  }>> {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    // For now, return sample data based on existing counties
    // In the future, this would query the locality_interactions table
    const sampleData = [
      {
        state: 'CA',
        county: 'Los Angeles County',
        interactions: 145,
        users: 34,
        contractors: 12,
        homeowners: 22,
        latitude: 34.0522,
        longitude: -118.2437
      },
      {
        state: 'TX',
        county: 'Harris County',
        interactions: 98,
        users: 28,
        contractors: 9,
        homeowners: 19,
        latitude: 29.7604,
        longitude: -95.3698
      },
      {
        state: 'FL',
        county: 'Miami-Dade County',
        interactions: 76,
        users: 22,
        contractors: 7,
        homeowners: 15,
        latitude: 25.7617,
        longitude: -80.1918
      },
      {
        state: 'NY',
        county: 'New York County',
        interactions: 189,
        users: 45,
        contractors: 18,
        homeowners: 27,
        latitude: 40.7128,
        longitude: -74.0060
      },
      {
        state: 'IL',
        county: 'Cook County',
        interactions: 67,
        users: 19,
        contractors: 6,
        homeowners: 13,
        latitude: 41.8781,
        longitude: -87.6298
      },
      {
        state: 'WA',
        county: 'King County',
        interactions: 54,
        users: 16,
        contractors: 5,
        homeowners: 11,
        latitude: 47.6062,
        longitude: -122.3321
      }
    ];

    return sampleData;
  }

  // Contractor Promo Operations
  async createContractorPromo(promo: InsertContractorPromo): Promise<ContractorPromo> {
    const slug = await this.generatePromoSlug(promo.title);
    const [newPromo] = await db
      .insert(contractorPromos)
      .values({ ...promo, slug })
      .returning();
    return newPromo;
  }

  async getContractorPromo(id: string): Promise<ContractorPromo | undefined> {
    const [promo] = await db
      .select()
      .from(contractorPromos)
      .where(eq(contractorPromos.id, id));
    return promo;
  }

  async getContractorPromoBySlug(slug: string): Promise<ContractorPromo | undefined> {
    const [promo] = await db
      .select()
      .from(contractorPromos)
      .where(eq(contractorPromos.slug, slug));
    return promo;
  }

  async getContractorPromos(contractorId: string): Promise<ContractorPromo[]> {
    return await db
      .select()
      .from(contractorPromos)
      .where(eq(contractorPromos.contractorId, contractorId))
      .orderBy(desc(contractorPromos.createdAt));
  }

  async updateContractorPromo(id: string, updates: Partial<ContractorPromo>): Promise<ContractorPromo> {
    const [updatedPromo] = await db
      .update(contractorPromos)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(contractorPromos.id, id))
      .returning();
    return updatedPromo;
  }

  async deleteContractorPromo(id: string): Promise<void> {
    await db
      .delete(contractorPromos)
      .where(eq(contractorPromos.id, id));
  }

  async generatePromoSlug(title: string): Promise<string> {
    const baseSlug = title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
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
    const [newInteraction] = await db
      .insert(promoInteractions)
      .values(interaction)
      .returning();
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
        updatedAt: new Date()
      })
      .where(eq(contractorPromos.id, promoId));
  }

  async incrementPromoClick(promoId: string): Promise<void> {
    await db
      .update(contractorPromos)
      .set({ 
        clickCount: sql`${contractorPromos.clickCount} + 1`,
        updatedAt: new Date()
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
          or(
            isNull(contractorPromos.expiresAt),
            gt(contractorPromos.expiresAt, now)
          ),
          or(
            isNull(contractorPromos.maxUses),
            sql`${contractorPromos.currentUses} < ${contractorPromos.maxUses}`
          )
        )
      )
      .orderBy(desc(contractorPromos.createdAt));
  }

  // Marketplace operations
  // Categories
  async getMarketplaceCategories(): Promise<MarketplaceCategory[]> {
    return await db
      .select()
      .from(marketplaceCategories)
      .where(eq(marketplaceCategories.isActive, true))
      .orderBy(asc(marketplaceCategories.sortOrder), asc(marketplaceCategories.name));
  }

  async createMarketplaceCategory(categoryData: InsertMarketplaceCategory): Promise<MarketplaceCategory> {
    const [category] = await db.insert(marketplaceCategories).values(categoryData).returning();
    return category;
  }

  async updateMarketplaceCategory(id: string, updates: Partial<MarketplaceCategory>): Promise<MarketplaceCategory> {
    const [category] = await db
      .update(marketplaceCategories)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(marketplaceCategories.id, id))
      .returning();
    return category;
  }

  async deleteMarketplaceCategory(id: string): Promise<void> {
    await db.delete(marketplaceCategories).where(eq(marketplaceCategories.id, id));
  }

  // Listings
  async getMarketplaceListings(filters: {
    categoryId?: string;
    county?: string;
    state?: string;
    priceMin?: number;
    priceMax?: number;
    condition?: string;
    searchQuery?: string;
    sortBy?: 'price_asc' | 'price_desc' | 'date_desc' | 'date_asc';
    limit?: number;
    offset?: number;
    status?: string;
    sellerId?: string;
  } = {}): Promise<MarketplaceListing[]> {
    // Default to active status unless specified
    const statusFilter = filters.status || 'active';
    
    let query = db
      .select()
      .from(marketplaceListings)
      .where(eq(marketplaceListings.status, statusFilter));

    // Apply filters
    const conditions = [eq(marketplaceListings.status, statusFilter)];

    if (filters.categoryId) {
      conditions.push(eq(marketplaceListings.categoryId, filters.categoryId));
    }
    if (filters.sellerId) {
      conditions.push(eq(marketplaceListings.sellerId, filters.sellerId));
    }
    if (filters.county) {
      conditions.push(eq(marketplaceListings.county, filters.county));
    }
    if (filters.state) {
      conditions.push(eq(marketplaceListings.state, filters.state));
    }
    if (filters.condition) {
      conditions.push(eq(marketplaceListings.condition, filters.condition));
    }
    if (filters.priceMin !== undefined) {
      conditions.push(sql`${marketplaceListings.price} >= ${filters.priceMin}`);
    }
    if (filters.priceMax !== undefined) {
      conditions.push(sql`${marketplaceListings.price} <= ${filters.priceMax}`);
    }
    if (filters.searchQuery) {
      conditions.push(
        or(
          like(marketplaceListings.title, `%${filters.searchQuery}%`),
          like(marketplaceListings.description, `%${filters.searchQuery}%`),
          like(marketplaceListings.brand, `%${filters.searchQuery}%`),
          like(marketplaceListings.model, `%${filters.searchQuery}%`)
        )
      );
    }

    query = query.where(and(...conditions));

    // Apply sorting
    switch (filters.sortBy) {
      case 'price_asc':
        query = query.orderBy(asc(marketplaceListings.price));
        break;
      case 'price_desc':
        query = query.orderBy(desc(marketplaceListings.price));
        break;
      case 'date_asc':
        query = query.orderBy(asc(marketplaceListings.createdAt));
        break;
      case 'date_desc':
      default:
        query = query.orderBy(desc(marketplaceListings.createdAt));
        break;
    }

    // Apply pagination
    if (filters.offset) {
      query = query.offset(filters.offset);
    }
    if (filters.limit) {
      query = query.limit(filters.limit);
    }

    return await query;
  }

  async getMarketplaceListing(id: string): Promise<MarketplaceListing | undefined> {
    const [listing] = await db
      .select()
      .from(marketplaceListings)
      .where(eq(marketplaceListings.id, id));
    return listing;
  }

  async getMarketplaceListingBySlug(slug: string): Promise<MarketplaceListing | undefined> {
    const [listing] = await db
      .select()
      .from(marketplaceListings)
      .where(eq(marketplaceListings.slug, slug));
    return listing;
  }

  async createMarketplaceListing(listingData: InsertMarketplaceListing): Promise<MarketplaceListing> {
    // Generate slug from title
    const slug = await this.generateListingSlug(listingData.title);
    
    const [listing] = await db
      .insert(marketplaceListings)
      .values({ ...listingData, slug })
      .returning();
    return listing;
  }

  async updateMarketplaceListing(id: string, updates: Partial<MarketplaceListing>): Promise<MarketplaceListing> {
    const [listing] = await db
      .update(marketplaceListings)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(marketplaceListings.id, id))
      .returning();
    return listing;
  }

  async deleteMarketplaceListing(id: string): Promise<void> {
    await db.delete(marketplaceListings).where(eq(marketplaceListings.id, id));
  }

  async getUserListings(userId: string): Promise<MarketplaceListing[]> {
    return await db
      .select()
      .from(marketplaceListings)
      .where(eq(marketplaceListings.sellerId, userId))
      .orderBy(desc(marketplaceListings.createdAt));
  }

  async incrementListingView(listingId: string): Promise<void> {
    await db
      .update(marketplaceListings)
      .set({ 
        viewCount: sql`${marketplaceListings.viewCount} + 1`,
        updatedAt: new Date()
      })
      .where(eq(marketplaceListings.id, listingId));
  }

  async generateListingSlug(title: string): Promise<string> {
    const baseSlug = title
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .slice(0, 60);

    let slug = baseSlug;
    let counter = 0;

    while (true) {
      const existing = await db
        .select()
        .from(marketplaceListings)
        .where(eq(marketplaceListings.slug, slug))
        .limit(1);

      if (existing.length === 0) {
        return slug;
      }

      counter++;
      slug = `${baseSlug}-${counter}`;
    }
  }

  // Inquiries
  async createMarketplaceInquiry(inquiryData: InsertMarketplaceInquiry): Promise<MarketplaceInquiry> {
    const [inquiry] = await db.insert(marketplaceInquiries).values(inquiryData).returning();
    
    // Increment contact count for the listing
    await db
      .update(marketplaceListings)
      .set({ 
        contactCount: sql`${marketplaceListings.contactCount} + 1`,
        updatedAt: new Date()
      })
      .where(eq(marketplaceListings.id, inquiryData.listingId));
    
    return inquiry;
  }

  async getMarketplaceInquiry(id: string): Promise<MarketplaceInquiry | undefined> {
    const [inquiry] = await db
      .select()
      .from(marketplaceInquiries)
      .where(eq(marketplaceInquiries.id, id));
    return inquiry;
  }

  async getListingInquiries(listingId: string): Promise<MarketplaceInquiry[]> {
    return await db
      .select()
      .from(marketplaceInquiries)
      .where(eq(marketplaceInquiries.listingId, listingId))
      .orderBy(desc(marketplaceInquiries.createdAt));
  }

  async getUserInquiries(userId: string, type: 'sent' | 'received'): Promise<MarketplaceInquiry[]> {
    const condition = type === 'sent' 
      ? eq(marketplaceInquiries.buyerId, userId)
      : eq(marketplaceInquiries.sellerId, userId);

    return await db
      .select()
      .from(marketplaceInquiries)
      .where(condition)
      .orderBy(desc(marketplaceInquiries.createdAt));
  }

  async updateMarketplaceInquiry(id: string, updates: Partial<MarketplaceInquiry>): Promise<MarketplaceInquiry> {
    const [inquiry] = await db
      .update(marketplaceInquiries)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(marketplaceInquiries.id, id))
      .returning();
    return inquiry;
  }

  // Favorites
  async createMarketplaceFavorite(favoriteData: InsertMarketplaceFavorite): Promise<MarketplaceFavorite> {
    const [favorite] = await db.insert(marketplaceFavorites).values(favoriteData).returning();
    
    // Increment favorite count for the listing
    await db
      .update(marketplaceListings)
      .set({ 
        favoriteCount: sql`${marketplaceListings.favoriteCount} + 1`,
        updatedAt: new Date()
      })
      .where(eq(marketplaceListings.id, favoriteData.listingId));
    
    return favorite;
  }

  async removeMarketplaceFavorite(userId: string, listingId: string): Promise<void> {
    await db
      .delete(marketplaceFavorites)
      .where(
        and(
          eq(marketplaceFavorites.userId, userId),
          eq(marketplaceFavorites.listingId, listingId)
        )
      );
    
    // Decrement favorite count for the listing
    await db
      .update(marketplaceListings)
      .set({ 
        favoriteCount: sql`${marketplaceListings.favoriteCount} - 1`,
        updatedAt: new Date()
      })
      .where(eq(marketplaceListings.id, listingId));
  }

  async getUserFavorites(userId: string): Promise<MarketplaceListing[]> {
    return await db
      .select({
        id: marketplaceListings.id,
        sellerId: marketplaceListings.sellerId,
        categoryId: marketplaceListings.categoryId,
        title: marketplaceListings.title,
        description: marketplaceListings.description,
        price: marketplaceListings.price,
        priceType: marketplaceListings.priceType,
        originalPrice: marketplaceListings.originalPrice,
        county: marketplaceListings.county,
        state: marketplaceListings.state,
        city: marketplaceListings.city,
        zipCode: marketplaceListings.zipCode,
        isLocalPickupOnly: marketplaceListings.isLocalPickupOnly,
        willShip: marketplaceListings.willShip,
        shippingCost: marketplaceListings.shippingCost,
        condition: marketplaceListings.condition,
        brand: marketplaceListings.brand,
        model: marketplaceListings.model,
        year: marketplaceListings.year,
        mileage: marketplaceListings.mileage,
        hours: marketplaceListings.hours,
        specifications: marketplaceListings.specifications,
        images: marketplaceListings.images,
        primaryImageIndex: marketplaceListings.primaryImageIndex,
        videoUrl: marketplaceListings.videoUrl,
        status: marketplaceListings.status,
        isPromoted: marketplaceListings.isPromoted,
        promotedUntil: marketplaceListings.promotedUntil,
        viewCount: marketplaceListings.viewCount,
        favoriteCount: marketplaceListings.favoriteCount,
        contactCount: marketplaceListings.contactCount,
        slug: marketplaceListings.slug,
        metaDescription: marketplaceListings.metaDescription,
        tags: marketplaceListings.tags,
        expiresAt: marketplaceListings.expiresAt,
        createdAt: marketplaceListings.createdAt,
        updatedAt: marketplaceListings.updatedAt,
      })
      .from(marketplaceFavorites)
      .innerJoin(marketplaceListings, eq(marketplaceFavorites.listingId, marketplaceListings.id))
      .where(eq(marketplaceFavorites.userId, userId))
      .orderBy(desc(marketplaceFavorites.createdAt));
  }

  // Reports
  async createMarketplaceReport(reportData: InsertMarketplaceReport): Promise<MarketplaceReport> {
    const [report] = await db.insert(marketplaceReports).values(reportData).returning();
    return report;
  }

  async getMarketplaceReports(): Promise<MarketplaceReport[]> {
    return await db
      .select()
      .from(marketplaceReports)
      .orderBy(desc(marketplaceReports.createdAt));
  }

  async updateMarketplaceReport(id: string, updates: Partial<MarketplaceReport>): Promise<MarketplaceReport> {
    const [report] = await db
      .update(marketplaceReports)
      .set(updates)
      .where(eq(marketplaceReports.id, id))
      .returning();
    return report;
  }

  // Marketplace Verification
  async createVendorVerification(verificationData: InsertVendorVerification): Promise<VendorVerification> {
    const [verification] = await db.insert(vendorVerifications).values(verificationData).returning();
    return verification;
  }

  async createBuyerVerification(verificationData: InsertBuyerVerification): Promise<BuyerVerification> {
    const [verification] = await db.insert(buyerVerifications).values(verificationData).returning();
    return verification;
  }

  async getVendorVerificationByUserId(userId: string): Promise<VendorVerification | undefined> {
    const [verification] = await db
      .select()
      .from(vendorVerifications)
      .where(eq(vendorVerifications.userId, userId))
      .orderBy(desc(vendorVerifications.createdAt));
    return verification;
  }

  async getBuyerVerificationByUserId(userId: string): Promise<BuyerVerification | undefined> {
    const [verification] = await db
      .select()
      .from(buyerVerifications)
      .where(eq(buyerVerifications.userId, userId))
      .orderBy(desc(buyerVerifications.createdAt));
    return verification;
  }

  async getVerifications(filters: { type: string; status: string }): Promise<(VendorVerification | BuyerVerification)[]> {
    const results: (VendorVerification | BuyerVerification)[] = [];
    
    if (filters.type === 'all' || filters.type === 'vendor') {
      let vendorQuery = db.select().from(vendorVerifications);
      if (filters.status !== 'all') {
        vendorQuery = vendorQuery.where(eq(vendorVerifications.status, filters.status)) as any;
      }
      const vendorResults = await vendorQuery.orderBy(desc(vendorVerifications.createdAt));
      results.push(...vendorResults);
    }
    
    if (filters.type === 'all' || filters.type === 'buyer') {
      let buyerQuery = db.select().from(buyerVerifications);
      if (filters.status !== 'all') {
        buyerQuery = buyerQuery.where(eq(buyerVerifications.status, filters.status)) as any;
      }
      const buyerResults = await buyerQuery.orderBy(desc(buyerVerifications.createdAt));
      results.push(...buyerResults);
    }
    
    return results.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  async updateVerification(id: string, updates: any): Promise<VendorVerification | BuyerVerification> {
    // Try vendor verification first
    try {
      const [vendorVerification] = await db
        .update(vendorVerifications)
        .set(updates)
        .where(eq(vendorVerifications.id, id))
        .returning();
      if (vendorVerification) return vendorVerification;
    } catch (error) {
      // If vendor update fails, try buyer verification
    }
    
    const [buyerVerification] = await db
      .update(buyerVerifications)
      .set(updates)
      .where(eq(buyerVerifications.id, id))
      .returning();
    return buyerVerification;
  }

  // Address Verification
  async createAddressVerification(verificationData: InsertAddressVerification): Promise<AddressVerification> {
    const [verification] = await db.insert(addressVerifications).values(verificationData).returning();
    return verification;
  }

  async getAddressVerificationByUserId(userId: string): Promise<AddressVerification | undefined> {
    const [verification] = await db
      .select()
      .from(addressVerifications)
      .where(eq(addressVerifications.userId, userId))
      .orderBy(desc(addressVerifications.createdAt));
    return verification;
  }

  async updateAddressVerification(id: string, updates: Partial<AddressVerification>): Promise<AddressVerification> {
    const [verification] = await db
      .update(addressVerifications)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(addressVerifications.id, id))
      .returning();
    return verification;
  }

  async getAddressVerificationsNeedingReminders(): Promise<AddressVerification[]> {
    const threeDaysFromNow = new Date();
    threeDaysFromNow.setDate(threeDaysFromNow.getDate() + 3);
    
    return await db
      .select()
      .from(addressVerifications)
      .where(
        and(
          eq(addressVerifications.status, 'pending'),
          sql`${addressVerifications.deadline} <= ${threeDaysFromNow}`,
          or(
            isNull(addressVerifications.lastReminderSent),
            sql`${addressVerifications.lastReminderSent} < NOW() - INTERVAL '24 hours'`
          )
        )
      );
  }

  async getExpiredAddressVerifications(): Promise<AddressVerification[]> {
    return await db
      .select()
      .from(addressVerifications)
      .where(
        and(
          eq(addressVerifications.status, 'pending'),
          sql`${addressVerifications.deadline} < NOW()`
        )
      );
  }

  async sendAddressVerificationPostcard(userId: string, code: string): Promise<void> {
    await db
      .update(addressVerifications)
      .set({
        postcardCode: code,
        postcardSentAt: new Date(),
        verificationMethod: 'postcard',
        updatedAt: new Date()
      })
      .where(eq(addressVerifications.userId, userId));
  }

  async verifyAddressWithPostcard(userId: string, code: string): Promise<boolean> {
    const [verification] = await db
      .select()
      .from(addressVerifications)
      .where(
        and(
          eq(addressVerifications.userId, userId),
          eq(addressVerifications.postcardCode, code),
          isNotNull(addressVerifications.postcardSentAt)
        )
      );

    if (!verification) {
      return false;
    }

    // Update verification as approved
    await db
      .update(addressVerifications)
      .set({
        status: 'approved',
        postcardVerifiedAt: new Date(),
        approvedAt: new Date(),
        updatedAt: new Date()
      })
      .where(eq(addressVerifications.id, verification.id));

    // Update user's address verification status
    await db
      .update(users)
      .set({
        addressVerified: true,
        updatedAt: new Date()
      })
      .where(eq(users.id, userId));

    return true;
  }

  // Social Features Operations
  async createCommunityPost(post: InsertCommunityPost): Promise<CommunityPost> {
    const [newPost] = await db
      .insert(communityPosts)
      .values(post)
      .returning();
    return newPost;
  }

  async getCommunityPosts(filters?: {
    scope?: string;
    stateCode?: string;
    countyFips?: string;
    category?: string;
    authorId?: string;
    limit?: number;
    offset?: number;
  }): Promise<CommunityPost[]> {
    let query = db.select().from(communityPosts);
    
    if (filters?.scope) {
      query = query.where(eq(communityPosts.scope, filters.scope));
    }
    if (filters?.stateCode) {
      query = query.where(eq(communityPosts.stateCode, filters.stateCode));
    }
    if (filters?.countyFips) {
      query = query.where(eq(communityPosts.countyFips, filters.countyFips));
    }
    if (filters?.category) {
      query = query.where(eq(communityPosts.category, filters.category));
    }
    if (filters?.authorId) {
      query = query.where(eq(communityPosts.authorId, filters.authorId));
    }

    return await query
      .where(eq(communityPosts.isPublished, true))
      .where(eq(communityPosts.isHidden, false))
      .orderBy(desc(communityPosts.createdAt))
      .limit(filters?.limit || 20)
      .offset(filters?.offset || 0);
  }

  async getCommunityPost(id: string): Promise<CommunityPost | undefined> {
    const [post] = await db
      .select()
      .from(communityPosts)
      .where(eq(communityPosts.id, id));
    return post;
  }

  async togglePostLike(userId: string, postId: string): Promise<{ liked: boolean; likeCount: number }> {
    // Check if like exists
    const [existingLike] = await db
      .select()
      .from(postLikes)
      .where(eq(postLikes.userId, userId))
      .where(eq(postLikes.postId, postId));

    if (existingLike) {
      // Remove like
      await db
        .delete(postLikes)
        .where(eq(postLikes.id, existingLike.id));
      
      await db
        .update(communityPosts)
        .set({ 
          likeCount: sql`${communityPosts.likeCount} - 1`,
          updatedAt: new Date()
        })
        .where(eq(communityPosts.id, postId));
      
      const [post] = await db
        .select({ likeCount: communityPosts.likeCount })
        .from(communityPosts)
        .where(eq(communityPosts.id, postId));
      
      return { liked: false, likeCount: post.likeCount };
    } else {
      // Add like
      await db.insert(postLikes).values({ userId, postId });
      
      await db
        .update(communityPosts)
        .set({ 
          likeCount: sql`${communityPosts.likeCount} + 1`,
          updatedAt: new Date()
        })
        .where(eq(communityPosts.id, postId));
      
      const [post] = await db
        .select({ likeCount: communityPosts.likeCount })
        .from(communityPosts)
        .where(eq(communityPosts.id, postId));
      
      return { liked: true, likeCount: post.likeCount };
    }
  }

  async createPostComment(comment: InsertPostComment): Promise<PostComment> {
    const [newComment] = await db
      .insert(postComments)
      .values(comment)
      .returning();
    
    // Update comment count on the post
    await db
      .update(communityPosts)
      .set({ 
        commentCount: sql`${communityPosts.commentCount} + 1`,
        updatedAt: new Date()
      })
      .where(eq(communityPosts.id, comment.postId));
    
    return newComment;
  }

  async getPostComments(postId: string): Promise<PostComment[]> {
    return await db
      .select()
      .from(postComments)
      .where(eq(postComments.postId, postId))
      .where(eq(postComments.isHidden, false))
      .orderBy(asc(postComments.createdAt));
  }

  async getCommunityGroups(filters?: {
    scope?: string;
    stateCode?: string;
    countyFips?: string;
    limit?: number;
    offset?: number;
  }): Promise<CommunityGroup[]> {
    let query = db.select().from(communityGroups);
    
    if (filters?.scope) {
      query = query.where(eq(communityGroups.scope, filters.scope));
    }
    if (filters?.stateCode) {
      query = query.where(eq(communityGroups.stateCode, filters.stateCode));
    }
    if (filters?.countyFips) {
      query = query.where(eq(communityGroups.countyFips, filters.countyFips));
    }

    return await query
      .where(eq(communityGroups.isActive, true))
      .orderBy(desc(communityGroups.memberCount), desc(communityGroups.createdAt))
      .limit(filters?.limit || 20)
      .offset(filters?.offset || 0);
  }

  async getRegions(filters?: {
    stateCode?: string;
    isOfficial?: boolean;
    limit?: number;
    offset?: number;
  }): Promise<Region[]> {
    let query = db.select().from(regions);
    
    if (filters?.stateCode) {
      query = query.where(sql`${filters.stateCode} = ANY(${regions.statesCovered})`);
    }
    if (filters?.isOfficial !== undefined) {
      query = query.where(eq(regions.isOfficial, filters.isOfficial));
    }

    return await query
      .orderBy(desc(regions.isOfficial), asc(regions.name))
      .limit(filters?.limit || 50)
      .offset(filters?.offset || 0);
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
    const [category] = await db
      .insert(handmadeCategories)
      .values(categoryData)
      .returning();
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
    let query = db.select().from(handmadeProducts);
    
    const conditions = [eq(handmadeProducts.status, 'active')];
    
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
    const [product] = await db
      .select()
      .from(handmadeProducts)
      .where(eq(handmadeProducts.id, id));
    return product;
  }

  async createHandmadeProduct(productData: InsertHandmadeProduct): Promise<HandmadeProduct> {
    const [product] = await db
      .insert(handmadeProducts)
      .values(productData)
      .returning();
    return product;
  }

  async updateHandmadeProduct(id: string, updates: Partial<HandmadeProduct>): Promise<HandmadeProduct> {
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
  async toggleProductFavorite(userId: string, productId: string): Promise<{ action: 'added' | 'removed' }> {
    const existing = await db
      .select()
      .from(productFavorites)
      .where(
        and(
          eq(productFavorites.userId, userId),
          eq(productFavorites.productId, productId)
        )
      );

    if (existing.length > 0) {
      await db
        .delete(productFavorites)
        .where(
          and(
            eq(productFavorites.userId, userId),
            eq(productFavorites.productId, productId)
          )
        );
      
      // Decrement favorite count
      await db
        .update(handmadeProducts)
        .set({ favoriteCount: sql`${handmadeProducts.favoriteCount} - 1` })
        .where(eq(handmadeProducts.id, productId));
      
      return { action: 'removed' };
    } else {
      await db
        .insert(productFavorites)
        .values({ userId, productId });
      
      // Increment favorite count
      await db
        .update(handmadeProducts)
        .set({ favoriteCount: sql`${handmadeProducts.favoriteCount} + 1` })
        .where(eq(handmadeProducts.id, productId));
      
      return { action: 'added' };
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
    const [order] = await db
      .insert(productOrders)
      .values(orderData)
      .returning();
    return order;
  }

  async getProductOrder(id: string): Promise<ProductOrder | undefined> {
    const [order] = await db
      .select()
      .from(productOrders)
      .where(eq(productOrders.id, id));
    return order;
  }

  async getUserOrders(userId: string, type: 'buyer' | 'seller'): Promise<ProductOrder[]> {
    const field = type === 'buyer' ? productOrders.buyerId : productOrders.sellerId;
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
    const [review] = await db
      .insert(productReviews)
      .values(reviewData)
      .returning();
    
    // Update product and seller ratings
    await this.updateProductRatings(reviewData.productId);
    await this.updateSellerRatings(reviewData.sellerId);
    
    return review;
  }

  async getProductReviews(productId: string): Promise<ProductReview[]> {
    return await db
      .select()
      .from(productReviews)
      .where(
        and(
          eq(productReviews.productId, productId),
          eq(productReviews.isPublic, true)
        )
      )
      .orderBy(desc(productReviews.createdAt));
  }

  async getProductRatingSummary(productId: string): Promise<{ average: number; count: number }> {
    const [result] = await db
      .select({
        count: sql<number>`count(*)`,
        average: sql<number>`avg(${productReviews.rating})`,
      })
      .from(productReviews)
      .where(
        and(
          eq(productReviews.productId, productId),
          eq(productReviews.isPublic, true)
        )
      );
    
    return {
      count: result?.count || 0,
      average: result?.average || 0,
    };
  }

  private async updateProductRatings(productId: string): Promise<void> {
    const summary = await this.getProductRatingSummary(productId);
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
    const [profile] = await db
      .insert(sellerProfiles)
      .values(profileData)
      .returning();
    return profile;
  }

  async updateSellerProfile(userId: string, updates: Partial<SellerProfile>): Promise<SellerProfile> {
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
      .where(
        and(
          eq(productReviews.sellerId, userId),
          eq(productReviews.isPublic, true)
        )
      );
    
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

  // ===== COMMUNITY MODERATION IMPLEMENTATIONS =====

  // Reports
  async createModerationReport(reportData: InsertModerationReport): Promise<ModerationReport> {
    const [report] = await db
      .insert(moderationReports)
      .values(reportData)
      .returning();
    return report;
  }

  async getModerationReport(id: string): Promise<ModerationReport | undefined> {
    const [report] = await db
      .select()
      .from(moderationReports)
      .where(eq(moderationReports.id, id));
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
    let query = db.select().from(moderationReports);
    
    if (filters?.status) {
      query = query.where(eq(moderationReports.status, filters.status));
    }
    if (filters?.contentType) {
      query = query.where(eq(moderationReports.contentType, filters.contentType));
    }
    if (filters?.county) {
      query = query.where(eq(moderationReports.contentCounty, filters.county));
    }
    if (filters?.state) {
      query = query.where(eq(moderationReports.contentState, filters.state));
    }
    if (filters?.reporterId) {
      query = query.where(eq(moderationReports.reporterId, filters.reporterId));
    }
    
    query = query.orderBy(desc(moderationReports.createdAt));
    
    if (filters?.limit) {
      query = query.limit(filters.limit);
    }
    if (filters?.offset) {
      query = query.offset(filters.offset);
    }
    
    return await query;
  }

  async updateModerationReport(id: string, updates: Partial<ModerationReport>): Promise<ModerationReport> {
    const [report] = await db
      .update(moderationReports)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(moderationReports.id, id))
      .returning();
    return report;
  }

  // Votes
  async createModerationVote(voteData: InsertModerationVote): Promise<ModerationVote> {
    // Check if user already voted on this report
    const existingVote = await this.getModerationVote(voteData.reportId, voteData.voterId);
    if (existingVote) {
      throw new Error('User has already voted on this report');
    }

    // Calculate vote weight based on location
    const report = await this.getModerationReport(voteData.reportId);
    if (!report) {
      throw new Error('Report not found');
    }

    const voteWeight = await this.calculateLocalVoterWeight(
      voteData.voterCounty || '',
      voteData.voterState || '',
      report.contentCounty || '',
      report.contentState || ''
    );

    const isLocalVoter = voteData.voterCounty === report.contentCounty && 
                        voteData.voterState === report.contentState;

    const [vote] = await db
      .insert(moderationVotes)
      .values({
        ...voteData,
        voteWeight: voteWeight.toString(),
        isLocalVoter,
      })
      .returning();

    // Update vote counts
    await this.updateVoteCounts(voteData.reportId);
    
    return vote;
  }

  async getModerationVote(reportId: string, voterId: string): Promise<ModerationVote | undefined> {
    const [vote] = await db
      .select()
      .from(moderationVotes)
      .where(
        and(
          eq(moderationVotes.reportId, reportId),
          eq(moderationVotes.voterId, voterId)
        )
      );
    return vote;
  }

  async getReportVotes(reportId: string): Promise<ModerationVote[]> {
    return await db
      .select()
      .from(moderationVotes)
      .where(eq(moderationVotes.reportId, reportId))
      .orderBy(desc(moderationVotes.createdAt));
  }

  async updateVoteCounts(reportId: string): Promise<void> {
    const votes = await this.getReportVotes(reportId);
    
    let totalVotes = 0;
    let removeVotes = 0;
    let keepVotes = 0;
    let reviewVotes = 0;

    votes.forEach(vote => {
      const weight = parseFloat(vote.voteWeight || '1.0');
      totalVotes += weight;
      
      switch (vote.vote) {
        case 'remove':
          removeVotes += weight;
          break;
        case 'keep':
          keepVotes += weight;
          break;
        case 'needs_review':
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

  async createUserModerationReputation(reputationData: InsertUserModerationReputation): Promise<UserModerationReputation> {
    const [reputation] = await db
      .insert(userModerationReputation)
      .values(reputationData)
      .returning();
    return reputation;
  }

  async updateUserModerationReputation(userId: string, updates: Partial<UserModerationReputation>): Promise<UserModerationReputation> {
    const [reputation] = await db
      .update(userModerationReputation)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(userModerationReputation.userId, userId))
      .returning();
    return reputation;
  }

  // Actions
  async createModerationAction(actionData: InsertModerationAction): Promise<ModerationAction> {
    const [action] = await db
      .insert(moderationActions)
      .values(actionData)
      .returning();
    return action;
  }

  async getModerationActions(contentType: string, contentId: string): Promise<ModerationAction[]> {
    return await db
      .select()
      .from(moderationActions)
      .where(
        and(
          eq(moderationActions.contentType, contentType),
          eq(moderationActions.contentId, contentId)
        )
      )
      .orderBy(desc(moderationActions.createdAt));
  }

  // Appeals
  async createModerationAppeal(appealData: InsertModerationAppeal): Promise<ModerationAppeal> {
    const [appeal] = await db
      .insert(moderationAppeals)
      .values(appealData)
      .returning();
    return appeal;
  }

  async getModerationAppeal(id: string): Promise<ModerationAppeal | undefined> {
    const [appeal] = await db
      .select()
      .from(moderationAppeals)
      .where(eq(moderationAppeals.id, id));
    return appeal;
  }

  async getAppealsByUser(userId: string): Promise<ModerationAppeal[]> {
    return await db
      .select()
      .from(moderationAppeals)
      .where(eq(moderationAppeals.appellantId, userId))
      .orderBy(desc(moderationAppeals.createdAt));
  }

  async updateModerationAppeal(id: string, updates: Partial<ModerationAppeal>): Promise<ModerationAppeal> {
    const [appeal] = await db
      .update(moderationAppeals)
      .set(updates)
      .where(eq(moderationAppeals.id, id))
      .returning();
    return appeal;
  }

  // Settings
  async getModerationSettings(county?: string, state?: string): Promise<ModerationSettings | undefined> {
    let query = db.select().from(moderationSettings);
    
    if (county && state) {
      query = query.where(
        and(
          eq(moderationSettings.county, county),
          eq(moderationSettings.state, state),
          eq(moderationSettings.isActive, true)
        )
      );
    } else if (state) {
      query = query.where(
        and(
          eq(moderationSettings.state, state),
          eq(moderationSettings.isStatewide, true),
          eq(moderationSettings.isActive, true)
        )
      );
    } else {
      // Return default settings
      query = query.where(
        and(
          isNull(moderationSettings.county),
          isNull(moderationSettings.state),
          eq(moderationSettings.isActive, true)
        )
      );
    }
    
    const [settings] = await query;
    return settings;
  }

  async createModerationSettings(settingsData: InsertModerationSettings): Promise<ModerationSettings> {
    const [settings] = await db
      .insert(moderationSettings)
      .values(settingsData)
      .returning();
    return settings;
  }

  async updateModerationSettings(id: string, updates: Partial<ModerationSettings>): Promise<ModerationSettings> {
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
    const accountAgeDays = Math.floor(
      (Date.now() - new Date(user.createdAt).getTime()) / (1000 * 60 * 60 * 24)
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
    if (!report || report.status !== 'pending') {
      return;
    }

    // Check if minimum votes reached
    if (report.totalVotes < report.votesRequired) {
      return;
    }

    const removalThreshold = parseFloat(report.removalThreshold || '0.60');
    const removalPercentage = report.removeVotes / report.totalVotes;

    let finalAction: string;
    let actionTakenBy = 'community_vote';

    if (removalPercentage >= removalThreshold) {
      finalAction = 'content_removed';
      
      // Create moderation action
      await this.createModerationAction({
        reportId: report.id,
        contentType: report.contentType,
        contentId: report.contentId,
        contentOwnerId: report.contentOwnerId,
        action: 'removed',
        actionBy: 'community_vote',
        reason: `Content removed by community vote (${Math.round(removalPercentage * 100)}% removal votes)`,
        isReversible: true,
        canAppeal: true,
        appealDeadline: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
      });
    } else if (report.reviewVotes / report.totalVotes >= 0.3) {
      // If 30% or more votes are "needs review", escalate to moderators
      finalAction = 'content_flagged';
      await this.updateModerationReport(reportId, {
        status: 'escalated',
      });
      return;
    } else {
      finalAction = 'no_action';
    }

    // Update report with final result
    await this.updateModerationReport(reportId, {
      status: 'resolved',
      finalAction,
      actionTakenBy,
      actionReason: `Community vote completed: ${report.removeVotes}/${report.totalVotes} removal votes (${Math.round(removalPercentage * 100)}%)`,
      resolvedAt: new Date(),
    });
  }

  // Leaderboard operations
  async updateContractorLeaderboardStats(contractorId: string, rating: number): Promise<void> {
    const now = new Date();
    const month = now.getMonth() + 1;
    const year = now.getFullYear();

    try {
      // Get existing stats for this month/year
      const [existingStats] = await db
        .select()
        .from(contractorLeaderboardStats)
        .where(
          and(
            eq(contractorLeaderboardStats.contractorId, contractorId),
            eq(contractorLeaderboardStats.month, month),
            eq(contractorLeaderboardStats.year, year)
          )
        );

      if (existingStats) {
        // Update existing record
        const newMonthlyCount = existingStats.monthlyRecommendations + 1;
        const newLifetimeCount = existingStats.lifetimeRecommendations + 1;
        
        // Calculate new ratings
        const currentMonthlyTotal = (existingStats.monthlyRating || 0) * existingStats.monthlyRecommendations;
        const currentLifetimeTotal = (existingStats.lifetimeRating || 0) * existingStats.lifetimeRecommendations;
        
        const newMonthlyRating = (currentMonthlyTotal + rating) / newMonthlyCount;
        const newLifetimeRating = (currentLifetimeTotal + rating) / newLifetimeCount;

        await db
          .update(contractorLeaderboardStats)
          .set({
            monthlyRecommendations: newMonthlyCount,
            lifetimeRecommendations: newLifetimeCount,
            monthlyRating: newMonthlyRating.toString(),
            lifetimeRating: newLifetimeRating.toString(),
            lastUpdated: now,
          })
          .where(eq(contractorLeaderboardStats.id, existingStats.id));
      } else {
        // Create new record
        await db.insert(contractorLeaderboardStats).values({
          contractorId,
          month,
          year,
          monthlyRecommendations: 1,
          lifetimeRecommendations: 1,
          monthlyRating: rating.toString(),
          lifetimeRating: rating.toString(),
          lastUpdated: now,
        });
      }

      // Also update any previous months' lifetime totals
      await db
        .update(contractorLeaderboardStats)
        .set({
          lifetimeRecommendations: sql`${contractorLeaderboardStats.lifetimeRecommendations} + 1`,
          lifetimeRating: sql`(${contractorLeaderboardStats.lifetimeRating} * ${contractorLeaderboardStats.lifetimeRecommendations} + ${rating}) / (${contractorLeaderboardStats.lifetimeRecommendations} + 1)`,
          lastUpdated: now,
        })
        .where(
          and(
            eq(contractorLeaderboardStats.contractorId, contractorId),
            or(
              lt(contractorLeaderboardStats.year, year),
              and(
                eq(contractorLeaderboardStats.year, year),
                lt(contractorLeaderboardStats.month, month)
              )
            )
          )
        );
    } catch (error) {
      console.error("Error updating leaderboard stats:", error);
    }
  }

  async getMonthlyLeaderboard(month: number, year: number, limit: number, state?: string, county?: string): Promise<any[]> {
    try {
      // Use direct SQL with pool.query to avoid Drizzle issues
      const { Pool } = await import('@neondatabase/serverless');
      const pool = new Pool({ connectionString: process.env.DATABASE_URL });
      
      let query = `
        SELECT 
          cls.contractor_id,
          c.company_name,
          c.slug,
          cls.monthly_recommendations,
          cls.monthly_rating,
          cls.lifetime_recommendations,
          u.city,
          u.state
        FROM contractor_leaderboard_stats cls
        INNER JOIN contractors c ON cls.contractor_id = c.id
        LEFT JOIN users u ON c.user_id = u.id
        WHERE cls.month = $1 
          AND cls.year = $2 
          AND c.is_active = true
      `;

      const params = [month, year];
      if (state && state !== "all") {
        query += ` AND u.state = $${params.length + 1}`;
        params.push(state);
      }
      if (county && county !== "all") {
        query += ` AND u.city = $${params.length + 1}`;
        params.push(county);
      }

      query += `
        ORDER BY cls.monthly_recommendations DESC, cls.monthly_rating DESC
        LIMIT $${params.length + 1}
      `;
      params.push(limit);

      const result = await pool.query(query, params);
      const rows = result.rows || [];
      
      return rows.map((row: any, index: number) => ({
        rank: index + 1,
        contractorId: row.contractor_id,
        companyName: row.company_name,
        slug: row.slug,
        monthlyRecommendations: parseInt(row.monthly_recommendations) || 0,
        monthlyRating: parseFloat(row.monthly_rating) || 0,
        lifetimeRecommendations: parseInt(row.lifetime_recommendations) || 0,
        city: row.city,
        state: row.state,
        county: row.city,
        location: row.city && row.state ? `${row.city}, ${row.state}` : row.state || null,
      }));
    } catch (error) {
      console.error("Error in getMonthlyLeaderboard:", error);
      return [];
    }
  }

  async getLifetimeLeaderboard(limit: number, state?: string, county?: string): Promise<any[]> {
    try {
      // Use direct SQL with pool.query to avoid Drizzle issues
      const { Pool } = await import('@neondatabase/serverless');
      const pool = new Pool({ connectionString: process.env.DATABASE_URL });
      
      let query = `
        SELECT 
          cls.contractor_id,
          c.company_name,
          c.slug,
          MAX(cls.lifetime_recommendations) as lifetime_recommendations,
          AVG(cls.lifetime_rating) as lifetime_rating,
          u.city,
          u.state
        FROM contractor_leaderboard_stats cls
        INNER JOIN contractors c ON cls.contractor_id = c.id
        LEFT JOIN users u ON c.user_id = u.id
        WHERE c.is_active = true
      `;

      const params = [];
      if (state && state !== "all") {
        query += ` AND u.state = $${params.length + 1}`;
        params.push(state);
      }
      if (county && county !== "all") {
        query += ` AND u.city = $${params.length + 1}`;
        params.push(county);
      }

      query += `
        GROUP BY cls.contractor_id, c.company_name, c.slug, u.city, u.state
        ORDER BY MAX(cls.lifetime_recommendations) DESC, AVG(cls.lifetime_rating) DESC
        LIMIT $${params.length + 1}
      `;
      params.push(limit);

      const result = await pool.query(query, params);
      const rows = result.rows || [];
      
      return rows.map((row: any, index: number) => ({
        rank: index + 1,
        contractorId: row.contractor_id,
        companyName: row.company_name,
        slug: row.slug,
        lifetimeRecommendations: parseInt(row.lifetime_recommendations) || 0,
        lifetimeRating: parseFloat(row.lifetime_rating) || 0,
        city: row.city,
        state: row.state,
        county: row.city,
        location: row.city && row.state ? `${row.city}, ${row.state}` : row.state || null,
      }));
    } catch (error) {
      console.error("Error in getLifetimeLeaderboard:", error);
      return [];
    }
  }

  async getContractorLeaderboardPosition(contractorId: string): Promise<any> {
    const now = new Date();
    const month = now.getMonth() + 1;
    const year = now.getFullYear();

    // Get current month stats
    const [monthlyStats] = await db
      .select()
      .from(contractorLeaderboardStats)
      .where(
        and(
          eq(contractorLeaderboardStats.contractorId, contractorId),
          eq(contractorLeaderboardStats.month, month),
          eq(contractorLeaderboardStats.year, year)
        )
      );

    // Get lifetime stats (latest record)
    const [lifetimeStats] = await db
      .select()
      .from(contractorLeaderboardStats)
      .where(eq(contractorLeaderboardStats.contractorId, contractorId))
      .orderBy(desc(contractorLeaderboardStats.lastUpdated))
      .limit(1);

    // Calculate monthly rank
    let monthlyRank = null;
    if (monthlyStats) {
      const [rankResult] = await db
        .select({ rank: sql<number>`COUNT(*) + 1` })
        .from(contractorLeaderboardStats)
        .where(
          and(
            eq(contractorLeaderboardStats.month, month),
            eq(contractorLeaderboardStats.year, year),
            gt(contractorLeaderboardStats.monthlyRecommendations, monthlyStats.monthlyRecommendations)
          )
        );
      monthlyRank = rankResult?.rank || 1;
    }

    // Calculate lifetime rank
    let lifetimeRank = null;
    if (lifetimeStats) {
      const [rankResult] = await db
        .select({ rank: sql<number>`COUNT(DISTINCT ${contractorLeaderboardStats.contractorId}) + 1` })
        .from(contractorLeaderboardStats)
        .where(
          gt(sql`MAX(${contractorLeaderboardStats.lifetimeRecommendations})`, lifetimeStats.lifetimeRecommendations)
        )
        .groupBy(contractorLeaderboardStats.contractorId);
      lifetimeRank = rankResult?.rank || 1;
    }

    return {
      contractorId,
      monthly: monthlyStats ? {
        rank: monthlyRank,
        recommendations: monthlyStats.monthlyRecommendations,
        rating: monthlyStats.monthlyRating,
        month,
        year,
      } : null,
      lifetime: lifetimeStats ? {
        rank: lifetimeRank,
        recommendations: lifetimeStats.lifetimeRecommendations,
        rating: lifetimeStats.lifetimeRating,
      } : null,
    };
  }

  // Geographic data methods for leaderboard filtering
  async getAllStates(): Promise<{ code: string; name: string }[]> {
    const result = await db
      .select({
        code: counties.stateCode,
        name: counties.stateName,
      })
      .from(counties)
      .groupBy(counties.stateCode, counties.stateName)
      .orderBy(asc(counties.stateName));

    return result;
  }

  async getCountiesByState(stateCode: string): Promise<{ id: string; name: string; stateCode: string }[]> {
    if (!stateCode || stateCode === "all") {
      return [];
    }

    const result = await db
      .select({
        id: counties.id,
        name: counties.name,
        stateCode: counties.stateCode,
      })
      .from(counties)
      .where(eq(counties.stateCode, stateCode))
      .orderBy(asc(counties.name));

    return result;
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
    const [invitation] = await db.select().from(invitations).where(eq(invitations.code, code));
    return invitation;
  }

  async getUserInvitations(userId: string): Promise<Invitation[]> {
    return await db.select().from(invitations).where(eq(invitations.invitedBy, userId)).orderBy(desc(invitations.createdAt));
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
        status: 'accepted', 
        acceptedBy: userId, 
        acceptedAt: new Date(),
        updatedAt: new Date() 
      })
      .where(eq(invitations.code, code))
      .returning();
    return invitation;
  }

  async expireOldInvitations(): Promise<void> {
    const expiryDate = new Date();
    expiryDate.setDate(expiryDate.getDate() - 30); // Expire after 30 days

    await db
      .update(invitations)
      .set({ status: 'expired', updatedAt: new Date() })
      .where(
        and(
          eq(invitations.status, 'pending'),
          lt(invitations.createdAt, expiryDate)
        )
      );
  }

  async generateInvitationCode(): Promise<string> {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let code: string;
    let exists = true;

    while (exists) {
      code = '';
      for (let i = 0; i < 8; i++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length));
      }
      
      const existingInvitation = await this.getInvitationByCode(code);
      exists = !!existingInvitation;
    }

    return code!;
  }

  async generateUserReferralCode(userId: string): Promise<string> {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let code: string;
    let exists = true;

    while (exists) {
      code = '';
      for (let i = 0; i < 6; i++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length));
      }
      
      const [existingUser] = await db.select().from(users).where(eq(users.referralCode, code));
      exists = !!existingUser;
    }

    // Update user with referral code
    await this.updateUser(userId, { referralCode: code! });
    return code!;
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

  async updateReferralStats(userId: string, updates: Partial<ReferralStats>): Promise<ReferralStats> {
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
        totalInvitationsSent: existingStats.totalInvitationsSent + 1
      });
    } else {
      await this.createReferralStats({
        userId,
        totalInvitationsSent: 1,
        totalInvitationsAccepted: 0,
        contractorReferrals: 0,
        homeownerReferrals: 0
      });
    }
  }

  async incrementInvitationsAccepted(userId: string, targetRole: 'homeowner' | 'contractor_user'): Promise<void> {
    const existingStats = await this.getReferralStats(userId);
    
    if (existingStats) {
      const updates: Partial<ReferralStats> = {
        totalInvitationsAccepted: existingStats.totalInvitationsAccepted + 1
      };
      
      if (targetRole === 'contractor_user') {
        updates.contractorReferrals = existingStats.contractorReferrals + 1;
      } else {
        updates.homeownerReferrals = existingStats.homeownerReferrals + 1;
      }
      
      await this.updateReferralStats(userId, updates);
    } else {
      await this.createReferralStats({
        userId,
        totalInvitationsSent: 0,
        totalInvitationsAccepted: 1,
        contractorReferrals: targetRole === 'contractor_user' ? 1 : 0,
        homeownerReferrals: targetRole === 'homeowner' ? 1 : 0
      });
    }
  }

  async getTopReferrers(limit: number): Promise<(ReferralStats & { user: User })[]> {
    const result = await db
      .select({
        userId: referralStats.userId,
        totalInvitationsSent: referralStats.totalInvitationsSent,
        totalInvitationsAccepted: referralStats.totalInvitationsAccepted,
        contractorReferrals: referralStats.contractorReferrals,
        homeownerReferrals: referralStats.homeownerReferrals,
        createdAt: referralStats.createdAt,
        updatedAt: referralStats.updatedAt,
        user: {
          id: users.id,
          username: users.username,
          email: users.email,
          firstName: users.firstName,
          lastName: users.lastName,
          profileImageUrl: users.profileImageUrl,
          role: users.role,
          createdAt: users.createdAt,
          updatedAt: users.updatedAt
        }
      })
      .from(referralStats)
      .innerJoin(users, eq(referralStats.userId, users.id))
      .orderBy(desc(referralStats.totalInvitationsAccepted))
      .limit(limit);

    return result.map(row => ({
      userId: row.userId,
      totalInvitationsSent: row.totalInvitationsSent,
      totalInvitationsAccepted: row.totalInvitationsAccepted,
      contractorReferrals: row.contractorReferrals,
      homeownerReferrals: row.homeownerReferrals,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      user: row.user as User
    }));
  }

  // Professional Profile Methods

  async createRealtorProfile(profile: InsertRealtorProfile): Promise<RealtorProfile> {
    const [newProfile] = await db
      .insert(realtorProfiles)
      .values(profile)
      .returning();
    return newProfile;
  }

  async getRealtorProfile(userId: string): Promise<RealtorProfile | undefined> {
    const [profile] = await db
      .select()
      .from(realtorProfiles)
      .where(eq(realtorProfiles.userId, userId));
    return profile;
  }

  async createCarSalesmanProfile(profile: InsertCarSalesmanProfile): Promise<CarSalesmanProfile> {
    const [newProfile] = await db
      .insert(carSalesmanProfiles)
      .values(profile)
      .returning();
    return newProfile;
  }

  async getCarSalesmanProfile(userId: string): Promise<CarSalesmanProfile | undefined> {
    const [profile] = await db
      .select()
      .from(carSalesmanProfiles)
      .where(eq(carSalesmanProfiles.userId, userId));
    return profile;
  }

  async updateUserRole(userId: string, role: 'realtor' | 'car_salesman'): Promise<void> {
    await db
      .update(users)
      .set({ role, updatedAt: new Date() })
      .where(eq(users.id, userId));
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
          createdAt: users.createdAt
        }
      })
      .from(realtorProfiles)
      .innerJoin(users, eq(realtorProfiles.userId, users.id))
      .where(eq(realtorProfiles.verificationStatus, 'pending'));

    return result.map(row => ({
      ...row,
      user: row.user as User
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
          createdAt: users.createdAt
        }
      })
      .from(carSalesmanProfiles)
      .innerJoin(users, eq(carSalesmanProfiles.userId, users.id))
      .where(eq(carSalesmanProfiles.verificationStatus, 'pending'));

    return result.map(row => ({
      ...row,
      user: row.user as User
    }));
  }

  async updateRealtorVerificationStatus(
    profileId: string, 
    status: 'approved' | 'rejected',
    adminId: string,
    notes?: string
  ): Promise<RealtorProfile> {
    const [updatedProfile] = await db
      .update(realtorProfiles)
      .set({ 
        verificationStatus: status,
        updatedAt: new Date()
      })
      .where(eq(realtorProfiles.id, profileId))
      .returning();
    return updatedProfile;
  }

  async updateCarSalesmanVerificationStatus(
    profileId: string, 
    status: 'approved' | 'rejected',
    adminId: string,
    notes?: string
  ): Promise<CarSalesmanProfile> {
    const [updatedProfile] = await db
      .update(carSalesmanProfiles)
      .set({ 
        verificationStatus: status,
        updatedAt: new Date()
      })
      .where(eq(carSalesmanProfiles.id, profileId))
      .returning();
    return updatedProfile;
  }

  // Marketplace conversation operations
  async createMarketplaceConversation(data: InsertMarketplaceConversation): Promise<MarketplaceConversation> {
    const [conversation] = await db
      .insert(marketplaceConversations)
      .values(data)
      .returning();
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

  async getUserMarketplaceConversations(userId: string): Promise<any[]> {
    const conversationsData = await db
      .select({
        conversation: marketplaceConversations,
        listing: {
          id: marketplaceListings.id,
          title: marketplaceListings.title,
          price: marketplaceListings.price,
          images: marketplaceListings.images,
          status: marketplaceListings.status
        },
        buyer: {
          id: sql<string>`buyer.id`,
          firstName: sql<string>`buyer.first_name`,
          lastName: sql<string>`buyer.last_name`,
          profileImageUrl: sql<string>`buyer.profile_image_url`
        },
        seller: {
          id: sql<string>`seller.id`,
          firstName: sql<string>`seller.first_name`,
          lastName: sql<string>`seller.last_name`,
          profileImageUrl: sql<string>`seller.profile_image_url`
        }
      })
      .from(marketplaceConversations)
      .innerJoin(marketplaceListings, eq(marketplaceConversations.listingId, marketplaceListings.id))
      .innerJoin(users.as('buyer'), eq(marketplaceConversations.buyerId, sql`buyer.id`))
      .innerJoin(users.as('seller'), eq(marketplaceConversations.sellerId, sql`seller.id`))
      .where(
        or(
          eq(marketplaceConversations.buyerId, userId),
          eq(marketplaceConversations.sellerId, userId)
        )
      )
      .orderBy(desc(marketplaceConversations.lastMessageAt));

    // Get last message and unread count for each conversation
    const conversationsWithDetails = await Promise.all(
      conversationsData.map(async (conv) => {
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
          buyer: conv.buyer,
          seller: conv.seller,
          lastMessage,
          unreadCount: unreadCount?.count || 0
        };
      })
    );

    return conversationsWithDetails;
  }

  async createMarketplaceMessage(data: InsertMarketplaceMessage): Promise<MarketplaceMessage> {
    const [message] = await db
      .insert(marketplaceMessages)
      .values(data)
      .returning();

    // Update conversation's lastMessageAt
    await db
      .update(marketplaceConversations)
      .set({ 
        lastMessageAt: new Date(),
        updatedAt: new Date()
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
  async createMarketplaceTransaction(transaction: InsertMarketplaceTransaction): Promise<MarketplaceTransaction> {
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

  async getMarketplaceTransactionsByUser(userId: string, role: 'buyer' | 'seller'): Promise<MarketplaceTransaction[]> {
    const column = role === 'buyer' ? marketplaceTransactions.buyerId : marketplaceTransactions.sellerId;
    return await db
      .select()
      .from(marketplaceTransactions)
      .where(eq(column, userId))
      .orderBy(desc(marketplaceTransactions.createdAt));
  }

  async updateMarketplaceTransaction(id: string, updates: Partial<MarketplaceTransaction>): Promise<MarketplaceTransaction> {
    const [transaction] = await db
      .update(marketplaceTransactions)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(marketplaceTransactions.id, id))
      .returning();
    return transaction;
  }

  // Transaction dispute operations
  async createTransactionDispute(dispute: InsertTransactionDispute): Promise<TransactionDispute> {
    const [newDispute] = await db
      .insert(transactionDisputes)
      .values(dispute)
      .returning();
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
    return await db
      .select()
      .from(transactionDisputes)
      .orderBy(desc(transactionDisputes.createdAt));
  }

  async updateTransactionDispute(id: string, updates: Partial<TransactionDispute>): Promise<TransactionDispute> {
    const [dispute] = await db
      .update(transactionDisputes)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(transactionDisputes.id, id))
      .returning();
    return dispute;
  }

  // User review operations
  async createUserReview(review: InsertUserReview): Promise<UserReview> {
    const [newReview] = await db
      .insert(userReviews)
      .values(review)
      .returning();
    return newReview;
  }

  async getUserReviews(userId: string, role: 'reviewer' | 'reviewee'): Promise<UserReview[]> {
    const column = role === 'reviewer' ? userReviews.reviewerId : userReviews.revieweeId;
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
        average: sql<number>`avg(${userReviews.rating})::float`
      })
      .from(userReviews)
      .where(eq(userReviews.revieweeId, userId));
    
    return {
      count: result[0]?.count || 0,
      average: result[0]?.average || 0
    };
  }

  // Real-time notification operations
  async createNotification(notification: InsertRealTimeNotification): Promise<RealTimeNotification> {
    const [newNotification] = await db
      .insert(realTimeNotifications)
      .values(notification)
      .returning();
    return newNotification;
  }

  async getUserNotifications(userId: string, unreadOnly?: boolean): Promise<RealTimeNotification[]> {
    let query = db.select().from(realTimeNotifications).where(eq(realTimeNotifications.userId, userId));
    
    if (unreadOnly) {
      query = query.where(isNull(realTimeNotifications.readAt)) as any;
    }
    
    return await query.orderBy(desc(realTimeNotifications.createdAt));
  }

  async markNotificationAsRead(id: string): Promise<RealTimeNotification> {
    const [notification] = await db
      .update(realTimeNotifications)
      .set({ readAt: new Date() })
      .where(eq(realTimeNotifications.id, id))
      .returning();
    return notification;
  }

  async markAllNotificationsAsRead(userId: string): Promise<void> {
    await db
      .update(realTimeNotifications)
      .set({ readAt: new Date() })
      .where(
        and(
          eq(realTimeNotifications.userId, userId),
          isNull(realTimeNotifications.readAt)
        )
      );
  }

  // Search and discovery operations
  async createSavedSearch(search: InsertSavedSearch): Promise<SavedSearch> {
    const [newSearch] = await db
      .insert(savedSearches)
      .values(search)
      .returning();
    return newSearch;
  }

  async getUserSavedSearches(userId: string): Promise<SavedSearch[]> {
    return await db
      .select()
      .from(savedSearches)
      .where(eq(savedSearches.userId, userId))
      .orderBy(desc(savedSearches.createdAt));
  }

  async deleteSavedSearch(id: string): Promise<void> {
    await db.delete(savedSearches).where(eq(savedSearches.id, id));
  }

  async logSearchAnalytics(analytics: InsertSearchAnalytics): Promise<SearchAnalytics> {
    const [newAnalytics] = await db
      .insert(searchAnalytics)
      .values(analytics)
      .returning();
    return newAnalytics;
  }

  // Platform analytics operations
  async updatePlatformAnalytics(date: Date, updates: Partial<InsertPlatformAnalytics>): Promise<PlatformAnalytics> {
    const [analytics] = await db
      .insert(platformAnalytics)
      .values({ 
        date: date.toISOString().split('T')[0], // Convert to YYYY-MM-DD
        ...updates 
      })
      .onConflictDoUpdate({
        target: platformAnalytics.date,
        set: updates
      })
      .returning();
    return analytics;
  }

  async getPlatformAnalytics(fromDate: Date, toDate: Date): Promise<PlatformAnalytics[]> {
    return await db
      .select()
      .from(platformAnalytics)
      .where(
        and(
          gte(platformAnalytics.date, fromDate.toISOString().split('T')[0]),
          lte(platformAnalytics.date, toDate.toISOString().split('T')[0])
        )
      )
      .orderBy(asc(platformAnalytics.date));
  }

  // Enhanced marketplace conversation operations
  async getMarketplaceConversationByListing(listingId: string, buyerId: string): Promise<MarketplaceConversation | undefined> {
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
}

export const storage = new DatabaseStorage();
