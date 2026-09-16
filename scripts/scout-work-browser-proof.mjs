import assert from 'node:assert/strict';
import {randomBytes, randomUUID, createHash} from 'node:crypto';

/** Called only from the existing production-build, native loopback proof harness. */
export async function runScoutWorkBrowserProof({base,sql,environment,run,proof,secrets,browser}) {
  assert.equal(base,'https://127.0.0.1:5448');
  assert.equal((await sql.query('SELECT current_database() AS name')).rows[0].name,'cabinet_placement_test');
  const accounts=[];
  for(const ordinal of [0,1]) {
    const email=`scout-execution-work-${ordinal}@example.invalid`, password=randomBytes(24).toString('hex');
    secrets.push(password);
    run('Seed private work proof account '+ordinal,[process.execPath,'--import','tsx','scripts/seed-e2e-user.ts'],{...environment,E2E_EMAIL:email,E2E_PASSWORD:password});
    const user=(await sql.query('SELECT id FROM users WHERE email=$1',[email])).rows[0];assert(user?.id);
    accounts.push({email,password,id:user.id,home:randomUUID(),project:randomUUID(),order:randomUUID(),request:randomUUID(),receipt:randomUUID()});
  }
  const workspace=randomUUID();
  await sql.query('INSERT INTO procurement_workspaces(id,slug,name,workspace_type) VALUES($1,$2,$3,$4)',[workspace,'work-proof-'+workspace,'Local material runs','verification']);
  for(const [index,account] of accounts.entries()) {
    const prefix=index===0?'Kitchen cabinet installation':'Private other account work';
    await sql.query('INSERT INTO work_requests(id,created_by_user_id,title,description,status,source,updated_at) VALUES($1,$2,$3,$4,$5,$6,now())',[account.request,account.id,prefix,'NEVER_EXPOSE_REQUEST_DESCRIPTION','draft','scout']);
    if(index===0) for(let item=0;item<8;item++) await sql.query('INSERT INTO work_requests(created_by_user_id,title,description,status,updated_at) VALUES($1,$2,$3,$4,now()-interval \'1 day\')',[account.id,'Garden project '+item,'NEVER_EXPOSE_REQUEST_DESCRIPTION','draft']);
    await sql.query('INSERT INTO user_homes(id,owner_user_id,nickname,address1,city,state_code) VALUES($1,$2,$3,$4,$5,$6)',[account.home,account.id,index===0?'Primary home':'Private other home','1 Example Street','Pensacola','FL']);
    await sql.query('INSERT INTO home_projects(id,owner_user_id,user_home_id,title,status) VALUES($1,$2,$3,$4,$5)',[account.project,account.id,account.home,index===0?'Bathroom renovation':'Private other project','planning']);
    await sql.query(`INSERT INTO procurement_orders(id,order_number,origin_workspace_id,source_channel,user_id,status,order_type,urgency,delivery_address,internal_notes)
      VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,[account.order,index===0?'SR-KITCHEN-01':'SR-PRIVATE-02',workspace,'tradescout',account.id,'submitted','material_pickup','standard','NEVER_EXPOSE_DELIVERY_ADDRESS','NEVER_EXPOSE_INTERNAL_NOTES']);
    await sql.query(`INSERT INTO scout_execution_receipts(owner_user_id,execution_id,action_type,request_fingerprint,status,result,completed_at)
      VALUES($1,$2,'SAVE_PROFILE',$3,'completed',$4::jsonb,now())`,[account.id,account.receipt,'a'.repeat(64),JSON.stringify({executed:true,action:'SAVE_PROFILE',userId:account.id,updatedFields:['firstName']})]);
  }
  const uncertain=randomUUID();
  await sql.query("INSERT INTO scout_execution_receipts(owner_user_id,execution_id,action_type,request_fingerprint,status) VALUES($1,$2,'SAVE_PROFILE',$3,'unconfirmed')",[accounts[0].id,uncertain,'b'.repeat(64)]);
  const snapshot=async()=>{
    const result=[];
    for(const [table,key] of [['work_requests','created_by_user_id'],['home_projects','owner_user_id'],['procurement_orders','user_id'],['scout_execution_receipts','owner_user_id']]) {
      const row=(await sql.query(`SELECT md5(COALESCE(jsonb_agg(to_jsonb(t) ORDER BY to_jsonb(t)::text)::text,'[]')) AS hash FROM ${table} t WHERE ${key}=ANY($1::varchar[])`,[accounts.map(a=>a.id)])).rows[0];
      result.push({table,hash:row.hash});
    }
    return result;
  };
  const before=await snapshot();
  proof.workContinuity=[];
  for(const [device,viewport] of [['desktop',{width:1440,height:1000}],['mobile',{width:390,height:844}]]) {
    const account=accounts[0];
    const context=await browser.newContext({viewport,isMobile:device==='mobile',hasTouch:device==='mobile',ignoreHTTPSErrors:true,serviceWorkers:'block',extraHTTPHeaders:{'x-scout-proof-client':device==='desktop'?'1':'2'}});
    const errors=[];
    try {
      await context.route('**/*',route=>['127.0.0.1','localhost'].includes(new URL(route.request().url()).hostname)?route.continue():route.abort('blockedbyclient'));
      assert.equal((await context.request.post(base+'/api/auth/login',{data:{email:account.email,password:account.password},headers:{Origin:base}})).status(),200);
      const response=await context.request.get(base+'/api/scout/work?ownerId='+accounts[1].id);
      assert.equal(response.status(),200);assert.match(response.headers()['cache-control'],/private.*no-store/);
      const data=await response.json();assert.equal(data.ownerId,account.id);assert.equal(data.partial,false);
      assert.equal(data.sections.length,4);assert(data.sections.every(section=>section.availability==='ready'));
      const all=data.sections.flatMap(section=>section.items);
      assert(!JSON.stringify(data).includes('NEVER_EXPOSE'));assert(!JSON.stringify(data).includes('Private other'));assert(!all.some(item=>[accounts[1].request,accounts[1].project,accounts[1].order,accounts[1].receipt].includes(item.id)));
      const requests=data.sections.find(section=>section.kind==='requests');assert.equal(requests.items.length,8);assert.equal(requests.hasMore,true);
      assert.equal(all.find(item=>item.id===uncertain)?.state,'attention');
      const page=await context.newPage();page.setDefaultTimeout(45000);page.on('pageerror',error=>errors.push(error.message));
      const guide=page.getByRole('dialog',{name:'What do you want to get done?'});
      await page.addLocatorHandler(guide,()=>guide.getByRole('button',{name:'Close Start here guide',exact:true}).click());
      assert((await page.goto(base+'/scout',{waitUntil:'domcontentloaded'}))?.ok());
      const panel=page.getByTestId('scout-work-panel').filter({visible:true}).first();
      await panel.getByText('Kitchen cabinet installation',{exact:true}).waitFor();
      await panel.getByLabel('Search recent work').fill('Kitchen');
      assert.equal(await panel.getByTestId('scout-work-item').count(),2); // Request and SR-KITCHEN order.
      await panel.getByLabel('Search recent work').fill('');
      await panel.getByLabel('Work area').selectOption('scout_actions');
      await panel.getByLabel('Needs review only').check();
      assert.equal(await panel.getByTestId('scout-work-item').count(),1);
      await panel.getByText('Check result',{exact:true}).waitFor();
      await panel.getByLabel('Needs review only').uncheck();
      await panel.getByLabel('Work area').selectOption('all');
      for(const [kind,id,label] of [['requests',account.request,'Open request'],['supply_runs',account.order,'Open supply run'],['home_projects',account.project,'Continue project']]) {
        const item=all.find(item=>item.id===id&&item.kind===kind);assert(item);
        const link=panel.locator('a').filter({hasText:label}).filter({visible:true});
        const matching=panel.locator(`a[href="${item.nextAction.to.replaceAll('"','\\"')}"]`);
        assert.equal(await matching.count(),1);await matching.click();
        await page.waitForURL(url=>url.pathname+url.search===item.nextAction.to);
        const document=await page.goto(base+'/scout',{waitUntil:'domcontentloaded'});assert(document?.ok());
        await panel.getByText('Kitchen cabinet installation',{exact:true}).waitFor();
      }
      await page.route('**/api/scout/work',route=>route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({message:'Temporarily unavailable'})}));
      await panel.getByRole('button',{name:'Refresh work status'}).click();
      await panel.getByRole('alert').waitFor();assert.equal(await panel.getByText('Kitchen cabinet installation',{exact:true}).count(),0);
      await page.unroute('**/api/scout/work');
      await panel.getByRole('button',{name:'Refresh work status'}).click();
      await panel.getByText('Kitchen cabinet installation',{exact:true}).waitFor();
      assert.deepEqual(await snapshot(),before);assert.deepEqual(errors,[]);
      assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+2),false);
      const screenshot=await page.screenshot({fullPage:true});
      const result={device,passed:true,realAuthenticatedOwner:true,sourceAreas:4,searchAndAttentionFilters:true,recordLinksClicked:3,foreignOwnerOverrideIgnored:true,sensitiveFieldsExcluded:true,errorThenRecovery:true,workflowWrites:0,pageErrors:0,horizontalOverflow:false,screenshotSha256:createHash('sha256').update(screenshot).digest('hex')};
      proof.workContinuity.push(result);console.log('SCOUT_WORK_JOURNEY '+JSON.stringify(result));
    }finally{await context.close();}
  }
  const guest=await browser.newContext({ignoreHTTPSErrors:true,extraHTTPHeaders:{'x-scout-proof-client':'3'}});
  try {assert.equal((await guest.request.get(base+'/api/scout/work?ownerId='+accounts[0].id)).status(),401);proof.workGuestRejected=true;}
  finally{await guest.close();}
  assert.deepEqual(await snapshot(),before);
}
