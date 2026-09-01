/**
 * Plugio Admin — Dynamic MySQL Connection Pool
 *
 * Connects to both prodPool and stagingPool at runtime, dynamically
 * routing queries based on the user's selected environment context cookie.
 *
 * Important: This module runs only in Node.js runtime (not Edge).
 */

import mysql from "mysql2/promise";
import { cookies } from "next/headers";

// Skip validation during Next.js build phase to allow Docker compilation without runtime env secrets.
const isBuildPhase = process.env.NEXT_PHASE === "phase-production-build";

const requiredEnvVars = ["DB_HOST", "DB_NAME", "DB_USERNAME", "DB_PASSWORD"];
if (!isBuildPhase) {
  for (const envVar of requiredEnvVars) {
    if (!process.env[envVar]) {
      throw new Error(
        `[plugio-admin] Missing required environment variable: ${envVar}. ` +
          `Copy .env.local.example to .env.local and fill in values.`
      );
    }
  }
}

// 1. Production Config (Fall back to default DB_* values if PROD_DB_* is not set)
const prodConfig = {
  host: process.env.PROD_DB_HOST || process.env.DB_HOST || "127.0.0.1",
  port: parseInt(process.env.PROD_DB_PORT || process.env.DB_PORT || "3306", 10),
  database: process.env.PROD_DB_NAME || process.env.DB_NAME || "plugio_db",
  user: process.env.PROD_DB_USERNAME || process.env.DB_USERNAME || "root",
  password: process.env.PROD_DB_PASSWORD || process.env.DB_PASSWORD || "",
  ssl: (process.env.PROD_DB_SSL || process.env.DB_SSL) === "true" ? { rejectUnauthorized: false } : undefined,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  enableKeepAlive: true,
  keepAliveInitialDelay: 10000,
  timezone: "+00:00",
  charset: "utf8mb4",
};

// 2. Staging Config (Fall back to default DB_* values if STAGING_DB_* is not set)
const stagingConfig = {
  host: process.env.STAGING_DB_HOST || process.env.DB_HOST || "127.0.0.1",
  port: parseInt(process.env.STAGING_DB_PORT || process.env.DB_PORT || "3306", 10),
  database: process.env.STAGING_DB_NAME || process.env.DB_NAME || "plugio_db",
  user: process.env.STAGING_DB_USERNAME || process.env.DB_USERNAME || "root",
  password: process.env.STAGING_DB_PASSWORD || process.env.DB_PASSWORD || "",
  ssl: (process.env.STAGING_DB_SSL || process.env.DB_SSL) === "true" ? { rejectUnauthorized: false } : undefined,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  enableKeepAlive: true,
  keepAliveInitialDelay: 10000,
  timezone: "+00:00",
  charset: "utf8mb4",
};

// Initialize pools
export const prodPool = mysql.createPool(prodConfig);
export const stagingPool = mysql.createPool(stagingConfig);

/**
 * Gets the current active database context from cookies or defaults to environment setting.
 */
export async function getActiveDbContext(): Promise<"production" | "staging"> {
  try {
    const cookieStore = await cookies();
    const context = cookieStore.get("plugio_db_context")?.value;
    if (context === "production" || context === "staging") {
      return context;
    }
  } catch (e) {
    // cookies() throws when called outside Request context (e.g. at build time or custom CLI scripts)
  }
  return process.env.NEXT_PUBLIC_ENVIRONMENT === "staging" ? "staging" : "production";
}

/**
 * Checks if staging DB config is distinct from production DB config.
 */
export function hasDistinctStagingDb(): boolean {
  return (
    process.env.STAGING_DB_NAME !== undefined &&
    process.env.STAGING_DB_NAME !== process.env.PROD_DB_NAME &&
    process.env.STAGING_DB_NAME !== process.env.DB_NAME
  );
}

/**
 * Returns the pool for an explicit DB context.
 * Use this inside unstable_cache — never call cookies() from cached loaders.
 */
export function getPoolForContext(
  context: "production" | "staging"
): mysql.Pool {
  return context === "staging" ? stagingPool : prodPool;
}

/**
 * Returns the pool matching the current active database context.
 */
export async function getActivePool(): Promise<mysql.Pool> {
  const context = await getActiveDbContext();
  return getPoolForContext(context);
}

/**
 * Proxy wrapper around active connection pool.
 * Dynamically routes queries to prodPool or stagingPool at runtime.
 */
export const pool = new Proxy({} as mysql.Pool, {
  get(target, prop, receiver) {
    return async (...args: any[]) => {
      const activePool = await getActivePool();
      const fn = Reflect.get(activePool, prop, receiver);
      if (typeof fn === "function") {
        return fn.apply(activePool, args);
      }
      return fn;
    };
  },
});

/**
 * Test the database connection.
 * Used on the Settings page to show DB status.
 */
export async function testConnection(): Promise<boolean> {
  try {
    const activePool = await getActivePool();
    const connection = await activePool.getConnection();
    await connection.ping();
    connection.release();
    return true;
  } catch {
    return false;
  }
}
