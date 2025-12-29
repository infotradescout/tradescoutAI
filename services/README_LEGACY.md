# Legacy Services (Do Not Use)

This `services/` directory holds **legacy experiment code** that predates the current `server/` + `shared/` structure.

- It is **not** included in `tsconfig.json`.
- Nothing under here is compiled or deployed.

Use the current paths instead:
- Backend services and DB access: code in `server/` and `shared/`.
- External integrations (e.g. Mealscout): the versions under `server/` / `services` that are actually imported.

If you find an implementation you want to reuse, port it into the modern modules rather than importing from this folder.
