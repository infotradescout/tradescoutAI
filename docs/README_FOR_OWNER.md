What the app does (one paragraph)
- TradeScout is a Node.js web application that provides a local services marketplace and community platform. The server (Express + TypeScript) exposes an API and serves a React/Vite client; it also server-renders SEO pages for public profiles and shared work requests. The data layer is PostgreSQL using Drizzle ORM; sessions are stored in Postgres and authentication uses Passport (local + OAuth providers).

What users can do (by user type)
- Visitors: browse public profile pages (`/u/:slug`) and preview shared work requests (`/r/:shareToken`).
- Registered users: sign up / sign in using email/password or social OAuth (Google/Facebook), manage a profile, interact with local listings, messaging, and marketplace features (routes implemented in `server/routes.ts`).
- Contractors / businesses: manage business profiles and listings (server routes under `server/routes/*` such as `businesses`, `business-profile`, `marketplace_*`).

What admins can do
- Admin roles and permissions exist (roles defined in `shared/roles`). Admin functionality is mounted via `server/routes.ts` (see `mountAdminRoutes`) and auth helpers in `server/auth.ts` (e.g. `isAdmin`, `requireRole`). Super-admin/head-admin can be bootstrapped with `MASTER_ADMIN_EMAIL`/`MASTER_ADMIN_PASSWORD` on startup (`server/index.ts`).

What data the app stores (high level)
- PostgreSQL data model defined in `shared/schema.ts` (sessions, users, profiles, businesses, marketplace listings, messages, social posts, payments/transactions, notifications, many supportive tables). Drizzle config is in `drizzle.config.ts` and migrations live in `./migrations/`.

What pages exist and what each page is for
- Client single-page app (served from `dist/public/index.html` after build) — main web UI (routes handled client-side by React/Vite).
- `/u/:slug` (server-rendered public profile HTML) — implemented in `server/index.ts` and `server/publicProfileHtml.ts`.
- `/p/:slug` — legacy path that redirects to `/u/:slug` (see `server/index.ts`).
- `/r/:shareToken` — server-rendered shared work request preview (implemented in `server/index.ts` and `server/workRequestShareHtml.ts`).
- `/api/*` — JSON API endpoints implemented across many files under `server/routes` (entry: `server/routes.ts`).
