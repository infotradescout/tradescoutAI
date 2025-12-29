# Legacy App Surface

The `legacy/` directory contains older application surfaces and experiments that have been superseded by the current Scout + shell architecture.

- These files are not referenced by the main router and are excluded from the TypeScript `include` list.
- Do **not** add new imports from here into `client/src` or `server/`.

When in doubt:
- Build new work under `client/src` and `server/` only.
- Treat this directory as an **archive** that can be mined for ideas, not as live code.
