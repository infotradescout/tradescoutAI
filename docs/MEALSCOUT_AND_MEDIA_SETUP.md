# MealScout Link + User Media Uploads – How to Finish

This doc is the operator runbook for wiring up:

1. MealScout link / SSO from TradeScout
2. Real user media uploads (images/files) using the existing storage layer

It assumes you are on the current `main` of TradeScoutPro.

---

## 1. Finish the MealScout Link (SSO + Actions)

### 1.1. What already exists

Server-side:

- `services/mealscoutClient.ts`
  - `mealscoutAction(action, params)` – generic action proxy to MealScout.
  - `createMealscoutSsoToken(user)` – signs a JWT for SSO.
  - `ensureMealscoutSsoSession(user)` – calls MealScout SSO endpoint and returns any `Set-Cookie` headers.
- `server/routes.ts`
  - `POST /api/mealscout/sso` – initializes a MealScout SSO session for the current TradeScout user and returns `{ ok, mealscoutBaseUrl, token }`.
  - `POST /api/mealscout/affiliate/subscription-payment` – webhooks for affiliate tracking.
- `server/assistantActions.ts`
  - `mealscout_action` – Scout tool that proxies to `mealscoutAction`.
- `server/routes/scout.ts`
  - Adds a `MEALSCOUT_COMMAND` action when the user is talking about food/drinks or has MealScout merchant roles.

Shared types / features:

- `shared/userTypes.ts` – some roles include `mealscout_deals` and `mealscout_subscription` in `features`.

### 1.2. Env vars you must set

In the TradeScout environment (Render/Neon/wherever the Node server runs), set:

- `MEALSCOUT_BASE_URL` – base URL of your MealScout deploy, e.g. `https://mealscout.yourdomain.com`.
- `MEALSCOUT_API_TOKEN` – server-to-server bearer token that MealScout expects on `/api/actions`.
- `MEALSCOUT_SHARED_SECRET` (or `TRADESCOUT_JWT_SECRET`) – shared signing secret for SSO JWTs.
- `MEALSCOUT_WEBHOOK_SECRET` – secret header for MealScout → TradeScout affiliate webhooks.

You can use `.env.local` in dev and provider-specific env config in production.

### 1.3. Wire MealScout SSO in the client

Goal: from a button / Scout action, call `/api/mealscout/sso`, then open MealScout in a new tab or focused surface with SSO cookies set.

1. In the client, create a minimal helper (if not already present):

   - Location: `client/src/lib/mealscout.ts` (or reuse an existing helper).
   - Behavior:
     - `POST /api/mealscout/sso`.
     - If `ok`, store `mealscoutBaseUrl` and `token` if needed, then `window.location.href = mealscoutBaseUrl` or open in new tab.

2. Hook it into the UI:

   - In any dedicated MealScout nav item (e.g. Finances/Deals/Scout tiles), have a click handler that:
     - Calls the helper.
     - Shows a spinner while waiting.
     - On error, shows a toast like: `Couldn't reach MealScout right now.`

3. Hook it into Scout:

   - Scout already returns `MEALSCOUT_COMMAND` actions from `/api/scout/...` responses.
   - In `client/src/scout/ScoutOS.tsx`, ensure that when an action of type `MEALSCOUT_COMMAND` is clicked, it:
     - Calls the same `/api/mealscout/sso` helper.
     - Then navigates to MealScout.

4. Test flow (dev):

   - Set fake dev values:
     - `MEALSCOUT_BASE_URL=http://localhost:4000`
     - `MEALSCOUT_SHARED_SECRET=dev_mealscout_secret`
     - `MEALSCOUT_API_TOKEN=dev_mealscout_api_token`
   - Run TradeScout dev server.
   - Hit `/api/mealscout/sso` via Postman or the UI.
   - Confirm:
     - 200 response with `{ ok: true, mealscoutBaseUrl, token }`.
     - Any `Set-Cookie` headers from MealScout are passed through.

Once this works in dev, mirror the env vars to production and confirm the same `/api/mealscout/sso` call from the deployed app.

---

## 2. Finish User Media Uploads

