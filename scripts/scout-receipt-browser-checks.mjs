import assert from 'node:assert/strict';

const clone=value=>JSON.parse(JSON.stringify(value));
function savedOperation(messages, executionId) {
  return (Array.isArray(messages)?messages:[]).flatMap(message=>
    Array.isArray(message?.resultContract?.allowed_actions)?message.resultContract.allowed_actions:[]
  ).find(action=>action.type==='SAVE_PROFILE'&&action.payload?.executionId===executionId);
}

/** Extend the actual loopback production-app journey; never target customer data. */
export async function runScoutReceiptBrowserChecks({page,sql,user,scenario,submittedAction,preparedAction,base}) {
  assert.equal(base,'https://127.0.0.1:5448');
  assert.equal((await sql.query('SELECT current_database() AS name')).rows[0].name,'cabinet_placement_test');
  const executionId=preparedAction?.payload?.executionId;
  assert.match(executionId||'',/^[a-f0-9-]{36}$/,'The live prepared operation must carry its server-issued identity');
  const readReceipt=async()=>(await sql.query(
    'SELECT status,result,replay_count FROM scout_execution_receipts WHERE owner_user_id=$1 AND execution_id=$2',
    [user.id,executionId]
  )).rows[0];
  const writeCount=async()=>Number((await sql.query(
    'SELECT count(*) AS n FROM scout_execution_proof_writes WHERE user_id=$1',[user.id]
  )).rows[0].n);
  const receipt=await readReceipt();
  if(scenario==='cancel'||scenario==='authorization-only'){
    assert.equal(receipt,undefined,'No execution means no claimed receipt');
    return {serverIssuedIdentity:true,receiptAbsent:true,deliberateReplayRequests:0};
  }
  assert.equal(submittedAction?.payload?.executionId,executionId);
  assert.equal(receipt?.status,scenario==='database-failure'?'unconfirmed':'completed');
  const before=await writeCount();
  async function browserRequest(action){
    return page.evaluate(async action=>{
      const response=await fetch('/api/scout/execute-action',{
        method:'POST',credentials:'include',headers:{'Content-Type':'application/json'},body:JSON.stringify({action}),
      });
      return {status:response.status,body:await response.json()};
    },action);
  }
  if(scenario==='database-failure'){
    const retry=await browserRequest(clone(submittedAction));
    assert.equal(retry.status,400);assert.equal(retry.body.success,false);
    assert.equal(await writeCount(),before);assert.equal((await readReceipt()).status,'unconfirmed');
    return {serverIssuedIdentity:true,unconfirmedReplayDenied:true,deliberateReplayRequests:1,additionalWrites:0};
  }
  if(scenario==='lost-acknowledgement'){
    const retry=await browserRequest(clone(submittedAction));
    assert.equal(retry.status,200);assert.equal(retry.body.executed,true);assert.equal(retry.body.data.replayed,true);
    assert.equal(retry.body.data.executionId,executionId);assert.equal(await writeCount(),before);
    return {serverIssuedIdentity:true,lostResponseReconciledByExplicitRequest:true,deliberateReplayRequests:1,additionalWrites:0};
  }

  // Read the thread saved by the production UI, not a manually seeded thread.
  let thread;
  for(let attempt=0;attempt<40;attempt++){
    const threads=(await sql.query(
      'SELECT id,messages FROM scout_conversations WHERE user_id=$1 AND archived_at IS NULL ORDER BY updated_at DESC LIMIT 8',
      [user.id]
    )).rows;
    thread=threads.find(candidate=>savedOperation(candidate.messages,executionId));
    if(thread)break;
    await new Promise(resolve=>setTimeout(resolve,250));
  }
  assert(thread,'The production saved conversation must retain the prepared operation identity');

  // Remove this synthetic account's local fallback so the reload proof depends
  // on the real saved-conversation API. Cookies still carry the real session.
  await page.evaluate(()=>localStorage.clear());
  const document=await page.reload({waitUntil:'domcontentloaded',timeout:60000});assert(document?.ok());
  const restored=await page.evaluate(async()=>{
    const response=await fetch('/api/scout/conversations',{credentials:'include'});
    return {status:response.status,body:await response.json()};
  });
  assert.equal(restored.status,200);
  const restoredThread=restored.body.conversations?.find(candidate=>candidate.id===thread.id);
  const restoredAction=savedOperation(restoredThread?.messages,executionId);
  assert(restoredAction,'The authenticated saved-conversation API must return the unchanged operation identity');
  const replayAction={...clone(submittedAction),payload:{...clone(restoredAction.payload),requiresApproval:true}};
  const replay=await browserRequest(replayAction);
  assert.equal(replay.status,200);assert.equal(replay.body.executed,true);assert.equal(replay.body.data.replayed,true);
  assert.equal(replay.body.data.executionId,executionId);assert.equal(await writeCount(),before);

  const changed=clone(replayAction);changed.payload.profilePatch={...changed.payload.profilePatch,firstName:'MustNotPersist'};
  const conflict=await browserRequest(changed);assert.equal(conflict.status,400);assert.equal(conflict.body.success,false);
  const invalid=clone(replayAction);invalid.payload.executionId='bad';
  const rejected=await browserRequest(invalid);assert.equal(rejected.status,400);assert.equal(rejected.body.success,false);

  const concurrent=await page.evaluate(async action=>Promise.all(Array.from({length:4},async()=>{
    const response=await fetch('/api/scout/execute-action',{
      method:'POST',credentials:'include',headers:{'Content-Type':'application/json'},body:JSON.stringify({action}),
    });
    return {status:response.status,body:await response.json()};
  })),replayAction);
  assert(concurrent.every(result=>result.status===200&&result.body.executed===true&&result.body.data.replayed===true));
  assert.equal(await writeCount(),before);assert.equal((await readReceipt()).replay_count,5);
  assert.notEqual((await sql.query('SELECT first_name FROM users WHERE id=$1',[user.id])).rows[0].first_name,'MustNotPersist');
  return {
    serverIssuedIdentity:true,productionConversationPersisted:true,realPageReload:true,localFallbackCleared:true,
    conversationApiRestored:true,replayEntry:'deliberate authenticated browser fetch using restored action; not a history-card click',
    changedPayloadDenied:true,invalidIdentityDenied:true,concurrentReplayRequests:4,
    deliberateReplayRequests:7,additionalWrites:0,completedReceiptRows:1,
  };
}
