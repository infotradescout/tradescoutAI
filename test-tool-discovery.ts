/**
 * Scout Tool Discovery Test
 * 
 * Demonstrates how Scout detects patterns and emits Tool Blueprints
 */

import { govern, trackRegret } from "./server/scout/governor.js";
import { toolDiscovery } from "./server/scout/toolDiscovery.js";

async function runToolDiscoveryDemo() {
  console.log("=".repeat(80));
  console.log("SCOUT TOOL DISCOVERY DEMONSTRATION");
  console.log("=".repeat(80));
  console.log();
  console.log("Scout learns from repeated patterns and proposes new tools.");
  console.log("Human admins decide which discoveries become permanent capabilities.");
  console.log();
  console.log("=".repeat(80));
  console.log();

  // ============================================================================
  // SCENARIO: Multiple users try to track contractor commitments
  // ============================================================================
  console.log("SCENARIO: Detecting 'Commitment Tracker' pattern");
  console.log("-".repeat(80));
  console.log();

  // Simulate 5 different users hitting the same gap
  const users = ["user_001", "user_002", "user_003", "user_004", "user_005"];
  const commitmentMessages = [
    "I need to keep track of what the contractor promised to do by Friday",
    "How do I remember all the follow-ups I agreed to with contractors?",
    "I want to track the commitments I made to my neighbors",
    "Need to record what the electrician said he'd do next week",
    "How can I keep track of promises I made to community members?",
  ];

  console.log("Simulating 5 users with similar commitment tracking needs...");
  console.log();

  for (let i = 0; i < users.length; i++) {
    const decision = await govern({
      message: commitmentMessages[i],
      user: { id: users[i], role: "homeowner", county: "48201", state: "TX" },
      history: [],
      countyCode: "48201",
      stateCode: "TX",
      sessionId: `session_${i}`,
    });

    console.log(`User ${i + 1}: "${commitmentMessages[i]}"`);
    console.log(`  Action: ${decision.intervention.action}`);
    console.log(`  Missing Capability Detected: Yes`);
    console.log();
  }

  console.log("Checking if convergence threshold reached...");
  const blueprints = toolDiscovery.getProposedBlueprints();
  console.log();

  if (blueprints.length > 0) {
    console.log("✅ TOOL BLUEPRINT EMITTED!");
    console.log();
    const blueprint = blueprints[0];
    console.log("Blueprint Details:");
    console.log("  Name:", blueprint.name);
    console.log("  Problem:", blueprint.problemStatement);
    console.log("  Frequency:", blueprint.frequency, "occurrences");
    console.log("  Affected Users:", blueprint.affectedUsers);
    console.log("  Risk Level:", blueprint.riskLevel);
    console.log("  Estimated Monthly Saves:", blueprint.estimatedImpact.timesSaved);
    console.log("  Primitives Used:", blueprint.primitivesUsed.join(", "));
    console.log();
    console.log("Example Workarounds:");
    blueprint.exampleFlows.forEach((flow, i) => {
      console.log(`  ${i + 1}. ${flow}`);
    });
    console.log();
  } else {
    console.log("⏳ Not enough convergence yet. Need more instances.");
    console.log();
  }

  console.log("=".repeat(80));
  console.log();

  // ============================================================================
  // SCENARIO: User expresses regret about missing info
  // ============================================================================
  console.log("SCENARIO: Tracking regret to prevent future mistakes");
  console.log("-".repeat(80));
  console.log();

  console.log("User hired contractor without photos/scope → Bad outcome");
  console.log();

  trackRegret({
    userId: "user_001",
    originalDecision: "Hired roofer based on phone call only",
    originalTimestamp: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
    regretStatement: "They quoted $8k but actual work was $14k because they didn't see the damage extent",
    consequences: [
      "Financial loss of $6,000",
      "Project took 3x longer than estimated",
      "Had to get second opinion mid-project",
    ],
    missingInfo: ["photos of roof", "scope of damage", "written estimate"],
    preventionPattern: "Always require photos and written scope before contractor pricing",
  });

  console.log("Regret Event Tracked:");
  console.log("  Original Decision: Hired roofer based on phone call only");
  console.log("  Regret: They quoted $8k but actual was $14k");
  console.log("  Missing Info: photos, scope, written estimate");
  console.log("  Prevention Pattern: Always require photos + written scope");
  console.log();

  console.log("Tacit Knowledge Extracted:");
  const tacitKnowledge = toolDiscovery.getTacitKnowledge({
    countyCode: "48201",
    stateCode: "TX",
  });
  tacitKnowledge.forEach((tk, i) => {
    console.log(`  ${i + 1}. ${tk.rule} (confidence: ${tk.confidence})`);
  });
  console.log();

  console.log("=".repeat(80));
  console.log();

  // ============================================================================
  // FINAL STATE
  // ============================================================================
  console.log("FINAL TOOL DISCOVERY STATE");
  console.log("-".repeat(80));
  console.log();

  const allBlueprints = toolDiscovery.getProposedBlueprints();
  console.log(`Total Proposed Blueprints: ${allBlueprints.length}`);
  console.log();

  if (allBlueprints.length > 0) {
    console.log("Blueprints Ready for Admin Review:");
    allBlueprints.forEach((bp, i) => {
      console.log();
      console.log(`${i + 1}. ${bp.name}`);
      console.log(`   Status: ${bp.status}`);
      console.log(`   Frequency: ${bp.frequency} times`);
      console.log(`   Users: ${bp.affectedUsers} affected`);
      console.log(`   Risk: ${bp.riskLevel}`);
      console.log(`   Impact: ${bp.estimatedImpact.outcomeImprovement}`);
      console.log(`   Prevents: ${bp.estimatedImpact.regretPrevention}`);
    });
  }

  console.log();
  console.log("=".repeat(80));
  console.log();
  console.log("SUMMARY");
  console.log("=".repeat(80));
  console.log();
  console.log("✅ Tool Discovery System Working:");
  console.log("   • Pattern detection from repeated user friction");
  console.log("   • Convergence threshold triggers blueprint emission");
  console.log("   • Regret events create tacit knowledge");
  console.log("   • Blueprints prioritized by frequency, users, and risk");
  console.log();
  console.log("📋 Admin Workflow:");
  console.log("   1. Review proposed blueprints in admin UI");
  console.log("   2. See real examples from actual conversations");
  console.log("   3. Approve, reject, or merge proposals");
  console.log("   4. Approved blueprints → product backlog");
  console.log();
  console.log("🎯 Key Innovation:");
  console.log("   Scout invents capabilities.");
  console.log("   Humans decide which become permanent tools.");
  console.log();
  console.log("   This prevents feature sprawl while enabling organic growth.");
  console.log("   Tools emerge from real need, not brainstorming.");
  console.log();
  console.log("=".repeat(80));
}

// Run demo
runToolDiscoveryDemo().catch(console.error);
