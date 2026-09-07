import fs from 'node:fs';
import path from 'node:path';

// This repair only adds an absent-target guard. A successfully executed old
// publication has identical business effects. Do not generalize this exemption
// to historical migrations whose repaired schema or rules differ.
export function completedPublicationPredecessorHashes(filename, cwd = process.cwd()) {
  if (filename !== '0126_jw_stone_offer_publication.sql') return [];
  const manifest = JSON.parse(fs.readFileSync(path.join(cwd, 'migrations/meta/_hash_aliases.json'), 'utf8'));
  const hashes = manifest[filename];
  if (!Array.isArray(hashes) || hashes.length !== 2 || hashes.some((hash) => !/^[a-f0-9]{64}$/.test(hash))) {
    throw new Error('The reviewed publication predecessor identities are missing or invalid');
  }
  return [...new Set(hashes)];
}
