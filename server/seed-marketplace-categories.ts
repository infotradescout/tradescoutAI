import { db } from "./db";
import { marketplaceCategories } from "@shared/schema";
import { eq } from "drizzle-orm";

const defaultCategories = [
  {
    name: "Real Estate",
    description: "Houses, land, commercial properties, and investment properties",
    iconName: "Home",
    sortOrder: 10
  },
  {
    name: "Vehicles",
    description: "Cars, trucks, motorcycles, boats, and all motor vehicles",
    iconName: "Car",
    sortOrder: 20
  },
  {
    name: "Construction Equipment",
    description: "Heavy machinery, construction tools, and contractor equipment",
    iconName: "Hammer",
    sortOrder: 30
  },
  {
    name: "Tools & Hardware",
    description: "Hand tools, power tools, and hardware supplies in good condition",
    iconName: "Wrench",
    sortOrder: 40
  },
  {
    name: "Furniture & Home Goods",
    description: "Furniture, appliances, home decor, and household items",
    iconName: "Sofa",
    sortOrder: 50
  },
  {
    name: "Farm Equipment",
    description: "Tractors, harvesters, and agricultural machinery",
    iconName: "Tractor",
    sortOrder: 60
  },
  {
    name: "Business Equipment",
    description: "Office equipment, industrial machinery, and business assets",
    iconName: "Building",
    sortOrder: 70
  },
  {
    name: "Recreational Vehicles",
    description: "RVs, ATVs, motorcycles, and recreational equipment",
    iconName: "Bike",
    sortOrder: 80
  },
  {
    name: "Boats & Marine",
    description: "Boats, jet skis, and marine equipment",
    iconName: "Anchor",
    sortOrder: 90
  },
  {
    name: "Farm Animals",
    description: "Livestock, poultry, and farm animals",
    iconName: "Fish", // Using Fish as a placeholder for livestock
    sortOrder: 100
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
    name: "Electronics & Technology",
    description: "Computers, phones, electronics, and tech equipment",
    iconName: "Monitor",
    sortOrder: 110
  },
  {
    name: "Sports & Recreation",
    description: "Sports equipment, outdoor gear, and recreational items",
    iconName: "Trophy",
    sortOrder: 120
  },
  {
    name: "Art & Collectibles",
    description: "Artwork, antiques, collectibles, and unique items",
    iconName: "Palette",
    sortOrder: 130
  },
  {
    name: "Jewelry & Luxury Items",
    description: "Fine jewelry, watches, and luxury goods",
    iconName: "Gem",
    sortOrder: 140
  },
  {
    name: "Other High-Value Items",
    description: "Expensive items that don't fit other categories",
    iconName: "Package",
    sortOrder: 150
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