import 'dotenv/config';
import pg from 'pg';
import { allowExplicitInsecureTestDatabase, securePostgresConnectionString } from '../shared/database-url-security.mjs';
import { assertExchangeStoneSchema } from './lib/exchange-stone-schema.mjs';

const url = securePostgresConnectionString(process.env.DATABASE_URL ?? process.env.TEST_DATABASE_URL, {
  allowInsecureTestConnection: allowExplicitInsecureTestDatabase(process.env),
});
if (!url) throw new Error('A configured database is required for stone schema verification');
const client = new pg.Client({ connectionString: url, connectionTimeoutMillis: 10000 });
try {
  await client.connect();
  await client.query('BEGIN READ ONLY');
  await client.query("SET LOCAL statement_timeout = '10000ms'");
  await assertExchangeStoneSchema(client);
  await client.query('COMMIT');
  console.log('[required-schema] TradeScout stone receipt and outcome schema verified.');
} catch (error) {
  await client.query('ROLLBACK').catch(() => {});
  console.error('[required-schema] Stone verification failed:', error instanceof Error ? error.message : 'unknown error');
  process.exitCode = 1;
} finally {
  await client.end().catch(() => {});
}
