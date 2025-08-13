// ESM Compatibility shim for Node.js applications
// This file provides ESM-compatible globals and utilities

import { fileURLToPath } from 'url';
import path from 'path';

// Create __filename and __dirname equivalents for ESM
export function createESMGlobals(importMetaUrl) {
  const __filename = fileURLToPath(importMetaUrl);
  const __dirname = path.dirname(__filename);
  return { __filename, __dirname };
}

// Add to global scope for compatibility with existing code
export function setupESMGlobals() {
  if (typeof global !== 'undefined') {
    global.__filename = fileURLToPath(import.meta.url);
    global.__dirname = path.dirname(global.__filename);
  }
}

// Export commonly needed utilities
export { fileURLToPath, path };