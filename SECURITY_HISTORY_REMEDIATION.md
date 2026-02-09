# Secret History Remediation (Required)

This repository has historical references to secret-bearing files. Treat all related credentials as exposed.

## Scope Detected

- `secrets/db_password.txt`
- `secrets/gemini_api_key.txt`
- `secrets/session_secret.txt`
- `ssl/fullchain.pem`
- `ssl/privkey.pem`

## Required Actions

1. Rotate all affected credentials immediately.
2. Rewrite git history to remove the files from all refs.
3. Force-push rewritten refs.
4. Invalidate old local clones/forks and require a fresh clone for collaborators.
5. Verify with:
- `npm run audit:secrets-history`

## Suggested Rewrite Commands

```bash
git filter-repo --path secrets/db_password.txt --invert-paths
git filter-repo --path secrets/gemini_api_key.txt --invert-paths
git filter-repo --path secrets/session_secret.txt --invert-paths
git filter-repo --path ssl/fullchain.pem --invert-paths
git filter-repo --path ssl/privkey.pem --invert-paths
git push --force --all
git push --force --tags
```

If the repo policy prefers a single pass, use one `git filter-repo` command with multiple `--path` args and `--invert-paths`.
