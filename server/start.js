import { createRequire } from 'module';
import { fileURLToPath } from 'url';
import path from 'path';

// ESM compatibility setup for production deployment
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Create require function for ESM compatibility if needed
const require = createRequire(import.meta.url);

// Set environment
process.env.NODE_ENV = process.env.NODE_ENV || 'production';

console.log('Starting Trade Scout application...');
console.log('Node version:', process.version);
console.log('Environment:', process.env.NODE_ENV);

// Import and start the application
try {
  await import('./index.js');
  console.log('Application started successfully');
} catch (error) {
  console.error('Failed to start application:', error);
  console.error('Stack trace:', error.stack);
  process.exit(1);
}