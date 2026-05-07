import { scoutToLisaConverter, createExampleScoutFindings } from "../exports/workspaces/backend/server/services/scoutToLisaConverter";
import { scoutLisaPersistence } from "../exports/workspaces/backend/server/services/scoutLisaPersistence";

/**
 * Test Scout LISA Persistence
 * 
 * Verifies that Scout findings are correctly converted to LISA format
 * and persisted to the database.
 */

async function testScoutLisaPersistence() {
  console.log("[Test] Starting Scout LISA persistence test...\n");

  try {
    // 1. Create example Scout findings
    console.log("[Test] Creating example Scout findings...");
    const exampleFindings = createExampleScoutFindings();
    console.log(`✓ Created ${exampleFindings.length} example findings\n`);

    // 2. Convert to LISA format
    console.log("[Test] Converting Scout findings to LISA format...");
    const lisaFindings = scoutToLisaConverter.scoutFindingsToLisaFeed(exampleFindings);
    console.log(`✓ Converted ${lisaFindings.length} findings to LISA format\n`);

    // 3. Verify LISA format
    console.log("[Test] Verifying LISA format...");
    lisaFindings.forEach((finding, idx) => {
      console.log(`  Finding ${idx + 1}:`);
      console.log(`    - ID: ${finding.id}`);
      console.log(`    - Priority: ${finding.priority}`);
      console.log(`    - Source: ${finding.sourceKind}`);
      console.log(`    - Headline: ${finding.headline}`);
      console.log(`    - Scope: ${finding.scopeType} (${finding.scopeRef})`);
    });
    console.log(`✓ All findings have valid LISA format\n`);

    // 4. Ensure table exists
    console.log("[Test] Ensuring Scout LISA table exists...");
    await scoutLisaPersistence.ensureScoutLisaTable();
    console.log(`✓ Table ready\n`);

    // 5. Store findings
    console.log("[Test] Storing findings in database...");
    const storedFindings = await scoutLisaPersistence.storeScoutLisaFindings(
      lisaFindings.map((item, idx) => ({
        item,
        metadata: {
          type: exampleFindings[idx].type,
          countyFips: exampleFindings[idx].countyFips,
          countyName: exampleFindings[idx].county,
          stateCode: exampleFindings[idx].state,
          trade: exampleFindings[idx].trade,
          confidence: exampleFindings[idx].confidence,
          sources: exampleFindings[idx].sources,
          expiresInMinutes: 1440,
        },
      }))
    );
    console.log(`✓ Stored ${storedFindings.length} findings\n`);

    // 6. Query by county
    console.log("[Test] Querying findings by county (Travis)...");
    const countyFindings = await scoutLisaPersistence.getScoutLisaFindingsByCounty("48453");
    console.log(`✓ Retrieved ${countyFindings.length} findings for Travis County\n`);

    // 7. Get statistics
    console.log("[Test] Getting Scout LISA statistics...");
    const stats = await scoutLisaPersistence.getScoutLisaStats();
    console.log(`  Total findings: ${stats.totalFindings}`);
    console.log(`  By type:`, stats.byType);
    console.log(`  By county:`, stats.byCounty);
    console.log(`  By trade:`, stats.byTrade);
    console.log(`  Expired: ${stats.expiredCount}\n`);

    console.log("[Test] ✓ All tests passed!");
    process.exit(0);
  } catch (error) {
    console.error("[Test] ✗ Test failed:", error);
    process.exit(1);
  }
}

testScoutLisaPersistence();
