import type { Tone } from "@/components/ui/badge";

const TONES: Record<string, Tone> = {
  // good
  PAID: "success", FULFILLED: "success", APPROVED: "success", ACTIVE: "success", SUCCESS: "success",
  PUBLISHED: "success", COMPLETED: "success", SETTLED: "success", RESOLVED: "success", KEPT: "success",
  // needs a look
  PENDING: "warning", CREATED: "warning", REQUESTED: "warning", REFUND_PENDING: "danger", OPEN: "warning",
  TRIALING: "info", UPCOMING: "info", SCHEDULED: "info", RESCHEDULED: "info", REPORTED: "warning",
  // bad
  FAILED: "danger", REJECTED: "danger", EXPIRED: "danger", SUSPENDED: "danger", HIDDEN: "danger", LOST: "danger",
  // quiet
  REFUNDED: "neutral", CANCELLED: "neutral", DISMISSED: "neutral", ARCHIVED: "neutral", DRAFT: "neutral",
  NONE: "neutral", FREE: "neutral",
};

export function statusTone(status: string | null | undefined): Tone {
  return TONES[(status ?? "").toUpperCase()] ?? "neutral";
}

/** "REFUND_PENDING" -> "Refund pending" */
export function statusLabel(status: string | null | undefined): string {
  const t = (status ?? "").replaceAll("_", " ").toLowerCase();
  return t ? t[0].toUpperCase() + t.slice(1) : "—";
}
