import fs from "node:fs";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { FeatureFlagRepository } from "../storage/repositories/feature-flags";

afterEach(() => vi.useRealTimers());

function createDatabase(rows: any[] = []) {
  const captures: Record<string, any> = {};
  const database = {
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        orderBy: vi.fn(async () => rows),
        where: vi.fn(async () => rows),
      })),
    })),
    insert: vi.fn(() => ({
      values: vi.fn((value: any) => {
        captures.insert = value;
        return { returning: vi.fn(async () => rows) };
      }),
    })),
    update: vi.fn(() => ({
      set: vi.fn((value: any) => {
        captures.update = value;
        return {
          where: vi.fn(() => ({ returning: vi.fn(async () => rows) })),
        };
      }),
    })),
    delete: vi.fn(() => ({ where: vi.fn(async () => undefined) })),
  };
  return { database, captures };
}

describe("feature flag repository behavior", () => {
  it("lists flags and returns lookup hits or misses", async () => {
    const hit = createDatabase([{ id: "flag-1", key: "scout" }]);
    expect(await new FeatureFlagRepository(hit.database).getFeatureFlags()).toEqual([
      { id: "flag-1", key: "scout" },
    ]);
    expect(await new FeatureFlagRepository(hit.database).getFeatureFlag("scout")).toEqual({
      id: "flag-1",
      key: "scout",
    });
    expect(await new FeatureFlagRepository(createDatabase([]).database).getFeatureFlag("missing"))
      .toBeUndefined();
  });

  it("overwrites caller timestamps when creating", async () => {
    vi.useFakeTimers();
    const now = new Date("2026-08-27T17:00:00.000Z");
    vi.setSystemTime(now);
    const fake = createDatabase([{ id: "flag-1" }]);
    const repository = new FeatureFlagRepository(fake.database);
    const result = await repository.createFeatureFlag({
      key: "scout",
      createdAt: new Date(0),
      updatedAt: new Date(0),
    });
    expect(result).toEqual({ id: "flag-1" });
    expect(fake.captures.insert).toMatchObject({ key: "scout", createdAt: now, updatedAt: now });
  });

  it("overwrites updatedAt and preserves update misses", async () => {
    vi.useFakeTimers();
    const now = new Date("2026-08-27T17:05:00.000Z");
    vi.setSystemTime(now);
    const hit = createDatabase([{ id: "flag-1", enabled: true }]);
    expect(
      await new FeatureFlagRepository(hit.database).updateFeatureFlag("flag-1", {
        enabled: true,
        updatedAt: new Date(0),
      })
    ).toEqual({ id: "flag-1", enabled: true });
    expect(hit.captures.update).toMatchObject({ enabled: true, updatedAt: now });
    expect(
      await new FeatureFlagRepository(createDatabase([]).database).updateFeatureFlag("missing", {})
    ).toBeUndefined();
  });

  it("lets deletes of missing rows resolve", async () => {
    const fake = createDatabase([]);
    await expect(new FeatureFlagRepository(fake.database).deleteFeatureFlag("missing")).resolves
      .toBeUndefined();
    expect(fake.database.delete).toHaveBeenCalledTimes(1);
  });

  it.each([
    [undefined, undefined, false],
    [{ enabled: false }, undefined, false],
    [{ enabled: true, userRoles: [] }, "contractor", true],
    [{ enabled: true, userRoles: ["contractor"] }, "contractor", true],
    [{ enabled: true, userRoles: ["Contractor"] }, "contractor", false],
    [{ enabled: true, userRoles: ["admin"] }, undefined, true],
  ])("preserves enabled and exact role semantics", async (flag, role, expected) => {
    const repository = new FeatureFlagRepository(createDatabase(flag ? [flag] : []).database);
    expect(await repository.isFeatureEnabled("scout", role)).toBe(expected);
  });
});

describe("feature flag repository architecture", () => {
  it("is a leaf repository while DatabaseStorage retains all six methods", async () => {
    const root = fs.readFileSync(path.resolve("server/storage.ts"), "utf8");
    const repository = fs.readFileSync(
      path.resolve("server/storage/repositories/feature-flags.ts"),
      "utf8"
    );
    expect(repository).toContain('import { db } from "../../db";');
    expect(repository).not.toMatch(/from ["']\.\.\/\.\.\/storage["']/);
    expect(root).toContain("private readonly featureFlagRepository = new FeatureFlagRepository();");
    for (const method of [
      "getFeatureFlags",
      "getFeatureFlag",
      "createFeatureFlag",
      "updateFeatureFlag",
      "deleteFeatureFlag",
      "isFeatureEnabled",
    ]) {
      expect(root).toContain(`async ${method}(`);
      expect(root).toContain(`this.featureFlagRepository.${method}(`);
    }
    expect(root).not.toContain(".from(featureFlags)");

    const { DatabaseStorage, storage } = await import("../storage");
    expect(storage).toBeInstanceOf(DatabaseStorage);
    for (const method of [
      "getFeatureFlags",
      "getFeatureFlag",
      "createFeatureFlag",
      "updateFeatureFlag",
      "deleteFeatureFlag",
      "isFeatureEnabled",
    ]) {
      expect(typeof (storage as any)[method]).toBe("function");
    }
  });
});
