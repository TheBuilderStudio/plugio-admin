import assert from "node:assert/strict";
import { generateKeyPairSync, verify } from "node:crypto";
import { afterEach, beforeEach, describe, it } from "node:test";

import { AdminAuthConfigError, adminAuthHeaders, signAdminToken } from "../src/lib/admin-token.ts";

const ENV_KEYS = ["ADMIN_SIGNING_PRIVATE_KEY", "ADMIN_SIGNING_KEY_ID", "ADMIN_TOKEN_AUDIENCE"] as const;

function decode(part: string) {
  return JSON.parse(Buffer.from(part, "base64url").toString());
}

describe("signAdminToken", () => {
  const { publicKey, privateKey } = generateKeyPairSync("ed25519");
  const saved: Record<string, string | undefined> = {};

  beforeEach(() => {
    for (const k of ENV_KEYS) saved[k] = process.env[k];
    process.env.ADMIN_SIGNING_PRIVATE_KEY = privateKey.export({ type: "pkcs8", format: "der" }).toString("base64");
    delete process.env.ADMIN_SIGNING_KEY_ID;
    delete process.env.ADMIN_TOKEN_AUDIENCE;
  });

  afterEach(() => {
    for (const k of ENV_KEYS) {
      if (saved[k] === undefined) delete process.env[k];
      else process.env[k] = saved[k];
    }
  });

  it("returns null without a signing key so callers fall back to legacy mode", () => {
    delete process.env.ADMIN_SIGNING_PRIVATE_KEY;
    assert.equal(signAdminToken({ email: "a@b.c", method: "GET", path: "/api/admin/users/me" }), null);
  });

  it("signs a token the backend's public key verifies", () => {
    const token = signAdminToken({ email: "a@b.c", method: "GET", path: "/p" })!;
    const [h, p, s] = token.split(".");
    const ok = verify(null, Buffer.from(`${h}.${p}`), publicKey, Buffer.from(s, "base64url"));
    assert.equal(ok, true);
  });

  it("rejects a token whose payload was altered", () => {
    const [h, p, s] = signAdminToken({ email: "a@b.c", method: "GET", path: "/p" })!.split(".");
    const forged = Buffer.from(JSON.stringify({ ...decode(p), sub: "evil@x.y" })).toString("base64url");
    assert.equal(verify(null, Buffer.from(`${h}.${forged}`), publicKey, Buffer.from(s, "base64url")), false);
  });

  it("binds the token to method and path, normalises the email, and lives 60 seconds", () => {
    const token = signAdminToken({ email: "  Admin@Plugio.App ", method: "post", path: "/api/x", nowMs: 1_700_000_000_000 })!;
    const [h, p] = token.split(".");
    assert.deepEqual(decode(h), { alg: "EdDSA", typ: "JWT", kid: "k1" });
    const claims = decode(p);
    assert.equal(claims.sub, "admin@plugio.app");
    assert.equal(claims.m, "POST");
    assert.equal(claims.p, "/api/x");
    assert.equal(claims.aud, "plugio-backend");
    assert.equal(claims.iat, 1_700_000_000);
    assert.equal(claims.exp, 1_700_000_060);
  });

  it("gives every token a unique one-time id", () => {
    const a = decode(signAdminToken({ email: "a@b.c", method: "GET", path: "/p" })!.split(".")[1]);
    const b = decode(signAdminToken({ email: "a@b.c", method: "GET", path: "/p" })!.split(".")[1]);
    assert.notEqual(a.jti, b.jti);
  });

  it("uses the configured key id and audience", () => {
    process.env.ADMIN_SIGNING_KEY_ID = "k2";
    process.env.ADMIN_TOKEN_AUDIENCE = "staging-backend";
    const [h, p] = signAdminToken({ email: "a@b.c", method: "GET", path: "/p" })!.split(".");
    assert.equal(decode(h).kid, "k2");
    assert.equal(decode(p).aud, "staging-backend");
  });
});

describe("adminAuthHeaders", () => {
  const { privateKey } = generateKeyPairSync("ed25519");
  const saved = process.env.ADMIN_SIGNING_PRIVATE_KEY;

  afterEach(() => {
    if (saved === undefined) delete process.env.ADMIN_SIGNING_PRIVATE_KEY;
    else process.env.ADMIN_SIGNING_PRIVATE_KEY = saved;
  });

  it("sends only the signed token, never the shared key, when a signing key is configured", () => {
    process.env.ADMIN_SIGNING_PRIVATE_KEY = privateKey.export({ type: "pkcs8", format: "der" }).toString("base64");
    const h = adminAuthHeaders({ actor: "a@b.c", method: "GET", path: "/p", apiKey: "shared-secret" });
    assert.ok(h["X-Admin-Token"]);
    assert.equal(h["X-Admin-Api-Key"], undefined);
  });

  it("falls back to the shared key in legacy mode", () => {
    delete process.env.ADMIN_SIGNING_PRIVATE_KEY;
    assert.deepEqual(adminAuthHeaders({ actor: "a@b.c", method: "GET", path: "/p", apiKey: "k" }), {
      "X-Admin-Api-Key": "k",
      "X-Admin-Actor": "a@b.c",
    });
  });

  it("refuses to run with no credentials at all", () => {
    delete process.env.ADMIN_SIGNING_PRIVATE_KEY;
    assert.throws(() => adminAuthHeaders({ actor: "a@b.c", method: "GET", path: "/p" }), AdminAuthConfigError);
  });
});
