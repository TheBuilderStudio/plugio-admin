#!/usr/bin/env node
/**
 * Generates the Ed25519 key pair used to sign admin API calls.
 *   node scripts/generate-admin-keys.mjs [kid]
 * Put the PRIVATE value in the admin app's secret store (ADMIN_SIGNING_PRIVATE_KEY) and the PUBLIC value in the
 * backend (ADMIN_AUTH_PUBLIC_KEYS). The private key is shown once and is never stored by this script.
 */
import { generateKeyPairSync } from "node:crypto";

const kid = process.argv[2] || "k1";
const { publicKey, privateKey } = generateKeyPairSync("ed25519");
const priv = privateKey.export({ type: "pkcs8", format: "der" }).toString("base64");
const pub = publicKey.export({ type: "spki", format: "der" }).toString("base64");

console.log("Admin app (secret):");
console.log(`  ADMIN_SIGNING_KEY_ID=${kid}`);
console.log(`  ADMIN_SIGNING_PRIVATE_KEY=${priv}`);
console.log("");
console.log("Backend (public, not secret):");
console.log(`  ADMIN_AUTH_PUBLIC_KEYS=${kid}:${pub}`);
