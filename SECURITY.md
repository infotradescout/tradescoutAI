# Security Notes (Read Before Deploying)

## 1) Secrets must never be committed

This repo previously contained real secret material under `secrets/` and `ssl/`.
Those files have been removed from the working tree and are now ignored, but **git
history may still contain them**.

Treat any previously committed values as compromised and rotate them.

## 2) Purge secrets from git history (required)

If the removed secrets were ever committed/pushed, rewrite history and force-push.

### Option A: `git filter-repo` (recommended)

```powershell
# Install once (Python required)
python -m pip install git-filter-repo

# Run from your repo root
# e.g. cd C:\path\to\TradeScoutPro

# Rewrite history to remove secret paths
git filter-repo --force ^
  --path secrets/db_password.txt --invert-paths ^
  --path secrets/gemini_api_key.txt --invert-paths ^
  --path secrets/session_secret.txt --invert-paths ^
  --path ssl/fullchain.pem --invert-paths ^
  --path ssl/privkey.pem --invert-paths

# Force-push rewritten history
git push --force --all
git push --force --tags
```

After rewriting history, re-run the repo’s secrets history audit to confirm there are no remaining matches:

```powershell
npm run audit:secrets-history
```

### Option B: BFG Repo-Cleaner

Use BFG if your team already standardizes on it. Ensure you remove the same paths
and then run aggressive GC.

## 3) Rotate credentials (minimum list)

- `SESSION_SECRET` (invalidate sessions)
- Database credentials (`DATABASE_URL`)
- Gemini (`GEMINI_API_KEY`)
- Any TLS private key/cert you committed (`ssl/privkey.pem`, `ssl/fullchain.pem`)
- Any other third-party tokens used in `.env` / CI secrets

## 4) Local dev guidance

Use `.env` (not committed) and store TLS materials outside the repo if you use
the Docker Compose nginx config.

