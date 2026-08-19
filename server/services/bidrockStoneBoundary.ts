import type { Express, NextFunction, Request, Response } from "express";
import { BIDROCK_STONE_MATERIAL_FAMILIES } from "@shared/bidrock";
import { pool } from "../db";
import { ensureBidRockTables } from "./bidrockService";

const quotedStoneFamilies = BIDROCK_STONE_MATERIAL_FAMILIES.map(
  (family) => `'${family.replace(/'/g, "''")}'`
).join(", ");

const BIDROCK_STONE_BOUNDARY_DDL = `
CREATE OR REPLACE FUNCTION enforce_bidrock_stone_only()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.source_kind = 'stone_core' THEN
    RETURN NEW;
  END IF;

  IF NEW.material_family IN (${quotedStoneFamilies}) THEN
    RETURN NEW;
  END IF;

  IF NEW.source_profile_slug = 'jw-stone' AND NEW.material_family = 'unconfirmed' THEN
    RETURN NEW;
  END IF;

  NEW.status := 'archived';
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS bidrock_stone_only_trigger ON bidrock_listings;
CREATE TRIGGER bidrock_stone_only_trigger
BEFORE INSERT OR UPDATE OF source_kind, source_profile_slug, material_family, status
ON bidrock_listings
FOR EACH ROW
EXECUTE FUNCTION enforce_bidrock_stone_only();

UPDATE bidrock_listings
   SET status = 'archived',
       updated_at = NOW()
 WHERE source_kind = 'profile_inventory'
   AND NOT (
     material_family IN (${quotedStoneFamilies})
     OR (source_profile_slug = 'jw-stone' AND material_family = 'unconfirmed')
   );
`;

let ensurePromise: Promise<void> | null = null;

export async function ensureBidRockStoneBoundary(): Promise<void> {
  if (!ensurePromise) {
    ensurePromise = (async () => {
      await ensureBidRockTables();
      await pool.query(BIDROCK_STONE_BOUNDARY_DDL);
    })().catch((error) => {
      ensurePromise = null;
      throw error;
    });
  }
  return ensurePromise;
}

export function registerBidRockStoneBoundary(app: Express): void {
  const middleware = async (_req: Request, res: Response, next: NextFunction) => {
    try {
      await ensureBidRockStoneBoundary();
      next();
    } catch (error) {
      console.error("[bidrock] stone boundary setup failed", error);
      res.status(503).json({ message: "BidRock is temporarily unavailable." });
    }
  };

  app.use("/bidrock", middleware);
  app.use("/api/bidrock", middleware);
}
