import { US_STATES_COUNTIES } from '../shared/states-counties.js';
import { drizzle } from 'drizzle-orm/neon-http';
import { neon } from '@neondatabase/serverless';
import { counties } from '../shared/schema.js';

const sql = neon(process.env.DATABASE_URL!);
const db = drizzle(sql);

async function seedCounties() {
  console.log('Starting county seeding...');
  
  // Clear existing counties
  await db.delete(counties);
  console.log('Cleared existing counties');
  
  // Prepare all counties for batch insert
  const allCounties = [];
  
  for (const state of US_STATES_COUNTIES) {
    for (const county of state.counties) {
      allCounties.push({
        fips: county.fipsCode,
        name: county.name,
        stateCode: county.state,
      });
    }
  }
  
  console.log(`Inserting ${allCounties.length} counties...`);
  
  // Insert in batches of 100 to avoid query size limits
  const batchSize = 100;
  for (let i = 0; i < allCounties.length; i += batchSize) {
    const batch = allCounties.slice(i, i + batchSize);
    await db.insert(counties).values(batch);
    console.log(`Inserted batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(allCounties.length / batchSize)}`);
  }
  
  console.log('✅ County seeding completed!');
  
  // Verify the results
  const count = await db.select().from(counties);
  console.log(`Total counties in database: ${count.length}`);
  
  process.exit(0);
}

seedCounties().catch((error) => {
  console.error('Error seeding counties:', error);
  process.exit(1);
});