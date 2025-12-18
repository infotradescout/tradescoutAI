### PHASE 6: Final Production Verification & Handoff

See `FINAL_HANDOFF_README.md` for final checklist and handoff steps.

- Complete smoke test and log review
- Deliver all documentation and credentials
- Set up support, alerting, and update procedures
### PHASE 5: Mobile Packaging (PWA, Mobile Build, Push)

See `MOBILE_PACKAGING_README.md` for architecture and implementation steps.

- Add PWA manifest and service worker for installability
- Use React Native/Capacitor for native mobile builds
- Integrate push notifications for web and native
### PHASE 4: Admin Intelligence (Analytics, Audit, Admin AI)

See `ADMIN_INTELLIGENCE_README.md` for architecture and implementation steps.

- Add analytics dashboard for usage and trends
- Implement audit logging for all admin actions
- Integrate LLM-powered admin helpers for prompt suggestions and system queries
### PHASE 3: AI Expansion (Multi-Model, Fallback, Prompt Versioning)

See `AI_EXPANSION_README.md` for architecture and implementation steps.

- Integrate multiple LLM providers (Gemini, OpenAI, local)
- Add fallback logic for reliability
- Track and manage prompt versions for audit and rollback
### PHASE 2.5: Performance & Scaling Documentation

- All performance, scaling, and monitoring steps are documented above.
- Update this file with real load test results, CDN provider, and autoscaling configuration as you deploy.
- Review and tune resource limits, cache, and log settings after each major release.
### PHASE 2.4: Advanced Log Aggregation

See `logging.md` for best practices and setup instructions for ELK, Loki, or cloud logging.

**Key points:**
- Forward app and NGINX logs to a central aggregator
- Use structured logs and log rotation
- Monitor for errors, latency, and traffic spikes
### PHASE 2.3: Autoscaling (Kubernetes Example)

**Kubernetes deployment:** See `k8s-deployment.yaml` for a production-ready deployment, service, and autoscaler (HPA).

**Steps:**
1. Build and push your Docker image to a registry.
2. Create Kubernetes secrets for environment variables and sensitive data.
3. Apply the deployment:
  ```sh
  kubectl apply -f k8s-deployment.yaml
  ```
4. The HorizontalPodAutoscaler (HPA) will scale pods based on CPU usage.

**Best practices:**
- Use readiness/liveness probes for health.
- Set resource requests/limits for predictable scaling.
- Use a managed DB (e.g., AWS RDS) for production.
### PHASE 2.2: CDN Integration (Best Practice)

**Recommended:** Use a global CDN (Cloudflare, AWS CloudFront, Fastly, etc.) in front of NGINX for static assets and API caching.

**Steps:**
1. Point your domain's DNS to the CDN provider.
2. Configure CDN to cache static files (`/public`, `/client/public`, `/favicon.ico`, `/assets/*`).
3. Set cache rules to bypass API endpoints (e.g., `/api/*`, `/health`).
4. Enable SSL/TLS at the CDN edge (use "Full" or "Strict" mode for end-to-end encryption).
5. Enable HTTP/2 and Brotli/Gzip compression.
6. Set security headers (CSP, HSTS, X-Frame-Options) at the CDN or NGINX.
7. (Optional) Enable DDoS protection and rate limiting.

**Cloudflare Example:**
- Add your domain to Cloudflare.
- Set DNS A/AAAA/CNAME records to your server's public IP.
- Use "Cache Everything" for static, "Bypass" for API.
- Enable "Always Use HTTPS" and "Automatic HTTPS Rewrites".

**AWS CloudFront Example:**
- Create a distribution with your server as the origin.
- Set behaviors: cache static, forward API to origin.
- Attach SSL cert via ACM.

**Test:**
- Use `curl -I https://yourdomain.com/asset.js` to verify CDN headers (e.g., `cf-cache-status: HIT`).

**Best practices:**
- Purge CDN cache after deployments.
- Monitor CDN analytics for traffic and errors.
### PHASE 2.1: Load Testing

