import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { deleteSavedScoutTaskAtomically } from "../services/scoutSavedTaskDeletion";

const postgres = new PGlite();
const database = drizzle(postgres);
const owner = "synthetic-owner";
const taskId = "synthetic-scout-task";

async function storedState() {
  const conversation = await postgres.query<{ id: string }>(
    "SELECT id FROM scout_conversations WHERE id = $1",
    [taskId]
  );
  const account = await postgres.query<{ preferences: { theme?: string; scout?: { savedThreads?: Array<{ id: string }> } } }>(
    "SELECT preferences FROM users WHERE id = $1",
    [owner]
  );
  return {
    conversationIds: conversation.rows.map((row) => row.id),
    preferences: account.rows[0].preferences,
  };
}

beforeAll(async () => {
  await postgres.exec(`
    CREATE TABLE users (
      id varchar PRIMARY KEY,
      preferences jsonb,
      updated_at timestamp
    );
    CREATE TABLE scout_conversations (
      id varchar PRIMARY KEY,
      user_id varchar NOT NULL
    );
  `);
});

beforeEach(async () => {
  await postgres.exec("ALTER TABLE users DROP CONSTRAINT IF EXISTS keep_legacy_saved_task");
  await postgres.exec("TRUNCATE scout_conversations, users");
  await postgres.query(
    "INSERT INTO users (id, preferences) VALUES ($1, $2::jsonb)",
    [owner, JSON.stringify({ theme: "dark", scout: { savedThreads: [{ id: taskId }] } })]
  );
  await postgres.query(
    "INSERT INTO scout_conversations (id, user_id) VALUES ($1, $2)",
    [taskId, owner]
  );
});

afterAll(async () => {
  await postgres.close();
});

describe("Scout saved task deletion", () => {
  it("rolls back the conversation deletion when legacy preference removal fails", async () => {
    await postgres.exec(`
      ALTER TABLE users ADD CONSTRAINT keep_legacy_saved_task
      CHECK (jsonb_array_length(preferences->'scout'->'savedThreads') > 0)
    `);

    await expect(deleteSavedScoutTaskAtomically(database, owner, taskId)).rejects.toThrow();
    expect(await storedState()).toEqual({
      conversationIds: [taskId],
      preferences: { theme: "dark", scout: { savedThreads: [{ id: taskId }] } },
    });
  });

  it("removes both saved copies and preserves unrelated preferences on success", async () => {
    await deleteSavedScoutTaskAtomically(database, owner, taskId);
    expect(await storedState()).toEqual({
      conversationIds: [],
      preferences: { theme: "dark", scout: { savedThreads: [] } },
    });
  });
});
