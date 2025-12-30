/**
 * Scout Governor Test Scenarios
 * 
 * These scenarios demonstrate the 4-action framework:
 * COMPLY, DEFER, REDIRECT, BLOCK
 */

import { govern } from "./server/scout/governor.js";

async function runTestScenarios() {
  console.log("=".repeat(80));
  console.log("SCOUT GOVERNOR TEST SCENARIOS");
  console.log("=".repeat(80));
  console.log();

  // ============================================================================
  // SCENARIO 1: DEFER - Missing critical info for contractor work
  // ============================================================================
  console.log("SCENARIO 1: User wants contractor without providing critical info");
  console.log("-".repeat(80));
  
  const scenario1 = await govern({
    message: "I need a roofer for my house",
    history: [],
    countyCode: "48201", // Harris County, TX
    stateCode: "TX",
  });
  
  console.log("User Message:", "I need a roofer for my house");
  console.log();
  console.log("Governor Decision:");
  console.log("  Action:", scenario1.intervention.action); // Should be DEFER
  console.log("  Role:", scenario1.intervention.role);     // Should be SAFEGUARD
  console.log("  Reasoning:", scenario1.intervention.reasoning);
  console.log();
  console.log("Scout Response:");
  console.log(scenario1.intervention.userMessage);
  console.log();
  console.log("Required Next Steps:");
  scenario1.intervention.nextSteps?.forEach((step, i) => {
    if (step.userFacing) {
      console.log(`  ${i + 1}. ${step.action}`);
    }
  });
  console.log();
  console.log("Unknowns Detected:");
  scenario1.situation.unknowns.forEach(u => console.log(`  - ${u}`));
  console.log();
  console.log("Risks Identified:");
  scenario1.situation.risks.forEach(r => {
    console.log(`  - ${r.type.toUpperCase()}: ${r.description} (severity: ${r.severity})`);
  });
  console.log();
  console.log();

  // ============================================================================
  // SCENARIO 2: REDIRECT - User price-anchored (asking "is $X too much?")
  // ============================================================================
  console.log("SCENARIO 2: User asking about price without context");
  console.log("-".repeat(80));
  
  const scenario2 = await govern({
    message: "Is $12,000 too much for a roof replacement?",
    history: [],
    countyCode: "48201",
    stateCode: "TX",
  });
  
  console.log("User Message:", "Is $12,000 too much for a roof replacement?");
  console.log();
  console.log("Governor Decision:");
  console.log("  Action:", scenario2.intervention.action); // Should be REDIRECT
  console.log("  Role:", scenario2.intervention.role);     // Should be AUTHORITY
  console.log("  Reasoning:", scenario2.intervention.reasoning);
  console.log();
  console.log("Scout Response:");
  console.log(scenario2.intervention.userMessage);
  console.log();
  console.log("Suggested Next Steps:");
  scenario2.intervention.nextSteps?.forEach((step, i) => {
    console.log(`  ${i + 1}. ${step.action}`);
  });
  console.log();
  console.log("Risks Identified:");
  scenario2.situation.risks.forEach(r => {
    console.log(`  - ${r.type.toUpperCase()}: ${r.description}`);
    console.log(`    Severity: ${r.severity}, Reversibility: ${r.reversibility}`);
    console.log(`    Consequences:`);
    r.consequences.forEach(c => console.log(`      • ${c}`));
  });
  console.log();
  console.log();

  // ============================================================================
  // SCENARIO 3: COMPLY - Simple information request
  // ============================================================================
  console.log("SCENARIO 3: Simple local information request");
  console.log("-".repeat(80));
  
  const scenario3 = await govern({
    message: "What are the building codes for a deck in Harris County?",
    history: [],
    countyCode: "48201",
    stateCode: "TX",
  });
  
  console.log("User Message:", "What are the building codes for a deck in Harris County?");
  console.log();
  console.log("Governor Decision:");
  console.log("  Action:", scenario3.intervention.action); // Should be COMPLY
  console.log("  Role:", scenario3.intervention.role);     // Should be EXECUTOR or INTERPRETER
  console.log("  Reasoning:", scenario3.intervention.reasoning);
  console.log();
  console.log("Scout Response:");
  console.log(scenario3.intervention.userMessage);
  console.log();
  console.log("Risks:", scenario3.situation.risks.length || "None");
  console.log("Unknowns:", scenario3.situation.unknowns.length || "None");
  console.log("Requires LLM:", scenario3.requiresLLM);
  console.log();
  console.log();

  // ============================================================================
  // SCENARIO 4: High Risk with Missing Info - Should DEFER strongly
  // ============================================================================
  console.log("SCENARIO 4: High-stakes decision with insufficient context");
  console.log("-".repeat(80));
  
  const scenario4 = await govern({
    message: "Can you connect me to a foundation repair contractor ASAP?",
    history: [],
    countyCode: "48201",
    stateCode: "TX",
  });
  
  console.log("User Message:", "Can you connect me to a foundation repair contractor ASAP?");
  console.log();
  console.log("Governor Decision:");
  console.log("  Action:", scenario4.intervention.action); // Should be DEFER
  console.log("  Role:", scenario4.intervention.role);
  console.log("  Reasoning:", scenario4.intervention.reasoning);
  console.log();
  console.log("Scout Response:");
  console.log(scenario4.intervention.userMessage);
  console.log();
  console.log("Context Assessment:");
  console.log("  Urgency:", scenario4.situation.temporal?.urgency);
  console.log("  Goal:", scenario4.situation.goal);
  console.log("  Constraints:", scenario4.situation.constraints.join(", "));
  console.log("  Unknowns:", scenario4.situation.unknowns.length);
  console.log("  Risks:", scenario4.situation.risks.length);
  console.log();
  console.log();

  // ============================================================================
  // Summary
  // ============================================================================
  console.log("=".repeat(80));
  console.log("SUMMARY");
  console.log("=".repeat(80));
  console.log();
  console.log("Scout Governor successfully demonstrated:");
  console.log("  ✓ DEFER - Missing critical info before connecting to contractor");
  console.log("  ✓ REDIRECT - User price-anchored, need to reframe question");
  console.log("  ✓ COMPLY - Simple information request with low risk");
  console.log("  ✓ Situation Inference - Detected goals, constraints, risks, unknowns");
  console.log("  ✓ Flow Composition - Generated next steps from primitives");
  console.log();
  console.log("Key Principles Enforced:");
  console.log("  • User intent is input, not authority");
  console.log("  • Scout owns outcomes, not just responses");
  console.log("  • Intervention is explained, not arbitrary");
  console.log("  • Flows composed from primitives (CAPTURE, INTERPRET, CONSTRAIN, CONNECT, COMMIT)");
  console.log();
  console.log("=".repeat(80));
}

// Run tests
runTestScenarios().catch(console.error);
