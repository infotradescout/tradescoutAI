import fs from 'node:fs/promises';
import path from 'node:path';
import { lookup } from 'node:dns/promises';
import { createHash } from 'node:crypto';
import sharp from 'sharp';

const name=process.env.WORKSPACE_EMIT_IMAGE||'after-laptop-library';
if(!/^after-(desktop|laptop|mobile)-(library|countertops|cabinets|cabinet-3d)$/.test(name))throw new Error('Unknown synthetic screenshot');
const root='.kitchen-workspace-proof';
try {
  const png=await fs.readFile(path.join(root,name+'.png'));
  const image=await sharp(png).resize({width:name.includes('-mobile-')?300:480}).webp({quality:10,effort:6}).toBuffer();
  await fs.writeFile(path.join(root,name+'-compact.webp'),image);
  console.log('WORKSPACE_COMPACT_IMAGE '+JSON.stringify({name,sha256:createHash('sha256').update(image).digest('hex'),base64:image.toString('base64')}));
  // Public proof-host addresses aid screenshot retrieval where the review client lacks DNS.
  console.log('WORKSPACE_PUBLIC_PROOF_DNS '+JSON.stringify(await lookup('tradescout-kitchen-workspace-visual.onrender.com',{all:true})));
} catch(error) { console.log('WORKSPACE_IMAGE_UNAVAILABLE '+String(error.message)); }
