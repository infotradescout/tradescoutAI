# Trade Scout Production Deployment Guide

## ESM Deployment Fixes Applied

### Issues Addressed
1. `__dirname is not defined error in ESM module` - Fixed by using `import.meta.dirname`
2. `Application is crash looping due to immediate exit` - Fixed with proper error handling
3. `Static file serving failing in production build` - Fixed with environment-aware path resolution

### Files Created for ESM Compatibility

#### 1. `server/esm-entry.js` - Production Entry Point
- Provides proper ESM globals and compatibility
- Handles dynamic imports with error recovery
- Sets production environment correctly

#### 2. `scripts/build-production.js` - Enhanced Build Script
- Builds frontend with Vite
- Builds backend with proper ESM format
- Creates production package.json with module type

#### 3. `server/start.js` - Alternative Startup Script
- Simplified ESM entry point
- Better error logging and diagnostics

### Deployment Options

#### Option 1: Use Enhanced Build Script
```bash
node scripts/build-production.js
cd dist && node index.js
```

#### Option 2: Use ESM Entry Point
```bash
npm run build
node server/esm-entry.js
```

#### Option 3: Use Start Script
```bash
npm run build
node server/start.js
```

### Production Environment Variables
Ensure these are set in production:
- `NODE_ENV=production`
- `DATABASE_URL` (your PostgreSQL connection string)
- Other environment variables as needed

### Key Changes Made

1. **Removed duplicate methods** in `server/storage.ts` that were causing build warnings
2. **Created ESM-compatible entry points** that handle module loading properly
3. **Enhanced build process** to generate clean ESM modules
4. **Added proper error handling** for deployment scenarios

### Verification
The application is already configured as an ESM module in `package.json`:
- `"type": "module"` is set
- All server files use `import.meta.dirname` instead of `__dirname`
- Proper ESM imports throughout the codebase

### If You Still Experience Issues
1. Check Node.js version (requires >= 18.0.0)
2. Verify all dependencies are installed in production
3. Ensure database is accessible
4. Check environment variables are properly set
5. Use the ESM entry point which provides additional compatibility layers

The deployment should now work without the ESM module errors that were causing the crash loops.