#!/usr/bin/env node
/** One-time source edit, never imported by the application or a production build. */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

const apply = process.argv.includes('--apply');
process.chdir(execFileSync('git', ['rev-parse', '--show-toplevel'], { encoding: 'utf8' }).trim());
assert.equal(execFileSync('git', ['status', '--porcelain'], { encoding: 'utf8' }).trim(), '',
  'Start from a clean checkout; no existing edits will be overwritten.');
const plans = new Map();
function load(file, expectedBlob) {
  const content = readFileSync(file, 'utf8');
  if (expectedBlob) {
    const bytes = Buffer.from(content);
    const blob = createHash('sha1').update(`blob ${bytes.length}\0`).update(bytes).digest('hex');
    assert.equal(blob, expectedBlob, `${file}: source changed; inspect its delta before applying.`);
  }
  plans.set(file, content);
}
function edited(content, before, after, count = 1) {
  assert.equal(content.split(before).length - 1, count, `Exact edit context changed: ${before.slice(0, 100)}`);
  return content.split(before).join(after);
}
function replace(file, before, after, count = 1) {
  plans.set(file, edited(plans.get(file), before, after, count));
}
const shell = 'client/src/pages/direct-connect/DirectConnectShell.tsx';
const route = 'server/routes/direct-connect.ts';
const integration = 'client/src/pages/direct-connect/requesterSubmissionContact.integration.test.ts';
const doctrine = 'server/tests/direct-connect-doctrine-regression-matrix.contract.test.ts';
const statusTests = 'server/tests/direct-connect-requester-status.contract.test.ts';
load(shell, '957178e1db61637a5e3901c6dad12efebc3e00cc');
load(route, '4303b6547f1120db12ff6799de454db9cb4542d8');
load(integration);
load(doctrine, '9d56ab0e4bb1e256943bd090eadf7edb3030bf30');
load(statusTests, '5d5ec7a2878b22b19625dfea86f59a7f25059129');
replace(shell,
  'const contactGateState = String(r.contactGateState || "locked");',
  'const contactGateState = normalizeDirectConnectContactState(r.contactGateState);');
replace(route, `            canApproveContact:
              String(dispatch?.contact_gate_state || "locked") === "contractor_requested",
            canDenyContact:
              String(dispatch?.contact_gate_state || "locked") === "contractor_requested",
            canReleaseContact: String(dispatch?.contact_gate_state || "locked") === "user_approved",`,
  `            canApproveContact: false,
            canDenyContact: false,
            canReleaseContact: false,`, 2);
const source = plans.get(route);
const start = source.indexOf('"/api/direct-connect/requests/:id/contact-gate"');
const end = source.indexOf('// Requester-facing: cancel an in-progress or routed Direct Connect request', start);
assert(start > 0 && end > start, 'Exact contact endpoint boundaries required');
let handler = source.slice(start, end);
handler = edited(handler, 'if (!authOwnerMatch) {',
  'if (!authOwnerMatch || String(requestRow.createdByUserId || "") !== userId) {');
const oldTransitions = `        const allowedTransitions = new Set([
          "contractor_requested->user_approved",
          "user_approved->released",
          "contractor_requested->denied",
        ]);`;
handler = edited(handler, oldTransitions, `        // Compatibility for older clients: submission already authorizes
        // request-related contact. A stale approval/release call must not grant
        // permission, create a workspace, expose contact, or send notifications.
        if (nextState === "user_approved" || nextState === "released") {
          if (requestRow.source !== "direct_connect") {
            return res.status(400).json({ code: "DIRECT_CONNECT_REQUEST_REQUIRED",
              message: "This action only applies to Direct Connect requests." });
          }
          const requestStatus = String(requestRow.status || "").toLowerCase();
          const display = serializeDirectConnectCardContactGatePayload({ contactGateState: currentState });
          if (!["open", "routed", "in_progress", "pending_outcome", "completed"].includes(requestStatus) ||
              !["request_submission", "released", "contact_released"].includes(display.contactGateState)) {
            return res.status(409).json({ code: "REQUEST_CONTACT_UNAVAILABLE",
              message: "This request is not available for new contact. Existing restrictions remain in place." });
          }
          res.setHeader("Cache-Control", "private, no-store");
          return res.status(200).json({ requestId,
            contactGateState: display.contactGateState,
            contactApprovalRequired: false,
            code: "CONTACT_APPROVAL_NOT_REQUIRED",
            message: "Sending this request already gives its receiving providers permission to contact you about the work." });
        }

        const allowedTransitions = new Set(["contractor_requested->denied"]);`);
const obsoleteStart = handler.indexOf('        if (nextState === "released" && ownerUserId) {');
const obsoleteEnd = handler.indexOf('        const eventType =', obsoleteStart);
assert(obsoleteStart > 0 && obsoleteEnd > obsoleteStart, 'Exact obsolete release block required');
assert(handler.slice(obsoleteStart, obsoleteEnd).includes('createOrGetJobWorkspaceAtContactRelease'));
handler = handler.slice(0, obsoleteStart) + handler.slice(obsoleteEnd);
handler = edited(handler, `        const eventType =
          nextState === "user_approved"
            ? "contact_approved"
            : nextState === "denied"
              ? "contact_denied"
              : nextState === "released"
                ? "contact_released"
                : nextState === "contractor_requested"
                  ? "contact_requested"
                  : "request_shared";`,
  `        const eventType =
          nextState === "denied"
            ? "contact_denied"
            : nextState === "contractor_requested"
              ? "contact_requested"
              : "request_shared";`);
plans.set(route, source.slice(0, start) + handler + source.slice(end));
replace(integration,
  `const marker = 'const contactGateState = String(r.contactGateState || "locked");';`,
  `const marker = 'const contactGateState = normalizeDirectConnectContactState(r.contactGateState);';`);
replace(integration, '{ r: Object.freeze({ ...request }) },',
  '{ r: Object.freeze({ ...request }), normalizeDirectConnectContactState },');
replace(doctrine,
  `'canReleaseContact: String(dispatch?.contact_gate_state || "locked") === "user_approved"'`,
  `'canReleaseContact: false'`);
replace(statusTests,
  'it("keeps contact release behind requester approval transitions",',
  'it("handles stale approval calls without another requester approval transition",');
replace(statusTests, '    expect(source).toContain("contractor_requested->user_approved");',
  '    expect(source).toContain("CONTACT_APPROVAL_NOT_REQUIRED");');
replace(statusTests, '    expect(source).toContain("user_approved->released");',
  '    expect(source).toContain("contactApprovalRequired: false");');
replace(statusTests, '    expect(source).toContain("contact_approved");',
  '    expect(source).toContain("CONTACT_APPROVAL_NOT_REQUIRED");');
for (const [file, content] of plans) {
  console.log(JSON.stringify({ file, bytes: Buffer.byteLength(content), action: apply ? 'apply' : 'check' }));
}
// Validate all files and contexts before writing any file.
if (apply) for (const [file, content] of plans) writeFileSync(file, content, 'utf8');
