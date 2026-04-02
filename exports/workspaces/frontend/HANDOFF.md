# Frontend Handoff

This workspace is isolated for frontend iteration.

## Quick start
1. npm install
2. npm run dev
3. Open http://localhost:5173

## Backend API
- Vite proxy in vite.config.ts points /api and /ws to http://localhost:5000.
- Run backend separately from the backend workspace or your main repo.

## Important
- This workspace is generated. Re-run npm run split:workspaces in the main repo to refresh.
- Optional strict mode in source repo: SPLIT_WORKSPACES_STRICT=true npm run split:workspaces
