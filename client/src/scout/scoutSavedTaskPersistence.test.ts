import { describe, expect, it } from "vitest";
import {
  deleteSavedTask,
  mergeSavedTasks,
  withoutSavedTaskPreference,
} from "@shared/scoutSavedTaskPersistence";

const task = { id: "thread_example_123", updatedAt: "2026-09-24T00:00:00.000Z" };

describe("saved Scout task deletion", () => {
  it("keeps the saved task through a failed remote DELETE and reload", async () => {
    let local = [task];
    const server = [task];
    const preferences = { scout: { savedThreads: [task] } };

    await expect(
      deleteSavedTask({
        taskId: task.id,
        deleteRemote: async () => ({ ok: false }),
        readLocal: () => local,
        writeLocal: (next) => { local = next; return true; },
      })
    ).rejects.toThrow("not confirmed");

    const reloaded = mergeSavedTasks(
      server,
      mergeSavedTasks(local, preferences.scout.savedThreads, 8),
      8
    );
    expect(local).toEqual([task]);
    expect(reloaded).toEqual([task]);
  });

  it("waits for an in-flight save, then deletes both server and legacy preference copies", async () => {
    let local = [task];
    let server = [task];
    let preferences: Record<string, unknown> = {
      theme: "dark",
      scout: { savedThreads: [task], mode: "guide" },
    };
    const deletedIds = new Set<string>();
    const events: string[] = [];
    let finishSave!: () => void;
    const save = new Promise<void>((resolve) => { finishSave = resolve; });

    const deletion = deleteSavedTask({
      taskId: task.id,
      waitForSaves: () => save,
      deleteRemote: async () => {
        events.push("delete");
        server = [];
        preferences = withoutSavedTaskPreference(preferences, task.id)!;
        return { ok: true };
      },
      onRemoteDeleted: () => deletedIds.add(task.id),
      readLocal: () => local,
      writeLocal: (next) => { local = next; return true; },
    });

    await Promise.resolve();
    expect(events).toEqual([]);
    finishSave();
    await deletion;

    expect(events).toEqual(["delete"]);
    expect(local).toEqual([]);
    expect(preferences).toEqual({
      theme: "dark",
      scout: { savedThreads: [], mode: "guide" },
    });
    const legacy = (preferences.scout as { savedThreads: typeof server }).savedThreads;
    expect(mergeSavedTasks(server, mergeSavedTasks(local, legacy, 8), 8)).toEqual([]);
    expect(mergeSavedTasks([task], local, 8, deletedIds)).toEqual([]);
  });

  it("retains a local task after a network error and deletes a guest task locally", async () => {
    let local = [task];
    await expect(
      deleteSavedTask({
        taskId: task.id,
        deleteRemote: async () => { throw new Error("network down"); },
        readLocal: () => local,
        writeLocal: (next) => { local = next; return true; },
      })
    ).rejects.toThrow("network down");
    expect(local).toEqual([task]);

    await deleteSavedTask({
      taskId: task.id,
      readLocal: () => local,
      writeLocal: (next) => { local = next; return true; },
    });
    expect(local).toEqual([]);
  });
});
