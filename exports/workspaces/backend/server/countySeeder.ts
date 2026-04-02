import fetch from "node-fetch";
import { storage } from "./storage";
import type { InsertCounty } from "../shared/schema";

const NATIONAL_COUNTY_URL =
  "https://www2.census.gov/geo/docs/reference/codes/files/national_county.txt";

/**
 * Seed the counties table for a given state code using the U.S. Census
 * national_county.txt reference file. This ensures we have full coverage for
 * all 50 states (plus D.C. / territories) without hard-coding every county.
 */
export async function seedCountiesForState(stateCode: string) {
  const upper = stateCode.toUpperCase();

  const response = await fetch(NATIONAL_COUNTY_URL);
  if (!response.ok) {
    throw new Error(
      `Failed to fetch national_county.txt for seeding counties: ${response.status} ${response.statusText}`
    );
  }

  const text = await response.text();
  const lines = text.split(/\r?\n/);

  const countiesToInsert: InsertCounty[] = [];

  for (const line of lines) {
    if (!line) continue;
    const parts = line.split(",");
    if (parts.length < 4) continue;

    const [abbr, stateFp, countyFp, name] = parts as [
      string,
      string,
      string,
      string
    ];

    if (abbr !== upper) continue;

    const fips = `${stateFp}${countyFp}`;

    countiesToInsert.push({
      name: name.trim(),
      fips,
      stateCode: upper,
    });
  }

  if (countiesToInsert.length === 0) {
    throw new Error(`No counties found in national_county.txt for state ${upper}`);
  }

  // Upsert all counties for this state so we only need to hit the
  // Census dataset once per environment.
  for (const county of countiesToInsert) {
    // Fire-and-forget upserts; individual failures are logged but do not stop the loop.
    try {
      await storage.upsertCounty(county);
    } catch (error) {
      console.error("Failed to upsert county during seeding", county, error);
    }
  }

  // Return the freshly seeded counties from the database, matching the
  // normal shape used elsewhere in the app.
  return storage.getCounties(upper);
}
