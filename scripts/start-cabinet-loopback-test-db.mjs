import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { randomBytes, createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';

/** Test-only native PostgreSQL. No connected-account credentials or production data are used. */
export async function startCabinetLoopbackTestDatabase() {
  if (process.platform !== 'linux' || process.arch !== 'x64' || process.getuid?.() === 0) {
    throw new Error('The isolated loopback database requires a non-root Linux x64 verification environment.');
  }
  const working = await fs.mkdtemp(path.join(os.tmpdir(), 'cabinet-test-postgres-'));
  let database;
  try {
    // Pinned test tooling is installed outside the application checkout and its lockfile.
    // Upstream API/source: github.com/leinelissen/embedded-postgres (18.4.0-beta.17).
    execFileSync('npm', ['install', '--prefix', working, '--no-audit', '--no-fund', '--save-exact', 'embedded-postgres@18.4.0-beta.17', '@embedded-postgres/linux-x64@18.4.0-beta.17'], { stdio: 'inherit' });
    const { default: EmbeddedPostgres } = await import(pathToFileURL(path.join(working, 'node_modules/embedded-postgres/dist/index.js')).href);
    const password = randomBytes(24).toString('hex');
    const user = 'cabinet_test', name = 'cabinet_placement_test', port = 55439;
    database = new EmbeddedPostgres({
      databaseDir: path.join(working, 'cluster'), user, password, port,
      persistent: false, createPostgresUser: false, authMethod: 'scram-sha-256',
      initdbFlags: ['--encoding=UTF8', '--locale=C'],
      postgresFlags: ['-h', 'localhost', '-c', 'timezone=UTC'],
      onLog: () => {}, onError: () => {},
    });
    await database.initialise(); await database.start(); await database.createDatabase(name);
    const client = database.getPgClient();
    await client.connect();
    const result = await client.query('SELECT version(), current_setting(\'listen_addresses\') AS listen, current_setting(\'TimeZone\') AS timezone');
    await client.end();
    const evidence = { scope: 'Fresh native PostgreSQL cluster on loopback only; no connected data or credentials', ...result.rows[0], tooling: 'embedded-postgres@18.4.0-beta.17', lockSha256: createHash('sha256').update(await fs.readFile(path.join(working, 'package-lock.json'))).digest('hex') };
    if (evidence.listen !== 'localhost' || evidence.timezone !== 'UTC') throw new Error('Loopback database isolation could not be confirmed');
    console.log('CABINET_TEST_DATABASE ' + JSON.stringify(evidence));
    return {
      url: `postgresql://${user}:${password}@127.0.0.1:${port}/${name}?sslmode=disable`,
      evidence,
      stop: async () => { try { await database.stop(); } finally { await fs.rm(working, { recursive: true, force: true }); } },
    };
  } catch (error) {
    try { await database?.stop(); } catch {}
    await fs.rm(working, { recursive: true, force: true });
    throw error;
  }
}
