import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';

/** Synthetic loopback only. Never accepts, replies to, or quotes a live request. */
export async function proveJwStoneSupplierResponse({ page, context, database, fixture, requestId, userId, device, output }) {
  const base = 'http://127.0.0.1:5228';
  assert.equal(fixture.base, base);
  assert.equal((await database.query('SELECT current_database() AS name')).rows[0].name, 'ts_jw_workflow_test');
  assert.match(fixture.ownerId, /^jw-fixture-owner-[0-9a-f-]+$/);
  assert.equal(typeof fixture.ownerPassword, 'string');
  const evidence = { device, steps: [], passed: false, externalEmailDelivery: false, liveCustomerWrites: false };
  const supplier = await context.browser().newContext({ viewport: page.viewportSize(), isMobile: device === 'touch', hasTouch: device === 'touch', serviceWorkers: 'block' });
  await supplier.route('**/*', route => new URL(route.request().url()).origin === base ? route.continue() : route.abort('blockedbyclient'));
  async function call(actor, method, pathname, data, expected = 200) {
    assert(pathname.startsWith('/api/')); assert.equal(new URL(pathname, base).origin, base);
    const response = await actor.request.fetch(base + pathname, { method, ...(data === undefined ? {} : { data }) });
    const body = await response.json();
    assert.equal(response.status(), expected, `${method} ${pathname}: ${response.status()} ${String(body.message || body.code || '')}`);
    return body;
  }
  const note = (name, details = {}) => { evidence.steps.push({ name, ...details }); console.log('SUPPLIER_STEP ' + JSON.stringify({ device, name, ...details })); };
  try {
    await call(supplier, 'POST', '/api/auth/login', { email: fixture.ownerId + '@example.test', password: fixture.ownerPassword });
    const assignments = (await database.query('SELECT id,status FROM work_request_assignments WHERE work_request_id=$1 AND responder_user_id=$2', [requestId, fixture.ownerId])).rows;
    assert.equal(assignments.length, 1); assert.equal(assignments[0].status, 'invited');
    const assignmentId = assignments[0].id;
    const inbox = await call(supplier, 'GET', '/api/direct-connect/inbox');
    assert(JSON.stringify(inbox).includes(assignmentId), 'Assigned supplier cannot find the browser-created request in its actual inbox');
    note('Correct supplier receives the actual browser-created request');
    await call(context, 'POST', `/api/direct-connect/assignments/${assignmentId}/respond`, { decision: 'accept', availabilityWindow: 'Next week', priceBand: 'custom_quote', scopeNote: 'Review measured kitchen scope and material details.' }, 403);
    const accepted = await call(supplier, 'POST', `/api/direct-connect/assignments/${assignmentId}/respond`, { decision: 'accept', availabilityWindow: 'Next week', priceBand: 'custom_quote', scopeNote: 'Review measured kitchen scope and material details.' });
    const acceptedRow = (await database.query('SELECT status FROM work_request_assignments WHERE id=$1', [assignmentId])).rows[0];
    assert.equal(acceptedRow.status, 'accepted');
    const events = (await database.query("SELECT metadata FROM work_request_events WHERE work_request_id=$1 AND type='provider_accepted'", [requestId])).rows;
    assert.equal(events.length, 1); const conversationId = events[0].metadata.conversationId; assert(conversationId);
    note('Only assigned supplier accepts; persisted acceptance and conversation created', { responseKeys: Object.keys(accepted) });
    // Follow the existing consent path, not a direct database change to bypass it.
    await call(supplier, 'POST', `/api/direct-connect/contractor/requests/${requestId}/request-contact`, {});
    const approve = await context.request.post(base + `/api/direct-connect/requests/${requestId}/contact-gate`, { data: { nextState: 'user_approved' } });
    assert([200,409].includes(approve.status()), 'Existing requester-consent transition failed');
    const release = await context.request.post(base + `/api/direct-connect/requests/${requestId}/contact-gate`, { data: { nextState: 'released' } });
    assert.equal(release.status(), 200, 'Existing contact release did not complete');
    note('Requester approval and contact release use actual guarded routes');
    const job = await call(supplier, 'GET', `/api/direct-connect/messages/threads/${conversationId}/job`);
    const workspace = (await database.query('SELECT id,requester_user_id FROM direct_connect_job_workspaces WHERE request_id=$1', [requestId])).rows;
    assert.equal(workspace.length, 1, 'No job workspace follows accepted request'); assert.equal(workspace[0].requester_user_id, userId);
    const jobId = workspace[0].id; assert(JSON.stringify(job).includes(jobId));
    const createPath = `/api/direct-connect/jobs/${jobId}/estimates`;
    await call(context, 'POST', createPath, { title: 'Synthetic forbidden customer quote', scopeSummary: 'Requester must not issue the supplier estimate.' }, 403);
    const created = await call(supplier, 'POST', createPath, { title: 'Synthetic cabinet and countertop estimate', scopeSummary: 'Invented demonstration amounts for cabinet materials and countertop labor. Not a real offer.' }, 201);
    const estimateId = created.estimateId; assert.equal(typeof estimateId, 'string');
    const lines = [
      { lineType: 'other', name: 'Template visit', quantity: 1, unit: 'visit', unitCost: 100 },
      { lineType: 'other', name: 'Delivery', quantity: 1, unit: 'trip', unitCost: 200 },
      { lineType: 'material', name: 'Cabinet materials', quantity: 2, unit: 'each', unitCost: 150 },
      { lineType: 'labor', name: 'Countertop fabrication labor', quantity: 2, unit: 'hours', unitCost: 50 },
    ];
    let expectedTotal = 0;
    for (const line of lines) {
      const added = await call(supplier, 'POST', `${createPath}/${estimateId}/line-items`, line, 201);
      expectedTotal += line.quantity * line.unitCost;
      note('Line added through actual estimate endpoint', { line: line.name, expectedTotal, actualTotal: added.totals?.totalEstimate });
      assert.equal(Number(added.totals?.totalEstimate), expectedTotal, 'Estimate total must equal the sum of its items, not accumulate a prior subtotal');
    }
    const estimate = await call(supplier, 'GET', `${createPath}/${estimateId}`);
    assert.equal(Number(estimate.totalEstimate), 700); assert.equal(estimate.lineItems.length, 4);
    const stored = (await database.query('SELECT total_estimate,subtotal_other FROM job_estimates WHERE id=$1', [estimateId])).rows[0];
    assert.equal(Number(stored.total_estimate), 700); assert.equal(Number(stored.subtotal_other), 300);
    note('Authoritative itemized totals remain 700 with other charges 300');
    evidence.passed = true;
  } catch (error) {
    evidence.error = String(error.stack || error); console.error('SUPPLIER_FAILURE ' + evidence.error); throw error;
  } finally {
    await supplier.close(); await fs.mkdir(output, { recursive: true });
    await fs.writeFile(path.join(output, device + '-supplier-response.json'), JSON.stringify(evidence, null, 2));
  }
  return evidence;
}
