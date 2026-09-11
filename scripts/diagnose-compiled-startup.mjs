import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import assert from 'node:assert/strict';
import {spawn,spawnSync,execFileSync} from 'node:child_process';
import {randomBytes,createHash} from 'node:crypto';
import pg from 'pg';
import {startCabinetLoopbackTestDatabase} from './start-cabinet-loopback-test-db.mjs';

const root=process.cwd(), output=path.resolve(process.env.STARTUP_PROOF_OUTPUT||'.startup-proof');
const temp=await fs.mkdtemp(path.join(os.tmpdir(),'startup-diagnostic-'));
const head=execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim();
const phase=process.env.STARTUP_PHASE||'diagnostic';
assert(['diagnostic','release','production'].includes(phase));
const proof={head,phase,node:process.version,startedAt:new Date().toISOString(),checks:[],passed:false};
let database,child,copiedRuntimeSecurity=false;
function clean(){return execFileSync('git',['status','--porcelain'],{encoding:'utf8'}).trim();}
function redact(value){return String(value).replace(/postgres(?:ql)?:\/\/[^\s"']+/g,'[LOCAL_TLS_DATABASE]');}
function run(name,args,env={}){
 const r=spawnSync(args[0],args.slice(1),{cwd:root,env:{...process.env,...env},encoding:'utf8',timeout:1200000,maxBuffer:60*1024*1024});
 const log=redact((r.stdout||'')+(r.stderr||''));console.log(log);
 proof.checks.push({name,status:r.status,passed:r.status===0,tail:log.slice(-3000)});assert.equal(r.status,0,name);
}
async function stopChild(){
 const target=child;child=undefined;if(!target||target.exitCode!==null||target.signalCode)return;
 await new Promise(resolve=>{const timer=setTimeout(()=>{target.kill('SIGKILL');resolve();},5000);target.once('exit',()=>{clearTimeout(timer);resolve();});target.kill('SIGTERM');});
}
async function boot(filename,environment,tag){
 const logPath=path.join(temp,tag+'.log'),file=await fs.open(logPath,'w',0o600);
 child=spawn(process.execPath,['--trace-warnings','--trace-uncaught',filename],{cwd:root,env:environment,stdio:['ignore',file.fd,file.fd]});
 let health;
 for(let i=0;i<180;i++){
   if(child.exitCode!==null||child.signalCode)break;
   try{const r=await fetch('http://127.0.0.1:5238/api/health',{signal:AbortSignal.timeout(800)});if(r.ok){health=await r.json();assert.equal(r.headers.get('x-tradescout-build'),head);break;}}catch{}
   await new Promise(resolve=>setTimeout(resolve,500));
 }
 const exitCode=child.exitCode,signal=child.signalCode;
 if(health){
   assert.equal(health.commit,head);assert.equal(health.status,'healthy');assert.equal(health.database,'connected');
   assert.equal(health.migrations.compatibility,'compatible');assert.equal(health.migrations.appliedCount,142);assert.equal(health.migrations.expectedCount,142);assert.equal(health.migrations.requiredSchemaOk,true);
   const url='http://127.0.0.1:5238';
   for(const route of ['/exchange','/exchange/building-materials','/api/exchange/items?categoryId=building-materials&limit=48']){
     const r=await fetch(url+route,{signal:AbortSignal.timeout(10000)});assert.equal(r.status,200,route);assert.equal(r.headers.get('x-tradescout-build'),head);
     if(route.startsWith('/api/'))assert(Array.isArray(await r.json()));
   }
 }
 await stopChild();await file.close();
 const log=redact(await fs.readFile(logPath,'utf8'));
 const pending=log.split('\n').findLast(line=>line.startsWith('PENDING_MODULES '));
 const entry={tag,exitCode,signal,health,pending:pending?JSON.parse(pending.slice(16)):undefined,tail:log.slice(-16000)};
 proof.checks.push(entry);console.log('STARTUP_BOOT '+JSON.stringify(entry));return entry;
}
try{
 assert.equal(clean(),'');
 for(const key of ['DATABASE_URL','TEST_DATABASE_URL','SENDGRID_API_KEY','RESEND_API_KEY','BREVO_API_KEY','SMTP_PASS','STRIPE_SECRET_KEY'])assert(!process.env[key],key+' must not be inherited');
 if(phase!=='production'){
   run('Compiled cycle regression',['npm','run','test:run','--','server/tests/exposure-authority-startup.behavior.test.ts','--maxWorkers=1']);
   run('Build production bundle',['npm','run','build']);
   const bundle=await fs.readFile('dist/index.js','utf8');proof.bundleSha256=createHash('sha256').update(bundle).digest('hex');
   assert.equal(await fs.stat('runtime/database-url-security.mjs').then(()=>true,()=>false),false);
   // Exact runtime-only copy performed by the existing Dockerfile.
   await fs.copyFile('shared/database-url-security.mjs','runtime/database-url-security.mjs');copiedRuntimeSecurity=true;
   database=await startCabinetLoopbackTestDatabase();proof.database=database.evidence;
   const local=new pg.Client({connectionString:database.url});await local.connect();
   const cert=path.join(temp,'server.crt'),key=path.join(temp,'server.key');
   run('Generate isolated TLS certificate',['openssl','req','-x509','-newkey','rsa:2048','-nodes','-keyout',key,'-out',cert,'-days','1','-subj','/CN=localhost','-addext','subjectAltName=DNS:localhost,IP:127.0.0.1']);
   await fs.chmod(key,0o600);
   await local.query("ALTER SYSTEM SET ssl_cert_file = '"+cert.replaceAll("'","''")+"'");
   await local.query("ALTER SYSTEM SET ssl_key_file = '"+key.replaceAll("'","''")+"'");
   await local.query("ALTER SYSTEM SET ssl = 'on'");await local.query('SELECT pg_reload_conf()');await local.end();
   const url=new URL(database.url);url.searchParams.set('sslmode','verify-full');url.searchParams.set('sslrootcert',cert);
   await new Promise(resolve=>setTimeout(resolve,500));
   const tls=new pg.Client({connectionString:url.href});await tls.connect();proof.tls=(await tls.query('SELECT ssl,version,cipher FROM pg_stat_ssl WHERE pid=pg_backend_pid()')).rows[0];await tls.end();assert.equal(proof.tls.ssl,true);
   run('Migrate fresh production-mode TLS database',['npm','run','db:migrate'],{NODE_ENV:'production',DATABASE_URL:url.href});
   run('Verify fresh production-mode TLS schema',['npm','run','db:verify:required'],{NODE_ENV:'production',DATABASE_URL:url.href});
   const environment={PATH:process.env.PATH,HOME:temp,TMPDIR:temp,NODE_ENV:'production',DATABASE_URL:url.href,SESSION_SECRET:randomBytes(48).toString('hex'),PORT:'5238',HOST:'127.0.0.1',PUBLIC_WEB_URL:'http://127.0.0.1:5238',RENDER:'false',GIT_COMMIT:head,NODE_OPTIONS:'--max-old-space-size=4096',EMAIL_MODE:'account_creation_only',DISABLE_FACEBOOK_AUTH:'true'};
   const actual=await boot('dist/index.js',environment,'unmodified-compiled');proof.compiledBoot=Boolean(actual.health);
   if(!actual.health&&phase==='diagnostic'){
     const pattern=/var __esm = \(fn, res(?:, err)?\) => function __init\(\) \{[\s\S]*?\n\};/;
     if(bundle.match(pattern)){
       const replacement='const __pendingModules=new Set();process.on("beforeExit",()=>console.error("PENDING_MODULES "+JSON.stringify([...__pendingModules])));var __esm=(fn,res,err)=>{const name=Object.keys(fn)[0],original=fn[name];fn[name]=(...args)=>{__pendingModules.add(name);const value=original(...args);if(value&&typeof value.then==="function")value.then(()=>__pendingModules.delete(name));else __pendingModules.delete(name);return value;};return function __init(){if(err)throw err[0];try{return fn&&(res=(0,fn[__getOwnPropNames(fn)[0]])(fn=0)),res;}catch(e){throw err=[e],e;}};};';
       await fs.writeFile('dist/index.diagnostic.js',bundle.replace(pattern,replacement));
       const diagnostic=await boot('dist/index.diagnostic.js',environment,'instrumented-diagnostic-only');
       proof.pendingBodies=(diagnostic.pending||[]).map(name=>{const index=bundle.indexOf('"'+name+'"(');return {name,body:bundle.slice(index,index+1800)};});
     }
   }
   await fs.rm('runtime/database-url-security.mjs');copiedRuntimeSecurity=false;await database.stop();database=undefined;
   assert.equal(createHash('sha256').update(await fs.readFile('dist/index.js')).digest('hex'),proof.bundleSha256);
   assert.equal(proof.compiledBoot,true,'The unmodified compiled production server must start');
   assert.equal(clean(),'');
 }
 if(phase==='release'||phase==='production'){
   const customerOutput=path.join(temp,'customer-release');
   run('Complete unchanged customer release verification',[process.execPath,'scripts/verify-customer-path-release.mjs'],{CUSTOMER_PATH_PHASE:phase,CUSTOMER_PATH_OUTPUT:customerOutput});
   proof.customerRelease=JSON.parse(await fs.readFile(path.join(customerOutput,'evidence.json'),'utf8'));
   assert.equal(proof.customerRelease.head,head);assert.equal(proof.customerRelease.passed,true);
   if(phase==='release'){assert.equal(proof.customerRelease.releaseAttested,true);assert.equal(proof.customerRelease.minimumRelease.attestable,true);}
   await fs.mkdir(output,{recursive:true});
   for(const name of await fs.readdir(customerOutput))if(name.endsWith('.png')||name==='browser-evidence.json')await fs.copyFile(path.join(customerOutput,name),path.join(output,name));
 }
 proof.sourceStatus=clean();assert.equal(proof.sourceStatus,'');proof.passed=true;
}catch(error){proof.error=redact(error.stack||error);console.error('STARTUP_FAILURE '+proof.error);}
finally{
 await stopChild();await database?.stop();if(copiedRuntimeSecurity)await fs.rm('runtime/database-url-security.mjs');proof.finishedAt=new Date().toISOString();
 await fs.mkdir(output,{recursive:true});await fs.writeFile(path.join(output,'evidence.json'),JSON.stringify(proof,null,2));
 await fs.writeFile(path.join(output,'index.html'),'<meta name="robots" content="noindex,nofollow"><h1>'+ (proof.passed?'Declared startup/release checks passed':'FAILED — not release approval')+'</h1><p>'+phase+' '+head+'</p><a href="evidence.json">Evidence</a>');
 await fs.rm(temp,{recursive:true,force:true});
 console.log('STARTUP_SUMMARY '+JSON.stringify({...proof,customerRelease:proof.customerRelease?{head:proof.customerRelease.head,passed:proof.customerRelease.passed,releaseAttested:proof.customerRelease.releaseAttested,tests:proof.customerRelease.tests,databaseTests:proof.customerRelease.databaseTests,minimumRelease:proof.customerRelease.minimumRelease,deployed:proof.customerRelease.deployed,health:proof.customerRelease.health,browser:proof.customerRelease.browser,liveRecommendationEntry:proof.customerRelease.liveRecommendationEntry}:undefined,checks:proof.checks.map(({tail,...entry})=>entry)}));
}
