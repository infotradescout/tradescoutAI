import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import crypto from 'node:crypto';
import {execFileSync, spawnSync} from 'node:child_process';
import pg from 'pg';
import ts from 'typescript';
import {startCabinetLoopbackTestDatabase} from './start-cabinet-loopback-test-db.mjs';

// Real production guard/receipt modules and native SQL. Only deliberate fault
// adapters are synthetic. This is not a browser or full-schema release gate.
function loadModules(database) {
  const cache = new Map();
  function load(file) {
    if(cache.has(file)) return cache.get(file);
    const compiled = ts.transpileModule(fs.readFileSync(file,'utf8'), {
      fileName:file, reportDiagnostics:true,
      compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS},
    });
    assert.equal((compiled.diagnostics||[]).filter(d=>d.category===ts.DiagnosticCategory.Error).length,0);
    const module={exports:{}};
    vm.runInNewContext(compiled.outputText, {module,exports:module.exports,
      console:{error(){},warn(){}},
      require(name){
        if(name==='node:crypto') return crypto;
        if(name==='../db') return {pool:database};
        if(name==='./scoutErrorMapping') return load('server/utils/scoutErrorMapping.ts');
        if(name==='./scoutExecutionReceipts') return load('server/utils/scoutExecutionReceipts.ts');
        throw new Error('Unexpected receipt-test dependency: '+name);
      },
    },{filename:file});
    cache.set(file,module.exports);return module.exports;
  }
  return {...load('server/utils/scoutActionGuard.ts'),...load('server/utils/scoutExecutionReceipts.ts')};
}
const plain=value=>JSON.parse(JSON.stringify(value));
const action=(key=crypto.randomUUID(),name='Jane')=>({type:'SAVE_PROFILE',payload:{executionId:key,profilePatch:{firstName:name}}});
const success=owner=>({executed:true,action:'SAVE_PROFILE',userId:owner,updatedFields:['firstName']});

if(process.argv.includes('--replay-child')) {
  const config=JSON.parse(fs.readFileSync(0,'utf8'));
  const url=new URL(config.url);assert(['127.0.0.1','localhost'].includes(url.hostname));
  const pool=new pg.Pool({connectionString:config.url});
  try {
    const result=await loadModules(pool).runScoutAction(config.action,{userId:config.owner},async()=>{
      await pool.query('INSERT INTO receipt_proof_writes(owner_id) VALUES($1)',[config.owner]);
      return success(config.owner);
    });
    console.log(JSON.stringify(plain(result)));
  }finally{await pool.end();}
  process.exit(0);
}

for(const key of ['DATABASE_URL','TEST_DATABASE_URL','SESSION_SECRET','STRIPE_SECRET_KEY','GEMINI_API_KEY','OPENAI_API_KEY']) {
  assert(!process.env[key],key+' must not be inherited by disposable proof');
}
const proof={head:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),
  startedAt:new Date().toISOString(),scope:'Actual Scout guard/receipt modules, real native SQL and independent replay process; synthetic owners only',cases:[],passed:false};
