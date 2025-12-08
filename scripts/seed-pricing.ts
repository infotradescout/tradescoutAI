import { db } from "../src/db/drizzle-mock";
import { pricingData } from "@shared/schema";

// Sample pricing data for major counties and common trades
const PRICING_DATA = [
  // Los Angeles County, CA (FIPS: 06037)
  { service: "roofing", fips: "06037", baseLow: "8000", baseHigh: "25000" },
  { service: "plumbing", fips: "06037", baseLow: "500", baseHigh: "8000" },
  { service: "electrical", fips: "06037", baseLow: "300", baseHigh: "6500" },
  { service: "hvac", fips: "06037", baseLow: "2500", baseHigh: "12000" },
  { service: "painting", fips: "06037", baseLow: "800", baseHigh: "8000" },
  { service: "flooring", fips: "06037", baseLow: "1500", baseHigh: "9500" },
  { service: "general-contractor", fips: "06037", baseLow: "5000", baseHigh: "50000" },
  { service: "landscaping", fips: "06037", baseLow: "500", baseHigh: "12000" },

  // Orange County, CA (FIPS: 06059)
  { service: "roofing", fips: "06059", baseLow: "7500", baseHigh: "23000" },
  { service: "plumbing", fips: "06059", baseLow: "450", baseHigh: "7500" },
  { service: "electrical", fips: "06059", baseLow: "280", baseHigh: "6200" },
  { service: "hvac", fips: "06059", baseLow: "2300", baseHigh: "11500" },

  // Cook County, IL (FIPS: 17031) - Chicago
  { service: "roofing", fips: "17031", baseLow: "6500", baseHigh: "20000" },
  { service: "plumbing", fips: "17031", baseLow: "400", baseHigh: "7000" },
  { service: "electrical", fips: "17031", baseLow: "250", baseHigh: "5800" },
  { service: "hvac", fips: "17031", baseLow: "2200", baseHigh: "10500" },

  // Harris County, TX (FIPS: 48201) - Houston
  { service: "roofing", fips: "48201", baseLow: "5800", baseHigh: "18000" },
  { service: "plumbing", fips: "48201", baseLow: "350", baseHigh: "6200" },
  { service: "electrical", fips: "48201", baseLow: "220", baseHigh: "5200" },
  { service: "hvac", fips: "48201", baseLow: "2000", baseHigh: "9800" },

  // Miami-Dade County, FL (FIPS: 12086)
  { service: "roofing", fips: "12086", baseLow: "7000", baseHigh: "22000" },
  { service: "plumbing", fips: "12086", baseLow: "400", baseHigh: "7200" },
  { service: "electrical", fips: "12086", baseLow: "275", baseHigh: "6000" },
  { service: "hvac", fips: "12086", baseLow: "2300", baseHigh: "11000" },

  // King County, WA (FIPS: 53033) - Seattle
  { service: "roofing", fips: "53033", baseLow: "7500", baseHigh: "24000" },
  { service: "plumbing", fips: "53033", baseLow: "500", baseHigh: "8200" },
  { service: "electrical", fips: "53033", baseLow: "320", baseHigh: "7000" },
  { service: "hvac", fips: "53033", baseLow: "2800", baseHigh: "12500" },
];

async function seedPricing() {
  try {
    console.log("Starting pricing data seeding...");
    
    // Clear existing pricing data
    await db.delete(pricingData);
    console.log("Cleared existing pricing data");
    
    // Insert pricing data
    await db.insert(pricingData).values(PRICING_DATA);
    console.log(`✅ Inserted ${PRICING_DATA.length} pricing records successfully!`);
    
    // Verify count
    const result = await db.select().from(pricingData);
    console.log(`Total pricing records in database: ${result.length}`);
    
  } catch (error) {
    console.error("❌ Error seeding pricing data:", error);
  } finally {
    process.exit(0);
  }
}

seedPricing();
