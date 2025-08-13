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
  
  // Backup the broken bundled version and replace with working ESM entry
  console.log('Replacing bundled index.js with ESM-compatible version...');
  fs.renameSync(
    path.join(__dirname, '..', 'dist', 'index.js'),
    path.join(__dirname, '..', 'dist', 'index-bundled.js')
  );
  
  // Copy ESM entry point files
  fs.copyFileSync(
    path.join(__dirname, '..', 'server', 'esm-entry.js'),
    path.join(__dirname, '..', 'dist', 'esm-entry.js')
  );
  
  // Create new ESM-compatible index.js
  const esmIndexContent = `// ESM-compatible index.js for Trade Scout deployment
// This replaces the problematic bundled version with a working ESM entry

import { createRequire } from 'module';
import { fileURLToPath } from 'url';
import path from 'path';

// ESM compatibility setup
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Set production environment
process.env.NODE_ENV = process.env.NODE_ENV || 'production';

console.log('Trade Scout - ESM Deployment Entry');
console.log('Environment:', process.env.NODE_ENV);

// Load the working ESM application
try {
  await import('./esm-entry.js');
} catch (error) {
  console.error('ESM deployment failed:', error);
  process.exit(1);
}`;
  
  fs.writeFileSync(
    path.join(__dirname, '..', 'dist', 'index.js'),
    esmIndexContent
  );
  
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