#!/usr/bin/env node

import { fileURLToPath } from 'url';
import path from 'path';
import fs from 'fs';

// ESM compatibility setup
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Add required ESM globals
global.__filename = __filename;
global.__dirname = __dirname;

// Set production environment
process.env.NODE_ENV = 'production';

console.log('Starting Trade Scout in production mode...');
console.log('Environment:', process.env.NODE_ENV);
console.log('Node version:', process.version);

// Verify dist directory exists
const distPath = path.join(__dirname, '..', 'dist');
if (!fs.existsSync(distPath)) {
  console.error('Error: dist directory not found. Please run npm run build first.');
  process.exit(1);
}

// Verify built files exist
const indexPath = path.join(distPath, 'index.js');
const publicPath = path.join(distPath, 'public');

if (!fs.existsSync(indexPath)) {
  console.error('Error: dist/index.js not found. Please run npm run build first.');
  process.exit(1);
}

if (!fs.existsSync(publicPath)) {
  console.error('Error: dist/public directory not found. Please run npm run build first.');
  process.exit(1);
}

try {
  // Import and start the application
  console.log('Loading application...');
  const { default: app } = await import(indexPath);
  console.log('Trade Scout application started successfully');
} catch (error) {
  console.error('Failed to start application:', error);
  console.error('Stack trace:', error.stack);
  process.exit(1);
}