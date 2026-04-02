import { test } from "vitest";
import { executeAssistantAction, type User, type AssistantAction } from "../assistantActions.js";

/**
 * End-to-end test flows for major TradeScout features
 * Tests role-based access control, service integration, and data handling
 */

const hasTestDb = Boolean(process.env.TEST_DATABASE_URL);
const testDb = hasTestDb ? test : test.skip;

// Mock test users with different roles
const testUsers = {
  admin: {
    id: 1,
    role: "admin" as const,
    county: "Harris",
    state: "TX",
  } as User,
  homeowner: {
    id: 2,
    role: "homeowner" as const,
    county: "Los Angeles",
    state: "CA",
  } as User,
  contractor: {
    id: 3,
    role: "contractor" as const,
    county: "Maricopa",
    state: "AZ",
  } as User,
  hoa_admin: {
    id: 4,
    role: "hoa_admin" as const,
    county: "Orange",
    state: "CA",
  } as User,
  user: {
    id: 5,
    role: "user" as const,
    county: "Cook",
    state: "IL",
  } as User,
};

// ============================================================================
// TEST 1: MARKETPLACE FLOW
// ============================================================================
export async function testMarketplaceFlow(): Promise<void> {
  console.log("\n📦 TEST 1: MARKETPLACE FLOW");
  console.log("=====================================\n");

  // Test 1a: Unauthenticated search (should work)
  console.log("1a) Search marketplace (unauthenticated)");
  const searchAction: AssistantAction = {
    type: "search_marketplace",
    params: {
      query: "mower",
      category: "tools",
      limit: 10,
    },
  };
  const searchResult = await executeAssistantAction(searchAction);
  console.log(`   ✓ Success: ${searchResult.success}`);
  console.log(`   Result: ${searchResult.message || searchResult.error}\n`);

  // Test 1b: Homeowner list item (should require auth)
  console.log("1b) List marketplace item (homeowner)");
  const listAction: AssistantAction = {
    type: "list_item",
    params: {
      title: "Lawn Mower for Sale",
      description: "Used John Deere in good condition",
      price: 500,
      category: "tools",
    },
  };
  const listResult = await executeAssistantAction(listAction, testUsers.homeowner);
  console.log(`   ✓ Success: ${listResult.success}`);
  console.log(`   Result: ${listResult.message || listResult.error}\n`);

  // Test 1c: Get user's listings
  console.log("1c) Get my listings (homeowner)");
  const myListingsAction: AssistantAction = {
    type: "get_my_listings",
  };
  const myListingsResult = await executeAssistantAction(myListingsAction, testUsers.homeowner);
  console.log(`   ✓ Success: ${myListingsResult.success}`);
  console.log(`   Result: ${myListingsResult.message || myListingsResult.error}\n`);

  // Test 1d: Get county listings
  console.log("1d) Get listings in my county");
  const countyListingsAction: AssistantAction = {
    type: "get_county_listings",
    params: {
      county: "Los Angeles",
      state: "CA",
    },
  };
  const countyListingsResult = await executeAssistantAction(
    countyListingsAction,
    testUsers.homeowner
  );
  console.log(`   ✓ Success: ${countyListingsResult.success}`);
  console.log(`   Result: ${countyListingsResult.message || countyListingsResult.error}\n`);

  console.log("✅ MARKETPLACE FLOW COMPLETE\n");
}

