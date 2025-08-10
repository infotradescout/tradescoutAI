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
} from "@shared/schema";
import { db } from "./db";
import { eq, and, desc, asc, sql, inArray, like, gt } from "drizzle-orm";

export interface IStorage {
  // User operations
  getUser(id: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateUser(id: string, updates: Partial<User>): Promise<User>;
  upsertUser(user: UpsertUser): Promise<User>;
  
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

  // Contractor operations
  async getContractors(filters?: {
    countyId?: string;
    tradeIds?: string[];
    sortBy?: 'recommended' | 'rating' | 'years' | 'verified';
    limit?: number;
    offset?: number;
  }): Promise<Contractor[]> {
    // Start with basic contractor query
    let query = db.select().from(contractors).where(eq(contractors.isActive, true));

    // Apply sorting
    switch (filters?.sortBy) {
      case 'rating':
        query = query.orderBy(desc(contractors.avgRating));
        break;
      case 'years':
        query = query.orderBy(desc(contractors.yearsInBusiness));
        break;
      case 'verified':
        query = query.orderBy(desc(contractors.lastVerified));
        break;
      default:
        // Default to "Most Recommended" - order by rating then reviews
        query = query.orderBy(desc(contractors.avgRating), desc(contractors.totalReviews));
    }

    if (filters?.limit) {
      query = query.limit(filters.limit);
    }

    if (filters?.offset) {
      query = query.offset(filters.offset);
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
}

export const storage = new DatabaseStorage();
