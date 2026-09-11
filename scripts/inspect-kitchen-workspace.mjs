import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import sharp from 'sharp';
import { createHash } from 'node:crypto';

if (process.env.WORKSPACE_MODE === 'thumbnail') {
  // Read only the synthetic screenshots produced by this review host.
  const origin = 'https://tradescout-kitchen-workspace-visual.onrender.com';
  const out = '.kitchen-workspace-proof';
  const result = await fetch(origin + '/evidence.json'); assert(result.ok);
  const evidence = await result.json(); await fs.mkdir(out, {recursive:true});
  await fs.writeFile(path.join(out,'evidence.json'),JSON.stringify(evidence,null,2));
  const names = ['laptop-cabinets-library','mobile-cabinets','laptop-countertops'];
  for (const name of names) {
    assert(evidence.pages.some(page=>page.name===name));
    const response = await fetch(origin + '/' + name + '.png'); assert(response.ok);
    const original = Buffer.from(await response.arrayBuffer());
    await fs.writeFile(path.join(out,name+'.png'),original);
    const image = await sharp(original).resize({width:name.startsWith('mobile')?320:600}).webp({quality:15,effort:6}).toBuffer();
    await fs.writeFile(path.join(out,name+'.webp'),image);
    if (name === (process.env.WORKSPACE_EMIT_IMAGE || 'laptop-cabinets-library')) console.log('VISUAL_THUMB '+JSON.stringify({name,sha256:createHash('sha256').update(image).digest('hex'),base64:image.toString('base64')}));
  }
  await fs.writeFile(path.join(out,'index.html'),'<h1>Synthetic workspace screenshots</h1>'+names.map(name=>'<p>'+name+'</p><img src="'+name+'.png" style="max-width:100%">').join(''));
} else if (process.env.WORKSPACE_MODE === 'verify') {
  await import('./verify-kitchen-workspace.mjs');
  await import('./emit-kitchen-workspace-image.mjs');
} else {
  await import('./inspect-kitchen-workspace-capture.mjs');
}
