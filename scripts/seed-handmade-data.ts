import { db } from "../src/db/drizzle-mock";
import { handmadeCategories, handmadeProducts, sellerProfiles, users } from "../shared/schema";
import { randomUUID } from "crypto";
import { sql } from "drizzle-orm";

async function seedHandmadeData() {
  try {
    console.log("Seeding handmade marketplace data...");

    // Clear existing data
    await db.delete(handmadeProducts);
    await db.delete(handmadeCategories);
    await db.delete(sellerProfiles);
    // Clean up sample users if they exist
    await db.delete(users).where(sql`email LIKE '%@artisancrafts.com' OR email LIKE '%@cozyhome.com' OR email LIKE '%@mountainwood.com'`);

    // Seed categories
    const categories = [
      {
        name: "Jewelry & Accessories",
        slug: "jewelry-accessories",
        description: "Handcrafted jewelry, bags, and fashion accessories",
        iconName: "sparkles"
      },
      {
        name: "Home & Decor",
        slug: "home-decor",
        description: "Handmade items for your home and garden",
        iconName: "home"
      },
      {
        name: "Art & Crafts",
        slug: "art-crafts",
        description: "Original artwork, paintings, and creative crafts",
        iconName: "palette"
      },
      {
        name: "Clothing & Textiles",
        slug: "clothing-textiles",
        description: "Handmade clothing, quilts, and textile goods",
        iconName: "shirt"
      },
      {
        name: "Toys & Games",
        slug: "toys-games",
        description: "Handcrafted toys and educational games",
        iconName: "puzzle"
      },
      {
        name: "Beauty & Personal Care",
        slug: "beauty-personal-care",
        description: "Natural skincare, soaps, and beauty products",
        iconName: "flower"
      },
      {
        name: "Kitchen & Dining",
        slug: "kitchen-dining",
        description: "Handmade pottery, utensils, and kitchenware",
        iconName: "chef-hat"
      },
      {
        name: "Woodworking",
        slug: "woodworking",
        description: "Custom wooden furniture and decorative items",
        iconName: "hammer"
      }
    ];

    const insertedCategories = await db.insert(handmadeCategories).values(categories).returning();
    console.log(`Inserted ${insertedCategories.length} categories`);

    // Create sample users first
    const sampleUsers = [
      {
        id: randomUUID(),
        email: "seller1@artisancrafts.com",
        firstName: "Emma",
        lastName: "Martinez",
        role: "homeowner" as const,
        addressVerified: true,
        profileSetup: true,
      },
      {
        id: randomUUID(),
        email: "seller2@cozyhome.com", 
        firstName: "James",
        lastName: "Thompson",
        role: "homeowner" as const,
        addressVerified: true,
        profileSetup: true,
      },
      {
        id: randomUUID(),
        email: "seller3@mountainwood.com",
        firstName: "Sarah",
        lastName: "Wilson",
        role: "homeowner" as const,
        addressVerified: true,
        profileSetup: true,
      }
    ];

    const insertedUsers = await db.insert(users).values(sampleUsers).returning();
    console.log(`Inserted ${insertedUsers.length} sample users`);

    // Create sample seller profiles
    const sampleSellers = [
      {
        userId: insertedUsers[0].id,
        businessName: "Artisan Crafts Studio",
        bio: "Creating beautiful handmade jewelry and accessories since 2018. Each piece is crafted with love and attention to detail.",
        location: "Portland, OR",
        specialties: ["Jewelry", "Metalwork", "Beadwork"],
        yearsExperience: 6,
        isVerified: true,
        socialLinks: {
          website: "https://artisancraftsstudio.com",
          instagram: "@artisancrafts"
        }
      },
      {
        userId: insertedUsers[1].id, 
        businessName: "Cozy Home Creations",
        bio: "Specializing in handwoven textiles and home decor items that bring warmth and character to any space.",
        location: "Austin, TX",
        specialties: ["Textiles", "Home Decor", "Weaving"],
        yearsExperience: 4,
        isVerified: true,
        socialLinks: {
          website: "https://cozyhomecreations.com"
        }
      },
      {
        userId: insertedUsers[2].id,
        businessName: "Mountain Wood Works",
        bio: "Custom woodworking and furniture making using sustainable materials sourced from local forests.",
        location: "Denver, CO",
        specialties: ["Woodworking", "Furniture", "Custom Pieces"],
        yearsExperience: 12,
        isVerified: true,
        socialLinks: {
          website: "https://mountainwoodworks.com",
          facebook: "MountainWoodWorks"
        }
      }
    ];

    const insertedSellers = await db.insert(sellerProfiles).values(sampleSellers).returning();
    console.log(`Inserted ${insertedSellers.length} seller profiles`);

    // Create sample products
    const sampleProducts = [
      {
        sellerId: insertedUsers[0].id,
        categoryId: insertedCategories[0].id, // Jewelry & Accessories
        title: "Handcrafted Silver Moon Phase Necklace",
        description: "Beautiful sterling silver necklace featuring the phases of the moon. Each pendant is carefully crafted and polished to perfection. Comes with an adjustable 18-inch chain.",
        price: "89.99",
        compareAtPrice: "120.00",
        primaryImageUrl: "/api/placeholder-image/jewelry-necklace.jpg",
        images: [
          "/api/placeholder-image/jewelry-necklace-1.jpg",
          "/api/placeholder-image/jewelry-necklace-2.jpg"
        ],
        materials: ["Sterling Silver", "Chain"],
        colors: ["Silver"],
        dimensions: "Pendant: 1.5\" x 0.5\", Chain: 18\"",
        weight: "0.5 oz",
        city: "Portland",
        stateCode: "OR",
        processingTime: "3-5 business days",
        shippingPrice: "0.00",
        freeShipping: true,
        featured: true,
        inStock: true,
        stockQuantity: 15,
        customizable: true,
        tags: ["moon", "celestial", "silver", "necklace", "handmade"]
      },
      {
        sellerId: insertedUsers[1].id,
        categoryId: insertedCategories[1].id, // Home & Decor
        title: "Handwoven Boho Macrame Wall Hanging",
        description: "Stunning macrame wall hanging that adds a bohemian touch to any room. Made with natural cotton cord in a beautiful geometric pattern.",
        price: "64.99",
        primaryImageUrl: "/api/placeholder-image/macrame-wall-hanging.jpg",
        images: [
          "/api/placeholder-image/macrame-1.jpg",
          "/api/placeholder-image/macrame-2.jpg"
        ],
        materials: ["Cotton Cord", "Natural Fibers"],
        colors: ["Natural", "Cream"],
        dimensions: "24\" x 36\"",
        weight: "1.2 lbs",
        city: "Austin",
        stateCode: "TX",
        processingTime: "1-2 weeks",
        shippingPrice: "12.99",
        freeShipping: false,
        featured: true,
        inStock: true,
        stockQuantity: 8,
        customizable: true,
        tags: ["macrame", "boho", "wall hanging", "decor", "handwoven"]
      },
      {
        sellerId: insertedUsers[2].id,
        categoryId: insertedCategories[6].id, // Kitchen & Dining
        title: "Reclaimed Wood Cutting Board Set",
        description: "Set of three cutting boards made from reclaimed barn wood. Each board is unique and finished with food-safe mineral oil. Perfect for entertaining or everyday use.",
        price: "124.99",
        compareAtPrice: "149.99",
        primaryImageUrl: "/api/placeholder-image/cutting-board-set.jpg",
        images: [
          "/api/placeholder-image/cutting-board-1.jpg",
          "/api/placeholder-image/cutting-board-2.jpg",
          "/api/placeholder-image/cutting-board-3.jpg"
        ],
        materials: ["Reclaimed Wood", "Mineral Oil Finish"],
        colors: ["Natural Wood"],
        dimensions: "Large: 18\"x12\", Medium: 14\"x10\", Small: 10\"x8\"",
        weight: "4.5 lbs",
        city: "Denver",
        stateCode: "CO",
        processingTime: "2-3 weeks",
        shippingPrice: "0.00",
        freeShipping: true,
        featured: true,
        inStock: true,
        stockQuantity: 12,
        customizable: true,
        tags: ["cutting board", "reclaimed wood", "kitchen", "set", "handmade"]
      },
      {
        sellerId: insertedUsers[0].id,
        categoryId: insertedCategories[0].id, // Jewelry & Accessories
        title: "Copper Wire Wrapped Gemstone Bracelet",
        description: "Elegant bracelet featuring natural gemstones wrapped in copper wire. Each stone is carefully selected for its beauty and energy properties.",
        price: "42.50",
        primaryImageUrl: "/api/placeholder-image/gemstone-bracelet.jpg",
        materials: ["Copper Wire", "Natural Gemstones"],
        colors: ["Copper", "Multi"],
        dimensions: "Adjustable 6.5\" - 8.5\"",
        weight: "0.3 oz",
        city: "Portland",
        stateCode: "OR",
        processingTime: "1-2 business days",
        shippingPrice: "4.99",
        freeShipping: false,
        featured: false,
        inStock: true,
        stockQuantity: 25,
        customizable: false,
        tags: ["bracelet", "copper", "gemstone", "wire wrapped", "healing"]
      },
      {
        sellerId: insertedUsers[1].id,
        categoryId: insertedCategories[3].id, // Clothing & Textiles
        title: "Hand-Knitted Alpaca Wool Scarf",
        description: "Luxuriously soft scarf hand-knitted from 100% alpaca wool. Perfect for cold weather and incredibly warm while remaining lightweight.",
        price: "78.00",
        primaryImageUrl: "/api/placeholder-image/alpaca-scarf.jpg",
        materials: ["100% Alpaca Wool"],
        colors: ["Charcoal Gray", "Cream", "Forest Green"],
        dimensions: "8\" x 72\"",
        weight: "0.8 lbs",
        city: "Austin",
        stateCode: "TX",
        processingTime: "1-3 weeks",
        shippingPrice: "8.99",
        freeShipping: false,
        featured: false,
        inStock: true,
        stockQuantity: 6,
        customizable: true,
        tags: ["scarf", "alpaca wool", "knitted", "warm", "winter"]
      }
    ];

    const insertedProducts = await db.insert(handmadeProducts).values(sampleProducts).returning();
    console.log(`Inserted ${insertedProducts.length} products`);

    console.log("✅ Handmade marketplace data seeded successfully!");
    
  } catch (error) {
    console.error("❌ Error seeding handmade data:", error);
    throw error;
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  seedHandmadeData()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}

export { seedHandmadeData };
