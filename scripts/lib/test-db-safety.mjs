const LOOPBACK_HOSTS = new Set(["localhost", "127.0.0.1", "::1", "[::1]"]);
const DISPOSABLE_DATABASE_PATTERN = /(?:^|[_-])(test|ci|disposable|ephemeral)(?:$|[_-])/i;
const PRODUCTION_DATABASE_PATTERN = /(?:^|[_-])(prod|production)(?:$|[_-])/i;

export function assertDisposableDatabaseName(database) {
  if (
    typeof database !== "string" ||
    !/^[a-z][a-z0-9_-]{0,62}$/i.test(database) ||
    PRODUCTION_DATABASE_PATTERN.test(database) ||
    !DISPOSABLE_DATABASE_PATTERN.test(database)
  ) {
    throw new Error("The database name must explicitly identify a disposable test database.");
  }
  return database;
}

export function assertDisposableTestDatabaseUrl(rawUrl) {
  let parsed;
  try {
    parsed = new URL(rawUrl);
  } catch {
    throw new Error("The dedicated test database connection is invalid.");
  }
  if (!["postgres:", "postgresql:"].includes(parsed.protocol) || !parsed.hostname) {
    throw new Error("The dedicated test connection must use PostgreSQL.");
  }
  const database = assertDisposableDatabaseName(decodeURIComponent(parsed.pathname.slice(1)));
  return { database, hostname: parsed.hostname, loopback: LOOPBACK_HOSTS.has(parsed.hostname.toLowerCase()) };
}

export function assertDisposableFullSyncTarget(rawUrl, env = process.env) {
  if (env.ALLOW_TEST_DB_FULL_SYNC !== "true") {
    throw new Error(
      "Full test-schema sync requires ALLOW_TEST_DB_FULL_SYNC=true for an explicitly disposable database."
    );
  }

  let parsed;
  try {
    parsed = new URL(rawUrl);
  } catch {
    throw new Error("TEST_DATABASE_URL must be a valid PostgreSQL URL.");
  }

  if (!["postgres:", "postgresql:"].includes(parsed.protocol)) {
    throw new Error("TEST_DATABASE_URL must use the postgres or postgresql protocol.");
  }

  const database = decodeURIComponent(parsed.pathname.replace(/^\/+/, "")).trim();
  if (!database) throw new Error("TEST_DATABASE_URL must name a database.");
  if (PRODUCTION_DATABASE_PATTERN.test(database)) {
    throw new Error(`Refusing full sync for production-shaped database name "${database}".`);
  }
  if (!DISPOSABLE_DATABASE_PATTERN.test(database)) {
    throw new Error(
      `Refusing full sync for database "${database}"; its name must explicitly identify a test, CI, disposable, or ephemeral target.`
    );
  }

  const loopback = LOOPBACK_HOSTS.has(parsed.hostname.toLowerCase());
  const approvedRemoteCi =
    env.CI === "true" && env.ALLOW_REMOTE_TEST_DB_FULL_SYNC === "true";
  if (!loopback && !approvedRemoteCi) {
    throw new Error(
      "Refusing non-loopback full sync without CI=true and ALLOW_REMOTE_TEST_DB_FULL_SYNC=true."
    );
  }

  return { database, hostname: parsed.hostname, loopback };
}
