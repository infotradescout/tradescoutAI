import assert from 'node:assert/strict';
import test from 'node:test';
import { createServer, request } from 'node:http';
import { EventEmitter } from 'node:events';
import {
  createOperationalRequestDiagnostics, getOperationalRequestContext,
  observeOperationalError, recordOperationalOutcome, recordOperationalValidation,
} from '../../server/services/operationalRequestContext.ts';

function fixture() {
  const logs = [];
  const req = Object.assign(new EventEmitter(), {method:'GET', url:'/api/example', headers:{host:'jwstonelogistics.com'}});
  const headers = new Map();
  const res = Object.assign(new EventEmitter(), {
    statusCode:200, writableFinished:false,
    setHeader(key,value) {headers.set(key.toLowerCase(),value);},
    getHeader(key) {return headers.get(key.toLowerCase());},
    json(body) {this.body=body;return this;},
  });
  const logger = Object.fromEntries(['info','warn','error'].map(level => [level,(message,meta) => logs.push({level,message,meta})]));
  const middleware = createOperationalRequestDiagnostics(logger);
  const finish = () => {res.writableFinished=true;res.emit('finish');res.emit('close');return logs[0];};
  return {logs,req,res,logger,middleware,finish};
}

test('fast successful requests are logged once, with server-generated correlation', () => {
  const f=fixture(); f.req.headers['x-request-id']='caller-chosen';
  f.middleware(f.req,f.res,()=>{});
  const {meta}=f.finish();
  assert.match(meta.requestId,/^[0-9a-f-]{36}$/);
  assert.notEqual(meta.requestId,'caller-chosen');
  assert.equal(meta.requestId,f.res.getHeader('x-request-id'));
  assert.equal(f.logs.length,1); assert.equal(meta.completion,'finished');
  assert.equal(meta.actorEvidence,'unknown'); assert.equal(meta.actorId,null);
});

test('early redirects are visible without claiming a sale or authenticated actor', () => {
  const f=fixture();f.req.url='/';
  f.middleware(f.req,f.res,()=>{f.res.statusCode=301;});
  const {meta}=f.finish();assert.equal(meta.statusCode,301);
  assert.equal(meta.host,'jwstonelogistics.com');assert.equal(meta.businessSuccess,undefined);
});

test('abort produces one warning, not a successful completion', () => {
  const f=fixture();f.middleware(f.req,f.res,()=>{});f.res.emit('close');f.res.emit('finish');
  assert.equal(f.logs.length,1);assert.equal(f.logs[0].level,'warn');assert.equal(f.logs[0].meta.completion,'aborted');
});

test('double registration cannot duplicate completion records', () => {
  const f=fixture();let calls=0;f.middleware(f.req,f.res,()=>calls++);f.middleware(f.req,f.res,()=>calls++);
  f.finish();assert.equal(calls,2);assert.equal(f.logs.length,1);
});

test('response allowlist retains reason codes, false outcome and IDs, never response contents', () => {
  const f=fixture();f.middleware(f.req,f.res,()=>{
    f.res.statusCode=400;f.res.json({code:'VALIDATION_FAILED',success:false,errorId:'err-test',requestId:'work-test',message:'private name secret',password:'hidden',email:'private@example.test'});
  });
  const {meta}=f.finish();assert.deepEqual(meta.response,{code:'VALIDATION_FAILED',errorId:'err-test',responseRequestId:'work-test',businessSuccess:false});
});

test('Zod-style issues retain field paths and codes but not submitted values or messages', () => {
  const f=fixture();f.middleware(f.req,f.res,()=>f.res.json({issues:[{code:'invalid_type',path:['lines',0,'quantity'],input:'SECRET',message:'SECRET'}]}));
  const {meta}=f.finish();assert.deepEqual(meta.response.validationIssues,[{code:'invalid_type',path:['lines',0,'quantity']}]);
  assert.equal(JSON.stringify(meta).includes('SECRET'),false);
});

