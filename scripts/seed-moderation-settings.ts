#!/usr/bin/env tsx

import { db } from "../server/db";
import { moderationSettings } from "../shared/schema";

async function seedModerationSettings() {
  console.log("🔧 Seeding default moderation settings...");

  try {
    // Default global settings
    await db.insert(moderationSettings).values({
      name: "Global Default Settings",
      description: "Default moderation settings for all locations",
      votesRequired: 10,
      removalThreshold: "0.60",
      requiresAddressVerification: true,
      minAccountAge: 30,
      isActive: true,
      isStatewide: false,
      votingTimeLimit: 7 * 24 * 60 * 60, // 7 days in seconds
    });

    // Example county-specific settings for Los Angeles County, CA
    await db.insert(moderationSettings).values({
      name: "Los Angeles County Settings",
      description: "Moderation settings for Los Angeles County, California",
      county: "Los Angeles County",
      state: "CA",
      votesRequired: 15,
      removalThreshold: "0.65",
      requiresAddressVerification: true,
      minAccountAge: 14,
      isActive: true,
      isStatewide: false,
      votingTimeLimit: 5 * 24 * 60 * 60, // 5 days in seconds
    });

    // Example state-wide settings for Texas
    await db.insert(moderationSettings).values({
      name: "Texas State Settings",
      description: "Statewide moderation settings for Texas",
      state: "TX",
      votesRequired: 12,
      removalThreshold: "0.55",
      requiresAddressVerification: true,
      minAccountAge: 21,
      isActive: true,
      isStatewide: true,
      votingTimeLimit: 7 * 24 * 60 * 60, // 7 days in seconds
    });

    console.log("✅ Default moderation settings seeded successfully!");
    
  } catch (error) {
    console.error("❌ Error seeding moderation settings:", error);
    throw error;
  }
}

// Run the seeding function
seedModerationSettings()
  .then(() => {
    console.log("🎉 Moderation settings seeding completed!");
    process.exit(0);
  })
  .catch((error) => {
    console.error("💥 Failed to seed moderation settings:", error);
    process.exit(1);
  });

export { seedModerationSettings };