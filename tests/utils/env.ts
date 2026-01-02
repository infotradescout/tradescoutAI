/**
 * Environment variable loader with validation
 * Ensures all required vars are present and readable
 */

import * as dotenv from 'dotenv';
import * as path from 'path';
import * as fs from 'fs';

const envFile = path.join(__dirname, '..', '.env');
const envExampleFile = path.join(__dirname, '..', '.env.example');

if (!fs.existsSync(envFile)) {
  console.error(`
❌ Missing .env file at ${envFile}

Please copy .env.example to .env and fill in the required values:
  cp tests/.env.example tests/.env

Required variables:
  BASE_URL              - Base URL of the application (e.g., http://localhost:5000)
  TEST_USER_EMAIL       - Test user email (must exist in test database)
  TEST_USER_PASSWORD    - Test user password
  TEST_BUSINESS_SLUG    - Business slug owned by test user (must exist)

Optional variables:
  DEBUG                 - Set to 'true' to run tests in headed mode
  TEST_SEED            - Seed for deterministic random walks (e.g., 12345)
  TEST_INVOICE_RECIPIENT_EMAIL - Email for invoicing tests
  TEST_INVOICE_RECIPIENT_NAME  - Name for invoicing tests
  `);
  process.exit(1);
}

dotenv.config({ path: envFile });

const REQUIRED_VARS = [
  'BASE_URL',
  'TEST_USER_EMAIL',
  'TEST_USER_PASSWORD',
  'TEST_BUSINESS_SLUG',
];

const missingVars = REQUIRED_VARS.filter(v => !process.env[v]);

if (missingVars.length > 0) {
  console.error(`
❌ Missing required environment variables:
${missingVars.map(v => `  - ${v}`).join('\n')}

Please set these in tests/.env
  `);
  process.exit(1);
}

export const env = {
  BASE_URL: process.env.BASE_URL || 'http://localhost:5000',
  TEST_USER_EMAIL: process.env.TEST_USER_EMAIL || '',
  TEST_USER_PASSWORD: process.env.TEST_USER_PASSWORD || '',
  TEST_BUSINESS_SLUG: process.env.TEST_BUSINESS_SLUG || '',
  TEST_INVOICE_RECIPIENT_EMAIL: process.env.TEST_INVOICE_RECIPIENT_EMAIL || 'invoice@example.com',
  TEST_INVOICE_RECIPIENT_NAME: process.env.TEST_INVOICE_RECIPIENT_NAME || 'Test Client',
  DEBUG: process.env.DEBUG === 'true',
  TEST_SEED: process.env.TEST_SEED ? parseInt(process.env.TEST_SEED, 10) : undefined,
};

// Validate URLs
try {
  new URL(env.BASE_URL);
} catch {
  console.error(`❌ Invalid BASE_URL: ${env.BASE_URL}`);
  process.exit(1);
}

console.log('✅ Environment variables loaded successfully');
