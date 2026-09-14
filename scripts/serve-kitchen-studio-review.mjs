import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';

const root=path.resolve('.kitchen-studio-review');
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.webp':'image/webp','.svg':'image/svg+xml','.woff2':'font/woff2','.woff':'font/woff','.ico':'image/x-icon','.txt':'text/plain; charset=utf-8'};
const server=http.createServer(async(request,response)=>{
 response.setHeader('X-Robots-Tag','noindex, nofollow');response.setHeader('X-Content-Type-Options','nosniff');
 if(!['GET','HEAD'].includes(request.method)){response.writeHead(405);response.end('Read-only review');return;}
 let pathname;try{pathname=decodeURIComponent(new URL(request.url,'http://localhost').pathname);}catch{response.writeHead(400);response.end();return;}
 try{
  // Only canonical public material photographs can use this read-only proxy.
  // No cookies, credentials, private pricing or application APIs are forwarded.
  if(/^\/images\/stone-designer\/[a-z0-9-]+\/[1-9][0-9]*\.webp$/.test(pathname)){
   const upstream=await fetch('https://www.thetradescout.com'+pathname,{signal:AbortSignal.timeout(20000)});
   if(!upstream.ok||!upstream.headers.get('content-type')?.startsWith('image/')){response.writeHead(404);response.end();return;}
   response.setHeader('Content-Type',upstream.headers.get('content-type'));response.setHeader('Cache-Control','public, max-age=300');
   response.end(request.method==='HEAD'?undefined:Buffer.from(await upstream.arrayBuffer()));return;
  }
  const file=path.resolve(root,'.'+(pathname==='/'?'/index.html':pathname));
  if(!file.startsWith(root+path.sep)){response.writeHead(403);response.end();return;}
  const content=await fs.readFile(file);response.setHeader('Content-Type',types[path.extname(file)]??'application/octet-stream');response.setHeader('Cache-Control','no-store');response.end(request.method==='HEAD'?undefined:content);
 }catch{response.writeHead(404);response.end('Not found in this isolated review');}
});
server.listen(Number(process.env.PORT||4179),'0.0.0.0',()=>console.log('Kitchen studio read-only review listening'));
