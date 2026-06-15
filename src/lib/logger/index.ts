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

  // Always echo to console for real-time visibility in dev/staging
  console.log("[ADMIN AUDIT]", entry);
}

/**
 * Read recent audit log entries (for the Audit page).
 * Returns the last N entries from the log file, newest first.
 */
export async function readRecentAuditLogs(limit = 20): Promise<AdminAuditLog[]> {
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
