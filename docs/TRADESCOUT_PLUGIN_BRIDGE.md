# TradeScout Plugin Bridge

This is the TradeScout-owned authorization and canonical Business Profile boundary used by the
MCP server in `infotradescout/tradescout-infinity`.

## Required configuration

- `TRADESCOUT_PLUGIN_ISSUER`: production HTTPS origin for TradeScout authorization.
- `TRADESCOUT_PLUGIN_AUDIENCE`: exact audience configured in Infinity's JWT verifier.
- `TRADESCOUT_PLUGIN_JWT_PRIVATE_KEY`: PEM-encoded RSA private key. Newlines may be encoded as
  `\n`.
- `TRADESCOUT_PLUGIN_SERVICE_TOKEN`: high-entropy secret shared only with Infinity's server-side
  TradeScout adapter.
- `TRADESCOUT_PLUGIN_OAUTH_CLIENTS`: JSON array of allowlisted clients:

```json
[
  {
    "clientId": "chatgpt-tradescout",
    "name": "ChatGPT",
    "redirectUris": ["https://chatgpt.com/connector/oauth/callback"]
  }
]
```

Apply `migrations/0109_plugin_oauth_bridge.sql` before enabling the routes. The authorization
server fails closed when issuer, audience, signing key, clients, or service token are absent.

## Security boundary

- Browser login establishes the TradeScout owner subject.
- Authorization codes are single-use, short-lived, stored only as SHA-256 hashes, and bound to
  client, redirect URI, and an S256 PKCE challenge.
- Access tokens are RS256 JWTs with a 15-minute lifetime.
- Infinity authenticates to `/api/plugin/v1/*` with the service token and propagates the verified
  OAuth subject and derived tenant.
- Every Business Hub read and publish resolves the business through
  `businesses.owner_user_id`. Caller-supplied owner IDs are not accepted.
- Publish requires an expected profile version and an idempotency key.
- Unsupported external connections and PDF rendering return explicit errors or partial receipts.
  No external publication is simulated.

## Current slice

Implemented: OAuth metadata, consent, PKCE token exchange, JWKS, managed-business listing,
Business Hub snapshot, profile updates, service upserts, version checks, and durable receipts.

Not yet enabled: PDF rendering, provider connections, external social publication, Direct Connect
configuration writes, and rollback. Those capabilities must remain outside advertised scopes/tools
until their canonical implementations are connected.
