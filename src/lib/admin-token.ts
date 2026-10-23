import "server-only";

import { createPrivateKey, randomUUID, sign } from "node:crypto";

/**
 * Per-request admin token for the Plugio backend (EdDSA / Ed25519 JWT).
 *
 * The backend holds only the matching public key, so it can verify these but never mint them. A token is bound to
 * the HTTP method and path, lives 60 seconds and carries a one-time id. The admin's role is NOT in the token: the
 * backend looks it up from its own admin_users table.
 *
 * Returns null when no signing key is configured (legacy mode), so callers fall back to the shared API key.
 */

const TOKEN_TTL_SECONDS = 60;

function b64url(input: Buffer | string): string {
  return Buffer.from(input).toString("base64url");
}

export function signAdminToken(args: { email: string; method: string; path: string; nowMs?: number }): string | null {
  const raw = process.env.ADMIN_SIGNING_PRIVATE_KEY;
  if (!raw) return null;

  const key = createPrivateKey({ key: Buffer.from(raw, "base64"), format: "der", type: "pkcs8" });
  const iat = Math.floor((args.nowMs ?? Date.now()) / 1000);
  const header = { alg: "EdDSA", typ: "JWT", kid: process.env.ADMIN_SIGNING_KEY_ID || "k1" };
  const payload = {
    iss: "plugio-admin",
    sub: args.email.trim().toLowerCase(),
    aud: process.env.ADMIN_TOKEN_AUDIENCE || "plugio-backend",
    iat,
    exp: iat + TOKEN_TTL_SECONDS,
    jti: randomUUID(),
    m: args.method.toUpperCase(),
    p: args.path,
  };
  const signingInput = `${b64url(JSON.stringify(header))}.${b64url(JSON.stringify(payload))}`;
  const signature = sign(null, Buffer.from(signingInput), key);
  return `${signingInput}.${b64url(signature)}`;
}

export class AdminAuthConfigError extends Error {}

/**
 * Headers that identify the acting admin to the backend, for one request.
 *
 * With a signing key configured the request carries the signed token only: the shared key is never sent, so it can be
 * rotated or removed after the cut-over without touching the admin app. Without one (legacy mode) the shared key and
 * the claimed actor name are sent, exactly as before.
 *
 * @throws AdminAuthConfigError when neither a signing key nor a shared key is configured
 */
export function adminAuthHeaders(args: {
  actor: string;
  method: string;
  path: string;
  apiKey?: string;
}): Record<string, string> {
  const token = signAdminToken({ email: args.actor, method: args.method, path: args.path });
  if (token) {
    return { "X-Admin-Token": token, "X-Admin-Actor": args.actor };
  }
  if (!args.apiKey) {
    throw new AdminAuthConfigError(
      "Admin authentication is not configured: set ADMIN_SIGNING_PRIVATE_KEY (signed mode) or ADMIN_API_KEY (legacy mode).",
    );
  }
  return { "X-Admin-Api-Key": args.apiKey, "X-Admin-Actor": args.actor };
}
