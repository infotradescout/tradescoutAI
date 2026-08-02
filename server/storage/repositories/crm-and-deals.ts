/* eslint-disable @typescript-eslint/no-explicit-any -- Preserves legacy storage method contracts during repository extraction. */
import {
  crmContacts,
  crmDeals,
  crmActivities,
  crmEmailTemplates,
  crmPipelines,
  users,
  dailyDeals,
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
  type User,
  type DailyDeal,
  type InsertDailyDeal,
} from "@shared/schema";
import { and, desc, eq, gte, like, or, sql, type SQL } from "drizzle-orm";
import { getTableColumns } from "drizzle-orm/utils";
import { db } from "../../db";
import { SocialAndLeaderboardStorageRepository } from "./social-and-leaderboards";

export class CrmAndDealsStorageRepository extends SocialAndLeaderboardStorageRepository {
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
    search?: string;
  }): Promise<Array<CrmContact & { assignedTo?: User }>> {
    const baseQuery = db
      .select({
        ...getTableColumns(crmContacts),
        assignedTo: {
          id: users.id,
          firstName: users.firstName,
          lastName: users.lastName,
          email: users.email,
        },
      })
      .from(crmContacts)
      .leftJoin(users, eq(crmContacts.assignedToUserId, users.id));

    const conditions: SQL[] = [];

    if (filters?.status) {
      conditions.push(eq(crmContacts.status, filters.status as any));
    }

    if (filters?.assignedTo) {
      conditions.push(eq(crmContacts.assignedToUserId, filters.assignedTo));
    }

    if (filters?.search) {
      const searchTerm = `%${filters.search}%`;
      const searchCondition = or(
        like(crmContacts.firstName, searchTerm),
        like(crmContacts.lastName, searchTerm),
        like(crmContacts.email, searchTerm),
        like(crmContacts.company, searchTerm)
      );
      if (searchCondition) conditions.push(searchCondition);
    }

    const contactQuery = conditions.length > 0 ? baseQuery.where(and(...conditions)) : baseQuery;
    const results = await contactQuery.orderBy(desc(crmContacts.createdAt));
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
    contactId?: string;
  }): Promise<Array<CrmDeal & { contact?: CrmContact; assignedTo?: User }>> {
    const baseQuery = db
      .select({
        ...getTableColumns(crmDeals),
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
        },
      })
      .from(crmDeals)
      .leftJoin(crmContacts, eq(crmDeals.contactId, crmContacts.id))
      .leftJoin(users, eq(crmDeals.assignedToUserId, users.id));

    const conditions: SQL[] = [];

    if (filters?.stage) {
      conditions.push(eq(crmDeals.stage, filters.stage as any));
    }

    if (filters?.assignedTo) {
      conditions.push(eq(crmDeals.assignedToUserId, filters.assignedTo));
    }

    if (filters?.contactId) {
      conditions.push(eq(crmDeals.contactId, filters.contactId));
    }

    const dealQuery = conditions.length > 0 ? baseQuery.where(and(...conditions)) : baseQuery;
    const results = await dealQuery.orderBy(desc(crmDeals.createdAt));
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

  async getCrmActivitiesByContact(
    contactId: string
  ): Promise<Array<CrmActivity & { createdBy?: User }>> {
    const results = await db
      .select({
        ...getTableColumns(crmActivities),
        createdBy: {
          id: users.id,
          firstName: users.firstName,
          lastName: users.lastName,
          email: users.email,
        },
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
        ...getTableColumns(crmActivities),
        createdBy: {
          id: users.id,
          firstName: users.firstName,
          lastName: users.lastName,
          email: users.email,
        },
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
    dealId?: string;
  }): Promise<Array<CrmActivity & { contact?: CrmContact; deal?: CrmDeal; createdBy?: User }>> {
    const baseQuery = db
      .select({
        ...getTableColumns(crmActivities),
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
        },
      })
      .from(crmActivities)
      .leftJoin(crmContacts, eq(crmActivities.contactId, crmContacts.id))
      .leftJoin(crmDeals, eq(crmActivities.dealId, crmDeals.id))
      .leftJoin(users, eq(crmActivities.createdByUserId, users.id));

    const conditions: SQL[] = [];

    if (filters?.type) {
      conditions.push(eq(crmActivities.type, filters.type as any));
    }

    if (filters?.contactId) {
      conditions.push(eq(crmActivities.contactId, filters.contactId));
    }

    if (filters?.dealId) {
      conditions.push(eq(crmActivities.dealId, filters.dealId));
    }

    const activityQuery = conditions.length > 0 ? baseQuery.where(and(...conditions)) : baseQuery;
    const results = await activityQuery.orderBy(desc(crmActivities.createdAt));
    return results as Array<
      CrmActivity & { contact?: CrmContact; deal?: CrmDeal; createdBy?: User }
    >;
  }

  async createCrmEmailTemplate(templateData: InsertCrmEmailTemplate): Promise<CrmEmailTemplate> {
    const [template] = await db.insert(crmEmailTemplates).values(templateData).returning();
    return template;
  }

  async updateCrmEmailTemplate(
    id: string,
    updates: Partial<CrmEmailTemplate>
  ): Promise<CrmEmailTemplate> {
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
    const [template] = await db
      .select()
      .from(crmEmailTemplates)
      .where(eq(crmEmailTemplates.id, id));
    return template;
  }

  async getAllCrmEmailTemplates(
    category?: string
  ): Promise<Array<CrmEmailTemplate & { createdBy?: User }>> {
    const baseQuery = db
      .select({
        ...getTableColumns(crmEmailTemplates),
        createdBy: {
          id: users.id,
          firstName: users.firstName,
          lastName: users.lastName,
          email: users.email,
        },
      })
      .from(crmEmailTemplates)
      .leftJoin(users, eq(crmEmailTemplates.createdByUserId, users.id));

    const conditions: SQL[] = [eq(crmEmailTemplates.isActive, true)];
    if (category) conditions.push(eq(crmEmailTemplates.category, category));

    const results = await baseQuery.where(and(...conditions)).orderBy(crmEmailTemplates.name);

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
        ...getTableColumns(crmPipelines),
        createdBy: {
          id: users.id,
          firstName: users.firstName,
          lastName: users.lastName,
          email: users.email,
        },
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
    const conditions: SQL[] = [];

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

    const results = await db
      .select()
      .from(dailyDeals)
      .where(conditions.length ? and(...conditions) : sql`true`)
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
}
