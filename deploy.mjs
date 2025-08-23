#!/usr/bin/env node

// Stop any existing servers
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

console.log('🛑 Stopping existing servers...');
try {
  await execAsync('pkill -f "tsx server/index.ts"');
  await execAsync('pkill -f "node server.mjs"');
} catch (e) {
  // Ignore if no processes to kill
}

// Wait a moment
await new Promise(resolve => setTimeout(resolve, 2000));

console.log('🚀 Starting deployment server...');
import('./server.mjs');