test('more than twenty validation issues is counted but bounded', () => {
  const f=fixture();f.middleware(f.req,f.res,()=>f.res.json({errors:Array.from({length:50},()=>({code:'invalid_type',path:['field']}))}));
  const {meta}=f.finish();assert.equal(meta.response.validationIssues.length,20);assert.equal(meta.response.validationIssueCount,50);
});

test('free-text rejection is not invented into a stable reason', () => {
  const f=fixture();f.middleware(f.req,f.res,()=>{f.res.statusCode=400;f.res.json({message:'request rejected'});});
  const {meta}=f.finish();assert.deepEqual(meta.response,{});
});

test('parser error type is observed without leaking raw parser message or changing the error', () => {
  const f=fixture();const error=Object.assign(new Error('SECRET request password'),{type:'entity.parse.failed'});let forwarded;
  f.middleware(f.req,f.res,()=>observeOperationalError(error,f.req,f.res,e=>{forwarded=e;f.res.statusCode=400;}));
  const {meta}=f.finish();assert.equal(forwarded,error);assert.equal(meta.errorType,'entity.parse.failed');
  assert.equal(JSON.stringify(meta).includes('SECRET'),false);assert.equal(meta.exceptionObserved,true);
});

test('a hostile error getter cannot prevent the original error reaching next', () => {
  const f=fixture();const error=new Proxy({}, {getOwnPropertyDescriptor(){throw new Error('getter failure');}});let forwarded;
  f.middleware(f.req,f.res,()=>observeOperationalError(error,f.req,f.res,e=>{forwarded=e;}));
  assert.equal(forwarded,error);f.finish();
});

test('identifiers from server outcome annotation survive without leaking arbitrary fields', () => {
  const f=fixture();f.middleware(f.req,f.res,()=>recordOperationalOutcome(f.res,{jobId:'job-1',profileSlug:'jw-stone',providerStatus:'accepted',password:'SECRET',message:'SECRET'}));
  const {meta}=f.finish();assert.equal(meta.jobId,'job-1');assert.equal(meta.providerStatus,'accepted');
  assert.equal(JSON.stringify(meta).includes('SECRET'),false);assert.equal(meta.delivered,undefined);
});

test('body, cookie, authorization and query values are not read or copied', () => {
  const f=fixture();f.req.url='/api/example?token=SECRET';f.req.headers.cookie='SECRET';f.req.headers.authorization='Bearer SECRET';
  Object.defineProperty(f.req,'body',{get(){throw new Error('must not read body');}});
  f.middleware(f.req,f.res,()=>{});const {meta}=f.finish();assert.equal(meta.path,'/api/example');assert.equal(JSON.stringify(meta).includes('SECRET'),false);
});

test('authentication tokens and emails in URL path segments are redacted', () => {
  for(const url of ['/api/reset-password/SECRET','/api/users/private%40example.test']){
    const f=fixture();f.req.url=url;f.middleware(f.req,f.res,()=>{});const {meta}=f.finish();
    assert.match(meta.path,/\[REDACTED\]/);assert.equal(meta.path.includes('SECRET'),false);assert.equal(meta.path.includes('%40'),false);
  }
});

test('caller test/bot headers cannot establish first-party traffic classification', () => {
  const f=fixture();f.req.headers['x-test']='true';f.req.headers['x-actor-id']='caller-forgery';
  f.req.headers['user-agent']='Mozilla/5.0';f.middleware(f.req,f.res,()=>{});
  const {meta}=f.finish();assert.equal(meta.agentHint,'unknown');assert.equal(meta.actorEvidence,'unknown');assert.equal(meta.actorId,null);
});

test('bot and automation hints remain explicitly unverified hints', () => {
  for(const [ua,hint] of [['Googlebot','bot'],['Playwright','test'],['Mozilla/5.0','unknown']]){
    const f=fixture();f.req.headers['user-agent']=ua;f.middleware(f.req,f.res,()=>{});const {meta}=f.finish();
    assert.equal(meta.agentHint,hint);assert.equal(meta.actorEvidence,'unknown');
  }
});

