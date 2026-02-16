# Credential Rotation Runbook

Last updated: 2026-02-16

## Trigger

Run this whenever `npm run audit:secrets-history` reports secret-bearing paths in git history, or any credential/certificate is exposed.

## Scope From Current Incident

- `secrets/db_password.txt`
- `secrets/gemini_api_key.txt`
- `secrets/session_secret.txt`
- `ssl/fullchain.pem`
- `ssl/privkey.pem`

## Required Actions

1. Rotate database credentials used by `DATABASE_URL` and `TEST_DATABASE_URL`.
2. Rotate AI provider keys (Gemini/OpenAI/Anthropic, as applicable).
3. Rotate session/signing secrets (`SESSION_SECRET`, JWT secrets, any cookie signing keys).
4. Reissue TLS certificate and private key pair if exposed (`fullchain.pem` + `privkey.pem`).
5. Redeploy all environments after secret updates.

## Validation

1. Run `npm run audit:secrets-history` and confirm it passes.
2. Run `npm run check:scale-readiness` and confirm DB connectivity passes with new credentials.
3. Run `npm run verify` before release.

## Remote Cleanup Commands

If historical secret-bearing refs are tags, delete them on each remote:

```bash
git push origin :refs/tags/<tag-name>
```

If branch history is affected, rewrite and force-push the impacted refs:

```bash
git push --force-with-lease origin <branch-name>
```

## Guardrails

- Keep `.env`, `secrets/`, `ssl/`, and private key/cert extensions in `.gitignore`.
- Never store live secrets in repo files.
- Use secret managers for runtime credentials.
