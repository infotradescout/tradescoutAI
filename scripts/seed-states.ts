import { db } from "../server/db";
import { states } from "@shared/schema";

const US_STATES = [
  { id: "AL", code: "AL", name: "Alabama" },
  { id: "AK", code: "AK", name: "Alaska" },
  { id: "AZ", code: "AZ", name: "Arizona" },
  { id: "AR", code: "AR", name: "Arkansas" },
  { id: "CA", code: "CA", name: "California" },
  { id: "CO", code: "CO", name: "Colorado" },
  { id: "CT", code: "CT", name: "Connecticut" },
  { id: "DE", code: "DE", name: "Delaware" },
  { id: "FL", code: "FL", name: "Florida" },
  { id: "GA", code: "GA", name: "Georgia" },
  { id: "HI", code: "HI", name: "Hawaii" },
  { id: "ID", code: "ID", name: "Idaho" },
  { id: "IL", code: "IL", name: "Illinois" },
  { id: "IN", code: "IN", name: "Indiana" },
  { id: "IA", code: "IA", name: "Iowa" },
  { id: "KS", code: "KS", name: "Kansas" },
  { id: "KY", code: "KY", name: "Kentucky" },
  { id: "LA", code: "LA", name: "Louisiana" },
  { id: "ME", code: "ME", name: "Maine" },
  { id: "MD", code: "MD", name: "Maryland" },
  { id: "MA", code: "MA", name: "Massachusetts" },
  { id: "MI", code: "MI", name: "Michigan" },
  { id: "MN", code: "MN", name: "Minnesota" },
  { id: "MS", code: "MS", name: "Mississippi" },
  { id: "MO", code: "MO", name: "Missouri" },
  { id: "MT", code: "MT", name: "Montana" },
  { id: "NE", code: "NE", name: "Nebraska" },
  { id: "NV", code: "NV", name: "Nevada" },
  { id: "NH", code: "NH", name: "New Hampshire" },
  { id: "NJ", code: "NJ", name: "New Jersey" },
  { id: "NM", code: "NM", name: "New Mexico" },
  { id: "NY", code: "NY", name: "New York" },
  { id: "NC", code: "NC", name: "North Carolina" },
  { id: "ND", code: "ND", name: "North Dakota" },
  { id: "OH", code: "OH", name: "Ohio" },
  { id: "OK", code: "OK", name: "Oklahoma" },
  { id: "OR", code: "OR", name: "Oregon" },
  { id: "PA", code: "PA", name: "Pennsylvania" },
  { id: "RI", code: "RI", name: "Rhode Island" },
  { id: "SC", code: "SC", name: "South Carolina" },
  { id: "SD", code: "SD", name: "South Dakota" },
  { id: "TN", code: "TN", name: "Tennessee" },
  { id: "TX", code: "TX", name: "Texas" },
  { id: "UT", code: "UT", name: "Utah" },
  { id: "VT", code: "VT", name: "Vermont" },
  { id: "VA", code: "VA", name: "Virginia" },
  { id: "WA", code: "WA", name: "Washington" },
  { id: "WV", code: "WV", name: "West Virginia" },
  { id: "WI", code: "WI", name: "Wisconsin" },
  { id: "WY", code: "WY", name: "Wyoming" },
  { id: "DC", code: "DC", name: "District of Columbia" }
];

async function seedStates() {
  try {
    console.log("Starting states seeding...");
    
    // Clear existing states
    await db.delete(states);
    console.log("Cleared existing states");
    
    // Insert all states
    await db.insert(states).values(US_STATES);
    console.log(`✅ Inserted ${US_STATES.length} states successfully!`);
    
    // Verify count
    const result = await db.select().from(states);
    console.log(`Total states in database: ${result.length}`);
    
  } catch (error) {
    console.error("❌ Error seeding states:", error);
  } finally {
    process.exit(0);
  }
}

seedStates();