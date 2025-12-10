import { describe, it, expect, beforeAll } from "vitest";
import { db } from "../db";
import {
  homeownerAssociations,
  hoaMembers,
  hoaVotes,
  hoaVoteResponses,
  users,
} from "@shared/schema";
import { storage } from "../storage";
import { eq, inArray } from "drizzle-orm";

describe("HOA API helpers", () => {
  const memberUserId = "hoa-member-user";
  const nonMemberUserId = "hoa-non-member-user";
  let hoaId: string;
  let voteId: string;

  beforeAll(async () => {
    // Clean prior test data
    await db.delete(hoaVoteResponses).where(inArray(hoaVoteResponses.userId, [memberUserId, nonMemberUserId]));
    await db.delete(hoaVotes).where(eq(hoaVotes.title, "Test HOA Vote"));
    await db.delete(hoaMembers).where(inArray(hoaMembers.userId, [memberUserId, nonMemberUserId]));
    await db.delete(homeownerAssociations).where(eq(homeownerAssociations.name, "Test HOA"));
    await db.delete(users).where(inArray(users.id, [memberUserId, nonMemberUserId]));

    // Seed users
    await db.insert(users).values({
      id: memberUserId,
      email: "hoa-member@example.com",
      firstName: "HOA",
      lastName: "Member",
    } as any);

    await db.insert(users).values({
      id: nonMemberUserId,
      email: "hoa-non-member@example.com",
      firstName: "HOA",
      lastName: "NonMember",
    } as any);

    // Seed HOA
    const [hoa] = await db
      .insert(homeownerAssociations)
      .values({
        name: "Test HOA",
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
        title: "Test HOA Vote",
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

  it("getHoaForUser returns memberships for member user", async () => {
    const memberships = await (storage as any).getHoaForUser(memberUserId);
    expect(memberships.length).toBeGreaterThan(0);
    const membership = memberships.find((m: any) => m.hoaId === hoaId);
    expect(membership).toBeDefined();
    expect(membership.hoaName).toBe("Test HOA");
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
});
