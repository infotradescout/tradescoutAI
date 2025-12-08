# ⚡ QUICK START - Deploy Phase 0 in 30 Minutes

**Copy & Paste these commands in PowerShell to go live:**

---

## Step 1: Install Dependencies (2 min)

```powershell
cd "c:\Users\FlavorGood\Documents\AAATraderCorner\TradeScout\TradeScoutPro"
npm install
cd client
npm install
cd ..
```

---

## Step 2: Test Locally (3 min)

```powershell
# Start the server
$env:DISABLE_CRAWLER="true"
npm run dev:server

# In another PowerShell window, test health endpoint:
Invoke-RestMethod http://localhost:5000/api/health -OutFile -
```

Should return:
```json
{
  "status": "healthy",
  "uptime": 42,
  "database": "connected",
  ...
}
```

If it works → **STOP the server (Ctrl+C)** and continue  
If it fails → Check database connection string in `.env`

---

## Step 3: Build (5 min)

```powershell
npm run build
```

Should complete without errors. If there are only warnings about unused client pages (helper-dashboard, moderation-center), that's fine - those are pre-existing.

---

## Step 4: Deploy to Railway (10 min)

### Option A: Railway CLI (Recommended)

```powershell
# If first time with Railway:
npm install -g @railway/cli
railway login

# Initialize Railway for this project:
railway init

# Set environment variables:
railway variable set DATABASE_URL "postgresql://..."
railway variable set SESSION_SECRET "your-secret-key-32-chars-min"
railway variable set NODE_ENV "production"
railway variable set DISABLE_CRAWLER "true"

# Optional but recommended:
railway variable set STRIPE_SECRET_KEY "sk_test_..."
railway variable set STRIPE_WEBHOOK_SECRET "whsec_test_..."
railway variable set SENDGRID_API_KEY "SG..."

# Deploy:
railway up
```

### Option B: Railway Dashboard (Manual)

1. Go to railway.app
2. Create new project
3. Connect your GitHub repo (or upload folder)
4. Create Node service
5. Set environment variables (same as above)
6. Deploy

---

## Step 5: Verify Deployment (5 min)

```powershell
# Get your Railway app URL:
railway status

# Test the health endpoint:
Invoke-RestMethod "https://your-app-name.railway.app/api/health"
```

Should return healthy status with database connected.

---

## Step 6: Quick Smoke Tests (5 min)

```powershell
$baseUrl = "https://your-app-name.railway.app"

# Test health
Write-Host "Testing /api/health..."
Invoke-RestMethod "$baseUrl/api/health"

# Test login (will fail but endpoint should exist)
Write-Host "Testing /api/auth/login endpoint..."
Invoke-RestMethod "$baseUrl/api/auth/login" -Method POST -Body '{}' -ContentType "application/json" -ErrorAction SilentlyContinue

# Test auth user (will 401 but endpoint should exist)
Write-Host "Testing /api/auth/user endpoint..."
Invoke-RestMethod "$baseUrl/api/auth/user" -ErrorAction SilentlyContinue
```

---

## 🎉 SUCCESS!

If all tests pass, you're LIVE with Phase 0:

✅ Health monitoring active  
✅ Payment system ready  
✅ Email service ready  
✅ Error tracking active  
✅ Rate limiting active  
✅ Messaging API ready  

---

## 🔗 Important URLs

**Health Dashboard:** `https://your-app.railway.app/api/health`

**Admin Email Send:** `POST https://your-app.railway.app/api/email/send`

**Payment Intent:** `POST https://your-app.railway.app/api/payments/intent`

**Conversations:** `GET/POST https://your-app.railway.app/api/conversations`

---

## 📝 Required Environment Variables

Copy this and set in Railway:

```
DATABASE_URL=postgresql://[user:password@]host[:port]/dbname
SESSION_SECRET=your-random-32-character-secret-string-here
NODE_ENV=production
DISABLE_CRAWLER=true
PORT=5000

STRIPE_SECRET_KEY=sk_test_123...
STRIPE_WEBHOOK_SECRET=whsec_test_123...
SENDGRID_API_KEY=SG123...
SENTRY_DSN=https://xxx@sentry.io/xxx
```

---

## 🆘 Troubleshooting

### Server won't start?
```powershell
# Check what's using port 5000
netstat -ano | findstr :5000

# Kill it
taskkill /PID <PID> /F

# Try again
npm run dev:server
```

### Build failing?
```powershell
# Clean and retry
rm -r dist node_modules
npm install
npm run build
```

### Database won't connect?
```powershell
# Check your DATABASE_URL is correct
echo $env:DATABASE_URL

# Test the connection
psql $env:DATABASE_URL
```

### Stripe/SendGrid not working?
- Verify API keys in Railway variables (case-sensitive)
- Use test keys (sk_test_..., not sk_live_...)
- Check keys haven't expired in provider dashboard

---

## ✅ After Deployment

1. **Monitor Logs:**
   ```powershell
   railway logs -f
   ```

2. **Invite Alpha Testers:**
   - Share: `https://your-app.railway.app`
   - Have them try: Login → Marketplace → Browse → Message seller

3. **Watch Errors:**
   - Sentry dashboard shows real-time issues
   - Fix critical bugs before beta

4. **Next Phase:**
   - Build WebSocket for real-time messaging (20 hrs)
   - Connect image upload (15 hrs)
   - Add review system (25 hrs)

---

## 💰 What This Costs

**First Month:**
- Railway: Free tier ($5 credit covers it)
- Vercel (frontend): Free
- Neon (database): Free tier
- Stripe: Free (only pay on transactions)
- SendGrid: Free (100 emails/day)
- Sentry: Free tier
- **TOTAL: $0**

---

## 🎯 Success Criteria

✅ No errors in deploy logs  
✅ `/api/health` returns 200  
✅ Database shows "connected"  
✅ Authentication works  
✅ Can create/list conversations  
✅ No 500 errors in logs  

---

**You're ready. Deploy now!** 🚀

