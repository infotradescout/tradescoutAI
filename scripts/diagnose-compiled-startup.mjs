import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import assert from 'node:assert/strict';
import {spawn,spawnSync,execFileSync} from 'node:child_process';
import {randomBytes} from 'node:crypto';
import pg from 'pg';
import {startCabinetLoopbackTestDatabase} from './start-cabinet-loopback-test-db.mjs';
const root=process.cwd(), output=path.resolve(process.env.STARTUP_PROOF_OUTPUT||'.startup-proof');
const temp=await fs.mkdtemp(path.join(os.tmpdir(),'startup-diagnostic-'));
const head=execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim();
const proof={head,startedAt:new Date().toISOString(),checks:[],passed:false};
let database,child,copiedRuntimeSecurity=false;
function clean(){return execFileSync('git',['status','--porcelain'],{encoding:'utf8'}).trim();}
function run(name,args,env={}){const r=spawnSync(args[0],args.slice(1),{cwd:root,env:{...process.env,...env},encoding:'utf8',timeout:600000,maxBuffer:50*1024*1024});const log=((r.stdout||'')+(r.stderr||'')).replace(/postgres(?:ql)?:\/\/[^\s"']+/g,'[LOCAL_TLS_DATABASE]');console.log(log);proof.checks.push({name,status:r.status,passed:r.status===0,tail:log.slice(-3000)});assert.equal(r.status,0,name);}
async function boot(filename,environment,tag){
 const logPath=path.join(temp,tag+'.log'),file=await fs.open(logPath,'w',0o600);
 child=spawn(process.execPath,['--trace-warnings','--trace-uncaught',filename],{cwd:root,env:environment,stdio:['ignore',file.fd,file.fd]});
 let health;
 for(let i=0;i<180;i++){
   if(child.exitCode!==null||child.signalCode)break;
   try{const r=await fetch('http://127.0.0.1:5238/api/health',{signal:AbortSignal.timeout(800)});if(r.ok){health=await r.json();break;}}catch{}
   await new Promise(resolve=>setTimeout(resolve,500));
 }
 const exitCode=child.exitCode,signal=child.signalCode;
 if(child.exitCode===null&&!child.signalCode){const target=child;target.kill('SIGTERM');await Promise.race([new Promise(resolve=>target.once('exit',resolve)),new Promise(resolve=>setTimeout(()=>{target.kill('SIGKILL');resolve();},3000))]);}
 child=undefined;await file.close();
 const log=(await fs.readFile(logPath,'utf8')).replace(/postgres(?:ql)?:\/\/[^\s"']+/g,'[LOCAL_TLS_DATABASE]');
 const pending=log.split('\n').findLast(line=>line.startsWith('PENDING_MODULES '));
 const entry={tag,exitCode,signal,health,pending:pending?JSON.parse(pending.slice(16)):undefined,tail:log.slice(-18000)}; proof.checks.push(entry);
 console.log('STARTUP_BOOT '+JSON.stringify(entry));return entry;
}
try{
 assert.equal(clean(),'');
 for(const key of ['DATABASE_URL','TEST_DATABASE_URL','SENDGRID_API_KEY','RESEND_API_KEY','BREVO_API_KEY','SMTP_PASS','STRIPE_SECRET_KEY'])assert(!process.env[key],key+' must not be inherited');
 run('Build production bundle',['npm','run','build']);
 const bundle=await fs.readFile('dist/index.js','utf8');
 assert.equal(await fs.stat('runtime/database-url-security.mjs').then(()=>true,()=>false),false);
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
 const environment={PATH:process.env.PATH,HOME:temp,TMPDIR:temp,NODE_ENV:'production',DATABASE_URL:url.href,SESSION_SECRET:randomBytes(48).toString('hex'),PORT:'5238',HOST:'127.0.0.1',PUBLIC_WEB_URL:'http://127.0.0.1:5238',RENDER:'false',GIT_COMMIT:head,NODE_OPTIONS:'--max-old-space-size=4096',EMAIL_MODE:'account_creation_only',DISABLE_FACEBOOK_AUTH:'true',SCOUT_DISABLE_BACKGROUND_JOBS:'true',ENABLE_SCHEDULER_LEADERSHIP:'false'};
 const actual=await boot('dist/index.js',environment,'unmodified-compiled');
 if(!actual.health){
   // Diagnostics only: instrument generated wrappers; never use as release proof.
   const pattern=/var __esm = \(fn, res(?:, err)?\) => function __init\(\) \{[\s\S]*?\n\};/;
   const match=bundle.match(pattern);proof.initializerPatternMatched=Boolean(match);
   if(match){
     const replacement='const __pendingModules=new Set();process.on("beforeExit",()=>console.error("PENDING_MODULES "+JSON.stringify([...__pendingModules])));var __esm=(fn,res,err)=>{const name=Object.keys(fn)[0],original=fn[name];fn[name]=(...args)=>{__pendingModules.add(name);const value=original(...args);if(value&&typeof value.then==="function")value.then(()=>__pendingModules.delete(name));else __pendingModules.delete(name);return value;};return function __init(){if(err)throw err[0];try{return fn&&(res=(0,fn[__getOwnPropNames(fn)[0]])(fn=0)),res;}catch(e){throw err=[e],e;}};};';
     await fs.writeFile('dist/index.diagnostic.js',bundle.replace(pattern,replacement));
     const diagnostic=await boot('dist/index.diagnostic.js',environment,'instrumented-diagnostic-only');
     proof.pendingBodies=(diagnostic.pending||[]).map(name=>{const index=bundle.indexOf('"'+name+'"(');return {name,index,body:bundle.slice(index,index+1800)};});
     console.log('STARTUP_PENDING_BODIES '+JSON.stringify(proof.pendingBodies));
   }
 }
 await fs.rm('runtime/database-url-security.mjs');copiedRuntimeSecurity=false;
 proof.sourceStatus=clean();assert.equal(proof.sourceStatus,'');proof.passed=Boolean(actual.health);
}catch(error){proof.error=String(error.stack||error).replace(/postgres(?:ql)?:\/\/[^\s"']+/g,'[LOCAL_TLS_DATABASE]');console.error('STARTUP_FAILURE '+proof.error);}
finally{child?.kill('SIGKILL');await database?.stop();if(copiedRuntimeSecurity)await fs.rm('runtime/database-url-security.mjs');proof.finishedAt=new Date().toISOString();await fs.mkdir(output,{recursive:true});await fs.writeFile(path.join(output,'evidence.json'),JSON.stringify(proof,null,2));await fs.writeFile(path.join(output,'index.html'),'<meta name="robots" content="noindex,nofollow"><h1>Compiled startup diagnostic</h1><a href="evidence.json">Evidence</a>');await fs.rm(temp,{recursive:true,force:true});console.log('STARTUP_RESULT '+JSON.stringify(proof));}
