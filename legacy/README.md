# Legacy Files

This folder contains the original pre-Vite React application from the standalone TradeScout prototype.

**Status**: Not used by TradeScoutPro OS (Express + Vite production build).

## Files

- `App-legacy.tsx` - Original standalone React app component
- `index-legacy.tsx` - Original React DOM entry point

## Why These Are Here

These files were part of an earlier development phase before the system was refactored into:

1. **Frontend**: `client/src/` (Vite-based React)
2. **Backend**: `server/` (Express.js routes)
3. **Unified Entry**: `client/src/main.tsx` → `client/src/App.tsx` → `client/src/SmartHome.tsx` → `client/src/scout-landing.tsx`

## If You Need the Old App

- The code is preserved here for reference
- Do NOT import from these files in the production build
- Consider deleting if you're confident the migration is complete

## Modern Flow

```
client/src/main.tsx
├── App.tsx (routing layer)
├── SmartHome.tsx (layout)
└── scout-landing.tsx (hybrid mobile/desktop OS)
    ├── Desktop: OS dashboard with nav clusters, quick starts, trending
    └── Mobile: Millionaire hero + reasoning sheet
```

All UI is now served through Vite + Express on port 5000.