test('session-established internal ID is refreshed when downstream logging reads its context', () => {
  const f=fixture();f.middleware(f.req,f.res,()=>{
    assert.equal(getOperationalRequestContext().actorId,null);
    f.req.user={id:'user-1',email:'SECRET'};
    assert.equal(getOperationalRequestContext().actorId,'user-1');
  });
  assert.equal(getOperationalRequestContext(),undefined);
  assert.equal(f.finish().meta.actorEvidence,'authenticated_session');
});

test('context returned to callers is a copy, not mutation authority', () => {
  const f=fixture();f.middleware(f.req,f.res,()=>{getOperationalRequestContext().requestId='forged';});
  assert.notEqual(f.finish().meta.requestId,'forged');
});

test('diagnostic sink failure does not fail the business callback', () => {
  const f=fixture();const mw=createOperationalRequestDiagnostics({info(){throw new Error('sink');},warn(){},error(){}});let completed=false;
  mw(f.req,f.res,()=>{completed=true;});assert.doesNotThrow(()=>f.finish());assert.equal(completed,true);
});

test('json wrapper preserves original response object and return behavior', () => {
  const f=fixture();const body={success:true,private:'not-logged'};
  f.middleware(f.req,f.res,()=>assert.equal(f.res.json(body),f.res));
  assert.equal(f.res.body,body);assert.equal(f.finish().meta.response.businessSuccess,true);
});

test('a later error response cannot retain IDs from an earlier failed serialization', () => {
  const f=fixture();f.middleware(f.req,f.res,()=>{f.res.json({jobId:'old-id'});f.res.json({errorId:'error-final'});});
  assert.deepEqual(f.finish().meta.response,{errorId:'error-final'});
});

test('health polling is explicitly marked, rather than counted as customer traffic', () => {
  const f=fixture();f.req.url='/api/health';f.middleware(f.req,f.res,()=>{});assert.equal(f.finish().meta.probe,true);
});

test('native HTTP concurrency keeps independent IDs and asynchronous contexts isolated', async () => {
  const logs=[];const contexts=[];
  const middleware=createOperationalRequestDiagnostics({info:(message,meta)=>logs.push(meta),warn:(message,meta)=>logs.push(meta),error:(message,meta)=>logs.push(meta)});
  const server=createServer((req,res)=>{
    res.json=function(body){this.setHeader('content-type','application/json');this.end(JSON.stringify(body));return this;};
    middleware(req,res,()=>{
      const before=getOperationalRequestContext().requestId;
      setTimeout(()=>{
        req.user={id:req.url==='/one'?'actor-one':'actor-two'};
        contexts.push({url:req.url,before,after:getOperationalRequestContext().requestId,actor:getOperationalRequestContext().actorId});
        res.statusCode=201;res.json({workRequestId:req.url==='/one'?'work-one':'work-two',success:true});
      },req.url==='/one'?20:1);
    });
  });
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  try{
    const get=path=>new Promise((resolve,reject)=>{const r=request({hostname:'127.0.0.1',port:server.address().port,path},res=>{let data='';res.on('data',b=>data+=b);res.on('end',()=>resolve({headers:res.headers,body:JSON.parse(data),status:res.statusCode}));});r.on('error',reject);r.end();});
    const responses=await Promise.all([get('/one'),get('/two')]);
    assert.equal(logs.length,2);assert.equal(new Set(logs.map(r=>r.requestId)).size,2);
    assert.ok(contexts.every(c=>c.before===c.after));assert.equal(getOperationalRequestContext(),undefined);
    for(const [i,path] of ['/one','/two'].entries()){
      const row=logs.find(r=>r.path===path);assert.equal(row.requestId,responses[i].headers['x-request-id']);
      assert.equal(row.response.workRequestId,responses[i].body.workRequestId);assert.equal(row.statusCode,201);
      assert.equal(row.actorId,path==='/one'?'actor-one':'actor-two');
    }
  }finally{await new Promise(resolve=>server.close(resolve));}
});

