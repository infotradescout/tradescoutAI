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
  AGENT_IDENTITY_EMAIL  - System agent email (must exist in test database)
  AGENT_IDENTITY_SECRET - System agent secret/password
  AGENT_SCOPE_SLUG      - Scoped business slug this agent can exercise

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
  'AGENT_IDENTITY_EMAIL',
  'AGENT_IDENTITY_SECRET',
  'AGENT_SCOPE_SLUG',
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
  AGENT_IDENTITY_EMAIL: process.env.AGENT_IDENTITY_EMAIL || '',
  AGENT_IDENTITY_SECRET: process.env.AGENT_IDENTITY_SECRET || '',
  AGENT_SCOPE_SLUG: process.env.AGENT_SCOPE_SLUG || '',
  AGENT_TYPE: process.env.AGENT_TYPE || 'bot_operator',
  AGENT_CLAIMS: process.env.AGENT_CLAIMS || 'post,observe,seed',
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
