import { db } from '../server/db.js';
import { counties } from '../shared/schema.js';
import { eq } from 'drizzle-orm';

// Florida Counties - All 67 counties
const floridaCounties = [
  { name: "Alachua County", fips: "12001", stateCode: "FL" },
  { name: "Baker County", fips: "12003", stateCode: "FL" },
  { name: "Bay County", fips: "12005", stateCode: "FL" },
  { name: "Bradford County", fips: "12007", stateCode: "FL" },
  { name: "Brevard County", fips: "12009", stateCode: "FL" },
  { name: "Broward County", fips: "12011", stateCode: "FL" },
  { name: "Calhoun County", fips: "12013", stateCode: "FL" },
  { name: "Charlotte County", fips: "12015", stateCode: "FL" },
  { name: "Citrus County", fips: "12017", stateCode: "FL" },
  { name: "Clay County", fips: "12019", stateCode: "FL" },
  { name: "Collier County", fips: "12021", stateCode: "FL" },
  { name: "Columbia County", fips: "12023", stateCode: "FL" },
  { name: "Miami-Dade County", fips: "12025", stateCode: "FL" },
  { name: "DeSoto County", fips: "12027", stateCode: "FL" },
  { name: "Dixie County", fips: "12029", stateCode: "FL" },
  { name: "Duval County", fips: "12031", stateCode: "FL" },
  { name: "Escambia County", fips: "12033", stateCode: "FL" },
  { name: "Flagler County", fips: "12035", stateCode: "FL" },
  { name: "Franklin County", fips: "12037", stateCode: "FL" },
  { name: "Gadsden County", fips: "12039", stateCode: "FL" },
  { name: "Gilchrist County", fips: "12041", stateCode: "FL" },
  { name: "Glades County", fips: "12043", stateCode: "FL" },
  { name: "Gulf County", fips: "12045", stateCode: "FL" },
  { name: "Hamilton County", fips: "12047", stateCode: "FL" },
  { name: "Hardee County", fips: "12049", stateCode: "FL" },
  { name: "Hendry County", fips: "12051", stateCode: "FL" },
  { name: "Hernando County", fips: "12053", stateCode: "FL" },
  { name: "Highlands County", fips: "12055", stateCode: "FL" },
  { name: "Hillsborough County", fips: "12057", stateCode: "FL" },
  { name: "Holmes County", fips: "12059", stateCode: "FL" },
  { name: "Indian River County", fips: "12061", stateCode: "FL" },
  { name: "Jackson County", fips: "12063", stateCode: "FL" },
  { name: "Jefferson County", fips: "12065", stateCode: "FL" },
  { name: "Lafayette County", fips: "12067", stateCode: "FL" },
  { name: "Lake County", fips: "12069", stateCode: "FL" },
  { name: "Lee County", fips: "12071", stateCode: "FL" },
  { name: "Leon County", fips: "12073", stateCode: "FL" },
  { name: "Levy County", fips: "12075", stateCode: "FL" },
  { name: "Liberty County", fips: "12077", stateCode: "FL" },
  { name: "Madison County", fips: "12079", stateCode: "FL" },
  { name: "Manatee County", fips: "12081", stateCode: "FL" },
  { name: "Marion County", fips: "12083", stateCode: "FL" },
  { name: "Martin County", fips: "12085", stateCode: "FL" },
  { name: "Monroe County", fips: "12087", stateCode: "FL" },
  { name: "Nassau County", fips: "12089", stateCode: "FL" },
  { name: "Okaloosa County", fips: "12091", stateCode: "FL" },
  { name: "Okeechobee County", fips: "12093", stateCode: "FL" },
  { name: "Orange County", fips: "12095", stateCode: "FL" },
  { name: "Osceola County", fips: "12097", stateCode: "FL" },
  { name: "Palm Beach County", fips: "12099", stateCode: "FL" },
  { name: "Pasco County", fips: "12101", stateCode: "FL" },
  { name: "Pinellas County", fips: "12103", stateCode: "FL" },
  { name: "Polk County", fips: "12105", stateCode: "FL" },
  { name: "Putnam County", fips: "12107", stateCode: "FL" },
  { name: "Santa Rosa County", fips: "12113", stateCode: "FL" },
  { name: "Sarasota County", fips: "12115", stateCode: "FL" },
  { name: "Seminole County", fips: "12117", stateCode: "FL" },
  { name: "St. Johns County", fips: "12109", stateCode: "FL" },
  { name: "St. Lucie County", fips: "12111", stateCode: "FL" },
  { name: "Sumter County", fips: "12119", stateCode: "FL" },
  { name: "Suwannee County", fips: "12121", stateCode: "FL" },
  { name: "Taylor County", fips: "12123", stateCode: "FL" },
  { name: "Union County", fips: "12125", stateCode: "FL" },
  { name: "Volusia County", fips: "12127", stateCode: "FL" },
  { name: "Wakulla County", fips: "12129", stateCode: "FL" },
  { name: "Walton County", fips: "12131", stateCode: "FL" },
  { name: "Washington County", fips: "12133", stateCode: "FL" }
];

export async function seedFloridaCounties() {
  try {
    console.log("Starting Florida county seeding...");
    
    // Remove existing Florida counties to avoid duplicates
    await db.delete(counties).where(eq(counties.stateCode, 'FL'));
    console.log("Cleared existing Florida county data");

    // Insert Florida counties
    await db.insert(counties).values(floridaCounties);
    console.log(`Successfully seeded ${floridaCounties.length} Florida counties`);
    
    // Verify the data
    const count = await db.select().from(counties).where(eq(counties.stateCode, 'FL'));
    console.log(`Total Florida counties in database: ${count.length}`);
    
    return count.length;
  } catch (error) {
    console.error("Error seeding Florida counties:", error);
    throw error;
  }
}

// Run the seeding function immediately
seedFloridaCounties()
  .then(() => {
    console.log("Florida county seeding completed successfully");
    process.exit(0);
  })
  .catch((error) => {
    console.error("Florida county seeding failed:", error);
    process.exit(1);
  });