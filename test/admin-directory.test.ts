import assert from "node:assert/strict";
import { generateKeyPairSync } from "node:crypto";
import { afterEach, beforeEach, describe, it } from "node:test";

import { isActiveBackendAdmin } from "../src/lib/admin-directory.ts";

const { privateKey } = generateKeyPairSync("ed25519");
const ENV = ["ADMIN_SIGNING_PRIVATE_KEY", "BACKEND_API_URL"] as const;

function backendReplies(status: number, data?: unknown) {
  globalThis.fetch = (async () =>
    new Response(JSON.stringify({ data }), { status, headers: { "Content-Type": "application/json" } })) as typeof fetch;
}

describe("isActiveBackendAdmin", () => {
  const savedEnv: Record<string, string | undefined> = {};
  const savedFetch = globalThis.fetch;

  beforeEach(() => {
    for (const k of ENV) savedEnv[k] = process.env[k];
    process.env.ADMIN_SIGNING_PRIVATE_KEY = privateKey.export({ type: "pkcs8", format: "der" }).toString("base64");
    process.env.BACKEND_API_URL = "http://backend.test";
  });

  afterEach(() => {
    for (const k of ENV) {
      if (savedEnv[k] === undefined) delete process.env[k];
      else process.env[k] = savedEnv[k];
    }
    globalThis.fetch = savedFetch;
  });

  it("accepts an admin the backend confirms with a signed token", async () => {
    backendReplies(200, { email: "new@x.y", role: "FINANCE", method: "SIGNED_TOKEN" });
    assert.equal(await isActiveBackendAdmin("New@X.y"), true);
  });

  it("never trusts a legacy-key answer (the backend accepts any claimed name there)", async () => {
    backendReplies(200, { email: "anyone@x.y", role: "SUPER_ADMIN", method: "LEGACY_KEY" });
    assert.equal(await isActiveBackendAdmin("anyone@x.y"), false);
  });

  it("rejects an answer about a different email", async () => {
    backendReplies(200, { email: "other@x.y", role: "SUPER_ADMIN", method: "SIGNED_TOKEN" });
    assert.equal(await isActiveBackendAdmin("new@x.y"), false);
  });

  it("answers false without a signing key, without calling the backend", async () => {
    delete process.env.ADMIN_SIGNING_PRIVATE_KEY;
    let called = false;
    globalThis.fetch = (async () => {
      called = true;
      return new Response("{}");
    }) as typeof fetch;
    assert.equal(await isActiveBackendAdmin("new@x.y"), false);
    assert.equal(called, false);
  });

  it("fails closed on a refusal or a network error", async () => {
    backendReplies(401);
    assert.equal(await isActiveBackendAdmin("new@x.y"), false);
    backendReplies(403);
    assert.equal(await isActiveBackendAdmin("new@x.y"), false);
    globalThis.fetch = (async () => {
      throw new Error("down");
    }) as typeof fetch;
    assert.equal(await isActiveBackendAdmin("new@x.y"), false);
  });
});
