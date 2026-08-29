const POSTGRES_PROTOCOLS = new Set(["postgres:", "postgresql:"]);
const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "::1"]);
const LEGACY_SECURE_MODES = new Set(["", "prefer", "require", "verify-ca"]);

export function securePostgresConnectionString(
  value,
  { allowInsecureTestConnection = false } = {}
) {
  if (typeof value !== "string" || value.trim().length === 0) return value;

  let parsed;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error("PostgreSQL connection URL is invalid");
  }

  if (!POSTGRES_PROTOCOLS.has(parsed.protocol)) {
    throw new Error("Database connection URL must use postgres:// or postgresql://");
  }

  const hostname = parsed.hostname.toLowerCase();
  const isLocal = LOCAL_HOSTS.has(hostname);
  if (isLocal || allowInsecureTestConnection) return value;

  const currentMode = String(parsed.searchParams.get("sslmode") || "").toLowerCase();
  if (currentMode === "disable" || currentMode === "allow") {
    throw new Error("Remote PostgreSQL connections may not disable certificate verification");
  }

  if (LEGACY_SECURE_MODES.has(currentMode)) {
    parsed.searchParams.set("sslmode", "verify-full");
  } else if (currentMode !== "verify-full") {
    throw new Error(`Unsupported PostgreSQL sslmode: ${currentMode}`);
  }

  return parsed.toString();
}

export function secureDatabaseEnvironment(
  environment,
  { allowInsecureTestConnection = false } = {}
) {
  const secured = { ...environment };
  for (const key of ["DATABASE_URL", "TEST_DATABASE_URL"]) {
    if (typeof secured[key] !== "string" || secured[key].trim().length === 0) continue;
    secured[key] = securePostgresConnectionString(secured[key], {
      allowInsecureTestConnection,
    });
  }
  return secured;
}
