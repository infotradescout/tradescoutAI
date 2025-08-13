// ESM entry point for production deployment
// This file addresses the "Cannot use import statement outside a module" error

import { createRequire } from 'module';
import { fileURLToPath } from 'url';
import path from 'path';

// Set up ESM globals for compatibility
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Set production environment
process.env.NODE_ENV = 'production';

// Add ESM compatibility for any bundled code that might need it
if (typeof global !== 'undefined') {
  global.__filename = __filename;
  global.__dirname = __dirname;
  global.require = createRequire(import.meta.url);
}

console.log('Trade Scout - ESM Production Entry Point');
console.log('Environment:', process.env.NODE_ENV);
console.log('Node version:', process.version);

// Import the main application
try {
  const { default: main } = await import('./index.js');
  console.log('Application loaded successfully');
} catch (error) {
  console.error('Failed to load application:', error);
  
  // Try alternative approaches
  if (error.message.includes('import') || error.message.includes('module')) {
    console.log('Attempting to load with alternative ESM approach...');
    try {
      // Dynamic import with full ESM support
      const module = await import('./index.js');
      console.log('Application loaded with alternative approach');
    } catch (retryError) {
      console.error('Failed with alternative approach:', retryError);
      process.exit(1);
    }
  } else {
    process.exit(1);
  }
}