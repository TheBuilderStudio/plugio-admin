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

import fs from "fs";
import path from "path";
import type { AdminAuditLog } from "@/types";

const LOG_DIR = path.join(process.cwd(), "logs");
const LOG_FILE = path.join(LOG_DIR, "admin-audit.log");

/**
 * Append an audit log entry.
 * This is a synchronous write (appendFileSync) to guarantee the log
 * is written before the function returns — important for security events.
 */
export function logAdminAction(params: Omit<AdminAuditLog, "timestamp">): void {
  const entry: AdminAuditLog = {
    ...params,
    timestamp: new Date().toISOString(),
  };

  const line = JSON.stringify(entry) + "\n";

  try {
    // Ensure log directory exists
    if (!fs.existsSync(LOG_DIR)) {
      fs.mkdirSync(LOG_DIR, { recursive: true });
    }

    // Append to log file (creates if doesn't exist)
    fs.appendFileSync(LOG_FILE, line, { encoding: "utf8", flag: "a" });
  } catch (err) {
    // Never crash the app due to a logging failure
    // Console.error is acceptable for logging infrastructure errors
    console.error("[plugio-admin] Failed to write audit log:", err);
  }

  // Always also log to console for development visibility
  console.log("[ADMIN AUDIT]", entry);
}

/**
 * Read recent audit log entries (for Settings page).
 * Returns the last N entries from the log file.
 */
export function readRecentAuditLogs(limit = 20): AdminAuditLog[] {
  try {
    if (!fs.existsSync(LOG_FILE)) return [];

    const content = fs.readFileSync(LOG_FILE, "utf8");
    const lines = content
      .trim()
      .split("\n")
      .filter((l) => l.trim());

    // Return last N entries
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
