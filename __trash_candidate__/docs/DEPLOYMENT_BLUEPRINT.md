# 🚀 TradeScout Production Deployment Blueprint

## ✅ Pre-Deployment Checklist

### Backend Requirements
- [x] Real PostgreSQL database (Neon) configured
- [x] Session management with `connect-pg-simple`
- [x] Authentication routes: `/api/auth/login`, `/api/auth/user`, `/auth/logout`
- [x] All mock data removed from routes
- [x] Environment variables validated at startup
- [x] CORS configured for production domain
- [x] Session cookies: `httpOnly: true`, `secure: production`, `sameSite: 'lax'`

### Frontend Requirements
- [x] Login/Signup UI visible when unauthenticated
- [x] Logout button visible when authenticated
- [x] Empty states handle no data gracefully
- [x] API calls use `credentials: 'include'` for cookies
- [x] No hardcoded mock user data in components

---

## 🏗️ Deployment Architecture

### Option A: Railway (Backend) + Vercel (Frontend)
**Recommended for fastest setup**

#### Railway (Backend API)
```bash
# 1. Install Railway CLI
npm install -g @railway/cli

# 2. Login and create project
railway login
railway init

# 3. Set environment variables
railway variables set DATABASE_URL="postgresql://..."
railway variables set SESSION_SECRET="your-random-32-char-secret"
railway variables set NODE_ENV="production"
railway variables set DISABLE_FACEBOOK_AUTH="true"  # unless configured
railway variables set PORT="5000"

# 4. Deploy
railway up
```

**Railway Configuration:**
- Service: Node.js
- Build Command: `npm install && npm run build`
- Start Command: `npm start` (or `node server/index.js` if built)
- Port: 5000 (Railway auto-detects)
- Health Check: `/api/health` (create this endpoint)

#### Vercel (Frontend)
```bash
# 1. Install Vercel CLI
npm install -g vercel

# 2. Deploy from client directory
cd client
vercel

# 3. Set environment variable
vercel env add VITE_API_URL
# Enter: https://your-railway-app.railway.app
```

**Vercel Configuration (`vercel.json`):**
```json
{
  "buildCommand": "npm run build",
  "outputDirectory": "dist",
  "framework": "vite",
  "rewrites": [
    {
      "source": "/api/:path*",
      "destination": "https://your-railway-app.railway.app/api/:path*"
    }
  ]
}
```

---

### Option B: Single Railway Deployment (Full-Stack)
**Simpler, single service**

```bash
# Railway auto-detects and serves both API + static frontend
railway init
railway up
```

**`package.json` scripts for unified deployment:**
```json
{
  "scripts": {
    "build": "npm run build:client && npm run build:server",
    "build:client": "cd client && npm run build",
    "build:server": "tsc",
    "start": "NODE_ENV=production node dist/server/index.js"
  }
}
```

Railway will:
1. Run `npm install`
2. Run `npm run build`
3. Start with `npm start`
4. Serve frontend static files from `client/dist`
5. Handle API requests on same domain (no CORS issues!)

---

## 🔐 Environment Variables

### Required (Backend)
```env
DATABASE_URL=postgresql://user:pass@host/db?sslmode=require
SESSION_SECRET=random-32-character-secret-key-here
NODE_ENV=production
PORT=5000
```

### Optional (Backend)
```env
DISABLE_CRAWLER=true
DISABLE_FACEBOOK_AUTH=true
FACEBOOK_APP_ID=your-facebook-app-id
FACEBOOK_APP_SECRET=your-facebook-secret
SENDGRID_API_KEY=your-sendgrid-key  # for emails
ADMIN_EMAIL=admin@tradescout.com
```

### Frontend (if separate deployment)
```env
VITE_API_URL=https://your-backend.railway.app
```

---

## 🧪 Production Smoke Tests

### 1. Backend API Health
```bash
curl https://your-app.railway.app/api/health
# Expected: {"status":"ok"}
```

### 2. Auth Flow
```bash
# Login
curl -X POST https://your-app.railway.app/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"password"}' \
  -c cookies.txt

# Get user (with session cookie)
curl https://your-app.railway.app/api/auth/user -b cookies.txt
# Expected: {"id":"...","email":"test@example.com",...}

# Logout
curl -X POST https://your-app.railway.app/auth/logout -b cookies.txt
```

### 3. Empty Baseline APIs
```bash
# Marketplace (unauthenticated)
curl https://your-app.railway.app/api/marketplace/listings
# Expected: []

# Notifications (authenticated)
curl https://your-app.railway.app/api/notifications -b cookies.txt
# Expected: []
```

### 4. Frontend Access
```bash
curl -I https://your-frontend.vercel.app
# Expected: 200 OK
```

---

## 🔍 Post-Deployment Validation

### Browser Tests
1. **Open app in incognito window**
   - Should see "Sign In" / "Sign Up" buttons
   - No user data visible
   
