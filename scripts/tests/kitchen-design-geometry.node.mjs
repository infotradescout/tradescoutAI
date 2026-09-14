import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
const require = createRequire(import.meta.url);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const work = fs.mkdtempSync(path.join(os.tmpdir(), 'tradescout-kitchen-geometry-'));
process.on('exit', () => fs.rmSync(work, { recursive: true, force: true }));
const sourceHashes = {};
function compile(name) {
  const source = fs.readFileSync(path.join(root, 'client/src/pages/profile-sites/steel-home-project-tools', name + '.ts'));
  sourceHashes[name] = crypto.createHash('sha1').update('blob ' + source.length + '\0').update(source).digest('hex');
  const result = ts.transpileModule(source.toString(), { reportDiagnostics: true, compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } });
  assert.equal(result.diagnostics.length, 0, name + ' syntax diagnostics');
  const output = path.join(work, name + '.cjs');
  fs.writeFileSync(output, result.outputText);
  return require(output);
}
const { buildCabinetCaseworkParts: parts, cabinetFrontRotation: rotation } = compile('cabinetCasework');
const { buildCountertopReviewGeometry: geometry } = compile('countertopPrecisionGeometry');
const results=[];let configurationCount=0,partCount=0;
function test(name,run){run();results.push({name,result:'pass'});console.log('PASS '+name);}
const fixture=(kind='base-cabinet')=>({id:'a',kind,widthIn:30,heightIn:34.5,depthIn:24,surface:'north'});
test('Cabinet doors, Shaker rails, three drawers and optional hardware',()=>{
 const p=parts(fixture(),{style:'Shaker',finish:'sage',hardware:'Brushed brass',fronts:{a:'drawers'}});
 assert.equal(p.filter(p=>p.role==='drawer').length,3);assert(p.some(p=>p.role==='rail'));assert(p.some(p=>p.role==='handle'));
 assert(!parts(fixture()).some(p=>p.role==='handle'));
});
test('Cabinet details stay inside measured dimensions across 6400 configurations',()=>{
 for(const w of [.125,6,30,96,240])for(const h of [.125,6,30,96,240])for(const d of [.125,12,24,120])for(const kind of ['base-cabinet','wall-cabinet','tall-cabinet','island'])for(const style of ['Shaker','Slab','Raised panel','Glass accent'])for(const mode of ['doors','drawers','sink','open']){
  const m={...fixture(kind),widthIn:w,heightIn:h,depthIn:d};
  for(const p of parts(m,{style,finish:null,hardware:'Matte black',fronts:{a:mode}})){
   partCount++;
   for(const n of p.sizeIn)assert(n>0&&Number.isFinite(n));
   assert(Math.abs(p.centerIn[0])+p.sizeIn[0]/2<=w/2+1e-8,JSON.stringify({m,p}));
   assert(p.centerIn[1]-p.sizeIn[1]/2>=-1e-8,JSON.stringify({m,p}));
   assert(p.centerIn[1]+p.sizeIn[1]/2<=h+1e-8,JSON.stringify({m,p}));
   assert(Math.abs(p.centerIn[2])+p.sizeIn[2]/2<=d/2+1e-8,JSON.stringify({m,p}));
  }configurationCount++;
 }
});
test('Appliance gaps remain gaps; invalid measurements do not make geometry',()=>{
 assert.deepEqual(parts(fixture('appliance')),[]);assert.deepEqual(parts({...fixture(),widthIn:NaN}),[]);assert.deepEqual(parts({...fixture(),heightIn:0}),[]);
});
test('Fronts face inward on all four walls',()=>{assert.equal(rotation('north'),0);assert.equal(rotation('south'),Math.PI);assert.equal(rotation('east'),-Math.PI/2);assert.equal(rotation('west'),Math.PI/2);});
const base={layout:'straight',wallAIn:600,wallBIn:96,wallCIn:120,wallDepthIn:24,island:false};
test('A 600-inch countertop remains 600 inches without visual clamping',()=>{assert.deepEqual(geometry(base).polygons[0].points,[[0,0],[600,0],[600,24],[0,24]]);});
test('L and U contours retain exact corner dimensions',()=>{
 assert.deepEqual(geometry({...base,layout:'l-shape',wallAIn:144}).polygons[0].points,[[0,0],[144,0],[144,24],[24,24],[24,96],[0,96]]);
 assert.deepEqual(geometry({...base,layout:'u-shape',wallAIn:144}).polygons[0].points,[[0,0],[144,0],[144,120],[120,120],[120,24],[24,24],[24,96],[0,96]]);
});
test('Unknown island placement is not invented',()=>{const g=geometry({...base,island:true,islandLengthIn:60,islandWidthIn:36,islandLeftOffsetIn:null,islandBackOffsetIn:null});assert.equal(g.polygons.length,1);assert.equal(g.unresolved.length,1);});
test('Negative island offsets are retained and included in the drawing extent',()=>{const g=geometry({...base,island:true,islandLengthIn:60,islandWidthIn:36,islandLeftOffsetIn:-20,islandBackOffsetIn:80});assert.deepEqual(g.polygons[1].points[0],[-20,80]);assert(g.viewBox[0]<-20);});
test('Impossible return geometry is explicitly unresolved',()=>{const g=geometry({...base,layout:'u-shape',wallAIn:36});assert.equal(g.polygons.length,0);assert(g.unresolved.length);});
const evidence={sourceHashes,scope:'Dependency-free render geometry only, compiled from committed TypeScript helpers. Not a full application build or browser validation.',configurationCount,partCount,tests:results};
console.log('KITCHEN_DESIGN_GEOMETRY '+JSON.stringify(evidence));
