#!/usr/bin/env node
/** One-time source edit, never imported by the application or a production build. */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

const apply = process.argv.includes('--apply');
const root = execFileSync('git', ['rev-parse', '--show-toplevel'], { encoding: 'utf8' }).trim();
process.chdir(root);
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
function replace(file, before, after, count = 1) {
  const content = plans.get(file);
  assert.equal(content.split(before).length - 1, count, `${file}: exact edit context changed.`);
  plans.set(file, content.split(before).join(after));
}
const shell = 'client/src/pages/direct-connect/DirectConnectShell.tsx';
const route = 'server/routes/direct-connect.ts';
const integration = 'client/src/pages/direct-connect/requesterSubmissionContact.integration.test.ts';
const doctrine = 'server/tests/direct-connect-doctrine-regression-matrix.contract.test.ts';
load(shell, '957178e1db61637a5e3901c6dad12efebc3e00cc');
load(route, '4303b6547f1120db12ff6799de454db9cb4542d8');
load(integration);
load(doctrine, '9d56ab0e4bb1e256943bd090eadf7edb3030bf30');
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
replace(route,
  `        if (!authOwnerMatch) {
          return res
            .status(403)
            .json({ message: "Only the request owner can update contact approval" });
        }`,
  `        if (!authOwnerMatch || String(requestRow.createdByUserId || "") !== userId) {
          return res
            .status(403)
            .json({ message: "Only the request owner can update contact approval" });
        }`);
const transitionStart = `        const allowedTransitions = new Set([
          "contractor_requested->user_approved",`;
replace(route, transitionStart, `        // Compatibility for older clients: submission already authorizes
        // request-related contact. Never manufacture an approval, permission,
        // workspace, contact payload, or notification from a stale release call.
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

${transitionStart}`);
replace(integration,
  `const marker = 'const contactGateState = String(r.contactGateState || "locked");';`,
  `const marker = 'const contactGateState = normalizeDirectConnectContactState(r.contactGateState);';`);
replace(integration,
  '{ r: Object.freeze({ ...request }) },',
  '{ r: Object.freeze({ ...request }), normalizeDirectConnectContactState },');
replace(doctrine,
  `'canReleaseContact: String(dispatch?.contact_gate_state || "locked") === "user_approved"'`,
  `'canReleaseContact: false'`);
for (const [file, content] of plans) {
  console.log(JSON.stringify({ file, bytes: Buffer.byteLength(content), action: apply ? 'apply' : 'check' }));
}
// Validate all files and contexts before writing any file.
if (apply) for (const [file, content] of plans) writeFileSync(file, content, 'utf8');
