This file explains the main "happy path" flows and exactly which routes/files implement them.

1) New user signup / login
- Entry points:
  - Local email/password: handled by Passport Local (see `server/auth.ts`).
    - Login verification: `passport.use(new LocalStrategy(...))` in `server/auth.ts`.
    - Session stored in Postgres (`sessions` table) via `connect-pg-simple` (see `server/auth.ts::getSession`).
  - OAuth / Replit / social: there are multiple strategies: `replitAuth.ts` (Replit OIDC), Facebook strategy registration in `server/auth.ts`, and Google strategy references in `server/routes.ts`.
- Typical flow (explicit steps a user does):
  1. User submits signup form in the client.
  2. Client calls a server API endpoint (examples: `POST /api/contractor-signup` implemented in `server/routes/contractor-signup.ts`, or social OAuth endpoints handled by passport middleware in `server/auth.ts` / `server/replitAuth.ts`).
  3. Server creates a user record via `storage.createUser` (storage helpers live in `server/storage.ts`).
  4. If using local auth, passport creates a session cookie `tradescout.sid` backed by the `sessions` table; `serializeUser` stores `user.id` in the session.

2) Returning user session restore
- Mechanism: `express-session` + `passport.session()` middleware (configured in `server/auth.ts`) automatically restores `req.user` when the request contains a valid `tradescout.sid` cookie and session row exists in `sessions`.
- Files: `server/auth.ts` (session configuration and passport serialize/deserialize) and `server/index.ts` (where `setupAuth` is called before `registerRoutes`).

3) Creating and viewing key objects
- Profiles (public-facing pages):
  - Create / list: `POST /api/profiles`, `GET /api/profiles` implemented in `server/routes/profiles.ts` (see create and list handlers).
  - View public page: `GET /u/:slug` server-rendered by `server/index.ts` which calls `buildPublicProfileHtml` (see `server/publicProfileHtml.ts`).

- Marketplace listings:
  - Listing schema is `marketplace_listings` in `shared/schema.ts`.
  - Create/update/listing endpoints are implemented across `server/routes/*` (search for `marketplace` routes; see `server/routes.ts` which imports marketplace-related routers and `server/routes/transactions.ts` for transaction persistence).

- Messages / conversations:
  - Conversation and messaging logic is in `shared/schema.ts` (tables `conversations`, `messages`) and server socket/messaging in `server/messaging-service.ts` and routes under `server/routes/*`.

4) Admin moderation flows
- Moderation-related tables: `moderationReports`, `moderationVotes`, `moderationActions`, `moderationAppeals` etc. (see `shared/schema.ts`).
- Admin routes: `mountAdminRoutes` is called from `server/routes.ts` — admin endpoints are implemented under `server/routes/admin/*` and `server/moderation.ts`.
- Auth gating: `server/auth.ts` provides `requireRole`, `isAdmin`, and `isModerator` middleware used to protect these routes.

For any page/route you want to inspect
- Start with `server/routes.ts` — it centralizes registration of most routers and shows which files implement which API paths.
