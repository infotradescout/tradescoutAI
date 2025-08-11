#!/usr/bin/env tsx

import { db } from "../server/db";
import { users, marketplaceListings, marketplaceCategories } from "../shared/schema";
import { eq } from "drizzle-orm";

async function seedMarketplaceListings() {
  console.log("🌱 Seeding marketplace listings...");

  try {
    // Get existing categories
    const categories = await db.select().from(marketplaceCategories);
    
    if (categories.length === 0) {
      console.log("❌ No marketplace categories found. Please run seed-marketplace-categories first.");
      return;
    }

    // Get some existing users to act as sellers
    const existingUsers = await db.select().from(users).limit(5);
    
    if (existingUsers.length === 0) {
      console.log("❌ No users found. Please create some users first.");
      return;
    }

    // Sample marketplace listings
    const sampleListings = [
      {
        title: "Professional Dewalt Cordless Drill Set",
        description: "Like-new 20V MAX cordless drill with 2 batteries, charger, and carrying case. Perfect for contractors or serious DIY projects. Only used for a few jobs.",
        price: "245.00",
        originalPrice: "329.99",
        priceType: "fixed" as const,
        condition: "like_new" as const,
        categoryId: categories.find(c => c.name === "Tools & Hardware")?.id || categories[0]?.id || 'default-category',
        sellerId: existingUsers[0]?.id || 'test-user-1',
        sellerName: `${existingUsers[0]?.firstName || 'Test'} ${existingUsers[0]?.lastName || 'User'}`,
        sellerType: "contractor" as const,
        sellerRole: "contractor_user" as const,
        county: "Los Angeles County",
        state: "CA",
        zipCode: "90210",
        isHighValue: true,
        status: "active" as const,
        approvalStatus: "approved" as const,
        images: [],
        tags: ["dewalt", "cordless", "drill", "20v", "professional"],
        viewCount: 45
      },
      {
        title: "Commercial Grade Table Saw",
        description: "Heavy-duty cabinet table saw, perfect for professional woodworking. Includes premium fence system and dust collection. Maintained regularly, excellent condition.",
        price: "1850.00",
        priceType: "negotiable" as const,
        condition: "excellent" as const,
        categoryId: categories.find(c => c.name === "Tools & Hardware")?.id || categories[0]?.id || 'default-category',
        sellerId: existingUsers[1]?.id || 'test-user-2',
        sellerName: `${existingUsers[1]?.firstName || 'Test'} ${existingUsers[1]?.lastName || 'User'}`,
        sellerType: "contractor" as const,
        sellerRole: "contractor_user" as const,
        county: "Orange County",
        state: "CA", 
        zipCode: "92602",
        isHighValue: true,
        status: "active" as const,
        approvalStatus: "approved" as const,
        images: [],
        tags: ["table saw", "commercial", "woodworking", "cabinet"],
        viewCount: 23
      },
      {
        title: "Landscape Design Package - Drought Resistant Garden",
        description: "Beautiful native plant collection for water-wise landscaping. Includes installation guide and 1-year maintenance tips. Perfect for California homes.",
        price: "680.00",
        priceType: "fixed" as const,
        condition: "new" as const,
        categoryId: categories.find(c => c.name === "Furniture & Home Goods")?.id || categories[0]?.id || 'default-category',
        sellerId: existingUsers[2]?.id || 'test-user-3',
        sellerName: `${existingUsers[2]?.firstName || 'Test'} ${existingUsers[2]?.lastName || 'User'}`,
        sellerType: "homeowner" as const,
        sellerRole: "homeowner" as const,
        county: "San Diego County",
        state: "CA",
        zipCode: "92101",
        isHighValue: false,
        status: "active" as const,
        approvalStatus: "approved" as const,
        images: [],
        tags: ["landscape", "drought resistant", "native plants", "california"],
        viewCount: 67
      },
      {
        title: "Vintage Mid-Century Modern Dining Set",
        description: "Authentic 1960s teak dining table with 6 chairs. Recently refinished by professional furniture restorer. A true investment piece with timeless appeal.",
        price: "2400.00",
        originalPrice: "3200.00",
        priceType: "firm" as const,
        condition: "good" as const,
        categoryId: categories.find(c => c.name === "Furniture & Home Goods")?.id || categories[0]?.id || 'default-category',
        sellerId: existingUsers[3]?.id || 'test-user-4',
        sellerName: `${existingUsers[3]?.firstName || 'Test'} ${existingUsers[3]?.lastName || 'User'}`,
        sellerType: "homeowner" as const,
        sellerRole: "homeowner" as const,
        county: "Marin County",
        state: "CA",
        zipCode: "94901",
        isHighValue: true,
        status: "active" as const,
        approvalStatus: "approved" as const,
        images: [],
        tags: ["vintage", "mid-century", "dining set", "teak", "investment"],
        viewCount: 134
      },
      {
        title: "Electric Vehicle Charging Station Installation",
        description: "Professional EV charger installation service. Includes Level 2 charger, permits, and full electrical work. Boost your home's value while preparing for the future.",
        price: "1200.00",
        priceType: "quoted" as const,
        condition: "new" as const,
        categoryId: categories.find(c => c.name === "Tools & Hardware")?.id || categories[0]?.id || 'default-category',
        sellerId: existingUsers[4]?.id || 'test-user-5',
        sellerName: `${existingUsers[4]?.firstName || 'Test'} ${existingUsers[4]?.lastName || 'User'}`,
        sellerType: "contractor" as const,
        sellerRole: "contractor_user" as const,
        county: "Alameda County",
        state: "CA",
        zipCode: "94501",
        isHighValue: true,
        status: "active" as const,
        approvalStatus: "approved" as const,
        images: [],
        tags: ["ev charger", "installation", "electrical", "home improvement"],
        viewCount: 89
      }
    ];

    // Insert listings
    for (const listing of sampleListings) {
      try {
        const slug = listing.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') + '-' + Math.random().toString(36).substr(2, 9);
        
        await db.insert(marketplaceListings).values({
          ...listing,
          id: crypto.randomUUID(),
          slug,
          createdAt: new Date(),
          updatedAt: new Date()
        });
        
        console.log(`✅ Created listing: ${listing.title}`);
      } catch (error) {
        console.error(`❌ Failed to create listing: ${listing.title}`, error);
      }
    }

    console.log("🎉 Marketplace listings seeded successfully!");
    
  } catch (error) {
    console.error("❌ Error seeding marketplace listings:", error);
  }
}

// Run the seed function
seedMarketplaceListings().then(() => {
  process.exit(0);
}).catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});