import { db } from "./db";
import {
  siteSettings,
  prizeConfigurations,
  advertisements,
  contractorSettings,
} from "@shared/schema";

export async function seedAdminData() {
  console.log("Seeding admin configuration data...");

  try {
    // Seed prize configurations
    await db
      .insert(prizeConfigurations)
      .values([
        {
          name: "$50 Home Depot Gift Card",
          description: "Perfect for your next home improvement project",
          prizeType: "gift_card",
          value: "$50",
          vendor: "Home Depot",
          isActive: true,
          probability: "0.0500", // 5%
          terms: "Valid for 30 days. Cannot be combined with other offers.",
          expirationDays: 30,
        },
        {
          name: "$25 Lowes Gift Card",
          description: "Great for tools and materials",
          prizeType: "gift_card",
          value: "$25",
          vendor: "Lowes",
          isActive: true,
          probability: "0.0300", // 3%
          terms: "Valid for 30 days. Cannot be combined with other offers.",
          expirationDays: 30,
        },
        {
          name: "Premium Features - 1 Month",
          description: "Access to advanced contractor search and premium tools",
          prizeType: "premium_features",
          value: "1 month",
          isActive: true,
          probability: "0.0200", // 2%
          terms: "Automatically added to your account. Valid for 1 month.",
          expirationDays: 90,
        },
      ])
      .onConflictDoNothing();

    // Seed advertisements with location targeting
    await db
      .insert(advertisements)
      .values([
        {
          title: "Get 3 Free Quotes Today!",
          content:
            "Connect with verified contractors in your area and get competitive estimates for your project.",
          placement: "site_visit",
          targetAudience: "homeowners",
          targetLocation: "national",
          priority: 5,
          isActive: true,
          linkUrl: "/quote",
        },
        {
          title: "Join Our Contractor Network",
          content: "Grow your business with quality leads from homeowners ready to hire.",
          placement: "site_visit",
          targetAudience: "contractors",
          targetLocation: "national",
          priority: 5,
          isActive: true,
          linkUrl: "/contractors/apply",
        },
        {
          title: "California Contractors: Special Incentives Available",
          content:
            "Limited time offer for California-based contractors. Get premium leads and grow your business.",
          placement: "site_visit",
          targetAudience: "contractors",
          targetLocation: "state:CA",
          priority: 10,
          isActive: true,
          linkUrl: "/contractors/accelerator",
        },
        {
          title: "Los Angeles County Home Improvement Guide",
          content:
            "Free guide with local permit requirements, recommended contractors, and cost estimates.",
          placement: "site_visit",
          targetAudience: "homeowners",
          targetLocation: "county:06037",
          priority: 15,
          isActive: true,
          linkUrl: "/growth-pack",
        },
        {
          title: "Partner Affiliate: Home Depot Pro Services",
          content:
            "Professional installation services for your next project. Get quality materials and expert installation.",
          placement: "site_visit",
          targetAudience: "all",
          targetLocation: "national",
          priority: 3,
          isAffiliate: true,
          isActive: true,
          linkUrl: "https://www.homedepot.com/services/",
        },
      ])
      .onConflictDoNothing();

    // Seed site settings
    await db
      .insert(siteSettings)
      .values([
        {
          category: "features",
          key: "golden_emblem_enabled",
          value: { enabled: true, probability: 0.002 },
          description: "Controls the golden emblem prize system (0.2% chance)",
          isActive: true,
        },
        {
          category: "features",
          key: "material_lists_enabled",
          value: { enabled: true, collaborative: true },
          description: "Enable collaborative material list features",
          isActive: true,
        },
        {
          category: "content",
          key: "homepage_hero_text",
          value: {
            title: "Find Trusted Contractors in Your County",
            subtitle:
              "Get connected with verified local contractors for your home improvement projects",
          },
          description: "Homepage hero section content",
          isActive: true,
        },
        {
          category: "ads",
          key: "banner_rotation_interval",
          value: { seconds: 30 },
          description: "How often to rotate banner advertisements",
          isActive: true,
        },
        {
          category: "matching",
          key: "tradepartner_bonus_slope",
          value: 0.1,
          description: "TradePartner usage ranking slope (bonus per usage unit)",
          isActive: true,
        },
        {
          category: "matching",
          key: "tradepartner_bonus_cap",
          value: 10,
          description: "Maximum TradePartner usage ranking bonus",
          isActive: true,
        },
        {
          category: "matching",
          key: "tradepartner_bonus_usage_cap",
          value: 100,
          description: "Maximum usage count considered for TradePartner bonus",
          isActive: true,
        },
      ])
      .onConflictDoNothing();

    // Seed contractor settings
    await db
      .insert(contractorSettings)
      .values([
        {
          category: "verification",
          setting: "required_documents",
          value: {
            documents: ["license", "insurance", "business_registration"],
            license_required: true,
            insurance_minimum: 100000,
          },
          description: "Required documents for contractor verification",
          isActive: true,
        },
        {
          category: "lead_routing",
          setting: "max_leads_per_contractor",
          value: { daily: 10, weekly: 50, monthly: 200 },
          description: "Maximum leads per contractor per time period",
          isActive: true,
        },
        {
          category: "pricing",
          setting: "base_commission_rate",
          value: { rate: 0.15, currency: "USD" },
          description: "Base commission rate for completed projects",
          isActive: true,
        },
        {
          category: "features",
          setting: "chat_notifications",
          value: {
            email: true,
            sms: false,
            in_app: true,
            delay_minutes: 5,
          },
          description: "Notification settings for contractor chat messages",
          isActive: true,
        },
      ])
      .onConflictDoNothing();

    console.log("✅ Admin configuration data seeded successfully");
  } catch (error) {
    console.error("❌ Error seeding admin data:", error);
    throw error;
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  seedAdminData()
    .then(() => {
      console.log("Seeding completed!");
      process.exit(0);
    })
    .catch((error) => {
      console.error("Seeding failed:", error);
      process.exit(1);
    });
}
