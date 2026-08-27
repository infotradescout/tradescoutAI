import fs from "fs";
import path from "path";
import { runtimePaths } from "../runtimePaths";

export interface CacheOverride {
  id: string;
  type: "response" | "fact" | "county" | "local_guide" | "contractor" | "marketplace";
  key: string;
  value: string;
  county?: string;
  state?: string;
  createdBy: string;
  createdAt: Date;
  expiresAt?: Date;
}

export interface CacheStats {
  totalEntries: number;
  byType: Record<string, number>;
  lastRefresh: Date;
  healthy: boolean;
}

// ============================================================================
// CACHE MANAGEMENT
// ============================================================================

const MANUAL_CACHE_DIR = runtimePaths.scoutManualCache;

// Ensure cache directory exists
if (!fs.existsSync(MANUAL_CACHE_DIR)) {
  fs.mkdirSync(MANUAL_CACHE_DIR, { recursive: true });
}

export async function getCacheStats(): Promise<CacheStats> {
  try {
    // Count entries in cache directory
    const files = fs.readdirSync(MANUAL_CACHE_DIR);
    const cacheFiles = files.filter((f) => f.endsWith(".json"));

    const stats: CacheStats = {
      totalEntries: cacheFiles.length,
      byType: {},
      lastRefresh: new Date(),
      healthy: true,
    };

    // Count by type
    for (const file of cacheFiles) {
      const type = file.split("_")[0];
      stats.byType[type] = (stats.byType[type] || 0) + 1;
    }

    return stats;
  } catch (error) {
    console.error("Error getting cache stats:", error);
    return {
      totalEntries: 0,
      byType: {},
      lastRefresh: new Date(),
      healthy: false,
    };
  }
}

export async function getCacheOverride(id: string): Promise<CacheOverride | null> {
  try {
    const filePath = path.join(MANUAL_CACHE_DIR, `${id}.json`);
    
    if (!fs.existsSync(filePath)) {
      return null;
    }

    const content = fs.readFileSync(filePath, "utf-8");
    return JSON.parse(content);
  } catch (error) {
    console.error("Error getting cache override:", error);
    return null;
  }
}

