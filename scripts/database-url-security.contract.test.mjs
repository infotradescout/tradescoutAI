import assert from "node:assert/strict";
import test from "node:test";
import {
  allowExplicitInsecureTestDatabase,
  secureDatabaseEnvironment,
  securePostgresConnectionString,
} from "../shared/database-url-security.mjs";

test("remote PostgreSQL URLs are upgraded to explicit verify-full", () => {
  for (const mode of [undefined, "prefer", "require", "verify-ca", "verify-full"]) {
    const input = new URL("postgresql://user:pass@db.example.com:5432/tradescout");
    if (mode) input.searchParams.set("sslmode", mode);
    input.searchParams.set("application_name", "tradescout");

    const secured = new URL(securePostgresConnectionString(input.toString()));
    assert.equal(secured.searchParams.get("sslmode"), "verify-full");
    assert.equal(secured.searchParams.get("application_name"), "tradescout");
  }
});

test("remote certificate verification cannot be disabled or weakened", () => {
  for (const mode of ["disable", "allow", "unknown"]) {
    assert.throws(
      () =>
        securePostgresConnectionString(
          `postgresql://user:pass@db.example.com/tradescout?sslmode=${mode}`
        ),
      /certificate verification|Unsupported PostgreSQL sslmode/
    );
  }
});

test("localhost connections remain available for development and test use", () => {
  for (const host of ["localhost", "127.0.0.1", "[::1]"]) {
    const input = `postgresql://user:pass@${host}:5432/tradescout?sslmode=disable`;
    assert.equal(securePostgresConnectionString(input), input);
  }
});

test("the insecure test escape requires both NODE_ENV=test and an explicit flag", () => {
  assert.equal(
    allowExplicitInsecureTestDatabase({
      NODE_ENV: "test",
      ALLOW_INSECURE_TEST_DATABASE: "true",
    }),
    true
  );
  assert.equal(
    allowExplicitInsecureTestDatabase({
      NODE_ENV: "production",
      ALLOW_INSECURE_TEST_DATABASE: "true",
    }),
    false
  );
  assert.equal(
    allowExplicitInsecureTestDatabase({ NODE_ENV: "test" }),
    false
  );
});

test("the explicit test-only escape does not rewrite a private test database", () => {
  const input = "postgresql://user:pass@postgres-test:5432/tradescout?sslmode=disable";
  assert.equal(
    securePostgresConnectionString(input, { allowInsecureTestConnection: true }),
    input
  );
});

test("production environment hardening covers both database variables", () => {
  const secured = secureDatabaseEnvironment({
    DATABASE_URL: "postgresql://user:pass@primary.example.com/tradescout?sslmode=require",
    TEST_DATABASE_URL: "postgresql://user:pass@test.example.com/tradescout",
    OTHER: "preserved",
  });

  assert.equal(new URL(secured.DATABASE_URL).searchParams.get("sslmode"), "verify-full");
  assert.equal(new URL(secured.TEST_DATABASE_URL).searchParams.get("sslmode"), "verify-full");
  assert.equal(secured.OTHER, "preserved");
});

test("invalid or non-PostgreSQL URLs fail closed", () => {
  assert.throws(() => securePostgresConnectionString("not a URL"), /invalid/);
  assert.throws(
    () => securePostgresConnectionString("https://db.example.com/tradescout"),
    /postgres:\/\/ or postgresql:\/\//
  );
});
