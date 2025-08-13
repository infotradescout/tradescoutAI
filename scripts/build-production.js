#!/usr/bin/env node

import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('Building production application with ESM compatibility...');

try {
  // Build frontend
  console.log('Building frontend...');
  execSync('vite build', { stdio: 'inherit' });
  
  // Build backend with proper ESM configuration
  console.log('Building backend...');
  execSync('esbuild server/index.ts --platform=node --packages=external --bundle --format=esm --outdir=dist --target=node18', { stdio: 'inherit' });
  
  // Create package.json for production
  const prodPackageJson = {
    "name": "tradescout-production",
    "version": "1.0.0",
    "type": "module",
    "main": "index.js",
    "engines": {
      "node": ">=18.0.0"
    }
  };
  
  fs.writeFileSync(
    path.join(__dirname, '..', 'dist', 'package.json'),
    JSON.stringify(prodPackageJson, null, 2)
  );
  
  console.log('Production build completed successfully!');
  console.log('Files created:');
  console.log('- dist/index.js (ESM server bundle)');
  console.log('- dist/public/ (frontend assets)');
  console.log('- dist/package.json (production package config)');
  
} catch (error) {
  console.error('Build failed:', error.message);
  process.exit(1);
}