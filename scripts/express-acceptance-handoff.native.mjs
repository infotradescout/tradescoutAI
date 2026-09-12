import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import bcrypt from 'bcrypt';

/** This extension runs only inside the existing disposable JW browser fixture. */
export async function proveExpressAcceptanceHandoff({ page, context, database, fixture, requestId, userId, device }) {
  const base='http://127.0.0.1:5228';
  assert.equal(fixture.base,base);
  assert.equal((await database.query('SELECT current_database() AS name')).rows[0].name,'ts_jw_workflow_test');
  assert.match(fixture.ownerId,/^jw-fixture-owner-[0-9a-f-]+$/);
  const owner=(await database.query('SELECT email FROM users WHERE id=$1',[fixture.ownerId])).rows[0];
  assert.equal(owner.email,fixture.ownerId+'@example.test');
  // Give the synthetic, fixture-owned supplier a known test password; the real
  // login route still verifies the hash and issues its own session cookie.
  const password='SyntheticOnly-'+randomUUID();
  await database.query('UPDATE users SET password=$1 WHERE id=$2',[await bcrypt.hash(password,10),fixture.ownerId]);
  const supplier=await context.browser().newContext({viewport:page.viewportSize(),isMobile:device==='touch',hasTouch:device==='touch',serviceWorkers:'block'});
  await supplier.route('**/*',route=>new URL(route.request().url()).origin===base?route.continue():route.abort('blockedbyclient'));
  async function api(actor,method,pathname,data,expected=200) {
    assert(pathname.startsWith('/api/'));
    const response=await actor.request.fetch(base+pathname,{method,...(data===undefined?{}:{data})});
    const payload=await response.json();
    assert.equal(response.status(),expected,`${method} ${pathname}: ${payload.message||payload.code||response.status()}`);
    return payload;
  }
  try {
    await api(supplier,'POST','/api/auth/login',{email:owner.email,password});
    const assignments=(await database.query('SELECT id,status FROM work_request_assignments WHERE work_request_id=$1 AND responder_user_id=$2',[requestId,fixture.ownerId])).rows;
    assert.equal(assignments.length,1);assert.equal(assignments[0].status,'invited');
    const assignmentId=assignments[0].id;
    const inbox=await api(supplier,'GET','/api/direct-connect/inbox');
    assert(JSON.stringify(inbox).includes(assignmentId));
    const responseBody={decision:'accept',availabilityWindow:'Next week',priceBand:'custom_quote',scopeNote:'Synthetic material supply enquiry; fabrication and installation remain separate.'};
    await api(context,'POST',`/api/direct-connect/assignments/${assignmentId}/respond`,responseBody,404);
    assert.equal((await database.query('SELECT status FROM work_request_assignments WHERE id=$1',[assignmentId])).rows[0].status,'invited');
    await api(supplier,'POST',`/api/direct-connect/assignments/${assignmentId}/respond`,responseBody);
    assert.equal((await database.query('SELECT status FROM work_request_assignments WHERE id=$1',[assignmentId])).rows[0].status,'accepted');
    const parents=(await database.query('SELECT * FROM direct_connect_dispatch_requests WHERE id=$1',[requestId])).rows;
    assert.equal(parents.length,1);assert.equal(parents[0].user_id,userId);
    assert.equal(parents[0].contact_gate_state,'locked','Handoff must not automatically release additional contact');
    const candidates=(await database.query('SELECT * FROM direct_connect_dispatch_candidates WHERE request_id=$1',[requestId])).rows;
    assert.equal(candidates.length,1);assert.equal(candidates[0].responder_user_id,fixture.ownerId);
    assert.equal(candidates[0].business_id,fixture.businessId);
    const recorded=(await database.query('SELECT responder_user_id FROM direct_connect_contractor_responses WHERE request_id=$1',[requestId])).rows;
    assert.equal(recorded.length,1,'Supplier response must persist instead of failing its parent foreign key');
    assert.equal(recorded[0].responder_user_id,fixture.ownerId);
    const events=(await database.query("SELECT metadata FROM work_request_events WHERE work_request_id=$1 AND type='provider_accepted'",[requestId])).rows;
    assert.equal(events.length,1);assert(events[0].metadata.conversationId);
    const result={device,passed:true,assignedSupplierLogin:true,actualInbox:true,unassignedAcceptanceDenied:true,acceptancePersisted:true,dispatchParentPersisted:true,exactCandidatePersisted:true,responseForeignKeySatisfied:true,conversationCreated:true,additionalContactStillLocked:true,quoteCreated:false,externalEmailSent:false};
    console.log('EXPRESS_HANDOFF_NATIVE '+JSON.stringify(result));
    return result;
  } finally { await supplier.close(); }
}
