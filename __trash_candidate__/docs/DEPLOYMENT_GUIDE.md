# Deploying TradeScout to thetradescout.com

## Quick Start - Recommended: Vercel

### 1. Install Vercel CLI
```powershell
npm install -g vercel
```

### 2. Login to Vercel
```powershell
vercel login
```

### 3. Deploy
```powershell
vercel --prod
```

### 4. Configure Domain
1. Go to your Vercel dashboard
2. Go to your project → Settings → Domains
3. Add `thetradescout.com` and `www.thetradescout.com`
4. Copy the DNS records Vercel provides

### 5. Update DNS (at your domain registrar)
Add these DNS records:

**A Record:**
- Name: `@`
- Value: `76.76.21.21` (Vercel's IP)

**CNAME Record:**
- Name: `www`
- Value: `cname.vercel-dns.com`

---

## Alternative: Railway (with Database included)

### 1. Install Railway CLI
```powershell
npm install -g @railway/cli
```

### 2. Login
```powershell
railway login
```

### 3. Initialize
```powershell
railway init
```

### 4. Add PostgreSQL
```powershell
railway add postgresql
```

### 5. Deploy
```powershell
railway up
```

### 6. Set Environment Variables
```powershell
railway variables set SESSION_SECRET=$(openssl rand -base64 32)
railway variables set NODE_ENV=production
railway variables set DOMAIN=thetradescout.com
```

### 7. Configure Custom Domain
```powershell
railway domain thetradescout.com
```

Railway will provide DNS records - add them to your domain registrar.

---

## Alternative: Render (Free tier available)

### 1. Create a Render account
Visit https://render.com

### 2. Connect GitHub
Link your GitHub repository: `TradersCorner/tradescoutAI`

### 3. Create New Web Service
- Build Command: `npm install && npm run build`
- Start Command: `npm start`
- Environment: Node

### 4. Add Environment Variables
In Render dashboard:
- `NODE_ENV` = `production`
- `DATABASE_URL` = (your database URL)
- `SESSION_SECRET` = (generate with: openssl rand -base64 32)
- `PORT` = `10000` (Render default)

### 5. Add Custom Domain
In Render:
- Go to Settings → Custom Domain
- Add `thetradescout.com`
- Add DNS records to your domain registrar:

**CNAME Record:**
- Name: `@` or `thetradescout.com`
- Value: (provided by Render, looks like: `xxx.onrender.com`)

---

## DNS Configuration at Domain Registrar

Regardless of hosting provider, you'll need to update DNS records at wherever you registered **thetradescout.com** (GoDaddy, Namecheap, Cloudflare, etc.)

### Common DNS Records:

**For Vercel:**
```
Type: A
Name: @
Value: 76.76.21.21

Type: CNAME  
Name: www
Value: cname.vercel-dns.com
```

**For Railway:**
```
Type: CNAME
Name: @
Value: (provided by Railway after `railway domain` command)

Type: CNAME
Name: www  
Value: (same as above)
```

**For Render:**
```
Type: CNAME
Name: @
Value: xxx.onrender.com (your Render URL)

Type: CNAME
Name: www
Value: xxx.onrender.com
```

---

## Production Checklist

Before going live:

- [ ] Set up production database (PostgreSQL recommended)
- [ ] Generate strong SESSION_SECRET: `openssl rand -base64 32`
- [ ] Update `.env.production` with real values
- [ ] Test all user flows (registration, login, profiles)
- [ ] Set up SSL certificate (automatic with Vercel/Railway/Render)
- [ ] Configure CORS for your domain
- [ ] Set up monitoring/error tracking (optional: Sentry)
- [ ] Enable database backups

---

## Quick Test After Deployment

1. Visit https://thetradescout.com
2. Test registration with all 27 user types
3. Test state/county selection
4. Verify badges display
5. Check profile customization
6. Test public profile URLs

---

## Need Help?

- Vercel docs: https://vercel.com/docs
- Railway docs: https://docs.railway.app
- Render docs: https://render.com/docs
