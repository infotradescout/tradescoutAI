// Admin analytics and audit logging (PHASE 4)
import fs from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const AUDIT_LOG_PATH = join(__dirname, "..", "admin_audit.log");

export function logAdminAction(action: string, user: any, details: any = {}) {
  const entry = {
    timestamp: new Date().toISOString(),
    user: user?.id || null,
    role: user?.role || null,
    action,
    details,
  };
  fs.appendFileSync(AUDIT_LOG_PATH, JSON.stringify(entry) + "\n");
}

export function getAuditLog(limit = 100) {
  if (!fs.existsSync(AUDIT_LOG_PATH)) return [];
  const lines = fs.readFileSync(AUDIT_LOG_PATH, "utf8").trim().split("\n");
  return lines
    .slice(-limit)
    .map((line) => {
      try {
        return JSON.parse(line);
      } catch {
        return null;
      }
    })
    .filter(Boolean);
}

// Process-local diagnostic counters. These are explicitly non-durable and never release evidence.
const analytics = {
  queries: 0,
  fallbacks: 0,
  fallbackReasons: {} as Record<string, number>,
  lastQuery: null as null | string,
};

export function recordQuery() {
  analytics.queries++;
  analytics.lastQuery = new Date().toISOString();
}

export function recordFallback(reason = "unknown") {
  analytics.fallbacks++;
  analytics.fallbackReasons[reason] = (analytics.fallbackReasons[reason] || 0) + 1;
}

export function getAnalytics() {
  return {
    ...analytics,
    scope: "process_local" as const,
    durable: false as const,
  };
}

export function __resetAnalyticsForTests() {
  analytics.queries = 0;
  analytics.fallbacks = 0;
  analytics.fallbackReasons = {};
  analytics.lastQuery = null;
}
