import { db } from "../server/db";
import { foundationCauses, counties } from "../shared/schema";
import { eq } from "drizzle-orm";

async function seedFoundationCauses() {
  try {
    console.log('Starting to seed foundation causes...');

    // Get some county IDs for different states
    const losAngelesCounty = await db.select().from(counties).where(eq(counties.name, 'Los Angeles County')).limit(1);
    const cookCounty = await db.select().from(counties).where(eq(counties.name, 'Cook County')).limit(1);
    const harrisCounty = await db.select().from(counties).where(eq(counties.name, 'Harris County')).limit(1);
    const kingCounty = await db.select().from(counties).where(eq(counties.name, 'King County')).limit(1);
    const browardCounty = await db.select().from(counties).where(eq(counties.name, 'Broward County')).limit(1);

    const sampleCauses = [
      {
        name: "Los Angeles Community Food Bank",
        description: "Fighting hunger in Los Angeles County by providing food assistance to those in need. We serve over 300,000 people monthly through our network of partner agencies and mobile food pantries.",
        category: "hunger_relief",
        countyId: losAngelesCounty[0]?.id || "default-county-id",
        targetAmount: "50000.00",
        raisedAmount: "12500.00",
        imageUrl: "https://images.unsplash.com/photo-1593113630400-ea4288922497?w=500&h=300&fit=crop",
        websiteUrl: "https://example.org/la-food-bank",
        contactEmail: "donations@lafoodbank.org",
        verifiedNonprofit: true,
        taxId: "95-1234567",
        isActive: true,
        createdBy: "system"
      },
      {
        name: "Chicago Youth Education Initiative",
        description: "Providing educational resources and after-school programs for underserved youth in Cook County. We focus on STEM education, tutoring, and college preparation to help students succeed.",
        category: "education",
        countyId: cookCounty[0]?.id || "default-county-id",
        targetAmount: "75000.00",
        raisedAmount: "28900.00",
        imageUrl: "https://images.unsplash.com/photo-1497486751825-1233686d5d80?w=500&h=300&fit=crop",
        websiteUrl: "https://example.org/chicago-youth-education",
        contactEmail: "info@chicagoyoutheducation.org",
        verifiedNonprofit: true,
        taxId: "36-2345678",
        isActive: true,
        createdBy: "system"
      },
      {
        name: "Houston Disaster Relief Fund",
        description: "Emergency assistance for families affected by natural disasters in Harris County. We provide immediate relief including temporary housing, food, clothing, and rebuilding support.",
        category: "disaster_relief",
        countyId: harrisCounty[0]?.id || "default-county-id",
        targetAmount: "100000.00",
        raisedAmount: "67200.00",
        imageUrl: "https://images.unsplash.com/photo-1594736797933-d0f6ee91799d?w=500&h=300&fit=crop",
        websiteUrl: "https://example.org/houston-disaster-relief",
        contactEmail: "help@houstonrelief.org",
        verifiedNonprofit: true,
        taxId: "74-3456789",
        isActive: true,
        createdBy: "system"
      },
      {
        name: "Seattle Animal Rescue & Care",
        description: "Rescuing, rehabilitating, and rehoming abandoned animals in King County. We provide medical care, behavioral training, and work to prevent animal homelessness through spay/neuter programs.",
        category: "animal_welfare",
        countyId: kingCounty[0]?.id || "default-county-id",
        targetAmount: "30000.00",
        raisedAmount: "18750.00",
        imageUrl: "https://images.unsplash.com/photo-1601758228041-f3b2795255f1?w=500&h=300&fit=crop",
        websiteUrl: "https://example.org/seattle-animal-rescue",
        contactEmail: "adopt@seattleanimalrescue.org",
        verifiedNonprofit: true,
        taxId: "91-4567890",
        isActive: true,
        createdBy: "system"
      },
      {
        name: "South Florida Environmental Restoration",
        description: "Protecting and restoring natural ecosystems in Broward County. Our work includes coastal cleanup, wetland restoration, and environmental education programs to preserve Florida's natural beauty.",
        category: "environmental",
        countyId: browardCounty[0]?.id || "default-county-id",
        targetAmount: "85000.00",
        raisedAmount: "34100.00",
        imageUrl: "https://images.unsplash.com/photo-1569163139394-de4e4f43e4e5?w=500&h=300&fit=crop",
        websiteUrl: "https://example.org/south-florida-environmental",
        contactEmail: "info@soflaenvironment.org",
        verifiedNonprofit: true,
        taxId: "59-5678901",
        isActive: true,
        createdBy: "system"
      },
      {
        name: "Los Angeles Senior Care Support",
        description: "Providing essential services and companionship for elderly residents in Los Angeles County. We offer meal delivery, transportation, wellness checks, and social activities to combat senior isolation.",
        category: "senior_care",
        countyId: losAngelesCounty[0]?.id || "default-county-id",
        targetAmount: "40000.00",
        raisedAmount: "15600.00",
        imageUrl: "https://images.unsplash.com/photo-1559757148-5c350d0d3c56?w=500&h=300&fit=crop",
        websiteUrl: "https://example.org/la-senior-care",
        contactEmail: "support@laseniorcare.org",
        verifiedNonprofit: true,
        taxId: "95-6789012",
        isActive: true,
        createdBy: "system"
      },
      {
        name: "Chicago Veterans Support Network",
        description: "Supporting veterans in Cook County with housing assistance, job placement, mental health services, and community integration. We honor those who served by helping them thrive in civilian life.",
        category: "veterans_support",
        countyId: cookCounty[0]?.id || "default-county-id",
        targetAmount: "60000.00",
        raisedAmount: "22800.00",
        imageUrl: "https://images.unsplash.com/photo-1606327048647-8cf1b3c7cd86?w=500&h=300&fit=crop",
        websiteUrl: "https://example.org/chicago-veterans",
        contactEmail: "veterans@chicagovets.org",
        verifiedNonprofit: true,
        taxId: "36-7890123",
        isActive: true,
        createdBy: "system"
      },
      {
        name: "Houston Community Health Clinic",
        description: "Free and low-cost healthcare services for uninsured families in Harris County. We provide primary care, dental services, mental health counseling, and health education programs.",
        category: "healthcare",
        countyId: harrisCounty[0]?.id || "default-county-id",
        targetAmount: "120000.00",
        raisedAmount: "48600.00",
        imageUrl: "https://images.unsplash.com/photo-1559757175-0eb30cd8c063?w=500&h=300&fit=crop",
        websiteUrl: "https://example.org/houston-health-clinic",
        contactEmail: "care@houstonhealthclinic.org",
        verifiedNonprofit: true,
        taxId: "74-8901234",
        isActive: true,
        createdBy: "system"
      }
    ];

    // Insert causes one by one to handle any duplicates
    for (const cause of sampleCauses) {
      try {
        const [insertedCause] = await db
          .insert(foundationCauses)
          .values(cause)
          .returning();
        
        console.log(`✓ Created cause: ${insertedCause.name} (${insertedCause.category})`);
      } catch (error) {
        console.log(`- Skipped duplicate cause: ${cause.name}`);
      }
    }

    console.log('Foundation causes seeding completed successfully!');
    
  } catch (error) {
    console.error('Error seeding foundation causes:', error);
    throw error;
  }
}

// Run if called directly
if (import.meta.url.endsWith(process.argv[1])) {
  seedFoundationCauses()
    .then(() => {
      console.log('Seeding completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Seeding failed:', error);
      process.exit(1);
    });
}

export { seedFoundationCauses };