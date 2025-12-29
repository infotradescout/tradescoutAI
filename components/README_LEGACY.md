# Legacy Components (Do Not Use)

This directory contains **old demo/legacy React components** that are **not part of the current TradeScout app**.

- TypeScript compilation only includes `client/src`, `server`, and `shared`.
- These files are not bundled or shipped.
- New work must use components from `client/src/components` (or other code under `client/src`).

If you need something from here, either:
- Move the pattern into `client/src/components` and modernize it, or
- Delete the unused legacy component instead of wiring it back into the app.

Treat this folder as an archive only.