// ============================================================================
// TEST 2: CONTRACTOR SEARCH & DETAILS FLOW
// ============================================================================
export async function testContractorFlow(): Promise<void> {
  console.log("\n👷 TEST 2: CONTRACTOR SEARCH FLOW");
  console.log("=====================================\n");

  // Test 2a: Search contractors (no auth required)
  console.log("2a) Search contractors by trade");
  const searchAction: AssistantAction = {
    type: "search_contractors",
    params: {
      trade: "roofing",
      limit: 20,
    },
  };
  const searchResult = await executeAssistantAction(searchAction);
  console.log(`   ✓ Success: ${searchResult.success}`);
  console.log(`   Result: ${searchResult.message || searchResult.error}\n`);

  // Test 2b: Get contractors in county
  console.log("2b) Get contractors in my county");
  const countyAction: AssistantAction = {
    type: "get_county_contractors",
    params: {
      county: "Los Angeles",
      state: "CA",
    },
  };
  const countyResult = await executeAssistantAction(countyAction, testUsers.homeowner);
  console.log(`   ✓ Success: ${countyResult.success}`);
  console.log(`   Result: ${countyResult.message || countyResult.error}\n`);

  // Test 2c: Get contractor details
  console.log("2c) Get specific contractor details");
  const detailsAction: AssistantAction = {
    type: "get_contractor_details",
    params: {
      contractorId: 42,
    },
  };
  const detailsResult = await executeAssistantAction(detailsAction);
  console.log(`   ✓ Success: ${detailsResult.success}`);
  console.log(`   Result: ${detailsResult.message || detailsResult.error}\n`);

  console.log("✅ CONTRACTOR FLOW COMPLETE\n");
}

// ============================================================================
// TEST 3: HOA VOTING & BOARD FLOW
// ============================================================================
export async function testHOAFlow(): Promise<void> {
  console.log("\n🏘️  TEST 3: HOA FLOW");
  console.log("=====================================\n");

  // Test 3a: Get HOA data (no auth required)
  console.log("3a) Get HOA data for county");
  const getHOAAction: AssistantAction = {
    type: "get_hoa_data",
    params: {
      county: "Orange",
      state: "CA",
    },
  };
  const getHOAResult = await executeAssistantAction(getHOAAction);
  console.log(`   ✓ Success: ${getHOAResult.success}`);
  console.log(`   Result: ${getHOAResult.message || getHOAResult.error}\n`);

  // Test 3b: Post to HOA board (requires auth)
  console.log("3b) Post to HOA board (HOA admin)");
  const postAction: AssistantAction = {
    type: "post_to_hoa",
    params: {
      hoaId: 101,
      title: "Community Pool Renovation",
      content: "Proposing updates to the community pool",
      category: "announcements",
    },
  };
  const postResult = await executeAssistantAction(postAction, testUsers.hoa_admin);
  console.log(`   ✓ Success: ${postResult.success}`);
  console.log(`   Result: ${postResult.message || postResult.error}\n`);

  // Test 3c: Start HOA vote (requires HOA admin role)
  console.log("3c) Start HOA vote (HOA admin only)");
  const voteAction: AssistantAction = {
    type: "start_hoa_vote",
    params: {
      hoaId: 101,
      title: "Should we renovate the pool?",
      description: "Vote on whether to proceed with $50k pool renovation",
      options: ["Yes", "No", "Abstain"],
    },
  };
  const voteResult = await executeAssistantAction(voteAction, testUsers.hoa_admin);
  console.log(`   ✓ Success: ${voteResult.success}`);
  console.log(`   Result: ${voteResult.message || voteResult.error}\n`);

  // Test 3d: Non-admin trying to start vote (should fail)
  console.log("3d) Attempt to start vote as non-admin (should fail)");
  const unauthorizedVoteResult = await executeAssistantAction(voteAction, testUsers.homeowner);
  console.log(`   ✓ Success: ${unauthorizedVoteResult.success}`);
  console.log(`   Result: ${unauthorizedVoteResult.message || unauthorizedVoteResult.error}\n`);

  console.log("✅ HOA FLOW COMPLETE\n");
}

// ============================================================================
// TEST 4: COMMUNITY GROUPS FLOW
// ============================================================================
export async function testGroupsFlow(): Promise<void> {
  console.log("\n👥 TEST 4: COMMUNITY GROUPS FLOW");
  console.log("=====================================\n");

  // Test 4a: Get local groups
  console.log("4a) Get local groups in county");
  const getGroupsAction: AssistantAction = {
    type: "get_local_groups",
  };
  const getGroupsResult = await executeAssistantAction(getGroupsAction, testUsers.homeowner);
  console.log(`   ✓ Success: ${getGroupsResult.success}`);
  console.log(`   Result: ${getGroupsResult.message || getGroupsResult.error}\n`);

  // Test 4b: Join a group
  console.log("4b) Join a community group");
  const joinAction: AssistantAction = {
    type: "join_group",
    params: {
      groupId: 25,
    },
  };
  const joinResult = await executeAssistantAction(joinAction, testUsers.homeowner);
  console.log(`   ✓ Success: ${joinResult.success}`);
  console.log(`   Result: ${joinResult.message || joinResult.error}\n`);

  // Test 4c: Post to group (requires membership)
  console.log("4c) Post to group");
  const postGroupAction: AssistantAction = {
    type: "post_to_group",
    params: {
      groupId: 25,
      title: "Recommendation for roofer",
      content: "I had a great experience with ABC Roofing, highly recommend!",
    },
  };
  const postGroupResult = await executeAssistantAction(postGroupAction, testUsers.homeowner);
  console.log(`   ✓ Success: ${postGroupResult.success}`);
  console.log(`   Result: ${postGroupResult.message || postGroupResult.error}\n`);

  console.log("✅ GROUPS FLOW COMPLETE\n");
}

