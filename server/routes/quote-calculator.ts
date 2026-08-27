import type { Express } from "express";
import type { IStorage } from "../storage/contracts";

export type QuoteCalculatorStorage = Pick<IStorage, "getPricingData">;

export interface QuoteCalculatorDependencies {
  storage: QuoteCalculatorStorage;
}

export function registerQuoteCalculatorRoutes(
  app: Express,
  { storage }: QuoteCalculatorDependencies
) {
  app.get("/api/pricing/:service", async (req: any, res: any) => {
    try {
      const { service } = req.params;
      const { fips } = req.query;
      const pricingData = await storage.getPricingData(service, fips as string);
      res.json(pricingData);
    } catch (error: any) {
      console.error("Error fetching pricing data:", error);
      res.status(500).json({ message: "Failed to fetch pricing data" });
    }
  });

  app.post("/api/calculator", async (req: any, res: any) => {
    try {
      const { projectType, squareFootage, countyFips, urgency } = (req.body ?? {}) as any;
      const pricingData = await storage.getPricingData(projectType, countyFips);

      if (!pricingData || pricingData.length === 0) {
        const baseRates: Record<string, number> = {
          roofing: 15,
          "roof-replacement": 15,
          "roof-repair": 8,
          plumbing: 12,
          electrical: 10,
          hvac: 25,
          flooring: 12,
          "kitchen-remodel": 100,
          "bathroom-remodel": 85,
          painting: 6,
        };
        const baseRate = baseRates[projectType] || 20;
        const sqft = parseInt(squareFootage) || 1000;
        const baseLow = baseRate * sqft * 0.8;
        const baseHigh = baseRate * sqft * 1.2;
        const urgencyMultiplier = urgency === "urgent" ? 1.2 : urgency === "soon" ? 1.1 : 1.0;

        return res.json({
          low: Math.round(baseLow * urgencyMultiplier),
          high: Math.round(baseHigh * urgencyMultiplier),
          projectType,
          urgency: urgency || "planning",
          calculatedAt: new Date(),
        });
      }

      const pricing = pricingData[0];
      const sqft = parseInt(squareFootage) || 1000;
      const baseLow = pricing.baseLow ? parseInt(pricing.baseLow, 10) : 0;
      const baseHigh = pricing.baseHigh ? parseInt(pricing.baseHigh, 10) : 0;
      const low = Math.round((baseLow / 1000) * sqft);
      const high = Math.round((baseHigh / 1000) * sqft);
      const urgencyMultiplier = urgency === "urgent" ? 1.2 : urgency === "soon" ? 1.1 : 1.0;

      res.json({
        low: Math.round(low * urgencyMultiplier),
        high: Math.round(high * urgencyMultiplier),
        projectType,
        urgency: urgency || "planning",
        calculatedAt: new Date(),
      });
    } catch (error: any) {
      console.error("Error calculating estimate:", error);
      res.status(500).json({ message: "Failed to calculate estimate" });
    }
  });
}
