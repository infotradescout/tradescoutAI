import { db } from "./db";
import { counties, trades, contractors, contractorCounties, contractorTrades } from "@shared/schema";

export async function seedDatabase() {
  try {
    // Seed California counties
    const californiaCounties = [
      { id: 'los-angeles', name: 'Los Angeles County', stateCode: 'CA', fips: '06037' },
      { id: 'orange', name: 'Orange County', stateCode: 'CA', fips: '06059' },
      { id: 'san-diego', name: 'San Diego County', stateCode: 'CA', fips: '06073' },
      { id: 'riverside', name: 'Riverside County', stateCode: 'CA', fips: '06065' },
      { id: 'san-bernardino', name: 'San Bernardino County', stateCode: 'CA', fips: '06071' },
    ];

    await db.insert(counties).values(californiaCounties).onConflictDoNothing();

    // Seed trades
    const tradesList = [
      { id: 'roofing', name: 'Roofing', slug: 'roofing', description: 'Roof repairs and replacements' },
      { id: 'general-contractor', name: 'General Contractor', slug: 'general-contractor', description: 'Full service contracting' },
      { id: 'plumbing', name: 'Plumbing', slug: 'plumbing', description: 'Plumbing services and repairs' },
      { id: 'electrical', name: 'Electrical', slug: 'electrical', description: 'Electrical work and installations' },
      { id: 'hvac', name: 'HVAC', slug: 'hvac', description: 'Heating, ventilation, and air conditioning' },
      { id: 'painting', name: 'Painting', slug: 'painting', description: 'Interior and exterior painting' },
      { id: 'flooring', name: 'Flooring', slug: 'flooring', description: 'Flooring installation and repair' },
      { id: 'landscaping', name: 'Landscaping', slug: 'landscaping', description: 'Landscaping and yard work' },
    ];

    await db.insert(trades).values(tradesList).onConflictDoNothing();

    // Seed sample contractors
    const sampleContractors = [
      {
        id: 'elite-roofing-la',
        companyName: 'Elite Roofing Solutions',
        slug: 'elite-roofing-solutions',
        contactName: 'Mike Rodriguez',
        phone: '(310) 555-0123',
        email: 'mike@eliteroofingla.com',
        website: 'https://eliteroofingla.com',
        about: 'Premier roofing contractor serving Los Angeles County for over 15 years. Specializing in residential and commercial roof repairs, replacements, and maintenance.',
        serviceRadius: 50,
        isActive: true,
        isVerified: true,
        avgRating: 4.8,
        totalReviews: 127,
        userId: null,
      },
      {
        id: 'pacific-plumbing',
        companyName: 'Pacific Plumbing Pro',
        slug: 'pacific-plumbing-pro',
        contactName: 'Sarah Chen',
        phone: '(714) 555-0456',
        email: 'sarah@pacificplumbingpro.com',
        website: 'https://pacificplumbingpro.com',
        about: 'Full-service plumbing company covering Orange and Los Angeles counties. Emergency repairs, installations, and maintenance for residential and commercial properties.',
        serviceRadius: 40,
        isActive: true,
        isVerified: true,
        avgRating: 4.9,
        totalReviews: 89,
        userId: null,
      },
      {
        id: 'sunshine-electrical',
        companyName: 'Sunshine Electrical Services',
        slug: 'sunshine-electrical-services',
        contactName: 'David Thompson',
        phone: '(213) 555-0789',
        email: 'david@sunshineelectrical.com',
        website: 'https://sunshineelectrical.com',
        about: 'Licensed electricians providing safe, reliable electrical services throughout Southern California. Specializing in panel upgrades, wiring, and smart home installations.',
        serviceRadius: 60,
        isActive: true,
        isVerified: true,
        avgRating: 4.7,
        totalReviews: 156,
        userId: null,
      },
      {
        id: 'golden-state-hvac',
        companyName: 'Golden State HVAC',
        slug: 'golden-state-hvac',
        contactName: 'Maria Gonzalez',
        phone: '(818) 555-0234',
        email: 'maria@goldenstateHVAC.com',
        website: 'https://goldenstateHVAC.com',
        about: 'HVAC installation, repair, and maintenance specialists. Energy-efficient solutions for homes and businesses across Los Angeles and surrounding areas.',
        serviceRadius: 45,
        isActive: true,
        isVerified: true,
        avgRating: 4.6,
        totalReviews: 203,
        userId: null,
      },
      {
        id: 'premium-painting',
        companyName: 'Premium Painting Company',
        slug: 'premium-painting-company',
        contactName: 'James Wilson',
        phone: '(323) 555-0567',
        email: 'james@premiumpaintingco.com',
        website: 'https://premiumpaintingco.com',
        about: 'High-quality interior and exterior painting services. Using premium materials and expert craftsmanship to transform homes and businesses.',
        serviceRadius: 35,
        isActive: true,
        isVerified: true,
        avgRating: 4.5,
        totalReviews: 94,
        userId: null,
      },
      {
        id: 'coastal-general',
        companyName: 'Coastal General Contractors',
        slug: 'coastal-general-contractors',
        contactName: 'Lisa Park',
        phone: '(949) 555-0890',
        email: 'lisa@coastalgeneral.com',
        website: 'https://coastalgeneral.com',
        about: 'Full-service general contractors specializing in kitchen and bathroom remodels, home additions, and custom construction projects.',
        serviceRadius: 50,
        isActive: true,
        isVerified: true,
        avgRating: 4.9,
        totalReviews: 78,
        userId: null,
      },
    ];

    await db.insert(contractors).values(sampleContractors).onConflictDoNothing();

    // Associate contractors with counties and trades
    const contractorCountyRelations = [
      { contractorId: 'elite-roofing-la', countyId: 'los-angeles' },
      { contractorId: 'elite-roofing-la', countyId: 'orange' },
      { contractorId: 'pacific-plumbing', countyId: 'orange' },
      { contractorId: 'pacific-plumbing', countyId: 'los-angeles' },
      { contractorId: 'sunshine-electrical', countyId: 'los-angeles' },
      { contractorId: 'sunshine-electrical', countyId: 'orange' },
      { contractorId: 'golden-state-hvac', countyId: 'los-angeles' },
      { contractorId: 'premium-painting', countyId: 'los-angeles' },
      { contractorId: 'coastal-general', countyId: 'orange' },
      { contractorId: 'coastal-general', countyId: 'los-angeles' },
    ];

    await db.insert(contractorCounties).values(contractorCountyRelations).onConflictDoNothing();

    const contractorTradeRelations = [
      { contractorId: 'elite-roofing-la', tradeId: 'roofing' },
      { contractorId: 'pacific-plumbing', tradeId: 'plumbing' },
      { contractorId: 'sunshine-electrical', tradeId: 'electrical' },
      { contractorId: 'golden-state-hvac', tradeId: 'hvac' },
      { contractorId: 'premium-painting', tradeId: 'painting' },
      { contractorId: 'coastal-general', tradeId: 'general-contractor' },
    ];

    await db.insert(contractorTrades).values(contractorTradeRelations).onConflictDoNothing();

    console.log('Database seeded successfully!');
  } catch (error) {
    console.error('Error seeding database:', error);
  }
}