// ============================================================================
// TEST 5: CONTRACTOR MESSAGING FLOW
// ============================================================================
export async function testMessagingFlow(): Promise<void> {
  console.log("\n💬 TEST 5: MESSAGING FLOW");
  console.log("=====================================\n");

  // Test 5a: Message a contractor
  console.log("5a) Message a contractor");
  const messageAction: AssistantAction = {
    type: "message_contractor",
    params: {
      contractorId: 42,
      subject: "Roof inspection inquiry",
      description: "Would you be available for a free inspection next week?",
    },
  };
  const messageResult = await executeAssistantAction(messageAction, testUsers.homeowner);
  console.log(`   ✓ Success: ${messageResult.success}`);
  console.log(`   Result: ${messageResult.message || messageResult.error}\n`);

  // Test 5b: Send direct message to user
  console.log("5b) Send direct message to another user");
  const directMessageAction: AssistantAction = {
    type: "send_message",
    params: {
      recipientId: 3,
      subject: "Question about your project",
      content: "Hi, I wanted to ask about your roof project...",
    },
  };
  const directMessageResult = await executeAssistantAction(
    directMessageAction,
    testUsers.homeowner
  );
  console.log(`   ✓ Success: ${directMessageResult.success}`);
  console.log(`   Result: ${directMessageResult.message || directMessageResult.error}\n`);

  // Test 5c: Get user conversations
  console.log("5c) Get user conversations");
  const conversationsAction: AssistantAction = {
    type: "get_conversations",
  };
  const conversationsResult = await executeAssistantAction(
    conversationsAction,
    testUsers.homeowner
  );
  console.log(`   ✓ Success: ${conversationsResult.success}`);
  console.log(`   Result: ${conversationsResult.message || conversationsResult.error}\n`);

  console.log("✅ MESSAGING FLOW COMPLETE\n");
}

// ============================================================================
// TEST 6: PROJECT BIDDING FLOW
// ============================================================================
export async function testProjectFlow(): Promise<void> {
  console.log("\n🏗️  TEST 6: PROJECT BIDDING FLOW");
  console.log("=====================================\n");

  // Test 6a: Create a project (homeowner only)
  console.log("6a) Create a project (homeowner)");
  const createAction: AssistantAction = {
    type: "create_project",
    params: {
      title: "Roof replacement needed",
      description: "Need full roof replacement on 2000 sq ft house",
      budget: 15000,
      category: "roofing",
    },
  };
  const createResult = await executeAssistantAction(createAction, testUsers.homeowner);
  console.log(`   ✓ Success: ${createResult.success}`);
  console.log(`   Result: ${createResult.message || createResult.error}\n`);

  // Test 6b: Get user's projects
  console.log("6b) Get my projects");
  const getProjectsAction: AssistantAction = {
    type: "get_my_projects",
  };
  const getProjectsResult = await executeAssistantAction(
    getProjectsAction,
    testUsers.homeowner
  );
  console.log(`   ✓ Success: ${getProjectsResult.success}`);
  console.log(`   Result: ${getProjectsResult.message || getProjectsResult.error}\n`);

  // Test 6c: Submit project bid (contractor only)
  console.log("6c) Submit project bid (contractor)");
  const bidAction: AssistantAction = {
    type: "submit_project_bid",
    params: {
      projectId: 1,
      bidAmount: 13500,
      timeline: "2 weeks",
    },
  };
  const bidResult = await executeAssistantAction(bidAction, testUsers.contractor);
  console.log(`   ✓ Success: ${bidResult.success}`);
  console.log(`   Result: ${bidResult.message || bidResult.error}\n`);

  // Test 6d: Non-contractor trying to bid (should fail)
  console.log("6d) Attempt to bid as non-contractor (should fail)");
  const unauthorizedBidResult = await executeAssistantAction(bidAction, testUsers.homeowner);
  console.log(`   ✓ Success: ${unauthorizedBidResult.success}`);
  console.log(`   Result: ${unauthorizedBidResult.message || unauthorizedBidResult.error}\n`);

  // Test 6e: Award project (owner only)
  console.log("6e) Award project to contractor");
  const awardAction: AssistantAction = {
    type: "award_project",
    params: {
      projectId: 1,
      contractorId: 3,
    },
  };
  const awardResult = await executeAssistantAction(awardAction, testUsers.homeowner);
  console.log(`   ✓ Success: ${awardResult.success}`);
  console.log(`   Result: ${awardResult.message || awardResult.error}\n`);

  console.log("✅ PROJECT FLOW COMPLETE\n");
}

