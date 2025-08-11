import { db } from "./db";
import { marketplaceCategories } from "@shared/schema";
import { eq } from "drizzle-orm";

const defaultCategories = [
  {
    name: "Construction Equipment",
    description: "Heavy machinery and construction tools",
    iconName: "Hammer",
    sortOrder: 10
  },
  {
    name: "Vehicles",
    description: "Cars, trucks, motorcycles, and other vehicles",
    iconName: "Car",
    sortOrder: 20
  },
  {
    name: "Farm Equipment",
    description: "Tractors, harvesters, and agricultural machinery",
    iconName: "Tractor",
    sortOrder: 30
  },
  {
    name: "Real Estate",
    description: "Houses, land, and commercial properties",
    iconName: "Home",
    sortOrder: 40
  },
  {
    name: "Farm Animals",
    description: "Livestock, poultry, and farm animals",
    iconName: "Fish", // Using Fish as a placeholder for livestock
    sortOrder: 50
  },
  {
    name: "Tools & Hardware",
    description: "Hand tools, power tools, and hardware supplies",
    iconName: "Wrench",
    sortOrder: 60
  },
  {
    name: "Boats & Marine",
    description: "Boats, jet skis, and marine equipment",
    iconName: "Anchor",
    sortOrder: 70
  },
  {
    name: "Recreational Vehicles",
    description: "RVs, ATVs, motorcycles, and recreational equipment",
    iconName: "Bike",
    sortOrder: 80
  },
  {
    name: "Business Equipment",
    description: "Office equipment, industrial machinery, and business assets",
    iconName: "Building",
    sortOrder: 90
  },
  {
    name: "Local Food & Artisan Goods",
    description: "Farm-fresh produce, honey, home-baked goods, and artisan food products",
    iconName: "Apple",
    sortOrder: 15,
    requiresVerification: true,
    verificationRequirements: {
      identityVerification: true,
      foodHandlersPermit: true,
      kitchenInspection: true,
      requiredDocuments: ["ID or Driver's License", "Proof of following all applicable food safety laws"]
    }
  },
  {
    name: "Other High-Value Items",
    description: "Expensive items that don't fit other categories",
    iconName: "Package",
    sortOrder: 100
  }
];

export async function seedMarketplaceCategories() {
  console.log("Seeding marketplace categories...");
  
  try {
    for (const category of defaultCategories) {
      // Check if category already exists
      const existing = await db
        .select()
        .from(marketplaceCategories)
        .where(eq(marketplaceCategories.name, category.name))
        .limit(1);
      
      if (existing.length === 0) {
        await db.insert(marketplaceCategories).values(category);
        console.log(`Created category: ${category.name}`);
      } else {
        // Update existing category to include verification requirements
        await db.update(marketplaceCategories)
          .set(category)
          .where(eq(marketplaceCategories.name, category.name));
        console.log(`Updated category: ${category.name}`);
      }
    }
    
    console.log("Marketplace categories seeding completed!");
  } catch (error) {
    console.error("Error seeding marketplace categories:", error);
  }
}

// Run if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  seedMarketplaceCategories().then(() => {
    process.exit(0);
  });
}