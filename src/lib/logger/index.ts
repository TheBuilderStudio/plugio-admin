/**
 * Plugio Admin — Audit Logger
 *
 * Records all sensitive admin operations to a structured log file.
 * Format: one JSON entry per line (JSONL / newline-delimited JSON).
 *
 * Log file location: {project_root}/logs/admin-audit.log
 *
 * Log entries include:
 *   - action: what happened (LOGIN, BETA_APPROVE, BETA_REJECT, etc.)
 *   - adminEmail: who did it
 *   - targetUserId / targetEmail: who it happened to
 *   - timestamp: ISO 8601 UTC
 *   - details: optional extra context
 *
 * In production, ship logs/admin-audit.log to your log aggregator (e.g., Datadog,
 * Loki, CloudWatch). The file is rotated manually or via logrotate.
 */

import { appendFile, mkdir, readFile, access } from "fs/promises";
import path from "path";
import type { AdminAuditLog } from "@/types";
import { pool } from "@/lib/db";

const LOG_DIR = path.join(process.cwd(), "logs");
const LOG_FILE = path.join(LOG_DIR, "admin-audit.log");

/**
 * Append an audit log entry asynchronously.
 * Non-blocking — never crashes the request if the write fails.
 */
export function logAdminAction(params: Omit<AdminAuditLog, "timestamp">): void {
  const entry: AdminAuditLog = {
    ...params,
    timestamp: new Date().toISOString(),
  };

  const line = JSON.stringify(entry) + "\n";

  // Fire-and-forget: write asynchronously, never block the request
  (async () => {
    try {
      await mkdir(LOG_DIR, { recursive: true });
      await appendFile(LOG_FILE, line, { encoding: "utf8" });
    } catch (err) {
      // Never crash the app due to logging infrastructure failures
      console.error("[plugio-admin] Failed to write audit log:", err);
    }
  })();

  // Durable copy in the database (table from migration V90). If the table is missing the file above still has it.
  void (async () => {
    try {
      await pool.execute(
        `INSERT INTO admin_audit_log (occurred_at, admin_email, action, target_user_id, target_email, details)
         VALUES (UTC_TIMESTAMP(6), ?, ?, ?, ?, ?)`,
        [
          entry.adminEmail,
          entry.action,
          entry.targetUserId ?? null,
          entry.targetEmail ?? null,
          entry.details ? entry.details.slice(0, 1000) : null,
        ]
      );
    } catch (err: any) {
      if (err?.code !== "ER_NO_SUCH_TABLE") console.error("[plugio-admin] Failed to write audit row:", err);
    }
  })();

  // Always echo to console for real-time visibility in dev/staging
  console.log("[ADMIN AUDIT]", entry);
}

/**
 * Read recent audit log entries (for the Audit page).
 * Returns the last N entries from the log file, newest first.
 */
export async function readRecentAuditLogs(limit = 20): Promise<AdminAuditLog[]> {
  // Prefer the database trail; fall back to the file when the table does not exist yet or is empty.
  try {
    const safe = Math.min(Math.max(1, Math.floor(limit)), 5000);
    const [rows] = await pool.execute<any[]>(
      `SELECT occurred_at, admin_email, action, target_user_id, target_email, details
       FROM admin_audit_log ORDER BY occurred_at DESC, id DESC LIMIT ${safe}`
    );
    if (rows.length > 0) {
      return rows.map((r) => ({
        action: r.action,
        adminEmail: r.admin_email,
        targetUserId: r.target_user_id ?? undefined,
        targetEmail: r.target_email ?? undefined,
        details: r.details ?? undefined,
        timestamp: new Date(r.occurred_at).toISOString(),
      })) as AdminAuditLog[];
    }
  } catch {
    // table missing or database unreachable: use the file
  }
  try {
    // Check existence without throwing
    await access(LOG_FILE);
    const content = await readFile(LOG_FILE, "utf8");
    const lines = content
      .trim()
      .split("\n")
      .filter((l) => l.trim());

    // Return last N entries in reverse-chronological order
    return lines
      .slice(-limit)
      .reverse()
      .map((line) => {
        try {
          return JSON.parse(line) as AdminAuditLog;
        } catch {
          return null;
        }
      })
      .filter(Boolean) as AdminAuditLog[];
  } catch {
    return [];
  }
}
