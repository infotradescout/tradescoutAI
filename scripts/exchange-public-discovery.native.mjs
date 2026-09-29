import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { randomBytes, randomUUID } from 'node:crypto';
import { spawn, spawnSync, execFileSync } from 'node:child_process';
import pg from 'pg';
import http from 'node:http';
import { chromium } from 'playwright';
import { EXCHANGE_CATEGORY_TO_MARKETPLACE_NAME } from '../shared/exchangeListingRules.ts';
import { startCabinetLoopbackTestDatabase } from './start-cabinet-loopback-test-db.mjs';

const head = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
const temp = await fs.mkdtemp(path.join(os.tmpdir(), 'exchange-public-native-'));
const output = path.resolve(process.env.EXCHANGE_PUBLIC_OUTPUT || 'test-results/exchange-public-discovery');
const base = 'http://127.0.0.1:5241';
const browserBase = 'https://www.thetradescout.com';
const report = { head, source: 'Actual compiled application, owned loopback PostgreSQL, synthetic publication records', checks: [], passed: false, customerWrites: false, providerCalls: false };
let database, client, processHandle, browser, privateLog, activePage;
const browserErrors = [], networkErrors = [];
function note(name, detail = {}) { report.checks.push({ name, ...detail }); console.log('EX731_NATIVE_CHECK ' + JSON.stringify(report.checks.at(-1))); }
function run(name, args, env) {
  const r = spawnSync(args[0], args.slice(1), { env: { ...process.env, ...env }, encoding: 'utf8', timeout: 900000, maxBuffer: 40 * 1024 * 1024 });
  assert.equal(r.status, 0, name + ': ' + ((r.stdout || '') + (r.stderr || '')).slice(-1800).replace(/postgres(?:ql)?:\/\/[^\s"']+/g, '[TEST_DATABASE]'));
  note(name);
}
async function stop() {
  if (!processHandle || processHandle.exitCode !== null || processHandle.signalCode) return;
  const child = processHandle; processHandle = undefined;
  await new Promise(resolve => { const timer = setTimeout(() => { child.kill('SIGKILL'); resolve(); }, 5000); child.once('exit', () => { clearTimeout(timer); resolve(); }); child.kill('SIGTERM'); });
}
async function waitReady() {
  for (let i = 0; i < 150; i++) {
    if (processHandle.exitCode !== null) throw new Error('Application exited before readiness: ' + processHandle.exitCode);
    try { const response = await fetch(base + '/api/health', { signal: AbortSignal.timeout(1000) }); if (response.ok) return; } catch {}
    await new Promise(resolve => setTimeout(resolve, 400));
  }
  throw new Error('Application did not become ready');
}
async function get(route, options = {}) {
  const target = new URL(route, base);
  assert.equal(target.origin, base);
  return new Promise((resolve, reject) => {
    const req = http.request(target, { method: 'GET', headers: { Host: 'www.thetradescout.com', 'User-Agent': 'TradeScout-Exchange-Public-Synthetic-Test/1.0', ...(options.headers || {}) } }, response => {
      const chunks = [];
      response.on('data', chunk => chunks.push(chunk));
      response.on('error', reject);
      response.on('end', () => {
        const headers = new Headers();
        for (const [key, value] of Object.entries(response.headers)) if (value !== undefined) headers.set(key, Array.isArray(value) ? value.join(', ') : value);
        resolve(new Response(Buffer.concat(chunks), { status: response.statusCode, headers }));
      });
    });
    req.setTimeout(20000, () => req.destroy(new Error('Local HTTP verification timed out')));
    req.on('error', reject); req.end();
  });
}
try {
  assert.equal(execFileSync('git', ['status', '--porcelain'], { encoding: 'utf8' }).trim(), '');
  for (const key of ['DATABASE_URL', 'TEST_DATABASE_URL', 'BREVO_API_KEY', 'SENDGRID_API_KEY', 'STRIPE_SECRET_KEY']) assert(!process.env[key], 'No inherited credential: ' + key);
  database = await startCabinetLoopbackTestDatabase();
  client = new pg.Client({ connectionString: database.url }); await client.connect();
  await client.query('CREATE DATABASE ts_exchange_stone_test'); await client.end();
  const url = new URL(database.url); url.pathname = '/ts_exchange_stone_test';
  const config = { databaseUrl: url.href, token: randomBytes(24).toString('hex'), sessionSecret: randomBytes(32).toString('hex'), metricsSecret: randomBytes(32).toString('hex') };
  await fs.writeFile(path.join(temp, 'configuration.json'), JSON.stringify(config), { mode: 0o600 });
  const dbEnv = { NODE_ENV: 'test', DATABASE_URL: url.href, TEST_DATABASE_URL: url.href, ALLOW_INSECURE_TEST_DATABASE: 'true' };
  run('Fresh native migrations', ['npm', 'run', 'db:migrate'], dbEnv);
  run('Required schema', ['npm', 'run', 'db:verify:required'], dbEnv);
  privateLog = await fs.open(path.join(temp, 'application.private.log'), 'w', 0o600);
  processHandle = spawn(process.execPath, ['--import', 'tsx', 'scripts/exchange-stone-native-fixture.ts'], { env: { ...process.env, NODE_ENV: 'test', EXCHANGE_STONE_NATIVE_FIXTURE: 'true', EXCHANGE_STONE_NATIVE_PRIVATE: temp, EXCHANGE_STONE_NATIVE_TOKEN: config.token, EXCHANGE_STONE_NATIVE_PORT: '5241', EXCHANGE_STONE_NATIVE_SETUP: 'true' }, stdio: ['ignore', privateLog.fd, privateLog.fd] });
  await waitReady();
  const fixture = JSON.parse(await fs.readFile(path.join(temp, 'fixture.json'), 'utf8'));
  await stop();
  client = new pg.Client({ connectionString: url.href }); await client.connect();
  assert.equal((await client.query('SELECT current_database() AS n')).rows[0].n, 'ts_exchange_stone_test');
  const ownerA = fixture.accounts.desktop.id, ownerB = fixture.accounts.touch.id;
  const hiddenOwner = 'exchange-hidden-' + randomUUID();
  await client.query("INSERT INTO users(id,email,first_name,last_name,email_verified,address_verified,role,roles,active_role) VALUES($1,$2,'Synthetic','Unverified',false,false,'homeowner','{homeowner}','homeowner')", [hiddenOwner, hiddenOwner + '@example.invalid']);
  const expected = [], samples = [], categoryIds = new Map();
  for (const [category, name] of Object.entries(EXCHANGE_CATEGORY_TO_MARKETPLACE_NAME)) {
    const categoryRow = (await client.query('SELECT id FROM marketplace_categories WHERE name=$1 AND is_active=true LIMIT 1', [name])).rows[0];
    const categoryId = categoryRow?.id || randomUUID(); categoryIds.set(category, categoryId);
    if (!categoryRow) await client.query('INSERT INTO marketplace_categories(id,name,description,icon_name,is_active) VALUES($1,$2,$3,$4,true)', [categoryId, name, 'Synthetic shared discovery category', 'Package']);
    for (const [sellerId, label] of [[ownerA, 'individual'], [ownerB, 'business']]) {
      const id = `exchange731-${category}-${label}`;
      const item = { id, sellerId, categoryId, title: `Synthetic ${category} ${label}`, description: `Published ${category} description, condition and fulfillment facts.`, price: category === 'other' ? '0.00' : '125.50', category, label };
      await client.query("INSERT INTO marketplace_listings(id,seller_id,category_id,title,description,price,county,state,city,condition,status,images,specifications,moderation_notes,is_promoted) VALUES($1,$2,$3,$4,$5,$6,'Dallas','TX','Dallas','good','active',$7::jsonb,$8::jsonb,$9,$10)", [id,sellerId,categoryId,item.title,item.description,item.price,JSON.stringify(['/tradescout-social-preview.png']),JSON.stringify({exchangeCategorySlug:category,brand:'Synthetic',supplierCost:'PRIVATE-COST-731',password:'PRIVATE-PASSWORD-731',phone:'PRIVATE-PHONE-731'}),'PRIVATE-MODERATION-731',label === 'business']);
      samples.push(item); expected.push(id);
    }
  }
  const batch = Array.from({ length: 5005 }, (_, n) => ({ id: 'exchange731-pagination-' + String(n).padStart(5, '0'), title: 'Synthetic pagination listing ' + n }));
  await client.query("INSERT INTO marketplace_listings(id,seller_id,category_id,title,description,price,county,state,condition,status,images,specifications) SELECT v.id,$1,$2,v.title,'Synthetic paginated public item',25,'Dallas','TX','good','active','[]'::jsonb,'{\"exchangeCategorySlug\":\"tools\"}'::jsonb FROM jsonb_to_recordset($3::jsonb) AS v(id text,title text)", [ownerA,categoryIds.get('tools'),JSON.stringify(batch)]);
  expected.push(...batch.map(item => item.id));
  const hidden = [];
  for (const status of ['draft','pending_approval','sold','expired','removed','flagged','rejected','active']) {
    const id = 'exchange731-hidden-' + status; hidden.push(id);
    await client.query("INSERT INTO marketplace_listings(id,seller_id,category_id,title,description,price,county,state,condition,status,images) VALUES($1,$2,$3,'PRIVATE-LISTING-731','PRIVATE-DESCRIPTION-731',50,'Dallas','TX','good',$4,'[]'::jsonb)", [id,status === 'active' ? hiddenOwner : ownerA,categoryIds.get('tools'),status]);
  }
  const expiredId = 'exchange731-expired-date'; hidden.push(expiredId);
  await client.query("INSERT INTO marketplace_listings(id,seller_id,category_id,title,description,price,county,state,condition,status,expires_at) VALUES($1,$2,$3,'PRIVATE-LISTING-731','PRIVATE-DESCRIPTION-731',50,'Dallas','TX','good','active',now()-interval '1 day')", [expiredId,ownerA,categoryIds.get('tools')]);
  const offerId = randomUUID();
  await client.query("INSERT INTO profile_offers(id,seller_user_id,offer_type,title,description,price,currency,is_active,metadata) VALUES($1,$2,'item','Synthetic public profile offer','Published profile offer description',90,'USD',true,$3::jsonb)", [offerId,ownerB,JSON.stringify({exchangeCategorySlug:'electronics',condition:'good',imageUrl:'/tradescout-social-preview.png'})]);
  expected.push('profile-offer-' + offerId);
  const cleanEnv = { PATH: process.env.PATH, HOME: process.env.HOME, TMPDIR: process.env.TMPDIR, ...dbEnv, NODE_ENV: 'production',
    PORT: '5241', SESSION_SECRET: 'fixture-session-only', STONE_RETAIL_SIGNING_SECRET: config.sessionSecret, STONE_METRICS_SECRET: config.metricsSecret,
    RENDER_GIT_COMMIT: head, PUBLIC_WEB_URL: base, SCHEDULER_ENABLED: 'false', DISABLE_CRAWLER: 'true', DISABLE_FACEBOOK_AUTH: 'true', EMAIL_MODE: 'account_creation_only',
    UPLOAD_DIR: path.join(temp,'uploads'), PRIVATE_UPLOAD_DIR: path.join(temp,'private-uploads'), SCOUT_CACHE_DIR: path.join(temp,'scout-cache') };
  processHandle = spawn(process.execPath, ['dist/index.js'], { env: cleanEnv, stdio: ['ignore', privateLog.fd, privateLog.fd] });
  await waitReady();
  const health = await (await get('/api/health')).json(); assert.equal(health.commit, head); assert.equal(health.database, 'connected');
  note('Actual compiled commit and native schema healthy', { commit: health.commit });
  for (const item of samples) {
    const route = `/exchange/${item.category}/${item.id}`;
    const response = await get(route); assert.equal(response.status,200,route);
    const html = await response.text(); assert(html.includes(`<h1>${item.title}</h1>`)); assert(html.includes(item.description)); assert(html.includes('data-public-exchange-listing'));
    assert(html.includes(`href="https://www.thetradescout.com${route}"`)); assert(!html.includes('PRIVATE-'));
    assert(!/name="robots" content="noindex/.test(html)); assert.match(response.headers.get('x-robots-tag') || '', /^index, follow/);
    const ai = await get(route,{headers:{'User-Agent':'OAI-SearchBot'}}); assert.equal(await ai.text(),html,'Crawler/browser public facts differ');
    const read = await get('/api/exchange/public-listings/' + item.id); assert.equal(read.status,200); const publicItem = await read.json(); assert.equal(publicItem.category,item.category); assert(!JSON.stringify(publicItem).includes('PRIVATE-'));
  }
  note('All categories, individual and business sellers: raw HTML, canonical, schema, public data, browser/AI parity', { categories: Object.keys(EXCHANGE_CATEGORY_TO_MARKETPLACE_NAME).length, listings: samples.length });
  for (const id of hidden) {
    assert.equal((await get('/api/exchange/public-listings/'+id)).status,404,id);
    assert.equal((await get('/exchange/tools/'+id)).status,404,id);
  }
  note('Draft, pending, sold, expired, removed, flagged, rejected and exposure-ineligible rows remain unavailable', { cases:hidden.length });
  const indexed = [];
  const sitemapIndex = await (await get('/exchange-sitemap-index.xml')).text();
  const sitemapPaths = [...sitemapIndex.matchAll(/<loc>https:\/\/www\.thetradescout\.com([^<]+)<\/loc>/g)].map(m=>m[1].replace(/&amp;/g,'&'));
  assert(sitemapPaths.length >= 6,'More than 5000 public rows must remain reachable');
  for (const route of sitemapPaths) {
    const response=await get(route);assert.equal(response.status,200);const xml=await response.text();assert(xml.includes('<urlset'));
    indexed.push(...[...xml.matchAll(/<loc>https:\/\/www\.thetradescout\.com\/exchange\/[^/]+\/([^<]+)<\/loc>/g)].map(m=>decodeURIComponent(m[1])));
  }
  for(const id of [...expected,...fixture.ids])assert.equal(indexed.filter(item=>item===id).length,1,'Sitemap coverage: '+id);
  for(const id of hidden)assert(!indexed.includes(id),'Private record in sitemap');
  note('Complete canonical sitemap coverage beyond the previous 5000 cap', { pages:sitemapPaths.length, expected:expected.length+fixture.ids.length, unique:new Set(indexed).size });
  const textIndex=await(await get('/exchange/llms.txt')).text();assert(textIndex.includes('Next page:'));assert(!textIndex.includes('PRIVATE-'));
  const robots=await(await get('/robots.txt')).text();assert(robots.includes('/exchange-sitemap-index.xml'));assert(robots.includes('Allow: /api/exchange/public-listings/'));assert(robots.includes('Disallow: /api/'));
  const llms=await(await get('/llms.txt')).text();assert(llms.includes('/exchange/llms.txt'));
  note('Root robots and LLM documents advertise public coverage while private API stays blocked');
  for(const id of fixture.ids)assert.equal((await get('/exchange/building-materials/'+id)).status,200,'Signed public stone must not need buyer location');
  assert.equal((await get('/api/exchange/stone?audienceState=FL&audienceCity=Pensacola&audienceCountry=US')).status,200);
  const excluded=await(await get('/api/exchange/stone?audienceState=FL&audienceCity=Pensacola&audienceCountry=US')).json();assert.equal(excluded.audience,'pensacola');assert.equal(excluded.items.length,0);
  note('Public retail readability does not remove the existing Pensacola action-market exclusion');
  browser = await chromium.launch({ headless:true,args:['--no-sandbox','--disable-dev-shm-usage'] });
  const browserCases = samples.filter(item=>['vehicles','tools','furniture','electronics','other'].includes(item.category));
  for(const [device,viewport] of [['desktop',{width:1440,height:1000}],['mobile',{width:390,height:844}]]) {
    const context=await browser.newContext({viewport,isMobile:device==='mobile',hasTouch:device==='mobile',serviceWorkers:'block'});
    // Map the canonical browser origin to the owned loopback app; never contact the public site.
    await context.route('**/*', async route => {
      const url = new URL(route.request().url());
      if (url.origin !== browserBase) return route.abort('blockedbyclient');
      const response = await route.fetch({ url: base + url.pathname + url.search, headers: { ...route.request().headers(), host: 'www.thetradescout.com' }, maxRedirects: 0 });
      return route.fulfill({ response });
    });
    const page=await context.newPage(); activePage=page; const errors=[];page.on('pageerror',error=>browserErrors.push(String(error)));page.on('requestfailed',req=>networkErrors.push({url:req.url(),reason:req.failure()}));page.on('response',res=>{if(res.status()>=400)networkErrors.push({url:res.url(),status:res.status()});});page.on('pageerror',e=>errors.push(String(e)));page.setDefaultTimeout(30000);
    for(const item of browserCases){
      const route=`/exchange/${item.category}/${item.id}`;
      await page.goto(browserBase+route,{waitUntil:'domcontentloaded'}); await page.getByRole('heading',{level:1,name:item.title,exact:true}).waitFor();
      await page.getByRole('button',{name:'Share listing',exact:true}).waitFor();
      assert(!/noindex/i.test(await page.locator('meta[name=robots]').last().getAttribute('content')||''));
      assert.equal(await page.locator('link[rel=canonical]').last().getAttribute('href'),'https://www.thetradescout.com'+route);
      await page.getByRole('button',{name:'Review Protected Connection',exact:true}).waitFor();
      assert(!((await page.locator('body').innerText()).includes('PRIVATE-')));
    }
    await page.goto(browserBase+'/exchange',{waitUntil:'domcontentloaded'}); await page.getByRole('heading',{level:1,name:'Exchange marketplace'}).waitFor();
    assert(!/noindex/i.test(await page.locator('meta[name=robots]').last().getAttribute('content')||''));
    await page.goto(browserBase+'/exchange?page=2',{waitUntil:'domcontentloaded'}); await page.getByRole('heading',{level:1,name:'Exchange marketplace'}).waitFor();
    assert.equal(await page.locator('link[rel=canonical]').last().getAttribute('href'),'https://www.thetradescout.com/exchange?page=2');
    assert.deepEqual(errors,[]); note(device+': compiled client reads public ordinary listings, preserves gallery/share/contact gates and directory indexability',{listings:browserCases.length});
    await context.close(); activePage=undefined;
  }
  const withdrawn=samples[0]; await client.query("UPDATE marketplace_listings SET status='removed' WHERE id=$1",[withdrawn.id]);
  assert.equal((await get(withdrawn.publicDetailPath || `/exchange/${withdrawn.category}/${withdrawn.id}`)).status,404);
  assert.equal((await get('/api/exchange/public-listings/'+withdrawn.id)).status,404);
  const withdrawnIndex=await(await get('/sitemap-exchange-listings.xml?page=1')).text();assert(!withdrawnIndex.includes(withdrawn.id));
  note('Withdrawal removes public detail, data and sitemap without cached resurrection');
  assert.equal(execFileSync('git',['status','--porcelain'],{encoding:'utf8'}).trim(),'');report.passed=true;
} catch(error) { if(activePage){report.browserFailure={url:activePage.url(),body:(await activePage.locator('body').innerText().catch(()=>'' )).slice(0,10000),browserErrors,networkErrors:networkErrors.slice(0,30)};console.log('EX731_BROWSER_FAILURE '+JSON.stringify(report.browserFailure));} report.error=String(error.stack||error).replace(/postgres(?:ql)?:\/\/[^\s"']+/g,'[TEST_DATABASE]');console.error('EX731_NATIVE_FAILURE '+report.error); try { const log = await fs.readFile(path.join(temp, 'application.private.log'), 'utf8'); report.failureDiagnostics = log.split('\n').filter(line => /Error:|error:|public read failed|code:|detail:|column:|relation|schema.*failed/i.test(line)).map(line => line.replace(/postgres(?:ql)?:\/\/[^\s"']+/g, '[TEST_DATABASE]').replace(/(?:token|password|secret)[=:\s]+[^\s,]+/gi, '[REDACTED]')).slice(-18); console.log('EX731_NATIVE_DIAGNOSTICS '+JSON.stringify(report.failureDiagnostics)); } catch {} }
finally {
  await browser?.close(); await stop(); await privateLog?.close(); await client?.end().catch(()=>{}); await database?.stop();
  await fs.mkdir(output,{recursive:true}); await fs.writeFile(path.join(output,'evidence.json'),JSON.stringify(report,null,2)); await fs.rm(temp,{recursive:true,force:true});
  console.log('EX731_NATIVE_RESULT '+JSON.stringify(report));
}
assert.equal(report.passed,true,'Shared Exchange native acceptance failed; not release approval');
