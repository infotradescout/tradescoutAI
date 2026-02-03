import { Router } from "express";
import { z } from "zod";
import { getCoverageForCounty } from "../services/geographicCoverage";

export const geographicCoverageRouter = Router();

geographicCoverageRouter.get("/county/:fips", async (req, res) => {
  try {
    const fips = z
      .string()
      .regex(/^\d{5}$/)
      .parse(String(req.params?.fips || ""));

    const row = await getCoverageForCounty(fips);

    if (!row) {
      // County not seeded in DB yet.
      return res.status(404).json({ message: "County not found" });
    }

    res.json(row);
  } catch (error: unknown) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: "Invalid county FIPS" });
    }
    console.error("Error fetching geographic coverage for county:", error);
    res.status(500).json({ message: "Failed to fetch county coverage" });
  }
});
