# GitHub automation policy

GitHub Actions is intentionally not used by this repository.

- Release verification runs locally against the exact commit under review.
- `npm run verify:local` is the standard local PR lane.
- The pull request records the commands run, their results, and anything not run.
- Render deploys production from commits to `main`; Actions is not part of deployment.
- Do not add files under `.github/workflows/` without explicit owner approval.

See [`RELEASE_CONTROL.md`](../RELEASE_CONTROL.md) for the current release process.
