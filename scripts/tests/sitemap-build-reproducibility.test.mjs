import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {execFileSync} from 'node:child_process';

const source = await fs.readFile(new URL('../generate-sitemap-core.mjs', import.meta.url), 'utf8');
const canonical = await fs.readFile(new URL('../../client/public/sitemap.xml', import.meta.url), 'utf8');
const index = await fs.readFile(new URL('../../client/public/sitemap-index.xml', import.meta.url), 'utf8');
async function fixture(fn, {existing = true} = {}) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'sitemap-proof-'));
  const output = path.join(root, 'client/public');
  try {
    await fs.mkdir(output, {recursive:true}); await fs.mkdir(path.join(root,'scripts'));
    await fs.writeFile(path.join(root,'scripts/generate.mjs'), source);
    await fs.writeFile(path.join(root,'clock.mjs'), `const RealDate = Date; globalThis.Date = class extends RealDate { constructor(...args){super(...(args.length?args:[process.env.SITEMAP_TEST_DATE]));} static now(){return new RealDate(process.env.SITEMAP_TEST_DATE).valueOf();} };`);
    if(existing) { await fs.writeFile(path.join(output,'sitemap.xml'),canonical); await fs.writeFile(path.join(output,'sitemap-index.xml'),index); }
    await fn({output, run(date){execFileSync(process.execPath,['--import',path.join(root,'clock.mjs'),path.join(root,'scripts/generate.mjs')],{env:{...process.env,SITEMAP_TEST_DATE:date},stdio:'pipe'});}, read:name=>fs.readFile(path.join(output,name),'utf8')});
  } finally { await fs.rm(root,{recursive:true,force:true}); }
}
test('unchanged checked-in routes, priorities, frequencies and index dates remain byte-identical',()=>fixture(async f=>{
  f.run('2030-01-01T00:00:00Z'); assert.equal(await f.read('sitemap.xml'),canonical); assert.equal(await f.read('sitemap-index.xml'),index);
  f.run('2030-02-02T00:00:00Z'); assert.equal(await f.read('sitemap.xml'),canonical); assert.equal(await f.read('sitemap-index.xml'),index);
}));
test('fresh generation initializes dates once and the next build is stable',()=>fixture(async f=>{
  f.run('2030-01-01T00:00:00Z'); const first=await f.read('sitemap-index.xml'); assert(first.includes('<lastmod>2030-01-01</lastmod>'));
  f.run('2030-02-02T00:00:00Z'); assert.equal(await f.read('sitemap-index.xml'),first);
},{existing:false}));
test('one missing entry is dated without relabelling existing entries',()=>fixture(async f=>{
  const missing=index.replace(/\s*<sitemap>[\s\S]*?<\/sitemap>/,''); await fs.writeFile(path.join(f.output,'sitemap-index.xml'),missing);
  f.run('2030-03-03T00:00:00Z'); const rebuilt=await f.read('sitemap-index.xml'); assert.equal((rebuilt.match(/<lastmod>2030-03-03<\/lastmod>/g)||[]).length,1);
  const targets=s=>[...s.matchAll(/<loc>(.*?)<\/loc>/g)].map(m=>m[1]); assert.deepEqual(targets(rebuilt),targets(index));
}));
