/**
 * Coupon expiry is stored as UTC DATETIME so checkout (Hibernate Instant, JVM UTC)
 * sees the same instant the admin picked in the browser.
 */

const MYSQL_DATETIME = /^(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2}:\d{2})(\.\d+)?$/;

/** Parse a mysql2 Date or naive DATETIME string as UTC. */
export function parseMysqlUtcDate(value: Date | string | null | undefined): Date | null {
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }
  if (typeof value !== "string" || !value.trim()) return null;
  const trimmed = value.trim();
  const mysql = trimmed.match(MYSQL_DATETIME);
  if (mysql) {
    const parsed = new Date(`${mysql[1]}T${mysql[2]}${mysql[3] ?? ""}Z`);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }
  const parsed = new Date(trimmed);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

/** Convert a datetime-local value (browser local clock) to UTC ISO. */
export function datetimeLocalToIso(raw: string): string {
  if (typeof raw !== "string" || !raw.trim()) return "";
  let value = raw.trim();
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) {
    value += ":00";
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "";
  return parsed.toISOString();
}

export function parseRequiredExpiry(raw: string): Date | null {
  if (typeof raw !== "string" || !raw.trim()) return null;
  const parsed = new Date(raw.trim());
  if (Number.isNaN(parsed.getTime())) return null;
  if (parsed.getTime() <= Date.now()) return null;
  return parsed;
}

/** Naive DATETIME literal in UTC. mysql2 will not shift this again. */
export function toMysqlUtcDateTime(date: Date): string {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) {
    throw new Error("Coupon expiry is missing or invalid");
  }
  const pad = (n: number) => String(n).padStart(2, "0");
  return (
    `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())} ` +
    `${pad(date.getUTCHours())}:${pad(date.getUTCMinutes())}:${pad(date.getUTCSeconds())}`
  );
}

/** Value for `<input type="datetime-local">` in the browser's local timezone. */
export function toDatetimeLocalValue(d: Date | string | null | undefined): string {
  const date = parseMysqlUtcDate(d);
  if (!date) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export type CouponRuntimeStatus = "Active" | "Inactive" | "Expired";

export function couponRuntimeStatus(active: boolean, expiresAt: Date | string | null): CouponRuntimeStatus {
  if (!active) return "Inactive";
  const expires = parseMysqlUtcDate(expiresAt);
  if (!expires || expires.getTime() <= Date.now()) {
    return "Expired";
  }
  return "Active";
}

export function couponStatusClass(status: CouponRuntimeStatus): string {
  if (status === "Active") return "badge-approved";
  if (status === "Expired") return "bg-amber-50 text-amber-800";
  return "badge-none";
}
