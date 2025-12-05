# 🚦 Deployment Smoke Test Checklist

## 1. Build & Start
- [ ] `docker-compose up --build -d` completes with no errors
- [ ] All containers show `healthy` in `docker-compose ps`

## 2. Health Endpoints
- [ ] `GET /api/assistant/health` returns `{ status: "ok" }`
- [ ] NGINX `/health` returns 200
- [ ] Postgres responds to `pg_isready`

## 3. Static & Cache
- [ ] Static files load via NGINX (e.g., `/index.html`)
- [ ] Cache folders are writable by app, not world-writable

## 4. Database
- [ ] Migrations run successfully (`docker-compose exec app sh scripts/migrate.sh`)
- [ ] DB backup script runs and file is created

## 5. Secrets
- [ ] No secrets are present in the repo
- [ ] Docker secrets are mounted and read by app

## 6. Process Management
- [ ] PM2 shows all app processes online (`docker-compose exec app pm2 list`)
- [ ] Zero-downtime reload works (`docker-compose exec app pm2 reload all`)

## 7. Logs & Monitoring
- [ ] App logs show no errors on startup
- [ ] NGINX logs show 200 for `/health` and `/`
- [ ] All endpoints respond as expected

---

**Run this checklist after every deployment to production.**
