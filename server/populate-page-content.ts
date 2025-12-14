import { db } from "../src/db/drizzle-mock";
import { 
  communityPosts, 
  foundationCauses,
  workers,
  tasks,
  taskCategories,
  advertisements,
  users
} from "../shared/schema";

export async function populatePageContent() {
  try {
    console.log("🌱 Populating page content...");

    // Get a valid user ID to use for posts
    const existingUser = await db.select({ id: users.id }).from(users).limit(1);
    const userId = existingUser[0]?.id || '2b04168c-78e6-451c-a953-d9f7b7bc48c0';

    // Add sample community posts
    await db.insert(communityPosts).values([
      {
        id: 'post-1',
        title: 'Best Roofing Contractor in Los Angeles?',
        content: 'Looking for recommendations for a reliable roofing contractor in the LA area. Need someone experienced with tile roofs. Had some storm damage recently and need quality work.',
        authorId: userId,
        category: 'recommendations',
        scope: 'county',
        stateCode: 'CA',
        countyFips: '06037',
        cityName: 'Los Angeles',
        regionName: 'Los Angeles County',
        likeCount: 12,
        commentCount: 3,
        tags: ['roofing', 'recommendations', 'los-angeles'],
        isPinned: false,
        isPublished: true
      },
      {
        id: 'post-2',
        title: 'Amazing Electrical Work by Sunshine Electric!',
        content: 'Just wanted to share my experience with Sunshine Electrical Services. They did an incredible job upgrading my electrical panel and installing smart home features. Highly recommend!',
        authorId: userId,
        category: 'recommendations',
        scope: 'county',
        stateCode: 'CA',
        countyFips: '06059',
        cityName: 'Orange',
        regionName: 'Orange County',
        likeCount: 18,
        commentCount: 5,
        tags: ['electrical', 'smart-home', 'excellent-service'],
        isPinned: true,
        isPublished: true
      },
      {
        id: 'post-3',
        title: 'Community Workshop: DIY Home Maintenance',
        content: 'Join us for a free workshop on basic home maintenance! Learn simple repairs, seasonal prep, and when to call professionals. Saturday 2PM at the community center.',
        authorId: userId,
        category: 'events',
        scope: 'county',
        stateCode: 'CA',
        countyFips: '06073',
        cityName: 'San Diego',
        regionName: 'San Diego County',
        likeCount: 25,
        commentCount: 8,
        tags: ['workshop', 'diy', 'community-event'],
        isPinned: false,
        isPublished: true
      }
    ]).onConflictDoNothing();

    // Add sample foundation causes
    await db.insert(foundationCauses).values([
      {
        id: 'cause-1',
        name: 'Rebuild Local Community Center After Storm Damage',
        description: 'Our beloved community center was severely damaged in recent storms. Help us rebuild this vital hub where families gather, children learn, and neighbors connect. Every donation brings us closer to reopening our doors.',
        category: 'community_development',
        countyId: 'los-angeles',
        targetAmount: '50000.00',
        raisedAmount: '12500.00',
        verifiedNonprofit: true,
        contactEmail: 'contact@lacommunity.org',
        isActive: true
      },
      {
        id: 'cause-2',
        name: 'Emergency Shelter Repairs for Homeless Veterans',
        description: 'Critical repairs needed for veteran emergency shelter roof and plumbing systems. Over 100 veterans depend on this facility for safe housing while they rebuild their lives.',
        category: 'veterans',
        countyId: 'orange',
        targetAmount: '25000.00',
        raisedAmount: '8750.00',
        verifiedNonprofit: true,
        contactEmail: 'help@ocveterans.org',
        isActive: true
      },
      {
        id: 'cause-3',
        name: 'School Garden Project - Fresh Food for Students',
        description: 'Building raised garden beds and greenhouse for elementary school. Students will learn about nutrition, sustainability, and responsibility while growing fresh produce for the cafeteria.',
        category: 'education',
        countyId: 'riverside',
        targetAmount: '15000.00',
        raisedAmount: '6200.00',
        verifiedNonprofit: true,
        contactEmail: 'gardens@riversideedu.org',
        isActive: true
      }
    ]).onConflictDoNothing();

    // Add task categories
    const categoriesToInsert = [
      {
        id: 'general-labor',
        name: 'General Labor',
        slug: 'general-labor',
        description: 'General construction and manual labor tasks',
        parentId: null,
        sortOrder: 1
      },
      {
        id: 'cleaning',
        name: 'Cleaning & Maintenance',
        slug: 'cleaning-maintenance',
        description: 'Cleaning, organizing, and basic maintenance',
        parentId: null,
        sortOrder: 2
      },
      {
        id: 'landscaping',
        name: 'Landscaping & Yard Work',
        slug: 'landscaping-yard-work',
        description: 'Lawn care, gardening, and outdoor maintenance',
        parentId: null,
        sortOrder: 3
      },
      {
        id: 'delivery',
        name: 'Delivery & Moving',
        slug: 'delivery-moving',
        description: 'Item delivery, furniture moving, and transport',
        parentId: null,
        sortOrder: 4
      }
    ];

    for (const category of categoriesToInsert) {
      await db.insert(taskCategories).values(category).onConflictDoNothing();
    }

    // Add sample workers
    await db.insert(workers).values([
      {
        id: '1',
        userId: 'worker-user-1',
        firstName: 'Maria',
        lastName: 'Rodriguez',
        phone: '(555) 123-4567',
        email: 'maria.rodriguez@email.com',
        hourlyRate: '25.00',
        bio: 'Experienced in general labor, cleaning, and light construction work. Reliable and detail-oriented.',
        skills: ['General Labor', 'Cleaning', 'Organization', 'Basic Carpentry'],
        maxTravelDistance: 20,
        averageRating: '4.8',
        totalJobsCompleted: 67,
        isIdVerified: true,
        verificationStatus: 'approved'
      },
      {
        id: '2', 
        userId: 'worker-user-2',
        firstName: 'James',
        lastName: 'Wilson',
        phone: '(555) 987-6543',
        email: 'james.wilson@email.com', 
        hourlyRate: '30.00',
        bio: 'Landscaping professional with 8+ years experience. Specializes in lawn care, garden maintenance, and outdoor projects.',
        skills: ['Landscaping', 'Lawn Care', 'Garden Design', 'Irrigation', 'Tree Trimming'],
        maxTravelDistance: 25,
        averageRating: '4.9',
        totalJobsCompleted: 124,
        isIdVerified: true,
        verificationStatus: 'approved'
      }
    ]).onConflictDoNothing();

    // Add sample tasks
    const tasksToInsert = [
      {
        id: '1',
        posterId: userId,
        posterType: 'homeowner',
        title: 'Help Clean Out Garage',
        description: 'Need help organizing and cleaning out a cluttered 2-car garage. Some heavy lifting required.',
        categoryId: 'cleaning',
        taskType: 'one_time',
        estimatedHours: 6,
        payType: 'fixed',
        payAmount: '150.00',
        requiredSkills: ['Cleaning', 'Organization'],
        requiresTransportation: false,
        requiresTools: false,
        toolsProvided: false,
        schedulingType: 'flexible',
        requiresIdVerification: true,
        requiresBackgroundCheck: false,
        status: 'open'
      },
      {
        id: '2',
        posterId: userId,
        posterType: 'homeowner',
        title: 'Lawn Mowing and Edging',
        description: 'Weekly lawn maintenance needed for medium-sized front and back yard. Own equipment preferred.',
        categoryId: 'landscaping',
        taskType: 'recurring',
        estimatedHours: 3,
        payType: 'hourly',
        payAmount: '25.00',
        requiredSkills: ['Lawn Care', 'Landscaping'],
        requiresTransportation: false,
        requiresTools: true,
        toolsProvided: false,
        schedulingType: 'recurring',
        requiresIdVerification: true,
        requiresBackgroundCheck: false,
        status: 'open'
      }
    ];

    for (const task of tasksToInsert) {
      await db.insert(tasks).values(task as any).onConflictDoNothing();
    }

    // Advertisements already exist (11 ads in database), skipping population
    
    console.log("✅ Page content populated successfully!");

  } catch (error) {
    console.error("❌ Error populating page content:", error);
    throw error;
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  populatePageContent().then(() => {
    console.log("Page content population completed!");
    process.exit(0);
  }).catch((error) => {
    console.error("Failed to populate page content:", error);
    process.exit(1);
  });
}
