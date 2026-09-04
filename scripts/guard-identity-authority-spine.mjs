#!/usr/bin/env node

import { readFile } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const failures = [];

async function source(relativePath) {
  return readFile(path.join(root, relativePath), "utf8");
}

function requireText(text, needle, label) {
  if (!text.includes(needle)) failures.push(`${label}: missing ${JSON.stringify(needle)}`);
}

function forbidText(text, needle, label) {
  if (text.includes(needle)) failures.push(`${label}: forbidden ${JSON.stringify(needle)}`);
}

const [auth, routes, resolver, sharedSuperAdmin, promptAdmin, adminControl] = await Promise.all([
  source("server/auth.ts"),
  source("server/routes.ts"),
  source("server/utils/requestEffectiveUser.ts"),
  source("server/middleware/requireSuperAdmin.ts"),
  source("server/routes/promptAdmin.ts"),
  source("server/routes/admin-control.ts"),
]);

for (const needle of [
  "export const bindAuthenticatedRequestAuthority",
  "resolveRequestAuthorityContext(",
  "authorityRequest.principalUser = context.principalUser",
  "authorityRequest.user = context.effectiveUser",
  'code: "AUTH_IDENTITY_CONTEXT_INVALID"',
  'code: "AUTH_IDENTITY_CONTEXT_UNAVAILABLE"',
  'code: "IMPERSONATION_PRIVILEGE_BOUNDARY"',
  "blockImpersonatedPrivilege(req, res)",
  '"/api/admin/impersonate/exit"',
]) {
  requireText(auth, needle, "server/auth.ts");
}

for (const boundary of [
  "export const isAuthenticated",
  "export const requireOnboardingComplete",
  "export const requireRole",
  "export const requirePermission",
  "export const isBusinessProvider",
  "export const requireAuth",
  "export const requireAdmin",
]) {
  const start = auth.indexOf(boundary);
  if (start < 0 || !auth.slice(start, start + 1600).includes("bindRequestAuthority(req, res)")) {
    failures.push(`server/auth.ts: ${boundary} is not bound to effective authority`);
  }
}

const setupIndex = routes.indexOf("await setupAuth(app)");
const binderIndex = routes.indexOf("app.use(bindAuthenticatedRequestAuthority)");
const adminIndex = routes.indexOf("mountAdminRoutes(app)");
if (!(setupIndex >= 0 && binderIndex > setupIndex && adminIndex > binderIndex)) {
  failures.push("server/routes.ts: application authority binder must precede mounted routers");
}

const authUserStart = routes.indexOf('app.get("/api/auth/user"');
const authUserEnd = routes.indexOf("// Check if platform setup is needed", authUserStart);
const authUser = routes.slice(authUserStart, authUserEnd);
for (const needle of [
  "resolveRequestAuthorityContext(",
  "const userId = identityContext.effectiveUserId",
  "if (identityContext.isImpersonating) return baseUser",
  "isImpersonating: true",
]) {
  requireText(authUser, needle, "/api/auth/user");
}
forbidText(authUser, "role: sessionAny.impersonatingRole", "/api/auth/user");

for (const needle of [
  "principalUser?: any",
  "const principalUser = req?.principalUser ?? req?.user",
  "const effectiveUser = await loadUser(identity.effectiveUserId)",
  'reason: "effective_user_inactive"',
  'reason: "principal_user_inactive"',
]) {
  requireText(resolver, needle, "server/utils/requestEffectiveUser.ts");
}

for (const [label, text] of [
  ["server/middleware/requireSuperAdmin.ts", sharedSuperAdmin],
  ["server/routes/promptAdmin.ts", promptAdmin],
  ["server/routes/admin-control.ts", adminControl],
]) {
  requireText(text, "resolveRequestEffectiveUser(req)", label);
  requireText(text, "identityContext.isImpersonating", label);
}

if (failures.length > 0) {
  console.error("[guard:identity-authority-spine] FAIL");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("[guard:identity-authority-spine] OK");