test('provider acknowledgment IDs are retained without claiming recipient delivery', () => {
  const f=fixture();f.middleware(f.req,f.res,()=>recordOperationalOutcome(f.res,{
    businessNotificationMessageId:'<synthetic-123@smtp.example>',businessNotificationEmailStatus:'sent',onboardingEmailStatus:'skipped',onboardingEmailReason:'email_provider_not_configured',
  }));
  const {meta}=f.finish();assert.equal(meta.businessNotificationMessageId,'<synthetic-123@smtp.example>');
  assert.equal(meta.onboardingEmailStatus,'skipped');assert.equal(meta.onboardingEmailReason,'email_provider_not_configured');assert.equal(meta.delivered,undefined);
});

test('shared logger includes context but never lets metadata forge authoritative request identity', async () => {
  const {logger}=await import('../../server/services/logger.ts');
  const f=fixture();const original=console.log;let line;
  console.log=(...args)=>{line=args;};
  try{
    f.middleware(f.req,f.res,()=>logger.info('linked event',{requestContext:{requestId:'forged'},reason:'known_reason'}));
  }finally{console.log=original;}
  const payload=JSON.parse(line[1]);assert.equal(payload.reason,'known_reason');
  assert.equal(payload.requestContext.requestId,f.req.requestId);assert.equal(payload.requestContext.host,'jwstonelogistics.com');
  f.finish();
});

test('shared logger carries a request ID even with no supplied metadata', async () => {
  const {logger}=await import('../../server/services/logger.ts');const f=fixture();const original=console.log;let line;
  console.log=(...args)=>{line=args;};
  try{f.middleware(f.req,f.res,()=>logger.info('linked event'));}finally{console.log=original;}
  assert.equal(JSON.parse(line[1]).requestContext.requestId,f.req.requestId);f.finish();
});

test('shared logger retains plain Error fields and secret redaction inside a request', async () => {
  const {logger}=await import('../../server/services/logger.ts');const f=fixture();const original=console.error;let line;
  console.error=(...args)=>{line=args;};
  try{f.middleware(f.req,f.res,()=>logger.error('error event',Object.assign(new Error('known reason'),{password:'SECRET'})));}finally{console.error=original;}
  const data=JSON.parse(line[1]);assert.equal(data.message,'known reason');assert.equal(data.password,'[REDACTED]');
  assert.equal(data.requestContext.requestId,f.req.requestId);assert.ok(data.stack);f.finish();
});

test('shared logger outside a request preserves its existing no-metadata format', async () => {
  const {logger}=await import('../../server/services/logger.ts');const original=console.log;let line;
  console.log=(...args)=>{line=args;};
  try{logger.info('unchanged');}finally{console.log=original;}
  assert.deepEqual(line,['[INFO] unchanged','']);
});

test('actual request-validation annotation keeps issue codes without changing public response shape', () => {
  const f=fixture();const response={message:'Enter your name, email, phone number, and request details.',issues:{fieldErrors:{phone:['SECRET validation message']}}};
  f.middleware(f.req,f.res,()=>{
    recordOperationalOutcome(f.res,{code:'EXPRESS_REQUEST_VALIDATION_FAILED'});
    recordOperationalValidation(f.res,[{code:'custom',path:['phone'],message:'SECRET',input:'SECRET'}]);
    f.res.statusCode=400;f.res.json(response);
  });
  const {meta}=f.finish();assert.equal(f.res.body,response);assert.equal(meta.code,'EXPRESS_REQUEST_VALIDATION_FAILED');
  assert.deepEqual(meta.validationIssues,[{code:'custom',path:['phone']}]);assert.equal(JSON.stringify(meta).includes('SECRET'),false);
});

test('server-provided claims ID is supported like the existing express route', () => {
  const f=fixture();f.middleware(f.req,f.res,()=>{f.req.user={claims:{sub:'user-claims'}};assert.equal(getOperationalRequestContext().actorId,'user-claims');});
  assert.equal(f.finish().meta.actorId,'user-claims');
});
