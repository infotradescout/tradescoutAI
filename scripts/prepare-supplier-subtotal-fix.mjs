import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { spawnSync, execFileSync } from 'node:child_process';

/** Development helper only. Never starts a production server or targets main. */
export async function prepareSupplierSubtotalFix() {
  assert.equal(process.env.SUPPLIER_PREPARE_SUBTOTAL_FIX, 'true');
  const branch = 'jw-stone/supplier-estimate-followthrough-20260911';
  const file = 'server/routes/direct-connect/job-lifecycle.ts';
  const git = args => execFileSync('git', args, { encoding: 'utf8', stdio: ['ignore','pipe','pipe'] }).trim();
  const before = git(['rev-parse','HEAD']);
  assert.equal(git(['status','--porcelain']), '');
  assert.equal(git(['rev-parse','HEAD:' + file]), '47cf3dc4c32ee35f702203b811a2fe42b34215b7');
  let localOrigin, upstream;
  const transport={stage:'local_origin',valid:false};
  try {
    const rawOrigin=git(['remote','get-url','origin']);
    localOrigin=rawOrigin.startsWith('file:')?fileURLToPath(rawOrigin):rawOrigin;
    assert(path.isAbsolute(localOrigin));
    transport.stage='configured_upstream';
    upstream=execFileSync('git',['-C',localOrigin,'remote','get-url','origin'],{encoding:'utf8',stdio:['ignore','pipe','pipe']}).trim();
    const ssh=upstream.match(/^(?:git@github\.com:|ssh:\/\/git@github\.com\/)(infotradescout\/tradescoutAI)(?:\.git)?$/);
    transport.format=ssh?'github-ssh':upstream.startsWith('https:')?'https':upstream.startsWith('/')?'local':'other';
    if(!ssh){const url=new URL(upstream);assert.equal(url.protocol,'https:');assert.equal(url.hostname,'github.com');assert.equal(url.pathname.replace(/\.git$/,''),'/infotradescout/tradescoutAI');}
    transport.valid=true;
  }catch(error){transport.errorType=error.name;transport.exitStatus=error.status??null;}
  console.log('SUPPLIER_CONFIGURED_TRANSPORT '+JSON.stringify(transport));
  const temp = await fs.mkdtemp(path.join(os.tmpdir(),'subtotal-proof-'));
  async function test(label) {
    const output = path.join(temp,label+'.json');
    const result = spawnSync('npm',['run','test:run','--','server/tests/estimate-subtotal.behavior.test.ts','--maxWorkers=1','--reporter=json','--outputFile='+output],{encoding:'utf8',timeout:120000,maxBuffer:8*1024*1024});
    const parsed = JSON.parse(await fs.readFile(output,'utf8'));
    const report = { status: result.status, total: parsed.numTotalTests, passed: parsed.numPassedTests, failed: parsed.numFailedTests, pending: parsed.numPendingTests,
      cases: parsed.testResults.flatMap(file=>file.assertionResults.map(row=>({name:row.fullName,status:row.status,failures:row.failureMessages}))) };
    console.log('SUBTOTAL_TEST '+JSON.stringify({label,...report}));
    if(result.status!==0)console.log('SUBTOTAL_SQL_DIAGNOSTIC '+String(result.stderr||'').replace(/postgres(?:ql)?:\/\/[^\s"']+/g,'[LOCAL_TEST_DATABASE]').slice(-12000));
    return report;
  }
  const baseline = await test('baseline');
  assert(baseline.failed > 0 && baseline.pending === 0,'Baseline must fail, not skip');
  const source = await fs.readFile(file,'utf8');
  const old = '        const fixedOther = toNumber(((currentEstimateRows.rows || []) as any[])[0]?.subtotal_other);\n        const subtotalOther = Number((otherLines + fixedOther).toFixed(2));';
  assert.equal(source.split(old).length,2);
  const changed = source.replace('        const otherLines = toNumber(totals.subtotal_other_lines);\n','').replace(old,
    '        // subtotal_other already includes prior non-material/labor lines. Add\n'+
    '        // only this newly inserted line; adding the full SUM again compounds it.\n'+
    '        const previousOther = toNumber(((currentEstimateRows.rows || []) as any[])[0]?.subtotal_other);\n'+
    '        const addedOther = ["material", "labor"].includes(parse.data.lineType) ? 0 : totalCost;\n'+
    '        const subtotalOther = Number((previousOther + addedOther).toFixed(2));');
  await fs.writeFile(file,changed);
  assert.equal(git(['diff','--name-only']),file);
  const corrected = await test('corrected');
  assert.equal(corrected.status,0); assert.equal(corrected.failed,0); assert.equal(corrected.pending,0); assert.equal(corrected.total,baseline.total);
  const patch = git(['diff','--',file])+'\n';
  git(['add','--',file]);
  git(['-c','user.name=TradeScout automation','-c','user.email=automation@users.noreply.github.com','commit','-m','Correct repeated non-material estimate subtotals without changing quote authority']);
  const prepared = git(['rev-parse','HEAD']);
  const report = { before,prepared,branch,files:[file],patch,baseline,corrected,pushed:false,verified:false,productionChanged:false,transportStage:transport.stage };
  if(transport.valid){
    try {
      // Normal Git uses only the repository's existing configured transport.
      // No credentials are searched, extracted, copied or reported.
      report.transportStage='transfer_local_commit';
      execFileSync('git',['-C',localOrigin,'fetch','--no-tags','--quiet',process.cwd(),prepared],{stdio:['ignore','pipe','pipe'],timeout:15000});
      report.transportStage='configured_feature_push';
      const result=spawnSync('git',['-C',localOrigin,'push','--quiet','origin',prepared+':refs/heads/'+branch],{encoding:'utf8',timeout:30000,env:{...process.env,GIT_TERMINAL_PROMPT:'0'},stdio:['ignore','pipe','pipe']});
      report.pushStatus=result.status;report.pushed=result.status===0;
      if(!report.pushed)report.pushError='Configured transport did not authorize the feature-branch push.';
    }catch(error){report.pushError='Configured transport unavailable at '+report.transportStage;report.transportErrorType=error.name;}
  }else report.pushError='No configured matching writable transport.';
  const output=path.resolve(process.env.JW_WORKFLOW_OUTPUT||'test-results/supplier-patch');
  await fs.mkdir(output,{recursive:true});
  await fs.writeFile(path.join(output,'estimate-subtotal.patch'),patch);
  await fs.writeFile(path.join(output,'evidence.json'),JSON.stringify({head:before,passed:false,preparationOnly:true,...report},null,2));
  await fs.rm(temp,{recursive:true,force:true});
  console.log('SUPPLIER_PATCH_RESULT '+JSON.stringify(report));
}
