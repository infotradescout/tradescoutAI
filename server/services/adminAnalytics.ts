// Admin analytics and audit logging (PHASE 4)
import fs from "fs";
import path from "path";

const AUDIT_LOG_PATH = path.join(__dirname, "..", "admin_audit.log");

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
  return lines.slice(-limit).map((line) => {
    try {
      return JSON.parse(line);
    } catch {
      return null;
    }
  }).filter(Boolean);
}

// Simple in-memory analytics (replace with DB for production)
const analytics = {
  queries: 0,
  fallbacks: 0,
  lastQuery: null as null | string,
};

export function recordQuery() {
  analytics.queries++;
  analytics.lastQuery = new Date().toISOString();
}

export function recordFallback() {
  analytics.fallbacks++;
}

export function getAnalytics() {
  return { ...analytics };
}