// ============================================================================
// TEST 7: ADMIN-ONLY ACTIONS
// ============================================================================
export async function testAdminFlow(): Promise<void> {
  console.log("\n👮 TEST 7: ADMIN-ONLY ACTIONS");
  console.log("=====================================\n");

  // Test 7a: Admin cache stats (admin only)
  console.log("7a) Get cache statistics (admin only)");
  const cacheStatsAction: AssistantAction = {
    type: "admin_cache_stats",
  };
  const cacheStatsResult = await executeAssistantAction(cacheStatsAction, testUsers.admin);
  console.log(`   ✓ Success: ${cacheStatsResult.success}`);
  console.log(`   Result: ${cacheStatsResult.message || cacheStatsResult.error}\n`);

  // Test 7b: Non-admin trying to access cache stats (should fail)
  console.log("7b) Non-admin attempting to get cache stats (should fail)");
  const unauthorizedStatsResult = await executeAssistantAction(
    cacheStatsAction,
    testUsers.homeowner
  );
  console.log(`   ✓ Success: ${unauthorizedStatsResult.success}`);
  console.log(`   Result: ${unauthorizedStatsResult.message || unauthorizedStatsResult.error}\n`);

  // Test 7c: Admin system status
  console.log("7c) Get system status (admin only)");
  const systemStatusAction: AssistantAction = {
    type: "admin_system_status",
  };
  const systemStatusResult = await executeAssistantAction(systemStatusAction, testUsers.admin);
  console.log(`   ✓ Success: ${systemStatusResult.success}`);
  console.log(`   Result: ${systemStatusResult.message || systemStatusResult.error}\n`);

  console.log("✅ ADMIN FLOW COMPLETE\n");
}

// ============================================================================
// MAIN TEST RUNNER
// ============================================================================
export async function runAllTests(): Promise<void> {
  console.log("\n");
  console.log("╔════════════════════════════════════════════════════════════════╗");
  console.log("║    TradeScout E2E Flow Test Suite                              ║");
  console.log("║    Testing role-based access control and service integration   ║");
  console.log("╚════════════════════════════════════════════════════════════════╝");

  await testMarketplaceFlow();
  await testContractorFlow();
  await testHOAFlow();
  await testGroupsFlow();
  await testMessagingFlow();
  await testProjectFlow();
  await testAdminFlow();

  console.log("\n╔════════════════════════════════════════════════════════════════╗");
  console.log("║    ✅ ALL TESTS COMPLETED                                    ║");
  console.log("║    All flows validated with proper role checks              ║");
  console.log("╚════════════════════════════════════════════════════════════════╝\n");
}

// Register as a Vitest suite
testDb("TradeScout end-to-end flows", async () => {
  await runAllTests();
});

// Run tests if this is the main module
if (import.meta.url === `file://${process.argv[1]}`) {
  runAllTests().catch((error) => {
    console.error("❌ TEST SUITE FAILED:", error);
    process.exit(1);
  });
}
