import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';

/** Runs only with the parent verifier's fresh loopback database and browser. */
export async function proveJwStoneRequestJourney({ page, context, database, fixture, email, userId, device, output, rootPath }) {
  const base = 'http://127.0.0.1:5228';
  assert.equal(fixture.base, base); assert.equal(rootPath, '/u/jw-stone');
  assert.equal((await database.query('SELECT current_database() AS name')).rows[0].name, 'ts_jw_workflow_test');
  assert.match(email, /^jw-workflow-(desktop|touch)-[0-9a-f-]+@example\.test$/);
  const click = async locator => { await locator.scrollIntoViewIfNeeded(); return device === 'touch' ? locator.tap() : locator.click(); };
  const response = await page.goto(base + rootPath + '?request=collection', { waitUntil: 'domcontentloaded' });
  assert.equal(response.status(), 200);
  const dialog = page.getByRole('dialog', { name: 'JW Stone Logistics', exact: true });
  await dialog.waitFor();
  assert.equal(await dialog.locator('a[href^="tel:"]').count(), 0, 'No phone release merely from opening');
  await dialog.getByLabel('Name', { exact: true }).waitFor();
  assert.equal(await dialog.getByRole('button', { name: 'Fill out the form', exact: true }).count(), 0);
  await dialog.getByLabel('Name', { exact: true }).fill('Synthetic Customer');
  await dialog.getByLabel('Email', { exact: true }).fill(email);
  await dialog.locator('input[name="phone"]').fill('2025550147');
  // Wrapping labels also contain the select's option text. Match the stable
  // visible label, then assert the exact selected values before submission.
  const role = dialog.getByRole('combobox', { name: /^I am a/ });
  const requestType = dialog.getByRole('combobox', { name: /^What do you need/ });
  await role.selectOption('fabricator'); await requestType.selectOption('request_material');
  assert.equal(await role.inputValue(), 'fabricator'); assert.equal(await requestType.inputValue(), 'request_material');
  const message = 'Synthetic workflow test: request Honey Onyx for a measured kitchen countertop project. Supplier must confirm selection and schedule.';
  await dialog.getByLabel('Details', { exact: true }).fill(message);
  const consent = dialog.locator('input[type="checkbox"]');
  assert.equal(await consent.isChecked(), false, 'Marketing consent must stay unchecked');
  const pending = page.waitForResponse(r => new URL(r.url()).pathname === '/api/tradepartner-profiles/jw-stone/express-request' && r.request().method() === 'POST');
  await click(dialog.getByRole('button', { name: 'Make A Request', exact: true }));
  const submitted = await pending;
  const body = await submitted.json();
  assert(submitted.ok(), 'Actual material request failed: ' + submitted.status() + ' ' + String(body.code || body.message || ''));
  assert.equal(typeof body.requestId, 'string');
  console.log('JW_REQUEST_STAGE ' + device + ': actual request accepted');
  await dialog.getByRole('heading', { name: 'Request sent', exact: true }).waitFor();
  const [work] = (await database.query('SELECT id,created_by_user_id,source_ref_id,visibility,status,description FROM work_requests WHERE id=$1', [body.requestId])).rows;
  assert(work); assert.equal(work.created_by_user_id, userId); assert.equal(work.source_ref_id, fixture.profileId);
  assert.equal(work.visibility, 'private'); assert.equal(work.status, 'routed'); assert(work.description.includes(message)); assert(work.description.includes('Fabricator'));
  const assignments = (await database.query('SELECT responder_user_id,status FROM work_request_assignments WHERE work_request_id=$1', [body.requestId])).rows;
  assert.equal(assignments.length, 1); assert.equal(assignments[0].responder_user_id, fixture.ownerId); assert.equal(assignments[0].status, 'invited');
  const created = (await database.query("SELECT metadata FROM work_request_events WHERE work_request_id=$1 AND type='created'", [body.requestId])).rows;
  assert.equal(created.length, 1);
  assert.equal(created[0].metadata.businessId, fixture.businessId); assert.equal(created[0].metadata.updatesOptIn, false);
  assert.equal(created[0].metadata.contactGateState, 'pending_provider_response');
  const notices = (await database.query("SELECT user_id FROM notifications WHERE metadata->>'workRequestId'=$1 AND metadata->>'kind'='express_contact_authority_request'", [body.requestId])).rows;
  assert.equal(notices.length, 1); assert.equal(notices[0].user_id, fixture.ownerId);
  const permissions = (await database.query('SELECT requester_id,target_user_id,status FROM contact_permissions WHERE requester_id=$1 AND target_user_id=$2', [userId, fixture.ownerId])).rows;
  assert.equal(permissions.length, 1); assert.equal(permissions[0].status, 'pending');
  await fs.mkdir(output, { recursive: true });
  await page.screenshot({ path: path.join(output, device + '-synthetic-request-receipt.png'), fullPage: false });
  await click(dialog.getByRole('button', { name: 'Close Direct Connect', exact: true }));
  return { browserSubmit: true, persistedPrivateRequest: true, correctSupplierAssignment: true, supplierInAppNotice: true, contactStillPending: true, marketingOptIn: false, externalEmailDelivery: false, formalPricedQuote: false };
}
