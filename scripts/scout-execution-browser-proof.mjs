import assert from 'node:assert/strict';
import {randomBytes, createHash} from 'node:crypto';
import {chromium} from 'playwright';

/** Uses only the fresh local database created by the native verification driver. */
export async function runScoutBrowserProof({base, sql, environment, run, proof, secrets, redact}) {
  assert.equal(base,'https://127.0.0.1:5448','Never target a deployed application');
  assert.equal((await sql.query('SELECT current_database() AS name')).rows[0].name,'cabinet_placement_test','Require the disposable verification database');
  const browser=await chromium.launch({headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
  const cases=[['cancel','Cancelledcase'],['approve','Approvedcase'],['database-failure','Failurecase'],['lost-acknowledgement','Lostack'],['authorization-only','Unconfirmedcase']];
  let clientOrdinal=0;
  proof.networkIsolation='Each synthetic account is an independent TEST-NET client at the private loopback proxy. Application rate limits are unchanged.';
  try {
    for(const [device,viewport] of [['desktop',{width:1440,height:1000}],['mobile',{width:390,height:844}]]) {
      for(const [scenario,firstName] of cases) {
        const email=`scout-execution-${device}-${scenario}@example.invalid`;
        const password=randomBytes(24).toString('hex');secrets.push(password);
        run(`Seed synthetic ${device} ${scenario} user`,[process.execPath,'--import','tsx','scripts/seed-e2e-user.ts'],{...environment,E2E_EMAIL:email,E2E_PASSWORD:password});
        const user=(await sql.query('SELECT id, first_name FROM users WHERE email=$1',[email])).rows[0];assert(user?.id);
        await sql.query('DELETE FROM scout_execution_proof_writes WHERE user_id=$1',[user.id]);
        const context=await browser.newContext({viewport,isMobile:device==='mobile',hasTouch:device==='mobile',ignoreHTTPSErrors:true,serviceWorkers:'block',extraHTTPHeaders:{'x-scout-proof-client':String(++clientOrdinal)}});
        const errors=[],deniedExternal=[],handlerErrors=[];let actionRequests=0,page;
        try {
          await context.route('**/*',route=>{
            const target=new URL(route.request().url());
            if(!['127.0.0.1','localhost'].includes(target.hostname)){deniedExternal.push(target.hostname);return route.abort('blockedbyclient');}
            return route.continue();
          });
          const login=await context.request.post(base+'/api/auth/login',{data:{email,password},headers:{Origin:base}});
          assert.equal(login.status(),200,'Synthetic account login must succeed');
          const auth=await context.request.get(base+'/api/auth/user');assert.equal(auth.status(),200);
          const identity=await auth.json();assert.equal(identity?.id??identity?.user?.id,user.id,'Verify the actual session owner');
          page=await context.newPage();page.setDefaultTimeout(45000);page.on('pageerror',error=>errors.push(error.message));
          const guide=page.getByRole('dialog',{name:'What do you want to get done?'});
          await page.addLocatorHandler(guide,async()=>{await guide.getByRole('button',{name:'Close Start here guide',exact:true}).click();});
          await page.route('**/api/scout/execute-action',async route=>{
            actionRequests++;
            try {
              assert.equal(route.request().postDataJSON().action.type,'SAVE_PROFILE');
              if(scenario==='authorization-only')return await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({success:true,authorized:true,executed:false})});
              if(scenario==='lost-acknowledgement'){
                const actual=await route.fetch({maxRetries:0});assert.equal(actual.status(),200);assert.equal((await actual.json()).executed,true);
                return await route.abort('failed');
              }
              await route.continue();
            }catch(error){handlerErrors.push(String(error));await route.abort('failed').catch(()=>{});}
          });
          const document=await page.goto(base+'/scout',{waitUntil:'domcontentloaded',timeout:60000});assert(document?.ok());
          const input=page.locator('textarea:visible').first();await input.waitFor();await input.fill(`Set my name to ${firstName} Tester`);
          const answer=page.waitForResponse(response=>new URL(response.url()).pathname==='/api/scout'&&response.request().method()==='POST');
          await input.press('Enter');const answerResponse=await answer;assert.equal(answerResponse.status(),200);
          const answerPayload=await answerResponse.json();
          const saves=answerPayload.allowed_actions?.filter(action=>action.label==='Save profile update')??[];
          assert.equal(saves.length,1,'The live result must expose exactly one real save action');
          assert.equal(saves[0].type,'SAVE_PROFILE');assert.equal(saves[0].requires_confirmation,true);
          const saveButton=page.getByTestId('scout-primary-next-action');await saveButton.waitFor();
          assert.match(await saveButton.innerText(),/Save profile update/);
          let dialogSeen=false;page.once('dialog',async dialog=>{dialogSeen=true;scenario==='cancel'?await dialog.dismiss():await dialog.accept();});
          await saveButton.click();
          if(scenario==='approve')await page.getByText('Saved. Your profile has been updated.',{exact:true}).first().waitFor();
          else if(scenario==='cancel')await page.getByText('Cancelled. This action was not submitted.',{exact:true}).first().waitFor();
          else await page.getByText(/Scout could not confirm/).first().waitFor();
          assert.equal(dialogSeen,true);await page.waitForTimeout(1000);
          const body=await page.locator('body').innerText();assert.equal(body.includes('Saved. Your profile has been updated.'),scenario==='approve');
          const persisted=(await sql.query('SELECT first_name FROM users WHERE id=$1',[user.id])).rows[0].first_name;
          const writes=Number((await sql.query('SELECT count(*) AS n FROM scout_execution_proof_writes WHERE user_id=$1',[user.id])).rows[0].n);
          const committed=scenario==='approve'||scenario==='lost-acknowledgement';
          assert.equal(persisted,committed?firstName:user.first_name);assert.equal(writes,committed?1:0);assert.equal(actionRequests,scenario==='cancel'?0:1);
          assert.deepEqual(handlerErrors,[]);assert.deepEqual(errors,[]);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+2),false);
          const screenshot=await page.screenshot({fullPage:true});
          const entry={device,scenario,passed:true,authenticatedAccountVerified:true,realSaveActionVerified:true,actionRequests,committedWrites:writes,savedAcknowledgement:scenario==='approve',actualProfilePersisted:committed,pageErrors:errors.length,horizontalOverflow:false,blockedExternalHosts:[...new Set(deniedExternal)],screenshotSha256:createHash('sha256').update(screenshot).digest('hex')};
          proof.journeys.push(entry);console.log('SCOUT_FLOW_JOURNEY '+JSON.stringify(entry));
        }catch(error){proof.failedJourney={device,scenario,actionRequests,pageErrors:errors,handlerErrors,url:page?.url(),visibleText:page?redact((await page.locator('body').innerText().catch(()=>'')).slice(-8000)):''};throw error;}
        finally{await context.close();}
      }
    }
    const guest=await browser.newContext({ignoreHTTPSErrors:true,extraHTTPHeaders:{'x-scout-proof-client':String(++clientOrdinal)}});
    try{const response=await guest.request.post(base+'/api/scout/execute-action',{headers:{Origin:base},data:{action:{type:'SAVE_PROFILE',payload:{profilePatch:{firstName:'Unauthorized'}}}}});assert.equal(response.status(),401);proof.guestUnauthorized=true;}
    finally{await guest.close();}
  }finally{await browser.close();}
}
