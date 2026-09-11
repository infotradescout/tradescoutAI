import fs from 'node:fs/promises';
import path from 'node:path';
import {execFileSync,spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';

const root=process.cwd(),out=path.resolve(process.env.SEO_PROOF_OUTPUT||'test-results/issa-seo-proof');
const phase=process.env.SEO_PROOF_PHASE||'audit';
assert(['audit','release','production'].includes(phase));
const head=execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim();
const report={head,phase,startedAt:new Date().toISOString(),pages:[],sitemaps:[],sourceContext:[],indexingConfirmed:false,passed:false};
const base='https://www.thetradescout.com';
const agents={browser:'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36',googlebot:'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)'};
await fs.mkdir(out,{recursive:true});
function text(html){return html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,' ').replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi,' ').replace(/<[^>]+>/g,' ').replace(/\s+/g,' ').trim();}
function attr(tag,key){return tag.match(new RegExp('\\b'+key+'\\s*=\\s*["\']([^"\']*)["\']','i'))?.[1]||null;}
async function read(url,agent='googlebot'){
 const target=new URL(url,base);assert(['https:'].includes(target.protocol));
 const r=await fetch(target,{headers:{'User-Agent':agents[agent]},signal:AbortSignal.timeout(20000),redirect:'manual'});
 const body=await r.text();return {url:target.href,status:r.status,headers:Object.fromEntries(['location','content-type','x-robots-tag','x-tradescout-build','cache-control','vary'].map(k=>[k,r.headers.get(k)])),body};
}
async function page(url,agent){
 try{
 const raw=await read(url,agent),html=raw.body;
 const meta=[...html.matchAll(/<meta\b[^>]*>/gi)].map(m=>({name:attr(m[0],'name')||attr(m[0],'property'),content:attr(m[0],'content')}));
 const canonical=[...html.matchAll(/<link\b[^>]*>/gi)].filter(m=>attr(m[0],'rel')==='canonical').map(m=>attr(m[0],'href'));
 const jsonLd=[...html.matchAll(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)].map(m=>{try{return JSON.parse(m[1]);}catch{return {invalid:true};}});
 const row={url:raw.url,agent,status:raw.status,headers:raw.headers,title:text(html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]||''),canonical,meta:meta.filter(m=>['robots','googlebot','description','og:title','og:url','og:description','google-site-verification'].includes(m.name)),headings:[...html.matchAll(/<h[12]\b[^>]*>([\s\S]*?)<\/h[12]>/gi)].map(m=>text(m[1])),bodyText:text(html).slice(0,5000),bodyBytes:Buffer.byteLength(html),jsonLd,links:[...html.matchAll(/<a\b[^>]*href=["']([^"']*)["']/gi)].map(m=>m[1]).filter(h=>/issa|honey|business|profile|sitemap/i.test(h)).slice(0,40),scriptModules:(html.match(/<script[^>]*type=["']module["']/g)||[]).length};
 report.pages.push(row);console.log('ISSA_SEO_PAGE '+JSON.stringify(row));
 }catch(error){const row={url,agent,error:String(error)};report.pages.push(row);console.log('ISSA_SEO_PAGE '+JSON.stringify(row));}
}
try{
 const tracked=execFileSync('git',['ls-files'],{encoding:'utf8'}).trim().split('\n');
 report.relevantFiles=tracked.filter(f=>/issa|search.console|indexnow|sitemap|project.index|selective.*(readme|skill|config)|agents\.md/i.test(f)).slice(0,130);
 for(const file of ['server/services/issaBuildProfileProvisioning.ts','server/services/canonicalBusinessProfileRoute.ts','server/privateShellIndexability.ts','scripts/import-search-console-performance.mjs']){
  try{const s=await fs.readFile(file,'utf8');report.sourceContext.push({file,lines:s.split('\n').map((l,i)=>({line:i+1,text:l})).filter(o=>/domain|canonical|index|visibility|publicly|slug|TOKEN|credential|SEARCH_CONSOLE/i.test(o.text)).slice(0,65)});}catch{}
 }
 console.log('ISSA_SEO_SOURCE '+JSON.stringify({files:report.relevantFiles,context:report.sourceContext}));
 const robot=await read('/robots.txt');report.robots={status:robot.status,headers:robot.headers,text:robot.body};console.log('ISSA_SEO_ROBOTS '+JSON.stringify(report.robots));
 const pages=['/u/issa-build','/business/issa-build','/contractors/issa-build','/u/honey-onyx','/u/issa-build/sitemap.xml','/api/health'];
 for(let i=0;i<pages.length;i+=3)await Promise.all(pages.slice(i,i+3).map(url=>page(url,'googlebot')));
 await page('/u/issa-build','browser');
 const queue=[...robot.body.matchAll(/^Sitemap:\s*(\S+)/gim)].map(m=>m[1]);if(!queue.length)queue.push(base+'/sitemap.xml');
 const seen=new Set();
 while(queue.length&&seen.size<16){
  const url=queue.shift();if(seen.has(url))continue;seen.add(url);
  try{const r=await read(url);const locations=[...r.body.matchAll(/<loc>([^<]+)<\/loc>/g)].map(m=>m[1]);const index=/<sitemapindex\b/.test(r.body);const matches=locations.filter(x=>/issa|honey-onyx/i.test(x));const row={url,status:r.status,index,locationCount:locations.length,matches,childSitemaps:index?locations:undefined};report.sitemaps.push(row);console.log('ISSA_SEO_SITEMAP '+JSON.stringify(row));if(index)queue.push(...locations.filter(u=>/profile|business|static|main|index/i.test(u)));}catch(error){report.sitemaps.push({url,error:String(error)});}
 }
 report.passed=true; // Audit completion only, never a ranking or indexing verdict.
}catch(error){report.error=String(error.stack||error);}
finally{
 report.finishedAt=new Date().toISOString();await fs.writeFile(path.join(out,'evidence.json'),JSON.stringify(report,null,2));
 await fs.writeFile(path.join(out,'robots.txt'),'User-agent: *\nDisallow: /\n');
 await fs.writeFile(path.join(out,'index.html'),'<meta name="robots" content="noindex,nofollow"><h1>ISSA read-only technical SEO evidence</h1><p>Audit completion does not establish Google indexing or ranking.</p><a href="evidence.json">Evidence</a>');
 console.log('ISSA_SEO_SUMMARY '+JSON.stringify({head,phase,completed:report.passed,indexingConfirmed:false,pages:report.pages.map(({url,agent,status,title,canonical,headings,headers,error})=>({url,agent,status,title,canonical,headings,headers,error})),sitemaps:report.sitemaps}));
}