export async function createCacheOverride(
  override: Omit<CacheOverride, "id" | "createdAt">
): Promise<CacheOverride> {
  try {
    const id = `${override.type}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const newOverride: CacheOverride = {
      ...override,
      id,
      createdAt: new Date(),
    };

    const filePath = path.join(MANUAL_CACHE_DIR, `${id}.json`);
    fs.writeFileSync(filePath, JSON.stringify(newOverride, null, 2));

    console.log(`Created cache override: ${id}`);
    return newOverride;
  } catch (error) {
    console.error("Error creating cache override:", error);
    throw error;
  }
}

export async function updateCacheOverride(
  id: string,
  updates: Partial<Omit<CacheOverride, "id" | "createdAt">>
): Promise<CacheOverride | null> {
  try {
    const existing = await getCacheOverride(id);
    if (!existing) {
      return null;
    }

    const updated: CacheOverride = {
      ...existing,
      ...updates,
    };

    const filePath = path.join(MANUAL_CACHE_DIR, `${id}.json`);
    fs.writeFileSync(filePath, JSON.stringify(updated, null, 2));

    console.log(`Updated cache override: ${id}`);
    return updated;
  } catch (error) {
    console.error("Error updating cache override:", error);
    return null;
  }
}

export async function deleteCacheOverride(id: string): Promise<boolean> {
  try {
    const filePath = path.join(MANUAL_CACHE_DIR, `${id}.json`);
    
    if (!fs.existsSync(filePath)) {
      return false;
    }

    fs.unlinkSync(filePath);
    console.log(`Deleted cache override: ${id}`);
    return true;
  } catch (error) {
    console.error("Error deleting cache override:", error);
    return false;
  }
}

export async function listCacheOverrides(type?: string): Promise<CacheOverride[]> {
  try {
    const files = fs.readdirSync(MANUAL_CACHE_DIR);
    const overrides: CacheOverride[] = [];

    for (const file of files) {
      if (!file.endsWith(".json")) continue;

      const content = fs.readFileSync(path.join(MANUAL_CACHE_DIR, file), "utf-8");
      const override = JSON.parse(content) as CacheOverride;

      if (!type || override.type === type) {
        overrides.push(override);
      }
    }

    return overrides;
  } catch (error) {
    console.error("Error listing cache overrides:", error);
    return [];
  }
}

// ============================================================================
// CACHE OPERATIONS
// ============================================================================

export async function clearCacheByType(type: string): Promise<number> {
  try {
    const overrides = await listCacheOverrides(type);
    let cleared = 0;

    for (const override of overrides) {
      if (await deleteCacheOverride(override.id)) {
        cleared++;
      }
    }

    console.log(`Cleared ${cleared} cache entries of type ${type}`);
    return cleared;
  } catch (error) {
    console.error("Error clearing cache by type:", error);
    return 0;
  }
}

export async function clearAllCache(): Promise<number> {
  try {
    const files = fs.readdirSync(MANUAL_CACHE_DIR);
    let cleared = 0;

    for (const file of files) {
      if (file.endsWith(".json") && file !== "system_prompt.md") {
        const filePath = path.join(MANUAL_CACHE_DIR, file);
        try {
          fs.unlinkSync(filePath);
          cleared++;
        } catch (err) {
          console.error(`Failed to delete ${file}:`, err);
        }
      }
    }

    console.log(`Cleared ${cleared} total cache entries`);
    return cleared;
  } catch (error) {
    console.error("Error clearing all cache:", error);
    return 0;
  }
}

export async function getCacheByKey(key: string): Promise<CacheOverride | null> {
  try {
    const overrides = await listCacheOverrides();
    return overrides.find((o) => o.key === key) || null;
  } catch (error) {
    console.error("Error getting cache by key:", error);
    return null;
  }
}

export async function searchCache(query: string): Promise<CacheOverride[]> {
  try {
    const overrides = await listCacheOverrides();
    const lowerQuery = query.toLowerCase();

    return overrides.filter(
      (o) =>
        o.key.toLowerCase().includes(lowerQuery) ||
        o.value.toLowerCase().includes(lowerQuery) ||
        (o.county && o.county.toLowerCase().includes(lowerQuery))
    );
  } catch (error) {
    console.error("Error searching cache:", error);
    return [];
  }
}

export async function expireOldCache(maxAgeMs: number): Promise<number> {
  try {
    const overrides = await listCacheOverrides();
    let expired = 0;
    const now = new Date();

    for (const override of overrides) {
      const age = now.getTime() - override.createdAt.getTime();
      if (age > maxAgeMs) {
        if (await deleteCacheOverride(override.id)) {
          expired++;
        }
      }
    }

    console.log(`Expired ${expired} old cache entries`);
    return expired;
  } catch (error) {
    console.error("Error expiring old cache:", error);
    return 0;
  }
}

// ============================================================================
// CACHE EXPORT / IMPORT
// ============================================================================

export async function exportCache(filePath: string): Promise<boolean> {
  try {
    const overrides = await listCacheOverrides();
    const exportData = {
      exportDate: new Date().toISOString(),
      count: overrides.length,
      overrides,
    };

    fs.writeFileSync(filePath, JSON.stringify(exportData, null, 2));
    console.log(`Exported cache to ${filePath}`);
    return true;
  } catch (error) {
    console.error("Error exporting cache:", error);
    return false;
  }
}

export async function importCache(filePath: string, merge: boolean = false): Promise<number> {
  try {
    if (!fs.existsSync(filePath)) {
      throw new Error(`Import file not found: ${filePath}`);
    }

    const content = fs.readFileSync(filePath, "utf-8");
    const importData = JSON.parse(content);

    if (!merge) {
      await clearAllCache();
    }

    let imported = 0;
    for (const override of importData.overrides) {
      try {
        await createCacheOverride({
          type: override.type,
          key: override.key,
          value: override.value,
          county: override.county,
          state: override.state,
          createdBy: "import",
        });
        imported++;
      } catch (err) {
        console.error("Error importing override:", err);
      }
    }

    console.log(`Imported ${imported} cache entries from ${filePath}`);
    return imported;
  } catch (error) {
    console.error("Error importing cache:", error);
    return 0;
  }
}
