# MealScout Dual-Track Deployment Guide

## Architecture

**Frontend**: Vercel → `mealscout.us`  
**Backend**: Render (TradeScout instance) → `api.mealscout.thetradescout.com`

**Why this works:**
- Zero new infra cost
- Socket.IO stays proven/stable
- Clean public branding
- Sale-ready separation capability
- Fast to deploy

---

## Domain Setup

### 1. Vercel (Frontend)
- Deploy MealScout frontend to Vercel
- Add custom domain: `mealscout.us` and `www.mealscout.us`
- Vercel will provide DNS records to add at your domain registrar

### 2. Render (Backend Subdomain)
- Go to Render dashboard → TradeScout service → Settings → Custom Domains
- Add: `api.mealscout.thetradescout.com`
- Add the provided CNAME record to your DNS:
  - Type: `CNAME`
  - Name: `api.mealscout`
  - Value: `tradescoutai.onrender.com` (or whatever Render provides)

---

## Environment Variables

### Render (TradeScout Backend)
Add these to the existing service:

```bash
# MealScout CORS
# (Already added to code; just ensure these origins work)
# No new vars needed - mealscout.us is now in ALLOWED_ORIGINS
```

### Vercel (MealScout Frontend)
Set in Vercel project settings → Environment Variables:

```bash
VITE_API_BASE_URL=https://api.mealscout.thetradescout.com
VITE_WS_URL=wss://api.mealscout.thetradescout.com
```

---

## CORS Configuration

✅ **Already updated** in this commit:
- [server/index.ts](server/index.ts) - Added `mealscout.us` and `www.mealscout.us` to `ALLOWED_ORIGINS`
- [server/index.prod.ts](server/index.prod.ts) - Same

Socket.IO will automatically respect the same CORS settings.

---

## Verification Checklist

After deploy:

1. **Frontend loads**: https://mealscout.us
2. **API calls work**: Check Network tab - calls go to `api.mealscout.thetradescout.com`
3. **WebSocket connects**: Check console - WS should connect without CORS errors
4. **SSO from TradeScout works**: Navigate from TradeScout → MealScout, verify auto-login

---

## Upgrade Path (Later)

When you want to separate MealScout backend:

1. Deploy MealScout backend to new Render service
2. Update Vercel env: `VITE_API_BASE_URL=https://api.mealscout.us`
3. Update DNS: point `api.mealscout.us` to new Render service
4. No code changes needed - just env + DNS

---

## Authority Contract

- TradeScout remains the **identity provider** (SSO, user management)
- MealScout is a **child asset** (receives auth via SSO token)
- All user actions flow through TradeScout's authority model
- MealScout can be sold as a standalone with minimal refactor (SSO → native auth)
