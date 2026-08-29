import { generateKeyPairSync } from "crypto";
import express from "express";
import request from "supertest";
import { afterEach, describe, expect, it, vi } from "vitest";
import { isPluginOAuthConfigured } from "../plugin/oauth";
import {
  isPluginOAuthRoutePath,
  pluginOAuthRouter,
} from "../routes/plugin-oauth";

function createApp() {
  const app = express();
  app.use(express.json());
  app.use(pluginOAuthRouter);
  app.get("/api/health", (_req, res) => res.status(200).json({ status: "healthy" }));
  app.get("/unrelated", (_req, res) => res.status(200).json({ ok: true }));
  return app;
}

function configureSigningWithoutClient() {
  const { privateKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
  vi.stubEnv(
    "TRADESCOUT_PLUGIN_JWT_PRIVATE_KEY",
    privateKey.export({ type: "pkcs8", format: "pem" }).toString()
  );
  vi.stubEnv("TRADESCOUT_PLUGIN_ISSUER", "https://www.thetradescout.com");
  vi.stubEnv("TRADESCOUT_PLUGIN_AUDIENCE", "tradescout-plugin-api");
  vi.stubEnv("TRADESCOUT_PLUGIN_OAUTH_CLIENTS", "[]");
}

function configureValidPluginOAuth() {
  configureSigningWithoutClient();
  vi.stubEnv(
    "TRADESCOUT_PLUGIN_OAUTH_CLIENTS",
    JSON.stringify([
      {
        clientId: "tradescout-test-client",
        name: "TradeScout Test Client",
        redirectUris: ["https://client.example.com/oauth/callback"],
      },
    ])
  );
}

function disablePluginOAuth() {
  vi.stubEnv("TRADESCOUT_PLUGIN_JWT_PRIVATE_KEY", "");
  vi.stubEnv("TRADESCOUT_PLUGIN_ISSUER", "");
  vi.stubEnv("TRADESCOUT_PLUGIN_AUDIENCE", "");
  vi.stubEnv("TRADESCOUT_PLUGIN_OAUTH_CLIENTS", "");
}

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("plugin OAuth route ownership", () => {
  it("owns only the five plugin OAuth and JWKS paths", () => {
    for (const route of [
      "/.well-known/jwks.json",
      "/.well-known/oauth-authorization-server",
      "/.well-known/oauth-protected-resource",
      "/oauth/authorize",
      "/oauth/token",
    ]) {
      expect(isPluginOAuthRoutePath(route), route).toBe(true);
    }
    for (const route of ["/api/health", "/api/version", "/direct-connect", "/unrelated"] ) {
      expect(isPluginOAuthRoutePath(route), route).toBe(false);
    }
  });

  it("never swallows unrelated application routes when plugin OAuth is disabled", async () => {
    disablePluginOAuth();
    const app = createApp();

    const health = await request(app).get("/api/health");
    expect(health.status).toBe(200);
    expect(health.body).toEqual({ status: "healthy" });

    const unrelated = await request(app).get("/unrelated");
    expect(unrelated.status).toBe(200);
    expect(unrelated.body).toEqual({ ok: true });
  });
});

describe("plugin OAuth availability", () => {
  it("is unavailable when the signing contract is absent", () => {
    disablePluginOAuth();
    expect(isPluginOAuthConfigured()).toBe(false);
  });

  it("is unavailable for a partial or malformed configuration", () => {
    vi.stubEnv("TRADESCOUT_PLUGIN_JWT_PRIVATE_KEY", "not-a-private-key");
    vi.stubEnv("TRADESCOUT_PLUGIN_ISSUER", "http://thetradescout.com");
    vi.stubEnv("TRADESCOUT_PLUGIN_AUDIENCE", "tradescout-plugin-api");
    vi.stubEnv("TRADESCOUT_PLUGIN_OAUTH_CLIENTS", "not-json");
    expect(isPluginOAuthConfigured()).toBe(false);
  });

  it("is unavailable when signing exists but no OAuth client is registered", () => {
    configureSigningWithoutClient();
    expect(isPluginOAuthConfigured()).toBe(false);
  });

  it("returns a clean, non-cacheable 404 instead of throwing when disabled", async () => {
    disablePluginOAuth();

    for (const route of [
      "/.well-known/jwks.json",
      "/.well-known/oauth-authorization-server",
      "/.well-known/oauth-protected-resource",
      "/oauth/authorize",
    ]) {
      const response = await request(createApp()).get(route);
      expect(response.status, route).toBe(404);
      expect(response.headers["cache-control"], route).toBe("no-store");
      expect(response.body, route).toEqual({ error: "not_found" });
    }
  });

  it("publishes the signing key and metadata only when the full contract is valid", async () => {
    configureValidPluginOAuth();
    expect(isPluginOAuthConfigured()).toBe(true);

    const app = createApp();
    const jwks = await request(app).get("/.well-known/jwks.json");
    expect(jwks.status).toBe(200);
    expect(jwks.body.keys).toHaveLength(1);
    expect(jwks.body.keys[0]).toMatchObject({
      kty: "RSA",
      use: "sig",
      alg: "RS256",
      kid: "tradescout-plugin-v1",
    });
    expect(jwks.body.keys[0].d).toBeUndefined();

    const metadata = await request(app).get("/.well-known/oauth-authorization-server");
    expect(metadata.status).toBe(200);
    expect(metadata.body).toMatchObject({
      issuer: "https://www.thetradescout.com",
      authorization_endpoint: "https://www.thetradescout.com/oauth/authorize",
      token_endpoint: "https://www.thetradescout.com/oauth/token",
      jwks_uri: "https://www.thetradescout.com/.well-known/jwks.json",
    });
  });
});
