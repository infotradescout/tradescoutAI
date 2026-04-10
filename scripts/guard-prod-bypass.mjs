#!/usr/bin/env node

const truthy = new Set(["1", "true", "yes", "on", "enabled"]);

function isTruthy(value) {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value === 1;
  return truthy.has(String(value || "").trim().toLowerCase());
}

const BYPASS_FLAGS = [
  "DIRECT_CONNECT_ALLOW_UNVERIFIED",
  "DIRECT_CONNECT_DEMO_MODE",
  "TRADE_SCOUT_DEMO_MODE",
];

function main() {
  const strict =
    isTruthy(process.env.REQUIRE_PROD_BYPASS_OFF) ||
    String(process.env.NODE_ENV || "").trim().toLowerCase() === "production";

  if (!strict) {
    console.log("[guard:prod-bypass] SKIP (non-production mode)");
    return;
  }

  const violations = BYPASS_FLAGS.filter((key) => isTruthy(process.env[key]));
  if (violations.length > 0) {
    console.error("[guard:prod-bypass] FAIL");
    for (const key of violations) {
      console.error(`- ${key} must be disabled in production`);
    }
    process.exit(1);
  }

  console.log("[guard:prod-bypass] OK");
}

main();

