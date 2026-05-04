import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { db } from "../db";
import {
  homeownerAssociations,
  hoaMembers,
  hoaVotes,
  hoaVoteResponses,
  hoaFinancialRecords,
  users,
} from "../../shared/schema";
import { storage } from "../storage";
import { eq, inArray, and } from "drizzle-orm";

const hasTestDb = Boolean(process.env.TEST_DATABASE_URL);
const describeDb = hasTestDb ? describe : describe.skip;

describeDb("HOA API helpers", () => {
  const runId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const memberUserId = `hoa-member-user-${runId}`;
  const nonMemberUserId = `hoa-non-member-user-${runId}`;
  const hoaName = `Test HOA ${runId}`;
  const voteTitle = `Test HOA Vote ${runId}`;
  let hoaId: string;
  let voteId: string;

  async function cleanupFixtures() {
    await db
      .delete(hoaVoteResponses)
      .where(inArray(hoaVoteResponses.userId, [memberUserId, nonMemberUserId]));
    await db.delete(hoaVotes).where(eq(hoaVotes.title, voteTitle));
    await db.delete(hoaMembers).where(inArray(hoaMembers.userId, [memberUserId, nonMemberUserId]));
    if (hoaId) {
      await db.delete(hoaFinancialRecords).where(eq(hoaFinancialRecords.hoaId, hoaId));
      await db.delete(homeownerAssociations).where(eq(homeownerAssociations.id, hoaId));
    }
    await db.delete(homeownerAssociations).where(eq(homeownerAssociations.name, hoaName));
    await db.delete(users).where(inArray(users.id, [memberUserId, nonMemberUserId]));
  }

  beforeAll(async () => {
    await cleanupFixtures();

    // Seed users
    await db.insert(users).values({
      id: memberUserId,
      email: `hoa-member-${runId}@example.com`,
      firstName: "HOA",
      lastName: "Member",
    } as any);

    await db.insert(users).values({
      id: nonMemberUserId,
      email: `hoa-non-member-${runId}@example.com`,
      firstName: "HOA",
      lastName: "NonMember",
    } as any);

    // Seed HOA
    const [hoa] = await db
      .insert(homeownerAssociations)
      .values({
        name: hoaName,
        address: "123 Test St",
        city: "Testville",
        state: "TX",
        countyFips: "00101",
        totalUnits: 10,
      } as any)
      .returning();

    hoaId = hoa.id;

    // Seed member
    await db.insert(hoaMembers).values({
      hoaId,
      userId: memberUserId,
      role: "member",
      inGoodStanding: true,
    } as any);

    // Seed a vote
    const [vote] = await db
      .insert(hoaVotes)
      .values({
        hoaId,
        title: voteTitle,
        description: "Test vote description",
        voteType: "rule_change",
        createdBy: memberUserId,
        startDate: new Date(Date.now() - 60 * 60 * 1000),
        endDate: new Date(Date.now() + 60 * 60 * 1000),
        requiredQuorum: 1,
        status: "active",
      } as any)
      .returning();

    voteId = vote.id;
  });

  afterAll(async () => {
    await cleanupFixtures();
  });

  it("getHoaForUser returns memberships for member user", async () => {
    const memberships = await (storage as any).getHoaForUser(memberUserId);
    expect(memberships.length).toBeGreaterThan(0);
    const membership = memberships.find((m: any) => m.hoaId === hoaId);
    expect(membership).toBeDefined();
    expect(membership.hoaName).toBe(hoaName);
    expect(membership.groupType).toBe("hoa");
  });

  it("getHoaForUser returns empty for non-member", async () => {
    const memberships = await (storage as any).getHoaForUser(nonMemberUserId);
    expect(memberships.length).toBe(0);
  });

  it("getHoaDashboard returns basic metrics", async () => {
    const dashboard = await (storage as any).getHoaDashboard(hoaId);
    expect(dashboard).toBeTruthy();
    expect(dashboard!.hoaId).toBe(hoaId);
    expect(typeof dashboard!.memberCount).toBe("number");
    expect(dashboard!.groupType).toBe("hoa");
  });

  it("getHoaVotesForUser marks hasVoted after submit", async () => {
    let votes = await (storage as any).getHoaVotesForUser(hoaId, memberUserId);
    const vote = votes.find((v: any) => v.id === voteId);
    expect(vote).toBeDefined();
    expect(vote!.hasVoted).toBeFalsy();

    await (storage as any).submitHOAVote(memberUserId, voteId, "for");

    votes = await (storage as any).getHoaVotesForUser(hoaId, memberUserId);
    const updated = votes.find((v: any) => v.id === voteId);
    expect(updated).toBeDefined();
    expect(updated!.hasVoted).toBeTruthy();
  });

  it("recordHoaFeePayment updates current month's financials", async () => {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() + 1;

    await db
      .delete(hoaFinancialRecords)
      .where(
        and(
          eq(hoaFinancialRecords.hoaId, hoaId),
          eq(hoaFinancialRecords.year, year),
          eq(hoaFinancialRecords.month, month)
        )
      );

    await (storage as any).recordHoaFeePayment(hoaId, 150);

    let [record] = await db
      .select()
      .from(hoaFinancialRecords)
      .where(
        and(
          eq(hoaFinancialRecords.hoaId, hoaId),
          eq(hoaFinancialRecords.year, year),
          eq(hoaFinancialRecords.month, month)
        )
      );

    expect(record).toBeTruthy();
    expect(Number(record.totalRevenue)).toBeCloseTo(150);
    expect(Number(record.reserves)).toBeCloseTo(150);
    expect(Number(record.outstandingFees)).toBe(0);

    await (storage as any).recordHoaFeePayment(hoaId, 50);

    [record] = await db
      .select()
      .from(hoaFinancialRecords)
      .where(
        and(
          eq(hoaFinancialRecords.hoaId, hoaId),
          eq(hoaFinancialRecords.year, year),
          eq(hoaFinancialRecords.month, month)
        )
      );

    expect(Number(record.totalRevenue)).toBeCloseTo(200);
    expect(Number(record.reserves)).toBeCloseTo(200);
  });
});