**Tool:** [autocannon](https://github.com/mcollina/autocannon)

**Run a load test:**
```powershell
docker-compose exec app node scripts/loadtest.js http://localhost:3000/api/assistant/health 50 20
```
*Arguments: [url] [connections] [durationSeconds]*

**Record your results here:**
| Connections | Duration (s) | Requests/sec | Latency (ms) | Errors |
|-------------|--------------|--------------|--------------|--------|
|             |              |              |              |        |

**Best practices:**
- Run load tests before and after major changes.
- Monitor CPU, memory, and response times during test.
- Use results to tune PM2, DB, and cache settings.
### Healthcheck Endpoints & Monitoring

- **App health:**
  - `GET /api/assistant/health` — returns status, Gemini config, cache, scheduler info
  - Used by Docker healthcheck and NGINX healthcheck
- **DB health:**
  - Docker Compose uses `pg_isready` for Postgres
- **NGINX health:**
  - Proxies `/health` to app health endpoint
- **Monitoring:**
  - Use `docker-compose ps` to check container health
  - Use `/api/assistant/health` for readiness/liveness probes
  - Integrate with external monitoring (UptimeRobot, Datadog, etc.) as needed

**Example:**
```powershell
curl http://localhost:3000/api/assistant/health
```
### Static Files & Cache Folder Permissions

- `public/` and `client/public/` are served as static files by NGINX and the app.
- `server/cache/`, `server/cache/manual/`, and `server/cache/autogenerated/` are used for prompt and data caching.
- **Permissions:**
  - Static files: read-only for the app and NGINX containers.
  - Cache folders: read/write for the app container only, not world-writable.
  - Never expose cache folders to the public web.
- **Best practices:**
  - Use Docker volumes for cache persistence.
  - Restrict file permissions to the minimum required (e.g., `chmod 700` for cache, `chmod 444` for static files).
### Database: Migrations & Backups

- **Migrations:**
  - Run all pending migrations with Drizzle ORM:
    ```powershell
    docker-compose exec app sh scripts/migrate.sh
    ```
- **Backups:**
  - Backup the Postgres database to `/backups`:
    ```powershell
    docker-compose exec db sh scripts/backup_db.sh
    ```
- **Restore:**
  - To restore, use `psql` inside the db container:
    ```powershell
    docker-compose exec -T db psql -U tradescout tradescout < /backups/backup_YYYYMMDD_HHMMSS.sql
    ```

**Best practices:**
- Schedule regular backups and store them securely off-server.
- Run migrations on every deployment.
# TradeScoutPro Production Deployment Guide

## 1.1 Production Environment Configuration

### Files and Directories
- `Dockerfile`: Multi-stage build for Node.js app, static files, healthcheck.
- `docker-compose.yml`: Orchestrates app, NGINX reverse proxy, and Postgres DB.
- `nginx.conf`: NGINX config for SSL, reverse proxy, static files, health checks, security headers.
- `ssl/fullchain.pem`, `ssl/privkey.pem`: SSL certificate and private key (replace with real certs for production).
- `.env.example`: Template for production environment variables.

### Usage
1. **Copy your SSL cert and key** to `ssl/fullchain.pem` and `ssl/privkey.pem`.
2. **Create a `.env` file** in the project root based on `.env.example`.
3. **Build and start all services:**
   ```powershell
   docker-compose up --build -d
   ```
4. **Access the app:**
   - HTTPS: https://localhost/
   - HTTP will redirect to HTTPS.

### Secrets Management (Production Best Practices)

- **Never commit real secrets to version control.**
- Use Docker secrets for sensitive values in production:
  - Place secrets in the `/secrets` directory (e.g., `session_secret.txt`, `db_password.txt`, `gemini_api_key.txt`).
  - Use `docker-compose.secrets.yml` to mount secrets securely into containers.
  - Reference secrets in your app using environment variables (e.g., `SESSION_SECRET_FILE`, `DATABASE_PASSWORD_FILE`).
- For local/dev, use `.env` (never commit real secrets).
- For cloud deployments, use your provider's secret manager (AWS Secrets Manager, Azure Key Vault, etc.).

**Example:**
```powershell
docker-compose -f docker-compose.yml -f docker-compose.secrets.yml up --build -d
```

**Regenerate secrets regularly and rotate keys if compromised.**

### Process Management & Zero-Downtime Reload

- The app runs under [PM2](https://pm2.keymetrics.io/) in cluster mode for maximum reliability and zero-downtime reloads.
- Configuration: `ecosystem.config.js` (auto-used by Dockerfile)
- To reload the app gracefully (no downtime):
  ```powershell
  docker-compose exec app pm2 reload all
  ```
- PM2 will restart crashed processes automatically and balance load across CPU cores.

**Graceful shutdown:**
- PM2 handles SIGINT/SIGTERM and waits for connections to close before stopping workers.

**Logs:**
- View logs: `docker-compose exec app pm2 logs`

**Manual reload (no downtime):**
- `docker-compose exec app pm2 reload all`

**Cluster scaling:**
- By default, PM2 uses all available CPU cores. Adjust in `ecosystem.config.js` if needed.

### File Permissions
- The `ssl/privkey.pem` file should be readable only by root inside the container. Docker Compose will mount it read-only.
- Static files in `/public` are served by NGINX.
- App cache folders are mounted for persistence.

### Health Checks
- App: `GET /health` (proxied by NGINX)
- DB: `pg_isready`
- NGINX: `GET /health` (proxies to app)

### Security
- NGINX enforces SSL, HSTS, and security headers.
- Never commit real secrets or private keys to version control.

---

For further scaling, process management, and CI/CD, continue to the next deployment phases as outlined in your roadmap.
