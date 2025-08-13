import { db } from "./db";
import { 
  siteSettings,
  prizeConfigurations,
  contractorSettings,
  users
} from "../shared/schema";

export async function populateAdminData() {
  try {
    console.log("🔧 Populating admin panel data...");

    // Get a valid user ID for admin content
    const existingUser = await db.select({ id: users.id }).from(users).limit(1);
    const userId = existingUser[0]?.id || 'system';

    // Add sample site settings
    await db.insert(siteSettings).values([
      {
        id: 'setting-1',
        category: 'platform',
        key: 'maintenance_mode',
        value: false,
        description: 'Enable maintenance mode to temporarily disable site access',
        isActive: true
      },
      {
        id: 'setting-2', 
        category: 'platform',
        key: 'max_concurrent_users',
        value: 10000,
        description: 'Maximum number of concurrent users allowed',
        isActive: true
      },
      {
        id: 'setting-3',
        category: 'features',
        key: 'emblem_rotation_enabled',
        value: true,
        description: 'Enable automatic construction emblem rotation',
        isActive: true
      },
      {
        id: 'setting-4',
        category: 'features',
        key: 'golden_emblem_probability',
        value: 0.002,
        description: 'Probability of golden emblem appearance (0.2%)',
        isActive: true
      },
      {
        id: 'setting-5',
        category: 'notifications',
        key: 'email_notifications_enabled',
        value: true,
        description: 'Enable email notifications for important events',
        isActive: true
      }
    ]).onConflictDoNothing();

    // Add sample prize configurations
    await db.insert(prizeConfigurations).values([
      {
        id: 'prize-1',
        name: 'Tool Store Gift Card',
        description: 'High-quality professional tools for contractors',
        prizeType: 'gift_card',
        value: '250.00',
        vendor: 'Home Depot',
        probability: '0.50',
        isActive: true,
        terms: 'Valid for 90 days. Tools only, no gift card sales.',
        expirationDays: 90
      },
      {
        id: 'prize-2',
        name: 'TradeScout Premium Subscription', 
        description: 'Free premium features for enhanced contractor visibility',
        prizeType: 'subscription',
        value: '199.00',
        vendor: 'TradeScout',
        probability: '0.30',
        isActive: true,
        terms: 'Valid for 6 months. Auto-renews at standard rate.',
        expirationDays: 180
      },
      {
        id: 'prize-3',
        name: 'Professional Equipment Package',
        description: 'High-end contractor equipment bundle',
        prizeType: 'physical_prize',
        value: '500.00',
        vendor: 'DeWalt',
        probability: '0.15',
        isActive: true,
        terms: 'Shipping included. Equipment may vary based on trade specialization.',
        expirationDays: 30
      },
      {
        id: 'prize-4',
        name: 'Business Development Training',
        description: 'Online courses for growing contracting business',
        prizeType: 'training',
        value: '399.00',
        vendor: 'ContractorU',
        probability: '0.05',
        isActive: true,
        terms: 'Access valid for 1 year. Includes certification.',
        expirationDays: 365
      }
    ]).onConflictDoNothing();

    // Add sample contractor settings
    await db.insert(contractorSettings).values([
      {
        id: 'setting-1',
        category: 'verification',
        setting: 'license_verification_required',
        value: true,
        description: 'Require license verification for all contractors',
        isActive: true
      },
      {
        id: 'setting-2',
        category: 'verification', 
        setting: 'insurance_verification_required',
        value: true,
        description: 'Require insurance verification for all contractors',
        isActive: true
      },
      {
        id: 'setting-3',
        category: 'leads',
        setting: 'max_leads_per_contractor',
        value: 50,
        description: 'Maximum number of leads per contractor per month',
        isActive: true
      },
      {
        id: 'setting-4',
        category: 'leads',
        setting: 'lead_distribution_algorithm', 
        value: 'round_robin_weighted',
        description: 'Algorithm for distributing leads to contractors',
        isActive: true
      },
      {
        id: 'setting-5',
        category: 'features',
        setting: 'accelerator_program_enabled',
        value: true,
        description: 'Enable accelerator program for premium contractors',
        isActive: true
      }
    ]).onConflictDoNothing();

    console.log("✅ Admin panel data populated successfully!");

  } catch (error) {
    console.error("❌ Error populating admin data:", error);
    throw error;
  }
}

// Run the population if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  populateAdminData()
    .then(() => {
      console.log("Admin data population completed!");
      process.exit(0);
    })
    .catch((error) => {
      console.error("Failed to populate admin data:", error);
      process.exit(1);
    });
}