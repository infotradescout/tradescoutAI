import {
  users,
  contractors,
  recommendations,
  leads,
  counties,
  states,
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
  donationMatching,
  // Affiliate system
  affiliatePrograms,
  affiliateReferrals,
  affiliateCommissions,
  affiliatePayouts,
  type AffiliateProgram,
  type InsertAffiliateProgram,
  type AffiliateReferral,
  type InsertAffiliateReferral,
  type AffiliateCommission,
  type InsertAffiliateCommission,
  type AffiliatePayout,
  type InsertAffiliatePayout,
  // Trusted devices
  trustedDevices,
  type TrustedDevice,
  type InsertTrustedDevice,
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
  type any,
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
  type DonationMatching,
  type InsertDonationMatching,
  // CRM types
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
  // Smart Recommendation Generator types
  type RecommendationInsight,
  type InsertRecommendationInsight,
  type RecommendationGoal,
  type InsertRecommendationGoal,
  type RecommendationCampaign,
  type InsertRecommendationCampaign,
  // CRM tables
  crmContacts,
  crmDeals,
  crmActivities,
  // Smart Recommendation Generator
  recommendationInsights,
  recommendationGoals,
  recommendationCampaigns,
  crmEmailTemplates,
  crmPipelines,
  // Phase 1: Daily Deals System
  dailyDeals,
  type DailyDeal,
  type InsertDailyDeal,
  userAffiliates,
  type UserAffiliate,
  type InsertUserAffiliate,
  affiliateTracking,
  type AffiliateTracking,
  type InsertAffiliateTracking,
  dealEngagements,
  type DealEngagement,
  type InsertDealEngagement,
} from "@shared/schema";
import { db } from "./db";
import { eq, and, desc, asc, sql, inArray, like, gt, or, lt, isNull, isNotNull, ne, gte, lte } from "drizzle-orm";
import bcrypt from "bcrypt";

export interface IStorage {
  // User operations
  getUser(id: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  getUserByRole(role: string): Promise<User | undefined>;
  getUserByFacebookId(facebookId: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  createMasterAdmin(email: string, password: string, firstName: string, lastName: string): Promise<User>;
  updateUser(id: string, updates: Partial<User>): Promise<User>;
  upsertUser(user: UpsertUser): Promise<User>;
  deleteUser(userId: string): Promise<void>;
  getAllUsers(): Promise<User[]>;
  
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
  getMonthlyLeaderboard(month: number, year: number, limit: number, state?: string, county?: string): Promise<any>;
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
  getErrorReports(): Promise<any>;
  
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
  getUserMarketplaceConversations(userId: string): Promise<any>;
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
  
  // Smart Recommendation Generator operations
  // Insights
  createRecommendationInsight(insight: InsertRecommendationInsight): Promise<RecommendationInsight>;
  getRecommendationInsight(contractorId: string): Promise<RecommendationInsight | undefined>;
  updateRecommendationInsight(contractorId: string, updates: Partial<RecommendationInsight>): Promise<RecommendationInsight>;
  analyzeContractorPerformance(contractorId: string): Promise<RecommendationInsight>;
  
  // Goals
  createRecommendationGoal(goal: InsertRecommendationGoal): Promise<RecommendationGoal>;
  getContractorGoals(contractorId: string): Promise<RecommendationGoal[]>;
  updateRecommendationGoal(goalId: string, updates: Partial<RecommendationGoal>): Promise<RecommendationGoal>;
  updateGoalProgress(contractorId: string): Promise<void>;
  
  // Campaigns
  createRecommendationCampaign(campaign: InsertRecommendationCampaign): Promise<RecommendationCampaign>;
  getContractorCampaigns(contractorId: string): Promise<RecommendationCampaign[]>;
  updateRecommendationCampaign(campaignId: string, updates: Partial<RecommendationCampaign>): Promise<RecommendationCampaign>;
  deleteRecommendationCampaign(campaignId: string): Promise<void>;
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
  
  // Payment system operations
  createPaymentConfiguration(config: InsertPaymentConfiguration): Promise<PaymentConfiguration>;
  getPaymentConfiguration(configType: string): Promise<PaymentConfiguration | undefined>;
  updatePaymentConfiguration(id: string, updates: Partial<InsertPaymentConfiguration>): Promise<PaymentConfiguration>;
  
  // Contractor payment operations  
  createContractorPayment(payment: InsertContractorPayment): Promise<ContractorPayment>;
  getContractorPayment(id: string): Promise<ContractorPayment | undefined>;
  getContractorPaymentsByHomeowner(homeownerId: string): Promise<ContractorPayment[]>;
  getContractorPaymentsByContractor(contractorId: string): Promise<ContractorPayment[]>;
  updateContractorPayment(id: string, updates: Partial<ContractorPayment>): Promise<ContractorPayment>;
  
  // Enhanced marketplace transaction operations
  updateMarketplaceTransactionPayment(id: string, updates: {
    paymentMethod: string;
    isOffPlatform: boolean;
    offPlatformMethod?: string;
    offPlatformNotes?: string;
    processingFee?: string;
    buyerFeeShare?: string;
    sellerFeeShare?: string;
    stripePaymentIntentId?: string;
    status?: string;
  }): Promise<MarketplaceTransaction>;
  
  // Enhanced marketplace conversation operations
  getMarketplaceConversationByListing(listingId: string, buyerId: string): Promise<MarketplaceConversation | undefined>;
  markMarketplaceMessageAsRead(id: string): Promise<MarketplaceMessage>;
  
  // Affiliate system methods
  // Affiliate program management
  getAffiliateProgram(userId: string): Promise<AffiliateProgram | undefined>;
  createAffiliateProgram(program: InsertAffiliateProgram): Promise<AffiliateProgram>;
  updateAffiliateProgram(id: string, updates: Partial<InsertAffiliateProgram>): Promise<AffiliateProgram>;
  generateAffiliateCode(userId: string): Promise<string>;
  
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
  createPayout(payout: InsertAffiliatePayout): Promise<AffiliatePayout>;
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
  getAllCrmContacts(filters?: { status?: string; assignedTo?: string; search?: string }): Promise<Array<CrmContact & { assignedTo?: User }>>;
  
  createCrmDeal(deal: InsertCrmDeal): Promise<CrmDeal>;
  updateCrmDeal(id: string, updates: Partial<CrmDeal>): Promise<CrmDeal>;
  deleteCrmDeal(id: string): Promise<void>;
  getCrmDeal(id: string): Promise<CrmDeal | undefined>;
  getAllCrmDeals(filters?: { stage?: string; assignedTo?: string; contactId?: string }): Promise<Array<CrmDeal & { contact?: CrmContact; assignedTo?: User }>>;
  
  createCrmActivity(activity: InsertCrmActivity): Promise<CrmActivity>;
  updateCrmActivity(id: string, updates: Partial<CrmActivity>): Promise<CrmActivity>;
  deleteCrmActivity(id: string): Promise<void>;
  getCrmActivity(id: string): Promise<CrmActivity | undefined>;
  getCrmActivitiesByContact(contactId: string): Promise<Array<CrmActivity & { createdBy?: User }>>;
  getCrmActivitiesByDeal(dealId: string): Promise<Array<CrmActivity & { createdBy?: User }>>;
  getAllCrmActivities(filters?: { type?: string; contactId?: string; dealId?: string }): Promise<Array<CrmActivity & { contact?: CrmContact; deal?: CrmDeal; createdBy?: User }>>;
  
  createCrmEmailTemplate(template: InsertCrmEmailTemplate): Promise<CrmEmailTemplate>;
  updateCrmEmailTemplate(id: string, updates: Partial<CrmEmailTemplate>): Promise<CrmEmailTemplate>;
  deleteCrmEmailTemplate(id: string): Promise<void>;
  getCrmEmailTemplate(id: string): Promise<CrmEmailTemplate | undefined>;
  getAllCrmEmailTemplates(category?: string): Promise<Array<CrmEmailTemplate & { createdBy?: User }>>;
  
  createCrmPipeline(pipeline: InsertCrmPipeline): Promise<CrmPipeline>;
  updateCrmPipeline(id: string, updates: Partial<CrmPipeline>): Promise<CrmPipeline>;
  deleteCrmPipeline(id: string): Promise<void>;
  getCrmPipeline(id: string): Promise<CrmPipeline | undefined>;
  getAllCrmPipelines(): Promise<Array<CrmPipeline & { createdBy?: User }>>;
  getDefaultCrmPipeline(): Promise<CrmPipeline | undefined>;
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

  async getUserByRole(role: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.role, role as any));
    return user;
  }