You already have a storage abstraction + some upload helpers. The remaining work is mostly configuration + wiring a simple upload widget into the right surfaces.

### 2.1. What already exists

Server-side:

- `server/objectStorage.ts`
  - Handles object storage paths and access for uploads.
- `server/routes.ts`
  - Section `// Object Storage Routes for File Uploads` – API endpoints that accept uploads and push them to object storage.
  - Admin bulk upload route using `multer` and a temporary `uploads/` dir before ingesting.
- `server/services/knowledgeIngest.ts`
  - Uses a `bulk_uploads` directory for ingest.

Client-side:

- `client/src/lib/objectUpload.ts`
  - Helper that uploads a single `File` or data URL to object storage and returns a stable public URL.
- `client/src/pages/admin-panel.tsx`
  - Admin-only upload UI that hits the object storage/ingest endpoints.

Docs / analysis:

- `MEDIA_AUDIT_REPORT.md` – shows which files touch S3/R2/presigning, env vars and helpers.
- `README_START_HERE.md` – calls out image uploads as an active workstream.

### 2.2. Choose and configure storage backend

The codebase is designed for S3-compatible object storage (AWS S3, Cloudflare R2, MinIO, etc.). Decide which you’re actually using in production, then set:

Common env vars (adjust to your provider):

- `S3_BUCKET` – bucket name.
- `S3_ENDPOINT` – custom endpoint if using R2/MinIO, or leave default for AWS.
- `AWS_REGION` – region (e.g., `us-east-1`).
- `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` – access credentials.

If you go with Cloudflare R2, use the R2 endpoint and credentials in these same vars; the code paths look for S3-compatible config.

### 2.3. Enable user-facing media upload flows

You already have admin upload flows; to let normal users upload media for their own content (profiles, listings, community, etc.), follow this pattern:

1. Pick the surfaces where uploads should be allowed first:

   - Contractor profile photos / gallery.
   - Marketplace listing images.
   - Community post images (if desired).

2. For each surface, wire the client helper:

   - Import `uploadObject` (or equivalent) from `client/src/lib/objectUpload.ts`.
   - Add an `<input type="file" accept="image/*" />` or Uppy-based picker.
   - On change:
     - Call the upload helper with the chosen file.
     - Receive a public URL.
     - Save that URL in the relevant API (e.g., update profile, create listing, create post).

3. Respect brand and size constraints:

   - Enforce max file size client-side (e.g., 5MB) before upload.
   - Optionally restrict mime types to `image/jpeg`, `image/png`, `image/webp`.
   - Provide clear error messages when upload fails.

4. Server-side security:

   - Ensure upload endpoints are behind `isAuthenticated` and role checks where appropriate.
   - Validate content type and size server-side if the storage layer supports it.
   - Store only the object key / URL in your DB, never raw file blobs.

### 2.4. End-to-end test checklist

For each user-facing upload flow you add:

1. Happy path:
   - User selects an image within size limits.
   - Upload completes.
   - The resulting URL is persisted on the entity (profile, listing, post).
   - Reload shows the image from your object storage CDN.

2. Failure modes:
   - Oversized file → clear client-side error, no request sent.
   - Unsupported type → clear error.
   - Storage misconfig (bad credentials/bucket) → server 500; client shows generic "Upload failed" toast and does not save a broken URL.

3. Permissions:
   - Non-logged-in user cannot see upload controls.
   - Wrong role users can’t hit admin-only upload endpoints.

---

## 3. Recommended order of operations

1. **MealScout SSO**
   - Set `MEALSCOUT_*` env vars.
   - Verify `/api/mealscout/sso` works in dev.
   - Wire a single UI entry point (button or Scout action) to call it and redirect.
   - Deploy and test in production.

2. **Media uploads**
   - Decide on your S3-compatible backend and set `S3_*` / `AWS_*` env vars.
   - Verify existing admin upload flow in `admin-panel` works end-to-end.
   - Add user-facing upload to one high-value surface (e.g., contractor profile).
   - Expand to listings / community once stable.

Once both are done, Scout can safely offer MealScout as a destination, and users can attach real media to their activity without you touching storage internals again.