2. **Sign up new account**
   - Fill form → Submit
   - Should redirect to profile/dashboard
   - Refresh page → still logged in (session persists)

3. **Navigate to empty pages**
   - Marketplace → "No listings" message
   - Notifications → Empty list
   - Profile → User data (or empty fields to fill)

4. **Logout**
   - Click logout button
   - Redirected to home/login
   - Cannot access protected pages

5. **Test session across tabs**
   - Login in tab 1
   - Open tab 2 → should be logged in
   - Logout in tab 1 → tab 2 should logout on next request

### Database Verification
```sql
-- Check users table
SELECT id, email, role, "createdAt" FROM users ORDER BY "createdAt" DESC LIMIT 10;

-- Check sessions table
SELECT * FROM sessions WHERE expire > NOW();

-- Check marketplace empty
SELECT COUNT(*) FROM marketplace_listings;
```

---

## 🐛 Common Issues & Fixes

### Issue: Session not persisting after login
**Cause:** Cookie not being set or sent
**Fix:**
1. Check backend cookie settings:
   ```ts
   cookie: {
     httpOnly: true,
     secure: process.env.NODE_ENV === 'production',  // MUST be true in prod
     sameSite: 'lax',  // or 'none' if frontend on different domain
   }
   ```
2. Frontend API calls must include:
   ```ts
   fetch('/api/...', { credentials: 'include' })
   ```
3. If separate domains, set CORS:
   ```ts
   app.use(cors({
     origin: 'https://your-frontend.vercel.app',
     credentials: true
   }));
   ```

### Issue: 401 on all authenticated endpoints
**Cause:** Session secret mismatch or missing
**Fix:**
```bash
railway variables set SESSION_SECRET="same-secret-as-before"
railway restart
```

### Issue: Database connection fails
**Cause:** Neon connection string incorrect
**Fix:**
1. Verify `?sslmode=require` in connection string
2. Check Neon dashboard for correct host/credentials
3. Test connection:
   ```bash
   psql "postgresql://user:pass@host/db?sslmode=require"
   ```

### Issue: CORS errors in browser console
**Cause:** Frontend domain not allowed
**Fix:**
```ts
// server/index.ts
app.use(cors({
  origin: ['https://your-frontend.vercel.app', 'http://localhost:5173'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS']
}));
```

---

## 📊 Monitoring & Logs

### Railway Logs
```bash
railway logs
# Or via Railway dashboard
```

### Key Metrics to Watch
- **Session count:** Should grow with active users
- **Database connections:** Should not exceed pool limit
- **API response times:** Monitor `/api/auth/login`, `/api/marketplace/listings`
- **Error rate:** Watch for 500s or authentication failures

### Health Check Endpoint
Add to `server/routes.ts`:
```ts
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV,
    database: pool ? 'connected' : 'disconnected'
  });
});
```

---

## 🚦 Production Readiness Certification

### ✅ Security
- [ ] SESSION_SECRET is random and secure (32+ characters)
- [ ] DATABASE_URL is not committed to git
- [ ] Cookies are `httpOnly` and `secure` in production
- [ ] No sensitive data logged to console
- [ ] Rate limiting on auth endpoints (optional)

### ✅ Performance
- [ ] Database connection pool configured (`max: 20`)
- [ ] Static assets served with caching headers
- [ ] Vite build optimized for production
- [ ] No console.log spam in production

### ✅ Reliability
- [ ] Graceful error handling (no crashes on bad input)
- [ ] Database queries have timeouts
- [ ] Session store persists across restarts
- [ ] Health check endpoint responds

### ✅ User Experience
- [ ] Login/logout works reliably
- [ ] Sessions persist across page refreshes
- [ ] Empty states show helpful messages
- [ ] Loading states prevent UI flicker
- [ ] Forms validate and show errors

---

## 🎯 Next Steps After Deployment

1. **Test with real users** (alpha testers)
2. **Monitor error logs** daily
3. **Set up email notifications** (SendGrid)
4. **Add analytics** (optional: PostHog, Plausible)
5. **Configure custom domain** (Railway + Vercel)
6. **Set up automated backups** (Neon auto-backups)
7. **Document API** (if needed for mobile/3rd party)

---

## 📞 Support Checklist

If users report issues:
1. Check Railway logs for errors
2. Verify session is being created (check `sessions` table)
3. Test auth flow in incognito window
4. Check browser console for CORS/cookie errors
5. Verify environment variables are set correctly

---

**Deployment Time Estimate:**
- Railway backend: 10 minutes
- Vercel frontend: 5 minutes
- Testing: 15 minutes
- **Total: ~30 minutes** from start to live

**Cost Estimate (Monthly):**
- Railway Hobby: $5/month (includes $5 credit)
- Vercel Hobby: Free
- Neon Free Tier: Free (0.5GB storage, 1 database)
- **Total: $0-5/month** for early stage
