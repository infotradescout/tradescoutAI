import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { conversations } from "@shared/schema";

const fixture = vi.hoisted(() => ({
  database: null as import("@electric-sql/pglite").PGlite | null,
}));
vi.mock("../db", async () => {
  const { PGlite } = await import("@electric-sql/pglite");
  const { drizzle } = await import("drizzle-orm/pglite");
  fixture.database = new PGlite();
  return { db: drizzle(fixture.database) };
});
import { db } from "../db";
import {
  canAccessConversation,
  conversationParticipantSql,
  conversationProviderParticipantSql,
  resolveConversationProviderUserId,
  resolveConversationProviderIdentity,
} from "../services/conversationParticipants";

beforeAll(async () => {
  await fixture.database!.exec(`
    CREATE TABLE users (id text PRIMARY KEY, first_name text, last_name text);
    CREATE TABLE contractors (id text PRIMARY KEY, user_id text, company_name text);
    CREATE TABLE conversations (id text PRIMARY KEY, homeowner_id text NOT NULL, contractor_id text NOT NULL);
  `);
});
beforeEach(async () => {
  await fixture.database!.exec(`
    TRUNCATE conversations, contractors, users;
    INSERT INTO users (id) VALUES ('homeowner'), ('provider-owner'), ('business-user'), ('worker-user'), ('stranger'), ('operator');
    INSERT INTO contractors (id, user_id) VALUES ('contractor-profile', 'provider-owner');
    INSERT INTO conversations VALUES
      ('contractor-thread', 'homeowner', 'contractor-profile'),
      ('business-thread', 'homeowner', 'business-user'),
      ('worker-thread', 'homeowner', 'worker-user');
  `);
});
afterAll(async () => {
  await fixture.database?.close();
});

async function listedFor(userId: string): Promise<string[]> {
  const rows = await db
    .select({ id: conversations.id })
    .from(conversations)
    .where(conversationParticipantSql(conversations, userId))
    .orderBy(conversations.id);
  return rows.map((row: { id: string }) => row.id);
}

describe("canonical conversation participant identity", () => {
  it("displays the owned contractor company or direct account name without guessing missing identities", async () => {
    await fixture.database!.exec(`
      UPDATE contractors SET company_name = 'Verified fixture business';
      UPDATE users SET first_name = 'Direct', last_name = 'Responder' WHERE id = 'business-user';
    `);
    expect(await resolveConversationProviderIdentity("contractor-profile")).toEqual({
      userId: "provider-owner",
      displayName: "Verified fixture business",
    });
    expect(await resolveConversationProviderIdentity("business-user")).toEqual({
      userId: "business-user",
      displayName: "Direct Responder",
    });
    expect(await resolveConversationProviderIdentity("missing")).toBeNull();
    await fixture.database!.exec("INSERT INTO users (id) VALUES ('contractor-profile')");
    expect(await resolveConversationProviderIdentity("contractor-profile")).toBeNull();
  });
  it("keeps provider-only listings separate from the same account's requester conversations", async () => {
    const onlyProvider = async (userId: string) =>
      (
        await db
          .select({ id: conversations.id })
          .from(conversations)
          .where(conversationProviderParticipantSql(conversations.contractorId, userId))
      ).map((row) => row.id);
    expect(await onlyProvider("homeowner")).toEqual([]);
    expect(await onlyProvider("provider-owner")).toEqual(["contractor-thread"]);
  });
  it("maps a contractor profile key to the actual account for both list and detail access", async () => {
    expect(await resolveConversationProviderUserId("contractor-profile")).toBe("provider-owner");
    expect(await listedFor("provider-owner")).toEqual(["contractor-thread"]);
    expect(await canAccessConversation("contractor-thread", "provider-owner")).toBe(true);
    expect(await canAccessConversation("contractor-thread", "contractor-profile")).toBe(false);
  });

  it.each(["business", "worker"])("supports the existing direct %s account key", async (kind) => {
    expect(await resolveConversationProviderUserId(`${kind}-user`)).toBe(`${kind}-user`);
    expect(await canAccessConversation(`${kind}-thread`, `${kind}-user`)).toBe(true);
    expect(await listedFor(`${kind}-user`)).toEqual([`${kind}-thread`]);
  });

  it("preserves the explicit homeowner and rejects unrelated accounts or an operator role surrogate", async () => {
    expect(await listedFor("homeowner")).toEqual([
      "business-thread",
      "contractor-thread",
      "worker-thread",
    ]);
    for (const account of ["stranger", "operator", "missing-user", ""]) {
      expect(await listedFor(account)).toEqual([]);
      expect(await canAccessConversation("contractor-thread", account)).toBe(false);
    }
    expect(await canAccessConversation("missing-thread", "provider-owner")).toBe(false);
  });

  it("fails closed for both candidate providers when a profile key is also another account's ID", async () => {
    await fixture.database!.exec("INSERT INTO users (id) VALUES ('contractor-profile')");
    expect(await resolveConversationProviderUserId("contractor-profile")).toBeNull();
    for (const account of ["provider-owner", "contractor-profile"]) {
      expect(await canAccessConversation("contractor-thread", account)).toBe(false);
      expect(await listedFor(account)).toEqual([]);
    }
    expect(await canAccessConversation("contractor-thread", "homeowner")).toBe(true);
  });

  it("allows a shared profile/account key only when both identify the same account", async () => {
    await fixture.database!.exec(
      "INSERT INTO contractors (id, user_id) VALUES ('business-user', 'business-user')"
    );
    expect(await resolveConversationProviderUserId("business-user")).toBe("business-user");
    expect(await canAccessConversation("business-thread", "business-user")).toBe(true);
  });

  it.each([null, "deleted-owner"])(
    "does not reinterpret a claimed profile key with missing owner %s as a direct account",
    async (owner) => {
      await fixture.database!.query(
        "INSERT INTO contractors (id, user_id) VALUES ('business-user', $1)",
        [owner]
      );
      expect(await resolveConversationProviderUserId("business-user")).toBeNull();
      expect(await canAccessConversation("business-thread", "business-user")).toBe(false);
    }
  );

  it("rejects the owner of a different contractor profile", async () => {
    await fixture.database!.exec(
      "INSERT INTO contractors (id, user_id) VALUES ('other-profile', 'stranger')"
    );
    expect(await resolveConversationProviderUserId("other-profile")).toBe("stranger");
    expect(await canAccessConversation("contractor-thread", "stranger")).toBe(false);
  });

  it("rechecks current ownership and account existence rather than caching authority", async () => {
    expect(await canAccessConversation("contractor-thread", "provider-owner")).toBe(true);
    await fixture.database!.exec(
      "UPDATE contractors SET user_id = 'stranger' WHERE id = 'contractor-profile'"
    );
    expect(await canAccessConversation("contractor-thread", "provider-owner")).toBe(false);
    expect(await canAccessConversation("contractor-thread", "stranger")).toBe(true);
    await fixture.database!.exec("DELETE FROM users WHERE id = 'stranger'");
    expect(await resolveConversationProviderUserId("contractor-profile")).toBeNull();
    expect(await canAccessConversation("contractor-thread", "stranger")).toBe(false);
  });

  it("handles missing and hostile identifier input as data without matching another account", async () => {
    for (const key of ["", "  ", "missing-profile", "' OR TRUE --"]) {
      expect(await resolveConversationProviderUserId(key)).toBeNull();
      expect(await listedFor(key)).toEqual([]);
    }
    expect(await canAccessConversation("' OR TRUE --", "homeowner")).toBe(false);
  });
});
