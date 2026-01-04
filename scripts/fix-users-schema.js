import { Pool } from "@neondatabase/serverless";
import dotenv from "dotenv";
dotenv.config();

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error("DATABASE_URL is missing");
  process.exit(1);
}

const pool = new Pool({ connectionString });

async function run() {
  try {
    console.log("Adding missing columns to users table...");
    
    // business_slug
    console.log("- business_slug");
    await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS business_slug VARCHAR(255);`);
    // Check if index exists before creating to avoid error if using IF NOT EXISTS on index which is pg 9.5+ (Neon is 15+ so it's fine)
    await pool.query(`CREATE UNIQUE INDEX IF NOT EXISTS users_business_slug_key ON users(business_slug);`);
    
    // facebook_id
    console.log("- facebook_id");
    await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS facebook_id VARCHAR(255);`);
    
    // google_id
    console.log("- google_id");
    await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS google_id VARCHAR(255);`);
    
    console.log("Schema patch complete.");
  } catch (err) {
    console.error("Error patching schema:", err);
  } finally {
    await pool.end();
  }
}

run();