  async getUserByFacebookId(facebookId: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.facebookId, facebookId));
    return user;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.email, username));
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

  // Account security and management operations
  async getUserTrustedDevices(userId: string): Promise<TrustedDevice[]> {
    return await db.select().from(trustedDevices).where(eq(trustedDevices.userId, userId)).orderBy(desc(trustedDevices.lastUsed));
  }

  async removeTrustedDevice(userId: string, deviceId: string): Promise<void> {
    await db.delete(trustedDevices).where(and(eq(trustedDevices.userId, userId), eq(trustedDevices.id, deviceId)));
  }

  async getUserLoginHistory(userId: string, limit: number, offset: number): Promise<any> {
    // Simple mock implementation - in a real app you'd track login sessions
    return [
      {
        id: '1',
        timestamp: new Date(),
        ipAddress: '192.168.1.1',
        userAgent: 'Chrome on Windows',
        success: true,
        location: 'United States'
      }
    ];
  }

  async exportUserData(userId: string): Promise<any> {
    const user = await this.getUser(userId);
    if (!user) throw new Error('User not found');

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
        preferences: user.preferences
      },
      exportDate: new Date().toISOString(),
      dataPolicy: 'This export contains all personal data associated with your TradeScout account.'
    };

    return data;
  }

  async deactivateUser(userId: string): Promise<void> {
    await this.updateUser(userId, {
      isActive: false,
      updatedAt: new Date()
    });
  }

  async updateUserPrivacySettings(userId: string, settings: any): Promise<any> {
    const user = await this.getUser(userId);
    if (!user) throw new Error('User not found');

    const currentPrefs = user.preferences || {};
    const updatedPreferences = {
      ...currentPrefs,
      privacy: {
        ...currentPrefs.privacy,
        ...settings
      }
    };

    const updatedUser = await this.updateUser(userId, {
      preferences: updatedPreferences
    });

    return updatedUser.preferences?.privacy;
  }

  async createMasterAdmin(email: string, password: string, firstName: string, lastName: string): Promise<User> {
    const hashedPassword = await bcrypt.hash(password, 10);
    const [user] = await db
      .insert(users)
      .values({
        email,
        password: hashedPassword,
        firstName,
        lastName,
        role: 'head_admin',
        emailVerified: true, // Master admin is pre-verified
        addressVerified: true,
        address: 'Platform Administrator' // Default address for master admin
      })
      .returning();
    return user;
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

  async getContractorByUserId(userId: string): Promise<Contractor | undefined> {
    const [contractor] = await db
      .select()
      .from(contractors)
      .where(eq(contractors.userId, userId));
    return contractor;
  }

  async getContractor(id: string): Promise<Contractor | undefined> {
    return this.getContractorById(id);
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
  async getCounties(stateCode?: string): Promise<(County & { state?: { name: string; code: string } })[]> {
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

    if (stateCode) {
      return await query
        .where(eq(counties.stateCode, stateCode))
        .orderBy(asc(counties.name));
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
    const conditions = [];
    if (contractorId) {
      conditions.push(eq(leads.contractorId, contractorId));
    }
    if (status) {
      conditions.push(eq(leads.status, status));
    }
    
    const baseQuery = db.select().from(leads);
    
    if (conditions.length > 0) {
      return await baseQuery
        .where(and(...conditions))
        .orderBy(desc(leads.createdAt));
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
    if (fips) {
      return await db
        .select()
        .from(pricingData)
        .where(and(
          eq(pricingData.service, service),
          eq(pricingData.fips, fips)
        ));
    }
    
    return await db
      .select()
      .from(pricingData)
      .where(eq(pricingData.service, service));
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
    let baseQuery = db
      .select({ count: sql<number>`count(*)` })
      .from(events);
    
    if (dateRange) {
      const [result] = await baseQuery
        .where(and(
          eq(events.eventType, eventType),
          gt(events.createdAt, dateRange.from),
          sql`${events.createdAt} < ${dateRange.to}`
        ));
      return result?.count || 0;
    }
    
    const [result] = await baseQuery.where(eq(events.eventType, eventType));
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

  async getErrorReports(): Promise<any> {
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
    } catch (error: any) {
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

  // Contractor application methods
  async createContractorApplication(data: typeof contractorApplications.$inferInsert) {
    const result = await db.insert(contractorApplications).values(data).returning();
    return result[0];
  }

  async getContractorApplications(filters?: { status?: string; limit?: number }) {
    let query = db.select().from(contractorApplications);
    
    if (filters?.status) {
      query = query.where(eq(contractorApplications.status, filters.status));
    }
    
    query = query.orderBy(desc(contractorApplications.submittedAt));
    
    if (filters?.limit) {
      query = query.limit(filters.limit);
    }
    
    return await query;
  }

  async getContractorApplication(id: string) {
    return await db.select().from(contractorApplications).where(eq(contractorApplications.id, id)).limit(1).then(rows => rows[0]);
  }

  async updateContractorApplication(id: string, data: Partial<typeof contractorApplications.$inferInsert>) {
    await db.update(contractorApplications).set({
      ...data,
      updatedAt: new Date()
    }).where(eq(contractorApplications.id, id));
  }

  // Recommendation system methods with anti-abuse protection
  async createRecommendation(data: typeof recommendations.$inferInsert & { 
    ipAddress?: string; 
    userAgent?: string;
  }) {
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
      throw new Error('You can only submit one recommendation per contractor every 30 days');
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
      throw new Error('This email address has already submitted a recommendation for this contractor recently');
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
        throw new Error('Too many recommendations from this location. Please try again tomorrow.');
      }
    }

    const result = await db.insert(recommendations).values({
      ...data,
      moderationStatus: 'pending', // All recommendations require moderation
      isPublic: false
    }).returning();
    
    return result[0];
  }

  async getContractorRecommendations(contractorId: string, options?: { limit?: number; type?: 'positive' | 'negative' | 'all' }) {
    let query = db.select().from(recommendations).where(
      and(
        eq(recommendations.contractorId, contractorId),
        eq(recommendations.isPublic, true),
        eq(recommendations.moderationStatus, 'approved')
      )
    );

    if (options?.type && options.type !== 'all') {
      query = query.where(eq(recommendations.recommendationType, options.type));
    }

    query = query.orderBy(desc(recommendations.createdAt));

    if (options?.limit) {
      query = query.limit(options.limit);
    }

    return await query;
  }

  async updateContractorRecommendationStats(contractorId: string) {
    // Get all approved recommendations for this contractor
    const stats = await db
      .select({
        positive: sql<number>`count(*) filter (where recommendation_type = 'positive')`,
        negative: sql<number>`count(*) filter (where recommendation_type = 'negative')`,
        total: sql<number>`count(*)`
      })
      .from(recommendations)
      .where(
        and(
          eq(recommendations.contractorId, contractorId),
          eq(recommendations.moderationStatus, 'approved')
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
        updatedAt: new Date()
      })
      .where(eq(contractors.id, contractorId));
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
    } catch (error: any) {
      console.error("Error updating leaderboard stats:", error);
    }
  }

  async getMonthlyLeaderboard(month: number, year: number, limit: number, state?: string, county?: string): Promise<any> {
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
    } catch (error: any) {
      console.error("Error in getMonthlyLeaderboard:", error);
      return [];
    }
  }

  async getLifetimeLeaderboard(limit: number, state?: string, county?: string): Promise<any> {
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
    } catch (error: any) {
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

  async getUserMarketplaceConversations(userId: string): Promise<any> {
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
  async createRealTimeNotification(notification: InsertRealTimeNotification): Promise<RealTimeNotification> {
    const [newNotification] = await db
      .insert(realTimeNotifications)
      .values(notification)
      .returning();
    return newNotification;
  }

  async getUserRealTimeNotifications(userId: string, unreadOnly?: boolean): Promise<RealTimeNotification[]> {
    let query = db.select().from(realTimeNotifications).where(eq(realTimeNotifications.userId, userId));
    
    if (unreadOnly) {
      query = query.where(isNull(realTimeNotifications.readAt)) as any;
    }
    
    return await query.orderBy(desc(realTimeNotifications.createdAt));
  }

  async markRealTimeNotificationAsRead(id: string): Promise<RealTimeNotification> {
    const [notification] = await db
      .update(realTimeNotifications)
      .set({ readAt: new Date() })
      .where(eq(realTimeNotifications.id, id))
      .returning();
    return notification;
  }

  async markAllRealTimeNotificationsAsRead(userId: string): Promise<void> {
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

  // Payment system operations
  async createPaymentConfiguration(config: InsertPaymentConfiguration): Promise<PaymentConfiguration> {
    const [newConfig] = await db
      .insert(paymentConfigurations)
      .values(config)
      .returning();
    return newConfig;
  }

  async getPaymentConfiguration(configType: string): Promise<PaymentConfiguration | undefined> {
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

  async updatePaymentConfiguration(id: string, updates: Partial<InsertPaymentConfiguration>): Promise<PaymentConfiguration> {
    const [config] = await db
      .update(paymentConfigurations)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(paymentConfigurations.id, id))
      .returning();
    return config;
  }

  // Contractor payment operations
  async createContractorPayment(payment: InsertContractorPayment): Promise<ContractorPayment> {
    const [newPayment] = await db
      .insert(contractorPayments)
      .values(payment)
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

  async updateContractorPayment(id: string, updates: Partial<ContractorPayment>): Promise<ContractorPayment> {
    const [payment] = await db
      .update(contractorPayments)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(contractorPayments.id, id))
      .returning();
    return payment;
  }

  // Enhanced marketplace transaction operations
  async updateMarketplaceTransactionPayment(id: string, updates: {
    paymentMethod: string;
    isOffPlatform: boolean;
    offPlatformMethod?: string;
    offPlatformNotes?: string;
    processingFee?: string;
    buyerFeeShare?: string;
    sellerFeeShare?: string;
    stripePaymentIntentId?: string;
    status?: string;
  }): Promise<MarketplaceTransaction> {
    const [transaction] = await db
      .update(marketplaceTransactions)
      .set({ 
        ...updates, 
        updatedAt: new Date(),
        ...(updates.status === 'completed' ? { completedAt: new Date() } : {})
      })
      .where(eq(marketplaceTransactions.id, id))
      .returning();
    return transaction;
  }

  // ==================== FOUNDATION SYSTEM METHODS ====================

  // Foundation causes
  async getFoundationCauses(filters?: { category?: string; countyId?: string; isActive?: boolean }): Promise<FoundationCause[]> {
    let query = db.select().from(foundationCauses);

    const conditions = [eq(foundationCauses.isActive, true)];

    if (filters?.category && filters.category !== 'all') {
      conditions.push(eq(foundationCauses.category, filters.category));
    }
    if (filters?.countyId) {
      conditions.push(eq(foundationCauses.countyId, filters.countyId));
    }
    if (filters?.isActive !== undefined) {
      conditions.push(eq(foundationCauses.isActive, filters.isActive));
    }

    return await query
      .where(and(...conditions))
      .orderBy(desc(foundationCauses.createdAt));
  }

  async getFoundationCause(id: string): Promise<FoundationCause | undefined> {
    const [cause] = await db
      .select()
      .from(foundationCauses)
      .where(eq(foundationCauses.id, id));
    return cause;
  }

  async createFoundationCause(data: InsertFoundationCause): Promise<FoundationCause> {
    const [cause] = await db
      .insert(foundationCauses)
      .values(data)
      .returning();
    return cause;
  }

  // Foundation donations
  async createFoundationDonation(data: InsertFoundationDonation): Promise<FoundationDonation> {
    const [donation] = await db
      .insert(foundationDonations)
      .values(data)
      .returning();
    return donation;
  }

  async getFoundationDonation(id: string): Promise<FoundationDonation | undefined> {
    const [donation] = await db
      .select()
      .from(foundationDonations)
      .where(eq(foundationDonations.id, id));
    return donation;
  }

  async updateFoundationDonation(id: string, data: Partial<FoundationDonation>): Promise<FoundationDonation | undefined> {
    const [donation] = await db
      .update(foundationDonations)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(foundationDonations.id, id))
      .returning();
    return donation;
  }

  async getUserDonations(userId: string, filters?: { status?: string; type?: string }): Promise<any> {
    let query = db
      .select({
        id: foundationDonations.id,
        amount: foundationDonations.amount,
        type: foundationDonations.type,
        status: foundationDonations.status,
        isRoundupDonation: foundationDonations.isRoundupDonation,
        originalAmount: foundationDonations.originalAmount,
        isAnonymous: foundationDonations.isAnonymous,
        donorMessage: foundationDonations.donorMessage,
        createdAt: foundationDonations.createdAt,
        completedAt: foundationDonations.completedAt,
        cause: {
          id: foundationCauses.id,
          name: foundationCauses.name,
          category: foundationCauses.category,
          county: {
            name: counties.name,
            state: counties.state,
          }
        }
      })
      .from(foundationDonations)
      .leftJoin(foundationCauses, eq(foundationDonations.causeId, foundationCauses.id))
      .leftJoin(counties, eq(foundationCauses.countyId, counties.id))
      .where(eq(foundationDonations.userId, userId));

    if (filters?.status) {
      query = query.where(eq(foundationDonations.status, filters.status as any));
    }
    if (filters?.type) {
      query = query.where(eq(foundationDonations.type, filters.type as any));
    }

    return await query.orderBy(desc(foundationDonations.createdAt));
  }

  // Update cause raised amount after successful donation
  async updateCauseRaisedAmount(causeId: string, additionalAmount: number): Promise<void> {
    await db
      .update(foundationCauses)
      .set({
        raisedAmount: sql`${foundationCauses.raisedAmount} + ${additionalAmount}`,
        updatedAt: new Date()
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

  async createUserDonationPreferences(data: InsertUserDonationPreferences): Promise<UserDonationPreferences> {
    const [preferences] = await db
      .insert(userDonationPreferences)
      .values(data)
      .returning();
    return preferences;
  }

  async updateUserDonationPreferences(userId: string, data: Partial<UserDonationPreferences>): Promise<UserDonationPreferences | undefined> {
    const [preferences] = await db
      .update(userDonationPreferences)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(userDonationPreferences.userId, userId))
      .returning();
    return preferences;
  }

  async upsertUserDonationPreferences(userId: string, data: Partial<UserDonationPreferences>): Promise<UserDonationPreferences> {
    const [preferences] = await db
      .insert(userDonationPreferences)
      .values({ ...data, userId })
      .onConflictDoUpdate({
        target: userDonationPreferences.userId,
        set: { ...data, updatedAt: new Date() }
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
        countiesSupported: sql<number>`COUNT(DISTINCT ${foundationCauses.countyId})`
      })
      .from(foundationDonations)
      .leftJoin(foundationCauses, eq(foundationDonations.causeId, foundationCauses.id))
      .where(and(
        eq(foundationDonations.status, 'completed'),
        eq(foundationCauses.isActive, true)
      ));

    return stats;
  }

  // Recent donations (public feed)
  async getRecentDonations(limit: number = 20): Promise<any> {
    const donations = await db
      .select()
      .from(foundationDonations)
      .where(eq(foundationDonations.status, 'completed'))
      .orderBy(desc(foundationDonations.createdAt))
      .limit(limit);

    // Fetch related data separately to avoid complex join issues
    const results = [];
    for (const donation of donations) {
      const cause = await this.getFoundationCause(donation.causeId);
      let county = null;
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
        cause: cause ? {
          name: cause.name,
          category: cause.category,
          county: county ? {
            name: county.name,
            state: county.state,
          } : null
        } : null
      });
    }

    return results;
  }

  // Foundation impact reports
  async getFoundationImpactReports(causeId?: string): Promise<any> {
    let baseQuery = db
      .select()
      .from(foundationImpactReports)
      .where(isNotNull(foundationImpactReports.publishedAt));

    if (causeId) {
      baseQuery = baseQuery.where(eq(foundationImpactReports.causeId, causeId));
    }

    const reports = await baseQuery.orderBy(desc(foundationImpactReports.publishedAt));

    // Fetch related data separately to avoid complex join issues
    const results = [];
    for (const report of reports) {
      const cause = await this.getFoundationCause(report.causeId);
      let county = null;
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
        cause: cause ? {
          id: cause.id,
          name: cause.name,
          category: cause.category,
          county: county ? {
            name: county.name,
            state: county.state,
          } : null
        } : null
      });
    }

    return results;
  }

  async createFoundationImpactReport(data: InsertFoundationImpactReport): Promise<FoundationImpactReport> {
    const [report] = await db
      .insert(foundationImpactReports)
      .values(data)
      .returning();
    return report;
  }

  // ==================== AFFILIATE SYSTEM IMPLEMENTATION ====================

  // Affiliate program management
  async getAffiliateProgram(userId: string): Promise<AffiliateProgram | undefined> {
    const [program] = await db
      .select()
      .from(affiliatePrograms)
      .where(eq(affiliatePrograms.userId, userId));
    return program;
  }

  async createAffiliateProgram(data: InsertAffiliateProgram): Promise<AffiliateProgram> {
    const [program] = await db
      .insert(affiliatePrograms)
      .values(data)
      .returning();
    return program;
  }

  async updateAffiliateProgram(id: string, updates: Partial<InsertAffiliateProgram>): Promise<AffiliateProgram> {
    const [program] = await db
      .update(affiliatePrograms)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(affiliatePrograms.id, id))
      .returning();
    return program;
  }

  async generateAffiliateCode(userId: string): Promise<string> {
    // Generate a unique affiliate code (e.g., JOHN2024ABC)
    const user = await this.getUser(userId);
    if (!user) throw new Error('User not found');
    
    const year = new Date().getFullYear();
    const randomSuffix = Math.random().toString(36).substring(2, 5).toUpperCase();
    const baseName = (user.firstName || user.email?.split('@')[0] || 'USER').substring(0, 4).toUpperCase();
    
    return `${baseName}${year}${randomSuffix}`;
  }

  // Referral tracking
  async trackReferralClick(data: InsertAffiliateReferral): Promise<AffiliateReferral> {
    const [referral] = await db
      .insert(affiliateReferrals)
      .values(data)
      .returning();
    return referral;
  }

  async convertReferral(affiliateCode: string, userId: string): Promise<void> {
    await db
      .update(affiliateReferrals)
      .set({ 
        referredUserId: userId, 
        convertedAt: new Date(),
        status: 'converted'
      })
      .where(and(
        eq(affiliateReferrals.affiliateCode, affiliateCode),
        isNull(affiliateReferrals.referredUserId)
      ));
  }

  async getReferralsByAffiliate(affiliateProgramId: string): Promise<AffiliateReferral[]> {
    return await db
      .select()
      .from(affiliateReferrals)
      .where(eq(affiliateReferrals.affiliateProgramId, affiliateProgramId))
      .orderBy(desc(affiliateReferrals.createdAt));
  }

  async getReferralByReferredUserId(userId: string): Promise<AffiliateReferral | undefined> {
    const [referral] = await db
      .select()
      .from(affiliateReferrals)
      .where(and(
        eq(affiliateReferrals.referredUserId, userId),
        eq(affiliateReferrals.status, 'converted')
      ));
    return referral;
  }

  // Commission management
  async createCommission(data: InsertAffiliateCommission): Promise<AffiliateCommission> {
    const [commission] = await db
      .insert(affiliateCommissions)
      .values(data)
      .returning();
    
    // Update affiliate program stats
    await db
      .update(affiliatePrograms)
      .set({
        totalCommissionEarned: sql`${affiliatePrograms.totalCommissionEarned} + ${data.commissionAmount}`,
        updatedAt: new Date()
      })
      .where(eq(affiliatePrograms.id, data.affiliateProgramId));
    
    return commission;
  }

  async getCommissionsForAffiliate(affiliateProgramId: string): Promise<AffiliateCommission[]> {
    return await db
      .select()
      .from(affiliateCommissions)
      .where(eq(affiliateCommissions.affiliateProgramId, affiliateProgramId))
      .orderBy(desc(affiliateCommissions.createdAt));
  }

  async approveCommission(commissionId: string): Promise<void> {
    await db
      .update(affiliateCommissions)
      .set({ 
        status: 'approved', 
        approvedAt: new Date(),
        updatedAt: new Date()
      })
      .where(eq(affiliateCommissions.id, commissionId));
  }

  async getUnpaidCommissions(affiliateProgramId: string): Promise<AffiliateCommission[]> {
    return await db
      .select()
      .from(affiliateCommissions)
      .where(and(
        eq(affiliateCommissions.affiliateProgramId, affiliateProgramId),
        eq(affiliateCommissions.status, 'approved'),
        isNull(affiliateCommissions.paidAt)
      ))
      .orderBy(desc(affiliateCommissions.createdAt));
  }

  // Payout management
  async createPayout(data: InsertAffiliatePayout): Promise<AffiliatePayout> {
    const [payout] = await db
      .insert(affiliatePayouts)
      .values(data)
      .returning();
    
    // Update affiliate program paid stats
    await db
      .update(affiliatePrograms)
      .set({
        totalCommissionPaid: sql`${affiliatePrograms.totalCommissionPaid} + ${data.totalAmount}`,
        updatedAt: new Date()
      })
      .where(eq(affiliatePrograms.id, data.affiliateProgramId));
    
    return payout;
  }

  async getPayoutsForAffiliate(affiliateProgramId: string): Promise<AffiliatePayout[]> {
    return await db
      .select()
      .from(affiliatePayouts)
      .where(eq(affiliatePayouts.affiliateProgramId, affiliateProgramId))
      .orderBy(desc(affiliatePayouts.createdAt));
  }

  async updatePayoutStatus(payoutId: string, status: string): Promise<void> {
    const updateData: any = { status, updatedAt: new Date() };
    
    if (status === 'completed') {
      updateData.processedAt = new Date();
    }
    
    await db
      .update(affiliatePayouts)
      .set(updateData)
      .where(eq(affiliatePayouts.id, payoutId));
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
      .from(affiliatePrograms)
      .where(eq(affiliatePrograms.id, affiliateProgramId));
    
    if (!program) {
      throw new Error('Affiliate program not found');
    }
    
    const [referralStats] = await db
      .select({
        totalReferrals: sql<number>`count(*)`,
        convertedReferrals: sql<number>`count(*) filter (where status = 'converted')`
      })
      .from(affiliateReferrals)
      .where(eq(affiliateReferrals.affiliateProgramId, affiliateProgramId));
    
    const conversionRate = referralStats.totalReferrals > 0 
      ? (referralStats.convertedReferrals / referralStats.totalReferrals) * 100 
      : 0;
    
    return {
      totalReferrals: referralStats.totalReferrals || 0,
      convertedReferrals: referralStats.convertedReferrals || 0,
      totalCommissionEarned: program.totalCommissionEarned || '0',
      totalCommissionPaid: program.totalCommissionPaid || '0',
      conversionRate: Math.round(conversionRate * 100) / 100
    };
  }

  // CRM operations implementation
  async createCrmContact(contactData: InsertCrmContact): Promise<CrmContact> {
    const [contact] = await db.insert(crmContacts).values(contactData).returning();
    return contact;
  }

  async updateCrmContact(id: string, updates: Partial<CrmContact>): Promise<CrmContact> {
    const [contact] = await db
      .update(crmContacts)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(crmContacts.id, id))
      .returning();
    return contact;
  }

  async deleteCrmContact(id: string): Promise<void> {
    await db.delete(crmContacts).where(eq(crmContacts.id, id));
  }

  async getCrmContact(id: string): Promise<CrmContact | undefined> {
    const [contact] = await db.select().from(crmContacts).where(eq(crmContacts.id, id));
    return contact;
  }

  async getCrmContactByEmail(email: string): Promise<CrmContact | undefined> {
    const [contact] = await db.select().from(crmContacts).where(eq(crmContacts.email, email));
    return contact;
  }

  async getAllCrmContacts(filters?: { 
    status?: string; 
    assignedTo?: string; 
    search?: string 
  }): Promise<Array<CrmContact & { assignedTo?: User }>> {
    let query = db
      .select({
        ...crmContacts,
        assignedTo: {
          id: users.id,
          firstName: users.firstName,
          lastName: users.lastName,
          email: users.email,
        }
      })
      .from(crmContacts)
      .leftJoin(users, eq(crmContacts.assignedToUserId, users.id));

    const conditions = [];

    if (filters?.status) {
      conditions.push(eq(crmContacts.status, filters.status as any));
    }

    if (filters?.assignedTo) {
      conditions.push(eq(crmContacts.assignedToUserId, filters.assignedTo));
    }

    if (filters?.search) {
      const searchTerm = `%${filters.search}%`;
      conditions.push(
        or(
          like(crmContacts.firstName, searchTerm),
          like(crmContacts.lastName, searchTerm),
          like(crmContacts.email, searchTerm),
          like(crmContacts.company, searchTerm)
        )
      );
    }

    if (conditions.length > 0) {
      query = query.where(and(...conditions));
    }

    const results = await query.orderBy(desc(crmContacts.createdAt));
    return results as Array<CrmContact & { assignedTo?: User }>;
  }

  async createCrmDeal(dealData: InsertCrmDeal): Promise<CrmDeal> {
    const [deal] = await db.insert(crmDeals).values(dealData).returning();
    return deal;
  }

  async updateCrmDeal(id: string, updates: Partial<CrmDeal>): Promise<CrmDeal> {
    const [deal] = await db
      .update(crmDeals)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(crmDeals.id, id))
      .returning();
    return deal;
  }

  async deleteCrmDeal(id: string): Promise<void> {
    await db.delete(crmDeals).where(eq(crmDeals.id, id));
  }

  async getCrmDeal(id: string): Promise<CrmDeal | undefined> {
    const [deal] = await db.select().from(crmDeals).where(eq(crmDeals.id, id));
    return deal;
  }

  async getAllCrmDeals(filters?: { 
    stage?: string; 
    assignedTo?: string; 
    contactId?: string 
  }): Promise<Array<CrmDeal & { contact?: CrmContact; assignedTo?: User }>> {
    let query = db
      .select({
        ...crmDeals,
        contact: {
          id: crmContacts.id,
          firstName: crmContacts.firstName,
          lastName: crmContacts.lastName,
          email: crmContacts.email,
          company: crmContacts.company,
        },
        assignedTo: {
          id: users.id,
          firstName: users.firstName,
          lastName: users.lastName,
          email: users.email,
        }
      })
      .from(crmDeals)
      .leftJoin(crmContacts, eq(crmDeals.contactId, crmContacts.id))
      .leftJoin(users, eq(crmDeals.assignedToUserId, users.id));

    const conditions = [];

    if (filters?.stage) {
      conditions.push(eq(crmDeals.stage, filters.stage as any));
    }

    if (filters?.assignedTo) {
      conditions.push(eq(crmDeals.assignedToUserId, filters.assignedTo));
    }

    if (filters?.contactId) {
      conditions.push(eq(crmDeals.contactId, filters.contactId));
    }

    if (conditions.length > 0) {
      query = query.where(and(...conditions));
    }

    const results = await query.orderBy(desc(crmDeals.createdAt));
    return results as Array<CrmDeal & { contact?: CrmContact; assignedTo?: User }>;
  }

  async createCrmActivity(activityData: InsertCrmActivity): Promise<CrmActivity> {
    const [activity] = await db.insert(crmActivities).values(activityData).returning();
    return activity;
  }

  async updateCrmActivity(id: string, updates: Partial<CrmActivity>): Promise<CrmActivity> {
    const [activity] = await db
      .update(crmActivities)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(crmActivities.id, id))
      .returning();
    return activity;
  }

  async deleteCrmActivity(id: string): Promise<void> {
    await db.delete(crmActivities).where(eq(crmActivities.id, id));
  }

  async getCrmActivity(id: string): Promise<CrmActivity | undefined> {
    const [activity] = await db.select().from(crmActivities).where(eq(crmActivities.id, id));
    return activity;
  }

  async getCrmActivitiesByContact(contactId: string): Promise<Array<CrmActivity & { createdBy?: User }>> {
    const results = await db
      .select({
        ...crmActivities,
        createdBy: {
          id: users.id,
          firstName: users.firstName,
          lastName: users.lastName,
          email: users.email,
        }
      })
      .from(crmActivities)
      .leftJoin(users, eq(crmActivities.createdByUserId, users.id))
      .where(eq(crmActivities.contactId, contactId))
      .orderBy(desc(crmActivities.createdAt));

    return results as Array<CrmActivity & { createdBy?: User }>;
  }

  async getCrmActivitiesByDeal(dealId: string): Promise<Array<CrmActivity & { createdBy?: User }>> {
    const results = await db
      .select({
        ...crmActivities,
        createdBy: {
          id: users.id,
          firstName: users.firstName,
          lastName: users.lastName,
          email: users.email,
        }
      })
      .from(crmActivities)
      .leftJoin(users, eq(crmActivities.createdByUserId, users.id))
      .where(eq(crmActivities.dealId, dealId))
      .orderBy(desc(crmActivities.createdAt));

    return results as Array<CrmActivity & { createdBy?: User }>;
  }

  async getAllCrmActivities(filters?: { 
    type?: string; 
    contactId?: string; 
    dealId?: string 
  }): Promise<Array<CrmActivity & { contact?: CrmContact; deal?: CrmDeal; createdBy?: User }>> {
    let query = db
      .select({
        ...crmActivities,
        contact: {
          id: crmContacts.id,
          firstName: crmContacts.firstName,
          lastName: crmContacts.lastName,
          email: crmContacts.email,
          company: crmContacts.company,
        },
        deal: {
          id: crmDeals.id,
          title: crmDeals.title,
          value: crmDeals.value,
          stage: crmDeals.stage,
        },
        createdBy: {
          id: users.id,
          firstName: users.firstName,
          lastName: users.lastName,
          email: users.email,
        }
      })
      .from(crmActivities)
      .leftJoin(crmContacts, eq(crmActivities.contactId, crmContacts.id))
      .leftJoin(crmDeals, eq(crmActivities.dealId, crmDeals.id))
      .leftJoin(users, eq(crmActivities.createdByUserId, users.id));

    const conditions = [];

    if (filters?.type) {
      conditions.push(eq(crmActivities.type, filters.type as any));
    }

    if (filters?.contactId) {
      conditions.push(eq(crmActivities.contactId, filters.contactId));
    }

    if (filters?.dealId) {
      conditions.push(eq(crmActivities.dealId, filters.dealId));
    }

    if (conditions.length > 0) {
      query = query.where(and(...conditions));
    }

    const results = await query.orderBy(desc(crmActivities.createdAt));
    return results as Array<CrmActivity & { contact?: CrmContact; deal?: CrmDeal; createdBy?: User }>;
  }

  async createCrmEmailTemplate(templateData: InsertCrmEmailTemplate): Promise<CrmEmailTemplate> {
    const [template] = await db.insert(crmEmailTemplates).values(templateData).returning();
    return template;
  }

  async updateCrmEmailTemplate(id: string, updates: Partial<CrmEmailTemplate>): Promise<CrmEmailTemplate> {
    const [template] = await db
      .update(crmEmailTemplates)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(crmEmailTemplates.id, id))
      .returning();
    return template;
  }

  async deleteCrmEmailTemplate(id: string): Promise<void> {
    await db.delete(crmEmailTemplates).where(eq(crmEmailTemplates.id, id));
  }

  async getCrmEmailTemplate(id: string): Promise<CrmEmailTemplate | undefined> {
    const [template] = await db.select().from(crmEmailTemplates).where(eq(crmEmailTemplates.id, id));
    return template;
  }

  async getAllCrmEmailTemplates(category?: string): Promise<Array<CrmEmailTemplate & { createdBy?: User }>> {
    let query = db
      .select({
        ...crmEmailTemplates,
        createdBy: {
          id: users.id,
          firstName: users.firstName,
          lastName: users.lastName,
          email: users.email,
        }
      })
      .from(crmEmailTemplates)
      .leftJoin(users, eq(crmEmailTemplates.createdByUserId, users.id));

    if (category) {
      query = query.where(eq(crmEmailTemplates.category, category));
    }

    const results = await query
      .where(eq(crmEmailTemplates.isActive, true))
      .orderBy(crmEmailTemplates.name);

    return results as Array<CrmEmailTemplate & { createdBy?: User }>;
  }

  async createCrmPipeline(pipelineData: InsertCrmPipeline): Promise<CrmPipeline> {
    const [pipeline] = await db.insert(crmPipelines).values(pipelineData).returning();
    return pipeline;
  }

  async updateCrmPipeline(id: string, updates: Partial<CrmPipeline>): Promise<CrmPipeline> {
    const [pipeline] = await db
      .update(crmPipelines)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(crmPipelines.id, id))
      .returning();
    return pipeline;
  }

  async deleteCrmPipeline(id: string): Promise<void> {
    await db.delete(crmPipelines).where(eq(crmPipelines.id, id));
  }

  async getCrmPipeline(id: string): Promise<CrmPipeline | undefined> {
    const [pipeline] = await db.select().from(crmPipelines).where(eq(crmPipelines.id, id));
    return pipeline;
  }

  async getAllCrmPipelines(): Promise<Array<CrmPipeline & { createdBy?: User }>> {
    const results = await db
      .select({
        ...crmPipelines,
        createdBy: {
          id: users.id,
          firstName: users.firstName,
          lastName: users.lastName,
          email: users.email,
        }
      })
      .from(crmPipelines)
      .leftJoin(users, eq(crmPipelines.createdByUserId, users.id))
      .where(eq(crmPipelines.isActive, true))
      .orderBy(crmPipelines.name);

    return results as Array<CrmPipeline & { createdBy?: User }>;
  }

  async getDefaultCrmPipeline(): Promise<CrmPipeline | undefined> {
    const [pipeline] = await db
      .select()
      .from(crmPipelines)
      .where(and(eq(crmPipelines.isDefault, true), eq(crmPipelines.isActive, true)));
    return pipeline;
  }

  // Phase 1: Daily Deals System Implementation
  
  async getDailyDeals(filters?: {
    countyFips?: string;
    limit?: number;
    featured?: boolean;
    dealType?: string;
    activeOnly?: boolean;
  }): Promise<DailyDeal[]> {
    let query = db.select().from(dailyDeals);
    
    const conditions = [];
    
    if (filters?.countyFips) {
      conditions.push(eq(dailyDeals.countyFips, filters.countyFips));
    }
    
    if (filters?.featured) {
      conditions.push(eq(dailyDeals.featured, true));
    }
    
    if (filters?.dealType) {
      conditions.push(eq(dailyDeals.dealType, filters.dealType));
    }
    
    if (filters?.activeOnly !== false) {
      conditions.push(eq(dailyDeals.isActive, true));
      conditions.push(gte(dailyDeals.endDate, new Date()));
    }
    
    if (conditions.length > 0) {
      query = query.where(and(...conditions));
    }
    
    const results = await query
      .orderBy(desc(dailyDeals.featured), desc(dailyDeals.priority), desc(dailyDeals.createdAt))
      .limit(filters?.limit || 50);
    
    return results;
  }
  
  async getDailyDeal(id: string): Promise<DailyDeal | undefined> {
    const [deal] = await db.select().from(dailyDeals).where(eq(dailyDeals.id, id));
    return deal;
  }
  
  async createDailyDeal(dealData: InsertDailyDeal): Promise<DailyDeal> {
    const [deal] = await db.insert(dailyDeals).values(dealData).returning();
    return deal;
  }
  
  async updateDailyDeal(id: string, updates: Partial<DailyDeal>): Promise<DailyDeal> {
    const [deal] = await db
      .update(dailyDeals)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(dailyDeals.id, id))
      .returning();
    return deal;
  }
  
  async deleteDailyDeal(id: string): Promise<void> {
    await db.delete(dailyDeals).where(eq(dailyDeals.id, id));
  }
  
  async updateDealStats(dealId: string, engagementType: string): Promise<void> {
    const updates: any = {};
    
    switch (engagementType) {
      case 'view':
        updates.views = sql`${dailyDeals.views} + 1`;
        break;
      case 'click':
        updates.clicks = sql`${dailyDeals.clicks} + 1`;
        break;
      case 'save':
        updates.saves = sql`${dailyDeals.saves} + 1`;
        break;
      case 'redeem':
        updates.currentRedemptions = sql`${dailyDeals.currentRedemptions} + 1`;
        break;
    }
    
    if (Object.keys(updates).length > 0) {
      await db.update(dailyDeals).set(updates).where(eq(dailyDeals.id, dealId));
    }
  }
  
  // Affiliate System Implementation
  
  async getUserAffiliate(userId: string): Promise<UserAffiliate | undefined> {
    const [affiliate] = await db.select().from(userAffiliates).where(eq(userAffiliates.userId, userId));
    return affiliate;
  }
  
  async createUserAffiliate(affiliateData: InsertUserAffiliate): Promise<UserAffiliate> {
    const [affiliate] = await db.insert(userAffiliates).values(affiliateData).returning();
    return affiliate;
  }
  
  async generateAffiliateCode(userId: string): Promise<string> {
    // Generate unique affiliate code based on user ID
    const user = await this.getUser(userId);
    const baseCode = user?.firstName?.substring(0, 3).toUpperCase() || 'USR';
    const randomSuffix = Math.random().toString(36).substring(2, 8).toUpperCase();
    return `${baseCode}${randomSuffix}`;
  }
  
  async trackAffiliateAction(trackingData: InsertAffiliateTracking): Promise<AffiliateTracking> {
    const [tracking] = await db.insert(affiliateTracking).values(trackingData).returning();
    
    // Update affiliate stats
    if (trackingData.action === 'click') {
      await db.update(userAffiliates)
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
    const affiliate = await db.select().from(userAffiliates)
      .where(eq(userAffiliates.affiliateCode, affiliateCode))
      .then(results => results[0]);
    
    if (!affiliate) {
      throw new Error('Affiliate not found');
    }
    
    const recentActivity = await db.select().from(affiliateTracking)
      .where(eq(affiliateTracking.affiliateCode, affiliateCode))
      .orderBy(desc(affiliateTracking.createdAt))
      .limit(20);
    
    // Monthly stats (placeholder for now)
    const monthlyStats = {
      clicks: affiliate.clicksGenerated,
      referrals: affiliate.totalReferrals,
      earnings: affiliate.totalEarnings,
      conversionRate: affiliate.totalReferrals > 0 ? 
        (affiliate.successfulReferrals / affiliate.totalReferrals) * 100 : 0
    };
    
    return {
      affiliate,
      recentActivity,
      monthlyStats,
      topPerformingLinks: [] // To be implemented
    };
  }

  // Smart Recommendation Generator implementation
  
  // Insights
  async createRecommendationInsight(insight: InsertRecommendationInsight): Promise<RecommendationInsight> {
    const [newInsight] = await db.insert(recommendationInsights).values(insight).returning();
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

  async updateRecommendationInsight(contractorId: string, updates: Partial<RecommendationInsight>): Promise<RecommendationInsight> {
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
    const positiveRecommendations = contractorRecommendations.filter(r => r.recommendationType === 'positive').length;
    const negativeRecommendations = contractorRecommendations.filter(r => r.recommendationType === 'negative').length;

    // Calculate average rating
    const ratingsSum = contractorRecommendations.reduce((sum, rec) => {
      const workQuality = parseInt(rec.workQuality || '0');
      const timeliness = parseInt(rec.timeliness || '0');
      const communication = parseInt(rec.communication || '0');
      return sum + (workQuality + timeliness + communication) / 3;
    }, 0);
    
    const averageRating = totalRecommendations > 0 ? (ratingsSum / totalRecommendations).toFixed(2) : '0';

    // Analyze strengths and improvement areas
    const topStrengths: string[] = [];
    const improvementAreas: string[] = [];

    if (positiveRecommendations / Math.max(totalRecommendations, 1) > 0.8) {
      topStrengths.push('Consistently positive customer feedback');
    }
    if (negativeRecommendations / Math.max(totalRecommendations, 1) < 0.1) {
      topStrengths.push('Low complaint rate');
    }
    if (parseFloat(averageRating) > 4.0) {
      topStrengths.push('High quality work ratings');
    }

    if (totalRecommendations < 5) {
      improvementAreas.push('Need more customer recommendations');
    }
    if (parseFloat(averageRating) < 3.5) {
      improvementAreas.push('Focus on improving work quality');
    }

    // Generate AI recommendations
    const aiRecommendations = [
      {
        category: 'Customer Follow-up',
        suggestion: 'Set up automated follow-up emails to request recommendations after project completion',
        impact: 'high' as const,
        timeframe: '1-2 weeks'
      },
      {
        category: 'Profile Optimization',
        suggestion: 'Complete your contractor profile with detailed service descriptions and photos',
        impact: 'medium' as const,
        timeframe: '1 week'
      },
      {
        category: 'Quality Improvement',
        suggestion: 'Focus on communication and timeliness to boost ratings',
        impact: 'high' as const,
        timeframe: 'Ongoing'
      }
    ];

    // Get competitive position
    const allContractorsCount = await db
      .select({ count: sql<number>`count(*)` })
      .from(contractors);
    
    const betterContractors = await db
      .select({ count: sql<number>`count(*)` })
      .from(contractors)
      .innerJoin(recommendations, eq(contractors.id, recommendations.contractorId))
      .where(gt(sql<number>`count(${recommendations.id})`, totalRecommendations))
      .groupBy(contractors.id);

    const competitorComparison = {
      totalContractors: allContractorsCount[0]?.count || 0,
      betterThan: Math.max(0, allContractorsCount[0]?.count - betterContractors.length),
      percentile: allContractorsCount[0]?.count > 0 
        ? Math.round(((allContractorsCount[0].count - betterContractors.length) / allContractorsCount[0].count) * 100)
        : 0
    };

    const marketPosition = competitorComparison.percentile >= 75 ? 'top_performer' :
                          competitorComparison.percentile >= 50 ? 'above_average' :
                          competitorComparison.percentile >= 25 ? 'average' : 'below_average';

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
          action: 'Follow up with recent customers for recommendations',
          priority: 'high' as const,
          impact: 'Increase recommendation count by 50%',
          difficulty: 'Easy - Use email templates'
        },
        {
          action: 'Optimize profile with photos and detailed descriptions',
          priority: 'medium' as const,
          impact: 'Improve customer trust and inquiry rate',
          difficulty: 'Medium - Requires content creation'
        }
      ],
      profileViews: 0, // Would be updated from analytics
      inquiryRate: '0',
      responseRate: '0',
      marketPosition,
      competitorComparison,
      aiRecommendations
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
    const [newGoal] = await db.insert(recommendationGoals).values(goal).returning();
    return newGoal;
  }

  async getContractorGoals(contractorId: string): Promise<RecommendationGoal[]> {
    return await db
      .select()
      .from(recommendationGoals)
      .where(eq(recommendationGoals.contractorId, contractorId))
      .orderBy(desc(recommendationGoals.createdAt));
  }

  async updateRecommendationGoal(goalId: string, updates: Partial<RecommendationGoal>): Promise<RecommendationGoal> {
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

      const progress = Math.min(100, ((currentCount - goal.startingRecommendations) / Math.max(1, goal.targetRecommendations - goal.startingRecommendations)) * 100);
      
      await this.updateRecommendationGoal(goal.id, {
        currentProgress: progress.toString()
      });
    }
  }

  // Campaigns
  async createRecommendationCampaign(campaign: InsertRecommendationCampaign): Promise<RecommendationCampaign> {
    const [newCampaign] = await db.insert(recommendationCampaigns).values(campaign).returning();
    return newCampaign;
  }

  async getContractorCampaigns(contractorId: string): Promise<RecommendationCampaign[]> {
    return await db
      .select()
      .from(recommendationCampaigns)
      .where(eq(recommendationCampaigns.contractorId, contractorId))
      .orderBy(desc(recommendationCampaigns.createdAt));
  }

  async updateRecommendationCampaign(campaignId: string, updates: Partial<RecommendationCampaign>): Promise<RecommendationCampaign> {
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
    const [flag] = await db.insert(featureFlags).values({
      ...flagData,
      createdAt: new Date(),
      updatedAt: new Date()
    }).returning();
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
}

export const storage = new DatabaseStorage();
