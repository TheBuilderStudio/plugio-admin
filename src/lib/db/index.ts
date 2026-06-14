/**
 * Plugio Admin — MySQL Connection Pool
 *
 * Connects directly to the same plugio_db MySQL database used by the
 * Spring Boot backend. We connect with a connection pool for efficiency.
 *
 * Security:
 * - All credentials come from environment variables — never hardcoded
 * - SSL can be enabled by setting DB_SSL=true in production
 * - Connection pool limits prevent resource exhaustion
 *
 * Important: This module runs only in Node.js runtime (not Edge).
 * All Server Actions and Server Components that call this file must
 * NOT have `export const runtime = "edge"`.
 */

import mysql from "mysql2/promise";

// Validate required env vars at module load time (fail fast on misconfiguration)
const requiredEnvVars = ["DB_HOST", "DB_NAME", "DB_USERNAME", "DB_PASSWORD"];
for (const envVar of requiredEnvVars) {
  if (!process.env[envVar]) {
    throw new Error(
      `[plugio-admin] Missing required environment variable: ${envVar}. ` +
        `Copy .env.local.example to .env.local and fill in values.`
    );
  }
}

/**
 * Shared MySQL connection pool.
 * Use `pool.execute(sql, params)` for all queries — never string interpolation.
 */
export const pool = mysql.createPool({
  host: process.env.DB_HOST!,
  port: parseInt(process.env.DB_PORT ?? "3306", 10),
  database: process.env.DB_NAME!,
  user: process.env.DB_USERNAME!,
  password: process.env.DB_PASSWORD!,

  // Pool configuration
  waitForConnections: true,
  connectionLimit: 10, // Admin panel doesn't need a large pool
  queueLimit: 0,

  // Keep connections alive
  enableKeepAlive: true,
  keepAliveInitialDelay: 10000,

  // Timezone — match the backend's UTC setting
  timezone: "+00:00",

  // Character set — match the plugio_db utf8mb4 collation
  charset: "utf8mb4",
});

/**
 * Test the database connection.
 * Used on the Settings page to show DB status.
 */
export async function testConnection(): Promise<boolean> {
  try {
    const connection = await pool.getConnection();
    await connection.ping();
    connection.release();
    return true;
  } catch {
    return false;
  }
}