let database,pool;
async function check(name,fn){
  try{await fn();proof.cases.push({name,passed:true});}
  catch(error){proof.cases.push({name,passed:false,error:String(error.message).replace(/postgres(?:ql)?:\/\/[^\s"']+/g,'[LOCAL_TEST_DATABASE]')});}
  console.log('SCOUT_RECEIPT_CASE '+JSON.stringify(proof.cases.at(-1)));
}
try{
  database=await startCabinetLoopbackTestDatabase();proof.database=database.evidence;
  assert(['127.0.0.1','localhost'].includes(new URL(database.url).hostname));
  pool=new pg.Pool({connectionString:database.url,max:30});
  await pool.query('CREATE TABLE users(id varchar PRIMARY KEY,first_name text); CREATE TABLE receipt_proof_writes(id bigserial PRIMARY KEY,owner_id varchar NOT NULL)');
  await pool.query(fs.readFileSync('migrations/0139_scout_execution_receipts.sql','utf8'));
  const owners=['receipt-owner-a','receipt-owner-b'];
  await pool.query('INSERT INTO users(id) VALUES($1),($2)',owners);
  const owner=owners[0],context={userId:owner};
  const {runScoutAction,fingerprintScoutProfileAction,executeScoutProfileOnce}=loadModules(pool);
  const write=who=>async()=>{await pool.query('INSERT INTO receipt_proof_writes(owner_id) VALUES($1)',[who]);return success(who);};
  const count=async()=>Number((await pool.query('SELECT count(*) AS n FROM receipt_proof_writes')).rows[0].n);
  const receipt=async(key,who=owner)=>(await pool.query('SELECT * FROM scout_execution_receipts WHERE owner_user_id=$1 AND execution_id=$2',[who,key])).rows[0];
  let completedAction;

  await check('A confirmed execution creates one completed receipt without profile values',async()=>{
    completedAction=action();const before=await count();
    const result=await runScoutAction(completedAction,context,async()=>({...await write(owner)(),privateValue:'must-not-be-stored'}));
    assert.equal(result.ok,true);assert.equal(result.data.replayed,false);assert.equal(await count(),before+1);
    const saved=await receipt(completedAction.payload.executionId);
    assert.equal(saved.status,'completed');assert(saved.completed_at);assert.equal(saved.result.privateValue,undefined);
    assert(!JSON.stringify(saved).includes('must-not-be-stored'));assert(!JSON.stringify(saved).includes('Jane'));
  });
  await check('Sequential replay returns the same completed operation without another write',async()=>{
    const before=await count();const result=await runScoutAction(plain(completedAction),context,write(owner));
    assert.equal(result.ok,true);assert.equal(result.data.replayed,true);assert.equal(await count(),before);
    assert.equal((await receipt(completedAction.payload.executionId)).replay_count,1);
  });
  await check('A different Node process replays the durable receipt without writing',async()=>{
    const before=await count();const child=spawnSync(process.execPath,[process.argv[1],'--replay-child'],{
      input:JSON.stringify({url:database.url,action:completedAction,owner}),encoding:'utf8',timeout:30000,
    });
    assert.equal(child.status,0,'Independent replay process must finish successfully');
    const result=JSON.parse(child.stdout.trim());assert.equal(result.ok,true);assert.equal(result.data.replayed,true);
    assert.equal(await count(),before);
  });
  await check('Twenty concurrent requests cannot invoke a pending operation twice',async()=>{
    const candidate=action();let release,entered;const enteredPromise=new Promise(r=>{entered=r;});
    const held=new Promise(r=>{release=r;});let attempts=0;
    const execute=async()=>{attempts++;entered();await held;return write(owner)();};
    const before=await count();const original=runScoutAction(candidate,context,execute);await enteredPromise;
    const duplicates=await Promise.all(Array.from({length:20},()=>runScoutAction(plain(candidate),context,execute)));
    assert(duplicates.every(result=>result.ok===false));assert.equal(attempts,1);
    release();assert.equal((await original).ok,true);assert.equal(await count(),before+1);
    const replays=await Promise.all(Array.from({length:20},()=>runScoutAction(plain(candidate),context,execute)));
    assert(replays.every(result=>result.ok&&result.data.replayed));assert.equal(attempts,1);assert.equal(await count(),before+1);
    assert.equal((await receipt(candidate.payload.executionId)).replay_count,20);
  });
  await check('Object-key order and approval transport metadata do not change the fingerprint',async()=>{
    const a={type:'SAVE_PROFILE',payload:{executionId:crypto.randomUUID(),profilePatch:{lastName:'Doe',firstName:'Jane'}}};
    const b={type:'SAVE_PROFILE',payload:{requiresApproval:true,profilePatch:{firstName:'Jane',lastName:'Doe'},executionId:a.payload.executionId}};
    assert.equal(fingerprintScoutProfileAction(a),fingerprintScoutProfileAction(b));
    assert.equal((await runScoutAction(a,context,write(owner))).ok,true);
    assert.equal((await runScoutAction(b,context,write(owner))).data.replayed,true);
  });
  await check('Reusing a key with different profile data is rejected without writing',async()=>{
    const before=await count();const result=await runScoutAction(action(completedAction.payload.executionId,'Different'),context,write(owner));
    assert.equal(result.ok,false);assert.equal(await count(),before);
  });
  await check('The same key is isolated between authenticated owners',async()=>{
    const before=await count();const result=await runScoutAction(plain(completedAction),{userId:owners[1]},write(owners[1]));
    assert.equal(result.ok,true);assert.equal(result.data.userId,owners[1]);assert.equal(result.data.replayed,false);
    assert.equal(await count(),before+1);assert.equal((await receipt(completedAction.payload.executionId,owners[1])).status,'completed');
  });
  await check('A committed write with a lost executor acknowledgement is never retried',async()=>{
    const candidate=action();const before=await count();
    const result=await runScoutAction(candidate,context,async()=>{await write(owner)();throw new Error('Lost acknowledgement');});
    assert.equal(result.ok,false);assert.equal(await count(),before+1);
    assert.equal((await receipt(candidate.payload.executionId)).status,'unconfirmed');
    assert.equal((await runScoutAction(candidate,context,write(owner))).ok,false);assert.equal(await count(),before+1);
  });
  await check('A rejected database write remains unconfirmed, not completed',async()=>{
    const candidate=action();const before=await count();
    const result=await runScoutAction(candidate,context,async()=>{await pool.query('INSERT INTO receipt_proof_writes(owner_id) VALUES(NULL)');return success(owner);});
    assert.equal(result.ok,false);assert.equal(await count(),before);assert.equal((await receipt(candidate.payload.executionId)).status,'unconfirmed');
    assert.equal((await runScoutAction(candidate,context,write(owner))).ok,false);assert.equal(await count(),before);
  });
  await check('Losing the completion-UPDATE acknowledgement cannot erase a committed receipt',async()=>{
    const candidate=action();const before=await count();let fault=true;
    const adapter={async query(text,values){const result=await pool.query(text,values);
      if(fault&&text.includes("SET status = 'completed'")){fault=false;throw new Error('Lost receipt acknowledgement');}return result;}};
    const result=await loadModules(adapter).runScoutAction(candidate,context,write(owner));
    assert.equal(result.ok,false);assert.equal((await receipt(candidate.payload.executionId)).status,'completed');
    assert.equal((await runScoutAction(candidate,context,write(owner))).data.replayed,true);assert.equal(await count(),before+1);
  });
  await check('A completion-receipt failure before commit prevents repeat execution',async()=>{
    const candidate=action();const before=await count();
    const adapter={async query(text,values){if(text.includes("SET status = 'completed'"))throw new Error('Receipt unavailable');return pool.query(text,values);}};
    assert.equal((await loadModules(adapter).runScoutAction(candidate,context,write(owner))).ok,false);
    assert.equal((await receipt(candidate.payload.executionId)).status,'unconfirmed');
    assert.equal((await runScoutAction(candidate,context,write(owner))).ok,false);assert.equal(await count(),before+1);
  });
  await check('A failed initial claim never invokes the profile executor',async()=>{
    let attempts=0;const adapter={async query(){throw new Error('Database unavailable');}};
    const result=await loadModules(adapter).runScoutAction(action(),context,async()=>{attempts++;return success(owner);});
    assert.equal(result.ok,false);assert.equal(attempts,0);
  });
  await check('A lost claim acknowledgement leaves a non-reclaimable pending receipt',async()=>{
    const candidate=action();let attempts=0;
    const adapter={async query(text,values){const result=await pool.query(text,values);if(text.startsWith('INSERT INTO scout_execution_receipts'))throw new Error('Claim acknowledgement lost');return result;}};
    const execute=async()=>{attempts++;return success(owner);};
    assert.equal((await loadModules(adapter).runScoutAction(candidate,context,execute)).ok,false);
    assert.equal((await receipt(candidate.payload.executionId)).status,'pending');
    assert.equal((await runScoutAction(candidate,context,execute)).ok,false);assert.equal(attempts,0);
  });
  for(const [name,value] of [['authorization-only',{authorized:true,executed:false}],['empty',{}],['null',null],['negative-success',{...success(owner),success:false}],['negative-ok',{...success(owner),ok:false}],['wrong-owner',success(owners[1])]]) {
    await check(name+' result cannot create a completed receipt',async()=>{
      const candidate=action();const result=await runScoutAction(candidate,context,async()=>value);
      assert.equal(result.ok,false);assert.equal((await receipt(candidate.payload.executionId)).status,'unconfirmed');
    });
  }
  for(const key of ['',null,3,'short','../invalid-receipt-key','x'.repeat(129)]) {
    await check('Invalid key '+JSON.stringify(key)+' fails before any write',async()=>{
      let attempts=0;const result=await runScoutAction(action(key),context,async()=>{attempts++;return success(owner);});
      assert.equal(result.ok,false);assert.equal(attempts,0);
    });
  }
  await check('Guests cannot claim or replay an authenticated execution',async()=>{
    const before=await count();const result=await runScoutAction(plain(completedAction),{},write(owner));
    assert.equal(result.ok,false);assert.equal(await count(),before);
  });
  await check('Non-profile actions cannot enter the receipt executor',async()=>{
    let attempts=0;
    await assert.rejects(executeScoutProfileOnce({type:'SEND_MESSAGE',payload:{executionId:crypto.randomUUID()}},context,async()=>{attempts++;},pool));
    assert.equal(attempts,0);
  });
  await check('Completed-receipt totals are not inflated by replay requests',async()=>{
    const before=Number((await pool.query("SELECT count(*) AS n FROM scout_execution_receipts WHERE status='completed'")).rows[0].n);
    for(let i=0;i<5;i++)assert.equal((await runScoutAction(plain(completedAction),context,write(owner))).data.replayed,true);
    const after=Number((await pool.query("SELECT count(*) AS n FROM scout_execution_receipts WHERE status='completed'")).rows[0].n);
    assert.equal(after,before);
  });
  await check('Owner deletion removes only that owner’s receipt history',async()=>{
    const otherCount=Number((await pool.query('SELECT count(*) AS n FROM scout_execution_receipts WHERE owner_user_id=$1',[owners[1]])).rows[0].n);
    await pool.query('DELETE FROM users WHERE id=$1',[owners[1]]);
    assert(otherCount>0);assert.equal((await pool.query('SELECT * FROM scout_execution_receipts WHERE owner_user_id=$1',[owners[1]])).rowCount,0);
    assert(await receipt(completedAction.payload.executionId));
  });
  proof.passed=proof.cases.length>0&&proof.cases.every(item=>item.passed);
}finally{
  await pool?.end();await database?.stop();proof.finishedAt=new Date().toISOString();
  proof.totals={passed:proof.cases.filter(item=>item.passed).length,failed:proof.cases.filter(item=>!item.passed).length};
  console.log('SCOUT_RECEIPT_SUMMARY '+JSON.stringify(proof));
}
assert.equal(proof.passed,true,'Scout native receipt proof did not pass');
